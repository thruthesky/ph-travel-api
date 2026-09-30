# SQLite DB — 스키마·만들기·쿼리·검색

여행 정보 JSON 을 SQLite 파일 하나(`travel.db`)로 바꿔 쓰는 방법이다. **이 스킬이 API 를 쓰는 기본 방식이다.** 받기(version 이 바뀔 때만) → SQLite → 언어별 전문 검색·인덱스 → 조회. 웹·앱에 넣는 방법은 [embedding.md](embedding.md), 파일 모양은 [api.md](api.md) 에 있다.

## 목차

1. 왜 SQLite 인가
2. 만들기 — `scripts/travel-db.mjs`
3. 스키마 — `assets/travel-schema.sql`
4. 쿼리 모음
5. 전문 검색 — FTS5 trigram
6. 코드에서 쓰기 — Node · PHP · Dart
7. 교체와 버전
8. 검증 기록

## 1. 왜 SQLite 인가

- **파일 하나** 라서 웹 서버에 올리고 앱 애셋에 넣기 쉽다. 서버 프로세스가 없다.
- **어디서나 읽힌다.**
  - PHP `pdo_sqlite`
  - Dart `sqlite3` 패키지
  - Node 22.13+ 내장 `node:sqlite`
  - Python `sqlite3`
  - `sqlite3` 명령
- **인덱스·FTS5** 로 거르기·정렬·전문 검색이 빠르다.
  - 8개 언어 × 200곳의 본문을 언어별로 따로 모아 검색한다.
  - 띄어쓰기 없는 중국어·일본어·태국어와 조사가 붙는 한국어도 부분 문자열로 찾는다.
- **읽기 전용 배포** — 한 번 만들고 고치지 않는다. 자료가 바뀌면 새로 만들어 통째로 바꾼다.

## 2. 만들기 — `scripts/travel-db.mjs`

외부 패키지 없음, 내장 `node:sqlite` 를 쓴다. FTS5 가 들어 있는 Node 24 로 돌린다(22.14 의 `node:sqlite` 에는 FTS5 가 없다).

```bash
node scripts/travel-db.mjs build --out travel.db                          # 모든 언어 + 전문 검색
node scripts/travel-db.mjs build --out travel.db --langs ko,en            # 필요한 언어만 (대체 언어 en 은 늘 들어감)
node scripts/travel-db.mjs build --out travel.db --no-fts                 # 전문 검색 색인 없이 — 파일이 작다
node scripts/travel-db.mjs build --out travel.db --base ../ph-travel-api/_site/v2   # 로컬 빌드 결과로
node scripts/travel-db.mjs sync                                           # JSON 만 캐시에 최신으로
node scripts/travel-db.mjs export --out ./public/travel [--no-json]       # 사진·travel.css·renderer.js (+ JSON) — embedding.md
```

- 모르는 옵션(예: `--langs` 대신 `--lang`)을 주면 멈춘다. 엉뚱한 DB 를 만들지 않게 하려는 것이다.

- 출력: `travel.db — ph version … · 198곳 · 언어 en,ko · FTS5 trigram · 31.0MB · 804ms`.
- 함께 `travel.db.version` 파일을 쓴다(API version 한 줄). 앱은 이 글자가 바뀌었을 때만 DB 를 다시 복사한다.
- `meta.base` 에는 공개 API 주소가 들어간다. 로컬 폴더로 만들어도 개발 컴퓨터 경로가 운영 DB 에 남지 않는다. 실제로 읽은 곳은 `meta.source` 다.
- JSON 은 캐시(`~/.cache/travel-api-skill/<나라>/`)를 거친다. manifest version 이 같으면 다시 받지 않는다.
- 크기(2026-09-30, 198곳 · 8개 언어 실제 번역, Node 24 로 잰 값):

  | 언어 | 전문 검색 | 크기 |
  |------|-----------|------|
  | en 하나 | 포함 | 15.8MB |
  | ko + en(대체) | 포함 | 31.0MB (gzip 13MB) |
  | 8개 모두 | 포함 | 150.1MB |
  | 8개 모두 | 없음 | 99.7MB |

  - 언어 하나가 약 15~20MB 다(8개 평균 약 19MB). 실제 크기는 `build` 출력으로 확인한다.
  - 100곳이던 2026-09-28 에는 en 7.2MB · ko+en 14.2MB · ko+en+zh 20.6MB 였다.
  - 앱에는 필요한 언어만 넣는다.
- 임시 파일에 만든 뒤 이름을 바꿔 교체한다. 그래서 만드는 도중에 읽는 쪽이 반쯤 만든 DB 를 보지 않는다.

## 3. 스키마 — `assets/travel-schema.sql`

전문(全文)은 에셋 파일에 있다. 설계 원칙:

1. **언어와 상관없는 값은 한 번만** — `places` 등. 모든 언어 파일에서 같다고 API 가 보장한다([api.md](api.md) §5).
2. **언어별 글은 (place_id, lang) 한 행** — `place_texts`. 화면용 JSON 원본(`json`)과 검색용 본문 전체(`body`)를 함께 둔다.
3. **검색 색인은 글을 복사하지 않는다** — `place_fts` 는 `content='place_texts'` 외부 콘텐츠 FTS5 다.
4. **큰 행이 있는 표는 WITHOUT ROWID 로 만들지 않는다.** SQLite 는 큰 행에서 그 형식이 느리고 파일도 크다(실측 20.7MB → 15.1MB).
5. **스키마 버전은 `PRAGMA user_version = 1`** — 코드는 열 때 확인하고, 모르면 다시 만들게 한다.

| 표 | 한 행 | 주요 열 |
|----|-------|---------|
| `meta` | key·value | `country` `base`(공개 API 주소 — 사진 주소 기본값) `source`(실제로 읽은 곳) `schema` `version` `count` `generated_at` `built_at` `languages`(JSON) `source_language` `fallback_language` `fts` `meta_json`(meta.json 전체) |
| `languages` | 언어 | `code` `name`(그 언어로) `dir`(ltr·rtl) `is_default` |
| `places` | 여행지 (언어 공통) | `id` `slug` `category_key` `island_group_key` `region_key` `rating` `difficulty`(1~3) `budget_min` `budget_max` `currency` `latitude` `longitude` `airport_code` |
| `place_months` | 여행지 × 달 | `place_id` `month` — 최적기 |
| `place_images` | 사진 | `place_id` `position`(0 대표) `url` `width` `height` `credit` `source` |
| `place_links` | 함께 가보면 좋은 곳 | `place_id` `target_id` `position` |
| `place_texts` | 여행지 × 언어 | `id`(FTS 행 번호) `title` `title_en` `tagline` `summary` `category` `island_group` `region` `location` `best_season` `duration` `budget` `difficulty` `airport` `tags` `body` `json` |
| `place_sections` | 여행지 × 언어 × 단락 | `key` `position` `title` `text` |
| `place_tags` | 여행지 × 언어 × 태그 | `tag` |
| `terms` | 용어 × 언어 | `kind`(category·island_group·region·difficulty) `key` `name` `icon` — 거르기 메뉴 |
| `place_fts` | FTS5 (trigram) | `title` `tags` `summary` `body` — `rowid` = `place_texts.id` |
| `place_list` (뷰) | 여행지 × 언어 | 목록 한 줄 — 위 값 + 대표 사진(`image_url` `image_credit` `image_source` …) |

- 난이도 용어의 `key` 는 `'1'`·`'2'`·`'3'`(문자열)이다. `places.difficulty` 와 비교할 때 `CAST(difficulty AS TEXT)` 를 쓴다.
- 사진 `url` 은 상대 경로다(`images/…?v=해시`). 쓰는 곳에서 사진 주소를 앞에 붙인다(사이트 경로나 API 주소).

## 4. 쿼리 모음

모두 `lang` 으로 언어를 고른다. 도구로 바로 해 볼 수 있다: `node scripts/travel.mjs sql "<SELECT …>"`.

```sql
-- 12월에 가기 좋은 해변, 쉬운 곳, 추천도 순 (한국어)
SELECT slug, title, rating, budget_min, budget_max, best_season FROM place_list
WHERE lang = 'ko' AND category_key = 'beach' AND difficulty = 1
  AND id IN (SELECT place_id FROM place_months WHERE month = 12)
ORDER BY rating DESC;

-- 거르기 메뉴 — 분류 이름(그 언어)과 여행지 수
SELECT t.key, t.name, t.icon, count(p.id) AS n FROM terms t
LEFT JOIN places p ON p.category_key = t.key
WHERE t.kind = 'category' AND t.lang = 'en' GROUP BY t.key ORDER BY n DESC;

-- 태그로 (가족 여행) · 예산 2,000페소 이하부터 싼 순
SELECT slug, title, budget FROM place_list
WHERE lang = 'ko' AND id IN (SELECT place_id FROM place_tags WHERE lang = 'ko' AND tag = '가족 여행')
  AND budget_min <= 2000 ORDER BY budget_min;

-- 한 단락의 글만 (가는 방법)
SELECT title, text FROM place_sections s JOIN places p ON p.id = s.place_id
WHERE p.slug = 'vigan' AND s.lang = 'ko' AND s.key = 'getting_there';

-- 화면용 여행지 JSON (블록 렌더러에 넘긴다)
SELECT json FROM place_texts t JOIN places p ON p.id = t.place_id WHERE p.slug = 'vigan' AND t.lang = 'ar';

-- 함께 가보면 좋은 곳 (링크 대상의 이름·대표 사진)
SELECT l.position, q.slug, q.title, q.image_url, q.image_credit FROM place_links l
JOIN places p ON p.id = l.place_id JOIN place_list q ON q.id = l.target_id AND q.lang = 'ko'
WHERE p.slug = 'vigan' ORDER BY l.position;

-- 분류별 평균 추천도
SELECT category_key, count(*) n, round(avg(rating), 2) avg_rating FROM places GROUP BY 1 ORDER BY 2 DESC;
```

- **가까운 곳**은 코드에서 계산한다(하버사인, 200곳). SQLite 의 삼각함수는 빌드 옵션에 따라 없을 수 있다.
- **최적기**(`place_months`)는 글의 모든 기간(목적별 포함)을 합친 달이다. 결과의 `best_season` 글을 읽고 목적(서핑·해변)이 맞는지 본다.
- **예산**은 1인 기준이다. 기준(투어 1회 등)이 `budget` 글 끝 괄호에 있으면 다른 곳과 단순 비교하지 않는다.

## 5. 전문 검색 — FTS5 trigram

```sql
SELECT t.place_id, snippet(place_fts, 3, '[', ']', '…', 64) AS snippet, bm25(place_fts, 10, 6, 3, 1) AS score
FROM place_fts JOIN place_texts t ON t.id = place_fts.rowid
WHERE place_fts MATCH '"고래상어" AND "스노클링"' AND t.lang = 'ko'
ORDER BY score LIMIT 20;
```

규칙 (Node `searchPlaces`, PHP `TravelDb::search`, Dart `TravelDb.search` 가 모두 같게 구현한다. 질문 25개 × DB 3종에서 세 구현이 같은 곳을 같은 순서로 냄을 확인했다):

1. **낱말 나누기** — `"…"` 로 감싼 곳은 한 구절이고, 나머지는 공백과 문장부호(`, ， 、 ; ； 。 ! ！ ? ？`)로 나눈다. **모든 낱말이 들어 있는 여행지**만 고른다(AND).
   - 정규식은 세 구현이 같다: `"([^"]+)"|[^\s,，、;；。!！?？"]+` (Node `searchWords`, PHP `TravelDb::words`, Dart `TravelDb.words`).
   - 구절: `"life vest"` 는 붙은 글만 찾는다. 따옴표 없이 `life vest` 로 찾으면 `vest` 가 harvest 에도 걸린다.
   - 중국어 사용자는 `鲸鲨，浮潜` 처럼 쉼표로 잇는다. 띄어쓰기 없는 긴 글(`和鲸鲨一起游泳`)은 그대로 한 낱말이라 거의 못 찾는다 — 부르는 쪽(AI·검색 칸 안내)이 2~4글자 낱말로 띄워 쓴다.
2. **3글자(코드 포인트) 이상** 낱말은 FTS5 로 찾는다.
   - 낱말마다 큰따옴표로 감싸 구문으로 만든다. 안의 `"` 는 `""` 로 바꾼다. 그래야 `AND`·`*`·`-` 같은 FTS 문법이 섞이지 않는다.
   - FTS 를 쓸 수 있는지는 **표가 있는지만 보지 않고 한 번 찾아 본다**(`MATCH '"abc"'`). 서버 SQLite 가 trigram 을 모르면(3.34 미만) 표가 있어도 MATCH 가 예외를 낸다. 그러면 3번처럼 모두 글에서 찾는다(PHP·Dart).
3. **3글자 미만** 낱말(세부·해변·鲸鲨·ab)은 trigram 이 찾지 못한다. FTS 결과(없으면 그 언어 전체)를 FTS 와 같은 네 글(제목·태그·요약·본문)에서 직접 찾아 거른다. 요약을 빠뜨리면 요약에만 있는 낱말을 놓친다.
   - 200곳이라 충분히 빠르다.
   - FTS 없이 만든 DB(`--no-fts`)는 모든 낱말을 이렇게 찾는다.
4. **순서** — 제목에 모든 낱말(2) → 대표 태그에 모든 낱말(1) → 점수 → 여행지 id.
   - 이름(보라카이·Boracay·长滩岛)으로 찾으면 그 여행지가 맨 앞이다. bm25 는 긴 본문에 불리해서, 이 규칙이 없으면 이름을 한 번 언급한 짧은 글이 앞선다(`Boracay` 1위가 carabao-island 였다).
   - 태그는 여행지마다 편집자가 고른 대표 5개라, 태그가 맞는 곳(`whale shark` → 돈솔·오슬롭)을 본문에서 언급만 한 곳보다 앞에 둔다.
   - 점수는 `bm25`(열 무게 제목 10 · 태그 6 · 요약 3 · 본문 1)다. 짧은 낱말만 있으면(또는 FTS 가 없으면) 첫 낱말이 많이 나온 곳이 앞이다.
   - 마지막 기준(id)까지 꼭 정한다 — Dart 의 `sort` 는 안정 정렬이 아니라서, 없으면 같은 점수의 순서가 구현마다 달라진다.
5. `snippet` 은 찾은 낱말을 `[ ]` 로 감싼 약 64글자다. trigram 은 토큰이 거의 한 글자라서 토큰 수를 넉넉히 줘야 강조가 중간에서 잘리지 않는다.
   - 짧은 낱말로만 찾았을 때는 **요약·본문에서 먼저** 발췌한다. 제목·태그 나열(`栋索尔 鲸鲨, 浮潜, 萤火虫…`)로 시작하지 않게 한다.
   - PHP 는 `snippet_html` 도 준다. 이스케이프한 뒤 `<mark>` 로 감싼 HTML 이라 그대로 출력한다. 표시에는 글에 나올 수 없는 문자(U+E000·U+E001)를 쓴다. 그래서 원문에 `[` `]` 가 있어도 태그가 깨지지 않는다.
6. 대소문자를 가리지 않는다(`boracay` = `Boracay`, `боракай` = `Боракай`). trigram 이 그렇고, 직접 찾을 때도 양쪽을 소문자로 바꿔 맞춘다. 부분 문자열이라 짧은 낱말은 다른 낱말 속에도 걸린다(아이 → 파오아이).
7. **거르기와 함께** — `search(q, lang, limit, filter)` 의 filter 는 `list` 와 같다(분류·달·지역 …, sort 는 무시). 검색 결과에서 거르기에 맞는 곳만 남긴다. 조회 도구는 `search 鲸鲨 --region 巴拉望` 처럼 쓴다.
8. 본문 전체를 찾으므로 「함께 가보면 좋은 곳」에서 한 번 언급된 여행지도 걸린다. 그 여행지 자체에 대한 글만 찾으려면 단락을 좁힌다:

   ```sql
   SELECT DISTINCT s.place_id FROM place_sections s
   WHERE s.lang = 'ko' AND s.key NOT IN ('nearby') AND s.text LIKE '%고래상어%';
   ```

## 6. 코드에서 쓰기

| 언어 | 파일 | 여는 법 |
|------|------|---------|
| Node | `scripts/travel-db.mjs` (모듈) | `openDb(path)` — 읽기 전용, 스키마 버전 확인 |
| PHP | `assets/TravelDb.php` | `new TravelDb($path, imageBase: '/travel/')` — PDO 읽기 전용 |
| Dart·Flutter | `assets/travel_db.dart` | `TravelDb.open(path)` · `TravelDb.openEmbedded(dir, readAsset)` — `sqlite3` 패키지 |

세 구현의 공개 기능은 같다.
- `lang(want)` — 없으면 대체 언어를 돌려준다.
- `dir(lang)` · `languages()` · `terms(kind, lang)`
- `list(filter, lang, limit, offset)` — 전체 수와 행을 돌려준다.
- `search(q, lang, limit, filter)` — 행에 snippet 이 붙는다. filter 는 list 와 같다(Node 는 조회 도구가 거른다).
- `place(slug, lang)` — 블록 JSON 이고, 사진 url 은 절대 주소로 바꿔 준다.
- `near(slug, lang)` — 행에 km 가 붙는다.

PHP 는 `text(slug, lang)`(본문 전체 — SEO·`<noscript>`)도 있다.

```php
$travel = new TravelDb('/var/www/data/travel.db', imageBase: '/travel/');
$lang = $travel->lang($_GET['lang'] ?? 'ko');
$page = $travel->list(['month' => 12, 'category' => 'beach', 'sort' => 'rating'], $lang, limit: 20, offset: 0);
foreach ($page['items'] as $row) { /* $row['title'], $row['image_url'], $row['image_credit'] … */ }
$hits = $travel->search($q, $lang, 100, ['category' => 'diving', 'month' => 3]);  // 행마다 snippet · snippet_html
$place = $travel->place('boracay', $lang); // 배열 — json_encode 해서 페이지에 넣고 renderer.mjs 로 그린다
```

```dart
final travel = TravelDb.open('/path/travel.db', imageBase: 'https://thruthesky.github.io/ph-travel-api/v2/');
final lang = travel.lang('ko');
final page = travel.list(const TravelFilter(month: 12, category: 'beach', sort: 'rating'), lang, limit: 20);
final hits = travel.search('고래상어', lang, filter: const TravelFilter(month: 3));
final place = travel.place('boracay', lang); // Map — TravelBlocks.place(context, place) 로 그린다
```

```js
import { openDb, searchPlaces } from './travel-db.mjs';
const db = openDb('travel.db');
const rows = db.prepare("SELECT slug, title FROM place_list WHERE lang = ? AND category_key = ?").all('ko', 'beach');
const hits = searchPlaces(db, '고래상어', 'ko');
```

- 목록·검색 결과를 보여 줄 때도 대표 사진의 `image_credit` 을 함께 보인다(CC 라이선스).
- 사용자 입력은 모두 바인딩 인자(`?`·`:name`)로 넘긴다. 정렬 열처럼 SQL 에 직접 들어가는 값은 정해진 목록에서만 고른다(세 구현 모두 그렇게 한다).

## 7. 교체와 버전

- **읽기 전용으로 연다.** PHP 는 `Pdo\Sqlite::OPEN_READONLY`(PHP 8.4+, 그 전은 `PDO::SQLITE_OPEN_READONLY`), Dart 는 `OpenMode.readOnly`, Node 는 `{ readOnly: true }` 를 쓴다.
- **바꿀 때는 파일을 통째로.**
  - 서버: 새 파일을 옆 이름으로 올리고 `mv` 로 바꾼다. 같은 디스크 안의 `mv` 는 원자적이다.
  - 앱: `travel.db.version` 이 바뀌면 복사해 둔 DB 를 새로 복사한다.
- **데이터 버전:** `SELECT value FROM meta WHERE key = 'version'` — API 의 version 과 같다. 화면 아래나 로그에 남긴다.
- **스키마 버전:** `PRAGMA user_version`. 스키마를 바꾸면 `travel-schema.sql` 의 값을 올리고, 세 구현의 확인 값도 함께 올린다.

## 8. 검증 기록 (2026-09-28)

세 가지 데이터로 확인했다. 마지막 것이 실제 번역본이다.
- **실제 번역 ko·en·zh** + 자리 표시 5개 언어로 저장소 빌드를 통과시킨 출력 (version e7c4347846d7)
  - 질문 18개(영어·중국어·한국어 — 2글자 중국어 `鲸鲨`·`海滩`, 대소문자 `boracay`·`EL`, 여행지 이름 `长滩岛`)를 DB 3종(8개 언어, `--no-fts`, ko·en·zh)에 넣었다. Node·PHP·Dart 가 같은 곳을 같은 순서로 냈다.
  - 이때 고친 것: 직접 찾기가 요약을 빠뜨림(`--no-fts` 에서 `Boracay` 19곳 → 18곳), 직접 찾기가 대소문자를 가림, 같은 점수의 순서가 구현마다 다름(Dart 비안정 정렬), 이름으로 찾아도 그 여행지가 1위가 아님(bm25 가 긴 본문에 불리 — `Boracay` 1위가 carabao-island).
  - 크기(en·zh 실제 번역, 나머지 자리 표시): 8개 언어 42.8MB · FTS 없이 30.7MB · ko+en+zh 20.6MB. 영어·중국어 실제 글이 자리 표시보다 길어서 앞의 표보다 크다.

그 전에는 두 가지 데이터로 확인했다.
- 다국어 계약 모양의 시험 데이터 (en·ko·ar, 100곳)
- 저장소의 실제 빌드 스크립트가 만든 8개 언어 출력. 번역본만 자리 표시 글자로 채워 빌드를 통과시켰다.

- **DB 만들기:** 약 0.2초. 링크 339개, 달 569개, 사진 293장이 들어갔다. `export` 는 두 번째 실행에서 사진 293장 모두 해시가 같아 건너뛰었다.
- **같은 결과:** Node 도구·PHP 8.5(SQLite 3.53)·Dart `sqlite3` 3.3(SQLite 3.53)이 같은 질문에 같은 결과를 냈다.
  - 목록 거르기, 전문 검색 5종(3글자 이상·짧은 낱말 섞음·영어·따옴표·2글자), 상세 JSON, 가까운 곳
- **입력 처리:** LIKE 특수문자(`%` `_`)를 이스케이프했고, 따옴표가 섞인 검색어도 오류가 없었다.
- **언어 처리:** 없는 언어는 대체 언어로, 없는 slug 는 null 로, 쓰기 SQL 은 거부로 처리됐다.
- **FTS5 trigram:** PHP 에서 한국어·중국어·태국어·아랍어 검색이 모두 동작했다.
- **8개 언어 출력:** 조회 도구가 모든 언어로 거르기·검색·상세를 했고, 분류·권역 이름은 meta.json 의 다국어 이름으로 나왔다. PHP·Dart 결과도 같았다.
