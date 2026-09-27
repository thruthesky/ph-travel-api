# ph-travel-api

필리핀 여행지 100선을 JSON 으로 제공하는 정적 API 다. 서버 코드는 없다.

- `main` 에 push 하면 GitHub Actions 가 `data/` 를 검사·빌드해 GitHub Pages 에 배포한다.
- 기본 주소: `https://thruthesky.github.io/ph-travel-api/v2/`
- 원본: `data/*.json` (작성 규격 [data/README.md](data/README.md)), 표시 방법 목록 `data/content_display_type.json`, 사진 `data/images/*.webp`
- 빌드: `node scripts/build.mjs` → `_site/v2/` (외부 패키지 없음, Node 만 필요)

여행 정보는 화면에 바로 그릴 수 있는 **블록 JSON** 이다. 모든 값에 `type`(content_display_type)이 붙어 있어서, 웹·앱은 type 마다 알맞은 위젯(히어로·탭·아코디언·카드·타임라인·비용표·별점 …)을 골라 그리면 된다. type 의 뜻과 권장 HTML·CSS·Flutter 위젯은 `content_display_type.json` 에 함께 내려간다.

## 0. AI 스킬 — travel-api-skill

Claude Code 에 `travel-api-skill` 을 설치하면 AI 가 이 API 를 잘 쓴다.

- 여행 질문에 데이터로 답한다 — 추천·일정·비용·가는 방법·가까운 곳.
- 웹·Flutter 앱에서 받기·저장·그리기 코드를 만든다. 참고 렌더러가 들어 있다.
- 이 저장소의 여행지 추가·검사·배포를 돕는다.

스킬 원본은 [skills/travel-api-skill](skills/travel-api-skill/SKILL.md) 이다.

**설치 — 모든 프로젝트에서 쓰기 (사용자 스킬).** 터미널에 붙여 넣는다.

```bash
mkdir -p ~/.claude/skills && curl -fsSL https://thruthesky.github.io/ph-travel-api/skills/travel-api-skill.tar.gz | tar -xz -C ~/.claude/skills
```

**설치 — 한 프로젝트에서만 쓰기 (프로젝트 스킬).** 그 프로젝트 폴더에서 실행한다.

```bash
mkdir -p .claude/skills && curl -fsSL https://thruthesky.github.io/ph-travel-api/skills/travel-api-skill.tar.gz | tar -xz -C .claude/skills
```

**Claude Code 에게 설치를 맡길 때** — 아래 문장을 대화창에 붙여 넣는다.

```text
https://thruthesky.github.io/ph-travel-api/skills/travel-api-skill.tar.gz 를 받아 ~/.claude/skills 에 풀어서 travel-api-skill 스킬을 설치해 줘. 설치 뒤 ~/.claude/skills/travel-api-skill/SKILL.md 가 있는지 확인해 줘.
```

설치한 뒤 Claude Code 를 다시 시작하면 스킬이 잡힌다.

| 사용 | 예 |
|------|----|
| 요청 | `/travel-api-skill 12월에 가기 좋은 해변 세 곳 추천해 줘` |
| 요청 | `/travel-api-skill 세부에서 가까운 곳과 2박 3일 일정 짜 줘` |
| 요청 | `/travel-api-skill Flutter 앱에서 여행지 상세 화면을 만들어 줘` |
| 최신으로 갱신 | `/travel-api-skill update` |

- `update` 는 위 묶음을 다시 받아 설치된 스킬 폴더를 통째로 바꾼다. 이 저장소 안의 원본에는 `git pull` 을 안내한다.
- 조회 도구 `scripts/travel.mjs` 는 Node 18 이상이 필요하다. 받은 JSON 은 `~/.cache/travel-api-skill/` 에 캐시한다.
- 이 저장소를 연 Claude Code 에서는 설치하지 않아도 [.claude/skills/travel-api-skill](.claude/skills/travel-api-skill/SKILL.md) 입구로 바로 쓸 수 있다.

## 1. 파일

| 주소 | 내용 |
|------|------|
| `v2/manifest.json` | 버전 확인용 작은 파일. 클라이언트는 이것만 주기적으로 받는다 |
| `v2/places.json` | **여행지 100곳 전체를 한 파일로** (약 1.9MB, 전송 때 gzip 으로 약 450KB) |
| `v2/content_display_type.json` | 표시 방법 목록 — type 48개의 역할·데이터 모양·권장 HTML·CSS·Flutter 위젯·예시 (약 70KB) |
| `v2/images/<이름>.webp` | 사진. JSON 의 `url` 로만 접근한다 |
| `skills/travel-api-skill.tar.gz` | AI 스킬 설치·업데이트 묶음 (§0). API 가 아니라서 `v2/` 밖에 있다 |

GitHub Pages 는 모든 응답에 `Cache-Control: max-age=600` 과 `Access-Control-Allow-Origin: *` 를 붙인다.

- push 한 내용이 클라이언트에 보이기까지 최대 10분 걸릴 수 있다.
- 다른 도메인의 웹에서도 바로 불러 쓸 수 있다.

## 2. manifest.json

```json
{
  "schema": 2,
  "version": "d9130a8a7ecf",
  "count": 100,
  "places": "places.json",
  "content_display_type": "content_display_type.json",
  "generated_at": "2026-09-27T12:05:56.130Z"
}
```

| 키 | 뜻 |
|----|----|
| `schema` | JSON 구조 번호. 호환되지 않게 바뀌면 경로가 `v3/` 로 바뀐다 |
| `version` | 내용 해시. **이 값이 바뀌었을 때만** `places.json` 과 `content_display_type.json` 을 다시 받는다. 문서만 고친 push 에서는 바뀌지 않는다 |
| `count` | 여행지 수 |
| `places` · `content_display_type` | 두 파일의 이름 (manifest 기준 상대 경로) |
| `generated_at` | 빌드 시각. 참고용이며 비교에 쓰지 않는다 |

## 3. places.json

```json
{ "schema": 2, "version": "d9130a8a7ecf", "count": 100, "places": [ { … }, … ] }
```

여행지는 `id` 오름차순이다. 한 곳의 모양은 다음과 같다(줄임).

```json
{
  "id": 30,
  "slug": "vigan",
  "title": { "type": "title", "text": "비간" },
  "title_en": { "type": "subtitle", "lang": "en", "text": "Vigan" },
  "tagline": { "type": "typography", "variant": "tagline", "text": "마차 소리 울리는 스페인 식민 시대의 돌길 도시" },
  "category": { "type": "badge", "label": "분류", "icon": "account_balance", "text": "역사·문화" },
  "rating": { "type": "rating", "label": "추천도", "value": 4.7, "max": 5 },
  "best_season": { "type": "date", "label": "여행 최적기", "icon": "calendar_month", "text": "11월~5월 (건기)", "months": [11, 12, 1, 2, 3, 4, 5] },
  "budget": { "type": "price", "label": "예산", "icon": "payments", "text": "1인 약 ₱2,000~4,000 (1일)", "currency": "PHP", "min": 2000, "max": 4000 },
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

### 3.1 속성과 type

| 키 | type | 쓰임 |
|----|------|------|
| `id` · `slug` | 숫자 · 문자열 | 식별자. `slug` 는 링크(`place`·`place_link`)가 가리키는 값 |
| `title` | `title` | 여행지 이름 |
| `title_en` | `subtitle` | 영문 이름 |
| `tagline` | `typography` (tagline) | 감성 한 줄 카피 |
| `island_group` · `region` · `category` | `badge` | 권역·지역·분류 — 목록 거르기 |
| `location` | `address` | 주·도시 수준 위치 |
| `tags` | `tags` | `items` 3~6개 |
| `rating` | `rating` | `value` 4.0~5.0, `max` 5 |
| `latitude` · `longitude` | `latitude` · `longitude` | `value` — 두 값으로 지도(`map`)를 그리고 가까운 곳을 계산한다 |
| `best_season` | `date` | `months` 로 "지금 가기 좋은 곳"을 거른다 |
| `duration` | `duration` | 여행 기간 |
| `budget` | `price` | `min`·`max`(페소)로 예산 거르기·정렬 |
| `difficulty` | `level` | `value` 1~3, `max` 3 |
| `airport` | `airport` | `code` 는 IATA 코드 |
| `image` | `image` | 대표 사진 |
| `gallery` | `carousel` | 추가 사진 `items` (없으면 `[]`) |
| `summary` | `paragraph` (lead) | 2~3문장 요약 |
| `sections` | `section` 배열 | 본문 10단락 (3.2) |

`label`(이름표)과 `icon`(Material Symbols 이름)이 붙은 값은 "아이콘 + 이름표 + 값" 정보 칸으로 그리면 된다.

### 3.2 본문 단락

| key | title | 주로 쓰는 블록 |
|-----|-------|----------------|
| `overview` | 한눈에 보기 | `paragraph` |
| `highlights` | 꼭 해봐야 할 것 | `grid` + 번호 `card` |
| `itinerary` | 추천 일정 | `tabs` + `stepper` |
| `getting_there` | 가는 방법 | `accordion` (수단별, 아이콘) + `list` |
| `best_time` | 여행 최적기와 날씨 | `paragraph` |
| `costs` | 예상 비용 | `pricing` + `caption` |
| `stay_and_food` | 숙소와 먹거리 | `paragraph` |
| `tips` | 여행 팁 | `list` (아이콘) |
| `cautions` | 주의사항 | `alert` (warning) + `list` |
| `nearby` | 함께 가보면 좋은 곳 | `grid` + 링크 `card` (`place` = 다른 여행지 slug) |

### 3.3 글 조각 — `children`

글은 조각 배열로 온다. 조각의 `text` 를 차례로 이어 붙이면 원문이 된다. `type` 이 없는 조각은 일반 글이다. type 이 있는 조각은 그 값만 따로 꾸민다. 예를 들어 금액은 굵은 강조색으로, 시간은 옅은 배경으로 그린다.

```json
[ { "text": "마닐라에서 약 " }, { "type": "duration", "text": "7~9시간" }, { "text": ", 요금은 " }, { "type": "price", "text": "₱900~1,200" }, { "text": "입니다." } ]
```

지금 데이터에 쓰이는 조각 type 은 `price` · `time` · `date` · `duration` · `distance` · `temperature` 다. `bold`·`italic`·`underline`·`strike` 표시와 `place_link`·`link` 도 규격에 있다.

### 3.4 사진

- `url` 은 `images/030-vigan.webp?v=2869bd00` 처럼 **places.json 이 있는 폴더 기준 상대 경로**다.
  - `https://thruthesky.github.io/ph-travel-api/v2/` 에 이어 붙여 쓴다.
  - `?v=` 는 사진 내용 해시라서 사진이 바뀌면 주소도 바뀐다. 주소를 키로 삼아 오래 캐시해도 된다.
- `width`·`height` 로 사진이 오기 전에 비율 자리를 잡는다.
- 저작자 표기(`credit`·`source`)는 CC 라이선스 조건이라서 화면에 반드시 보여야 한다.

## 4. content_display_type.json

웹·앱이 JSON 을 그릴 때 참고하는 표시 방법 목록이다.

| 키 | 내용 |
|----|------|
| `rules` | 그리는 규칙 — 노드 자리(block·inline), 조각, 모르는 type 처리 등 |
| `common_props` | 모든 블록 노드의 공통 키 `label`·`icon`·`variant`·`style` |
| `inline` | 글 조각의 키와 표시(mark) |
| `css_variables` | 기본 CSS 의 색·모서리 변수 (밝은·어두운 화면) |
| `layouts` | 권장 배치 — `place_card`(목록 카드), `place_detail`(상세 화면)에서 어느 속성을 어느 type 으로 묶는지 |
| `types` | type 48개 — `group`·`context`·`name`·`role`·`props`·`variants`·`html`·`css`·`flutter`·`example`·`used` |

`used` 는 지금 places.json 에서 그 type 이 쓰인 횟수다. **0 이 아닌 30개부터 구현하면** 지금 데이터를 모두 그릴 수 있다. 나머지는 앞으로 쓰려고 미리 정한 것이다.

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

## 5. 클라이언트 업데이트 절차

1. 처음 실행하면 `manifest.json` 을 받고, 이어서 `places.json` 과 `content_display_type.json` 을 받는다. 받은 파일과 `version` 을 기기에 저장한다.
2. 앱 시작·포그라운드 복귀 때 `manifest.json` 을 받는다. 6시간에 한 번처럼 간격을 둔다.
3. `manifest.version` 이 저장된 값과 다르면 두 파일을 `?v=<version>` 을 붙여 받는다.
   - `schema` 와 `count` 를 확인하고, 두 파일의 `version` 이 manifest 와 같은지 본 뒤 저장본을 **통째로** 바꾼다.
   - 삭제된 여행지도 이것으로 함께 반영된다.
   - `?v=` 를 붙이면 HTTP 캐시에 남은 옛 파일 대신 새 파일을 받는다.
4. 받거나 확인하는 도중 실패하면 저장된 내용을 그대로 쓴다.
5. 사진은 미리 받지 않는다. 화면에 보일 때 받아서 `url` 을 키로 디스크에 캐시한다.

## 6. 여행지 추가·수정

1. `data/` 의 JSON 과 사진을 고친다 ([data/README.md](data/README.md) 규격).
2. 저장소 루트에서 `node scripts/build.mjs` 로 규격을 검사한다.
3. 커밋하고 `main` 에 push 하면 1~2분 뒤 배포된다. 진행 상황은 저장소의 Actions 탭에서 본다.

규격 검사에 실패하면 Actions 가 멈추고, 이전에 배포된 내용이 그대로 남는다.

## 7. v1 에서 바뀐 점

v1(마크다운 본문)은 2026-09-27 에 v2 로 바뀌었고 더 이상 배포하지 않는다. v1 을 쓰던 클라이언트는 없었다.

| 항목 | v1 | v2 |
|------|----|----|
| 원본 | `data/*.md` (앞머리 + 마크다운) | `data/*.json` (블록 노드) |
| 속성 값 | 문자열·숫자 | `{ "type", … }` 노드 |
| 본문 | `sections: [{ title, markdown }]` | `sections: [{ type: "section", key, title, icon, blocks }]` |
| 표시 방법 | 없음 | `content_display_type.json` |
| 사진 | `{ url, credit, source }` | image 노드 + `alt`·`width`·`height` |
