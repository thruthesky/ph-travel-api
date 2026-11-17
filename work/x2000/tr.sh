#!/bin/bash
# 작업 폴더 안의 작은 저장소 사본에서 공식 번역 도구를 돌린다. 공유 data/ 를 건드리지 않는다.
#   bash work/x2000/tr.sh <작업폴더> export   → <작업폴더>/mini/_i18n/src/<이름>.txt (번역할 줄)
#   (번역을 <작업폴더>/mini/_i18n/en/<이름>.txt 에 쓴 뒤)
#   bash work/x2000/tr.sh <작업폴더> check    → 검사
#   bash work/x2000/tr.sh <작업폴더> import   → <작업폴더>/ready/en/<이름>.json
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; D="$(cd "$1" && pwd)"; M="$D/mini"
F="$(ls "$D/ready/ko" | head -1)"; [ -n "$F" ] || { echo "ready/ko 가 없다 — gen.mjs 를 먼저 돌린다"; exit 1; }
mkdir -p "$M/scripts" "$M/data/ko" "$M/data/en" "$M/_i18n/en" "$M/i18n"
cp "$ROOT"/scripts/*.mjs "$M/scripts/"; cp "$ROOT/data/meta.json" "$M/data/"; cp "$D/ready/ko/$F" "$M/data/ko/"
[ -d "$M/_i18n/glossary" ] || cp -R "$ROOT/_i18n/glossary" "$M/_i18n/" 2>/dev/null || true
cd "$M"
case "$2" in
  export) node scripts/i18n.mjs export "$F"; echo "원문: $M/_i18n/src/${F%.json}.txt → 번역을 $M/_i18n/en/${F%.json}.txt 에 쓴다";;
  check) node scripts/i18n.mjs check en "$F";;
  import) node scripts/i18n.mjs check en "$F" && node scripts/i18n.mjs import en "$F" && mkdir -p "$D/ready/en" && cp "$M/data/en/$F" "$D/ready/en/" && echo "ready/en/$F";;
  *) echo "export|check|import"; exit 2;;
esac
