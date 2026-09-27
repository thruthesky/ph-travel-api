# 필리핀 여행 100선 — 여행지 JSON 작성 규격

- 여행지: `data/<번호 3자리>-<slug>.json` (예: `030-vigan.json`)
- 사진: `data/images/<같은 이름>.webp`, 추가 사진은 `-2`, `-3` 을 붙인다.
- 표시 방법 목록: `data/content_display_type.json` — 모든 노드의 `type` 과 그 type 이 가질 수 있는 키가 여기에 정의돼 있다.

여행지를 추가·삭제해도 코드를 고칠 필요가 없다. 빌드 스크립트가 번호로 시작하는 `.json` 파일을 모두 읽는다.
규격 검사는 저장소 루트에서 `node scripts/build.mjs` 로 한다. 하나라도 어기면 exit 1 로 끝나 배포되지 않는다.

## 1. 기본 원칙

1. **값은 노드다.** 여행지의 속성은 대부분 `{ "type": …, … }` 객체다.
   - `type` 이 content_display_type 이다. 웹·앱은 이것을 보고 위젯을 고른다.
   - 노드가 가질 수 있는 키와 필수 키는 `content_display_type.json` 의 `types.<type>.props` 에 있다. 빌드가 그대로 검사한다.
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
| `island_group` | `badge` | `label: "권역"`, `text` | 루손·비사야·민다나오 (팔라완·민도로·롬블론은 루손) |
| `region` | `badge` | `label: "지역"`, `text` | 지방·섬 이름 (메트로 마닐라, 일로코스, 팔라완, 세부, 보홀 …) |
| `location` | `address` | `label: "위치"`, `icon: "location_on"`, `text` | 주(州)·도시 수준 위치 |
| `category` | `badge` | `label: "분류"`, `icon`, `text` | 아래 분류 7개 중 하나, icon 은 분류와 짝 |
| `tags` | `tags` | `label: "태그"`, `items` | 짧은 명사 3~6개 |
| `rating` | `rating` | `label: "추천도"`, `value`, `max: 5` | 4.0~5.0 소수 1자리 |
| `latitude` | `latitude` | `label: "위도"`, `value` | 소수 4자리, 4~22 |
| `longitude` | `longitude` | `label: "경도"`, `value` | 소수 4자리, 116~127 |
| `best_season` | `date` | `label: "여행 최적기"`, `icon: "calendar_month"`, `text`, `months` | `months` 는 해당 달(1~12)을 첫 기간의 시작 달부터 순서대로. 목적별 기간(서핑·해변 등)이 여럿이면 모두 합치고, 축제 달은 넣지 않는다. `연중` 이면 1~12 |
| `duration` | `duration` | `label: "여행 기간"`, `icon: "schedule"`, `text` | 반나절, 1박 2일, 2~3일 … |
| `budget` | `price` | `label: "예산"`, `icon: "payments"`, `text`, `currency: "PHP"`, `min`, `max` | 1인 기준, text 에 "약"을 붙인다. 1일이 아닌 기준(투어 1회, 리브어보드 등)은 text 끝 괄호에 적는다. min·max 는 text 의 ₱ 범위 |
| `difficulty` | `level` | `label: "난이도"`, `icon: "signal_cellular_alt"`, `text`, `value`, `max: 3` | 쉬움 1 · 보통 2 · 어려움 3 (접근성·체력 기준) |
| `airport` | `airport` | `label: "가까운 공항"`, `icon: "flight"`, `text`, `code` | text 는 `이름(코드)`, code 는 IATA 3자리 |
| `image` | `image` | `url`, `alt`, `credit`, `source` | 대표 사진 (5절) |
| `gallery` | `carousel` | `label: "사진"`, `items` | 추가 사진 image 노드 배열, 없으면 `[]` |
| `summary` | `paragraph` | `variant: "lead"`, `children` | 카드와 상세 상단의 2~3문장 요약 (100~160자) |
| `sections` | 배열 | section 노드 10개 | 3절 |

분류와 아이콘:

| category | icon |
|----------|------|
| 해변·섬 | `beach_access` |
| 다이빙·해양 | `scuba_diving` |
| 산·트레킹 | `hiking` |
| 폭포·호수·강 | `water` |
| 역사·문화 | `account_balance` |
| 도시·미식 | `location_city` |
| 자연 경관 | `landscape` |

## 3. 본문 — `sections`

단락 하나는 `{ "type": "section", "key": …, "title": …, "icon": …, "blocks": [ … ] }` 다. 아래 10개를 이 순서대로 모두 쓴다(key·title 문구 그대로).

| key | title | icon | blocks 구성 |
|-----|-------|------|-------------|
| `overview` | 한눈에 보기 | `info` | `paragraph` 3~4개 — 왜 특별한지, 역사·지형·분위기, 어떤 여행자에게 맞는지 |
| `highlights` | 꼭 해봐야 할 것 | `star` | `grid`(`columns: 2`) 하나, 안에 `card` 6~8개 — `number`(1부터), `title`, `children`(2~3문장) |
| `itinerary` | 추천 일정 | `event_note` | `tabs` 하나 — 항목마다 `title`(1일차·반나절 코스 …), 선택 `subtitle`, `blocks` 에 `stepper`. 일정 길이는 duration 과 맞춘다 |
| `getting_there` | 가는 방법 | `directions` | `accordion` 하나 — 수단별 항목(`title`, `icon`), `blocks` 에 `list`·`paragraph`. 마닐라 출발 필수, 다른 출발지는 추가. 소요 시간·요금·현지 이동수단까지 |
| `best_time` | 여행 최적기와 날씨 | `wb_sunny` | `paragraph` — 건기·우기, 태풍 시기, 축제, 월별 특징 |
| `costs` | 예상 비용 | `payments` | `pricing` 하나(`currency: "PHP"`, `columns: ["항목", "예상 비용", "비고"]`, `items` 6~9개) + `caption` 「요금은 2026년 기준 대략치이며 현지 사정에 따라 달라질 수 있습니다.」 |
| `stay_and_food` | 숙소와 먹거리 | `restaurant` | `paragraph` — 숙박 지역·가격대, 대표 음식. 업소 이름은 오래 운영된 유명 업소만 |
| `tips` | 여행 팁 | `lightbulb` | `list`(`icon: "check_circle"`) 하나, 항목 6~10개 |
| `cautions` | 주의사항 | `warning` | 핵심 경고가 있으면 `alert`(`variant: "warning"`, `icon: "warning"`) 1개 + `list`(`icon: "error"`) 항목 4~6개 |
| `nearby` | 함께 가보면 좋은 곳 | `explore` | `grid`(`columns: 2`) 하나, 안에 `card` 3~5개 — `title`, `children`(거리·이동 시간과 한 줄 소개). 100선에 있는 곳은 `place: "<slug>"` 를 붙인다 |

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

## 6. 품질 기준

- 한국어로, 필리핀 한인 커뮤니티(필고)가 추천하는 친근하지만 정확한 여행 가이드 문체다. "~합니다"체로 통일한다.
- 본문(sections 의 보이는 글) 한글 기준 3,500~6,000자. 짧고 뻔한 문장은 쓰지 않는다. 구체적 지명·거리·시간·요금·팁을 담는다. 빌드는 2,500자 이하면 실패한다.
- 사실 정확성이 최우선이다.
  - 확신이 없는 수치는 범위나 "약"으로 표현한다.
  - 자주 바뀌는 규정(입장 예약제·환경세·관광 제한)에는 "최신 공지를 확인" 안내를 붙인다.
  - 필요하면 WebSearch/WebFetch 로 확인한다.
- 이모지·HTML·마크다운 금지. 외부 링크는 공식 사이트가 확실할 때만 `link` 조각으로 쓴다.
