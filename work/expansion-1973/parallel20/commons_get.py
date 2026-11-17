"""공개 Commons GET을 도착 순서대로 직렬화한다. 픽셀을 만들거나 바꾸지 않는다."""
import argparse, pathlib, json, time, urllib.parse, subprocess, fcntl, datetime, sys, email.utils, os

parser = argparse.ArgumentParser()
parser.add_argument('url')
parser.add_argument('--out', required=True)
args = parser.parse_args()
url = urllib.parse.urlparse(args.url)
if url.scheme != 'https' or url.hostname not in {'commons.wikimedia.org', 'upload.wikimedia.org', 'thumb.wikimedia.org'} or url.username or url.password:
    raise SystemExit('허용된 Commons 공개 HTTPS GET 주소만 사용한다')
root = pathlib.Path(__file__).resolve().parents[3]
state_dir = root / '_i18n/work/expansion-1973/parallel20/network'
state_dir.mkdir(parents=True, exist_ok=True)
queue_dir = state_dir / 'queue'
queue_dir.mkdir(exist_ok=True)
output = pathlib.Path(args.out).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
state_file = state_dir / 'state.json'
arrival = time.time_ns()
ticket = queue_dir / f'{arrival:020d}-{os.getpid()}.json'
ticket.write_text(json.dumps({'pid': os.getpid(), 'arrival_ns': arrival, 'url': args.url}) + '\n')

def read_state():
    try:
        return json.loads(state_file.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def cooldown(state):
    remaining = max(0, state.get('next_allowed', 0) - time.time())
    if remaining > 60:
        print(json.dumps({'status': 'cooldown', 'wait_seconds': round(remaining), 'request_sent': False}, ensure_ascii=False))
        raise SystemExit(75)
    return remaining

try:
    with (state_dir / 'lock').open('a+') as lock:
        while True:
            cooldown(read_state())
            # 예기치 않게 종료된 클라이언트만 대기열에서 제거한다.
            for candidate in queue_dir.glob('*.json'):
                try:
                    pid = json.loads(candidate.read_text())['pid']
                    os.kill(pid, 0)
                except ProcessLookupError:
                    candidate.unlink(missing_ok=True)
                except (FileNotFoundError, json.JSONDecodeError, KeyError, PermissionError):
                    pass
            ordered = sorted(queue_dir.glob('*.json'))
            if ordered and ordered[0] == ticket:
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    pass
            time.sleep(0.5)
        delay = cooldown(read_state())
        if delay:
            time.sleep(delay)
        headers = output.with_name(output.name + '.headers.txt')
        request_started = time.time()
        result = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '40', '--user-agent', 'ph-travel-api-content/1.0 (https://github.com/thruthesky/ph-travel-api; public-content-research)', '--dump-header', str(headers), '--output', str(output), '--write-out', '%{http_code}', args.url], capture_output=True, text=True)
        code = int(result.stdout) if result.stdout.isdigit() else 0
        now = time.time()
        retry_after = None
        if headers.exists():
            for line in headers.read_text(errors='replace').splitlines():
                if line.lower().startswith('retry-after:'):
                    raw = line.split(':', 1)[1].strip()
                    try:
                        retry_after = float(raw)
                    except ValueError:
                        try:
                            retry_after = max(0, email.utils.parsedate_to_datetime(raw).timestamp() - now)
                        except (ValueError, TypeError, OverflowError):
                            pass
        record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'arrival_ns': arrival, 'queue_wait_seconds': round(request_started - arrival / 1e9, 3), 'url': args.url, 'out': str(output), 'http_status': code, 'curl_exit_code': result.returncode, 'retry_after_seconds': retry_after, 'request_attempted': True, 'http_response_received': bool(code), 'request_sent': False if result.returncode == 6 else (True if code else None), 'minimum_gap_seconds': 6, 'client_notice': 'categorymembers가500파일을반환해도imageinfo는50개에만붙을수있다.실제imageinfo있는파일수를세고필요제목을최대50개batch titles로보완한다.', 'transport_error_kind': 'dns_resolution_failed' if result.returncode == 6 else ('curl_transport_error' if result.returncode else None)}
        pause = max(600, retry_after or 0) if code in [403, 429] else 6
        temporary = state_dir / f'state-{os.getpid()}.tmp'
        temporary.write_text(json.dumps({'next_allowed': now + pause, 'last_status': code, 'last_url': args.url}) + '\n')
        temporary.replace(state_file)
        with (state_dir / 'requests.jsonl').open('a') as log:
            log.write(json.dumps(record, ensure_ascii=False) + '\n')
        print(json.dumps(record, ensure_ascii=False))
        if code != 200 or result.returncode:
            raise SystemExit(8)
finally:
    ticket.unlink(missing_ok=True)
