# 여행 정보 API 계약과 클라이언트 절차

웹·앱·스크립트가 API 를 받아 쓰는 방법이다. 화면에 그리는 방법은 [rendering.md](rendering.md) 에 있다.

## 목차

1. 주소와 파일
2. manifest.json
3. places.json — 여행지 한 곳의 모양
4. 불변식 — 클라이언트가 믿어도 되는 것
5. 받기·업데이트 절차와 코드 (JS · Dart)
6. 나라별 API

## 1. 주소와 파일

| 나라 | 기본 주소 | 저장소 |
|------|-----------|--------|
| 필리핀 `ph` | `https://thruthesky.github.io/ph-travel-api/v2/` | `github.com/thruthesky/ph-travel-api` |

| 파일 | 내용 |
|------|------|
| `manifest.json` | 버전 확인용 작은 파일(약 200B). 클라이언트는 이것만 주기적으로 받는다 |
| `places.json` | 여행지 전체를 한 파일로 (필리핀 100곳, 1.9MB, gzip 전송 약 445KB) |
| `content_display_type.json` | 표시 방법 목록 — type 48개의 역할·규격·권장 HTML·CSS·Flutter (약 70KB) |
| `images/<이름>.webp` | 사진. JSON 의 `url` 로만 접근한다 |

- GitHub Pages 라서 모든 응답에 `Cache-Control: max-age=600` 과 `Access-Control-Allow-Origin: *` 가 붙는다.
  - push 한 내용이 클라이언트에 보이기까지 최대 10분 걸린다.
  - 다른 도메인의 웹에서도 바로 fetch 할 수 있다.
- JSON 은 `application/json; charset=utf-8`, 사진은 `image/webp` 로 내려온다.

## 2. manifest.json

```json
{ "schema": 2, "version": "d9130a8a7ecf", "count": 100, "places": "places.json",
  "content_display_type": "content_display_type.json", "generated_at": "2026-09-27T13:28:47.326Z" }
```

| 키 | 뜻 |
|----|----|
| `schema` | JSON 구조 번호. 호환되지 않게 바뀌면 경로가 `v3/` 으로 바뀌고 옛 경로는 한동안 남는다 |
| `version` | 내용 해시. **이 값이 바뀌었을 때만** 두 파일을 다시 받는다 |
| `count` | 여행지 수 |
| `places` · `content_display_type` | 두 파일 이름 (manifest 기준 상대 경로) |
| `generated_at` | 빌드 시각. 참고용 — 비교에 쓰지 않는다 |

## 3. places.json — 여행지 한 곳의 모양

`{ schema, version, count, places: [ … ] }` — `places` 는 `id` 오름차순이다.

```json
{
  "id": 30,
  "slug": "vigan",
  "title": { "type": "title", "text": "비간" },
  "title_en": { "type": "subtitle", "lang": "en", "text": "Vigan" },
  "tagline": { "type": "typography", "variant": "tagline", "text": "마차 소리 울리는 스페인 식민 시대의 돌길 도시" },
  "category": { "type": "badge", "label": "분류", "icon": "account_balance", "text": "역사·문화" },
  "best_season": { "type": "date", "label": "여행 최적기", "icon": "calendar_month", "text": "11월~5월 (건기)", "months": [11, 12, 1, 2, 3, 4, 5] },
  "budget": { "type": "price", "label": "예산", "icon": "payments", "text": "1인 약 ₱2,000~4,000 (1일)", "currency": "PHP", "min": 2000, "max": 4000 },
  "image": { "type": "image", "url": "images/030-vigan.webp?v=2869bd00", "alt": "비간", "credit": "Allan Jay Quesada / CC BY-SA 4.0 / Wikimedia Commons", "source": "https://commons.wikimedia.org/…", "width": 1080, "height": 719 },
  "sections": [
    { "type": "section", "key": "itinerary", "title": "추천 일정", "icon": "event_note", "blocks": [
      { "type": "tabs", "items": [ { "title": "1일차", "subtitle": "구시가지와 야경", "blocks": [
        { "type": "stepper", "items": [ { "time": "06:00", "children": [ { "text": "라오아그 공항 도착 …" } ] } ] }
      ] } ] }
    ] }
  ]
}
```

### 3.1 속성

| 키 | type | 쓰임 |
|----|------|------|
| `id` · `slug` | 숫자 · 문자열 | 식별자. `slug` 는 링크(`card.place`·`place_link.slug`)가 가리키는 값 |
| `title` | `title` | 여행지 이름 |
| `title_en` | `subtitle` | 영문 이름 |
| `tagline` | `typography` (tagline) | 감성 한 줄 카피 |
| `island_group` · `region` · `category` | `badge` | 권역(루손·비사야·민다나오)·지역·분류 — 목록 거르기 |
| `location` | `address` | 주·도시 수준 위치 |
| `tags` | `tags` | `items` 3~6개 |
| `rating` | `rating` | `value` 4.0~5.0, `max` 5 |
| `latitude` · `longitude` | `latitude` · `longitude` | `value` — 지도와 가까운 곳 계산 |
| `best_season` | `date` | `months`(1~12) 로 "지금 가기 좋은 곳" 거르기. 글의 모든 기간(목적별 포함)을 합친 달이고 축제 달은 빠진다 — 목적은 `text` 로 확인 |
| `duration` | `duration` | 여행 기간 (반나절, 1박 2일 …) |
| `budget` | `price` | 1인 예산. `min`·`max`(페소)로 거르기·정렬. 기준은 대개 1일이다. 다르면 `text` 끝 괄호에 적혀 있다(투어 1회, 6박 리브어보드 …) — 기준이 다른 곳끼리 단순 비교하지 않는다 |
| `difficulty` | `level` | 쉬움·보통·어려움 = `value` 1·2·3, `max` 3 |
| `airport` | `airport` | `code` 는 IATA 코드 |
| `image` | `image` | 대표 사진 |
| `gallery` | `carousel` | 추가 사진 `items` (없으면 `[]`) |
| `summary` | `paragraph` (lead) | 2~3문장 요약 |
| `sections` | `section` 10개 | 본문 |

분류 7개: 해변·섬, 다이빙·해양, 산·트레킹, 폭포·호수·강, 역사·문화, 도시·미식, 자연 경관.

### 3.2 본문 단락 — key·title·순서 고정

| key | title | 블록 |
|-----|-------|------|
| `overview` | 한눈에 보기 | `paragraph` |
| `highlights` | 꼭 해봐야 할 것 | `grid` + 번호 `card` |
| `itinerary` | 추천 일정 | `tabs` + `stepper` (+ 보충 `paragraph`) |
| `getting_there` | 가는 방법 | `accordion`(수단별, icon) + `list`·`paragraph` |
| `best_time` | 여행 최적기와 날씨 | `paragraph` |
| `costs` | 예상 비용 | `pricing` + `caption` |
| `stay_and_food` | 숙소와 먹거리 | `paragraph` |
| `tips` | 여행 팁 | `list` (icon) |
| `cautions` | 주의사항 | `alert`(warning) + `list` |
| `nearby` | 함께 가보면 좋은 곳 | `grid` + `card` (`place` = 다른 여행지 slug) |

### 3.3 글 조각 — `children`

글은 조각 배열이다. 조각의 `text` 를 차례로 이어 붙이면 원문이 된다.

```json
[ { "text": "마닐라에서 약 " }, { "type": "duration", "text": "7~9시간" }, { "text": ", 요금은 " }, { "type": "price", "text": "₱900~1,200" }, { "text": "입니다." } ]
```

- type 이 없는 조각은 일반 글이다.
- 지금 쓰이는 조각 type: `price`(₱·US$) · `time`(06:00, 오전 9시~오후 5시) · `date`(11월~5월, 2026년) · `duration`(7~9시간, 1박 2일) · `distance`(80km) · `temperature`(35℃).
- 규격에는 `bold`·`italic`·`underline`·`strike` 표시와 `place_link`·`link`·`phone` 조각도 있다.
- 글만 필요하면 `children.map(r => r.text).join('')` 로 원문을 얻는다.

### 3.4 사진

- `url` 은 `images/030-vigan.webp?v=2869bd00` 처럼 **places.json 이 있는 폴더 기준 상대 경로**다. 기본 주소에 이어 붙인다.
- `?v=` 는 사진 파일의 sha256 앞 8자리다. 사진이 바뀌면 주소도 바뀌므로 주소를 키로 오래 캐시해도 된다.
- `width`·`height` 로 사진이 오기 전에 비율 자리를 잡는다.
- **`credit`·`source` 는 CC 라이선스의 저작자 표기라서 화면에 반드시 보여야 한다.** 사진 URL 을 답변에 쓸 때도 저작자를 함께 적는다.

## 4. 불변식 — 클라이언트가 믿어도 되는 것

1. **`version` 은 내용 해시다.** `sha256(JSON.stringify([places, 표시 방법 목록]))` 앞 12자리.
   - 세 파일의 version 은 언제나 같다. 같은 내용이면 어디서 빌드해도 같다.
   - 문서·스크립트만 고친 배포는 version 이 그대로다.
2. **값은 노드다.** 여행지 속성(`id`·`slug`·`sections` 제외)은 `{ "type": … }` 객체이고, 속성마다 type 이 정해져 있다(§3.1).
3. **노드의 키 규격은 `content_display_type.json` 의 `types.<type>.props` 다.** 빌드가 모든 노드를 이 규격으로 검사하므로 필수 키는 반드시 있다.
4. **`sections` 는 10개, key·title·순서 고정이다.**
5. **링크는 반드시 있는 여행지를 가리킨다.** `card.place`·`place_link.slug` — 빌드가 보장한다.
6. **사진 url 은 상대 경로 + 내용 해시다.** 호스팅을 옮겨도 기본 주소만 바꾸면 된다.
7. **type·키 추가는 호환된다.** 클라이언트는 모르는 type·키를 무시하거나 대체해서 그려야 한다(rendering.md §2).
   키 삭제·이름 변경·형식 변경은 `schema` 를 올리고 경로를 `v3/` 로 바꾼다.

## 5. 받기·업데이트 절차와 코드

1. 처음 실행하면 `manifest.json` 을 받고, 이어서 `places.json`·`content_display_type.json` 을 받는다. 받은 파일과 `version` 을 기기에 저장한다.
2. 앱 시작·포그라운드 복귀 때 `manifest.json` 을 받는다 (예: 6시간 간격).
3. `manifest.version` 이 저장된 값과 다르면 두 파일을 `?v=<version>` 을 붙여 받는다.
   - `?v=` 는 HTTP 캐시에 남은 옛 파일 대신 새 파일을 받게 한다.
   - `schema`·`count` 와 두 파일의 `version` 이 manifest 와 같은지 확인한 뒤 저장본을 **통째로** 바꾼다. 삭제된 여행지도 이것으로 반영된다.
4. 받거나 확인하는 도중 실패하면 저장된 내용을 그대로 쓴다.
5. 사진은 미리 받지 않는다. 화면에 보일 때 받아 `url` 을 키로 디스크에 캐시한다.

### 5.1 JavaScript (웹 — Cache API 에 저장, 없으면 저장 없이)

```js
export const PH_BASE = 'https://thruthesky.github.io/ph-travel-api/v2/';
const SCHEMA = 2;

/** 저장본의 version 이 manifest 와 같으면 저장본을, 다르면 새로 받아 돌려준다. 받지 못하면 저장본. */
export async function loadTravel(base = PH_BASE) {
  if (!base.endsWith('/')) base += '/';
  const key = `${base}__travel-bundle`; // Cache API 키는 http(s) 주소여야 한다
  // Cache API 는 https·localhost 에서만 있다. 없으면 저장 없이 받기만 한다.
  const cache = globalThis.caches ? await caches.open('travel-api').catch(() => null) : null;
  const saved = await cache?.match(key).then((r) => r?.json()).catch(() => null);
  const get = async (url) => {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.json();
  };
  try {
    const m = await get(`${base}manifest.json`);
    if (m.schema !== SCHEMA) throw new Error(`schema ${m.schema} — 앱 업데이트 필요`);
    if (saved?.version === m.version) return saved;
    const v = `?v=${m.version}`;
    const [p, cdt] = await Promise.all([get(base + m.places + v), get(base + m.content_display_type + v)]);
    if (p.version !== m.version || cdt.version !== m.version || p.count !== m.count || p.places.length !== m.count) {
      throw new Error('version·count 불일치 — 배포 중일 수 있다');
    }
    const bundle = { base, version: m.version, places: p.places, cdt };
    await cache?.put(key, new Response(JSON.stringify(bundle))).catch(() => {});
    return bundle;
  } catch (e) {
    if (saved) return saved;
    throw e;
  }
}
```

- 사진 주소는 `bundle.base + image.url` 이다. 렌더러에는 `{ base: bundle.base }` 로 넘긴다.
- 페이지를 다른 주소(로컬 서버 등)로 시험할 때는 CORS 에 주의한다. GitHub Pages 는 `Access-Control-Allow-Origin: *` 를 주지만 `python3 -m http.server` 는 주지 않는다 — [rendering.md](rendering.md) §5.2.

### 5.2 Dart (Flutter — `http` 패키지와 앱 문서 폴더)

```dart
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

const phBase = 'https://thruthesky.github.io/ph-travel-api/v2/';

/// 저장된 번들(dir/travel.json)을 쓰고, manifest.version 이 다를 때만 새로 받는다. 받지 못하면 저장본.
Future<Map<String, dynamic>> loadTravel(Directory dir, {String base = phBase}) async {
  final file = File('${dir.path}/travel.json');
  final saved = await file.exists() ? jsonDecode(await file.readAsString()) as Map<String, dynamic> : null;
  Future<Map<String, dynamic>> get(String url) async {
    final res = await http.get(Uri.parse(url));
    if (res.statusCode != 200) throw HttpException('HTTP ${res.statusCode} $url');
    return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>; // 헤더 charset 과 무관하게 UTF-8
  }

  try {
    final m = await get('${base}manifest.json');
    if (m['schema'] != 2) throw StateError('schema ${m['schema']} — 앱 업데이트 필요');
    if (saved != null && saved['version'] == m['version']) return saved;
    final v = '?v=${m['version']}';
    final [p, cdt] = await Future.wait([get('$base${m['places']}$v'), get('$base${m['content_display_type']}$v')]);
    final places = p['places'] as List;
    if (p['version'] != m['version'] || cdt['version'] != m['version'] || p['count'] != m['count'] || places.length != m['count']) {
      throw StateError('version·count 불일치 — 배포 중일 수 있다');
    }
    final bundle = {'base': base, 'version': m['version'], 'places': places, 'cdt': cdt};
    await file.writeAsString(jsonEncode(bundle));
    return bundle;
  } catch (_) {
    if (saved != null) return saved;
    rethrow;
  }
}
```

- 오프라인 첫 실행을 위해 places.json 스냅샷 하나를 앱 번들에 넣어 두고, 저장본이 없을 때 그것을 쓰는 방법도 있다.

### 5.3 이 스킬의 조회 도구 — `scripts/travel.mjs`

위 절차를 그대로 구현한 Node 스크립트다. 캐시는 `~/.cache/travel-api-skill/<나라>/` 에 둔다.

```bash
node scripts/travel.mjs info                              # version·count·캐시 상태
node scripts/travel.mjs values                            # 거르기에 쓸 수 있는 값과 개수
node scripts/travel.mjs list --month 12 --category 해변 --sort rating
node scripts/travel.mjs show vigan --section itinerary,costs
node scripts/travel.mjs search 고래상어
node scripts/travel.mjs near vigan --limit 5              # 또는 near 10.31,123.88
node scripts/travel.mjs types stepper                     # type 규격
node scripts/travel.mjs show vigan --json                 # 가공하지 않은 노드
node scripts/travel.mjs list --base /path/to/ph-travel-api/_site/v2   # 로컬 빌드 결과로
```

## 6. 나라별 API

- 나라 목록은 `scripts/apis.json` 이다. 도구의 `--country <코드>` 로 고른다(기본 `ph`).
- 새 나라는 같은 구조의 저장소(예: `jp-travel-api`)로 만들고 `apis.json` 에 한 줄을 더한다 — 절차는 [maintain.md](maintain.md) §9.
- 나라마다 속성 값 목록(권역·분류)·좌표 범위·통화는 달라도 된다.
  노드 모양·`content_display_type`·단락 구조는 같게 유지해 같은 렌더러로 그린다.
