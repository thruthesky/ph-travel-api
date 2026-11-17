"""병렬 담당의 Commons 공개 GET 요청을 직렬화한다. 픽셀 가공은 하지 않는다."""
import argparse,pathlib,json,time,urllib.parse,subprocess,fcntl,datetime,sys,email.utils
p=argparse.ArgumentParser();p.add_argument('url');p.add_argument('--out',required=True);a=p.parse_args();u=urllib.parse.urlparse(a.url)
if u.scheme!='https' or u.hostname not in {'commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org'} or u.username or u.password:raise SystemExit('허용된 Commons 공개 HTTPS GET 주소만 사용한다')
root=pathlib.Path(__file__).resolve().parents[3];state=root/'_i18n/work/expansion-1973/parallel20/network';state.mkdir(parents=True,exist_ok=True);out=pathlib.Path(a.out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
# 잠금 중 요청까지 완료해 동시에 외부 요청이 발생하지 않는다.
with (state/'lock').open('a+')as lock:
 fcntl.flock(lock,fcntl.LOCK_EX);s=state/'state.json';d=json.loads(s.read_text())if s.exists()else{};delay=max(0,d.get('next_allowed',0)-time.time())
 if delay>60:print(json.dumps({'status':'cooldown','wait_seconds':round(delay),'request_sent':False},ensure_ascii=False));raise SystemExit(75)
 if delay:time.sleep(delay)
 headers=out.with_name(out.name+'.headers.txt');r=subprocess.run(['curl','--silent','--show-error','--max-time','40','--dump-header',str(headers),'--output',str(out),'--write-out','%{http_code}',a.url],capture_output=True,text=True);code=int(r.stdout)if r.stdout.isdigit()else 0;now=time.time();retry=None
 if headers.exists():
  for line in headers.read_text(errors='replace').splitlines():
   if line.lower().startswith('retry-after:'):
    raw=line.split(':',1)[1].strip()
    try:retry=float(raw)
    except ValueError:
     try:retry=max(0,email.utils.parsedate_to_datetime(raw).timestamp()-now)
     except Exception:pass
 record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':a.url,'out':str(out),'http_status':code,'curl_exit_code':r.returncode,'retry_after_seconds':retry,'request_sent':True};d={'next_allowed':now+(max(600,retry or 0)if code in [403,429]else 15),'last_status':code,'last_url':a.url};s.write_text(json.dumps(d)+'\n')
 with (state/'requests.jsonl').open('a')as log:log.write(json.dumps(record,ensure_ascii=False)+'\n')
 print(json.dumps(record,ensure_ascii=False))
 if code!=200 or r.returncode:raise SystemExit(8)
