# API 저장소 유지보수 — ph-travel-api

여행지 자료를 고치고, 규격을 검사하고, 배포하는 방법이다. 이 저장소 안에서 일할 때 읽는다.
여행지 JSON 작성 규격의 전문은 저장소의 `data/README.md` 에 있다.

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
| 정체 | 필리핀 여행지 100선을 **블록 JSON** 으로 내주는 **정적 API**. 서버 코드·DB 없음 |
| 공개 주소 | `https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| 호스팅 | GitHub Pages (Source: **GitHub Actions**) |
| 배포 | `main` 에 push → `.github/workflows/deploy.yml` → `node scripts/build.mjs` → Pages. 1~2분 |
| 원본 | `data/*.json` 여행지 100개 · `data/content_display_type.json` 표시 방법 목록 · `data/images/*.webp` 사진 293장 (23MB) |
| 빌드 결과 | `_site/v2/` — `manifest.json` · `places.json` (1.9MB, gzip 약 445KB) · `content_display_type.json` (70KB) · `images/`, 그리고 `_site/skills/travel-api-skill.tar.gz` |
| 저장소 | `github.com/thruthesky/ph-travel-api` (공개) |
| 상위 프로젝트 | 필고 저장소(`thruthesky/philgo`)의 서브모듈 `submodules/ph-travel-api` |

- 2026-09-27 에 필고의 `apps/travel/data/travel/` 에서 옮겨 왔다. **여행지 자료의 원본은 이 저장소다.**
- 같은 날 원본을 마크다운에서 블록 JSON 으로 바꾸고 API 를 v1 → v2 로 올렸다. v1 은 배포하지 않는다([history.md](history.md)).

## 2. 폴더 구조

```
ph-travel-api/
├─ AGENTS.md                       ← 이 스킬을 가리키는 짧은 안내 (CLAUDE.md 는 그 심볼릭 링크)
├─ README.md                       ← API 형식·클라이언트 절차·스킬 설치 (사람용)
├─ .github/workflows/deploy.yml    ← main push → 빌드 → Pages 배포
├─ .gitignore                      ← _site/ 제외
├─ .claude/skills/travel-api-skill/SKILL.md  ← 이 저장소에서 스킬을 부르는 입구 (본문은 skills/ 를 가리킨다)
├─ scripts/build.mjs               ← 규격 검사 + JSON 합치기 + 사진 해시 + 스킬 묶음
├─ skills/travel-api-skill/        ← 이 스킬의 원본 (SKILL.md · references/ · scripts/ · assets/)
├─ data/
│  ├─ README.md                    ← 여행지 JSON 작성 규격
│  ├─ content_display_type.json    ← 표시 방법 목록 — type 48개의 규격(props)·역할·HTML·CSS·Flutter
│  ├─ 001-intramuros.json … 100-dahican-beach.json
│  └─ images/<번호>-<slug>[-2|-3].webp
└─ _site/                          ← 빌드 결과 (git 에 넣지 않음)
```

## 3. 명령

| 할 일 | 명령 (저장소 루트에서) |
|------|------|
| 빌드 + 규격 검사 | `node scripts/build.mjs` — 성공하면 `여행지 N곳 → _site/v2/ (version …)` 와 미사용 type 목록, 실패하면 오류 목록과 exit 1 |
| 빌드 결과 조회 | `node skills/travel-api-skill/scripts/travel.mjs --base _site/v2 list` (show·search·types 도 된다) |
| 로컬에서 응답 확인 | `cd _site && python3 -m http.server 8765` → `http://127.0.0.1:8765/v2/manifest.json` |
| 배포 진행 상황 | `gh run list --limit 3` · `gh run watch` |
| 배포 결과 확인 | `curl -s https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| Pages 설정 확인 | `gh api repos/thruthesky/ph-travel-api/pages --jq .build_type` → `workflow` 여야 한다 |

- Node 는 24 를 쓴다(Actions 와 같다). `npm install` 할 것이 없다. 스킬 묶음에는 시스템 `tar` 를 쓴다.

## 4. 빌드 스크립트가 막는 것 — 규격 검사

`scripts/build.mjs` 는 아래 중 하나라도 어기면 **JSON 을 쓰지 않고 exit 1** 로 끝난다. Actions 도 멈추므로 공개 주소에는 이전 배포가 그대로 남는다.

- **표시 방법 목록(`content_display_type.json`):** 먼저 검사한다. 모든 노드 검사의 기준이기 때문이다.
  - type 마다 `group`·`context`(block·inline)·`name`·`role`·`html`·`css`·`flutter` 가 있어야 한다.
  - `props` 의 `kind` 는 `prop_kinds` 중 하나여야 한다.
  - inline 에 쓰는 type 은 `text` 가 필수여야 한다.
  - 각 `example` 도 규격을 지켜야 한다.
  - `layouts` 의 type·속성 이름이 실제로 있어야 한다.
- **모든 노드 (자동):** 여행지 안의 노드를 끝까지 따라가며 검사한다.
  - `type` 이 목록에 있고 그 자리(block·inline)에 쓸 수 있어야 한다.
  - `props` 의 필수 키가 있어야 한다. 값 종류(`kind`)·`enum`·`min`(배열 최소 개수)·`types`(허용 type)를 지켜야 한다.
  - 모르는 키가 없어야 한다.
  - `variant` 는 그 type 의 `variants` 에 있는 값이어야 한다. `icon` 은 `^[a-z0-9_]+$` 형식이다. `style` 에는 `style_properties` 의 CSS 속성만 쓴다.
- **파일:** `<id 3자리>-<slug>.json` 과 `id`·`slug` 가 일치해야 한다.
  - 번호로 시작하는 `.json` 만 여행지로 읽는다. 그래서 `id` 는 1~999 까지만 된다.
  - JSON 문법이 맞아야 한다.
  - 정해진 속성 외의 속성이 없어야 한다.
- **slug:** `^[a-z0-9-]+$` 형식이어야 한다. `id`·`slug` 는 서로 겹치면 안 된다.
- **속성의 type:** `FIELDS` 에 정한 type 이어야 한다 (title→title, budget→price, gallery→carousel …).
- **정해진 값:**
  - `island_group.text` 는 루손·비사야·민다나오 중 하나다.
  - `category.text` 는 해변·섬, 다이빙·해양, 산·트레킹, 폭포·호수·강, 역사·문화, 도시·미식, 자연 경관 중 하나다.
  - `difficulty.text` 는 쉬움·보통·어려움 중 하나다. `value` 는 1~3, `max` 는 3 으로 짝이 맞아야 한다.
- **숫자 범위:**
  - `tags.items` 3~6개, `rating.value` 4.0~5.0 (`max` 5).
  - `latitude.value` 4~22, `longitude.value` 116~127 (필리핀 영역).
  - `best_season.months` 는 겹치지 않는 1~12 다.
  - `budget` 은 `currency: "PHP"`, `min ≤ max` 다.
- **본문:**
  - `sections` 의 key·title·순서가 규격과 같아야 한다.
  - 단락마다 블록이 1개 이상 있어야 한다.
  - 보이는 글(text·title·time·price …)이 2,500자를 넘어야 한다.
  - 마크다운 흔적(`**`, `](`)이 없어야 한다.
- **사진:** 모든 image 노드의 `url` 은 `images/[a-z0-9-]+\.webp` 형식이다.
  - 파일이 실제로 있고, WebP 크기를 읽을 수 있어야 한다.
  - `credit` 이 있어야 하고, `source` 는 `https://` 로 시작해야 한다.
- **링크:** `card.place`·`place_link.slug` 는 실제로 있는 여행지를 가리켜야 한다. 자기 자신은 안 된다.
- **스킬:**
  - `skills/travel-api-skill/SKILL.md` 의 `name`·`metadata.version`, 그리고 `scripts/` 의 필수 파일이 있어야 한다.
  - `.claude/skills/travel-api-skill/SKILL.md` 의 description 이 원본과 같아야 한다.

## 5. 규칙

1. **`main` push 는 곧 운영 배포다.** 필고 프로젝트 규칙에 따라 push 는 사용자가 요청할 때만 한다. 작업을 마치면 커밋까지만 한다.
2. **push 전에 반드시 `node scripts/build.mjs` 가 성공해야 한다.**
3. **`_site/` 는 커밋하지 않는다.** 배포 때 Actions 가 새로 만든다.
4. **외부 npm 패키지를 넣지 않는다.** 빌드는 Node 기본 모듈과 시스템 tar 만 쓴다. 그래서 `package.json` 도 없다.
5. **JSON 구조 변경 규칙:**
   - **type·키 추가는 호환된다.** 클라이언트는 모르는 type·키를 무시하거나 대체해서 그려야 한다.
   - **키 삭제·이름 변경·형식 변경, type 의 뜻 변경은 호환되지 않는다.** 이때는 다음 순서를 따른다.
     1. `SCHEMA` 를 올린다. 출력 경로는 `_site/v<SCHEMA>/` 로 따라 바뀐다.
     2. 옛 앱이 남아 있는 동안 옛 경로도 함께 빌드한다.
     3. 스킬의 `scripts/apis.json` 의 `schema`·`base` 와 references 를 함께 고친다.
6. **version 은 결정적이어야 한다.**
   - 시각·난수·파일 순서처럼 빌드할 때마다 달라지는 값을 `places` 나 표시 방법 목록 안에 넣지 않는다.
   - 여행지 순서는 `id` 로 정렬한다.
7. **규격을 바꾸면 함께 고친다.**
   - 값 목록·속성·단락 → `scripts/build.mjs` 의 상수(`ISLAND_GROUPS`·`CATEGORIES`·`DIFFICULTIES`·`FIELDS`·`SECTIONS`)
   - 작성 규격 → `data/README.md`
   - 분류 → 여행지 JSON 의 `category.icon`, 필고 앱의 `apps/lib/src/travel/travel_category.dart`
   - type → `data/content_display_type.json`, `README.md` §4 의 type 표, 스킬의 [rendering.md](rendering.md), 두 참고 렌더러(`assets/`)
8. **서브모듈 커밋 순서:** 이 저장소에서 먼저 커밋·push 한 뒤, 필고 저장소에서 `submodules/ph-travel-api` 포인터를 커밋한다.
9. **필고의 `apps/travel/data/travel/` 은 옛 마크다운 사본이다.** 앱이 아직 번들 자료를 읽고 있어서 남겨 둔 것이다([history.md](history.md)). 여행지 내용은 **이 저장소에서만** 고친다.

## 6. 자주 하는 작업

### 6.1 여행지 추가

1. 비어 있는 번호로 `data/<id 3자리>-<slug>.json` 을 만든다. 비슷한 여행지 파일을 복사해 고치면 빠르다. 형식은 `data/README.md` 를 그대로 따른다.
2. 사진을 준비한다.
   - Wikimedia Commons 의 CC·퍼블릭 도메인 사진을 1080px WebP 로 줄여 `data/images/<같은 이름>.webp` 에 둔다.
   - 추가 사진은 `-2`, `-3` 을 붙여 `gallery.items` 에 image 노드로 넣는다.
3. image 노드마다 `credit`(작가 / 라이선스 / 출처)과 `source`(원본 페이지)를 적는다. `width`·`height`·`?v=` 는 빌드가 붙이므로 적지 않는다.
4. 글은 `children` 조각으로 쓴다. 금액·시각·날짜·소요 시간·거리·기온은 type 조각으로 따로 자른다. "약"·"편도" 는 조각 밖에 둔다.
5. 다른 여행지의 `nearby` 단락에 `place: "<slug>"` 카드로 새 여행지를 연결하면 좋다.
6. `node scripts/build.mjs` → 커밋.

여행지 한 곳의 뼈대 (단락은 10개 모두):

```json
{
  "id": 101,
  "slug": "new-place",
  "title": { "type": "title", "text": "새 여행지" },
  "title_en": { "type": "subtitle", "lang": "en", "text": "New Place" },
  "tagline": { "type": "typography", "variant": "tagline", "text": "20~32자 감성 카피" },
  "island_group": { "type": "badge", "label": "권역", "text": "비사야" },
  "region": { "type": "badge", "label": "지역", "text": "세부" },
  "location": { "type": "address", "label": "위치", "icon": "location_on", "text": "세부주 …" },
  "category": { "type": "badge", "label": "분류", "icon": "beach_access", "text": "해변·섬" },
  "tags": { "type": "tags", "label": "태그", "items": ["섬", "스노클링", "석양"] },
  "rating": { "type": "rating", "label": "추천도", "value": 4.5, "max": 5 },
  "latitude": { "type": "latitude", "label": "위도", "value": 10.3157 },
  "longitude": { "type": "longitude", "label": "경도", "value": 123.8854 },
  "best_season": { "type": "date", "label": "여행 최적기", "icon": "calendar_month", "text": "12월~5월 (건기)", "months": [12, 1, 2, 3, 4, 5] },
  "duration": { "type": "duration", "label": "여행 기간", "icon": "schedule", "text": "1박 2일" },
  "budget": { "type": "price", "label": "예산", "icon": "payments", "text": "1인 약 ₱1,500~3,500", "currency": "PHP", "min": 1500, "max": 3500 },
  "difficulty": { "type": "level", "label": "난이도", "icon": "signal_cellular_alt", "text": "쉬움", "value": 1, "max": 3 },
  "airport": { "type": "airport", "label": "가까운 공항", "icon": "flight", "text": "막탄-세부 국제공항(CEB)", "code": "CEB" },
  "image": { "type": "image", "url": "images/101-new-place.webp", "alt": "새 여행지", "credit": "작가 / CC BY-SA 4.0 / Wikimedia Commons", "source": "https://commons.wikimedia.org/wiki/File:…" },
  "gallery": { "type": "carousel", "label": "사진", "items": [] },
  "summary": { "type": "paragraph", "variant": "lead", "children": [{ "text": "2~3문장 요약 (100~160자)." }] },
  "sections": [
    { "type": "section", "key": "overview", "title": "한눈에 보기", "icon": "info", "blocks": [{ "type": "paragraph", "children": [{ "text": "…" }] }] }
  ]
}
```

### 6.2 수정·삭제·사진 교체

- **내용 수정:** JSON 을 고치고 빌드·커밋한다. version 이 바뀌므로 클라이언트가 다음 확인 때 새로 받는다.
- **삭제:**
  1. JSON 과 그 여행지의 사진을 지운다.
  2. 다른 여행지에서 그 slug 를 가리키는 `place`·`place_link` 를 지우거나 바꾼다. 남아 있으면 빌드가 실패한다.
  - 클라이언트는 places.json 을 통째로 바꾸므로 삭제도 그대로 반영된다.
- **사진 교체:** 같은 파일 이름으로 덮어쓰면 된다. `?v=` 해시와 크기가 바뀌므로 옛 캐시가 남지 않는다.

### 6.3 content_display_type 추가·수정

1. `data/content_display_type.json` 의 `types` 에 type 을 추가한다.
   - `group`·`context`·`name`·`role`·`props`(kind·required·description)·`html`·`css`·`flutter`·`example` 을 모두 채운다.
   - 모양 변형이 있으면 `variants` 도 넣는다.
2. 빌드가 목록과 `example` 을 검사한다. 이제 여행지 JSON 에서 그 type 을 쓸 수 있다.
3. `README.md` §4 의 type 표, 스킬의 [rendering.md](rendering.md), 두 참고 렌더러(`assets/renderer.mjs`·`assets/travel_blocks.dart`)에 넣는다.
4. 추가는 호환되므로 `SCHEMA` 는 그대로 둔다. 기존 type 의 필수 키를 늘리거나 뜻을 바꾸는 것은 호환되지 않는다(§5-5).

### 6.4 여행지에 새 속성 추가

1. `scripts/build.mjs` 의 `FIELDS` 에 `키: type` 을 넣는다. 필요한 값 검사도 `parsePlace()` 에 추가한다.
2. 여행지 JSON 100개에 그 속성을 넣는다(스크립트로 일괄).
3. `README.md` §3.1, `data/README.md` §2, 스킬의 [api.md](api.md) §3.1 표에 적는다. 화면 배치가 있으면 `layouts` 에도 넣는다.

### 6.5 JSON 을 일괄로 고칠 때

- Node 스크립트로 읽고 → 고치고 → 쓴다. 쓰기 형식은 들여쓰기 2칸, 짧은 객체·배열은 한 줄(약 100자 이내), 파일 끝 줄바꿈 1개다.
- 고친 뒤 `node scripts/build.mjs` 로 검사한다. 글을 옮기거나 자를 때는 조각을 이어 붙인 원문이 바뀌지 않았는지 비교한다.

## 7. 검증 방법

"빌드 성공"만으로 완료라고 하지 않는다. 바꾼 범위에 맞춰 아래를 확인한다.

1. **빌드:** `node scripts/build.mjs` 가 exit 0 으로 끝나는지, 출력된 version 이 기대와 맞는지 본다.
   - 내용·표시 방법 목록을 바꿨으면 version 이 바뀌어야 한다.
   - 문서·스킬만 바꿨으면 version 이 그대로여야 한다.
2. **로컬 응답:** `_site` 를 로컬 서버로 띄워 확인한다.
   - manifest → `places.json?v=<version>` · `content_display_type.json?v=<version>` 순서로 받아 `version`·`count` 가 세 파일에서 일치한다.
   - 모든 image 노드의 `url` 이 200 · `image/webp` 다.
3. **오류 차단:** 검사 규칙이나 표시 방법 목록을 바꿨다면 확인한다.
   - 스크래치 폴더에 `scripts/`·`data/`·`skills/` 를 복사한다.
   - 일부러 규격을 어긴 파일을 만들어 빌드한다 (모르는 type, 필수 키 누락, 없는 variant, 없는 slug 링크, 마크다운 흔적, 파일 이름 불일치, JSON 문법 오류 …).
   - exit 1 과 오류 메시지가 나오고 `_site/v2/*.json` 이 만들어지지 않는지 본다.
4. **사진 크기:** WebP 해석을 바꿨다면 모든 image 노드의 `width`·`height` 를 `sips -g pixelWidth -g pixelHeight` 결과와 비교한다.
5. **렌더러:** type 이나 렌더러를 바꿨다면 확인한다.
   - 웹 렌더러로 100곳과 48개 예시를 그려 예외가 없는지 본다.
   - Flutter 렌더러는 빈 Flutter 프로젝트에 넣어 `flutter analyze` 와 위젯 테스트(100곳 그리기)를 돌린다.
6. **배포 후:**
   - `gh run list` 가 `completed success` 다.
   - 공개 주소의 manifest version 이 로컬 빌드와 같다.
   - JSON 에 `content-type: application/json; charset=utf-8`, 사진에 `image/webp` 가 붙는다.
   - `https://thruthesky.github.io/ph-travel-api/skills/travel-api-skill.tar.gz` 가 200 이다.

## 8. 스킬 고치기와 배포

- 스킬 원본은 `skills/travel-api-skill/` 하나다.
- `.claude/skills/travel-api-skill/SKILL.md` 는 이 저장소에서 스킬을 부르는 입구일 뿐이다. 그 SKILL.md 의 본문은 원본을 읽으라고 안내한다.
  - 입구의 `name`·`description` 은 원본과 같게 둔다. 빌드가 description 을 비교한다.
- 스킬을 고치면 `SKILL.md` 앞머리의 `metadata.version` 을 올린다. 형식은 `"YYYY.MM.DD"`, 같은 날 두 번째면 `"YYYY.MM.DD.2"` 다. `update` 가 옛 버전 → 새 버전을 보여 줄 때 쓴다.
- 빌드가 `_site/skills/travel-api-skill.tar.gz` 를 만든다. push 하면 Pages 로 배포된다. 설치·`update` 는 이 묶음을 받는다.
- 묶음은 `COPYFILE_DISABLE=1` 로 만들어 macOS 의 `._*` 파일이 들어가지 않는다.
- `scripts/update.sh` 는 원본 저장소 안에서 실행되면 파일을 바꾸지 않고 `git pull` 을 안내한다.
- 스킬의 스크립트를 바꾸면 로컬 빌드로 시험한다: `node skills/travel-api-skill/scripts/travel.mjs --base _site/v2 …`.
  - `update.sh` 는 `TRAVEL_API_SKILL_TARBALL=<로컬 tar.gz>` 로 시험한다.

## 9. 새 나라 API 추가

같은 구조의 저장소를 하나 더 만든다(예: `thruthesky/jp-travel-api`).

1. 이 저장소의 `scripts/`·`data/content_display_type.json`·`.github/workflows/deploy.yml`·`.gitignore` 를 복사한다.
2. `build.mjs` 의 나라별 상수를 고친다.
   - `ISLAND_GROUPS`(권역), `CATEGORIES`
   - 좌표 범위 검사, `budget.currency`(예: JPY)
   - 스킬 검사·묶음(`checkSkill`·`packSkill`)은 빼거나 이 저장소를 가리키게 둔다. 스킬 원본은 한 곳에만 둔다.
   - 단락(`SECTIONS`)·노드 모양·표시 방법 목록은 그대로 둔다. 같은 렌더러로 그리기 위해서다.
3. `data/` 에 여행지 JSON 과 사진을 넣고 빌드 → Pages 를 켠다 (`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`).
4. 이 스킬의 `scripts/apis.json` 에 나라를 추가하고 `metadata.version` 을 올린다.

   ```json
   "jp": { "name": "일본", "name_en": "Japan", "base": "https://thruthesky.github.io/jp-travel-api/v2/", "repo": "thruthesky/jp-travel-api", "schema": 2, "currency": "JPY" }
   ```

5. `node scripts/travel.mjs --country jp info` 로 확인한다.
