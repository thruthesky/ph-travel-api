# API 저장소 유지보수 — ph-travel-api

여행지 자료를 고치고, 번역을 맞추고, 규격을 검사하고, 배포하는 방법이다. 이 저장소 안에서 일할 때 읽는다.

- 여행지 JSON 작성 규격과 번역 절차의 전문은 저장소의 `data/README.md` 에 있다(§7 다국어).
- 번역 지침·어휘집은 `i18n/GUIDE.md`·`i18n/glossary/<언어>.json` 에 있다.

## 목차

1. 한눈에 보기
2. 폴더 구조
3. 명령
4. 빌드 스크립트가 막는 것 — 규격 검사
5. 규칙
6. 자주 하는 작업 (여행지 추가·수정·삭제, type 추가, 속성 추가)
7. 검증 방법
8. 스킬 고치기와 배포
9. 새 나라 API 추가

## 1. 한눈에 보기

| 항목 | 값 |
|------|----|
| 정체 | 필리핀 여행지 100선을 **8개 언어 블록 JSON** 으로 내주는 **정적 API**. 서버 코드·DB 없음 |
| 공개 주소 | `https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| 호스팅 | GitHub Pages (Source: **GitHub Actions**) |
| 배포 | `main` 에 push → `.github/workflows/deploy.yml` → `node scripts/build.mjs` → Pages. 1~2분 |
| 원본 | `data/ko/*.json`(원본 언어 한국어) · `data/<en·zh·ja·th·vi·ru·ar>/*.json`(번역본) · `data/meta.json`(언어·분류 목록·속성·단락·표시 방법) · `data/images/*.webp` 사진 293장 |
| 빌드 결과 | `_site/v2/` — `manifest.json` · `meta.json` · `places.<lang>.json` 8개 · `images/`, 그리고 `_site/skills/travel-api-skill.tar.gz` |
| 저장소 | `github.com/thruthesky/ph-travel-api` (공개) |
| 상위 프로젝트 | 필고 저장소(`thruthesky/philgo`)의 서브모듈 `submodules/ph-travel-api` |

- 2026-09-27 에 필고의 `apps/travel/data/travel/` 에서 옮겨 왔다. **여행지 자료의 원본은 이 저장소다.**
- 같은 날 원본을 마크다운에서 블록 JSON 으로 바꾸고 API 를 v1 → v2 로 올렸다. v1 은 배포하지 않는다.
- 2026-09-28 에 8개 언어로 번역하고 `content_display_type.json` 을 `meta.json` 의 `display` 로 합쳤다. v2 는 한 번도 배포되지 않아 경로를 그대로 쓴다([history.md](history.md)).

## 2. 폴더 구조

```
ph-travel-api/
├─ AGENTS.md                       ← 이 스킬을 가리키는 짧은 안내 (CLAUDE.md 는 그 심볼릭 링크)
├─ README.md                       ← API 형식·클라이언트 절차·스킬 설치 (사람용)
├─ .github/workflows/deploy.yml    ← main push → 빌드 → Pages 배포
├─ .claude/skills/travel-api-skill/SKILL.md  ← 이 저장소에서 스킬을 부르는 입구 (본문은 skills/ 를 가리킨다)
├─ scripts/build.mjs               ← 규격 검사 + 언어별 JSON + 사진 해시 + 스킬 묶음
├─ scripts/i18n.mjs                ← 번역본 만들기·원본과 맞추기 (사용법: data/README.md §7)
├─ i18n/GUIDE.md · i18n/glossary/<언어>.json   ← 번역 지침·어휘집 (지명·분류 이름을 한 가지로)
├─ skills/travel-api-skill/        ← 이 스킬의 원본 (SKILL.md · references/ · scripts/ · assets/)
├─ data/
│  ├─ README.md                    ← 여행지 JSON 작성 규격, §7 다국어
│  ├─ meta.json                    ← 지원 언어·분류·권역·지역·난이도(다국어 이름)·속성(fields)·단락(sections)·표시 방법(display)
│  ├─ ko/001-intramuros.json …     ← 원본 (한국어)
│  ├─ en/ zh/ ja/ th/ vi/ ru/ ar/  ← 번역본 — 파일 이름·모양이 원본과 같다
│  └─ images/<번호>-<slug>[-2|-3].webp
└─ _site/                          ← 빌드 결과 (git 에 넣지 않음)
```

## 3. 명령

| 할 일 | 명령 (저장소 루트에서) |
|------|------|
| 빌드 + 규격 검사 | `node scripts/build.mjs` — 성공하면 version·언어·미사용 type, 실패하면 오류 목록과 exit 1 |
| 번역 맞추기 | `node scripts/i18n.mjs …` — 명령과 옵션은 `data/README.md` §7 |
| 빌드 결과 조회 | `node skills/travel-api-skill/scripts/travel.mjs --base _site/v2 --lang ko list` (show·search·sql 도 된다) |
| 빌드 결과를 DB 로 | `node skills/travel-api-skill/scripts/travel-db.mjs build --base _site/v2 --out /tmp/travel.db` |
| 로컬에서 응답 확인 | `cd _site && python3 -m http.server 8765` → `http://127.0.0.1:8765/v2/manifest.json` |
| 배포 진행 상황 | `gh run list --limit 3` · `gh run watch` |
| 배포 결과 확인 | `curl -s https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| Pages 설정 확인 | `gh api repos/thruthesky/ph-travel-api/pages --jq .build_type` → `workflow` 여야 한다 |

- Node 는 24 를 쓴다(Actions 와 같다). `npm install` 할 것이 없다. 스킬 묶음에는 시스템 `tar` 를 쓴다.

## 4. 빌드 스크립트가 막는 것 — 규격 검사

`scripts/build.mjs` 는 아래 중 하나라도 어기면 **JSON 을 쓰지 않고 exit 1** 로 끝난다. Actions 도 멈추므로 공개 주소에는 이전 배포가 그대로 남는다.

- **meta.json:** 먼저 검사한다. 모든 노드 검사의 기준이기 때문이다.
  - 지원 언어, 분류·권역·지역·난이도 목록과 모든 언어의 이름, 속성(`fields`)·단락(`sections`)이 있어야 한다.
  - 표시 방법(`display.types`)의 규칙:
    - type 마다 `group`·`context`·`name`·`role`·`html`·`css`·`flutter` 가 있어야 한다.
    - props 의 `kind` 는 `prop_kinds` 중 하나여야 한다.
    - inline type 은 `text` 가 필수다.
    - `example` 도 규격을 지켜야 한다.
    - `layouts` 의 이름이 실제로 있어야 한다.
- **모든 노드 (자동):** 여행지 안의 노드를 끝까지 따라가며 `display.types` 규격으로 검사한다.
  - type·자리(block·inline)·필수 키·값 종류(`kind`)·`enum`·`min`·허용 type 을 지켜야 하고, 모르는 키가 없어야 한다.
  - `variant` 는 `variants` 에 있는 값, `icon` 은 `^[a-z0-9_]+$`, `style` 은 `style_properties` 만 된다.
- **원본(ko) 여행지:**
  - 파일 이름 `<id 3자리>-<slug>.json` 과 `id`·`slug` 가 일치해야 하고, slug·id 가 겹치면 안 된다.
  - 속성은 `meta.fields` 에 정한 것만 쓰고, 각 type 이 맞아야 한다.
  - 분류·권역·지역·난이도 값은 `meta.json` 목록에 있어야 한다. badge 의 `value` 가 key 다.
  - 숫자 범위:
    - `tags` 3~6개
    - `rating` 4.0~5.0
    - 좌표는 필리핀 영역(위도 4~22, 경도 116~127)
    - `best_season.months` 는 겹치지 않는 1~12
    - `budget` 은 PHP 이고 `min ≤ max`
  - 본문:
    - `sections` 의 key·순서가 규격과 같아야 한다.
    - 단락마다 블록이 1개 이상 있어야 한다.
    - 보이는 글이 2,500자를 넘어야 한다.
    - 마크다운 흔적(`**`, `](`)이 없어야 한다.
- **번역본:**
  - 모든 언어에 같은 여행지가 있어야 하고, 원본과 모양이 같아야 한다. 같은 블록 순서·개수, 같은 언어 무관 값이다: id·slug·title_en·rating·좌표·months·budget 숫자·difficulty·airport.code·사진·링크·icon·variant·section key.
  - 다를 수 있는 것은 `translate: true` prop 과 `label` 뿐이다.
  - 비한국어 파일에 한글이 없어야 한다.
- **사진:**
  - 모든 image 노드의 `url` 은 `images/[a-z0-9-]+\.webp` 이고, 파일이 실제로 있어야 한다.
  - WebP 크기를 읽을 수 있어야 한다.
  - `credit` 이 있어야 하고, `source` 는 `https://` 로 시작해야 한다.
- **링크:** `card.place`·`place_link.slug` 는 실제로 있는 여행지를 가리켜야 한다. 자기 자신은 안 된다.
- **스킬:**
  - `skills/travel-api-skill/SKILL.md` 에 `name`·`metadata.version` 이 있어야 한다.
  - `scripts/` 의 필수 파일이 있어야 한다.
  - `.claude/skills/travel-api-skill/SKILL.md` 의 description 이 원본과 같아야 한다.

세부 검사 목록의 전문은 `scripts/build.mjs` 와 `data/README.md` 에 있다. 검사를 바꾸면 이 절도 함께 고친다.

## 5. 규칙

1. **`main` push 는 곧 운영 배포다.** 필고 프로젝트 규칙에 따라 push 는 사용자가 요청할 때만 한다. 작업을 마치면 커밋까지만 한다.
2. **push 전에 반드시 `node scripts/build.mjs` 가 성공해야 한다.**
3. **`_site/` 는 커밋하지 않는다.** 배포 때 Actions 가 새로 만든다.
4. **외부 npm 패키지를 넣지 않는다.** 빌드는 Node 기본 모듈과 시스템 tar 만 쓴다. 그래서 `package.json` 도 없다.
5. **원본은 한국어(`data/ko/`)다.** 내용은 원본에서 먼저 고친다. 번역본은 `scripts/i18n.mjs` 와 `i18n/GUIDE.md` 로 맞춘다. 번역본만 따로 고치면 다음 맞추기에서 덮이거나, 모양이 달라져 빌드가 실패한다.
6. **JSON 구조 변경 규칙:**
   - **type·키 추가는 호환된다.** 클라이언트는 모르는 type·키를 무시하거나 대체해서 그려야 한다.
   - **키 삭제·이름 변경·형식 변경, type 의 뜻 변경은 호환되지 않는다.** 이때는 다음 순서를 따른다.
     1. `SCHEMA` 를 올린다. 출력 경로가 `_site/v<SCHEMA>/` 로 따라 바뀐다.
     2. 옛 앱이 남아 있는 동안 옛 경로도 함께 빌드한다.
     3. 스킬의 `scripts/apis.json`(schema·base), SQLite 스키마(`assets/travel-schema.sql` 과 세 조회 구현), references 를 함께 고친다.
7. **version 은 결정적이어야 한다.** 시각·난수·파일 순서처럼 빌드할 때마다 달라지는 값을 meta·places 안에 넣지 않는다. 여행지 순서는 `id` 로 정렬한다.
8. **규격을 바꾸면 함께 고친다.**
   - 값 목록·속성·단락 → `data/meta.json`(다국어 이름 포함), `data/README.md`
   - 분류 → 필고 앱의 `apps/lib/src/travel/travel_category.dart` 도
   - type → `data/meta.json` 의 `display.types`(번역할 prop 은 `translate: true`), `README.md` 의 type 표, 스킬의 [rendering.md](rendering.md) 와 두 렌더러(`assets/renderer.mjs`·`assets/travel_blocks.dart`)
   - 여행지 속성·단락 → 스킬의 SQLite 스키마와 `travel-db.mjs` 의 `buildDb`, `TravelDb.php`·`travel_db.dart`([database.md](database.md))
9. **서브모듈 커밋 순서:** 이 저장소에서 먼저 커밋·push 한 뒤, 필고 저장소에서 `submodules/ph-travel-api` 포인터를 커밋한다.
10. **필고의 `apps/travel/data/travel/` 은 옛 마크다운 사본이다.** 여행지 내용은 **이 저장소에서만** 고친다.

## 6. 자주 하는 작업

### 6.1 여행지 추가

1. 비어 있는 번호로 `data/ko/<id 3자리>-<slug>.json` 을 만든다.
   - 비슷한 여행지 파일을 복사해 고치면 빠르다. 형식은 `data/README.md` 를 따른다.
   - 분류·권역·지역은 `value` 에 `meta.json` 의 key 를, `text` 에 한국어 이름을 쓴다.
2. 사진을 준비한다.
   - Wikimedia Commons 의 CC·퍼블릭 도메인 사진을 1080px WebP 로 줄여 `data/images/<같은 이름>.webp` 에 둔다.
   - 추가 사진은 `-2`, `-3` 을 붙인다.
   - image 노드마다 `credit`(작가 / 라이선스 / 출처)과 `source`(원본 페이지)를 적는다. `width`·`height`·`?v=` 는 빌드가 붙인다.
3. 글은 `children` 조각으로 쓴다. 금액·시각·날짜·소요 시간·거리·기온은 type 조각으로 따로 자른다.
4. 새 지역이면 `data/meta.json` 의 `regions` 에 key 와 8개 언어 이름을 더하고, 어휘집에도 넣는다.
5. 7개 언어 번역본을 만든다 — `scripts/i18n.mjs` 와 `i18n/GUIDE.md` 를 따른다(`data/README.md` §7).
6. 다른 여행지의 `nearby` 단락에 `place: "<slug>"` 카드로 새 여행지를 연결하면 좋다. 원본을 고쳤으니 번역본도 맞춘다.
7. `node scripts/build.mjs` → 커밋.

### 6.2 수정·삭제·사진 교체

- **내용 수정:** 원본(ko)을 고치고 번역본을 맞춘 뒤 빌드·커밋한다. version 이 바뀌어 클라이언트가 다음 확인 때 새로 받는다.
- **삭제:**
  1. 모든 언어의 JSON 과 그 여행지의 사진을 지운다.
  2. 다른 여행지에서 그 slug 를 가리키는 `place`·`place_link` 를 모든 언어에서 지우거나 바꾼다. 남아 있으면 빌드가 실패한다.
- **사진 교체:** 같은 파일 이름으로 덮어쓰면 된다. `?v=` 해시와 크기가 바뀌므로 옛 캐시가 남지 않는다.

### 6.3 표시 방법(type) 추가·수정

1. `data/meta.json` 의 `display.types` 에 type 을 추가한다.
   - `group`·`context`·`name`·`role`·`props`(kind·required·translate·description)·`html`·`css`·`flutter`·`example` 을 모두 채운다.
   - 언어마다 값이 다른 prop 에는 `translate: true` 를 붙인다.
2. 빌드가 규격과 `example` 을 검사한다.
3. `README.md` 의 type 표, 스킬의 [rendering.md](rendering.md), 두 참고 렌더러에 넣는다.
4. 추가는 호환되므로 `SCHEMA` 는 그대로 둔다(§5-6).

### 6.4 여행지에 새 속성 추가

1. `data/meta.json` 의 `fields` 에 속성(type·언어별 label·icon·role)을 넣는다. 필요한 값 검사는 `scripts/build.mjs` 에 더한다.
2. 모든 언어의 여행지 JSON 에 그 속성을 넣는다(스크립트로 일괄).
3. `README.md`·`data/README.md`·스킬의 [api.md](api.md) §4.1 표에 적는다.
4. 목록·거르기에 쓰는 값이면 스킬의 SQLite 스키마(`place_texts`·`places` 열)와 `buildDb` 도 고친다. 이때 스키마 버전(`user_version`)을 올린다.

### 6.5 JSON 을 일괄로 고칠 때

- Node 스크립트로 읽고 → 고치고 → 쓴다. 들여쓰기 2칸, 짧은 객체·배열은 한 줄(약 100자 이내), 파일 끝 줄바꿈 1개.
- 언어 무관 값을 고치면 모든 언어 파일을 함께 고친다. 빌드가 원본과 비교한다.
- 고친 뒤 `node scripts/build.mjs` 로 검사한다.

## 7. 검증 방법

"빌드 성공"만으로 완료라고 하지 않는다. 바꾼 범위에 맞춰 아래를 확인한다.

1. **빌드:** `node scripts/build.mjs` 가 exit 0 으로 끝나는지, version 이 기대와 맞는지 본다.
   - 내용·meta 를 바꿨으면 version 이 바뀌어야 한다.
   - 문서·스킬만 바꿨으면 version 이 그대로여야 한다.
2. **로컬 응답:** `_site` 를 로컬 서버로 띄워 확인한다.
   - manifest → meta·places.<lang>.json 8개를 받아 `version`·`count` 가 모두 일치하는지 본다.
   - 모든 image url 이 200 · `image/webp` 인지 본다.
3. **스킬로 확인:**
   - `travel.mjs --base _site/v2 --lang <언어> info|list|search` 를 몇 개 언어로 돌린다.
   - `travel-db.mjs build --base _site/v2` 로 DB 가 만들어지는지 본다. 스키마가 새 데이터와 맞는다는 뜻이다.
4. **오류 차단:** 검사 규칙이나 meta 를 바꿨다면 확인한다.
   - 스크래치 폴더에 `scripts/`·`data/`·`skills/` 를 복사한다.
   - 일부러 규격을 어긴 파일을 만든다 — 모르는 type, 필수 키 누락, 번역본 모양 불일치, 비한국어 파일의 한글, 없는 slug 링크 …
   - 빌드가 exit 1 로 끝나고 `_site/v2/*.json` 을 만들지 않는지 본다.
5. **사진 크기:** WebP 해석을 바꿨다면 모든 image 노드의 `width`·`height` 를 `sips -g pixelWidth -g pixelHeight` 결과와 비교한다.
6. **렌더러:** type 이나 렌더러를 바꿨다면 확인한다.
   - 웹 렌더러로 모든 언어의 100곳을 그려 예외가 없는지 본다.
   - Flutter 렌더러는 빈 Flutter 프로젝트에 넣어 `flutter analyze` 와 위젯 테스트를 돌린다(100곳, 아랍어 RTL 포함).
7. **배포 후:**
   - `gh run list` 가 `completed success` 인지 본다.
   - 공개 manifest version 이 로컬 빌드와 같은지 본다.
   - JSON·사진의 content-type 을 본다.
   - `https://thruthesky.github.io/ph-travel-api/skills/travel-api-skill.tar.gz` 가 200 인지 본다.

## 8. 스킬 고치기와 배포

- 스킬 원본은 `skills/travel-api-skill/` 하나다.
- `.claude/skills/travel-api-skill/SKILL.md` 는 이 저장소에서 스킬을 부르는 입구일 뿐이다. 그 SKILL.md 의 본문은 원본을 읽으라고 안내한다.
  - 입구의 `name`·`description` 은 원본과 같게 둔다. 빌드가 description 을 비교한다.
- 스킬을 고치면 `SKILL.md` 앞머리의 `metadata.version` 을 올린다.
  - 형식은 `"YYYY.MM.DD"`, 같은 날 두 번째면 `"YYYY.MM.DD.2"` 다.
  - `update` 가 옛 버전 → 새 버전을 보여 줄 때 쓴다.
- 빌드가 `_site/skills/travel-api-skill.tar.gz` 를 만든다. push 하면 Pages 로 배포된다. 설치·`update` 는 이 묶음을 받는다.
- 스킬 스크립트는 로컬 빌드로 시험한다: `node skills/travel-api-skill/scripts/travel.mjs --base _site/v2 …`.
  - `update.sh` 는 `TRAVEL_API_SKILL_TARBALL=<로컬 tar.gz>` 로 시험한다.
- SQLite 스키마를 바꾸면 세 조회 구현(Node `travel-db.mjs`·PHP `TravelDb.php`·Dart `travel_db.dart`)의 버전 확인 값과 쿼리를 함께 고친다. 셋이 같은 질문에 같은 결과를 내는지 비교한다([database.md](database.md) §8).

## 9. 새 나라 API 추가

같은 구조의 저장소를 하나 더 만든다(예: `thruthesky/jp-travel-api`).

1. 이 저장소의 `scripts/`·`data/meta.json`·`i18n/`·`.github/workflows/deploy.yml`·`.gitignore` 를 복사한다.
2. 나라별 값을 고친다.
   - `data/meta.json` 의 분류·권역·지역 목록과 다국어 이름
   - `build.mjs` 의 좌표 범위 검사와 통화(예: JPY)
   - 스킬 검사·묶음(`checkSkill`·`packSkill`)은 뺀다. 스킬 원본은 한 곳에만 둔다.
   - 파일 구조·노드 모양·표시 방법·단락은 그대로 둔다. 같은 DB 스키마와 렌더러로 쓰기 위해서다.
3. `data/<lang>/` 에 여행지 JSON 과 사진을 넣고 빌드한다. 그다음 Pages 를 켠다(`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`).
4. 이 스킬의 `scripts/apis.json` 에 나라를 추가하고 `metadata.version` 을 올린다.

   ```json
   "jp": { "name": "일본", "name_en": "Japan", "base": "https://thruthesky.github.io/jp-travel-api/v2/", "repo": "thruthesky/jp-travel-api", "schema": 2, "currency": "JPY" }
   ```

5. `node scripts/travel.mjs --country jp info` 로 확인한다. DB 는 나라별로 따로 만든다(`travel-db.mjs build --country jp`).
