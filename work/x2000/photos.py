#!/usr/bin/env python3
"""Commons 사진 후보 찾기·받기 (공유 요청 도구 commons_get.py 로만 요청 — 전역 직렬·6초 간격).
  python3 work/x2000/photos.py find <작업폴더> --cat "Vigan Cathedral" [--cat …] [--search "낱말"] [--max 150]
  python3 work/x2000/photos.py subcats <작업폴더> --cat "Vigan"
  python3 work/x2000/photos.py get <작업폴더> "File:a.jpg" "File:b.jpg" …   → <작업폴더>/orig/<번호>.jpg (가로 1280 표준 크기)
픽셀을 바꾸지 않는다. WebP 변환은 통합 담당이 한다."""
import sys, json, re, subprocess, pathlib, urllib.parse, html, argparse, hashlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
GET = ROOT / 'work/expansion-1973/parallel20/commons_get.py'
API = 'https://commons.wikimedia.org/w/api.php?format=json&formatversion=2&'
OKLIC = re.compile(r'^(CC BY(-SA)? [0-9.]+( [a-z]{2,})?|CC0|Public domain|PDM.*)$', re.I)

def api(d, params, tag):
    out = d / 'net' / (tag + '.json'); out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([sys.executable, str(GET), API + urllib.parse.urlencode(params), '--out', str(out)], capture_output=True, text=True)
    if r.returncode == 75: sys.exit('요청 도구가 냉각 중이다(exit 75, 요청 안 보냄). 몇 분 뒤 다시 실행한다: ' + r.stdout.strip()[-200:])
    try: return json.loads(out.read_text())
    except Exception: sys.exit(f'응답을 읽지 못함 — {r.stdout[-300:]} {r.stderr[-300:]}')

def strip(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s or ''))).strip()

def record(p):
    ii = (p.get('imageinfo') or [None])[0]
    if not ii: return None
    em = ii.get('extmetadata', {}); g = lambda k: strip(em.get(k, {}).get('value', ''))
    return {'title': p['title'], 'w': ii.get('width', 0), 'h': ii.get('height', 0), 'mime': ii.get('mime'),
            'author': g('Artist') or ii.get('user', ''), 'uploader': ii.get('user', ''), 'license': g('LicenseShortName'),
            'date': g('DateTimeOriginal')[:10] or g('DateTime')[:10], 'desc': g('ImageDescription')[:220], 'cats': g('Categories')[:260],
            'lat': g('GPSLatitude'), 'lon': g('GPSLongitude'), 'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl'), 'tw': ii.get('thumbwidth')}

def load(d):
    f = d / 'photos.json'
    return json.loads(f.read_text()) if f.exists() else {}

def save(d, db): (d / 'photos.json').write_text(json.dumps(db, ensure_ascii=False, indent=1) + '\n')

def usable(r): return r['mime'] in ('image/jpeg', 'image/png') and r['w'] >= 1080 and OKLIC.match(r['license'] or '')

def show(recs):
    for r in recs:
        gps = f" gps={float(r['lat']):.3f},{float(r['lon']):.3f}" if r['lat'] and r['lon'] else ''
        print(f"- {r['title']} | {r['w']}x{r['h']} | {r['author'][:40]} | {r['date']} | {r['license']}{gps}\n    {r['desc'][:160]}")

def find(d, a):
    db = load(d); new = []
    base = {'action': 'query', 'prop': 'imageinfo', 'iiprop': 'url|size|mime|user|extmetadata', 'iiurlwidth': 1280, 'iiextmetadatafilter': 'Artist|LicenseShortName|DateTimeOriginal|DateTime|ImageDescription|Categories|GPSLatitude|GPSLongitude'}
    jobs = [('cat', c) for c in a.cat] + [('search', s) for s in a.search]
    for kind, v in jobs:
        params = dict(base); cont = {}; n = 0
        if kind == 'cat': params.update(generator='categorymembers', gcmtitle='Category:' + v.removeprefix('Category:'), gcmtype='file', gcmlimit=50)
        else: params.update(generator='search', gsrsearch=v + ' filetype:bitmap', gsrnamespace=6, gsrlimit=50)
        while n < a.max:
            tag = hashlib.md5((kind + v + json.dumps(cont, sort_keys=True)).encode()).hexdigest()[:12]
            j = api(d, {**params, **cont}, tag)
            pages = j.get('query', {}).get('pages', [])
            for p in pages:
                r = record(p); n += 1
                if r and r['title'] not in db: db[r['title']] = r; new.append(r)
            if 'continue' not in j or not pages: break
            cont = j['continue']
        print(f'# {kind} "{v}" — 파일 {n}개 확인')
        save(d, db)
    ok = [r for r in new if usable(r)]
    print(f'# 새로 찾은 {len(new)}개 중 쓸 수 있는 것(가로 1080 이상·CC BY/BY-SA/CC0/PD·JPEG/PNG) {len(ok)}개')
    show(ok)

def subcats(d, a):
    for c in a.cat:
        j = api(d, {'action': 'query', 'generator': 'categorymembers', 'gcmtitle': 'Category:' + c.removeprefix('Category:'), 'gcmtype': 'subcat', 'gcmlimit': 200, 'prop': 'categoryinfo'}, 'sub' + hashlib.md5(c.encode()).hexdigest()[:10])
        ci = api(d, {'action': 'query', 'titles': 'Category:' + c.removeprefix('Category:'), 'prop': 'categoryinfo'}, 'ci' + hashlib.md5(c.encode()).hexdigest()[:10])
        me = (ci.get('query', {}).get('pages') or [{}])[0].get('categoryinfo', {})
        print(f'# Category:{c} — 직접 파일 {me.get("files", 0)}개, 하위 분류 {me.get("subcats", 0)}개')
        for p in sorted(j.get('query', {}).get('pages', []), key=lambda p: -p.get('categoryinfo', {}).get('files', 0)):
            print(f"  {p['title']} — 파일 {p.get('categoryinfo', {}).get('files', 0)}, 하위 {p.get('categoryinfo', {}).get('subcats', 0)}")

def get(d, a):
    db = load(d); (d / 'orig').mkdir(exist_ok=True)
    idx = json.loads((d / 'orig/index.json').read_text()) if (d / 'orig/index.json').exists() else {}
    for t in a.files:
        if t not in db: print(f'! photos.json 에 없음(find 로 먼저 찾는다): {t}'); continue
        r = db[t]
        if not usable(r): print(f'! 쓸 수 없음(크기·라이선스): {t}'); continue
        if t in idx and (d / 'orig' / idx[t]).exists(): print(f'= 이미 받음 orig/{idx[t]}  {t}'); continue
        n = max([int(v.split('.')[0]) for v in idx.values()] + [0]) + 1
        out = d / 'orig' / f'{n}.jpg'
        u = r['thumb'] or ''
        if not u: print(f'! 받을 주소 없음: {t}'); continue
        p = subprocess.run([sys.executable, str(GET), u, '--out', str(out)], capture_output=True, text=True)
        if p.returncode == 75: sys.exit('요청 도구가 냉각 중이다(exit 75). 몇 분 뒤 남은 파일을 다시 요청한다.')
        head = out.read_bytes()[:4] if out.exists() else b''
        if not (head[:3] == b'\xff\xd8\xff' or head == b'\x89PNG'):
            print(f'! 받기 실패(같은 주소를 되풀이하지 말고 다른 사진을 고른다): {t} — {p.stdout.strip()[-160:]}'); out.unlink(missing_ok=True); continue
        idx[t] = out.name; (d / 'orig/index.json').write_text(json.dumps(idx, ensure_ascii=False, indent=1) + '\n')
        print(f'+ orig/{out.name}  ({r["tw"] or r["w"]}px)  {t}')

ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['find', 'subcats', 'get']); ap.add_argument('dir'); ap.add_argument('files', nargs='*')
ap.add_argument('--cat', action='append', default=[]); ap.add_argument('--search', action='append', default=[]); ap.add_argument('--max', type=int, default=150)
a = ap.parse_args(); d = pathlib.Path(a.dir).resolve(); d.mkdir(parents=True, exist_ok=True)
{'find': find, 'subcats': subcats, 'get': get}[a.cmd](d, a)
