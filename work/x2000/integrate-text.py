#!/usr/bin/env python3
"""텍스트만 완성된 작업 폴더(_i18n/work/x2000/<id>-<slug>/, done.json status=ready)를 data/ 로 옮긴다.
사진이 없는 항목은 i18n/photoless.json 에 올려 빌드가 허용하게 하고, 나머지 6개 언어는 i18n/fallbacks.json(영어 대체)에 올린다.
  python3 work/x2000/integrate-text.py            → 아직 data 에 없는 ready 항목 전부
  python3 work/x2000/integrate-text.py <id-slug>… → 지정한 항목만"""
import sys, json, pathlib, shutil
R = pathlib.Path(__file__).resolve().parents[2]; X = R / '_i18n/work/x2000'
names = sys.argv[1:] or sorted(p.name for p in X.iterdir() if (p / 'done.json').exists())
fb = json.loads((R / 'i18n/fallbacks.json').read_text()); pl = json.loads((R / 'i18n/photoless.json').read_text())
added = []
for n in names:
    W = X / n
    try: done = json.loads((W / 'done.json').read_text())
    except Exception: continue
    if done.get('status') != 'ready': continue
    kos = sorted((W / 'ready/ko').glob('*.json')) if (W / 'ready/ko').exists() else []
    if kos: n = kos[0].stem  # 폴더 이름과 slug 가 다를 때는 파일 이름(= id-slug)을 쓴다
    if (R / 'data/ko' / f'{n}.json').exists(): continue
    ko = W / 'ready/ko' / f'{n}.json'; en = W / 'ready/en' / f'{n}.json'
    if not ko.exists() or not en.exists(): print(f'! {n}: ready/ko·en 없음'); continue
    for lang, f in (('ko', ko), ('en', en)):
        d = json.loads(f.read_text())
        if d.get('image') or d.get('gallery'): print(f'! {n}: 사진 있음 — 텍스트 전용 아님'); break
    else:
        for lang, f in (('ko', ko), ('en', en)): shutil.copy(f, R / 'data' / lang / f'{n}.json')
        if (W / 'sources.json').exists(): shutil.copy(W / 'sources.json', R / 'sources' / f'{n}.json')
        fb['entries'][f'{n}.json'] = ['zh', 'ja', 'th', 'vi', 'ru', 'ar']
        pl['entries'][f'{n}.json'] = {'added': '2026-11-17', 'reason': '텍스트 먼저·사진 나중'}
        added.append(n)
(R / 'i18n/fallbacks.json').write_text(json.dumps(fb, ensure_ascii=False, indent=2) + '\n')
(R / 'i18n/photoless.json').write_text(json.dumps(pl, ensure_ascii=False, indent=2) + '\n')
print(f'통합 {len(added)}개: ' + ' '.join(added))
