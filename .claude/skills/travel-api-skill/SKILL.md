---
name: travel-api-skill
description: 여행 정보 API(ph-travel-api — 필리핀 여행지 100선, 앞으로 다른 나라도 추가) 전용 스킬. 공개 정적 JSON API(https://thruthesky.github.io/ph-travel-api/v2/)에서 여행지를 찾아 추천·일정·비용·가는 방법·주의사항·가까운 곳을 답하고, 웹·Flutter 앱이 places.json·content_display_type.json 을 받아 저장·업데이트하고 블록(tabs·accordion·card·stepper·pricing 등)으로 그리는 코드를 만들며, ph-travel-api 저장소의 여행지 JSON 추가·수정·규격 검사·배포를 돕는다. 다음 경우 반드시 사용 — (1) 필리핀 여행지·여행 정보 질문(보라카이, 세부, 엘니도, 보홀, 12월에 갈 만한 해변, 예산, 일정, 가는 방법 등), (2) ph-travel-api·여행 API·places.json·manifest.json·content_display_type 을 쓰는 웹/앱 개발과 화면 디자인, (3) 여행지 데이터 추가·수정·검사·배포, (4) 사용자가 /travel-api-skill 을 부를 때 — 인자가 update 면 스킬을 최신으로 갱신한다.
---

# travel-api-skill — 이 저장소의 입구

이 스킬의 원본은 저장소의 `skills/travel-api-skill/` 폴더다. 이 파일은 이 저장소에서 스킬을 부르기 위한 입구일 뿐이다.

1. **먼저 `skills/travel-api-skill/SKILL.md` 를 읽고 그 지침을 그대로 따른다.**
2. 그 문서의 `references/`·`scripts/`·`assets/` 경로는 모두 `skills/travel-api-skill/` 기준이다. 예: `node skills/travel-api-skill/scripts/travel.mjs list`.
3. 인자가 `update` 면 파일을 받지 않는다. 이 저장소가 스킬의 원본이기 때문이다. 대신 `git pull` 로 최신이 된다고 알린다 (`scripts/update.sh` 도 같은 안내를 한다).
4. 이 저장소에서는 공개 주소 대신 로컬 빌드 결과를 읽을 수 있다: `node scripts/build.mjs` 뒤 `--base _site/v2`.
5. 이 입구의 `name`·`description` 은 원본과 같아야 한다. 빌드가 description 을 비교한다.
