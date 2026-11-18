#!/usr/bin/env python3
"""이미 data/ 에 있는 사진 없는 여행지에 사진을 붙인다 (통합 담당만 실행).
  python3 work/x2000/photo-apply.py plan  <id-slug> …   → 검사하고 변환 목록 _i18n/work/x2000/photo-convert-manifest.json 을 쓴다
  (Codex CLI 로 가로 1080 WebP 변환 — 픽셀 내용은 바꾸지 않는다)
  python3 work/x2000/photo-apply.py apply <id-slug> …   → data/images, data/ko·en 의 image·gallery, sources, i18n/photoless.json 을 고친다

작업 폴더 W = _i18n/work/x2000/<id-slug>/ 에 필요한 것:
  photo-spec.json  {"images":[{"file":"File:….jpg","alt":"한국어 설명","alt_en":"English description"}, … 10장 이상, 첫 장이 대표],
                    "checks":["사진마다 무엇을 보고 맞다고 판단했는지", …]}
  photos.json      photos.py find 가 쌓은 메타(작가·라이선스·원본 페이지)
  orig/index.json  photos.py get 이 받은 원본 파일 이름
  images/<id-slug>.webp, -2 … (변환 결과, 가로 1080)"""
import sys, json, pathlib, shutil, struct, datetime
R = pathlib.Path(__file__).resolve().parents[2]; X = R / '_i18n/work/x2000'
cmd, names = sys.argv[1], sys.argv[2:]

def webp_size(p):
    b = p.read_bytes()[:40]
    if b[12:16] == b'VP8 ': return struct.unpack('<HH', b[26:30])[0] & 0x3fff, struct.unpack('<HH', b[26:30])[1] & 0x3fff
    if b[12:16] == b'VP8L': v = struct.unpack('<I', b[21:25])[0]; return (v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1
    if b[12:16] == b'VP8X': return int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1
    return 0, 0

def jload(p): return json.loads(p.read_text())
def jsave(p, d): p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

manifest = []; ok = []
for n in names:
    W = X / n; bad = []
    try:
        spec = jload(W / 'photo-spec.json'); db = jload(W / 'photos.json'); idx = jload(W / 'orig/index.json')
        ko = jload(R / 'data/ko' / f'{n}.json'); en = jload(R / 'data/en' / f'{n}.json')
    except Exception as e: print(f'! {n}: 파일 부족 — {e}'); continue
    ims = spec['images']
    if 'image' in ko and cmd == 'plan': bad.append('이미 사진 있음')
    if len(ims) < 10: bad.append('사진 10장 미만')
    if len(spec.get('checks', [])) < len(ims): bad.append('checks 부족')
    if len({im['file'] for im in ims}) != len(ims): bad.append('같은 사진 중복')
    for i, im in enumerate(ims):
        if not im.get('alt') or not im.get('alt_en'): bad.append(f'alt·alt_en 없음 {i + 1}번')
        if im['file'] not in db: bad.append(f'photos.json 에 없음 {im["file"]}'); continue
        o = W / 'orig' / idx.get(im['file'], '?')
        out = W / 'images' / (f'{n}.webp' if i == 0 else f'{n}-{i + 1}.webp')
        if not o.exists(): bad.append(f'원본 없음 {im["file"]}'); continue
        manifest.append({'source': str(o), 'output': str(out)})
        if cmd == 'apply' and (not out.exists() or webp_size(out)[0] != 1080): bad.append(f'변환본 없음·가로 1080 아님 {out.name}')
    if bad: print(f'! {n}: ' + '; '.join(bad)); continue
    ok.append(n)
    if cmd != 'apply': continue
    def block(i, im, alt):
        p = db[im['file']]
        return {'type': 'image', 'url': f'images/{n}.webp' if i == 0 else f'images/{n}-{i + 1}.webp', 'alt': alt,
                'credit': f'{p["author"]} / {p["license"]} / Wikimedia Commons', 'source': p['page']}
    for lang, doc, key, label in (('ko', ko, 'alt', '사진'), ('en', en, 'alt_en', 'Photos')):
        imgs = [block(i, im, im[key]) for i, im in enumerate(ims)]
        new = {}
        for k, v in doc.items():
            if k == 'summary':
                new['image'] = imgs[0]; new['gallery'] = {'type': 'carousel', 'label': label, 'items': imgs[1:]}
            new[k] = v
        jsave(R / 'data' / lang / f'{n}.json', new)
    for f in (W / 'images').glob(f'{n}*.webp'): shutil.copy(f, R / 'data/images' / f.name)
    sp = R / 'sources' / f'{n}.json'
    src = jload(sp) if sp.exists() else {'id': ko['id'], 'slug': ko['slug'], 'facts': []}
    src['images'] = [{'file': f'{n}.webp' if i == 0 else f'{n}-{i + 1}.webp', 'source': db[im['file']]['page'], 'check': spec['checks'][i]} for i, im in enumerate(ims)]
    src['photos_checked_at'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    jsave(sp, src)
    pl = R / 'i18n/photoless.json'; pd = jload(pl); pd['entries'].pop(f'{n}.json', None); jsave(pl, pd)
if cmd == 'plan':
    (X / 'photo-convert-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    print(f'변환 대상 {len(manifest)}장 → {X}/photo-convert-manifest.json')
print(('통과 ' if cmd == 'plan' else '적용 ') + str(len(ok)) + '개: ' + ' '.join(ok))
