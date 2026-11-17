# 여행지 작성 담당 안내 (x2000)

필리핀 여행 정보 API(ph-travel-api)에 여행지 한 곳을 새로 쓴다. 저장소 뿌리는 `/Users/thruthesky/apps/philgo/submodules/ph-travel-api` 이고, 모든 명령은 뿌리에서 실행한다.
받은 값: **번호(id)·slug·이름·Commons 분류 단서·작업 폴더 `W`**(`_i18n/work/x2000/<id>-<slug>/`).

## 절대 규칙

- **쓰는 곳은 작업 폴더 `W` 하나뿐이다.** `data/`·`sources/`·`work/`·`scripts/`·meta·git 은 건드리지 않는다. 빌드·커밋·배포도 하지 않는다(통합 담당이 한다).
- **사진을 먼저 확인한다.** 정확한 사진 10장을 못 구하면 본문을 쓰지 말고 `W/done.json` 에 `{"status":"hold","reason":"…"}` 를 쓰고 끝낸다. 다른 장소 사진으로 채우지 않는다.
- 사실은 실제로 연 페이지에서만 가져온다. 검색 요약만 보고 쓰지 않는다. 확인하지 못한 요금·시각·노선은 쓰지 않거나 "현지에서 확인"으로 쓴다. 지어내지 않는다.
- 픽셀을 바꾸는 일(크기 조정·변환·자르기)을 하지 않는다. 받은 JPEG 를 열어 보기만 한다.
- Commons 요청은 `work/x2000/photos.py` 로만 한다(전역 직렬·6초 간격). curl·WebFetch 로 commons/upload.wikimedia.org 를 직접 부르지 않는다. "냉각 중(exit 75)"이면 조사·집필을 먼저 하고 몇 분 뒤 다시 한다.
- 이미 등록된 곳(`work/x2000/registered.tsv` — slug·한글 이름·영문 이름·지역·좌표)과 같은 곳이면 `{"status":"duplicate","of":"<slug>"}` 로 끝낸다. 도시 항목 안에 잠깐 언급된 명소는 중복이 아니다.
- 다른 에이전트를 부르지 않는다. 사용자에게 묻지 않는다.

## 순서

### 1. 사진 (먼저)

```bash
python3 work/x2000/photos.py subcats W --cat "<분류 이름>"          # 하위 분류와 파일 수
python3 work/x2000/photos.py find W --cat "<분류>" [--cat "<하위 분류>"] [--search "<이름> <지역>"] [--max 150]
python3 work/x2000/photos.py get W "File:….jpg" "File:….jpg" …        # → W/orig/<n>.jpg (가로 1280)
```

- `find` 가 쓸 수 있는 후보(가로 1080 이상, CC BY·BY-SA·CC0·PD)의 제목·크기·작가·촬영일·설명을 보여 준다. 메타는 `W/photos.json` 에 쌓인다.
- 12~14장을 골라 `get` 으로 받고, **받은 파일을 모두 Read 로 열어 직접 본다.** 기준:
  - 그 장소가 맞다(설명·분류에 이름, 이웃 장소·동명이소가 아님). 본문이 말하는 모습이다.
  - 워터마크·큰 글자·로고·광고판이 주제가 아니다. 사람 얼굴이 주제가 아니다. 흐리지 않다. 문서·지도·도면·옛 흑백 사진·표지판 글자만 찍은 사진이 아니다.
  - **10장이 서로 다른 면을 보여 준다** — 대표 전경, 다른 각도·시간, 본문 highlights 의 명소, 활동, 그곳의 것이 분명한 음식·축제. 거의 같은 구도는 한 장만. 같은 작가가 같은 날 찍은 사진은 **대상·구도가 분명히 다를 때만** 여러 장 쓰고, 가능한 한 작가·날짜를 섞는다.
  - 대표 사진(첫 장)은 장소 전경이 보이는 가로 사진.
  - 재해·재건으로 모습이 바뀐 곳은 바뀐 뒤 사진.
- 떨어뜨린 만큼 더 받아 **합격 10장**(더 좋으면 12장까지)을 채운다. 후보를 다 봐도 10장이 안 되면 hold.

### 2. 조사

- WebSearch 로 찾고 WebFetch 로 본문을 연다. 영어 위키백과·지자체(LGU)·관광부(DOT)·NHCP·공원 관리소·운영사 공식·최근 12개월 언론을 우선한다.
- 바뀌는 사실(요금·운영 시간·노선·규정·폐쇄)은 **서로 다른 출처 2곳 이상**(하나는 공식이거나 12개월 안의 믿을 만한 출처). 2곳을 못 채우면 범위·"약"·"현지 확인"으로 쓰거나 뺀다.
- 좌표는 지도 2곳(위키백과·OSM·Google 지도 등)이 같은 곳을 가리키는지 본다. 소수 4자리.
- 폐쇄됐거나 여행지로 성립하지 않으면 `{"status":"hold","reason":…}`.
- 필고 원문 단서가 주어졌다면 이름 단서로만 쓴다(오래됐고 틀린 곳이 많다).

### 3. 한국어 원본 — `W/spec.json` 을 쓰고 생성기를 돌린다

```bash
node work/x2000/gen.mjs W        # → W/ready/ko/<id>-<slug>.json, 본문 글자 수를 알려 준다
```

`spec.json` 형식(모든 키 필수, 예시는 줄임):

```json
{
  "id": 431, "slug": "fort-pilar",
  "title": "포트 필라르", "title_en": "Fort Pilar",
  "tagline": "잠보앙가의 바다를 지켜 온 17세기 석조 요새와 성모 성지",
  "region": "zamboanga", "location": "잠보앙가 시 NS 발데로사 거리",
  "category": "heritage",
  "tags": ["요새", "성모 성지", "박물관", "스페인 유산"],
  "rating": 4.4, "lat": 6.9014, "lon": 122.0824,
  "best_season": { "text": "12~5월 건기", "months": [12, 1, 2, 3, 4, 5] },
  "duration": "반나절",
  "budget": { "text": "약 ₱500~1,500", "min": 500, "max": 1500 },
  "difficulty": 1,
  "airport": { "text": "잠보앙가 국제공항(ZAM)", "code": "ZAM" },
  "images": [ { "file": "File:Fort Pilar (2008).jpg", "alt": "포트 필라르 정면 성벽과 입구" }, … 10장 이상, 첫 장이 대표 ],
  "summary": "2~3문장 100~160자 요약.",
  "overview": ["문단", "문단", "문단"],
  "highlights": [ { "title": "성모 필라르 야외 성지", "text": "2~3문장." }, … 6~8개 ],
  "itinerary": [ { "title": "반나절 코스", "subtitle": "요새와 해안 산책", "steps": [ { "time": "08:00", "text": "…" }, … ], "note": "(선택) 보충 문단" }, … ],
  "getting_there": [ { "title": "마닐라에서 비행기", "icon": "flight", "items": ["…", "…"], "note": "(선택)" }, { "title": "시내 이동", "icon": "commute", "items": ["…"] } ],
  "best_time": { "paragraphs": ["…", "…"], "rows": [["12~2월", "선선하고 맑음", "…"], ["3~5월", "…", "…"], ["6~11월", "…", "…"]] },
  "costs": [ ["입장료", "무료", "박물관 구역은 별도"], ["트라이시클", "약 ₱30~80", "시내 단거리"], … 6~9개 ],
  "stay_and_food": ["문단", "문단"],
  "tips": ["…", … 6~10개],
  "cautions": { "alert": "핵심 경고 한두 문장", "items": ["…", … 4~6개] },
  "nearby": [ { "title": "그레이트 산타크루즈 섬", "text": "배로 약 ⟦duration|20분⟧ …", "place": "등록된 곳이면 slug" }, … 3~5개 ]
}
```

- `region` 은 `data/meta.json` 의 regions key(metro-manila cavite batangas rizal laguna quezon bataan tarlac-zambales pampanga bulacan nueva-ecija zambales aurora pangasinan cordillera ilocos batanes cagayan isabela nueva-vizcaya bicol mindoro marinduque palawan panay guimaras negros romblon cebu bohol siquijor samar-leyte surigao camiguin northern-mindanao davao southern-mindanao agusan misamis-occidental zamboanga bangsamoro). 맞는 지역이 없으면 가장 가까운 것을 쓰고 done.json 의 `notes` 에 적는다.
- `category`: beach(해변·섬) diving(다이빙·해양) mountain(산·트레킹) water(폭포·호수·강) heritage(역사·문화) city(도시·미식) nature(자연 경관) festival(축제·행사).
- `difficulty`: 1 쉬움 · 2 보통 · 3 어려움. `best_season.months` 는 첫 기간의 시작 달부터, 연중이면 1~12.
- `budget.text` 는 "약 ₱…~…" 로 쓰고 1일 기준이 아니면 끝 괄호에 기준을 적는다. min·max 는 그 숫자.
- `getting_there` 아이콘: flight directions_boat directions_bus airport_shuttle local_taxi electric_rickshaw directions_car train directions_walk tour commute route. **마닐라 출발은 필수.**
- `nearby[].place` 는 `work/x2000/registered.tsv` 에 있는 slug 만. 없으면 `place` 를 뺀다.
- **글 안의 값 조각:** 금액·시각·날짜·기간·거리·기온은 `⟦price|₱50~80⟧` `⟦time|08:00⟧` `⟦date|11~5월⟧` `⟦duration|2시간⟧` `⟦distance|3km⟧` `⟦temperature|30℃⟧` 로 감싼다. "약"·"편도"는 밖에 둔다. 굵게는 `⟦b|글⟧`, 등록된 여행지는 `⟦place_link|비간|vigan⟧`. `costs` 의 칸과 `best_time.rows`, 제목류(title·time)에는 조각을 쓰지 않는다(그냥 글자).
- price 조각의 숫자에는 한국어 단위(만·억)를 쓰지 않는다 — `₱10,000`.
- **문체:** "~합니다"체, 필리핀 한인 커뮤니티가 추천하는 친근하지만 정확한 가이드. 본문 **5,000~7,000자**. 구체적 지명·거리·시간·요금·팁. 같은 말 되풀이·뻔한 경고로 길이를 채우지 않는다. 이모지·마크다운·HTML 금지.
- 자주 바뀌는 규정에는 "최신 공지를 확인"을 붙인다. 업소 이름은 오래 운영된 유명한 곳만.
- alt 는 그 사진에 실제로 보이는 것을 쓴다(예: "포트 필라르 북쪽 성벽과 대포").

### 4. 영어 번역 (공식 도구)

```bash
bash work/x2000/tr.sh W export     # → W/mini/_i18n/src/<이름>.txt
# W/mini/_i18n/en/<이름>.txt 에 "@번호 번역" 줄만 쓴다(# 줄 없이, 모든 번호, 한 줄씩)
bash work/x2000/tr.sh W import     # 검사 후 → W/ready/en/<이름>.json
```

- `_i18n/GUIDE.md` 의 §2~§5 를 따른다: 값 조각 `⟦type|글⟧` 은 같은 type·같은 개수로 남기고 안의 글은 번역(`⟦duration|2 hours⟧`, `⟦date|November–May⟧`), price 숫자는 그대로. 한글이 한 글자도 남으면 안 된다. 정보를 줄이지 않는다.
- pricing 열 제목은 `Item` / `Estimated cost` / `Notes`, 캡션은 `Prices are approximate as of ⟦date|2026⟧ and may vary with local conditions.`, 표 제목 `Season at a glance`, 열 `Period` / `Weather` / `Travel notes`. 등록된 여행지 이름은 registered.tsv 의 영문 이름.
- 자연스러운 여행 안내서 영어로 쓴다.

### 5. 근거와 완료 기록

`W/sources.json` (pipeline §3.5 형식):

```json
{ "id": 431, "slug": "fort-pilar", "checked_at": "<UTC ISO>",
  "facts": [ { "where": "costs", "fact": "입장료", "value": "무료", "sources": [ { "url": "https://…", "grade": "A", "date": "2026-03-01", "says": "…" }, { "url": "…", "grade": "B", "date": "…", "says": "…" } ], "decision": "…" }, … 좌표·요금·교통·역사 수치 등 바뀌는 값 모두 ],
  "images": [ { "file": "<id>-<slug>.webp", "source": "https://commons.wikimedia.org/wiki/File:…", "check": "무엇을 보고 맞다고 판단했는지" }, … 사진마다, spec.images 순서대로 (-2 … -10) ] }
```

`W/done.json`:

```json
{ "status": "ready", "id": 431, "slug": "fort-pilar", "ko_chars": 5600, "images": 10, "authors": 6,
  "web_search": 5, "web_fetch": 9, "commons_requests": 14, "notes": "사람이 볼 점·불확실한 점" }
```

끝나기 전에 스스로 확인: `W/ready/ko`·`W/ready/en`·`W/sources.json`·`W/done.json` 이 있고, spec.images 의 파일이 모두 `W/orig/` 에 있으며 직접 열어 본 것인가.
마지막 답은 한 줄로: `ready|hold|duplicate — <이름> — <한 줄 사유·특이점>`.
