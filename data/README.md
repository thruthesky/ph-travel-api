# 필리핀 여행지 — 여행지 JSON 작성 규격

- 여행지 원본: `data/ko/<번호 3자리>-<slug>.json` (예: `data/ko/030-vigan.json`) — 한국어가 원본 언어다.
- 번역본: `data/<언어>/<같은 이름>.json` — `en`·`zh`·`ja`·`th`·`vi`·`ru`·`ar` (7절)
- 사진: `data/images/<같은 이름>.webp`, 추가 사진은 `-2`, `-3` 을 붙인다. 모든 언어가 같은 사진을 쓴다.
- 기준 정보: `data/meta.json` — 지원 언어, 분류·권역·지역·난이도 목록(언어별 이름), 속성·단락의 이름표, 그리고 모든 노드의 `type` 과 그 type 이 가질 수 있는 키(`display.types`)가 여기에 정의돼 있다.

여행지를 추가·삭제해도 코드를 고칠 필요가 없다. 빌드 스크립트가 원본 언어 폴더의 번호로 시작하는 `.json` 파일을 모두 읽고, 다른 언어 폴더에 같은 이름의 번역본이 있는지 본다.
규격 검사는 저장소 루트에서 `node scripts/build.mjs` 로 한다. 하나라도 어기면 exit 1 로 끝나 배포되지 않는다.

## 1. 기본 원칙

1. **값은 노드다.** 여행지의 속성은 대부분 `{ "type": …, … }` 객체다.
   - `type` 이 표시 방법이다. 웹·앱은 이것을 보고 위젯을 고른다.
   - 노드가 가질 수 있는 키와 필수 키는 `meta.json` 의 `display.types.<type>.props` 에 있다. 빌드가 그대로 검사한다.
   - props 에 `translate: true` 가 붙은 키(글)만 언어마다 다르다. 나머지 키는 모든 언어가 같다.
   - 모든 블록 노드는 공통 키 `label`(이름표)·`icon`(Material Symbols 이름)·`variant`(모양 변형)·`style`(CSS)을 가질 수 있다.
2. **글은 조각(`children`)으로 쓴다.**
   - 한 덩어리 글을 순서대로 자른 배열이다. 조각의 `text` 를 이어 붙이면 원문이 된다.
   - 형식이 있는 값은 `type` 을 붙여 따로 자른다 (4절).
3. **마크다운을 쓰지 않는다.** `**굵게**`, `[글](주소)` 가 남아 있으면 빌드가 실패한다. 굵게는 `"bold": true`, 여행지 링크는 `place_link` 노드나 카드의 `place` 로 쓴다.
4. **파일 형식:** UTF-8, 들여쓰기 2칸, 파일 끝 줄바꿈 1개. 짧은 객체·배열은 한 줄에 써도 된다.

## 2. 속성 — 이 순서대로, 모두 필수

| 키 | type | 값 | 규칙 |
|----|------|----|------|
| `id` | 숫자 | `30` | 파일 이름의 번호와 같다 |
| `slug` | 문자열 | `"vigan"` | `^[a-z0-9-]+$`, 파일 이름과 같다 |
| `title` | `title` | `text` | 여행지 이름 |
| `title_en` | `subtitle` | `lang: "en"`, `text` | 영문 이름 |
| `tagline` | `typography` | `variant: "tagline"`, `text` | 20~32자 감성 카피, 마침표 없음 |
| `island_group` | `badge` | `label: "권역"`, `value`, `text` | `value` 는 `meta.island_groups` 의 key(`luzon`·`visayas`·`mindanao`), `text` 는 그 이름(루손·비사야·민다나오). 팔라완·민도로·롬블론은 루손 |
| `region` | `badge` | `label: "지역"`, `value`, `text` | `value` 는 `meta.regions` 의 key(`metro-manila`·`ilocos`·`palawan`·`cebu`·`bohol` … 39개), `text` 는 그 이름. 그 지역의 `island_group` 과 권역이 맞아야 한다 |
| `location` | `address` | `label: "위치"`, `icon: "location_on"`, `text` | 주(州)·도시 수준 위치 |
| `category` | `badge` | `label: "분류"`, `icon`, `value`, `text` | 아래 분류 7개 중 하나 — `value` 는 key, `icon`·`text` 는 그 분류의 것 |
| `tags` | `tags` | `label: "태그"`, `items` | 짧은 명사 3~6개 |
| `rating` | `rating` | `label: "추천도"`, `value`, `max: 5` | 4.0~5.0 소수 1자리 |
| `latitude` | `latitude` | `label: "위도"`, `value` | 소수 4자리, 4~22 |
| `longitude` | `longitude` | `label: "경도"`, `value` | 소수 4자리, 116~127 |
| `best_season` | `date` | `label: "여행 최적기"`, `icon: "calendar_month"`, `text`, `months` | `months` 는 해당 달(1~12)을 첫 기간의 시작 달부터 순서대로. 목적별 기간(서핑·해변 등)이 여럿이면 모두 합치고, 축제 달은 넣지 않는다. `연중` 이면 1~12 |
| `duration` | `duration` | `label: "여행 기간"`, `icon: "schedule"`, `text` | 반나절, 1박 2일, 2~3일 … |
| `budget` | `price` | `label: "예산"`, `icon: "payments"`, `text`, `currency: "PHP"`, `min`, `max` | 1인 기준, text 에 "약"을 붙인다. 1일이 아닌 기준(투어 1회, 리브어보드 등)은 text 끝 괄호에 적는다. min·max 는 text 의 ₱ 범위 |
| `difficulty` | `level` | `label: "난이도"`, `icon: "signal_cellular_alt"`, `text`, `value`, `max: 3` | 쉬움 1 · 보통 2 · 어려움 3 (접근성·체력 기준, `meta.difficulties`) |
| `airport` | `airport` | `label: "가까운 공항"`, `icon: "flight"`, `text`, `code` | text 는 `이름(코드)`, code 는 IATA 3자리 |
| `image` | `image` | `url`, `alt`, `credit`, `source` | 대표 사진 (5절) |
| `gallery` | `carousel` | `label: "사진"`, `items` | 추가 사진 image 노드 배열, 없으면 `[]` |
| `summary` | `paragraph` | `variant: "lead"`, `children` | 카드와 상세 상단의 2~3문장 요약 (100~160자) |
| `sections` | 배열 | section 노드 10개 | 3절 |

- **이름표(`label`)와 고정 아이콘은 `meta.fields` 에 언어별로 정해져 있다.** 위 표의 `label` 은 한국어 값이다. 빌드가 언어마다 같은지 검사한다.
- **분류·권역·지역·난이도의 글(`text`)은 `meta.json` 목록의 이름과 같아야 한다.** 거르기는 `value` 로 한다.

분류 (`meta.categories`):

| key | 한국어 | 영어 | icon |
|-----|--------|------|------|
| `beach` | 해변·섬 | Beaches & Islands | `beach_access` |
| `diving` | 다이빙·해양 | Diving & Marine Life | `scuba_diving` |
| `mountain` | 산·트레킹 | Mountains & Trekking | `hiking` |
| `water` | 폭포·호수·강 | Waterfalls, Lakes & Rivers | `water` |
| `heritage` | 역사·문화 | History & Culture | `account_balance` |
| `city` | 도시·미식 | Cities & Food | `location_city` |
| `nature` | 자연 경관 | Natural Scenery | `landscape` |

분류·지역을 새로 만들 때는 `meta.json` 의 목록에 key 와 8개 언어 이름을 먼저 넣는다.

## 3. 본문 — `sections`

단락 하나는 `{ "type": "section", "key": …, "title": …, "icon": …, "blocks": [ … ] }` 다. 아래 10개를 이 순서대로 모두 쓴다. key·icon·순서는 `meta.sections` 와 같고, title 은 `meta.sections[].title` 의 그 언어 문구 그대로다.

| key | title | icon | blocks 구성 |
|-----|-------|------|-------------|
| `overview` | 한눈에 보기 | `info` | `paragraph` 3~4개 — 왜 특별한지, 역사·지형·분위기, 어떤 여행자에게 맞는지 |
| `highlights` | 꼭 해봐야 할 것 | `star` | `grid`(`columns: 2`) 하나, 안에 `card` 6~8개 — `number`(1부터), `title`, `children`(2~3문장) |
| `itinerary` | 추천 일정 | `event_note` | `tabs` 하나 — 항목마다 `title`(1일차·반나절 코스 …), 선택 `subtitle`, `blocks` 에 `stepper`. 일정 길이는 duration 과 맞춘다 |
| `getting_there` | 가는 방법 | `directions` | `accordion` 하나 — 수단별 항목(`title`, `icon`), `blocks` 에 `list`·`paragraph`. 마닐라 출발 필수, 다른 출발지는 추가. 소요 시간·요금·현지 이동수단까지 |
| `best_time` | 여행 최적기와 날씨 | `wb_sunny` | `paragraph` — 건기·우기, 태풍 시기, 축제, 월별 특징. 그 뒤에 `table` 하나(`label: "시기별 한눈에 보기"`, `icon: "calendar_month"`, `columns: ["시기", "날씨", "여행 포인트"]`, 1년을 빠짐없이 나눈 행 3~5개) |
| `costs` | 예상 비용 | `payments` | `pricing` 하나(`currency: "PHP"`, `columns: ["항목", "예상 비용", "비고"]`, `items` 6~9개) + `caption` 「요금은 2026년 기준 대략치이며 현지 사정에 따라 달라질 수 있습니다.」 |
| `stay_and_food` | 숙소와 먹거리 | `restaurant` | `paragraph` — 숙박 지역·가격대, 대표 음식. 업소 이름은 오래 운영된 유명 업소만 |
| `tips` | 여행 팁 | `lightbulb` | `list`(`icon: "check_circle"`) 하나, 항목 6~10개 |
| `cautions` | 주의사항 | `warning` | 핵심 경고가 있으면 `alert`(`variant: "warning"`, `icon: "warning"`) 1개 + `list`(`icon: "error"`) 항목 4~6개 |
| `nearby` | 함께 가보면 좋은 곳 | `explore` | `grid`(`columns: 2`) 하나, 안에 `card` 3~5개 — `title`, `children`(거리·이동 시간과 한 줄 소개). 목록에 있는 곳은 `place: "<slug>"` 를 붙인다 |

- **stepper 항목:** `{ "time": "06:00", "children": [ … ] }`. time 은 `06:00`, `14:00~16:00`, `오전 8시`, `1일차 오후` 처럼 짧게 쓰고, 시각이 없는 항목은 time 을 뺀다. 일정 사이의 보충 설명은 같은 탭의 `paragraph` 로 둔다.
- **accordion 아이콘:** 비행기 `flight` · 배 `directions_boat` · 버스·밴 `directions_bus` · 지프니 `airport_shuttle` · 택시·그랩 `local_taxi` · 트라이시클 `electric_rickshaw` · 자가용·차량 `directions_car` · 경전철 `train` · 도보·트레킹 `directions_walk` · 투어 `tour` · 현지 이동 `commute` · 그 밖 `route`.
- **nearby 의 place:** 빌드가 slug 가 실제로 있는지, 자기 자신이 아닌지 검사한다.

## 4. 글 조각 — `children`

```json
"children": [
  { "text": "마닐라에서 약 " },
  { "type": "duration", "text": "7~9시간" },
  { "text": "이 걸리며, 요금은 일반 에어컨 버스 약 " },
  { "type": "price", "text": "₱900~1,200" },
  { "text": " 수준입니다." }
]
```

형식이 있는 값은 따로 잘라 type 을 붙인다. "약"·"편도" 같은 말은 조각 밖에 둔다.

| type | 예 |
|------|----|
| `price` | `₱900~1,200`, `₱50`, `US$100~150` |
| `time` | `06:00`, `18:30~19:30`, `오후 3시`, `오전 9시~오후 5시`, `6~7시` — 오전·오후·새벽·아침·저녁·밤은 조각 안에 넣는다 |
| `date` | `11월~5월`, `1월 22일`, `3월 말~4월`, `2026년`, `1896년 12월 30일` |
| `duration` | `7~9시간`, `1시간 30분~2시간`, `10~15분`, `1박 2일` |
| `distance` | `80~85km`, `2,926m` |
| `temperature` | `35℃`, `18~20℃` |
| `place_link` | 다른 여행지 — `{ "type": "place_link", "text": "엘니도", "slug": "el-nido" }` |
| `link` | 공식 사이트 — `{ "type": "link", "text": "공식 사이트", "url": "https://…" }` |

- 강조는 `{ "text": "…", "bold": true }` 로 쓴다(`italic`·`underline`·`strike` 도 있다).
- 빈 조각은 안 된다.

## 5. 사진

```json
"image": {
  "type": "image",
  "url": "images/030-vigan.webp",
  "alt": "비간",
  "credit": "Allan Jay Quesada / CC BY-SA 4.0 / Wikimedia Commons",
  "source": "https://commons.wikimedia.org/wiki/File:Allan_Jay_Quesada_-_Vigan_Cathedral_001.jpg"
}
```

- Wikimedia Commons 의 CC·퍼블릭 도메인 사진을 1080px WebP 로 줄여 쓴다.
- `credit`(작가 / 라이선스 / 출처)과 `source`(원본 페이지, `https://`)는 CC 라이선스의 저작자 표시 조건이라 반드시 적는다.
- `url` 은 이 폴더 기준 `images/[a-z0-9-]+\.webp` 형식이다. 빌드가 `?v=<사진 해시>` 와 `width`·`height` 를 붙여 내보낸다 — 직접 적지 않는다.
- `gallery.items` 에 같은 모양의 image 노드를 넣는다. 상세 화면에서 대표 사진 다음으로 넘겨 본다.
- **여행지마다 사진을 10장 이상 넣는다 — 대표 사진 1장 + `gallery` 9장 이상**(2026-10-02, 그전에는 3장).
  - 10장은 그곳을 여러 면에서 보여 준다 — 대표 전경, 다른 각도·시간의 전경, `highlights` 의 명소, 활동·체험, 그곳의 것이 분명한 음식·축제. 같은 구도를 여러 장 넣지 않는다.
  - 사진 파일 이름은 `<번호>-<slug>.webp`, `-2` … `-10` 처럼 이어 붙인다. gallery 사진의 `alt` 는 그 사진의 내용(예: `비간 대성당`)으로 쓰고, 번역본은 `scripts/i18n.mjs` 로 맞춘다.
  - 후보 찾기·받기는 api-skill 의 `content.mjs photos --id <번호>`·`content.mjs fetch` 로 한다. 받은 사진은 직접 열어 그곳·그 모습인지 확인한다.
  - 10장이 안 되는 여행지가 있으면 `content.mjs check` 와 R2 배포(`r2.mjs deploy`)가 막힌다. 옛 여행지(2026-10 보강 때 073번부터 대부분 3장으로 남음 — 보강한 73곳은 10장 안팎)를 채우는 동안 다른 고침을 내보낼 때만 `--allow-few-images` 를 쓴다.

## 6. 품질 기준

- 한국어로, 필리핀 한인 커뮤니티(필고)가 추천하는 친근하지만 정확한 여행 가이드 문체다. "~합니다"체로 통일한다.
- 본문(sections 의 보이는 글) 한글 기준 5,000~7,000자(2026-10 보강 기준 — 이전 규격은 3,500~6,000자). 짧고 뻔한 문장은 쓰지 않는다. 구체적 지명·거리·시간·요금·팁을 담는다. 빌드는 2,500자 이하면 실패한다.
- 사실 정확성이 최우선이다.
  - 확신이 없는 수치는 범위나 "약"으로 표현한다.
  - 자주 바뀌는 규정(입장 예약제·환경세·관광 제한)에는 "최신 공지를 확인" 안내를 붙인다.
  - 필요하면 WebSearch/WebFetch 로 확인한다.
- 이모지·HTML·마크다운 금지. 외부 링크는 공식 사이트가 확실할 때만 `link` 조각으로 쓴다.

## 7. 다른 언어 — 번역본

- 번역본은 원본(`data/ko/`)과 **모양이 같다**. 같은 속성·단락·블록을 같은 순서와 개수로 가진다.
  - 숫자·코드·slug·사진·`icon`·`variant`·`value` 는 원본과 같아야 한다.
  - 글(`translate: true` 인 키)과 `label` 만 그 언어로 쓴다.
  - 글 조각(`children`)은 어순에 맞게 다시 자르되, 값 조각(`price`·`time` …)의 종류와 개수는 원본과 같다.
  - `title_en` 은 모든 언어에서 원본과 같다.
- 번역본에는 한글이 남으면 안 된다. 본문이 원본에 비해 크게 짧으면(40% 미만) 빌드가 실패한다.
- 손으로 고치지 말고 번역 도구 `scripts/i18n.mjs` 를 쓴다.

| 할 일 | 명령 |
|-------|------|
| 원본의 숫자·코드·사진을 고친 뒤 번역본에 옮기기 | `node scripts/i18n.mjs sync` |
| 번역할 글 뽑기 | `node scripts/i18n.mjs export [파일…]` → `_i18n/src/<이름>.txt` |
| 번역 검사 | `node scripts/i18n.mjs check <언어> [파일…]` — `_i18n/<언어>/<이름>.txt` |
| 번역을 번역본으로 쓰기 | `node scripts/i18n.mjs import <언어> [파일…]` → `data/<언어>/<이름>.json` |
| 쓰기 형식 맞추기 | `node scripts/i18n.mjs format` |

- 번역 파일은 한 줄에 글 하나(`@번호 글`)이고, 값 조각은 `⟦type|글⟧` 로 쓴다.
- `link`·`place_link` 조각도 `⟦link|글⟧`·`⟦place_link|글⟧` 로 글만 번역한다. 주소(`url`)·여행지(`slug`)는 언어와 무관해서 도구가 원본의 같은 type 몇 번째 조각에서 옮긴다.
- price 조각의 숫자는 원문과 같아야 한다. 원본에 `₱100억` 처럼 한국어 단위를 쓰면 다른 언어가 같은 숫자로 옮길 수 없으니 `₱10,000,000,000` 처럼 숫자로 쓴다. 규칙은 [i18n/GUIDE.md](../i18n/GUIDE.md) 에 있다.
- 여행지 이름·지역·태그·공항 이름은 언어별 어휘집 `i18n/glossary/<언어>.json` 의 표기를 따른다.
- `_i18n/` 은 작업 폴더라 git 에 넣지 않는다.

## 8. 추천 모음 — `meta.json` 의 `destinations`·`monthly_picks`

앱 첫 화면의 「지역별 추천 베스트 10」과 「월별 추천 여행지」는 이 두 목록이 정한다. 여행지 파일은 고치지 않는다.

```json
"destinations": [
  {
    "key": "manila", "icon": "location_city", "latitude": 14.5995, "longitude": 120.9842,
    "name": { "en": "Manila", "ko": "마닐라", … 8개 언어 },
    "tagline": { "en": "Walled city, museums and easy day trips", "ko": "성곽 도시와 박물관, 근교 당일치기", … },
    "places": ["intramuros", "national-museum", "rizal-park", …]
  }
],
"monthly_picks": [
  { "month": 1, "places": ["cebu-city", "kalibo", "iloilo-city", "quiapo-church", "mount-pulag"] }
]
```

| 목록 | 규칙 (빌드가 검사) |
|------|-------------------|
| `destinations` | `key` 는 `[a-z0-9-]`, 겹치지 않는다. `icon` 은 Material Symbols 이름. 좌표는 필리핀 안. `name`·`tagline` 은 8개 언어 모두. `places` 는 있는 여행지 slug 5~10개, 겹치지 않는다. 순서가 곧 순위다 |
| `monthly_picks` | 1월부터 12월까지 12개, 차례대로. `places` 는 있는 여행지 slug 1~5개. **그 달이 그 여행지의 `best_season.months` 안이어야 한다** — 축제가 있어도 최적기가 아닌 달에는 넣지 않는다 |

- **지역은 행정 지역(`regions`)이 아니라 여행자가 묵는 거점이다.** 그곳에서 당일치기·짧은 이동으로 가는 곳을 함께 넣는다(앙헬레스·클락 → 피나투보·수빅, 두마게테 → 아포섬·시키호르·오슬롭). 한 여행지가 여러 지역에 들어가도 된다.
- **순서는 외국인 여행자가 많이 찾는 순서다.** 여행 플랫폼 순위(Trip.com·Tripadvisor 인용)·투어 상품 수·여행 매체를 2곳 이상 비교해 정한다.
- **월별 추천은 그 달에 가야 하는 까닭이 있는 곳이다** — 건기 해변, 고래상어·환도상어 철, 서핑 철, 계단식 논, 운해, 축제(시눌로그·아티아티한·파낙벵가·파히야스·카다야완·자이언트 랜턴). 한 여행지는 세 달까지만 넣는다.
- 근거(순위 비교·축제 날짜 출처)는 `sources/picks.json` 에 남긴다. 고칠 때마다 `content.mjs stamp data/meta.json` 으로 `data_version` 을 찍는다.

