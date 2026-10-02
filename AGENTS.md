# 필리핀 여행 정보 API — AI 에이전트 안내

> 이 저장소의 작업 안내는 모두 AI 스킬 **api-skill** 에 있다. 스킬 원본은 [thruthesky/skills](https://github.com/thruthesky/skills/blob/main/skills/api-skill/SKILL.md) 저장소의 `skills/api-skill/` 이고, 이 저장소는 `.claude/settings.json` 으로 그 플러그인을 켠다(2026-09-30 에 `skills/travel-api-skill/` 을 옮기고 이름을 바꿨다).
> 작업 전에 스킬을 부르거나(Claude Code `/api-skill:api-skill`, Codex `$api-skill`) [SKILL.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/SKILL.md) 를 읽고, 작업 종류에 맞는 레퍼런스를 읽는다.
> 설치된 스킬 폴더: Claude Code 플러그인 `~/.claude/plugins/cache/thruthesky-skills/api-skill/<version>/` · 폴더 설치 `~/.agents/skills/api-skill/` · 원본 체크아웃 `~/apps/skills/skills/api-skill/`
> 모든 응답·주석·커밋 메시지는 **한글**로 쓴다 (코드·경로·명령어 제외).
> `CLAUDE.md` 는 이 파일의 심볼릭 링크다. 고칠 때는 이 파일만 고친다.

## 작업별 문서

| 작업 | 문서 |
|------|------|
| 저장소 유지보수 — 구조·명령·빌드 규격 검사·규칙·여행지 추가·수정·type 추가·검증·새 나라 | [references/maintain.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/maintain.md) |
| API 계약 — 파일·필드·불변식·클라이언트 업데이트 절차와 코드 | [references/api.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/api.md) |
| 화면 그리기 — 표시 방법(type)·권장 위젯·웹/Flutter 참고 렌더러 | [references/rendering.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/rendering.md) |
| 웹·앱에 넣어 쓰기 — PHP·Flutter·정적 웹 | [references/embedding.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/embedding.md) |
| SQLite 스키마·쿼리·언어별 검색 | [references/database.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/database.md) |
| 다른 정보(밤문화·맛집·병원·비자 …)를 이 저장소와 같은 형태로 만들기 — 설계·파일별 고칠 곳·순서·가공·검증 | [references/blueprint.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/blueprint.md) |
| 현재 상태·남은 일·결정 기록 | [references/history.md](https://github.com/thruthesky/skills/blob/main/skills/api-skill/references/history.md) |
| 여행지 JSON 작성 규격 | [data/README.md](data/README.md) |
| 다국어 — 번역본 만들기·맞추기 (`scripts/i18n.mjs`), 번역 지침·어휘집 | [data/README.md](data/README.md) §7 · [i18n/GUIDE.md](i18n/GUIDE.md) · `i18n/glossary/<언어>.json` |
| 지원 언어·분류 목록·속성·단락·표시 방법(type) 규격 | `data/meta.json` |
| 사람용 API 설명·스킬 설치 | [README.md](README.md) |

Claude Code 에서는 `/api-skill:api-skill <요청>` 으로 부른다. 스킬 설치·업데이트는 [thruthesky/skills README](https://github.com/thruthesky/skills#readme) 에 있다. 스킬을 고치는 곳은 이 저장소가 아니라 이 컴퓨터의 `~/apps/skills/skills/api-skill/`(thruthesky/skills 체크아웃) 하나뿐이다(maintain.md §8). 스킬 배포는 `~/apps/skills` 의 push 다.

## 절대 규칙 (자세한 것은 maintain.md §5)

1. **배포는 오직 Cloudflare R2 다** — api-skill 의 `r2.mjs deploy --country ph` → `https://files.withcenter.com/ph-travel-api/v2/`. 배포는 사용자가 요청할 때만 하고, 작업은 커밋까지만 한다. **이 저장소는 GitHub 에 push 하지 않는다**(2026-10-02 사용자 결정). 옛 주소(GitHub Pages)는 2026-10-01 판에서 멈췄다.
2. **배포 전에 `node scripts/build.mjs` 와 `content.mjs check --dir _site/v2` 가 성공해야 한다.** 콘텐츠를 고쳤으면 `content.mjs stamp data/meta.json` 으로 `data_version` 을 먼저 찍는다.
3. **`_site/` 는 커밋하지 않고, 외부 npm 패키지를 넣지 않는다.**
4. **여행지 내용은 이 저장소의 `data/` 에서만 고친다.** 필고의 `apps/travel/data/travel/` 은 옛 사본이다.
   - 원본 언어는 한국어(`data/ko/`)다. 원본을 먼저 고치고, 번역본(`data/en`·`zh`·`ja`·`th`·`vi`·`ru`·`ar`)은 `scripts/i18n.mjs` 로 맞춘다.
   - 모든 언어의 여행지는 모양이 같아야 한다. 빌드가 원본과 비교해 다르면 실패한다.
5. **R2 배포 키:** `/Users/thruthesky/Documents/Keys/Cloudflare/r2/admin-permissions-all-r2.txt` (R2 관리 권한 — 계정의 모든 R2 버킷). `r2.mjs` 가 읽는다. 값은 출력·커밋하지 않는다.
6. **서브모듈 포인터:** GitHub 에 push 하지 않으므로 필고 저장소의 `submodules/ph-travel-api` 포인터는 커밋하지 않는다(GitHub 에 없는 커밋을 가리키게 된다).
