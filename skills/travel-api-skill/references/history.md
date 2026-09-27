# 현재 상태와 결정 기록

왜 지금 모양이 되었는지와 남은 일이다. 구조를 크게 바꾸기 전에 읽는다.

## 1. 현재 상태 (2026-09-28)

- **완료:**
  - 자료 이전, 빌드 스크립트, Pages 배포(v1, version `68cef818ff36`).
    - Pages 는 `gh api -X POST repos/thruthesky/ph-travel-api/pages -f build_type=workflow` 로 켰다.
    - 공개 주소에서 JSON 과 사진 293장 응답을 검증했다.
  - 마크다운 → 블록 JSON 변환, 표시 방법 목록, v2 빌드.
    - 변환은 일회성 스크립트로 했다.
    - 원문 1,000개 단락의 보이는 글자(마크다운 기호·공백 제외)가 순서까지 JSON 과 일치함을 확인했다. 앞머리 25개 키도 모두 일치했다.
    - 031~040 번 끝에 섞여 있던 도구 태그 줄(`</content>`, `</invoke>`)은 이때 지웠다.
  - AI 스킬 `travel-api-skill`
    - AGENTS.md 의 안내를 이 스킬로 옮겼다.
    - 조회 도구(`scripts/travel.mjs`), 자체 업데이트(`scripts/update.sh`), 웹·Flutter 참고 렌더러(`assets/`)를 넣었다.
  - (2026-09-28) 8개 언어 번역과 `meta.json`. 계약은 [api.md](api.md) §1~5 에 있다.
    - 원본 ko, 번역 en·zh·ja·th·vi·ru·ar
    - 출력 `v2/` 바로 아래 `places.<lang>.json` 8개 + `meta.json`. `content_display_type.json` 은 `meta.display` 로 합쳤다
  - (2026-09-28) 스킬 — 넣어 쓰기(임베딩)와 SQLite
    - `travel-db.mjs`(sync·build·export), `assets/travel-schema.sql`
    - 조회 구현 `TravelDb.php`·`travel_db.dart`, 예시 페이지 `travel-page.php`
    - `travel.mjs` 는 SQLite 캐시 DB 로 답하도록 바꿨다(`--lang`, `sql` 명령)
- **남은 일:**
  - v2(다국어)와 스킬 묶음을 push 해 배포한다. push 전까지 공개 주소는 v1 이고 `/v2/`·스킬 묶음은 404 다.
  - 스킬의 SQLite·조회 구현·렌더러는 두 가지로 검증했다.
    - 다국어 계약 모양의 시험 데이터
    - 저장소 빌드 스크립트가 만든 8개 언어 출력. 번역본은 자리 표시 글자였다.
  - 실제 번역본이 들어오면 두 가지를 다시 한다. `travel-db.mjs build --base _site/v2` 로 DB 크기를 확인하고, 세 조회 구현의 결과를 비교한다.
  - 필고 Flutter 앱(`apps/travel`)을 v2 로 바꾼다.
    - `travel-db.mjs build --langs <앱 언어들>` 로 만든 `travel.db` 를 애셋에 넣는다.
    - `assets/travel_db.dart` 로 읽고 `assets/travel_blocks.dart` 로 그린다. 두 파일은 필고 공용 라이브러리로 옮겨 쓴다([embedding.md](embedding.md) §4).
  - 필고 웹사이트에 여행 정보를 넣는다 — `travel.db` + `export` 폴더 + `TravelDb.php`([embedding.md](embedding.md) §3).
  - 바꾼 뒤 필고의 `apps/travel/data/travel/`(옛 마크다운 사본)을 지운다.
  - 오프라인 첫 실행용으로 `places.json` 스냅샷 하나만 번들에 남길지 정한다.
  - 필고의 `apps/travel/test/widget_test.dart` 는 그 사본을 검사하고 있으므로 함께 정리한다.
  - 필고 앱의 현재 코드:
    - 모델: `apps/lib/src/travel/travel_place.model.dart` 의 `TravelPlace.fromMarkdown()`
    - 상태: `apps/lib/src/travel/travel.state.dart`
    - 진입점: `apps/travel/lib/main.dart` 의 `TravelState(assetDir: 'data/travel')` — 번들 md 를 읽는다

## 2. 왜 GitHub Pages 인가

- **요구 사항:** git push 만으로 배포, 읽기 전용 정적 데이터, 웹·앱이 받아 저장하고 업데이트 확인.
- **비교한 방법:**
  - Cloudflare Workers Static Assets + Workers Builds: 무료이고 요청 수 무제한이다. 계정 연결과 Worker 설정이 필요하다.
  - Cloudflare R2 + GitHub Actions: 비밀 키 관리가 필요하고, 캐시 무효화를 직접 설계해야 한다.
  - GitHub Pages: 모든 것이 GitHub 안에서 끝나서 가장 간단하다. → **선택.**
- **GitHub Pages 의 한계:**
  - 응답 헤더를 바꿀 수 없다. `Cache-Control: max-age=600` 이 고정이라, push 후 클라이언트에 보이기까지 최대 10분 걸린다.
  - 사이트는 1GB 까지다. 전송량은 월 100GB 권장 한도다.
  - 배포는 10분 안에 끝나야 한다.
- **옮겨야 할 때:** 한계를 넘거나 헤더를 제어해야 하면 옮긴다.
  - 1순위는 Cloudflare Workers Static Assets 다(무료 20,000 파일, 파일당 25MiB).
  - 사진만 매우 커지면 사진만 R2 로 옮긴다.
  - JSON 의 사진 url 이 상대 경로이므로, 계약([api.md](api.md) §4)을 지키면 클라이언트 코드를 거의 고치지 않고 옮길 수 있다.

## 3. 왜 블록 JSON 인가 (2026-09-27)

- **요구 사항:** 웹·앱이 속성·문단·낱말마다 다른 디자인을 입힐 수 있어야 한다. 표시 방법(content_display_type)을 미리 정해 JSON 과 함께 내려야 한다.
- **비교한 방법:**
  - Quill Delta(`insert` + `attributes`): 글 꾸밈에는 가볍지만 탭·카드·표 같은 구조를 담기 어렵다.
  - Draft.js 식 offset 스타일: 글자 위치로 꾸밈을 적는다. Dart(UTF-16)·JS·서버의 글자 세기가 달라 어긋나기 쉽다.
  - Editor.js 식 블록 + Slate 식 조각: 문단·위젯은 블록, 글 안의 꾸밈은 조각 배열로 쓴다. → **선택.**
- **선택한 모양:**
  - 블록은 `type` + 데이터다. 블록 안의 블록은 `blocks`, 글은 `children` 조각 배열에 담는다.
  - 조각은 `{ text, type?, bold? … }` 다. 이어 붙이면 원문이 되므로 검색·복사·음성 읽기가 쉽다.
  - 속성마다 type 을 붙였다. 목록 거르기용 값(`months`·`min`·`max`·`code`·`value`)은 같은 노드 안에 둔다.
- **표시 방법 목록을 데이터로 둔 이유:**
  - 목록의 `props` 가 곧 검사 규격이라서 문서와 검사가 어긋날 수 없다.
  - 클라이언트도 같은 파일로 무엇을 구현할지(`used`) 안다.
- **v1 을 없앤 이유:**
  - v1 은 같은 날 처음 배포됐다. 필고 앱은 아직 번들 md 를 읽고 있어서 v1 을 받는 클라이언트가 없었다.
  - 마크다운 원본이 사라지므로 v1 을 유지하려면 JSON → 마크다운 역변환이 필요하다. 쓰는 곳이 없어서 만들지 않았다.
- **문장 단위는 나누지 않았다.** 단락은 블록, 낱말·표현은 조각이다. 문장까지 나누면 JSON 이 커지고 렌더러가 복잡해진다. 그에 비해 쓰임이 적다.

## 4. 왜 스킬로 옮기고 Pages 로 나눠 주는가 (2026-09-27)

- **AGENTS.md 를 스킬로 옮긴 이유:**
  - 이 저장소 밖(필고 앱, 다른 웹 프로젝트)에서 API 를 쓰는 AI 도 같은 지식이 필요하다.
  - AGENTS.md 는 저장소 안에서만 읽힌다. 스킬은 어디에나 설치해 `/travel-api-skill` 로 부를 수 있다.
  - AGENTS.md 에는 스킬을 가리키는 안내와 절대 규칙만 남겼다.
- **원본은 `skills/travel-api-skill/`, 입구는 `.claude/skills/travel-api-skill/SKILL.md`:**
  - 설치용 폴더와 이 저장소의 Claude Code 가 읽는 폴더를 나눴다.
  - 입구 SKILL.md 가 원본을 읽으라고 안내한다. 디렉터리 심볼릭 링크를 쓰지 않은 이유는 두 가지다. 도구마다 심볼릭 링크를 따라가는 동작이 달라서다. 그리고 참조 경로가 설치 위치에서도 그대로 맞아야 해서다.
- **스킬 묶음을 Pages 로 나눠 주는 이유:**
  - GitHub 의 저장소 tarball 은 사진(23MB)까지 받는다.
  - 빌드가 스킬 폴더만 tar.gz 로 묶어 Pages 에 올리면 설치·`update` 가 수십 KB 로 끝난다. 명령도 `curl … | tar -xz` 한 줄이다.
- **나라가 늘어날 것에 대비:**
  - 스킬 이름에 나라를 넣지 않았다(`travel-api-skill`).
  - 나라 목록을 `scripts/apis.json` 으로 뺐다. 새 나라는 같은 구조의 저장소 + 한 줄 추가로 끝난다.

## 5. 왜 8개 언어를 파일 이름으로 나누는가 (2026-09-28)

- 언어 폴더(`v2/ko/places.json`) 대신 파일 이름(`v2/places.ko.json`)으로 나눴다.
  - 사진 url `images/…` 가 어느 언어 파일에서나 같은 폴더 기준으로 맞는다.
  - 사진을 언어마다 복사하지 않는다.
- version 은 전체에 하나다(meta + 모든 언어 places). 클라이언트는 manifest 하나만 보고 무엇이 바뀌었는지 안다.
- 언어 무관 값(좌표·예산 숫자·사진·링크 …)은 파일마다 반복된다. 빌드가 원본(ko)과 같은지 검사한다. 그래서 어느 언어 파일 하나만 받아도 완전하다 — 앱은 필요한 언어만 넣으면 된다.
- 분류·권역·지역 노드에 언어 공통 key(`value`)를 넣었다. 언어가 바뀌어도 거르기·링크·DB 키가 같다.

## 6. 왜 넣어 쓰기(임베딩)와 SQLite 인가 (2026-09-28)

- **요구 사항:**
  - 웹·앱은 원격 API 를 실행 중에 부르지 않고, 데이터를 받아 제품에 넣어 쓴다.
  - 8개 언어의 본문을 언어별로 검색할 수 있어야 한다.
  - 필고 웹은 로컬에서 만든 DB 파일을 서버에 올려 PHP 로 조회한다.
- **넣어 쓰는 이유:** 오프라인·첫 화면 속도, Pages 전송량 한도와 무관, 데이터 버전 고정, 방문 기록이 외부에 남지 않음([embedding.md](embedding.md) §1).
- **SQLite 를 고른 이유:**
  - 파일 하나라 올리기·넣기가 쉽다.
  - PHP·Dart·Node·Python 이 모두 읽는다.
  - FTS5·인덱스가 있다.
  - 비교한 것: 언어별 JSON 을 메모리에서 훑기는 정적 웹·단순 앱에 충분하다(embedding.md §5). 하지만 서버 검색·다국어 전문 검색에는 색인이 낫다.
- **FTS5 trigram 을 고른 이유:**
  - `unicode61` 토크나이저는 띄어쓰기로 낱말을 자른다. 그래서 중국어·일본어·태국어는 문장 전체가 한 낱말이 되고, 한국어는 조사 때문에 "엘니도"로 "엘니도에서"를 못 찾는다.
  - trigram 은 3글자 단위 부분 문자열이라 모든 언어에서 동작한다.
  - 대가 두 가지: 3글자 미만을 못 찾아서 글에서 직접 찾아 보완한다. 색인이 커서 언어당 약 1.4MB 다.
- **외부 콘텐츠 FTS · 일반(rowid) 표:**
  - 처음 스키마(WITHOUT ROWID + FTS 가 글 복사)는 3개 언어에 20.7MB 였다.
  - 바꾼 뒤 15.1MB 가 됐다.
- **DB 를 API 로 배포하지 않은 이유:**
  - API 는 JSON 만 내고, DB 는 쓰는 쪽이 스킬 도구로 만든다.
  - 언어·FTS 여부를 제품마다 고르고, 스키마를 스킬과 함께 바꿀 수 있다.
  - 모든 언어 DB 를 Pages 에 올리면 한 파일이 40MB 안팎이 된다.
  - 필요해지면 빌드에 `travel-db.mjs build` 를 더해 `_site/v2/travel.db` 로 낼 수 있다.
- **Node 도구가 내장 `node:sqlite` 를 쓰는 이유:** 외부 패키지 금지 원칙을 지킨다. Node 22.13+ 가 필요하다(Actions·개발 환경은 24).
