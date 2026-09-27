# 화면 그리기 — 표시 방법(meta.display)과 참고 렌더러

여행지 JSON 을 웹·앱 화면으로 그리는 방법이다. 데이터는 제품에 넣어 둔 것을 쓴다([embedding.md](embedding.md)). 파일 모양은 [api.md](api.md) 에 있다.

## 목차

1. 표시 방법(meta.json 의 display)의 구조
2. 그리는 규칙 — 노드 자리, 글 조각, 모르는 type
3. 지금 쓰이는 type 30개와 권장 위젯
4. 권장 배치 — layouts
5. 웹 참고 렌더러 `assets/renderer.mjs`
6. Flutter 참고 렌더러 `assets/travel_blocks.dart`
7. 자주 틀리는 것

## 1. 표시 방법(meta.json 의 display)의 구조

예전 `content_display_type.json` 이 `meta.json` 의 `display` 로 들어갔다. 모양은 같다.

| 키 | 내용 |
|----|------|
| `rules` | 그리는 규칙 문장 |
| `common_props` | 모든 블록 노드의 공통 키 — `type` · `label`(이름표) · `icon`(Material Symbols 이름) · `variant`(모양 변형) · `style`(CSS 선언 객체) |
| `style_properties` | `style` 에 쓸 수 있는 CSS 속성 — color, background-color, font-size, font-weight, font-style, text-decoration, text-align |
| `inline` | 글 조각의 키 — `text`(필수) · `type` · `bold` · `italic` · `underline` · `strike` · `style` |
| `prop_kinds` | props 값 종류 — string, number, integer, boolean, url, slug, strings, numbers, integers, rows, runs, node, blocks, items |
| `groups` | layout(구성) · text(글) · media(미디어) · data(데이터) · value(값) |
| `css_variables` | 기본 CSS 의 색·모서리 변수 (`--cdt-*`, 밝은·어두운 화면) |
| `layouts` | 권장 배치 — `place_card`, `place_detail` (§4) |
| `types` | type 48개 — `group` · `context` · `name` · `role` · `props` · `variants` · `html` · `css` · `flutter` · `example` · `used` |

- `props.<키>` 는 `{ kind, required?, translate?, min?, enum?, types?, item?, description }` 다. 빌드가 이 규격으로 모든 노드를 검사한다. 그래서 문서와 데이터가 어긋나지 않는다.
- `translate: true` 인 prop 만 언어마다 값이 다르다(text·title·children·alt·tags 의 items·pricing 의 label·price·note …). 나머지(icon·variant·url·place·value …)는 모든 언어가 같다. 그래서 한 렌더러가 어느 언어 파일이든 그린다.
- `badge` 에는 언어 공통 key 인 `value` 가 있다(분류 `beach`, 권역 `visayas`, 지역 `cebu`). 거르기·링크·CSS 클래스에는 `value` 를, 화면 글에는 `text` 를 쓴다.
- `used` 는 원본(ko) 파일에서 쓰인 횟수다(빌드가 센다). 0 인 type 은 앞으로 쓰려고 미리 정한 것이다.
- 한 type 의 규격을 볼 때: `node scripts/travel.mjs types <type> [--css]`

## 2. 그리는 규칙

1. **노드 자리 두 가지.**
   - block: 여행지 속성 값, `blocks` 배열의 원소, 다른 노드의 node 속성(예: `hero.image`).
   - inline: `children` 배열의 글 조각.
   - type 마다 `context` 에 쓸 수 있는 자리가 적혀 있다. 값 type(date·price …)은 둘 다 된다.
2. **`children`** 은 글 한 덩어리를 순서대로 자른 조각 배열이다. 이어 붙이면 원문이다. type 이 있는 조각만 따로 꾸민다(`<span class="cdt-price">` / `TextSpan(style: …)`).
3. **`blocks`** 는 블록 노드 배열, **`items`** 는 type 없는 항목 객체 배열이다. 항목 모양은 props 의 `item` 에 있다.
4. **모르는 type** 은 앱이 멈추지 않게 대체해서 그린다.
   - `text` 가 있으면 글로 그린다.
   - `children` 이 있으면 문단으로 그린다.
   - `blocks` 가 있으면 안의 블록을 차례로 그린다.
   - 그 밖에는 건너뛴다. 모르는 키는 무시한다.
5. **아이콘**은 Material Symbols 이름이다. Flutter 는 `Icons.<이름>`, 웹은 Material Symbols 글꼴을 쓴다.
6. **디자인은 자유**다. `html`·`css`·`flutter` 는 권장안이다. 다만 `role`(역할)은 지킨다.
7. **언어와 글 방향.** 화면 글은 그 언어 파일의 `text`·`title`·`label` 을 그대로 쓴다(번역돼 있다). 아랍어(`ar`)는 오른쪽→왼쪽이라 감싸는 요소에 `dir="rtl"`(웹)·`Directionality(rtl)`(Flutter)을 준다. places 파일의 `dir` 과 `meta.languages[].dir` 에 적혀 있다.
8. **사진의 `credit`·`source` 는 반드시 보인다** (CC 라이선스 조건).
   - 히어로·캐러셀·목록 카드·링크 카드의 사진도 모두 해당한다.
   - 카드 전체가 링크(`<a>`)면 안에 source 링크를 겹칠 수 없다. 그때는 credit 글만 사진 모서리에 보이고, source 링크는 상세 화면의 사진에서 준다.

## 3. 지금 쓰이는 type 30개와 권장 위젯

| type | 쓰이는 곳 | 웹 | Flutter |
|------|-----------|----|---------|
| `section` | sections 10개 | `<section><h2>` | Column(제목 Row + Divider + 블록) |
| `tabs` | 추천 일정 | tablist + tabpanel (항목 1개면 제목만) | ChoiceChip 줄 + 선택된 blocks |
| `accordion` | 가는 방법 | `<details name>` 묶음, 첫 항목 펼침 | ExpansionTile |
| `grid` | 꼭 해봐야 할 것·함께 가보면 좋은 곳 | CSS grid, 좁으면 1열 | LayoutBuilder + Wrap |
| `card` | grid 안 | `<article>`, place 있으면 `<a>` | Card + InkWell(onPlaceTap) |
| `stepper` | 일정 | `<ol>` 세로선 + 시각 칩 | Row(점·선, 시각 칩 + Text.rich) |
| `carousel` | gallery | scroll-snap 가로 스크롤 | PageView(viewportFraction .88) |
| `title` · `subtitle` · `typography` | 이름·영문명·카피 | `<h1>` · `<p lang>` · 세리프 카피 | Text(headline/title) |
| `paragraph` (lead) | 본문·요약 | `<p>` | Text.rich |
| `list` (icon) | 팁·주의사항·교통 | `<ul data-icon>` | Row(Icon, Text.rich) |
| `alert` (warning) | 주의사항 핵심 경고 | `<aside role=note>` 색 상자 | Container(연한 배경 + 왼쪽 선) |
| `caption` | 비용 안내 | `<small>` | bodySmall |
| `badge` · `tags` | 분류·권역·지역·태그 | 둥근 라벨 · 칩 | Chip |
| `image` | 대표·추가 사진 | `<figure><img width height>` + credit | AspectRatio + Image.network + credit |
| `pricing` | 예상 비용 | 표(금액 열 강조), 좁으면 행 카드 | Row(항목, 금액) + 비고 |
| `rating` · `level` | 추천도·난이도 | 별 + 숫자 · `<meter>` | 별 Icon · 막대 |
| `address` · `date` · `duration` · `price` · `airport` · `latitude` · `longitude` | 속성 값 | 정보 칸(아이콘 + label + 값) | 정보 칸 Container |
| `time` · `date` · `duration` · `price` · `distance` · `temperature` | 글 조각 | 강조 span | TextSpan style |

미사용 18개(hero, collapse, masonry, hr, heading, blockquote, figure, avatar, video, youtube, audio, music, map, table, chart, phone, link, place_link)도 두 렌더러에 기본 구현이 있다. hero·map 은 layouts 에서 속성을 모아 그릴 때 쓴다.

## 4. 권장 배치 — layouts

`meta.display.layouts` 는 여행지 속성을 어느 type 으로 묶어 어떤 순서로 그릴지 정한다.

- **place_card (목록 카드):** image(16:10, 모서리에 credit) → category 배지 → title → tagline(2줄) → rating → region
- **place_detail (상세 화면):**
  1. hero — image 배경에 title·title_en·tagline 을 겹친다
  2. carousel — gallery (items 가 비면 생략)
  3. 배지·태그 — category·island_group·region·tags
  4. rating
  5. summary
  6. 정보 칸 grid — location·best_season·duration·budget·difficulty·airport
  7. map — latitude·longitude
  8. sections 10개 — key·title 로 목차나 탭을 만들 수 있다

## 5. 웹 참고 렌더러 — `assets/renderer.mjs`

외부 패키지 없는 ES 모듈이다. 브라우저와 Node 에서 돈다.

| 내보내는 것 | 하는 일 |
|-------------|---------|
| `FONT_LINKS` | 아이콘(Material Symbols)과 tagline 글꼴(Noto Serif KR) `<link>` — `<head>` 에 넣는다. 없으면 아이콘 자리에 `account_balance` 같은 글자가 보인다 |
| `catalogCss(meta)` | css_variables + 모든 type 의 css + 정보 칸·저작자 표기·`.cdt-root`·오른쪽→왼쪽 CSS 를 한 문자열로. `meta.json` 전체나 그 `display` 를 받는다. `export` 가 이것을 미리 `travel.css` 로 써 둔다 |
| `renderRuns(runs, ctx)` | 글 조각 → HTML (모든 글 이스케이프) |
| `renderBlock(node, ctx)` | 블록 노드 → HTML, 48개 type + 대체 규칙 |
| `renderPlace(place, ctx)` | 상세 화면 (layouts.place_detail) — `<article class="cdt-root cdt-place">` |
| `renderPlaceCard(place, ctx)` | 목록 카드 (layouts.place_card) — 카드 전체가 링크, 저작자 글은 사진 모서리 |
| `enhance(root)` | innerHTML 로 넣은 뒤 한 번 부른다 — 탭 클릭·좌우 방향키 |

`ctx` = `{ base, places?, placeHref?, lang?, dir? }`
- `base`: 사진 상대 경로의 기준. 끝 `/` 는 없어도 된다.
- `lang`·`dir`: 상세 화면 `<article>` 의 `lang`·`dir` — 아랍어는 `dir: 'rtl'`.
- `places`: 링크 카드에 그 여행지 사진·저작자를 보여 줄 때 쓴다.
- `placeHref(slug)`: 여행지 링크 주소. 기본은 `#/place/<slug>` 해시 라우팅이다.

### 5.1 페이지에 붙이기

`travel-db.mjs export --out public/travel` 로 넣어 둔 폴더(manifest·meta·places.<lang>.json·images/·travel.css·renderer.js)를 쓴다.

```js
import { FONT_LINKS, renderPlace, renderPlaceCard, enhance } from '/travel/renderer.js';

const m = await (await fetch('/travel/manifest.json')).json();
const lang = m.places[navigator.language.slice(0, 2)] ? navigator.language.slice(0, 2) : m.fallback_language;
const { places, dir } = await (await fetch(`/travel/${m.places[lang]}?v=${m.version}`)).json();
document.head.insertAdjacentHTML('beforeend', `${FONT_LINKS}<link rel="stylesheet" href="/travel/travel.css?v=${m.version}">`);
document.body.classList.add('cdt-root');                // 글자·배경색 — 없으면 어두운 화면에서 글이 안 보인다
document.documentElement.lang = lang;
document.documentElement.dir = dir;
const ctx = { base: '/travel/', places, lang, dir };

function route() {
  const slug = decodeURIComponent(location.hash.match(/^#\/place\/(.+)$/)?.[1] ?? '');
  const place = places.find((p) => p.slug === slug);
  root.innerHTML = place
    ? `<a href="#/">← 목록</a>${renderPlace(place, ctx)}`
    : `<div class="cdt-grid" style="--cols:3">${places.map((p) => renderPlaceCard(p, ctx)).join('')}</div>`;
  enhance(root);
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
```

- 권역·분류 거르기는 언어 공통 key 로 한다: `places.filter((p) => p.island_group.value === 'visayas')`. 메뉴 이름은 `meta.island_groups[].name[lang]` 이다.
- PHP 사이트는 목록을 서버가 그리고 상세만 이 렌더러로 그린다 — `assets/travel-page.php`([embedding.md](embedding.md) §3.4).
- 해시 라우팅을 쓰면 단락 목차를 `#overview` 링크로 만들지 않는다. 라우터가 그것을 경로로 읽는다. 대신 `document.getElementById('overview').scrollIntoView()` 를 쓴다(section 의 id 는 key 다).
- 필고 웹처럼 Web Awesome 을 쓰는 곳에서는 탭을 `<wa-tab-group>`, 알림을 `<wa-callout variant="warning">` 로 바꿔 끼우면 된다. 데이터 모양은 그대로다.

### 5.2 로컬에서 시험할 때 — CORS

넣어 둔 파일을 쓰면 같은 출처라 CORS 문제가 없다. 원격 API 주소를 직접 시험할 때만 해당한다. GitHub Pages 는 `Access-Control-Allow-Origin: *` 를 주지만, `python3 -m http.server` 는 주지 않는다. 그래서 페이지와 API 를 다른 포트로 띄우면 브라우저가 JSON 을 막는다. 두 가지 방법이 있다.

1. **같은 출처로 띄우기** — `export` 한 폴더를 페이지와 같은 서버에 둔다(권장).
2. **CORS 헤더를 주는 서버로 API 띄우기:**

```bash
cd _site && python3 -c "
import http.server as h
class H(h.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*'); super().end_headers()
h.ThreadingHTTPServer(('127.0.0.1', 8765), H).serve_forever()"
```

### 5.3 핵심 모양 — type 으로 나누고, 모르는 type 은 대체한다

```js
export function renderBlock(b, ctx = {}) {
  switch (b.type) {
    case 'section': return `<section id="${esc(b.key)}" class="cdt-section"><h2>${icon(b.icon)}${esc(b.title)}</h2>${blocks(b.blocks, ctx)}</section>`;
    case 'paragraph': return `<p class="cdt-paragraph${b.variant ? ` cdt-paragraph--${esc(b.variant)}` : ''}">${renderRuns(b.children, ctx)}</p>`;
    case 'stepper': return `<ol class="cdt-stepper">${b.items.map((it) => `<li>${it.time ? `<time>${esc(it.time)}</time>` : ''}<p>${renderRuns(it.children, ctx)}</p></li>`).join('')}</ol>`;
    // … 48개 type
    default:
      if (b.text !== undefined) return `<p>${esc(b.text)}</p>`;
      if (b.children) return `<p>${renderRuns(b.children, ctx)}</p>`;
      if (b.blocks) return blocks(b.blocks, ctx);
      return '';
  }
}
```

- **안전:** 모든 글은 이스케이프한다. 링크·사진 주소는 `safe()` 가 http(s)·tel·mailto·상대 경로만 통과시킨다. `javascript:`·`data:` 는 `#` 이 된다.
- **결정성:** 같은 입력이면 같은 HTML 이 나온다. 아코디언·탭 id 는 난수가 아니라 제목의 해시로 만든다. 그래서 스냅샷 테스트를 할 수 있다.

### 5.4 검증 (2026-09-27)

- 100곳 상세·목록 카드와 48개 type 예시를 예외 없이 그렸다.
- 사진 293장 모두 credit·source 링크가 있다. 링크 카드 340장에는 대상 여행지 사진의 credit 이 있다.
- 글 조각이 빠짐없이 들어갔다. 같은 입력이면 출력이 같다. 위험한 주소는 막았다. 목록 카드 안의 `<a>` 는 하나뿐이다.
- 1100px·358px 폭에서 넘침이 없다. 탭 클릭 전환을 화면 캡처로 확인했다.
- 스킬 지침만 보고 목록(권역 거르기)과 상세 화면을 만드는 시험을 했다. 여기서 찾은 결함(카드 저작자 누락, 받기 코드 빈틈, 어두운 화면 글자색, 글꼴 안내, CORS)을 고쳤다.
- (2026-09-28) 실제 빌드 형식의 8개 언어 × 100곳(800번)을 `catalogCss(meta)`·`renderPlace`·`renderPlaceCard` 로 오류 없이 그렸고, 모든 사진 저작자가 들어갔다.
- (2026-09-28) 다국어 시험 데이터로 `export` 한 폴더와 `travel-page.php` 를 PHP 내장 서버에 띄워 확인했다. 목록은 서버 HTML·`travel.css`, 상세는 `renderer.js` 로 그려졌고, 아랍어 상세가 오른쪽→왼쪽으로 그려지는 것을 화면 캡처로 확인했다.

## 6. Flutter 참고 렌더러 — `assets/travel_blocks.dart`

`flutter/material.dart` 만 쓰는 파일 하나다. 모델 클래스 없이 JSON(Map)을 그대로 그린다. 그래서 type·키가 늘어도 깨지지 않는다. 데이터는 `assets/travel_db.dart` 의 `TravelDb.place(slug, lang)` 가 돌려주는 Map 을 넘긴다([embedding.md](embedding.md) §4).

```dart
final blocks = TravelBlocks(
  baseUrl: 'https://thruthesky.github.io/ph-travel-api/v2/',
  places: places,                                  // 링크 카드에 그 여행지 사진을 보여 줄 때
  onPlaceTap: (slug) => context.push('/place/$slug'),
  onLinkTap: (url) => launchUrl(Uri.parse(url)),   // 사진 원본·지도·외부 링크
);
SingleChildScrollView(child: blocks.place(context, placeJson));   // 상세 화면
blocks.block(context, node);                                       // 블록 하나
Text.rich(blocks.runs(context, node['children']));                 // 글 조각
```

| 멤버 | 하는 일 |
|------|---------|
| `place(context, p)` | 상세 화면 (layouts.place_detail) — hero · carousel · 배지 · 요약 · 정보 칸 · 지도 · sections |
| `block(context, node)` | 블록 노드 → 위젯, 48개 type + 대체 규칙 |
| `blocks(context, list)` | 블록 배열 → Column |
| `runs(context, children)` | 글 조각 → TextSpan. place_link·link·phone 은 누를 수 있는 WidgetSpan |
| (저작자 표기) | 히어로·캐러셀·사진·링크 카드 모두 credit 을 보인다. 누르면 `onLinkTap(source)` |
| `iconData(name)` | Material Symbols 이름 → `Icons.*` (데이터가 쓰는 38개) |

핵심 모양:

```dart
Widget block(BuildContext context, Json b) {
  switch (b['type']) {
    case 'paragraph':
      return Text.rich(runs(context, b['children']), style: text.bodyMedium?.copyWith(height: 1.75));
    case 'tabs':
      return _Tabs(node: b, blocks: this);          // 선택 상태가 있어 StatefulWidget
    case 'accordion':
      return Column(children: [for (final (i, it) in items.indexed) Card(child: ExpansionTile(…, initiallyExpanded: i == 0))]);
    // … 48개 type
    default:                                         // 모르는 type — 대체해서 그린다
      if (b['text'] is String) return Text(b['text']);
      if (b['children'] is List) return Text.rich(runs(context, b['children']));
      if (b['blocks'] is List) return blocks(context, b['blocks']);
      return const SizedBox.shrink();
  }
}
```

- 실제 앱에서 바꿔 끼울 곳:
  - 사진 → `cached_network_image` 로 url 을 키로 캐시
  - 지도 → `flutter_map`
  - 링크 → `url_launcher`
  - 차트 → `fl_chart`
  - 영상·소리 → `video_player` · `just_audio`
- 오른쪽→왼쪽 언어: 여백·테두리·저작자 위치를 방향 기준(`EdgeInsetsDirectional`·`BorderDirectional`·`PositionedDirectional`)으로 잡았다. `Directionality(textDirection: TextDirection.rtl)` 안에서 그리면 뒤집힌다.
- 필고 앱에 넣을 때는 공용 라이브러리(`apps/lib/src/travel/`)에 두고 앱마다 복사하지 않는다.
- 검증(2026-09-28, Flutter 3.47):
  - `flutter analyze` 0건.
  - 위젯 테스트 5개 통과 — 100곳을 390·900px 폭에서 예외 없이 그리기, 탭 전환, 48개 type 예시 그리기, 대표 사진·링크 카드의 저작자 표기, 아랍어 100곳을 오른쪽→왼쪽으로 그리기.

## 7. 자주 틀리는 것

- **사진 credit 을 빼먹는다.** 히어로·캐러셀·목록 카드·링크 카드 모두 저작자 표기를 보여야 한다. 검증할 때 예외만 보지 말고 credit 글이 실제로 나오는지 확인한다.
- **글자·배경색을 안 정한다.** CSS 변수는 어두운 화면에서 글자를 밝게 바꾼다. 페이지(`body` 나 감싸는 요소)에 `.cdt-root` 를 붙이지 않으면 흰 배경에 흰 글이 된다.
- **글꼴을 안 넣는다.** `FONT_LINKS` 가 없으면 아이콘 자리에 이름 글자가 보인다.
- **아랍어에 `dir` 을 안 준다.** 글은 오른쪽 정렬되지 않고 타임라인·알림 상자의 선이 반대쪽에 붙는다. `ctx.dir`·`<html dir>`·`Directionality` 를 준다.
- **거르기에 `text` 를 쓴다.** `text` 는 언어마다 다르다. 분류·권역·지역은 `value`, 난이도는 `value`(1~3), 달은 `months` 로 거른다.
- **`children` 을 문자열로 착각한다.** 배열이다. 글만 필요하면 `text` 를 이어 붙인다.
- **탭 항목이 1개인 일정** (반나절 코스 등). 탭 막대 없이 제목만 보여 준다.
- **gallery.items 가 빈 여행지**가 있다. 캐러셀을 그리지 않는다.
- **사진 비율이 제각각**이다. 캐러셀 높이는 한 비율로 잡고 cover 로 자른다. 저작자 표기는 한 줄로 줄인다.
- **긴 금액 글**(`1인 약 ₱3,000~6,000 (1일 기준)`) 을 줄바꿈 금지로 두면 칸을 넘친다. 줄바꿈 금지는 글 안의 짧은 금액에만 쓴다.
- **`stepper` 항목에 time 이 없는 것**이 섞여 있다. time 칩 없이 글만 그린다.
