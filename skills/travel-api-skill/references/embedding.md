# 데이터를 넣어 쓰기(임베딩) — 웹·앱에서 여행 정보를 쓰는 기본 방식

웹사이트·앱은 원격 API 를 실행 중에 부르지 않는다. 개발 컴퓨터에서 JSON 을 받아 SQLite DB·파일로 바꾸고, 그것을 제품에 넣어(임베딩) 쓴다. DB 스키마와 쿼리는 [database.md](database.md), 파일 모양은 [api.md](api.md), 화면은 [rendering.md](rendering.md) 에 있다.

## 목차

1. 원칙 — 왜 넣어 쓰는가
2. 플랫폼별 권장
3. PHP 웹사이트 (필고 등)
4. Flutter 앱
5. 정적 웹·SPA (서버 코드 없음)
6. 데이터가 바뀌었을 때
7. 점검표

## 1. 원칙 — 왜 넣어 쓰는가

공개 주소(GitHub Pages)는 **데이터를 나눠 주는 곳**이지 실시간 서버가 아니다.

| 넣어 쓰면 | 원격 API 를 매번 부르면 |
|-----------|------------------------|
| 오프라인에서도 된다. 첫 화면이 바로 뜬다 | 네트워크가 느리거나 끊기면 빈 화면 |
| 외부 장애·한도와 무관하다 (Pages 는 월 100GB 권장, `max-age=600` 고정) | 방문자가 늘면 한도에 닿는다 |
| 데이터 버전이 제품 버전과 함께 고정·검증된다 | 배포 중에 반쯤 바뀐 데이터를 볼 수 있다 |
| 검색·거르기를 인덱스로 빠르게 한다(SQLite) | 2MB JSON 을 받아 매번 훑어야 한다 |
| 방문자 요청 기록이 제3자에 남지 않는다 | 모든 방문이 외부로 나간다 |

흐름은 늘 같다.

1. **받기** — 개발 컴퓨터에서 `node <스킬>/scripts/travel-db.mjs sync`. version 이 같으면 다시 받지 않는다.
2. **바꾸기** — `build` 로 SQLite DB, `export` 로 넣어 쓸 파일 폴더(meta·places·사진·travel.css·renderer.js)를 만든다.
3. **넣기** — 웹 서버에 올리거나 앱 애셋에 넣는다.
4. **바뀌면 다시** — 데이터 version 이 바뀌면 1~3 을 다시 하고 배포한다(§6).

실행 중에 새로 받는 것(api.md §6.2)은 **선택**이다. 출시한 앱이 새 버전 없이 데이터를 갱신해야 할 때만 붙인다.

## 2. 플랫폼별 권장

| 플랫폼 | 넣는 것 | 조회 | 절 |
|--------|---------|------|----|
| PHP 웹사이트 | `travel.db`(사이트 언어, 전문 검색) + `export --no-json` 폴더(travel.css·renderer.js·사진) | `assets/TravelDb.php` (PDO) | §3 |
| Flutter 앱 | `travel.db`(앱 언어만) + `travel.db.version` | `assets/travel_db.dart` (sqlite3) | §4 |
| 정적 웹·SPA | `export` 폴더(meta·places.<lang>.json·사진·renderer.js) | 브라우저 메모리 (100곳) | §5 |
| AI·스크립트 | 캐시 DB | `scripts/travel.mjs` | SKILL.md §3 |

## 3. PHP 웹사이트 (필고 등)

### 3.1 로컬에서 만들기

서버 배치 — DB 와 PHP 라이브러리는 웹 루트 밖, 화면 파일만 웹 루트에 둔다.

```
<서버>/data/travel.db         ← 여행 DB (+ travel.db.version)
<서버>/lib/TravelDb.php       ← 조회 클래스
<서버>/html/travel.php        ← 페이지 (assets/travel-page.php 를 고쳐 쓴다)
<서버>/html/travel/           ← travel.css · renderer.js · images/
```

```bash
S=~/.claude/skills/travel-api-skill          # 스킬 폴더 — 설치 위치. ph-travel-api 저장소 안이면 skills/travel-api-skill
node $S/scripts/travel-db.mjs build  --out build/data/travel.db --langs ko,en                 # 사이트 언어만 (+ 대체 en)
node $S/scripts/travel-db.mjs export --out build/html/travel --langs ko,en --no-json          # travel.css·renderer.js·images/
mkdir -p build/lib && cp $S/assets/TravelDb.php build/lib/
cp $S/assets/travel-page.php build/html/travel.php                                            # 맨 위 설정(경로)을 배치에 맞게
```

- `--no-json` — PHP 페이지는 DB 를 읽으므로 places·meta JSON 을 공개 폴더에 올리지 않는다.
- 사이트가 지원하는 언어만 넣는다. 실제 번역 기준 ko+en 약 14MB, ko+en+zh 약 21MB 다(FTS 없이는 약 60%). 언어 하나가 약 6~7MB 이고, 글이 긴 언어(영어)는 더 크다. 정확한 크기는 `build` 출력으로 본다.

### 3.2 서버에 올리기

**처음 한 번 — 서버 요건을 확인한다.**

- 웹 서버의 PHP(FPM)에 `pdo_sqlite` 가 켜져 있어야 한다. CLI 가 아니라 웹에서 `phpinfo()` 로 본다.
- PHP 가 쓰는 SQLite 가 **3.34 이상**이어야 전문 검색(FTS5 trigram)을 쓴다.
  `php -r 'echo (new PDO("sqlite::memory:"))->query("select sqlite_version()")->fetchColumn();'`
  - 더 낮으면(Ubuntu 20.04·RHEL 8 등) `--no-fts` 로 만든다. `TravelDb` 는 trigram 이 없으면 알아서 글에서 직접 찾으므로 오류는 나지 않지만, 쓰지 못할 색인만큼 파일이 커진다.
- DB·라이브러리는 **웹 루트 밖**에 둔다. 웹 루트 안에 두면 DB 가 파일째 내려받힌다.
- 읽기 권한만 준다(`chmod 444`). PHP 는 DB 를 읽기 전용으로 연다.

**올릴 때마다 — 이 순서를 지킨다.** 순서가 틀리면 잠깐이라도 사진이 404 가 되거나(새 여행지), 스키마가 바뀐 DB 를 옛 라이브러리가 열어 모든 쪽이 500 이 된다.

1. **사진·travel.css·renderer.js 를 먼저 더한다** — 지우지 않는다(`--delete` 없이). 옛 DB 가 가리키는 사진도 아직 필요하다.
2. **DB 와 라이브러리를 옆 이름(`.new`)으로 올린다.** 반드시 **같은 폴더**(같은 디스크)에 둔다 — 그래야 `mv` 가 원자적이다. `/tmp` 에 올렸다가 옮기면 원자적이지 않다.
3. **서버에서 검사한다** — 하나라도 실패하면 멈춘다(운영 파일은 그대로다).
   - 올린 파일의 sha256 이 로컬과 같다(업로드가 끊기지 않았다).
   - `sqlite3 travel.db.new 'PRAGMA quick_check'` 가 `ok` 다.
   - 새 라이브러리로 새 DB 를 열어 version 이 맞고 검색이 된다.
4. **바꾼다** — 되돌릴 수 있게 옛 DB 를 남기고, DB 와 라이브러리를 잇달아 바꾼다.
5. **정리한다** — `travel.php` 를 올리고, 마지막에 `--delete` 로 쓰지 않는 사진을 지운다.

```bash
# 개발 컴퓨터 — 1·2
rsync -a build/html/travel/ server:/var/www/html/travel/                 # 더하기만 (--delete 없이)
scp build/data/travel.db server:/var/www/data/travel.db.new
scp build/data/travel.db.version server:/var/www/data/travel.db.version.new
scp build/lib/TravelDb.php server:/var/www/lib/TravelDb.php.new
shasum -a 256 build/data/travel.db                                       # 서버에서 비교할 값

# 서버 — 3·4 (cd /var/www/data). 한 단계라도 실패하면 && 가 멈춘다
[ "$(sha256sum travel.db.new | cut -d' ' -f1)" = "<로컬 sha256>" ] \
  && php -r '$d = new PDO("sqlite:travel.db.new"); if ($d->query("PRAGMA quick_check")->fetchColumn() !== "ok") exit(1);
       require "../lib/TravelDb.php.new"; $t = new TravelDb("travel.db.new");
       if (!$t->search("boracay", "en")) exit(1); echo "ok ", $t->version(), "\n";' \
  && { [ ! -e travel.db ] || ln -f travel.db travel.db.prev; } \
  && chmod 444 travel.db.new \
  && mv -f travel.db.new travel.db && mv -f ../lib/TravelDb.php.new ../lib/TravelDb.php && mv -f travel.db.version.new travel.db.version

# 개발 컴퓨터 — 5
rsync -a build/html/travel.php server:/var/www/html/
rsync -a --delete build/html/travel/ server:/var/www/html/travel/        # 이제 쓰지 않는 사진을 지운다

# 되돌리기 (서버, /var/www/data): ln -f travel.db.prev travel.db.tmp && mv -f travel.db.tmp travel.db
```

- 운영 DB 에 바로 덮어쓰면 올리는 동안 읽는 요청이 깨진 파일을 본다. 시험에서 400요청 중 15건이 실패했고, `.new` → `mv` 는 0건이었다.
- `mv` 로 바꾸면 이미 열려 있던 요청은 옛 파일을 끝까지 읽는다. 다음 요청부터 새 DB 다.

**필고에 넣을 때**

필고는 배포를 `./deploy.sh`(테스트 → 커밋·push → 서버 `git pull`)로만 한다. 규칙은 PHILGO-DEV.md 에 있고 우회하지 않는다. 그래서 위의 scp·rsync 는 쓰지 않는다. DB 파일을 서버에 두는 방법은 다음 중에서 사용자와 정한다.

| 방법 | 장점 | 단점 |
|------|------|------|
| DB 를 필고 저장소에 넣는다 | `deploy.sh` 그대로. 서버에 Node 불필요 | 데이터가 바뀔 때마다 git 이력이 수 MB~수십 MB 씩 는다. `--langs`·`--no-fts` 로 줄인다 |
| 서버가 `git pull` 뒤 DB 를 만든다 (`travel-db.mjs build`) | 저장소에 바이너리가 없다 | 서버에 Node 22.13+ 와 스킬(또는 스크립트)이 필요하다. 만드는 동안은 옛 DB 를 쓴다(원자적 교체) |
| JSON 을 저장소에 넣고 서버가 DB 로 바꾼다 | 이력은 텍스트라 diff 가 보인다 | 위와 같이 서버에 Node 가 필요하다 |

- 코드 위치는 PHILGO-DESIGN.md 를 따른다. 화면은 `./widgets` 의 위젯이고, 데이터 조회는 공유 코드(저장소·서비스 층)다.
  - `TravelDb.php` 는 공유 코드 층으로 옮겨, 필고의 명명·타입 규칙(PHILGO-CODING.md)에 맞춘다.
  - 페이지 HTML 은 위젯으로 쪼갠다. UI 는 Web Awesome Pro 로 바꾼다 — 탭 `<wa-tab-group>`, 알림 `<wa-callout>`.
- 연동 사이트(`sites/<name>/`)에 넣으려면 PHILGO-SITES.md 의 다국어·SEO 규칙을 따른다. hreflang·canonical 은 사이트 규칙이 우선한다.

### 3.3 PHP 에서 쓰기 — `assets/TravelDb.php`

```php
require '/var/www/lib/TravelDb.php';
$travel = new TravelDb('/var/www/data/travel.db', imageBase: '/travel/');   // 사진은 export 한 /travel/images/
$lang = $travel->lang($want);                                                 // 없는 언어면 대체 언어(en). 입력은 is_string 으로 확인
$page = $travel->list(['category' => 'beach', 'month' => 12, 'sort' => 'rating'], $lang, limit: 20);
$hits = $travel->search($q, $lang, 100, ['category' => 'diving']);          // 거르기를 함께 · 행마다 snippet · snippet_html(<mark>)
$place = $travel->place('boracay', $lang);                                   // 블록 JSON 배열
$text = $travel->text('boracay', $lang);                                     // 제목·카피·요약·본문 글
```

### 3.4 페이지 만들기 — `assets/travel-page.php`

그대로 동작하는 예시다. 목록(분류·달 거르기·검색)과 상세가 있다.

- **맨 위 설정 다섯 줄**만 배치에 맞게 고치면 동작한다.
  - `TRAVEL_DB`·`TRAVEL_LIB`·`TRAVEL_ASSETS` — 파일 위치와 export 폴더의 웹 경로
  - `TRAVEL_ORIGIN` — 사이트의 공개 주소. canonical·hreflang·JSON-LD 의 절대 주소를 이것으로 만든다. `Host` 헤더를 쓰면 `Host: evil.example` 요청에 남의 주소가 canonical 로 나간다
  - `TRAVEL_DEFAULT_LANG` — `?lang` 도 `Accept-Language` 도 맞는 언어가 없을 때
- **목록은 서버가 HTML 로 그린다** — 검색엔진에 보이고, JS 없이도 모양이 잡힌다(`travel.css`).
  - 분류 칩·달 선택·검색 칸이 있다. 검색에도 분류·달 거르기가 걸리고, 칩의 수는 지금 검색어·달을 반영한다.
  - 여행지가 100곳 안팎이라 한 번에 모두 보인다(쪽 나누기 없음). 결과가 없으면 빈 상태 문구를 보인다.
  - 카드마다 사진 저작자와 최적기를 보인다. 최적기는 목적(서핑·해변)이 글에 있다.
- **상세는 블록 JSON 을 페이지에 넣고 `renderer.js` 가 그린다.** `<script type="application/json">` 에 `JSON_HEX_TAG` 로 넣어 `</script>` 가 끼어들지 못하게 한다.
- **검색엔진용으로 서버가 함께 넣는 것:**
  - `<title>` · `<meta name="description">`(요약)
  - `<link rel="canonical">` · 언어마다 `<link rel="alternate" hreflang>` · `hreflang="x-default"`(대체 언어 en 주소)
  - JSON-LD `TouristAttraction`(이름·설명·절대 주소·좌표, 사진은 `ImageObject` 로 `creditText`·`acquireLicensePage` 까지)
  - 검색 결과 쪽(`?q=`)은 `noindex`
  - `<noscript>` 안의 제목·요약·본문 글
- **검색 결과**는 `snippet_html`(이스케이프 + `<mark>`)을 그대로 출력한다.
- **언어:**
  - `<html lang dir>` 에 `$travel->lang()`·`$travel->dir()` 를 쓴다(아랍어는 `rtl`).
  - 언어 메뉴는 `$travel->languages()` 로 만든다.
  - 언어는 `?lang` → `Accept-Language` 에서 처음 맞는 것 → `TRAVEL_DEFAULT_LANG` 순이다. `zh-CN` 은 `zh` 로 맞춘다.
  - DB 에 없는 언어를 요청하면 대체 언어(en)로 보이고, 그 사실을 화면 위에 알린다(`role="status"`).
  - 화면 글(버튼·안내)은 예시에서는 `$ui` 사전이다. API 의 8개 언어가 모두 있고, 사전에 없는 언어는 en 이다. 실제 사이트에서는 사이트의 다국어 시스템으로 바꾼다. 필고는 PHILGO-CODING.md §5 를 따른다.
  - 달 이름은 intl 확장이 있으면 `IntlDateFormatter`(`LLLL`)로 그 언어의 이름(三月·มีนาคม·مارس)을 쓰고, 없으면 사전의 숫자 형식(`%d월`)을 쓴다.
- **캐시:** `travel.css`·`renderer.js` 주소에 파일 시각(`filemtime`)을 붙인다. 스킬을 갱신해 다시 export 하면 데이터 version 이 같아도 새 파일을 받는다.
- **글꼴:** 아이콘·제목 글꼴을 Google Fonts 에서 받는다. 외부 요청이라 방문 기록이 남으므로(§1 원칙), 사이트 원칙에 따라 글꼴 파일을 받아 자체 호스팅으로 바꾼다.
- **보안:**
  - 모든 출력은 `htmlspecialchars` 로 이스케이프한다.
  - 입력은 `is_string` 으로 확인한다. `?q[]=x` 처럼 배열이 들어와도 경고를 내지 않는다.
  - 사용자 입력은 바인딩 인자로만 넘긴다. 정렬 값은 정해진 목록에서만 고른다.
- 필고처럼 계층을 나누는 사이트에서는 `TravelDb` 호출을 저장소 층으로, HTML 을 뷰로 옮긴다. 공용 코드 위치는 PHILGO-DESIGN.md 를 따른다.

### 3.5 사진

- **권장:** `export` 로 받아 서버의 `/travel/images/` 에 둔다(`imageBase: '/travel/'`). 293장, 약 23MB 다.
- **대안:** `--no-images` 로 받지 않고 `imageBase: 'https://thruthesky.github.io/ph-travel-api/v2/'` 로 Pages 의 사진을 쓴다. 전송량이 Pages 한도에 들어간다.
- 어느 쪽이든 **`credit`·`source` 를 화면에 보인다**(CC 라이선스). 목록 카드는 사진 모서리에 credit 을 두고, 상세 사진에는 원본 링크까지 둔다.

## 4. Flutter 앱

### 4.1 무엇을 넣나

| 경우 | 넣는 것 |
|------|---------|
| 검색·거르기가 있는 앱 (권장) | `build --out assets/travel.db --langs <앱 언어들>` — 전문 검색 포함 |
| 앱 크기가 중요 | `--no-fts` 로 색인을 뺀다(검색은 글에서 직접, 100곳이라 충분). 언어는 꼭 필요한 것만 |
| 목록·상세만 있는 단순한 앱 | `export --out assets/travel --langs ko --no-images` 의 `places.ko.json`·`meta.json` 을 메모리로 |

- 언어 하나가 DB 에서 대략 6~7MB 다(FTS 포함, 실제 번역 기준). 실제 크기는 `build` 출력으로 확인한다.
- 대체 언어(en)는 늘 함께 들어간다.

### 4.2 DB 넣어 쓰기 — `assets/travel_db.dart`

```yaml
# pubspec.yaml
dependencies:
  sqlite3: ^3.3.0        # SQLite 3.5x + FTS5 를 함께 넣어 준다 (sqlite3_flutter_libs 는 필요 없다)
  path_provider: any
flutter:
  assets: [assets/travel.db, assets/travel.db.version]
```

```dart
final dir = await getApplicationSupportDirectory();
final travel = await TravelDb.openEmbedded(dir, (path) async => (await rootBundle.load(path)).buffer.asUint8List());
final lang = travel.lang(Localizations.localeOf(context).languageCode);   // 없으면 en
final page = travel.list(const TravelFilter(month: 12, category: 'beach', sort: 'rating'), lang, limit: 20);
final place = travel.place('boracay', lang);   // Map → TravelBlocks(...).place(context, place)
```

- 애셋 안의 DB 는 바로 열 수 없어서 앱 지원 폴더로 복사한다.
  - `travel.db.version` 이 바뀌었을 때만 다시 복사한다. 앱을 업데이트해 새 DB 가 들어왔을 때다.
  - 임시 파일에 쓴 뒤 이름을 바꾼다.
- 기기의 시스템 SQLite 는 버전이 제각각이다. 안드로이드 옛 버전에는 FTS5 trigram 이 없을 수 있다. 그래서 `sqlite3` 패키지가 넣어 주는 SQLite 를 쓴다.
- 오른쪽→왼쪽 언어는 `Directionality(textDirection: travel.dir(lang) == 'rtl' ? TextDirection.rtl : TextDirection.ltr, …)` 안에서 그린다.
- 필고 앱이라면 이 파일과 `travel_blocks.dart` 를 공용 라이브러리(`apps/lib/src/travel/`)에 두고 앱마다 복사하지 않는다.

### 4.3 사진

- 사진은 앱에 넣지 않고 API 주소에서 받아 캐시한다(`cached_network_image`, url 을 키로). 293장을 넣으면 23MB 가 늘어난다.
- 오프라인 첫 화면이 중요하면 대표 사진(`position = 0`, 100장)만 넣는다. 그 경로를 `imageBase` 로 쓰는 방법도 있다.

### 4.4 출시 없이 갱신 (선택)

- 기본은 앱 업데이트마다 새 DB 를 넣는 것이다.
- 출시 없이 갱신하려면 api.md §6.2 로 새 JSON 을 받는다. 그다음 두 가지 중 하나를 한다.
  - 메모리로 쓴다.
  - 기기에서 DB 를 다시 만든다 — `assets/travel-schema.sql` 을 앱에 함께 넣고 `buildDb` 와 같은 순서로 채운다.

## 5. 정적 웹·SPA (서버 코드 없음)

```bash
node $S/scripts/travel-db.mjs export --out public/travel --langs ko,en      # 사이트 빌드 때
```

```js
import { FONT_LINKS, renderPlace, renderPlaceCard, enhance } from '/travel/renderer.js';
const lang = navigator.language.startsWith('ko') ? 'ko' : 'en';
const manifest = await (await fetch('/travel/manifest.json')).json();
const { places, dir } = await (await fetch(`/travel/${manifest.places[lang] ?? manifest.places[manifest.fallback_language]}?v=${manifest.version}`)).json();
document.head.insertAdjacentHTML('beforeend', `${FONT_LINKS}<link rel="stylesheet" href="/travel/travel.css?v=${manifest.version}">`);
const beaches = places.filter((p) => p.category.value === 'beach' && p.best_season.months.includes(12));
list.innerHTML = beaches.map((p) => renderPlaceCard(p, { base: '/travel/', places })).join('');
```

- 사이트와 같은 출처라 CORS 가 없다. `?v=<version>` 을 붙이면 데이터가 바뀔 때 브라우저 캐시를 건너뛴다.
- 필요한 언어 파일 하나만 받는다. 약 2MB, gzip 전송이면 약 0.5MB 다.
- 거르기는 노드의 공통 key 로 한다(`category.value`·`island_group.value`·`region.value`·`difficulty.value`·`best_season.months`). 검색은 `children` 글을 이어 붙여 찾는다.
- 브라우저 SQLite(sql.js 등)는 외부 패키지이고 1MB 가 넘는다. 100곳에는 과하다.

## 6. 데이터가 바뀌었을 때

1. 확인한다: `node $S/scripts/travel.mjs info` 또는 `travel-db.mjs sync` — 새 version 이 나온다.
2. `build`·`export` 를 다시 해서 배포하거나 앱을 새로 낸다.
3. 제품이 쓰는 데이터 version 을 남긴다. `SELECT value FROM meta WHERE key='version'`, 또는 `manifest.json` 의 version 이다. 화면 아래나 로그에 두면 어느 데이터인지 바로 안다.
4. 스킬이 "API 는 schema N" 경고를 내면 먼저 `/travel-api-skill update` 로 스킬을 갱신한다.

## 7. 점검표

- [ ] 사진마다 저작자(credit)가 보이고, 상세 사진에서 원본(source)으로 갈 수 있다
- [ ] 없는 언어를 요청하면 대체 언어(en)로 보인다. 아랍어는 `dir="rtl"` 이다
- [ ] DB 는 읽기 전용으로 열고, 서버에서는 웹 루트 밖에 있다
- [ ] 서버 PHP(FPM)에 `pdo_sqlite` 가 있고, SQLite 가 3.34 이상이다(아니면 `--no-fts`)
- [ ] DB 는 `.new` 로 올려 검사한 뒤 `mv` 로 바꾼다. 사진은 먼저 더하고 나중에 지운다
- [ ] canonical·hreflang 의 주소가 설정한 공개 주소다(Host 헤더가 아니다)
- [ ] 사용자 입력은 바인딩 인자로만, 출력은 이스케이프한다
- [ ] 쓰고 있는 데이터 version 을 알 수 있다
- [ ] 금액은 "2026년 기준 대략치", 예산 기준(1일·투어 1회 …)이 함께 보인다
