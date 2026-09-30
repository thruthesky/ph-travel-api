---
name: travel-api-skill
description: 여행 정보 API(ph-travel-api — 필리핀 여행지 198곳, 8개 언어 en·zh·ja·ko·th·vi·ru·ar, 앞으로 다른 나라도 추가) 전용 스킬. JSON 을 받아 SQLite(travel.db)로 바꿔 언어별 전문 검색·인덱스로 여행지를 찾아 추천·일정·비용·가는 방법·가까운 곳을 답하고, 웹사이트(PHP)·Flutter 앱·정적 웹이 원격 API 대신 데이터를 넣어(임베딩) 쓰도록 DB·파일 만들기, 조회 코드(PHP·Dart), 블록 렌더러(tabs·accordion·card·stepper·pricing 등)를 제공하며, ph-travel-api 저장소의 여행지 추가·번역·검사·배포를 돕는다. 다음 경우 반드시 사용 — (1) 필리핀 여행지·여행 정보 질문(보라카이, 세부, 엘니도, 보홀, 12월에 갈 만한 해변, 예산, 일정, 가는 방법 등, 어느 언어든), (2) ph-travel-api·여행 API·places.json·meta.json·travel.db·SQLite 여행 DB 를 쓰는 웹/앱 개발, 필고 웹사이트·앱에 여행 정보 넣기, 화면 디자인, (3) 여행지 데이터 추가·수정·번역·검사·배포, (4) 여행이 아닌 다른 정보(밤문화·맛집·병원·비자·생활 정보 등, 예: ph-night-api)를 ph-travel-api 와 같은 형태 — 다국어 블록 JSON 정적 API·빌드 검사·SQLite·조회 코드·스킬 — 로 새로 만들거나 기존 자료를 그 형태로 가공할 때(청사진 references/blueprint.md), (5) 사용자가 /travel-api-skill 을 부를 때 — 인자가 update 면 스킬을 최신으로 갱신한다.
---

# travel-api-skill — 이 저장소의 입구

이 스킬의 원본은 저장소의 `skills/travel-api-skill/` 폴더다. 이 파일은 이 저장소에서 스킬을 부르기 위한 입구일 뿐이다.

1. **먼저 `skills/travel-api-skill/SKILL.md` 를 읽고 그 지침을 그대로 따른다.**
2. 그 문서의 `references/`·`scripts/`·`assets/` 경로는 모두 `skills/travel-api-skill/` 기준이다. 예: `node skills/travel-api-skill/scripts/travel.mjs list`.
3. 인자가 `update` 면 파일을 받지 않는다. 이 저장소가 스킬의 원본이기 때문이다. 대신 `git pull` 로 최신이 된다고 알린다 (`scripts/update.sh` 도 같은 안내를 한다).
4. 이 저장소에서는 공개 주소 대신 로컬 빌드 결과를 읽을 수 있다: `node scripts/build.mjs` 뒤 `--base _site/v2` (조회 도구·`travel-db.mjs` 모두).
5. 이 입구의 `name`·`description` 은 원본과 같아야 한다. 빌드가 description 을 비교한다.
