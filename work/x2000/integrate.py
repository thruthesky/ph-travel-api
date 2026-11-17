#!/usr/bin/env python3
"""작업 폴더의 완성본을 data/ 로 옮긴다 (통합 담당만 실행).
  python3 work/x2000/integrate.py plan  <id-slug> …   → 검사하고 변환 목록 _i18n/work/x2000/convert-manifest.json 을 쓴다
  (Codex CLI 로 변환한 뒤)
  python3 work/x2000/integrate.py apply <id-slug> …   → data/ko·en·images, sources, i18n/fallbacks.json 에 넣는다"""
import sys, json, pathlib, shutil, struct
R = pathlib.Path(__file__).resolve().parents[2]; X = R / '_i18n/work/x2000'
cmd, names = sys.argv[1], sys.argv[2:]
def webp_size(p):
    b = p.read_bytes()[:40]
    if b[12:16] == b'VP8 ': return struct.unpack('<HH', b[26:30])[0] & 0x3fff, struct.unpack('<HH', b[26:30])[1] & 0x3fff
    if b[12:16] == b'VP8L': v = struct.unpack('<I', b[21:25])[0]; return (v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1
    if b[12:16] == b'VP8X': return int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1
    return 0, 0
manifest = []; ok = []
for n in names:
    W = X / n; bad = []
    try:
        done = json.loads((W / 'done.json').read_text()); spec = json.loads((W / 'spec.json').read_text())
        if done.get('status') != 'ready': print(f'- {n}: {done.get("status")} — {done.get("reason") or done.get("of")}'); continue
        ko = json.loads((W / 'ready/ko' / f'{n}.json').read_text()); en = json.loads((W / 'ready/en' / f'{n}.json').read_text())
        src = json.loads((W / 'sources.json').read_text()); idx = json.loads((W / 'orig/index.json').read_text())
    except Exception as e: print(f'! {n}: 파일 부족 — {e}'); continue
    if (R / 'data/ko' / f'{n}.json').exists() and cmd == 'plan': bad.append('이미 data 에 있음')
    if len(spec['images']) < 10: bad.append('사진 10장 미만')
    if len(src.get('facts', [])) < 4: bad.append('근거 facts 4개 미만')
    if len(src.get('images', [])) < len(spec['images']): bad.append('근거 images 부족')
    for i, im in enumerate(spec['images']):
        o = W / 'orig' / idx.get(im['file'], '?')
        out = W / 'images' / (f'{n}.webp' if i == 0 else f'{n}-{i+1}.webp')
        if not o.exists(): bad.append(f'원본 없음 {im["file"]}'); continue
        manifest.append({'source': str(o), 'output': str(out)})
        if cmd == 'apply':
            if not out.exists() or webp_size(out)[0] != 1080: bad.append(f'변환본 없음·가로 1080 아님 {out.name}')
    if bad: print(f'! {n}: ' + '; '.join(bad)); continue
    ok.append(n)
    if cmd == 'apply':
        for lang in ('ko', 'en'): shutil.copy(W / 'ready' / lang / f'{n}.json', R / 'data' / lang / f'{n}.json')
        for f in (W / 'images').glob(f'{n}*.webp'): shutil.copy(f, R / 'data/images' / f.name)
        (R / 'sources' / f'{n}.json').write_text(json.dumps(src, ensure_ascii=False, indent=2) + '\n')
        fb = json.loads((R / 'i18n/fallbacks.json').read_text()); fb['entries'][f'{n}.json'] = ['zh', 'ja', 'th', 'vi', 'ru', 'ar']
        (R / 'i18n/fallbacks.json').write_text(json.dumps(fb, ensure_ascii=False, indent=2) + '\n')
if cmd == 'plan':
    manifest = [m for m in manifest if any(m['output'].endswith(f'/{n}.webp') or f'/{n}-' in m['output'] for n in ok)]
    (X / 'convert-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    print(f'변환 대상 {len(manifest)}장 → {X}/convert-manifest.json')
print(('통과 ' if cmd == 'plan' else '적용 ') + str(len(ok)) + '개: ' + ' '.join(ok))
