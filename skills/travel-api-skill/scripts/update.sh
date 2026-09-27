#!/usr/bin/env bash
# travel-api-skill 을 최신으로 바꾼다 — "/travel-api-skill update" 가 실행한다.
#
# GitHub Pages 에 올라간 스킬 묶음(tar.gz)을 받아 이 스킬 폴더를 통째로 바꾼다.
# 원본 저장소(ph-travel-api) 안의 스킬이면 파일을 건드리지 않고 git pull 을 안내한다.
# 받을 주소는 TRAVEL_API_SKILL_TARBALL 로 바꿀 수 있다 (주소 또는 로컬 파일 — 시험용).
set -euo pipefail

NAME="travel-api-skill"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
URL="${TRAVEL_API_SKILL_TARBALL:-https://thruthesky.github.io/ph-travel-api/skills/$NAME.tar.gz}"

version_of() { sed -n 's/^  version: *"\{0,1\}\([^"]*\)"\{0,1\} *$/\1/p' "$1/SKILL.md" | head -1; }
is_skill() { [ -f "$1/SKILL.md" ] && grep -q "^name: $NAME$" "$1/SKILL.md"; }

is_skill "$SKILL_DIR" || { echo "스킬 폴더를 확인할 수 없다 — $SKILL_DIR" >&2; exit 1; }

# 원본 저장소 안이면 git 으로 관리한다.
if top="$(git -C "$SKILL_DIR" rev-parse --show-toplevel 2>/dev/null)" \
  && [ "$(cd "$top" && pwd -P)/skills/$NAME" = "$SKILL_DIR" ] \
  && git -C "$top" remote get-url origin 2>/dev/null | grep -q 'ph-travel-api'; then
  echo "원본 저장소($top) 안의 스킬이라 파일을 바꾸지 않는다. 최신으로 하려면: git -C \"$top\" pull"
  exit 0
fi

# 새 묶음은 스킬 폴더와 같은 디스크에 풀어야 mv 한 번으로 바꿀 수 있다.
parent="$(dirname "$SKILL_DIR")"
tmp="$(mktemp -d "$parent/.$NAME.new.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

case "$URL" in
  http://* | https://*) curl -fsSL "$URL" -o "$tmp/skill.tar.gz" ;;
  *) cp "$URL" "$tmp/skill.tar.gz" ;;
esac
tar -xzf "$tmp/skill.tar.gz" -C "$tmp"
is_skill "$tmp/$NAME" || { echo "받은 묶음이 올바르지 않다 — $URL" >&2; exit 1; }

old="$(version_of "$SKILL_DIR")"
new="$(version_of "$tmp/$NAME")"
if diff -rq -x .DS_Store "$SKILL_DIR" "$tmp/$NAME" >/dev/null 2>&1; then
  echo "이미 최신이다 — $NAME ${old:-?} ($SKILL_DIR)"
  exit 0
fi

# 옛 폴더를 옆으로 옮기고 새 폴더를 그 자리에 둔다. 실패하면 옛 폴더를 되돌린다.
backup="$tmp/old"
mv "$SKILL_DIR" "$backup"
if ! mv "$tmp/$NAME" "$SKILL_DIR"; then
  mv "$backup" "$SKILL_DIR"
  echo "바꾸지 못해 원래대로 되돌렸다 — $SKILL_DIR" >&2
  exit 1
fi
echo "갱신했다 — $NAME ${old:-?} → ${new:-?} ($SKILL_DIR)"
echo "새 내용은 다음 대화부터 적용된다. 지금 대화에서 쓰려면 SKILL.md 를 다시 읽는다."
