# 필리핀 여행 정보 API — AI 에이전트 안내

> 이 저장소의 작업 안내는 모두 스킬 **[skills/travel-api-skill](skills/travel-api-skill/SKILL.md)** 로 옮겼다.
> 작업 전에 [SKILL.md](skills/travel-api-skill/SKILL.md) 를 읽고, 작업 종류에 맞는 레퍼런스를 읽는다.
> 모든 응답·주석·커밋 메시지는 **한글**로 쓴다 (코드·경로·명령어 제외).
> `CLAUDE.md` 는 이 파일의 심볼릭 링크다. 고칠 때는 이 파일만 고친다.

## 작업별 문서

| 작업 | 문서 |
|------|------|
| 저장소 유지보수 — 구조·명령·빌드 규격 검사·규칙·여행지 추가·수정·type 추가·검증·새 나라 | [references/maintain.md](skills/travel-api-skill/references/maintain.md) |
| API 계약 — 파일·필드·불변식·클라이언트 업데이트 절차와 코드 | [references/api.md](skills/travel-api-skill/references/api.md) |
| 화면 그리기 — content_display_type·권장 위젯·웹/Flutter 참고 렌더러 | [references/rendering.md](skills/travel-api-skill/references/rendering.md) |
| 현재 상태·남은 일·결정 기록 | [references/history.md](skills/travel-api-skill/references/history.md) |
| 여행지 JSON 작성 규격 | [data/README.md](data/README.md) |
| 사람용 API 설명·스킬 설치 | [README.md](README.md) |

Claude Code 에서는 `/travel-api-skill <요청>` 으로 부른다. 입구는 [.claude/skills/travel-api-skill/SKILL.md](.claude/skills/travel-api-skill/SKILL.md) 이다.

## 절대 규칙 (자세한 것은 maintain.md §5)

1. **`main` push 는 곧 운영 배포다.** push 는 사용자가 요청할 때만 하고, 작업은 커밋까지만 한다.
2. **push 전에 `node scripts/build.mjs` 가 성공해야 한다.**
3. **`_site/` 는 커밋하지 않고, 외부 npm 패키지를 넣지 않는다.**
4. **여행지 내용은 이 저장소의 `data/` 에서만 고친다.** 필고의 `apps/travel/data/travel/` 은 옛 사본이다.
5. **서브모듈 커밋 순서:** 이 저장소에서 먼저 커밋·push 한 뒤, 필고 저장소에서 `submodules/ph-travel-api` 포인터를 커밋한다.
