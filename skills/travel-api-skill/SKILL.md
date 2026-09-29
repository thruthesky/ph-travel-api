---
name: travel-api-skill
description: 여행 정보 API(ph-travel-api — 필리핀 여행지 198곳, 8개 언어 en·zh·ja·ko·th·vi·ru·ar, 앞으로 다른 나라도 추가) 전용 스킬. JSON 을 받아 SQLite(travel.db)로 바꿔 언어별 전문 검색·인덱스로 여행지를 찾아 추천·일정·비용·가는 방법·가까운 곳을 답하고, 웹사이트(PHP)·Flutter 앱·정적 웹이 원격 API 대신 데이터를 넣어(임베딩) 쓰도록 DB·파일 만들기, 조회 코드(PHP·Dart), 블록 렌더러(tabs·accordion·card·stepper·pricing 등)를 제공하며, ph-travel-api 저장소의 여행지 추가·번역·검사·배포를 돕는다. 다음 경우 반드시 사용 — (1) 필리핀 여행지·여행 정보 질문(보라카이, 세부, 엘니도, 보홀, 12월에 갈 만한 해변, 예산, 일정, 가는 방법 등, 어느 언어든), (2) ph-travel-api·여행 API·places.json·meta.json·travel.db·SQLite 여행 DB 를 쓰는 웹/앱 개발, 필고 웹사이트·앱에 여행 정보 넣기, 화면 디자인, (3) 여행지 데이터 추가·수정·번역·검사·배포, (4) 사용자가 /travel-api-skill 을 부를 때 — 인자가 update 면 스킬을 최신으로 갱신한다.
metadata:
  version: "2026.09.29.4"
  repo: "https://github.com/thruthesky/ph-travel-api"
---

# travel-api-skill — 여행 정보 API

필리핀 여행지 198곳을 **8개 언어 블록 JSON** 으로 내주는 정적 API 와, 그것을 받아 **SQLite 로 바꿔 넣어 쓰는** 방법이다.
나라 목록은 `scripts/apis.json` 이다(지금은 `ph` 하나). 이 문서의 상대 경로는 모두 **스킬 폴더**(이 SKILL.md 가 있는 폴더) 기준이다.

## 1. 인자 처리

| 인자 | 할 일 |
|------|-------|
| `update` | `bash <스킬 폴더>/scripts/update.sh` 를 실행하고 결과를 그대로 전한다. 결과는 세 가지 중 하나다 — 갱신됨(옛 버전 → 새 버전), 이미 최신, 원본 저장소라 `git pull` 안내. 여기서 끝낸다 |
| (없음) | 이 스킬로 할 수 있는 일(§3 표)을 세 줄로 알리고, 예시 요청 두세 개를 보여 준다 |
| 그 밖 | 사용자의 요청이다. §3 에서 작업 종류를 고른다 |

## 2. 기본 방식 — 받아서 SQLite 로 넣어 쓴다

1. **받기:** JSON(manifest·meta·places.<lang>.json)을 받는다. manifest 의 version 이 바뀌었을 때만 받는다.
2. **SQLite:** `travel.db` 한 파일로 바꾼다(스키마 `assets/travel-schema.sql`).
   - 언어와 무관한 값(좌표·예산·달·사진·분류 key)은 한 번만 넣는다.
   - 언어별 글·단락·태그를 넣는다.
   - 언어별 본문 전체를 FTS5 trigram 으로 색인한다. 띄어쓰기 없는 언어와 한국어 조사까지 부분 문자열로 찾는다.
3. **조회:** SQL·인덱스·전문 검색으로 찾는다.

웹사이트·앱은 원격 API 를 실행 중에 부르지 않는다. 개발 컴퓨터에서 DB·파일을 만들어 제품에 넣는다([embedding.md](references/embedding.md)). 이 스킬의 조회 도구도 같은 방식으로 캐시 DB 를 만들어 답한다.

## 3. 작업 종류 고르기

| 요청 | 할 일 | 먼저 읽을 문서 |
|------|-------|----------------|
| 여행 질문·추천·일정·비용·가는 방법 | §4 — 조회 도구로 DB 에서 찾아 답한다 | 없음 |
| 필고 등 **PHP 웹사이트**에 여행 정보 넣기 | `travel-db.mjs build`·`export` → 서버에 올림 → `assets/TravelDb.php`·`assets/travel-page.php` | [embedding.md](references/embedding.md) §3, [database.md](references/database.md) |
| **Flutter 앱**에 넣기 | `travel.db` 를 애셋에 → `assets/travel_db.dart` 로 읽고 `assets/travel_blocks.dart` 로 그림 | [embedding.md](references/embedding.md) §4 |
| **정적 웹·SPA** 에 넣기 | `export` 폴더 → `renderer.js` | [embedding.md](references/embedding.md) §5, [rendering.md](references/rendering.md) |
| SQL·스키마·검색 규칙 | — | [database.md](references/database.md) |
| 파일 모양·필드·다국어 계약 | — | [api.md](references/api.md) |
| 화면 그리기·디자인 | `assets/renderer.mjs`·`assets/travel_blocks.dart` 를 가져다 고친다 | [rendering.md](references/rendering.md) |
| ph-travel-api 저장소 일 — 여행지 추가·수정·번역, type 추가, 빌드·배포 | §7 절대 규칙을 지키며 절차를 따른다 | [maintain.md](references/maintain.md) |
| 왜 이 구조인가, 남은 일은 | — | [history.md](references/history.md) |

## 4. 여행 질문에 답하기

대화에 JSON 을 통째로 읽지 않는다(언어당 약 2MB). 조회 도구가 캐시 DB(`~/.cache/travel-api-skill/<나라>/travel.db`, 모든 언어)를 만들어 필요한 부분만 꺼낸다.

```bash
travelq() { node <스킬 폴더>/scripts/travel.mjs "$@"; }  # 함수로 — zsh 는 $T 를 낱말로 나누지 않고, t 같은 짧은 이름은 별칭과 겹친다
travelq values                                              # 거르기 값과 개수 — 분류[key]·권역·지역·난이도·태그·달·언어
travelq list --month 12 --category 해변 --difficulty 쉬움 --tag 가족 --sort rating
travelq show 보라카이                                        # slug·id·어느 언어 이름이든 (Boracay·长滩岛)
travelq show el-nido --section getting_there,costs          # 단락만 — 머리말 없이
travelq search 고래상어 스노클링                              # 전문 검색 — 낱말이 모두 들어 있는 곳과 그 문장
travelq --lang en search '"life vest"' --category beach --month 1   # 따옴표는 구절. list 의 거르기를 함께 쓴다
travelq near vigan --limit 5                                # 가까운 곳 (위도,경도 도 된다)
travelq --lang en search whale shark                        # 다른 언어로 — en·zh·ja·ko·th·vi·ru·ar (zh-CN 도 된다)
travelq sql "SELECT category_key, count(*) FROM places GROUP BY 1"   # 어려운 조건은 읽기 전용 SQL (스키마: database.md)
travelq info                                                # version·언어·DB 위치
```

- **언어:** `--lang` 으로 결과 언어를 고른다(기본 ko, 환경변수 `TRAVEL_API_LANG`). 사용자가 쓰는 언어로 찾고 답한다. 표 머리도 그 언어로 나온다.
  - 캐시 DB 에 모든 언어가 있어서 언어를 바꿔도 다시 만들지 않고, 여행지 이름·분류·지역·태그는 어느 언어로 줘도 된다(`--lang en list --tag 가족`).
  - zh 는 **간체·중국 대륙 표기**다. 번체(鯨鯊)·대만 표기(宿霧)로 물으면 간체로 바꿔 찾는다.
- **list 거르기:**
  - 분류·권역·지역·태그는 key(`beach`)나 어느 언어 이름의 일부(`해변`, `Beach`, `海滩`)로 준다. `--tag` 는 여러 번 주면 모두 맞는 곳이다.
  - **태그는 곳마다 대표 5개뿐이다.** 활동(스노클링·고래상어·서핑)은 태그로 거르면 절반쯤 빠진다 — `search` 로 본문 전체를 찾고, 분류·달은 거르기로 더한다.
  - `--max-budget N` 은 예산 범위의 아래 끝이 N 이하인 곳이다(범위가 겹침). 예산 칸 괄호의 기준(1일·투어 1회·당일치기)을 확인한다.
  - `--q` 는 이름·카피·요약·태그만 본다. 본문까지는 `search`.
  - `--sort rating` 은 높은 순, `budget` 은 싼 순이다. 기본 30곳까지 보이고, `--limit` 으로 늘린다.
- **단락 key:** `overview`(한눈에 보기) · `highlights`(꼭 해봐야 할 것) · `itinerary`(추천 일정) · `getting_there`(가는 방법) · `best_time`(최적기와 날씨) · `costs`(예상 비용) · `stay_and_food`(숙소와 먹거리) · `tips`(여행 팁) · `cautions`(주의사항) · `nearby`(함께 가보면 좋은 곳)
- **흔한 조건 → 거르기**

  | 조건 | 거르기 |
  |------|--------|
  | 아이·가족 | `--tag 가족`(대표 태그) — 빠진 곳이 있으니 `search 가족 --category beach` 로도 본다 |
  | 쉬운 곳 | `--difficulty 쉬움` (또는 easy·1) |
  | 싸게 | `--max-budget 2000 --sort budget` — 예산 기준(괄호)이 같은 곳끼리 비교 |
  | 다이빙·스노클링 | `--category diving` 과 `search 스노클링` 을 함께 |
  | 지역 + 활동 | `search 鲸鲨 --region 巴拉望` |
  | 그 밖 | `values` 로 태그를 보고 고르거나 `search`·`sql` 을 쓴다 |

- **search:**
  - 공백과 문장부호(`，`·`、`)로 낱말을 나누고, 모든 낱말이 든 곳을 찾는다. `"…"` 는 붙은 구절이다.
  - 3글자 이상은 FTS5 trigram, 짧은 낱말은 글에서 직접 찾는다. 대소문자는 가리지 않는다.
  - 이름으로 찾으면 그 여행지가, 대표 태그가 맞으면 그곳이 먼저 나온다.
  - 부분 문자열이라 짧은 낱말은 다른 낱말 속에도 걸린다(아이 → 파오아이). 구체적인 표현을 쓴다.
  - 띄어 쓰지 않는 언어(zh·ja·th)는 질문을 **2~4글자 낱말로 띄워** 찾는다 — `和鲸鲨一起游泳` 이 아니라 `鲸鲨 游泳`.
- **달:** `--month` 는 12·12월·12月·Dec 를 받는다. 0곳이어도 불가능하다는 뜻은 아니다 — 연중 가능한 곳(오슬롭)이나 시즌이 긴 곳은 `best_time` 단락을 읽는다.
- **로컬 빌드를 읽을 때**는 `--base <폴더>` 나 `TRAVEL_API_BASE=<폴더>` 를 쓴다. 예: 저장소 안에서 `node scripts/build.mjs` 뒤 `--base _site/v2`.
- **받기 실패:** 받지 못하면 캐시로 답하고, 캐시도 없으면 원인을 한 줄로 알린다(주소 404, API 가 옛 형식 등). Node 22.13 이상이 필요하다(내장 `node:sqlite`).
- **순서:** 여러 조건이면 `list`·`search` 로 후보를 좁히고, 고른 곳을 `show --section` 으로 필요한 단락만 읽고 답한다.

답할 때 지킬 것:

1. **데이터에 있는 것으로 답한다.**
   - 여행지 이름은 `그 언어 이름 (영문 이름)` 으로 쓴다. 예: 보라카이 (Boracay), 长滩岛 (Boracay). 영어로 답할 때는 영문 이름 하나만 쓴다.
   - 데이터에 없는 곳·내용은 "이 API 에는 없다"고 밝힌다. 일반 지식을 보탤 때는 데이터와 구분한다.
2. **금액·요금은 "2026년 기준 대략치"** 라고 밝힌다. 환경세·입장 예약제처럼 자주 바뀌는 규정은 최신 공지를 확인하라고 덧붙인다.
   - 예산은 1인 기준이다. 표의 예산 칸 괄호에 기준(투어 1회, 6박 리브어보드 …)이 붙어 있으면 그 기준을 함께 적는다. 괄호가 없으면 대개 1일이다.
   - 기준이 다른 곳끼리 단순 비교하지 않는다. 자세한 항목은 `costs` 단락을 읽는다.
3. **최적기는 글을 읽는다.** `--month` 는 최적기 글의 모든 기간(목적별 포함)을 합친 달로 거른다(발레르 11~2월은 서핑, 3~5월은 해변). 결과의 최적기 칸이 요청한 목적과 맞는지 본다.
4. **사진 주소를 보여 주면 저작자(credit)를 함께 적는다.** CC 라이선스 조건이다.
5. 비슷한 곳을 권할 때는 `near` 와 그 여행지의 `nearby` 단락을 쓴다.
6. 나라를 말하지 않으면 기본 나라(`ph`)다. `apis.json` 에 없는 나라는 "아직 API 가 없다"고 답한다. 없는 자료를 만들어 내지 않는다.

## 5. 꼭 알아야 할 API 사실

자세한 것은 [api.md](references/api.md) 에 있다.

- **주소:** `https://thruthesky.github.io/ph-travel-api/v2/`
  - `manifest.json` — `{ version, languages, source_language: ko, fallback_language: en, meta, places: { <lang>: 파일 } }`
  - `meta.json` — 언어, 다국어 분류·권역·지역·난이도, 속성·단락, 표시 방법 `display`(type 48개)
  - `places.<lang>.json` — 그 언어의 여행지 전체
  - `images/*.webp` — 사진
- **version 은 전체에 하나다.** 바뀌었을 때만 다시 받는다.
- **모든 언어 파일은 모양이 같다.**
  - 언어 무관 값(id·slug·좌표·예산 숫자·달·사진·링크·분류 key)이 같다.
  - 다른 것은 `translate: true` prop(글)과 `label` 뿐이다.
- **값은 노드다:** `"category": { "type": "badge", "label": "분류", "icon": "beach_access", "value": "beach", "text": "해변·섬" }`
  - `value` 는 언어 공통 key(거르기·링크), `text` 는 그 언어 이름이다.
- **글:** `children` 조각 배열이다. 이어 붙이면 원문이다. 금액·시각·날짜 조각만 따로 꾸민다.
- **사진:**
  - `url` 은 상대 경로 + `?v=<해시>` 이고, `width`·`height` 가 있다.
  - `credit`·`source` 는 반드시 화면에 보인다.
- **호환:** type·키 추가는 호환된다. 모르는 type 은 대체해서 그린다 — `text` → 글, `children` → 문단, `blocks` → 안의 블록, 그 밖은 건너뛴다.

## 6. 코드를 만들 때

- **데이터 만들기 (개발 컴퓨터):**
  - `node scripts/travel-db.mjs build --out travel.db [--langs ko,en] [--no-fts]` — SQLite 와 `travel.db.version`
  - `node scripts/travel-db.mjs export --out <폴더> [--langs …] [--no-images] [--no-json]` — 넣어 쓸 폴더(manifest·meta·places·images/·travel.css·renderer.js). PHP 사이트는 `--no-json`(DB 를 읽으므로 JSON 불필요)
- **PHP 웹사이트:**
  - `assets/TravelDb.php` — 읽기 전용 PDO. list·search·place·near·terms·text 가 있다.
  - `assets/travel-page.php` — 목록(분류·달 거르기·검색)은 서버 HTML, 상세는 renderer.js. 8개 언어 화면 글, JSON-LD·canonical·hreflang·noscript 포함. 설정 다섯 줄(경로·공개 주소 `TRAVEL_ORIGIN`·기본 언어)만 고친다.
  - DB 와 `TravelDb.php` 는 웹 루트 밖에 둔다. 서버 SQLite 3.34+ 를 확인하고, 올릴 때는 사진 더하기 → `.new` 로 올려 검사 → `mv` → 옛 사진 지우기 순서다([embedding.md](references/embedding.md) §3.2).
- **Flutter 앱:**
  - `assets/travel_db.dart` — `sqlite3` 패키지. `openEmbedded` 가 애셋 DB 를 버전이 바뀔 때만 복사한다.
  - `assets/travel_blocks.dart` — 48개 type 위젯, RTL 을 지원한다.
  - 필고 앱은 공용 라이브러리(`apps/lib/src/travel/`)에 둔다.
- **정적 웹:** `export` 폴더 + `renderer.js`(`renderPlace`·`renderPlaceCard`·`enhance`) + `travel.css`.
- **언어:**
  - 없는 언어는 대체 언어(en)로 보인다.
  - 아랍어는 `dir="rtl"`(웹)·`Directionality(rtl)`(Flutter)을 준다.
  - 거르기는 `value`·`months`·`difficulty` 값으로 한다. `text` 는 언어마다 다르다.
- **지킬 것:**
  - 모르는 type 의 대체 규칙을 구현한다.
  - 사진 저작자 표기를 보인다.
  - DB 는 읽기 전용으로 연다.
  - 사용자 입력은 바인딩 인자로만 넘긴다.
- **만든 뒤 스스로 확인한다.**
  - 예외만 보지 말고 사진 저작자 글이 실제로 보이는지 확인한다.
  - DB·파일에 넣은 언어마다 목록·검색·상세를 돌려 본다. 아랍어를 넣었다면 오른쪽→왼쪽도 본다.

## 7. ph-travel-api 저장소에서 일할 때 — 절대 규칙

절차·검사·검증은 [maintain.md](references/maintain.md) 에 있다.

1. **`main` push 는 곧 운영 배포다.** push 는 사용자가 요청할 때만 하고, 작업은 커밋까지만 한다.
2. **push 전에 `node scripts/build.mjs` 가 성공해야 한다.** 실패하면 JSON 을 쓰지 않고 exit 1 이다.
3. `_site/` 는 커밋하지 않는다. 외부 npm 패키지를 넣지 않는다.
4. **원본은 한국어 `data/ko/` 다.** 원본을 먼저 고치고 번역본(7개 언어)은 `scripts/i18n.mjs` 로 맞춘다(`data/README.md` §7). 필고의 `apps/travel/data/travel/` 은 옛 사본이다.
5. 스킬을 고치면 `metadata.version` 을 올린다. 입구 `.claude/skills/travel-api-skill/SKILL.md` 의 description 도 같게 맞춘다.

## 8. 스킬 파일

| 파일 | 내용 |
|------|------|
| `scripts/travel.mjs` | 조회 도구 — list·show·search·near·values·types·sql·info·countries, `--lang` (캐시 SQLite DB 로 답함) |
| `scripts/travel-db.mjs` | 받기(sync)·SQLite 만들기(build)·넣어 쓸 폴더(export). 모듈로도 쓴다 (Node 22.13+, 외부 패키지 없음) |
| `scripts/apis.json` | 나라별 API 주소 목록 |
| `scripts/update.sh` | `/travel-api-skill update` — 최신 스킬 묶음을 받아 이 폴더를 바꾼다 |
| `assets/travel-schema.sql` | SQLite 스키마 — 표·인덱스·FTS5 trigram·목록 뷰 |
| `assets/TravelDb.php` · `assets/travel-page.php` | PHP 조회 클래스 · 예시 페이지 |
| `assets/travel_db.dart` | Dart·Flutter 조회 클래스 (sqlite3) |
| `assets/renderer.mjs` · `assets/travel_blocks.dart` | 웹 · Flutter 블록 렌더러 (48개 type, RTL) |
| `references/embedding.md` | 넣어 쓰기 — 원칙, PHP 웹·Flutter 앱·정적 웹 절차 |
| `references/database.md` | SQLite 스키마·만들기·쿼리 모음·검색 규칙·세 구현 |
| `references/api.md` | API 계약 — manifest·meta·places.<lang>·불변식·받기 코드 |
| `references/rendering.md` | 표시 방법(meta.display)·권장 위젯·렌더러 사용법 |
| `references/maintain.md` | 저장소 구조·명령·규격 검사·규칙·작업·검증·새 나라 |
| `references/history.md` | 현재 상태·남은 일·결정 기록 |
