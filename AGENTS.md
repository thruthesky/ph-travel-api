# 필리핀 여행 정보 API

> 이 저장소에서 일하는 AI 코딩 에이전트용 안내서다. 작업 전에 끝까지 읽는다.
> JSON 필드 표와 클라이언트 절차의 전문은 [README.md](README.md), 여행지 마크다운 작성 규격은 [data/README.md](data/README.md) 에 있다.
> 모든 응답·주석·커밋 메시지는 **한글**로 쓴다 (코드·경로·명령어 제외).

## 1. 한눈에 보기

| 항목 | 값 |
|------|----|
| 정체 | 필리핀 여행지 100선을 JSON 으로 내주는 **정적 API**. 서버 코드·DB 없음 |
| 공개 주소 | `https://thruthesky.github.io/ph-travel-api/v1/manifest.json` |
| 호스팅 | GitHub Pages (Source: **GitHub Actions**) |
| 배포 | `main` 에 push → [deploy.yml](.github/workflows/deploy.yml) → `node scripts/build.mjs` → Pages. 1~2분 |
| 원본 | `data/*.md` 여행지 100개 · `data/images/*.webp` 사진 293장 (23MB) |
| 빌드 결과 | `_site/v1/` — `manifest.json` · `places.json` (1.3MB, gzip 약 414KB) · `images/` |
| 저장소 | `github.com/thruthesky/ph-travel-api` (공개) |
| 상위 프로젝트 | 필고 저장소(`thruthesky/philgo`)의 서브모듈 `submodules/ph-travel-api` |

- 2026-09-27 에 필고의 `apps/travel/data/travel/` 에서 옮겨 왔다. **여행지 자료의 원본은 이제 이 저장소다.**
- 첫 배포 version 은 `68cef818ff36` 이다.

## 2. 폴더 구조

```
ph-travel-api/
├─ AGENTS.md                     ← 이 파일
├─ README.md                     ← API 형식·클라이언트 절차 (사람·클라이언트 개발자용)
├─ .github/workflows/deploy.yml  ← main push → 빌드 → Pages 배포
├─ .gitignore                    ← _site/ 제외
├─ scripts/build.mjs             ← md → JSON 변환 + 규격 검사 (외부 패키지 없음)
├─ data/
│  ├─ README.md                  ← 여행지 마크다운 작성 규격
│  ├─ 001-intramuros.md … 100-dahican-beach.md
│  └─ images/<번호>-<slug>[-2|-3].webp
└─ _site/                        ← 빌드 결과 (git 에 넣지 않음)
```

## 3. 명령

| 할 일 | 명령 (저장소 루트에서) |
|------|------|
| 빌드 + 규격 검사 | `node scripts/build.mjs` — 성공하면 `여행지 N곳 → _site/v1/ (version …)`, 실패하면 오류 목록과 exit 1 |
| 로컬에서 응답 확인 | `cd _site && python3 -m http.server 8765` → `http://127.0.0.1:8765/v1/manifest.json` |
| 배포 진행 상황 | `gh run list --limit 3` · `gh run watch` |
| 배포 결과 확인 | `curl -s https://thruthesky.github.io/ph-travel-api/v1/manifest.json` |
| Pages 설정 확인 | `gh api repos/thruthesky/ph-travel-api/pages --jq .build_type` → `workflow` 여야 한다 |

- Node 는 24 를 쓴다(Actions 와 같다). `npm install` 할 것이 없다.

## 4. API 계약 — 클라이언트가 믿고 있는 불변식

이 절의 내용을 바꾸면 이미 설치된 앱이 깨진다. 바꾸기 전에 §6 의 규칙을 따른다.

| 파일 | 내용 |
|------|------|
| `v1/manifest.json` | `{ schema, version, count, places: "places.json", generated_at }` — 클라이언트가 주기적으로 받는 작은 파일 |
| `v1/places.json` | `{ schema, version, count, places: [ … ] }` — 여행지 전체, `id` 오름차순 |
| `v1/images/*.webp` | 사진. JSON 의 `url` 로만 접근한다 |

1. **`version` 은 내용 해시다.** `sha256(JSON.stringify(places))` 의 앞 12자리다.
   - 같은 내용이면 어디서 빌드해도 같은 값이 나온다.
   - README 나 스크립트 주석만 고친 push 는 version 이 그대로라서 클라이언트가 다시 받지 않는다.
   - `generated_at` 은 참고용이다. **해시에 넣지 않는다.**
2. **사진 `url` 은 `images/030-vigan.webp?v=2869bd00` 형식이다.**
   - places.json 이 있는 폴더(`v1/`) 기준 상대 경로다.
   - `?v=` 는 사진 파일의 sha256 앞 8자리다. 사진이 바뀌면 url 도 바뀌므로 클라이언트는 url 을 키로 오래 캐시한다.
   - 사진 url 이 version 계산에 들어가므로, 사진만 바꿔도 version 이 바뀐다.
3. **키 이름은 앞머리 키와 같은 snake_case 다.** 예외는 둘이다.
   - `image` 는 `{ url, credit, source }` 객체다.
   - `gallery` 는 같은 객체의 배열이며, 사진이 없으면 `[]` 이다.
4. **`sections` 는 `[{ title, markdown }]` 10개다.** 규격 순서 그대로이고, markdown 은 **원문 그대로**다.
   - `[**엘니도**](place:el-nido)` 는 다른 여행지로 가는 링크다.
   - `~` 는 범위 표기(`3시간~4시간`)다. 이스케이프는 클라이언트가 렌더링할 때 한다.
5. **`credit`·`source` 는 CC 라이선스 저작자 표기다.** 클라이언트 화면에 반드시 보여야 한다.

필드별 형식 표: [README.md](README.md) §2·§3

## 5. 빌드 스크립트가 막는 것 — 규격 검사

`scripts/build.mjs` 는 아래 중 하나라도 어기면 **JSON 을 쓰지 않고 exit 1** 로 끝난다. Actions 도 멈추므로 공개 주소에는 이전 배포가 그대로 남는다.

- **파일 이름:** `<id 3자리>-<slug>.md` 와 앞머리의 `id`·`slug` 가 일치해야 한다.
  - 번호로 시작하는 `.md` 만 여행지로 읽는다.
  - 이 형식이라 `id` 는 1~999 까지만 쓸 수 있다.
- **slug:** `^[a-z0-9-]+$` 형식이어야 하고, `id`·`slug` 는 서로 겹치면 안 된다.
- **필수 문자열이 비어 있으면 안 된다:** `title` `title_en` `tagline` `region` `location` `best_season` `duration` `budget` `airport` `image` `image_credit` `image_source` `summary`
- **정해진 값 중 하나여야 한다:**
  - `island_group` = 루손·비사야·민다나오
  - `category` = 해변·섬, 다이빙·해양, 산·트레킹, 폭포·호수·강, 역사·문화, 도시·미식, 자연 경관
  - `difficulty` = 쉬움·보통·어려움
- **숫자 범위:**
  - `tags` 3~6개
  - `rating` 4.0~5.0
  - `latitude` 4~22, `longitude` 116~127 (필리핀 영역)
- **본문:**
  - `##` 단락 10개가 규격 제목·순서와 정확히 같아야 하고, 빈 단락이 없어야 한다.
  - 코드 블록(```)은 쓸 수 없다.
  - 본문은 2,500자를 넘어야 한다.
- **사진:**
  - 경로는 `images/[a-z0-9-]+\.webp` 형식이고 파일이 실제로 있어야 한다.
  - 저작자 표기가 있어야 하고, 원본 주소는 `https://` 로 시작해야 한다.
  - `gallery`·`gallery_credits`·`gallery_sources` 의 개수가 같아야 한다.
- **링크:** `place:<slug>` 는 실제로 있는 여행지를 가리켜야 하고, 자기 자신을 가리키면 안 된다.

## 6. 규칙

1. **`main` push 는 곧 운영 배포다.**
   - 필고 프로젝트 규칙에 따라 push 는 사용자가 요청할 때만 한다.
   - 작업을 마치면 커밋까지만 한다.
2. **push 전에 반드시 `node scripts/build.mjs` 가 성공해야 한다.**
3. **`_site/` 는 커밋하지 않는다.** 배포 때 Actions 가 새로 만든다.
4. **외부 npm 패키지를 넣지 않는다.** 빌드는 Node 기본 모듈만 쓴다. 그래서 `package.json` 도 없다.
5. **JSON 구조 변경 규칙:**
   - **키 추가는 호환된다.** 클라이언트는 모르는 키를 무시해야 한다.
   - **키 삭제·이름 변경·형식 변경은 호환되지 않는다.** 이때는 다음 순서를 따른다.
     1. `SCHEMA` 를 올린다.
     2. 출력 경로를 `_site/v2/` 로 새로 만든다.
     3. 옛 앱이 남아 있는 동안 `v1/` 도 함께 빌드한다.
6. **version 은 결정적이어야 한다.** 시각·난수·파일 순서처럼 빌드할 때마다 달라지는 값을 `places` 안에 넣지 않는다. 여행지 순서는 `id` 로 정렬한다.
7. **규격을 바꾸면 세 곳을 함께 고친다.**
   - `scripts/build.mjs` 의 상수(`ISLAND_GROUPS`·`CATEGORIES`·`DIFFICULTIES`·`REQUIRED_TEXT`·`SECTIONS`)
   - [data/README.md](data/README.md)
   - 필고 앱의 `apps/lib/src/travel/travel_category.dart` (분류를 바꿀 때)
8. **서브모듈 커밋 순서:** 이 저장소에서 먼저 커밋·push 한 뒤, 필고 저장소에서 `submodules/ph-travel-api` 포인터를 커밋한다.
9. **필고의 `apps/travel/data/travel/` 은 사본이다.** 앱이 아직 번들 자료를 읽고 있어서 남겨 둔 것이다(§9). 여행지 내용은 **이 저장소에서만** 고친다.

## 7. 자주 하는 작업

### 7.1 여행지 추가

1. 비어 있는 번호로 `data/<id 3자리>-<slug>.md` 를 만든다. 앞머리와 본문 형식은 [data/README.md](data/README.md) 를 그대로 따른다.
2. 사진을 준비한다.
   - Wikimedia Commons 의 CC·퍼블릭 도메인 사진을 1080px WebP 로 줄여 `data/images/<같은 이름>.webp` 에 둔다.
   - 추가 사진은 `-2`, `-3` 을 붙인다.
3. `image_credit`(작가 / 라이선스 / 출처)와 `image_source`(원본 페이지)를 적는다. 추가 사진은 `gallery*` 세 키에 ` | ` 로 나눠 같은 순서로 적는다.
4. 다른 여행지 본문의 「함께 가보면 좋은 곳」에서 `place:<slug>` 로 새 여행지를 연결하면 좋다.
5. `node scripts/build.mjs` → 커밋.

### 7.2 수정·삭제·사진 교체

- **내용 수정:** md 를 고치고 빌드·커밋한다. version 이 바뀌므로 클라이언트가 다음 확인 때 새로 받는다.
- **삭제:**
  1. md 와 그 여행지의 사진을 지운다.
  2. 다른 여행지 본문에서 그 slug 를 가리키는 `place:` 링크를 지우거나 바꾼다. 남아 있으면 빌드가 실패한다.
  - 클라이언트는 places.json 을 통째로 바꾸므로 삭제도 그대로 반영된다.
- **사진 교체:** 같은 파일 이름으로 덮어쓰면 된다. `?v=` 해시가 바뀌므로 옛 캐시가 남지 않는다.

### 7.3 JSON 에 새 필드 추가

1. `scripts/build.mjs` 의 `parsePlace()` 반환 객체에 키를 넣는다. 필수라면 검사도 추가한다.
2. [README.md](README.md) §3 의 필드 표와 [data/README.md](data/README.md) 의 앞머리 규격에 적는다.
3. 키 추가는 호환되므로 `SCHEMA` 는 그대로 둔다(§6-5).

### 7.4 클라이언트(웹·앱) 구현

절차 전문은 [README.md](README.md) §4 에 있다. 요약하면 다음과 같다.

1. 처음 실행하면 manifest 를 받고, 이어서 places.json 을 받는다. 받은 것을 기기에 저장하고 version 도 저장한다.
2. 앱 시작·포그라운드 복귀 때 manifest 를 다시 받는다(예: 6시간 간격). version 이 다르면 `places.json?v=<version>` 을 받는다.
3. 받은 파일의 `schema`·`count` 를 확인한 뒤 저장본을 통째로 바꾼다. 실패하면 기존 저장본을 그대로 쓴다.
4. 사진은 미리 받지 않는다. 화면에 보일 때 받아 url 을 키로 디스크에 캐시한다.
5. 웹은 IndexedDB 에 저장한다. CORS 는 Pages 가 `*` 로 열어 두었다.

필고 Flutter 앱 쪽의 현재 코드는 다음과 같다.

- **모델:** `apps/lib/src/travel/travel_place.model.dart` 의 `TravelPlace.fromMarkdown()`
  - JSON 키와 1:1 로 대응한다(snake_case → camelCase).
  - JSON 을 읽는 `fromJson` 은 아직 없다.
- **상태:** `apps/lib/src/travel/travel.state.dart`
- **앱 진입점:** `apps/travel/lib/main.dart` 의 `TravelState(assetDir: 'data/travel')` — 번들 md 를 읽는다.
- **렌더링:** 앱은 이미 `~` 를 `\~` 로 이스케이프하고, `place:` 링크를 앱 안 이동으로 처리한다.

## 8. 검증 방법

"빌드 성공"만으로 완료라고 하지 않는다. 바꾼 범위에 맞춰 아래를 확인한다.

1. **빌드:** `node scripts/build.mjs` 가 exit 0 으로 끝나는지, 출력된 version 이 기대와 맞는지 본다.
   - 내용을 바꿨으면 version 이 바뀌어야 한다.
   - 문서만 바꿨으면 version 이 그대로여야 한다.
2. **로컬 응답:** `_site` 를 로컬 서버로 띄워 다음을 확인한다.
   - manifest → `places.json?v=<version>` 순서로 받아 `version`·`count` 가 일치한다.
   - 모든 `image.url`·`gallery[].url` 이 200 이다.
3. **오류 차단:** 검사 규칙을 바꿨다면 다음을 확인한다.
   - 스크래치 폴더에 `scripts/`·`data/` 를 복사한다.
   - 일부러 규격을 어긴 파일을 만들어 빌드한다.
   - exit 1 과 오류 메시지가 나오는지 본다.
4. **앱 파서와 같은지:** 파싱 로직을 바꿨다면 확인한다.
   - 필고의 `travel_place.model.dart` 를 스크래치 폴더에 복사한다(Flutter 없이 `dart run` 으로 돈다).
   - 100곳의 모든 필드를 places.json 과 비교한다.
   - 2026-09-27 에 이 방식으로 비교해 차이 0건을 확인했다.
5. **배포 후:** 다음을 확인한다.
   - `gh run list` 가 `completed success` 다.
   - 공개 주소의 manifest version 이 로컬 빌드와 같다.
   - `content-type: application/json; charset=utf-8` 이 붙어 있다.
   - 사진이 `image/webp` 로 내려온다.

## 9. 현재 상태 (2026-09-27)

- **완료:** 자료 이전, 빌드 스크립트, Pages 배포.
  - Pages 는 `gh api -X POST repos/thruthesky/ph-travel-api/pages -f build_type=workflow` 로 켰다.
  - 공개 주소에서 JSON 과 사진 293장 응답을 검증했다.
- **남은 일:** 필고 Flutter 앱(`apps/travel`)을 §7.4 방식으로 바꾼다.
  - 바꾼 뒤 필고의 `apps/travel/data/travel/` 을 지운다.
  - 오프라인 첫 실행용으로 `places.json` 스냅샷 하나만 번들에 남길지 정한다.
  - 필고의 `apps/travel/test/widget_test.dart` 는 그 사본을 검사하고 있으므로 함께 정리한다.

## 10. 왜 GitHub Pages 인가 — 결정 기록

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
  - JSON 의 사진 url 이 상대 경로이므로, 이 계약(§4)을 지키면 클라이언트 코드를 거의 고치지 않고 옮길 수 있다.
