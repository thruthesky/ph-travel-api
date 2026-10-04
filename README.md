# ph-travel-api

필리핀 여행지 223곳을 **8개 언어**의 JSON 으로 제공하는 정적 API 다. 서버 코드는 없다.

- 언어: 영어 `en` · 중국어(간체) `zh` · 일본어 `ja` · 한국어 `ko` · 태국어 `th` · 베트남어 `vi` · 러시아어 `ru` · 아랍어 `ar`(오른쪽→왼쪽)
- 배포: **Cloudflare R2** — api-skill 의 `r2.mjs deploy` 로 올린다(2026-10-01 부터). 이 저장소는 GitHub 에 push 하지 않는다(2026-10-02) — 옛 주소인 GitHub Pages 는 2026-10-01 판에서 멈췄다.
- 기본 주소: `https://files.withcenter.com/ph-travel-api/v2/`
  - 옛 주소 `https://thruthesky.github.io/ph-travel-api/v2/` 는 옛 앱을 위해 당분간 둔다. 같은 내용을 내보낸다.
- 원본
  - 여행지: `data/<언어>/*.json` — 원본 언어는 한국어(`data/ko/`), 나머지 7개 언어는 번역본이다. 작성 규격은 [data/README.md](data/README.md) 에 있다.
  - 기준 정보: `data/meta.json` — 지원 언어·분류 목록(다국어)·속성·단락·표시 방법(type)
  - 사진: `data/images/*.webp` — 모든 언어가 같은 사진을 쓴다
- 빌드: `node scripts/build.mjs` → `_site/v2/` (외부 패키지 없음, Node 만 필요)

여행 정보는 화면에 바로 그릴 수 있는 **블록 JSON** 이다. 모든 값에 `type`(표시 방법)이 붙어 있어서, 웹·앱은 type 마다 알맞은 위젯(히어로·탭·아코디언·카드·타임라인·비용표·별점 …)을 골라 그리면 된다. type 의 뜻과 권장 HTML·CSS·Flutter 위젯은 `meta.json` 의 `display` 에 함께 내려간다.

## 0. AI 스킬 — api-skill

AI 코딩 에이전트가 이 API 를 잘 쓰도록 돕는 스킬은 **`api-skill`** 이다. 원본과 설치 안내는 [thruthesky/skills](https://github.com/thruthesky/skills) 저장소에 있다. 2026-09-30 에 이 저장소의 `travel-api-skill` 을 그리로 옮기고 이름을 바꿨다.

- 여행 질문에 데이터로 답한다 — 추천·일정·비용·가는 방법·가까운 곳.
- 웹·Flutter 앱에서 받기·저장·그리기 코드를 만든다. 참고 렌더러와 SQLite 조회 코드(PHP·Dart)가 들어 있다.
- 이 저장소의 여행지 추가·번역·검사·배포를 돕는다.

| 할 일 | 방법 |
|------|------|
| 설치 | [thruthesky/skills README](https://github.com/thruthesky/skills#readme) §1 의 글을 코딩 에이전트에 붙여 넣고 전송한다. Claude Code 는 플러그인으로, Codex·Gemini CLI·Copilot CLI 는 스킬 폴더로 설치된다 |
| 부르기 | Claude Code `/api-skill:api-skill <요청>` · Codex `$api-skill <요청>` · 그 밖의 도구는 필리핀 여행을 물으면 에이전트가 고른다 |
| 업데이트 | Claude Code `claude plugin marketplace update thruthesky-skills` → `claude plugin update api-skill@thruthesky-skills` · 폴더 설치는 스킬을 `update` 인자로 부른다 |

- **이 저장소에는 이미 설치돼 있다.** `.claude/settings.json` 이 `api-skill@thruthesky-skills` 를 프로젝트 범위로 켠다. Claude Code 로 이 저장소를 처음 열면 마켓플레이스 추가·플러그인 설치를 묻는다.
- 조회 도구 `scripts/travel.mjs` 는 Node 24 가 필요하다(내장 `node:sqlite` 의 FTS5). 받은 JSON 과 DB 는 `~/.cache/api-skill/` 에 캐시한다.

## 1. 파일

| 주소 | 내용 |
|------|------|
| `v2/manifest.json` | 버전 확인용 작은 파일. 클라이언트는 이것만 주기적으로 받는다 |
| `v2/meta.json` | 기준 정보 — 지원 언어, 다국어 분류·권역·지역·난이도 목록, 속성·단락 이름표, 표시 방법 type 48개 (약 100KB) |
| `v2/places.<언어>.json` | **한 언어의 여행지 223곳 전체** — `places.en.json` · `places.ko.json` … 8개 (각 3.4~7.0MB, 전송 때 gzip 으로 약 4분의 1) |
| `v2/images/<이름>.webp` | 사진. JSON 의 `url` 로만 접근한다 |

R2 공개 주소의 응답 헤더:

- JSON 은 `Cache-Control: no-cache` 다. 받을 때마다 ETag 로 확인하므로(안 바뀌었으면 304) 배포가 곧바로 보인다.
- 사진은 `Cache-Control: public, max-age=31536000, immutable` 이다. 주소에 사진 해시(`?v=`)가 있어 사진이 바뀌면 주소가 바뀐다.
- `Access-Control-Allow-Origin: *` 다(GET·HEAD, 2026-10-01 부터). 다른 도메인의 웹 페이지도 브라우저에서 바로 불러 쓸 수 있다.
- 옛 주소(GitHub Pages)는 모든 응답에 `Cache-Control: max-age=600` 과 `Access-Control-Allow-Origin: *` 를 붙인다.

## 2. manifest.json

```json
{
  "schema": 2,
  "version": "VERSION_EXAMPLE",
  "count": 100,
  "source_language": "ko",
  "fallback_language": "en",
  "languages": ["en", "zh", "ja", "ko", "th", "vi", "ru", "ar"],
  "meta": "meta.json",
  "places": { "en": "places.en.json", "zh": "places.zh.json", "ja": "places.ja.json", "ko": "places.ko.json", "th": "places.th.json", "vi": "places.vi.json", "ru": "places.ru.json", "ar": "places.ar.json" },
  "generated_at": "2026-09-27T15:00:00.000Z"
}
```

| 키 | 뜻 |
|----|----|
| `schema` | JSON 구조 번호. 호환되지 않게 바뀌면 경로가 `v3/` 로 바뀐다 |
| `version` | 내용 해시. **이 값이 바뀌었을 때만** `meta.json` 과 `places.<언어>.json` 을 다시 받는다. 문서만 고친 push 에서는 바뀌지 않는다 |
| `count` | 여행지 수 (모든 언어가 같다) |
| `source_language` | 원본 언어. 다른 언어는 이 언어를 옮긴 번역본이다 |
| `fallback_language` | 기기 언어가 목록에 없을 때 쓸 언어 |
| `languages` | 지원 언어 코드 |
| `meta` · `places` | 파일 이름 (manifest 기준 상대 경로). `places` 는 언어 코드 → 파일 이름 |
| `generated_at` | 빌드 시각. 참고용이며 비교에 쓰지 않는다 |

## 3. meta.json

```json
{
  "schema": 2, "version": "VERSION_EXAMPLE", "data_version": "2026-09-29T07:26:02Z",
  "source_language": "ko", "fallback_language": "en",
  "languages": [ { "code": "ar", "locale": "ar", "name": "Arabic", "native": "العربية", "dir": "rtl" }, … ],
  "categories": [ { "key": "heritage", "icon": "account_balance", "name": { "en": "History & Culture", "ko": "역사·문화", "ja": "歴史・文化", … } }, … ],
  "island_groups": [ { "key": "luzon", "name": { … } }, … ],
  "regions": [ { "key": "ilocos", "island_group": "luzon", "name": { … } }, … ],
  "difficulties": [ { "value": 1, "key": "easy", "name": { … } }, … ],
  "destinations": [ { "key": "manila", "icon": "location_city", "latitude": 14.5995, "longitude": 120.9842, "name": { … }, "tagline": { … }, "places": ["intramuros", "national-museum", …] }, … ],
  "monthly_picks": [ { "month": 1, "places": ["cebu-city", "kalibo", …] }, … ],
  "fields": { "budget": { "type": "price", "label": { "en": "Budget", "ko": "예산", … }, "icon": "payments", "role": "…" }, … },
  "sections": [ { "key": "overview", "icon": "info", "title": { "en": "At a glance", "ko": "한눈에 보기", … } }, … ],
  "display": { "rules": [ … ], "common_props": { … }, "inline": { … }, "css_variables": "…", "layouts": { … }, "types": { … } }
}
```

| 키 | 내용 |
|----|------|
| `data_version` | 정보를 마지막으로 가공한 UTC 시각(`YYYY-MM-DDTHH:MM:SSZ`). 화면에 "정보 기준일"로 보여 준다. 다시 받을지는 `version` 으로 정한다 |
| `languages` | 지원 언어 — `code`(파일 이름의 언어 코드)·`locale`(BCP 47, 날짜·숫자 형식용)·`name`(영어 이름)·`native`(그 언어로 쓴 이름, 언어 고르기 화면용)·`dir`(`ltr`·`rtl`) |
| `categories` | 분류 7개 — `key`·`icon`·언어별 `name`. key: `beach` `diving` `mountain` `water` `heritage` `city` `nature` |
| `island_groups` | 권역 3개 — `luzon` `visayas` `mindanao` |
| `regions` | 지역 35개 — `key`·소속 `island_group`·언어별 `name` |
| `difficulties` | 난이도 3단계 — `value` 1~3 · `key` `easy` `moderate` `hard` |
| `destinations` | 지역별 추천 베스트 — 외국인 여행자가 많이 찾는 큰 지역 9곳(`manila` `cebu` `angeles` `boracay` `palawan` `baguio` `bohol` `dumaguete` `davao`). `key`·`icon`·중심 좌표·언어별 `name`·`tagline`(한 줄 소개)·`places`(그 지역에서 많이 찾는 순서의 여행지 slug 5~10개). 앱 첫 화면의 「지역별 추천 베스트 10」 |
| `monthly_picks` | 월별 추천 — 1~12월 12개, 달마다 `places`(여행지 slug 1~5개, 추천 순서). 그 달이 그 여행지의 `best_season.months` 안이어야 한다(빌드가 검사). 앱 첫 화면의 「월별 추천 여행지」 |
| `fields` | 여행지 속성마다 `type`·언어별 이름표 `label`·`icon`·`values`(정해진 목록 이름)·`role` |
| `sections` | 본문 단락 10개의 `key`·`icon`·언어별 제목 — 순서가 곧 화면 순서다 |
| `display` | 표시 방법 — 5절 |

- **분류·권역·지역·난이도는 언어와 무관한 key 로 거른다.** 여행지의 `category.value`·`island_group.value`·`region.value`·`difficulty.value` 가 이 목록의 key(난이도는 value)다.
- 거르기 칩·목록 제목은 이 파일의 `name[언어]` 로, 여행지 화면의 값은 노드의 `text` 로 그린다. 둘은 같은 글이다.
- **추천 모음(`destinations`·`monthly_picks`)은 2026-10-02 에 더했다.** 키 추가라 옛 클라이언트는 그냥 지나친다. 없으면(옛 데이터) 추천 화면을 숨기거나 추천도 순서로 대신한다.

## 4. places.<언어>.json

```json
{ "schema": 2, "version": "VERSION_EXAMPLE", "lang": "ko", "dir": "ltr", "count": 100, "places": [ { … }, … ] }
```

여행지는 `id` 오름차순이다. 한 곳의 모양은 다음과 같다(한국어, 줄임).

```json
{
  "id": 30,
  "slug": "vigan",
  "title": { "type": "title", "text": "비간" },
  "title_en": { "type": "subtitle", "lang": "en", "text": "Vigan" },
  "tagline": { "type": "typography", "variant": "tagline", "text": "마차 소리 울리는 스페인 식민 시대의 돌길 도시" },
  "island_group": { "type": "badge", "label": "권역", "value": "luzon", "text": "루손" },
  "region": { "type": "badge", "label": "지역", "value": "ilocos", "text": "일로코스" },
  "category": { "type": "badge", "label": "분류", "icon": "account_balance", "value": "heritage", "text": "역사·문화" },
  "rating": { "type": "rating", "label": "추천도", "value": 4.7, "max": 5 },
  "best_season": { "type": "date", "label": "여행 최적기", "icon": "calendar_month", "text": "11월~5월 (건기)", "months": [11, 12, 1, 2, 3, 4, 5] },
  "budget": { "type": "price", "label": "예산", "icon": "payments", "text": "1인 약 ₱2,000~4,000 (1일)", "currency": "PHP", "min": 2000, "max": 4000 },
  "difficulty": { "type": "level", "label": "난이도", "icon": "signal_cellular_alt", "text": "쉬움", "value": 1, "max": 3 },
  "image": { "type": "image", "url": "images/030-vigan.webp?v=2869bd00", "alt": "비간", "credit": "Allan Jay Quesada / CC BY-SA 4.0 / Wikimedia Commons", "source": "https://commons.wikimedia.org/…", "width": 1080, "height": 719 },
  "sections": [
    { "type": "section", "key": "overview", "title": "한눈에 보기", "icon": "info", "blocks": [
      { "type": "paragraph", "children": [ { "text": "비간은 루손 북서쪽 …" } ] }
    ] },
    { "type": "section", "key": "itinerary", "title": "추천 일정", "icon": "event_note", "blocks": [
      { "type": "tabs", "items": [
        { "title": "1일차", "subtitle": "구시가지와 야경", "blocks": [
          { "type": "stepper", "items": [ { "time": "06:00", "children": [ { "text": "라오아그 공항 도착 …" } ] } ] }
        ] }
      ] }
    ] }
  ]
}
```

**모든 언어의 여행지는 모양이 같다.** 빌드가 원본(ko)과 하나하나 비교해 막는다.

- 같은 것: `id`·`slug`·`title_en`·숫자(`rating`·좌표·`months`·`budget.min`·`max`)·코드(`value`·`airport.code`·`currency`)·사진(`url`·`credit`·`source`·`width`·`height`)·`icon`·`variant`·단락 `key`·블록의 종류·순서·개수·링크(`place`·`place_link.slug`)
- 다른 것: 글 — `display.types` 의 props 에서 `translate: true` 인 속성(`text`·`title`·`children`·`alt`·`items`(태그)·`columns`·`rows`·비용표 항목 …)과 `label`
- 그래서 언어를 바꿔도 같은 `slug`·같은 단락 `key` 로 같은 자리를 가리킨다. `(slug, 언어)` 한 쌍이 글 한 벌이다.
- 글 조각(`children`)의 값 조각(`price`·`time` …)은 언어마다 개수·종류가 같고, 어순에 따라 위치만 다를 수 있다.

### 4.1 속성과 type

| 키 | type | 쓰임 |
|----|------|------|
| `id` · `slug` | 숫자 · 문자열 | 식별자. `slug` 는 링크(`place`·`place_link`)가 가리키는 값 |
| `title` | `title` | 여행지 이름 (그 언어) |
| `title_en` | `subtitle` | 영문 이름 — 모든 언어가 같다. 영어 화면에서는 `title` 과 같으므로 그리지 않는다 |
| `tagline` | `typography` (tagline) | 감성 한 줄 카피 |
| `island_group` · `region` · `category` | `badge` | 권역·지역·분류 — `value` 는 `meta.json` 목록의 key, `text` 는 그 언어의 이름 |
| `location` | `address` | 주·도시 수준 위치 |
| `tags` | `tags` | `items` 3~6개 |
| `rating` | `rating` | `value` 4.0~5.0, `max` 5 |
| `latitude` · `longitude` | `latitude` · `longitude` | `value` — 두 값으로 지도(`map`)를 그리고 가까운 곳을 계산한다 |
| `best_season` | `date` | `months` 로 "지금 가기 좋은 곳"을 거른다 |
| `duration` | `duration` | 여행 기간 |
| `budget` | `price` | `min`·`max`(페소)로 예산 거르기·정렬 |
| `difficulty` | `level` | `value` 1~3 (`meta.difficulties`), `max` 3 |
| `airport` | `airport` | `code` 는 IATA 코드 |
| `image` | `image` | 대표 사진 |
| `gallery` | `carousel` | 추가 사진 `items` (없으면 `[]`) |
| `summary` | `paragraph` (lead) | 2~3문장 요약 |
| `sections` | `section` 배열 | 본문 10단락 (4.2) |

`label`(이름표)과 `icon`(Material Symbols 이름)이 붙은 값은 "아이콘 + 이름표 + 값" 정보 칸으로 그리면 된다. 이름표는 `meta.fields.<키>.label[언어]` 와 같다.

### 4.2 본문 단락

단락 `key`·아이콘·순서는 모든 언어가 같고, 제목은 `meta.sections[].title[언어]` 다.

| key | 제목 (ko · en) | 주로 쓰는 블록 |
|-----|----------------|----------------|
| `overview` | 한눈에 보기 · At a glance | `paragraph` |
| `highlights` | 꼭 해봐야 할 것 · Top things to do | `grid` + 번호 `card` |
| `itinerary` | 추천 일정 · Suggested itinerary | `tabs` + `stepper` |
| `getting_there` | 가는 방법 · Getting there | `accordion` (수단별, 아이콘) + `list` |
| `best_time` | 여행 최적기와 날씨 · Best time to visit & weather | `paragraph` |
| `costs` | 예상 비용 · Estimated costs | `pricing` + `caption` |
| `stay_and_food` | 숙소와 먹거리 · Where to stay & eat | `paragraph` |
| `tips` | 여행 팁 · Travel tips | `list` (아이콘) |
| `cautions` | 주의사항 · Precautions | `alert` (warning) + `list` |
| `nearby` | 함께 가보면 좋은 곳 · Nearby places to visit | `grid` + 링크 `card` (`place` = 다른 여행지 slug) |

### 4.3 글 조각 — `children`

글은 조각 배열로 온다. 조각의 `text` 를 차례로 이어 붙이면 원문이 된다. `type` 이 없는 조각은 일반 글이다. type 이 있는 조각은 그 값만 따로 꾸민다. 예를 들어 금액은 굵은 강조색으로, 시간은 옅은 배경으로 그린다.

```json
[ { "text": "마닐라에서 약 " }, { "type": "duration", "text": "7~9시간" }, { "text": ", 요금은 " }, { "type": "price", "text": "₱900~1,200" }, { "text": "입니다." } ]
```

```json
[ { "text": "From Manila it takes about " }, { "type": "duration", "text": "7–9 hours" }, { "text": " and costs " }, { "type": "price", "text": "₱900–1,200" }, { "text": "." } ]
```

지금 데이터에 쓰이는 조각 type 은 `price` · `time` · `date` · `duration` · `distance` · `temperature` 다. `bold`·`italic`·`underline`·`strike` 표시와 `place_link`·`link` 도 규격에 있다.

### 4.4 사진

- `url` 은 `images/030-vigan.webp?v=2869bd00` 처럼 **places.<언어>.json 이 있는 폴더(`v2/`) 기준 상대 경로**다.
  - `https://files.withcenter.com/ph-travel-api/v2/` 에 이어 붙여 쓴다.
  - `?v=` 는 사진 내용 해시라서 사진이 바뀌면 주소도 바뀐다. 주소를 키로 삼아 오래 캐시해도 된다. 모든 언어가 같은 주소라서 언어를 바꿔도 캐시를 그대로 쓴다.
- `width`·`height` 로 사진이 오기 전에 비율 자리를 잡는다.
- 저작자 표기(`credit`·`source`)는 CC 라이선스 조건이라서 화면에 반드시 보여야 한다. `alt` 만 언어마다 다르다.

## 5. 표시 방법 — meta.json 의 display

웹·앱이 JSON 을 그릴 때 참고하는 표시 방법 목록이다.

| 키 | 내용 |
|----|------|
| `rules` | 그리는 규칙 — 노드 자리(block·inline), 조각, 언어별로 다른 속성, 오른쪽→왼쪽 언어, 모르는 type 처리 등 |
| `common_props` | 모든 블록 노드의 공통 키 `label`·`icon`·`variant`·`style` |
| `inline` | 글 조각의 키와 표시(mark) |
| `css_variables` | 기본 CSS 의 색·모서리 변수 (밝은·어두운 화면) |
| `layouts` | 권장 배치 — `place_card`(목록 카드), `place_detail`(상세 화면)에서 어느 속성을 어느 type 으로 묶는지 |
| `types` | type 48개 — `group`·`context`·`name`·`role`·`props`·`variants`·`html`·`css`·`flutter`·`example`·`used`. props 의 `translate: true` 는 언어마다 값이 다른 속성이다 |

`used` 는 지금 여행지에서 그 type 이 쓰인 횟수다(모든 언어가 같다). **0 이 아닌 30개부터 구현하면** 지금 데이터를 모두 그릴 수 있다. 나머지는 앞으로 쓰려고 미리 정한 것이다.

| group | type |
|-------|------|
| 구성 | `hero` `section` `tabs` `accordion` `collapse` `grid` `masonry` `carousel` `card` `stepper` `hr` |
| 글 | `title` `subtitle` `heading` `typography` `paragraph` `list` `blockquote` `alert` `caption` `badge` `tags` |
| 미디어 | `image` `figure` `avatar` `video` `youtube` `audio` `music` `map` |
| 데이터 | `table` `pricing` `chart` `rating` `level` |
| 값 | `date` `time` `duration` `price` `distance` `temperature` `address` `phone` `link` `place_link` `airport` `latitude` `longitude` |

그리는 코드는 type 으로 나누는 함수 하나면 된다.

```js
function render(node) {
  switch (node.type) {
    case 'paragraph': return `<p class="cdt-paragraph">${node.children.map(renderRun).join('')}</p>`;
    case 'tabs': return renderTabs(node.items);
    // … type 마다 하나씩
    default: // 모르는 type — 앱이 멈추지 않게 대체해서 그린다
      if (node.text) return `<p>${escape(node.text)}</p>`;
      if (node.children) return `<p>${node.children.map(renderRun).join('')}</p>`;
      if (node.blocks) return node.blocks.map(render).join('');
      return '';
  }
}
const renderRun = (r) => (r.type ? `<span class="cdt-${r.type}">${escape(r.text)}</span>` : escape(r.text));
```

**아랍어(`dir: "rtl"`)** 는 화면 전체를 오른쪽→왼쪽으로 그린다.

- 웹: `<html lang="ar" dir="rtl">` 을 주고, 여백·정렬은 `margin-inline-start`·`text-align: start` 같은 논리 속성으로 쓴다.
- Flutter: `Localizations` 가 있으면 자동이다. 없으면 `Directionality(textDirection: TextDirection.rtl)` 로 감싼다. 여백은 `EdgeInsetsDirectional` 로 쓴다.
- 금액·시각·IATA 코드는 방향을 바꾸지 않는다.

## 6. 클라이언트 업데이트 절차

1. **언어를 고른다.** 기기 언어가 `manifest.languages` 에 있으면 그 언어, 없으면 `fallback_language`(en)다. 사용자가 바꿀 수 있게 `meta.languages[].native` 로 목록을 보여 준다.
2. 처음 실행하면 `manifest.json` 을 받고, 이어서 `meta.json` 과 고른 언어의 `places.<언어>.json` 을 받는다. 받은 파일과 `version` 을 기기에 저장한다.
3. 앱 시작·포그라운드 복귀 때 `manifest.json` 을 받는다. 6시간에 한 번처럼 간격을 둔다.
4. `manifest.version` 이 저장된 값과 다르면 `meta.json` 과 저장해 둔 언어의 places 파일을 `?v=<version>` 을 붙여 받는다.
   - `schema`·`count` 를 확인하고, 받은 파일의 `version` 이 manifest 와 같은지 본 뒤 저장본을 **통째로** 바꾼다.
   - 삭제된 여행지도 이것으로 함께 반영된다.
   - `?v=` 를 붙이면 HTTP 캐시에 남은 옛 파일 대신 새 파일을 받는다.
5. 사용자가 언어를 바꾸면 그 언어의 places 파일을 받는다. 즐겨찾기·최근 본 곳은 `slug` 로 저장해 두면 언어를 바꿔도 그대로 이어진다.
6. 받거나 확인하는 도중 실패하면 저장된 내용을 그대로 쓴다.
7. 사진은 미리 받지 않는다. 화면에 보일 때 받아서 `url` 을 키로 디스크에 캐시한다.

## 7. 여행지 추가·수정

원본 언어(한국어)를 먼저 고치고, 번역을 따라 맞춘다. 번역 도구는 `scripts/i18n.mjs` 다.

1. `data/ko/` 의 JSON 과 `data/images/` 의 사진을 고친다 ([data/README.md](data/README.md) 규격).
2. **숫자·코드·사진만 바꿨다면:** `node scripts/i18n.mjs sync` 가 7개 언어 파일에 그 값을 옮긴다.
3. **글을 바꿨거나 여행지를 추가했다면:** 번역을 다시 만든다.
   1. `node scripts/i18n.mjs export <파일>` — 번역할 글을 `_i18n/src/<이름>.txt` 로 뽑는다.
   2. 언어마다 `_i18n/<언어>/<이름>.txt` 번역을 만든다. 형식·규칙은 [i18n/GUIDE.md](i18n/GUIDE.md), 고유명사·태그 표기는 `i18n/glossary/<언어>.json` 을 따른다.
   3. `node scripts/i18n.mjs import <언어> <파일>` — 번역을 검사해 `data/<언어>/` 에 쓴다.
4. `node <api-skill>/scripts/content.mjs stamp data/meta.json` 으로 `data_version`(가공한 UTC 시각)을 찍는다.
5. 저장소 루트에서 `node scripts/build.mjs` 로 규격을 검사하고, `node <api-skill>/scripts/content.mjs check --dir _site/v2` 로 배포 규격(8개 언어·사진·`data_version`)을 검사한다.
6. 커밋한 뒤 `node <api-skill>/scripts/r2.mjs deploy --dir _site/v2 --country ph` 로 R2 에 배포한다. 끝나면 공개 주소를 스스로 확인한다. 절차와 규칙은 api-skill 의 `references/pipeline.md` 에 있다.
7. GitHub 에는 push 하지 않는다 — 배포는 R2 뿐이다. 옛 주소(GitHub Pages)는 2026-10-01 판에서 멈췄다.

규격 검사에 실패하면 배포 도구가 아무것도 올리지 않는다. Actions 도 멈춰서 옛 주소에는 이전 내용이 그대로 남는다.

## 8. 바뀐 점

v1(마크다운 본문)은 2026-09-27 에 v2 로 바뀌었고 더 이상 배포하지 않는다. v1 을 쓰던 클라이언트는 없었다. v2 는 배포 전에 다국어 구조로 바뀌었다(같은 날).

| 항목 | v1 | v2 |
|------|----|----|
| 언어 | 한국어 | 8개 언어 — `places.<언어>.json` |
| 원본 | `data/*.md` (앞머리 + 마크다운) | `data/<언어>/*.json` (블록 노드) + `data/meta.json` |
| 속성 값 | 문자열·숫자 | `{ "type", … }` 노드. 분류·권역·지역은 언어 공통 key(`value`) |
| 본문 | `sections: [{ title, markdown }]` | `sections: [{ type: "section", key, title, icon, blocks }]` |
| 표시 방법 | 없음 | `meta.json` 의 `display` (예전 `content_display_type.json`) |
| 사진 | `{ url, credit, source }` | image 노드 + `alt`·`width`·`height` |
