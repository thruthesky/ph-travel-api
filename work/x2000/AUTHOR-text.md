# 여행지 작성 담당 안내 (x2000)

필리핀 여행 정보 API(ph-travel-api)에 여행지 한 곳을 새로 쓴다. 저장소 뿌리는 `/Users/thruthesky/apps/philgo/submodules/ph-travel-api` 이고, 모든 명령은 뿌리에서 실행한다.
받은 값: **번호(id)·이름·필고 단서·작업 폴더 `W`**(slug 는 영문 이름으로 직접 정한다)(`_i18n/work/x2000/<id>-<slug>/`).

## 절대 규칙

- **쓰는 곳은 작업 폴더 `W` 하나뿐이다.** `data/`·`sources/`·`work/`·`scripts/`·meta·git 은 건드리지 않는다. 빌드·커밋·배포도 하지 않는다(통합 담당이 한다).
- **이번 작업은 텍스트(한국어·영어)만이다. 사진은 받지도 넣지도 않는다.** `spec.images` 는 `[]` 로 둔다(가짜·다른 장소 사진 금지). 사진은 나중에 따로 채운다.
- 사실은 실제로 연 페이지에서만 가져온다. 검색 요약만 보고 쓰지 않는다. 확인하지 못한 요금·시각·노선은 쓰지 않거나 "현지에서 확인"으로 쓴다. 지어내지 않는다.
- 픽셀을 바꾸는 일(크기 조정·변환·자르기)을 하지 않는다. 받은 JPEG 를 열어 보기만 한다.
- Commons·Wikimedia 이미지는 부르지 않는다.
- 이미 등록된 곳(`work/x2000/registered.tsv` — slug·한글 이름·영문 이름·지역·좌표)과 같은 곳이면 `{"status":"duplicate","of":"<slug>"}` 로 끝낸다. 도시 항목 안에 잠깐 언급된 명소는 중복이 아니다.
- 다른 에이전트를 부르지 않는다. 사용자에게 묻지 않는다.

## 순서

### 1. 조사

- WebSearch 로 찾고 WebFetch 로 본문을 연다. 영어 위키백과·지자체(LGU)·관광부(DOT)·NHCP·공원 관리소·운영사 공식·최근 12개월 언론을 우선한다.
- 바뀌는 사실(요금·운영 시간·노선·규정·폐쇄)은 **서로 다른 출처 2곳 이상**(하나는 공식이거나 12개월 안의 믿을 만한 출처). 2곳을 못 채우면 범위·"약"·"현지 확인"으로 쓰거나 뺀다.
- 좌표는 지도 2곳(위키백과·OSM·Google 지도 등)이 같은 곳을 가리키는지 본다. 소수 4자리.
- 여행지로 성립하지 않는 것(업체 광고·일반 명사·정보 부족·폐쇄·여행금지 지역)은 쓰지 않고 `{"status":"hold","reason":…}`. 실제 있는 곳이지만 일반 여행자에게 볼거리가 부족하면 hold 가 맞다. 폐쇄됐거나 여행지로 성립하지 않으면 `{"status":"hold","reason":…}`.
- 필고 원문 단서가 주어졌다면 이름 단서로만 쓴다(오래됐고 틀린 곳이 많다).

### 2. 한국어 원본 — `W/spec.json` 을 쓰고 생성기를 돌린다

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
  "images": [],
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

### 3. 영어 번역 (공식 도구)

```bash
bash work/x2000/tr.sh W export     # → W/mini/_i18n/src/<이름>.txt
# W/mini/_i18n/en/<이름>.txt 에 "@번호 번역" 줄만 쓴다(# 줄 없이, 모든 번호, 한 줄씩)
bash work/x2000/tr.sh W import     # 검사 후 → W/ready/en/<이름>.json
```

- `_i18n/GUIDE.md` 의 §2~§5 를 따른다: 값 조각 `⟦type|글⟧` 은 같은 type·같은 개수로 남기고 안의 글은 번역(`⟦duration|2 hours⟧`, `⟦date|November–May⟧`), price 숫자는 그대로. 한글이 한 글자도 남으면 안 된다. 정보를 줄이지 않는다.
- pricing 열 제목은 `Item` / `Estimated cost` / `Notes`, 캡션은 `Prices are approximate as of ⟦date|2026⟧ and may vary with local conditions.`, 표 제목 `Season at a glance`, 열 `Period` / `Weather` / `Travel notes`. 등록된 여행지 이름은 registered.tsv 의 영문 이름.
- 자연스러운 여행 안내서 영어로 쓴다.

### 4. 근거와 완료 기록

`W/sources.json` (pipeline §3.5 형식):

```json
{ "id": 431, "slug": "fort-pilar", "checked_at": "<UTC ISO>",
  "facts": [ { "where": "costs", "fact": "입장료", "value": "무료", "sources": [ { "url": "https://…", "grade": "A", "date": "2026-03-01", "says": "…" }, { "url": "…", "grade": "B", "date": "…", "says": "…" } ], "decision": "…" }, … 좌표·요금·교통·역사 수치 등 바뀌는 값 모두 ],
  "images": [] }
```

`W/done.json`:

```json
{ "status": "ready", "id": 431, "slug": "fort-pilar", "ko_chars": 5600, "images": 0,
  "web_search": 5, "web_fetch": 9, "notes": "사람이 볼 점·불확실한 점" }
```

끝나기 전에 스스로 확인: `W/ready/ko`·`W/ready/en`·`W/sources.json`·`W/done.json` 이 있는가.
마지막 답은 한 줄로: `ready|hold|duplicate — <이름> — <한 줄 사유·특이점>`.
