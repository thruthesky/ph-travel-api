---
name: travel-api-skill
description: 여행 정보 API(ph-travel-api — 필리핀 여행지 100선, 앞으로 다른 나라도 추가) 전용 스킬. 공개 정적 JSON API(https://thruthesky.github.io/ph-travel-api/v2/)에서 여행지를 찾아 추천·일정·비용·가는 방법·주의사항·가까운 곳을 답하고, 웹·Flutter 앱이 places.json·content_display_type.json 을 받아 저장·업데이트하고 블록(tabs·accordion·card·stepper·pricing 등)으로 그리는 코드를 만들며, ph-travel-api 저장소의 여행지 JSON 추가·수정·규격 검사·배포를 돕는다. 다음 경우 반드시 사용 — (1) 필리핀 여행지·여행 정보 질문(보라카이, 세부, 엘니도, 보홀, 12월에 갈 만한 해변, 예산, 일정, 가는 방법 등), (2) ph-travel-api·여행 API·places.json·manifest.json·content_display_type 을 쓰는 웹/앱 개발과 화면 디자인, (3) 여행지 데이터 추가·수정·검사·배포, (4) 사용자가 /travel-api-skill 을 부를 때 — 인자가 update 면 스킬을 최신으로 갱신한다.
metadata:
  version: "2026.09.27"
  repo: "https://github.com/thruthesky/ph-travel-api"
---

# travel-api-skill — 여행 정보 API

필리핀 여행지 100선을 **블록 JSON** 으로 내주는 정적 API 와, 그것을 읽고·그리고·고치는 방법이다.
나라 목록은 `scripts/apis.json` 이다(지금은 `ph` 하나). 이 문서의 상대 경로는 모두 **스킬 폴더**(이 SKILL.md 가 있는 폴더) 기준이다.

## 1. 인자 처리

| 인자 | 할 일 |
|------|-------|
| `update` | `bash <스킬 폴더>/scripts/update.sh` 를 실행하고 결과를 그대로 전한다. 결과는 세 가지 중 하나다 — 갱신됨(옛 버전 → 새 버전), 이미 최신, 원본 저장소라 `git pull` 안내. 여기서 끝낸다 |
| (없음) | 이 스킬로 할 수 있는 일(§2 표)을 세 줄로 알리고, 예시 요청 두세 개를 보여 준다 |
| 그 밖 | 사용자의 요청이다. §2 에서 작업 종류를 고른다 |

## 2. 작업 종류 고르기

| 요청 | 할 일 | 먼저 읽을 문서 |
|------|-------|----------------|
| 여행 질문·추천·일정·비용·가는 방법 | §3 — 조회 도구로 데이터에서 찾아 답한다 | 없음 (필드 뜻이 헷갈리면 [api.md](references/api.md) §3) |
| 웹·앱에서 API 받기·저장·업데이트 | [api.md](references/api.md) §5 의 코드를 쓴다 | [api.md](references/api.md) |
| 여행 정보 화면 그리기·디자인 | `assets/` 의 참고 렌더러를 가져다 고친다 | [rendering.md](references/rendering.md) |
| ph-travel-api 저장소 일 — 여행지 추가·수정, type 추가, 빌드·배포 | §6 의 절대 규칙을 지키며 절차를 따른다 | [maintain.md](references/maintain.md) |
| 왜 이 구조인가, 남은 일은 | — | [history.md](references/history.md) |

## 3. 여행 질문에 답하기

places.json 은 약 2MB 라서 대화에 통째로 읽지 않는다. 조회 도구로 필요한 부분만 꺼낸다.

```bash
T="node <스킬 폴더>/scripts/travel.mjs"
$T values                                              # 거르기에 쓸 수 있는 값과 개수 (분류·권역·지역·난이도·태그·달)
$T list --month 12 --category 해변 --difficulty 쉬움 --tag 가족 --sort rating
$T show 보라카이                                        # slug·id·한글·영문 이름 모두 된다
$T show el-nido --section getting_there,costs          # 단락만 — 머리말 없이 짧게
$T search 고래상어 스노클링                              # 낱말이 모두 들어 있는 여행지와 그 문장
$T near vigan --limit 5                                # 가까운 곳 (위도,경도 도 된다)
$T info                                                # version·여행지 수·캐시 상태
$T types stepper                                       # content_display_type 규격 (개발용)
```

- **list 거르기**
  - 글 값은 부분 일치다 (`--category 해변` → 해변·섬, `--tag 가족` → 가족 여행).
  - `--sort rating` 은 높은 순, `budget` 은 싼 순이다.
  - 표에 분류·지역·난이도·추천도·예산·최적기·태그가 함께 나온다. 기본 30곳까지 보이고, `--limit` 으로 늘린다.
- **단락 key**
  - `overview`(한눈에 보기) · `highlights`(꼭 해봐야 할 것) · `itinerary`(추천 일정) · `getting_there`(가는 방법)
  - `best_time`(최적기와 날씨) · `costs`(예상 비용) · `stay_and_food`(숙소와 먹거리) · `tips`(여행 팁)
  - `cautions`(주의사항) · `nearby`(함께 가보면 좋은 곳)
- **흔한 조건 → 거르기**

  | 조건 | 거르기 |
  |------|--------|
  | 아이·가족 | `--tag 가족` |
  | 쉬운 곳 | `--difficulty 쉬움` |
  | 싸게 | `--max-budget 2000 --sort budget` |
  | 다이빙·스노클링 | `--category 다이빙` 또는 `--tag 스노클링` |
  | 그 밖 | `values` 로 태그를 보고 고르거나 `search` 를 쓴다 |

- **search 는 부분 문자열로 찾는다.** 짧은 낱말은 다른 낱말 속에도 걸린다(아이 → 파오아이). 두 글자 낱말보다 구체적인 표현을 쓴다.
- **로컬 빌드를 읽을 때**는 `--base <폴더>` 나 환경변수 `TRAVEL_API_BASE=<폴더>` 를 쓴다(둘은 같다). 예: 저장소 안에서 `node scripts/build.mjs` 뒤 `--base _site/v2`.
- **캐시:** 도구는 manifest 의 version 이 바뀌었을 때만 새로 받고, 나머지는 `~/.cache/travel-api-skill/<나라>/` 캐시를 쓴다. 받지 못하면 캐시로 답하고, 캐시도 없으면 오류를 낸다.
- **순서:** 여러 조건이면 `list` 로 후보를 좁힌다. 고른 곳을 `show --section` 으로 필요한 단락만 읽고 답한다.

답할 때 지킬 것:

1. **데이터에 있는 것으로 답한다.**
   - 여행지 이름은 `한글 이름 (영문 이름)` 으로 쓴다. 예: 보라카이 (Boracay).
   - 데이터에 없는 곳·내용은 "이 API 에는 없다"고 밝힌다. 일반 지식을 보탤 때는 데이터와 구분한다.
2. **금액·요금은 "2026년 기준 대략치"** 라고 밝힌다. 환경세·입장 예약제처럼 자주 바뀌는 규정은 최신 공지를 확인하라고 덧붙인다.
   - **예산은 기준을 함께 적는다.** `budget` 은 1인 기준이다. 표의 예산 칸에 괄호로 기준(투어 1회, 6박 리브어보드 …)이 붙어 있으면 그 기준을 쓴다. 괄호가 없으면 대개 1일이다.
   - 기준이 다른 곳끼리 예산을 단순 비교하지 않는다. 자세한 항목은 `costs` 단락을 읽는다.
   - **최적기는 글을 읽는다.** `--month` 는 최적기 글의 모든 기간을 합친 달로 거른다. 그래서 목적이 다른 기간도 걸린다(발레르 11~2월은 서핑, 3~5월은 해변). 결과의 최적기 칸을 읽고 요청한 목적과 맞는지 본다.
3. **사진 주소를 보여 주면 저작자(credit)를 함께 적는다.** CC 라이선스 조건이다.
4. 비슷한 곳을 권할 때는 `near` 와 그 여행지의 「함께 가보면 좋은 곳」 단락을 쓴다.
5. 나라를 말하지 않으면 기본 나라(`ph`)다. `apis.json` 에 없는 나라는 "아직 API 가 없다"고 답한다. 없는 자료를 만들어 내지 않는다.

## 4. 꼭 알아야 할 API 사실

자세한 것은 [api.md](references/api.md) 에 있다.

- **주소:** `https://thruthesky.github.io/ph-travel-api/v2/`
  - `manifest.json` — `{ schema, version, count, places, content_display_type }`
  - `places.json` — 여행지 전체, `id` 오름차순
  - `content_display_type.json` — 표시 방법 48개
  - `images/*.webp` — 사진
- **업데이트:** `version` 은 내용 해시다. manifest 를 주기적으로 받아 version 이 바뀔 때만 두 파일을 `?v=<version>` 으로 받고, 저장본을 통째로 바꾼다.
- **값은 노드다:** `"budget": { "type": "price", "label": "예산", "icon": "payments", "text": "1인 약 ₱2,000~4,000 (1일)", "min": 2000, "max": 4000 }`
  - `type` 이 content_display_type 이다.
  - 거르기용 값(`months`·`min`·`max`·`code`·`value`)이 노드 안에 있다.
- **본문:** `sections` 10개(`overview` … `nearby`). 각 단락은 `blocks` 에 블록 노드를 담는다.
- **글:** `children` 조각 배열이다. 이어 붙이면 원문이다. `price`·`time`·`date`·`duration`·`distance`·`temperature` 조각만 따로 꾸민다.
- **사진:** `url` 은 places.json 폴더 기준 상대 경로 + `?v=<해시>` 이다. `width`·`height` 가 있다. `credit`·`source` 는 반드시 화면에 보인다.
- **호환:** type·키 추가는 호환된다. 모르는 type 은 대체해서 그린다 — `text` → 글, `children` → 문단, `blocks` → 안의 블록, 그 밖은 건너뛴다.

## 5. 코드를 만들 때

- **웹:**
  - `assets/renderer.mjs` 를 프로젝트에 복사해 쓴다. 외부 패키지 없는 ES 모듈이다.
    - 쓸 것: `FONT_LINKS` · `catalogCss` · `renderPlace` · `renderPlaceCard` · `renderBlock` · `renderRuns` · `enhance`
  - 받기는 [api.md](references/api.md) §5.1 의 `loadTravel(base)` 를 쓴다.
  - 페이지 준비물(글꼴, `.cdt-root` 글자색, 해시 라우팅 예시, 로컬 CORS)은 [rendering.md](references/rendering.md) §5 에 있다.
- **Flutter:**
  - `assets/travel_blocks.dart` 를 쓴다. `flutter/material.dart` 만 의존하고, JSON Map 을 그대로 그린다.
  - 받기는 [api.md](references/api.md) §5.2 를 쓴다.
  - 필고 앱이라면 공용 라이브러리(`apps/lib/src/travel/`)에 두고 앱마다 복사하지 않는다.
- 디자인은 바꿔도 되지만 두 가지는 지킨다 — 모르는 type 의 대체 규칙, 사진 저작자 표기.
- 만든 뒤 스스로 확인한다. 예외만 보지 말고 사진 저작자 글이 실제로 보이는지도 확인한다.
  - 웹: 100곳을 모두 그려 예외가 없는지 본다.
  - Flutter: `flutter analyze` 와 100곳을 그리는 위젯 테스트를 돌린다.

## 6. ph-travel-api 저장소에서 일할 때 — 절대 규칙

절차·검사·검증은 [maintain.md](references/maintain.md) 에 있다.

1. **`main` push 는 곧 운영 배포다.** push 는 사용자가 요청할 때만 하고, 작업은 커밋까지만 한다.
2. **push 전에 `node scripts/build.mjs` 가 성공해야 한다.** 실패하면 JSON 을 쓰지 않고 exit 1 이다.
3. `_site/` 는 커밋하지 않는다. 외부 npm 패키지를 넣지 않는다.
4. 여행지 내용은 이 저장소의 `data/` 에서만 고친다. 필고의 `apps/travel/data/travel/` 은 옛 사본이다.
5. 스킬을 고치면 `metadata.version` 을 올린다. 입구 `.claude/skills/travel-api-skill/SKILL.md` 의 description 도 같게 맞춘다.

## 7. 스킬 파일

| 파일 | 내용 |
|------|------|
| `scripts/travel.mjs` | 조회 도구 — list·show·search·near·types·info·countries (Node 18+, 외부 패키지 없음) |
| `scripts/apis.json` | 나라별 API 주소 목록 |
| `scripts/update.sh` | `/travel-api-skill update` — 최신 스킬 묶음을 받아 이 폴더를 바꾼다 |
| `assets/renderer.mjs` | 웹 참고 렌더러 (48개 type) |
| `assets/travel_blocks.dart` | Flutter 참고 렌더러 (48개 type) |
| `references/api.md` | API 계약·필드·업데이트 절차와 코드 |
| `references/rendering.md` | content_display_type·권장 위젯·렌더러 사용법 |
| `references/maintain.md` | 저장소 구조·명령·규격 검사·규칙·작업·검증·새 나라 |
| `references/history.md` | 현재 상태·남은 일·결정 기록 |
