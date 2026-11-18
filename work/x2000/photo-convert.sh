#!/bin/bash
# 사용: bash work/x2000/photo-convert.sh <id-slug> …  → 검사(plan) 후 Codex 로 가로 1080 WebP 변환(내용 불변). 적용은 photo-apply.py apply.
cd "$(dirname "$0")/../.." || exit 1
python3 work/x2000/photo-apply.py plan "$@" || exit 1
python3 - <<'PY'
import json,pathlib
m=json.load(open('_i18n/work/x2000/photo-convert-manifest.json'))
for x in m: pathlib.Path(x['output']).parent.mkdir(parents=True,exist_ok=True)
lines="\n".join(f"{x['source']} -> {x['output']}" for x in m)
open('_i18n/work/x2000/photo-convert-prompt.txt','w').write(f"""정확한 수치 가공만 수행한다. 이미지 생성·편집 모델은 쓰지 않는다. 아래 각 줄은 "입력 JPEG -> 출력 WebP" 경로다. 원본 내용·구도·비율·색을 그대로 유지하고 가로 1080px, 비율 유지, WebP q80으로 변환한다. crop·색보정·업스케일 금지. 변환 후 디코딩한 실제 가로가 1080인지 검증한다. 출력 파일 외에는 어떤 파일도 수정하지 않고 원본을 덮어쓰지 않는다. cwebp 또는 Pillow 같은 도구로 이 정확 수치 가공만 해도 된다. 검증 결과(픽셀 크기, 바이트 수)를 마지막에 요약해 출력한다.

{lines}
""")
print(len(m),'장')
PY
[ "$(python3 -c "import json;print(len(json.load(open('_i18n/work/x2000/photo-convert-manifest.json'))))")" -gt 0 ] || exit 1
codex exec --skip-git-repo-check - < _i18n/work/x2000/photo-convert-prompt.txt 2>&1 | tail -6
