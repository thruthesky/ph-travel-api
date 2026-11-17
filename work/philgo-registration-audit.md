# 필고 원본 글의 API 수록 대조

확인: 2026-11-17T12:08:29.328Z. 현재 로컬 한국어 원본 331건, 공개판 242건.

## 원본 건수

| 원본 | 글 수 | 실제 파일의 날짜 범위 | 삭제 표시 |
|---|---:|---|---:|
| [philgo-travel-posts-before-2025-08-09.csv](philgo-travel-posts-before-2025-08-09.csv) | 388 | 2010-04-29 ~ 2025-08-09 | 35 |
| [philgo-travel-posts-since-2025-08-10.tsv](philgo-travel-posts-since-2025-08-10.tsv) | 1153 | 2025-11-06 ~ 2026-08-26 | 0 |
| 합계 | 1541 | 두 파일 사이 글 번호 중복 없음 | 35 |

글 1건은 여행지 1곳과 다르다. 같은 곳의 중복 글, 여러 명소를 다룬 글, 지역 개요·일정·교통·질문 등이 섞여 있다. 이후 파일의 원래 kind 분류는 명소850·지역가이드140·전국정보88·일정43·교통21·사용자글11이다. 명소로 분류된 글 중에도 식당 종합목록·일정·교통 안내가 있어 개별 검토했다.

## 글 기준 대조 결과

| 현재 판정 | 이전 글 | 이후 글 | 합계 |
|---|---:|---:|---:|
| 독립 항목 수록 | 75 | 202 | 277 |
| 기존 항목 연결·범위 검토 | 147 | 166 | 313 |
| 본문 언급·독립 항목 미확인 | 24 | 185 | 209 |
| 이름 검색 미검출·미수록 후보 | 29 | 281 | 310 |
| 일반·광역·기타 글 | 113 | 319 | 432 |
| 합계 | 388 | 1153 | 1541 |

**미수록 조사 후보는 519개 글(이전53·이후466)이다. 이름·원본 중복 연결·개별 검토 규칙으로 488묶음으로 추렸다.**

이 중 297묶음은 이름 검색에서 미검출됐고, 나머지는 본문 언급 또는 이전 팀의 언급 판정이 있다. 개별 업소 성격 검토 표시는 116묶음, 이전 보류·제외 기록 표시는 16묶음이다. 이 두 표시는 서로 겹칠 수 있다.

**후보 488묶음은 검증 완료된 독립 여행지 수가 아니다.**
다른 이름의 같은 곳이 남을 수 있고, 같은 이름의 다른 지역 명소도 원문 위치 확인이 필요하다. 이전 팀의764곳은 이후 명소850글만 의미별로 묶은 값이고, 이번 값은 이전 글까지 포함한 미수록 검토 집합이라 기준이 다르다. 기존 항목 연결317글은 이미 완전히 반영됐다고 확정하지도, 신규 후보라고 확정하지도 않았다.

## 등록되지 않은 이유

1. **원본 CSV·TSV와 data.csv가 자동 등록 입력이 아니다.** `scripts/build.mjs`는 `data/ko/`와 번역 폴더의 여행지 JSON을 읽는다. `scripts/catalog.mjs`는 JSON에서 data.csv를 만드는 반대 방향의 도구다. 표에 후보를 적거나 이름을 추가해도 여행지 JSON이 생성되지 않는다.
2. **기존 후보 도구는 두 전체 원본을 읽지 않았다.** `scripts/candidates.mjs`의 입력은 이미 추려진 이후 후보606행과 이전 후보76행이다. 사용자가 지목한 이전388글·이후1153글을 한 번에 대조하는 도구가 아니었다. 이번에 별도 전체 대조 도구를 만들었다. 이 자체가 원문 누락의 확정 원인이라는 뜻은 아니며 이전 도구의 조사 범위가 다르다는 뜻이다.
3. **후보 발견 이후의 개별 가공이 끝나지 않았다.** 새 항목에는 위치·동의어 대조, 최신 출처, 사진10장, 한국어 본문,7개 번역,10개 섹션과 빌드 검사가 필요하다. 이번 표만으로 모든 후보의 사진 수나 운영 상태를 판단할 수 없다. 개별 보류 기록이 없는 항목은 일괄적으로 사진 부족이라고 설명하지 않는다.
4. **이미 다루는 곳과 독립 항목이 없는 하위 명소가 섞여 있다.** 핀토 미술관은117, 마인드 뮤지엄은006 본문에 있다. 반면 옛 베니스 몰·라이트 공원·말라이발라이 글은 이후274·275·292에 수록됐으므로 오래된 없음 판정을 갱신했다. 검은 나사렛 축제는101의 트라슬라시온 표기를 확인해 단순 미검출에서 언급 후보로 고쳤다.
5. **개별 보류·특정 실패 사유가 있다.** 마타붕카이8장·카티바와산7장·클라우드9 새 타워1장·날루수안/힐루퉁안 등 사진 부족, 사그바얀의 과거 폐쇄 조사, 잠보앙가 관련 이전 제외 기록이 있다. 이는 과거 작업 기록이며 현재 운영·경보를 이번에 새로 검증한 결과는 아니다. 필리핀 민속촌·피나모앙 폭포·CWC 클락은 장소 특정부터 검토해야 한다.
6. **로컬 수록과 공개 배포가 다르다.** 공개 manifest와 한국어 파일을 읽어 확인한 판은 242건·version dd5628ed7d37·생성2026-10-07T09:09:40.528Z이다. 로컬331건 중89건은 공개판에 없다. 이전 추가 작업이 로컬 커밋까지만 끝났기 때문이다. AGENTS 지침상 배포는 사용자 요청 시에만 한다. 이번 분석은 배포하지 않았다.

## 추린 목록

- [전체1541글 대조 CSV](philgo-registration-audit.csv): 글마다 원본 연결, 현재 판정, 실제 수록 slug, 본문 언급 근거, 공개 여부와 다음 작업.
- [미수록 조사 후보 CSV](philgo-unregistered-places.csv): 519글을 488묶음으로 압축. 기존 수록·일반 글을 제외했으며 10개 우선 재조사 묶음을 표시했다.
- [집계와 원본 SHA256](registration-audit-summary.json), [개별 검토 규칙](registration-audit-overrides.json), [공개판 스냅샷](registration-public-snapshot.json).

| 먼저 검토할 후보 | 글 번호 | 최장 본문 | 대조 상태 |
|---|---|---:|---|
| 다바오 크로코다일 파크 | 1275713107 | 8877자 | 이름 검색 미검출·미수록 후보 |
| 랑아이 축제 | 1275713693 | 8797자 | 이름 검색 미검출·미수록 후보 |
| 마그아소 폭포 (Mag-aso Falls) | 1275713002 | 8738자 | 이름 검색 미검출·미수록 후보 |
| 시나디아 사 할라란 | 1275713715 | 8645자 | 본문 언급·독립 항목 미확인 |
| 후루간 폭포 | 1275712664 | 8522자 | 이름 검색 미검출·미수록 후보 |
| 세부 오션 파크 | 1275712851 / 1275713213 | 8377자 | 이름 검색 미검출·미수록 후보 |
| 히든밸리 스프링스  /  히든 밸리 스프링스 | 156880 / 1275713034 | 8285자 | 이름 검색 미검출·미수록 후보 |
| 앙고노(히간테스 축제)  /  히간테스 축제 | 953409869 / 1275712237 | 7464자 | 이름 검색 미검출·미수록 후보  /  본문 언급·독립 항목 미확인 |
| TLC 공원(타기그) | 1275656984 | 1552자 | 이름 검색 미검출·미수록 후보 |
| 파니만 비치(푸에르토 아줄, 테르나테) | 81963 | 717자 | 이름 검색 미검출·미수록 후보 |

이 우선순위는 제목·본문 길이·독립 방문 주제를 기준으로 한 조사 순서다. 사진10장과 현재 운영 검증을 끝냈다는 뜻은 아니다.

## 로컬에는 있고 공개판에 없는 항목

- 250 필릴라 풍력발전단지 (pililla-wind-farm)
- 253 말롤로스 대성당 (malolos-cathedral)
- 267 오르티가스 센터 (ortigas-center)
- 270 더 루인스 (the-ruins)
- 271 마닐라 메트로폴리탄 극장 (manila-metropolitan-theater)
- 272 마닐라 동물원 (manila-zoo)
- 273 마닐라 중국인 묘지 (manila-chinese-cemetery)
- 274 베니스 그랜드 캐널 몰 (venice-grand-canal-mall)
- 275 라이트 공원과 더 맨션 (wright-park-the-mansion)
- 276 세부 메트로폴리탄 대성당 (cebu-metropolitan-cathedral)
- 277 세부 파리안 지구 (parian-cebu)
- 278 세부 IT 파크 (cebu-it-park)
- 279 타클로반 (tacloban)
- 280 일로일로 강 에스플라나데 (iloilo-river-esplanade)
- 282 카미긴 화이트 아일랜드 (white-island-camiguin)
- 284 푸카 비치 (puka-beach)
- 285 푸에르토 갈레라 화이트 비치 (white-beach-puerto-galera)
- 288 CCP 콤플렉스 (ccp-complex)
- 289 산타 이사벨 요새 (fort-santa-isabel-taytay)
- 290 콜론 거리 (colon-street)
- 292 말라이발라이 (malaybalay)
- 293 세션 로드 (session-road)
- 294 리잘 대로 (rizal-boulevard-dumaguete)
- 295 시눌로그 축제 (sinulog-festival)
- 296 이스트우드 시티 (eastwood-city)
- 297 마스카라 축제 (masskara-festival)
- 299 디낙양 축제 (dinagyang-festival)
- 300 파낙벵가 꽃 축제 (panagbenga-festival)
- 301 아티아티한 축제 (ati-atihan-festival)
- 302 헤수스 나사레노 축일·트라슬라시온 (feast-of-jesus-nazarene)
- 303 다바오 산 페드로 대성당 (san-pedro-cathedral-davao)
- 304 보아크 역사도시·대성당 (boac-heritage-town)
- 305 페냐프란시아 축제 (penafrancia-festival)
- 306 세부 릴로안 (liloan-cebu)
- 308 파코 공원 (paco-park)
- 309 루세나 (lucena)
- 310 그린힐스 쇼핑 센터 (greenhills-shopping-center)
- 311 SM 메가몰 (sm-megamall)
- 312 나가 메트로폴리탄 대성당 (naga-metropolitan-cathedral)
- 313 타야바스 (tayabas)
- 314 바기오 대성당 (baguio-cathedral)
- 315 투게가라오 (tuguegarao)
- 316 소르소곤시 (sorsogon-city)
- 317 타바코시 (tabaco)
- 318 바탕가스시 (batangas-city)
- 319 카비테시 (cavite-city)
- 320 이무스시 (imus-city)
- 321 발랑가시 (balanga-city)
- 322 링가옌 (lingayen)
- 323 풀리란 (pulilan)
- 324 부스토스 (bustos)
- 325 기긴토 (guiguinto)
- 326 불라칸 역사 마을 (bulakan-town)
- 327 타그빌라란 시티 (tagbilaran)
- 328 다나오 시티 · 세부 (danao-city)
- 329 보롱간 시티 (borongan)
- 330 오르목 시티 (ormoc)
- 331 SM 시티 세부 (sm-city-cebu)
- 332 SM 시사이드 시티 세부 (sm-seaside-city-cebu)
- 333 아얄라 센터 세부 (ayala-center-cebu)
- 334 산호아킨 일로일로 (san-joaquin-iloilo)
- 335 막탄·세부 국제공항 (mactan-cebu-airport)
- 336 얍·산디에고 고택 (yap-sandiego-house)
- 337 카사 고로르도 박물관 (casa-gorordo-museum)
- 338 실리만 대학교 (silliman-university)
- 339 바콜로드 산 세바스티안 대성당 (san-sebastian-cathedral-bacolod)
- 340 네그로스옥시덴탈 주청사·라군 공원 (negros-occidental-capitol-park)
- 341 세부 주청사 (cebu-provincial-capitol)
- 342 실라이 산 디에고 성당 (san-diego-pro-cathedral-silay)
- 347 부투안 역사도시 (butuan-city)
- 350 말라테 역사문화거리 (malate)
- 351 마리키나 신발문화도시 (marikina-city)
- 352 NAIA 마닐라 공항 도착·환승 안내 (naia-airport)
- 353 앙고노 예술마을 (angono)
- 354 타나이 구시가와 산일데폰소 성당 (tanay-old-town)
- 355 타를락 시티 역사·예술 여행 (tarlac-city)
- 356 카바나투안 역사·광장 여행 (cabanatuan-city)
- 358 발리왁 성당·박물관과 공예 여행 (baliwag-city)
- 359 산페르난도 라우니온 역사·해안 여행 (san-fernando-la-union)
- 361 메이카우아얀 성당과 생활 유산 여행 (meycauayan-city)
- 362 오반도 성지와 다산 축제 (obando-fertility-rites)
- 367 그린벨트 마카티 (greenbelt-makati)
- 369 필리핀 독립기념일 (philippine-independence-day)
- 371 바클라란 성당 (baclaran-church)
- 372 산토토마스대학교 역사 캠퍼스 (university-of-santo-tomas)
- 373 에스콜타 역사거리 (escolta)
- 374 파시그시 (pasig-city)
- 375 말라본시 (malabon-city)
- 376 발렌수엘라시 (valenzuela-city)

## 재현과 한계

```bash
node scripts/audit-post-registration.mjs
```

원본 두 파일은 수정하지 않았다. 원본 행 번호는 헤더를 포함한 논리적 레코드 번호다. 전체 원문 본문을 다시 내려받은 분석이 아니라 목록의 이름·분류·글번호와 현재 API본문·대장·이전 작업 기록을 대조했다. 따라서 본문 문자열 미검출은 확정 부재가 아니다.
공개판은 기록된 확인시각의 스냅샷을 재사용한다. 재조사 시 공개manifest와한국어파일의version/count를함께확인해스냅샷을갱신해야한다. 동의어·복합 장소는 검토 규칙 파일에서 글 번호별로 보정하고 다시 실행한다. API콘텐츠와 data_version은이번분석에서바꾸지않았다.
