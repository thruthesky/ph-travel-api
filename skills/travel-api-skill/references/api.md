# 여행 정보 API 계약 — 파일·필드·다국어·받기

API 가 내보내는 파일과 그 모양이다. **웹·앱은 이 파일을 개발 때 받아 제품에 넣어(임베딩) 쓴다** — [embedding.md](embedding.md). SQLite 로 바꾸는 방법은 [database.md](database.md), 화면에 그리는 방법은 [rendering.md](rendering.md) 에 있다.

## 목차

1. 주소와 파일
2. manifest.json
3. meta.json — 언어·분류 목록·속성·단락·표시 방법
4. places.<lang>.json — 여행지 한 곳의 모양
5. 불변식 — 믿어도 되는 것
6. 받기 — 개발 때(기본)와 실행 중(선택)
7. 조회 도구 `scripts/travel.mjs`
8. 나라별 API

## 1. 주소와 파일

| 나라 | 기본 주소 | 저장소 |
|------|-----------|--------|
| 필리핀 `ph` | `https://thruthesky.github.io/ph-travel-api/v2/` | `github.com/thruthesky/ph-travel-api` |

| 파일 | 내용 |
|------|------|
| `manifest.json` | 버전·언어 목록·파일 이름 (약 400B). 데이터가 바뀌었는지 이것만 보고 안다 |
| `meta.json` | 지원 언어, 다국어 분류·권역·지역·난이도 목록, 속성·단락 규격, 표시 방법(display — type 48개) |
| `places.<lang>.json` | 그 언어의 여행지 100곳 전체. 8개 언어 — `en` `zh` `ja` `ko` `th` `vi` `ru` `ar` |
| `images/<이름>.webp` | 사진 293장 (언어 공통) |

- 언어는 폴더가 아니라 파일 이름으로 나눈다. 그래서 사진 url `images/…` 가 어느 언어 파일에서나 같은 폴더 기준으로 맞는다.
- 원본 언어는 `ko`(한국어), 대체 언어는 `en` 이다. 원하는 언어가 없으면 대체 언어를 쓴다.
- `zh` 는 간체(`zh-Hans`), `ar` 은 오른쪽→왼쪽(`dir: "rtl"`)이다.
- GitHub Pages 라서 모든 응답에 `Cache-Control: max-age=600` 과 `Access-Control-Allow-Origin: *` 가 붙는다. JSON 은 `application/json; charset=utf-8`, 사진은 `image/webp` 이다.

## 2. manifest.json

```json
{
  "schema": 2,
  "version": "a1b2c3d4e5f6",
  "count": 100,
  "source_language": "ko",
  "fallback_language": "en",
  "languages": ["en", "zh", "ja", "ko", "th", "vi", "ru", "ar"],
  "meta": "meta.json",
  "places": { "en": "places.en.json", "zh": "places.zh.json", "…": "…", "ar": "places.ar.json" },
  "generated_at": "2026-09-28T01:00:00.000Z"
}
```

| 키 | 뜻 |
|----|----|
| `schema` | JSON 구조 번호. 호환되지 않게 바뀌면 경로가 `v3/` 로 바뀐다 |
| `version` | **전체 내용에 하나인 해시.** `sha256(JSON.stringify([meta, 언어 순서대로 places 배열들]))` 앞 12자리. meta·places 파일 모두 같은 값을 가진다. 이 값이 바뀌었을 때만 다시 받는다 |
| `count` | 여행지 수 (모든 언어가 같다) |
| `source_language` · `fallback_language` | 원본 언어(ko) · 대체 언어(en) |
| `languages` | 지원 언어 코드 — 이 순서가 version 계산 순서다. 번역 중인 언어는 빠진다(대체 언어로 보여 준다) |
| `meta` · `places` | 파일 이름 (manifest 기준 상대 경로). `places` 는 언어 코드 → 파일 이름 |
| `generated_at` | 빌드 시각. 참고용 — 비교에 쓰지 않는다 |

## 3. meta.json

```json
{
  "schema": 2, "version": "a1b2c3d4e5f6", "title": "…", "description": "…",
  "source_language": "ko", "fallback_language": "en",
  "languages": [{ "code": "ar", "locale": "ar", "name": "Arabic", "native": "العربية", "dir": "rtl" }, "…"],
  "categories": [{ "key": "beach", "icon": "beach_access", "name": { "en": "…", "ko": "해변·섬", "…": "…" } }, "…"],
  "island_groups": [{ "key": "visayas", "name": { "…": "…" } }, "…"],
  "regions": [{ "key": "cebu", "island_group": "visayas", "name": { "…": "…" } }, "…"],
  "difficulties": [{ "value": 1, "key": "easy", "name": { "…": "…" } }, "…"],
  "fields": { "budget": { "type": "price", "label": { "…": "…" }, "icon": "payments", "role": "…" }, "…": "…" },
  "sections": [{ "key": "overview", "icon": "info", "title": { "ko": "한눈에 보기", "…": "…" } }, "…"],
  "display": { "rules": ["…"], "common_props": {}, "inline": {}, "css_variables": "…", "layouts": {}, "types": {} }
}
```

| 키 | 쓰임 |
|----|------|
| `languages` | 언어 선택 메뉴 — `native`(그 언어로 쓴 이름), `locale`, `dir`(ltr·rtl) |
| `categories` | 분류 7개 — key: `beach` `diving` `mountain` `water` `heritage` `city` `nature`, `icon`, 언어별 `name` |
| `island_groups` | 권역 3개 — `luzon` `visayas` `mindanao` |
| `regions` | 지역 32개 — `metro-manila` `cebu` `palawan` … , 속한 `island_group` |
| `difficulties` | 난이도 3개 — `value` 1·2·3, key `easy` `moderate` `hard` |
| `fields` | 여행지 속성마다의 type·언어별 label·icon·값 목록(`values`)·역할 |
| `sections` | 본문 단락 10개 — key·icon·언어별 제목, 순서 고정 |
| `display` | 표시 방법 — 예전 `content_display_type.json`. type 48개의 규격(props)·역할·권장 HTML·CSS·Flutter·예시·`used` |

- `display.types.<type>.props.<키>.translate: true` 는 언어마다 값이 다른 prop 이다 (text·title·children·alt·tags 의 items·columns·rows·pricing 의 label·price·note 등). 나머지 prop 은 모든 언어가 같다.
- `used` 는 원본(ko) 기준으로 그 type 이 쓰인 횟수다.

## 4. places.<lang>.json — 여행지 한 곳의 모양

`{ schema, version, lang, dir, count, places: [ … ] }` — `places` 는 `id` 오름차순이다.

```json
{
  "id": 30,
  "slug": "vigan",
  "title": { "type": "title", "text": "비간" },
  "title_en": { "type": "subtitle", "lang": "en", "text": "Vigan" },
  "category": { "type": "badge", "label": "분류", "icon": "account_balance", "value": "heritage", "text": "역사·문화" },
  "region": { "type": "badge", "label": "지역", "value": "ilocos", "text": "일로코스" },
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

### 4.1 속성

| 키 | type | 쓰임 |
|----|------|------|
| `id` · `slug` | 숫자 · 문자열 | 식별자 — 모든 언어가 같다. 링크(`card.place`·`place_link.slug`)는 slug 를 가리킨다 |
| `title` | `title` | 여행지 이름 (그 언어) |
| `title_en` | `subtitle` | 영문 이름 — 모든 언어가 같다 |
| `tagline` | `typography` (tagline) | 감성 한 줄 카피 |
| `island_group` · `region` · `category` | `badge` | **`value` 가 언어 공통 key**(거르기·링크에 쓴다), `text` 는 그 언어 이름 |
| `location` | `address` | 주·도시 수준 위치 |
| `tags` | `tags` | `items` 3~6개 (그 언어) |
| `rating` | `rating` | `value` 4.0~5.0, `max` 5 |
| `latitude` · `longitude` | `latitude` · `longitude` | `value` — 지도, 가까운 곳 |
| `best_season` | `date` | `months`(1~12) — 글의 모든 기간(목적별 포함)을 합친 달, 축제 달은 빠짐. 목적은 `text` 로 확인 |
| `duration` | `duration` | 여행 기간 |
| `budget` | `price` | 1인 예산. `min`·`max`(페소)로 거르기·정렬. 기준은 대개 1일이고, 다르면 `text` 끝 괄호에 적혀 있다(투어 1회, 6박 리브어보드 …) — 기준이 다른 곳끼리 단순 비교하지 않는다 |
| `difficulty` | `level` | `value` 1·2·3 이 key 역할, `max` 3, `text` 는 그 언어 이름 |
| `airport` | `airport` | `code` 는 IATA 코드 |
| `image` · `gallery` | `image` · `carousel` | 대표 사진·추가 사진 (없으면 `items: []`) |
| `summary` | `paragraph` (lead) | 2~3문장 요약 |
| `sections` | `section` 10개 | 본문 — key·순서 고정, 제목은 그 언어 |

### 4.2 본문 단락

| key | 블록 |
|-----|------|
| `overview` | `paragraph` |
| `highlights` | `grid` + 번호 `card` |
| `itinerary` | `tabs` + `stepper` (+ 보충 `paragraph`) |
| `getting_there` | `accordion`(수단별, icon) + `list`·`paragraph` |
| `best_time` | `paragraph` |
| `costs` | `pricing` + `caption` |
| `stay_and_food` | `paragraph` |
| `tips` | `list` (icon) |
| `cautions` | `alert`(warning) + `list` |
| `nearby` | `grid` + `card` (`place` = 다른 여행지 slug) |

### 4.3 글 조각 — `children`

글은 조각 배열이다. 조각의 `text` 를 차례로 이어 붙이면 원문이 된다.

```json
[ { "text": "마닐라에서 약 " }, { "type": "duration", "text": "7~9시간" }, { "text": ", 요금은 " }, { "type": "price", "text": "₱900~1,200" }, { "text": "입니다." } ]
```

- type 이 없는 조각은 일반 글이다. 쓰이는 조각 type: `price` · `time` · `date` · `duration` · `distance` · `temperature`.
- 번역본도 같은 조각 구조를 쓰지만, 조각을 어떻게 나눴는지는 언어마다 다를 수 있다. 글만 필요하면 `children.map(r => r.text).join('')`.

### 4.4 사진

- `url` 은 `images/030-vigan.webp?v=2869bd00` 처럼 **places 파일이 있는 폴더 기준 상대 경로**다. `?v=` 는 사진 내용 해시다.
- `width`·`height` 로 사진이 오기 전에 비율 자리를 잡는다.
- **`credit`·`source` 는 CC 라이선스의 저작자 표기라서 화면에 반드시 보여야 한다.** 사진을 답변·화면에 쓸 때 저작자를 함께 적는다.

## 5. 불변식 — 믿어도 되는 것

1. **version 은 전체에 하나다.**
   - manifest·meta·places 파일 8개가 같은 version 을 가진다.
   - 같은 내용이면 어디서 빌드해도 같다. 문서만 고친 배포는 version 이 그대로다.
2. **모든 언어 파일은 여행지 모양이 같다.**
   - id·slug·순서가 같고, 블록 순서와 개수도 같다.
   - 언어와 무관한 값도 같다: id·slug·title_en·rating·좌표·months·budget 숫자·difficulty·airport.code·사진·링크·icon·variant·section key.
   - 빌드가 원본(ko)과 비교해 보장한다.
3. **언어마다 다른 것은 `translate: true` 인 prop 과 `label` 뿐이다.**
4. **비한국어 파일에는 한글이 없다** (빌드가 검사).
5. **값은 노드다.** 여행지 속성(`id`·`slug`·`sections` 제외)은 `{ "type": … }` 객체다. 노드의 키 규격은 `meta.display.types.<type>.props` 이고, 빌드가 모든 노드를 이 규격으로 검사한다.
6. **링크는 반드시 있는 여행지를 가리킨다.** `card.place`·`place_link.slug`.
7. **type·키 추가는 호환된다.** 모르는 type·키는 무시하거나 대체해서 그린다([rendering.md](rendering.md) §2). 키 삭제·이름 변경·형식 변경은 `schema` 를 올리고 경로를 바꾼다.

## 6. 받기

### 6.1 개발 때 받기 — 기본

웹·앱은 개발 컴퓨터에서 받아 제품에 넣는다([embedding.md](embedding.md)). 받는 일은 스킬의 도구가 한다.

```bash
node <스킬 폴더>/scripts/travel-db.mjs sync                        # JSON 을 캐시에 (version 같으면 받지 않음)
node <스킬 폴더>/scripts/travel-db.mjs build --out travel.db      # SQLite 로 — 모든 언어·전문 검색 색인
node <스킬 폴더>/scripts/travel-db.mjs build --out travel.db --langs ko,en --no-fts   # 필요한 언어만, 색인 없이
node <스킬 폴더>/scripts/travel-db.mjs export --out ./public/travel --langs ko,en      # 넣어 쓸 파일 폴더 (사진 포함)
```

- 캐시: `~/.cache/travel-api-skill/<나라>/` 에 `manifest.json`·`meta.json`·`places.<lang>.json` 을 둔다. version 이 바뀌면 옛 파일을 지우고 새로 받는다.
- 받은 파일들의 version·count 가 서로 맞지 않으면 저장하지 않고 오류를 낸다. 배포 중일 수 있다.
- JSON 자체를 넣어 쓰려면(정적 웹 등) 캐시 폴더의 파일을 복사한다.

### 6.2 실행 중에 새로 받기 — 선택

출시한 앱이 새 버전 없이도 데이터를 갱신해야 할 때만 쓴다. 넣어 둔 데이터를 먼저 보여 주고, 뒤에서 manifest 를 확인한다.

1. 넣어 둔 데이터(또는 저장본)로 화면을 그린다.
2. 앱 시작·포그라운드 복귀 때(예: 6시간 간격) `manifest.json` 을 받는다.
3. `version` 이 다르면 `meta.json` 과 필요한 언어의 `places.<lang>.json` 을 `?v=<version>` 을 붙여 받는다. 세 파일의 version·count 가 맞을 때만 저장본을 **통째로** 바꾼다.
4. 실패하면 그대로 둔다.

#### JavaScript

```js
export const PH_BASE = 'https://thruthesky.github.io/ph-travel-api/v2/';
const SCHEMA = 2;

/** 그 언어(없으면 대체 언어)의 meta·places. 저장본의 version 이 같으면 저장본, 받지 못하면 저장본. */
export async function loadTravel(lang = 'ko', base = PH_BASE) {
  if (!base.endsWith('/')) base += '/';
  // Cache API 는 https·localhost 에서만 있다. 없으면 저장 없이 받기만 한다. 키는 http(s) 주소여야 한다.
  const cache = globalThis.caches ? await caches.open('travel-api').catch(() => null) : null;
  const get = async (url) => {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.json();
  };
  const key = (l) => `${base}__travel-${l}`;
  const saved = await cache?.match(key(lang)).then((r) => r?.json()).catch(() => null);
  try {
    const m = await get(`${base}manifest.json`);
    if (m.schema !== SCHEMA) throw new Error(`schema ${m.schema} — 앱 업데이트 필요`);
    const use = m.languages.includes(lang) ? lang : m.fallback_language;
    if (saved?.version === m.version && saved.lang === use) return saved;
    const v = `?v=${m.version}`;
    const [meta, p] = await Promise.all([get(base + m.meta + v), get(base + m.places[use] + v)]);
    if (meta.version !== m.version || p.version !== m.version || p.count !== m.count || p.places.length !== m.count) {
      throw new Error('version·count 불일치 — 배포 중일 수 있다');
    }
    const bundle = { base, version: m.version, lang: use, dir: p.dir, places: p.places, meta };
    await cache?.put(key(lang), new Response(JSON.stringify(bundle))).catch(() => {});
    return bundle;
  } catch (e) {
    if (saved) return saved;
    throw e;
  }
}
```

#### Dart (`http` 패키지)

```dart
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

const phBase = 'https://thruthesky.github.io/ph-travel-api/v2/';

/// 그 언어(없으면 대체 언어)의 meta·places 를 dir/travel.<lang>.json 에 저장해 두고, version 이 다를 때만 새로 받는다.
Future<Map<String, dynamic>> loadTravel(Directory dir, {String lang = 'ko', String base = phBase}) async {
  final file = File('${dir.path}/travel.$lang.json');
  final saved = await file.exists() ? jsonDecode(await file.readAsString()) as Map<String, dynamic> : null;
  Future<Map<String, dynamic>> get(String url) async {
    final res = await http.get(Uri.parse(url));
    if (res.statusCode != 200) throw HttpException('HTTP ${res.statusCode} $url');
    return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>; // 헤더 charset 과 무관하게 UTF-8
  }

  try {
    final m = await get('${base}manifest.json');
    if (m['schema'] != 2) throw StateError('schema ${m['schema']} — 앱 업데이트 필요');
    final use = (m['languages'] as List).contains(lang) ? lang : m['fallback_language'] as String;
    if (saved != null && saved['version'] == m['version'] && saved['lang'] == use) return saved;
    final v = '?v=${m['version']}';
    final [meta, p] = await Future.wait([get('$base${m['meta']}$v'), get('$base${m['places'][use]}$v')]);
    final places = p['places'] as List;
    if (meta['version'] != m['version'] || p['version'] != m['version'] || p['count'] != m['count'] || places.length != m['count']) {
      throw StateError('version·count 불일치 — 배포 중일 수 있다');
    }
    final bundle = {'base': base, 'version': m['version'], 'lang': use, 'dir': p['dir'], 'places': places, 'meta': meta};
    await file.writeAsString(jsonEncode(bundle));
    return bundle;
  } catch (_) {
    if (saved != null) return saved;
    rethrow;
  }
}
```

- 검증(2026-09-28, 다국어 계약 모양의 시험 데이터를 로컬 서버로 띄움):
  - JS·Dart 모두 받기, 같은 version 이면 저장본 쓰기, 서버가 없으면 저장본 쓰기가 동작했다.
  - 없는 언어는 대체 언어로 받고, 없는 주소는 HTTP 404 오류가 났다.

## 7. 조회 도구 — `scripts/travel.mjs`

JSON 을 받아 SQLite 캐시 DB 로 만들고 그 DB 로 답한다. 명령과 옵션은 SKILL.md §4 와 `node scripts/travel.mjs help` 에 있다. 캐시 DB 에는 모든 언어가 들어 있어 `--lang` 을 바꿔도 다시 만들지 않는다. 어려운 조건은 `sql` 명령으로 직접 쿼리한다([database.md](database.md) §4).

## 8. 나라별 API

- 나라 목록은 `scripts/apis.json` 이다. 도구의 `--country <코드>` 로 고른다(기본 `ph`).
- 새 나라는 같은 구조의 저장소(예: `jp-travel-api`)로 만들고 `apis.json` 에 한 줄을 더한다 — [maintain.md](maintain.md) §9.
- 나라마다 달라도 되는 것: 분류·권역·지역 목록, 좌표 범위, 통화.
- 같게 유지하는 것: 파일 구조, 노드 모양, 표시 방법, 단락. 그래야 같은 DB 스키마와 렌더러로 쓸 수 있다.
