# 필리핀 여행 정보 API

> 이 저장소에서 일하는 AI 코딩 에이전트용 안내서다. 작업 전에 끝까지 읽는다.
> JSON 형식과 클라이언트 절차의 전문은 [README.md](README.md), 여행지 JSON 작성 규격은 [data/README.md](data/README.md) 에 있다.
> 모든 응답·주석·커밋 메시지는 **한글**로 쓴다 (코드·경로·명령어 제외).

## 1. 한눈에 보기

| 항목 | 값 |
|------|----|
| 정체 | 필리핀 여행지 100선을 **블록 JSON** 으로 내주는 **정적 API**. 서버 코드·DB 없음 |
| 공개 주소 | `https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| 호스팅 | GitHub Pages (Source: **GitHub Actions**) |
| 배포 | `main` 에 push → [deploy.yml](.github/workflows/deploy.yml) → `node scripts/build.mjs` → Pages. 1~2분 |
| 원본 | `data/*.json` 여행지 100개 · `data/content_display_type.json` 표시 방법 목록 · `data/images/*.webp` 사진 293장 (23MB) |
| 빌드 결과 | `_site/v2/` — `manifest.json` · `places.json` (1.9MB, gzip 약 445KB) · `content_display_type.json` (70KB) · `images/` |
| 저장소 | `github.com/thruthesky/ph-travel-api` (공개) |
| 상위 프로젝트 | 필고 저장소(`thruthesky/philgo`)의 서브모듈 `submodules/ph-travel-api` |

- 2026-09-27 에 필고의 `apps/travel/data/travel/` 에서 옮겨 왔다. **여행지 자료의 원본은 이제 이 저장소다.**
- 같은 날 원본을 마크다운(`*.md`)에서 블록 JSON(`*.json`)으로 바꾸고 API 를 v1 → v2 로 올렸다. v1 은 배포하지 않는다(§10).

## 2. 폴더 구조

```
ph-travel-api/
├─ AGENTS.md                       ← 이 파일 (CLAUDE.md 는 이 파일의 심볼릭 링크)
├─ README.md                       ← API 형식·클라이언트 절차 (사람·클라이언트 개발자용)
├─ .github/workflows/deploy.yml    ← main push → 빌드 → Pages 배포
├─ .gitignore                      ← _site/ 제외
├─ scripts/build.mjs               ← 규격 검사 + JSON 합치기 + 사진 해시 (외부 패키지 없음)
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
| 로컬에서 응답 확인 | `cd _site && python3 -m http.server 8765` → `http://127.0.0.1:8765/v2/manifest.json` |
| 배포 진행 상황 | `gh run list --limit 3` · `gh run watch` |
| 배포 결과 확인 | `curl -s https://thruthesky.github.io/ph-travel-api/v2/manifest.json` |
| Pages 설정 확인 | `gh api repos/thruthesky/ph-travel-api/pages --jq .build_type` → `workflow` 여야 한다 |

- Node 는 24 를 쓴다(Actions 와 같다). `npm install` 할 것이 없다.

## 4. API 계약 — 클라이언트가 믿고 있는 불변식

이 절의 내용을 바꾸면 이미 설치된 앱이 깨진다. 바꾸기 전에 §6 의 규칙을 따른다.

| 파일 | 내용 |
|------|------|
| `v2/manifest.json` | `{ schema, version, count, places: "places.json", content_display_type: "content_display_type.json", generated_at }` — 클라이언트가 주기적으로 받는 작은 파일 |
| `v2/places.json` | `{ schema, version, count, places: [ … ] }` — 여행지 전체, `id` 오름차순 |
| `v2/content_display_type.json` | `{ schema, version, rules, common_props, inline, …, layouts, types }` — 표시 방법 목록, type 마다 `used`(쓰인 횟수) |
| `v2/images/*.webp` | 사진. JSON 의 `url` 로만 접근한다 |

1. **`version` 은 내용 해시다.** `sha256(JSON.stringify([places, 표시 방법 목록]))` 의 앞 12자리다.
   - 같은 내용이면 어디서 빌드해도 같은 값이 나온다. 세 파일의 version 은 언제나 같다.
   - README 나 스크립트 주석만 고친 push 는 version 이 그대로라서 클라이언트가 다시 받지 않는다.
   - `generated_at` 은 참고용이다. **해시에 넣지 않는다.**
2. **값은 노드다.** 여행지의 속성(`id`·`slug`·`sections` 제외)은 `{ "type": …, … }` 객체다.
   - 속성마다 type 이 정해져 있다(`build.mjs` 의 `FIELDS`). 예: `title` → `title`, `budget` → `price`, `gallery` → `carousel`.
   - 노드의 키 규격은 `content_display_type.json` 의 `types.<type>.props` 다.
   - 모든 블록 노드는 공통 키 `label`·`icon`(Material Symbols 이름)·`variant`·`style` 을 가질 수 있다.
3. **`sections` 는 section 노드 10개다.** `key`·`title`·순서가 고정이다(`overview` … `nearby`). 각 단락은 `blocks` 에 블록 노드를 담는다.
4. **글은 `children` 조각 배열이다.** 조각의 `text` 를 이어 붙이면 원문이 된다.
   - type 이 없는 조각은 일반 글이다.
   - `price`·`time`·`date`·`duration`·`distance`·`temperature` 조각은 값만 따로 꾸미라는 뜻이다.
5. **다른 여행지 링크는 `card.place`·`place_link.slug` 다.** 값은 그 여행지의 slug 이고, 빌드가 존재를 보장한다.
6. **사진은 image 노드다.** `{ type, url, alt, credit, source, width, height }`
   - `url` 은 `images/030-vigan.webp?v=2869bd00` 형식이다. places.json 이 있는 폴더(`v2/`) 기준 상대 경로다.
   - `?v=` 는 사진 파일의 sha256 앞 8자리다. 사진이 바뀌면 url 도 바뀌므로 클라이언트는 url 을 키로 오래 캐시한다. 사진만 바꿔도 version 이 바뀐다.
   - `width`·`height` 는 빌드가 WebP 머리에서 읽어 넣는다.
   - `credit`·`source` 는 CC 라이선스 저작자 표기다. 클라이언트 화면에 반드시 보여야 한다.
7. **클라이언트는 모르는 type·키를 무시하거나 대체해서 그린다** (`rules` 참고). 그래서 type·키 추가는 호환된다.

필드별 형식 표: [README.md](README.md) §3·§4

## 5. 빌드 스크립트가 막는 것 — 규격 검사

`scripts/build.mjs` 는 아래 중 하나라도 어기면 **JSON 을 쓰지 않고 exit 1** 로 끝난다. Actions 도 멈추므로 공개 주소에는 이전 배포가 그대로 남는다.

- **표시 방법 목록(`content_display_type.json`):** 먼저 검사한다. 모든 노드 검사의 기준이기 때문이다.
  - type 마다 `group`·`context`(block·inline)·`name`·`role`·`html`·`css`·`flutter` 가 있어야 한다.
  - `props` 의 `kind` 는 `prop_kinds` 중 하나여야 한다.
  - inline 에 쓰는 type 은 `text` 가 필수여야 한다.
  - 각 `example` 도 규격을 지켜야 한다.
  - `layouts` 의 type·속성 이름이 실제로 있어야 한다.
- **모든 노드 (자동):** 여행지 안의 노드를 끝까지 따라가며 검사한다.
  - `type` 이 목록에 있어야 한다.
  - 그 자리(block·inline)에 쓸 수 있어야 한다.
  - `props` 의 필수 키가 있어야 하고, 값 종류(`kind`)·`enum`·`min`(배열 최소 개수)·`types`(허용 type)를 지켜야 한다.
  - 모르는 키가 없어야 한다.
  - `variant` 는 그 type 의 `variants` 에 있는 값, `icon` 은 `^[a-z0-9_]+$`, `style` 은 `style_properties` 의 CSS 속성만 쓴다.
- **파일:**
  - `<id 3자리>-<slug>.json` 과 `id`·`slug` 가 일치해야 한다. 번호로 시작하는 `.json` 만 여행지로 읽는다. 이 형식이라 `id` 는 1~999 까지만 쓸 수 있다.
  - JSON 문법이 맞아야 한다.
  - 정해진 속성 외의 속성이 없어야 한다.
- **slug:** `^[a-z0-9-]+$` 형식이어야 하고, `id`·`slug` 는 서로 겹치면 안 된다.
- **속성의 type:** `FIELDS` 에 정한 type 이어야 한다.
- **정해진 값 중 하나여야 한다:**
  - `island_group.text` = 루손·비사야·민다나오
  - `category.text` = 해변·섬, 다이빙·해양, 산·트레킹, 폭포·호수·강, 역사·문화, 도시·미식, 자연 경관
  - `difficulty.text` = 쉬움·보통·어려움, 그리고 `value`·`max` 가 1~3·3 으로 짝이 맞아야 한다
- **숫자 범위:**
  - `tags.items` 3~6개
  - `rating.value` 4.0~5.0, `max` 5
  - `latitude.value` 4~22, `longitude.value` 116~127 (필리핀 영역)
  - `best_season.months` 는 겹치지 않는 1~12
  - `budget` 은 `currency: "PHP"`, `min ≤ max`
- **본문:**
  - `sections` 의 key·title·순서가 규격과 정확히 같아야 한다.
  - 단락마다 블록이 1개 이상이어야 한다.
  - 보이는 글(text·title·time·price …)이 2,500자를 넘어야 한다.
  - 마크다운 흔적(`**`, `](`)이 없어야 한다.
- **사진:**
  - 모든 image 노드의 `url` 은 `images/[a-z0-9-]+\.webp` 형식이고 파일이 실제로 있어야 하며, WebP 크기를 읽을 수 있어야 한다.
  - `credit` 이 있어야 하고, `source` 는 `https://` 로 시작해야 한다.
- **링크:** `card.place`·`place_link.slug` 는 실제로 있는 여행지를 가리켜야 하고, 자기 자신을 가리키면 안 된다.

## 6. 규칙

1. **`main` push 는 곧 운영 배포다.**
   - 필고 프로젝트 규칙에 따라 push 는 사용자가 요청할 때만 한다.
   - 작업을 마치면 커밋까지만 한다.
2. **push 전에 반드시 `node scripts/build.mjs` 가 성공해야 한다.**
3. **`_site/` 는 커밋하지 않는다.** 배포 때 Actions 가 새로 만든다.
4. **외부 npm 패키지를 넣지 않는다.** 빌드는 Node 기본 모듈만 쓴다. 그래서 `package.json` 도 없다.
5. **JSON 구조 변경 규칙:**
   - **type·키 추가는 호환된다.** 클라이언트는 모르는 type·키를 무시하거나 대체해서 그려야 한다.
   - **키 삭제·이름 변경·형식 변경, type 의 뜻 변경은 호환되지 않는다.** 이때는 다음 순서를 따른다.
     1. `SCHEMA` 를 올린다. 출력 경로는 `_site/v<SCHEMA>/` 로 따라 바뀐다.
     2. 옛 앱이 남아 있는 동안 옛 경로도 함께 빌드한다.
6. **version 은 결정적이어야 한다.** 시각·난수·파일 순서처럼 빌드할 때마다 달라지는 값을 `places` 나 표시 방법 목록 안에 넣지 않는다. 여행지 순서는 `id` 로 정렬한다.
7. **규격을 바꾸면 함께 고친다.**
   - 값 목록·속성·단락: `scripts/build.mjs` 의 상수(`ISLAND_GROUPS`·`CATEGORIES`·`DIFFICULTIES`·`FIELDS`·`SECTIONS`)
   - [data/README.md](data/README.md)
   - 분류를 바꿀 때: 여행지 JSON 의 `category.icon` 과 필고 앱의 `apps/lib/src/travel/travel_category.dart`
   - type 을 바꿀 때: `data/content_display_type.json` 과 [README.md](README.md) §4 의 type 표
8. **서브모듈 커밋 순서:** 이 저장소에서 먼저 커밋·push 한 뒤, 필고 저장소에서 `submodules/ph-travel-api` 포인터를 커밋한다.
9. **필고의 `apps/travel/data/travel/` 은 옛 마크다운 사본이다.** 앱이 아직 번들 자료를 읽고 있어서 남겨 둔 것이다(§9). 여행지 내용은 **이 저장소에서만** 고친다.

## 7. 자주 하는 작업

### 7.1 여행지 추가

1. 비어 있는 번호로 `data/<id 3자리>-<slug>.json` 을 만든다. 비슷한 여행지 파일을 복사해 고치면 빠르다. 형식은 [data/README.md](data/README.md) 를 그대로 따른다.
2. 사진을 준비한다.
   - Wikimedia Commons 의 CC·퍼블릭 도메인 사진을 1080px WebP 로 줄여 `data/images/<같은 이름>.webp` 에 둔다.
   - 추가 사진은 `-2`, `-3` 을 붙여 `gallery.items` 에 image 노드로 넣는다.
3. image 노드마다 `credit`(작가 / 라이선스 / 출처)과 `source`(원본 페이지)를 적는다. `width`·`height`·`?v=` 는 빌드가 붙이므로 적지 않는다.
4. 글은 `children` 조각으로 쓰고, 금액·시각·날짜·소요 시간·거리·기온은 type 조각으로 따로 자른다.
5. 다른 여행지의 `nearby` 단락에 `place: "<slug>"` 카드로 새 여행지를 연결하면 좋다.
6. `node scripts/build.mjs` → 커밋.

### 7.2 수정·삭제·사진 교체

- **내용 수정:** JSON 을 고치고 빌드·커밋한다. version 이 바뀌므로 클라이언트가 다음 확인 때 새로 받는다.
- **삭제:**
  1. JSON 과 그 여행지의 사진을 지운다.
  2. 다른 여행지에서 그 slug 를 가리키는 `place`·`place_link` 를 지우거나 바꾼다. 남아 있으면 빌드가 실패한다.
  - 클라이언트는 places.json 을 통째로 바꾸므로 삭제도 그대로 반영된다.
- **사진 교체:** 같은 파일 이름으로 덮어쓰면 된다. `?v=` 해시와 크기가 바뀌므로 옛 캐시가 남지 않는다.

### 7.3 content_display_type 추가·수정

1. `data/content_display_type.json` 의 `types` 에 type 을 추가한다.
   - `group`·`context`·`name`·`role`·`props`(kind·required·description)·`html`·`css`·`flutter`·`example` 을 모두 채운다.
   - 모양 변형이 있으면 `variants` 도 넣는다.
2. 빌드가 목록과 `example` 을 검사한다. 이제 여행지 JSON 에서 그 type 을 쓸 수 있다.
3. [README.md](README.md) §4 의 type 표에 넣는다.
4. 추가는 호환되므로 `SCHEMA` 는 그대로 둔다(§6-5). 기존 type 의 필수 키를 늘리거나 뜻을 바꾸는 것은 호환되지 않는다.

### 7.4 여행지에 새 속성 추가

1. `scripts/build.mjs` 의 `FIELDS` 에 `키: type` 을 넣는다. 필요한 값 검사도 `parsePlace()` 에 추가한다.
2. 여행지 JSON 100개에 그 속성을 넣는다(스크립트로 일괄).
3. [README.md](README.md) §3.1 과 [data/README.md](data/README.md) §2 의 표에 적는다. 화면 배치가 있으면 `layouts` 에도 넣는다.

### 7.5 클라이언트(웹·앱) 구현

절차 전문은 [README.md](README.md) §4·§5 에 있다. 요약하면 다음과 같다.

1. 처음 실행하면 manifest 를 받고, 이어서 places.json·content_display_type.json 을 받는다. 받은 것을 기기에 저장하고 version 도 저장한다.
2. 앱 시작·포그라운드 복귀 때 manifest 를 다시 받는다(예: 6시간 간격). version 이 다르면 두 파일을 `?v=<version>` 으로 받는다.
3. 받은 파일의 `schema`·`count`·`version` 을 확인한 뒤 저장본을 통째로 바꾼다. 실패하면 기존 저장본을 그대로 쓴다.
4. type 마다 위젯 하나를 만든다. `used` 가 0 이 아닌 30개면 지금 데이터를 모두 그린다. 모르는 type 은 `rules` 대로 대체해서 그린다.
5. 사진은 미리 받지 않는다. 화면에 보일 때 받아 url 을 키로 디스크에 캐시한다.
6. 웹은 IndexedDB 에 저장한다. CORS 는 Pages 가 `*` 로 열어 두었다.

필고 Flutter 앱 쪽의 현재 코드는 다음과 같다.

- **모델:** `apps/lib/src/travel/travel_place.model.dart` 의 `TravelPlace.fromMarkdown()`
  - 옛 마크다운 사본을 읽는다. v2 JSON 을 읽는 `fromJson` 과 블록 렌더러는 아직 없다.
- **상태:** `apps/lib/src/travel/travel.state.dart`
- **앱 진입점:** `apps/travel/lib/main.dart` 의 `TravelState(assetDir: 'data/travel')` — 번들 md 를 읽는다.

## 8. 검증 방법

"빌드 성공"만으로 완료라고 하지 않는다. 바꾼 범위에 맞춰 아래를 확인한다.

1. **빌드:** `node scripts/build.mjs` 가 exit 0 으로 끝나는지, 출력된 version 이 기대와 맞는지 본다.
   - 내용을 바꿨으면 version 이 바뀌어야 한다.
   - 문서만 바꿨으면 version 이 그대로여야 한다.
2. **로컬 응답:** `_site` 를 로컬 서버로 띄워 다음을 확인한다.
   - manifest → `places.json?v=<version>` · `content_display_type.json?v=<version>` 순서로 받아 `version`·`count` 가 세 파일에서 일치한다.
   - 모든 image 노드의 `url` 이 200 · `image/webp` 다.
3. **오류 차단:** 검사 규칙이나 표시 방법 목록을 바꿨다면 다음을 확인한다.
   - 스크래치 폴더에 `scripts/`·`data/` 를 복사한다.
   - 일부러 규격을 어긴 파일을 만들어 빌드한다(모르는 type, 필수 키 누락, 없는 variant, 없는 slug 링크, 마크다운 흔적, 파일 이름 불일치, JSON 문법 오류 …).
   - exit 1 과 오류 메시지가 나오고 `_site/v2/*.json` 이 만들어지지 않는지 본다.
4. **사진 크기:** WebP 해석을 바꿨다면 모든 image 노드의 `width`·`height` 를 `sips -g pixelWidth -g pixelHeight` 결과와 비교한다.
5. **배포 후:** 다음을 확인한다.
   - `gh run list` 가 `completed success` 다.
   - 공개 주소의 manifest version 이 로컬 빌드와 같다.
   - `content-type: application/json; charset=utf-8` 이 붙어 있다.
   - 사진이 `image/webp` 로 내려온다.

## 9. 현재 상태 (2026-09-27)

- **완료:**
  - 자료 이전, 빌드 스크립트, Pages 배포(v1, version `68cef818ff36`).
    - Pages 는 `gh api -X POST repos/thruthesky/ph-travel-api/pages -f build_type=workflow` 로 켰다.
    - 공개 주소에서 JSON 과 사진 293장 응답을 검증했다.
  - 마크다운 → 블록 JSON 변환, 표시 방법 목록, v2 빌드(version `febd084c0575`).
    - 변환은 일회성 스크립트로 했다. 원문 1,000개 단락의 보이는 글자(마크다운 기호·공백 제외)가 순서까지 JSON 과 일치함을 확인했다.
    - 앞머리 25개 키도 모두 일치했다.
    - 031~040 번 끝에 섞여 있던 도구 태그 줄(`</content>`, `</invoke>`)은 이때 지웠다.
- **남은 일:**
  - v2 를 push 해 배포한다 — 이 커밋 시점에는 아직 공개 주소가 v1 이다.
  - 필고 Flutter 앱(`apps/travel`)을 §7.5 방식으로 바꾼다 — `fromJson` 과 type 별 위젯.
  - 바꾼 뒤 필고의 `apps/travel/data/travel/` 을 지운다.
  - 오프라인 첫 실행용으로 `places.json` 스냅샷 하나만 번들에 남길지 정한다.
  - 필고의 `apps/travel/test/widget_test.dart` 는 그 사본을 검사하고 있으므로 함께 정리한다.

## 10. 결정 기록

### 10.1 왜 GitHub Pages 인가

- **요구 사항:** git push 만으로 배포, 읽기 전용 정적 데이터, 웹·앱이 받아 저장하고 업데이트 확인.
- **비교한 방법:**
  - Cloudflare Workers Static Assets + Workers Builds: 무료이고 요청 수 무제한이다. 계정 연결과 Worker 설정이 필요하다.
  - Cloudflare R2 + GitHub Actions: 비밀 키 관리가 필요하고, 캐시 무효화를 직접 설계해야 한다.
  - GitHub Pages: 모든 것이 GitHub 안에서 끝나서 가장 간단하다. → **선택.**
- **GitHub Pages 의 한계:**
  - 응답 헤더를 바꿀 수 없다. `Cache-Control: max-age=600` 이 고정이라, push 후 클라이언트에 보이기까지 최대 10분 걸린다.
  - 사이트는 1GB 까지다. 전송량은 월 100GB 권장 한도다.
  - 배포는 10분 안에 끝나야 한다.
- **옮겨야 할 때:** 한계를 넘거나 헤더를 제어해야 하면 옮긴다.
  - 1순위는 Cloudflare Workers Static Assets 다(무료 20,000 파일, 파일당 25MiB).
  - 사진만 매우 커지면 사진만 R2 로 옮긴다.
  - JSON 의 사진 url 이 상대 경로이므로, 이 계약(§4)을 지키면 클라이언트 코드를 거의 고치지 않고 옮길 수 있다.

### 10.2 왜 블록 JSON 인가 (2026-09-27)

- **요구 사항:** 웹·앱이 속성·문단·낱말마다 다른 디자인을 입힐 수 있어야 한다. 표시 방법(content_display_type)을 미리 정해 JSON 과 함께 내려야 한다.
- **비교한 방법:**
  - Quill Delta(`insert` + `attributes`): 글 꾸밈에는 가볍지만 탭·카드·표 같은 구조를 담기 어렵다.
  - Draft.js 식 offset 스타일: 글자 위치로 꾸밈을 적는다. Dart(UTF-16)·JS·서버의 글자 세기가 달라 어긋나기 쉽다.
  - Editor.js 식 블록 + Slate 식 조각: 문단·위젯은 블록, 글 안의 꾸밈은 조각 배열로 쓴다. → **선택.**
- **선택한 모양:**
  - 블록은 `type` + 데이터다. 블록 안의 블록은 `blocks`, 글은 `children` 조각 배열에 담는다.
  - 조각은 `{ text, type?, bold? … }` 다. 이어 붙이면 원문이 되므로 검색·복사·음성 읽기가 쉽다.
  - 속성마다 type 을 붙였다. 목록 거르기용 값(`months`·`min`·`max`·`code`·`value`)은 같은 노드 안에 둔다.
- **표시 방법 목록을 데이터로 둔 이유:** 목록의 `props` 가 곧 검사 규격이다. 문서와 검사가 어긋날 수 없다. 클라이언트도 같은 파일로 무엇을 구현할지(`used`) 안다.
- **v1 을 없앤 이유:** v1 은 같은 날 처음 배포됐고, 필고 앱은 아직 번들 md 를 읽고 있어 v1 을 받는 클라이언트가 없었다. 마크다운 원본이 사라지므로 v1 을 유지하려면 JSON → 마크다운 역변환이 필요한데, 쓰는 곳이 없어 만들지 않았다.
