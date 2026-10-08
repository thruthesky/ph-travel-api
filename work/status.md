# 지금 상태

작업을 끝낼 때마다 이 파일을 덮어쓴다. 숫자는 짐작하지 말고 아래 명령의 출력에서 옮긴다.

```bash
S=~/apps/skills/skills/api-skill
node scripts/build.mjs && node $S/scripts/content.mjs check --dir _site/v2 --allow-few-images   # 항목·언어·사진·version·data_version, 10장 미만 항목
node $S/scripts/travel.mjs --base _site/v2 info                                                 # 로컬 빌드
node $S/scripts/travel.mjs info                                                                 # R2 공개 판
```

## 값 (확인 2026-10-08)

| 항목 | 값 |
|------|----|
| 저장소 커밋 | `06181ef` (2026-10-07) |
| 항목 | 242곳 × 8개 언어(ar·en·ja·ko·ru·th·vi·zh) |
| 사진 | 1,710장 (`data/images/`) |
| 사진 10장 미만 | 127곳 — 모자란 사진 901장. 배포에 `--allow-few-images` 가 필요하다 |
| 근거 기록 `sources/` | 119곳 |
| meta 값 목록 | 분류 7 · 지역 35 · 지역별 추천 거점 9 · 월별 추천 12달 |
| 로컬 빌드 version | `dd5628ed7d37` · data_version `2026-10-07T07:26:55Z` |
| R2 공개 판 | `dd5628ed7d37` — 로컬 빌드와 같다 (`files.withcenter.com/ph-travel-api/v2/manifest.json`, count 242) |

## 남은 일

옛 스킬 `references/history.md` 에 흩어져 있던 것을 2026-10-08 에 모았다. 끝낸 것은 지우고 `log.md` 에 적는다.

- **사진:** 10장 미만 127곳을 채운다(`content.mjs photos`·`fetch`, 직접 열어 확인). Commons 에 맞는 사진이 모자란 곳 — 010 마숭이·054 발라박·062 카라바오 섬. 178 파밀라칸 섬 대표 사진을 섬이 보이는 사진으로 바꾼다. 239 는 같은 작가 사진 5장.
- **보강:** 075번 이후 옛 글·사진 3장 그대로인 곳을 2026-10 재조사와 같은 방식으로 보강한다. 075~089번 사진 일부는 작업 폴더에만 있다(저장소에는 없음).
- **근거 `sources/`:** 없는 항목은 고칠 때마다 채운다.
- **ko 원문 정리:** 같은 사실이 단락마다 다름, 지명 표기 흔들림('Gorordo' 같은 의심 표기) — 약 50건.
  - 코론 환경세 표기 — 047 ₱300~350, 202 약 ₱200, 224 ₱200, 249 ₱250~300. 공식 고시로 하나로.
  - 065 재연 행사 시각 7:00 → 2026년 자료는 8:00 쪽.
  - 혈맹 기념상이 2024-03 프렌드십 공원으로 옮겨졌다 — 074·077·177 문장 확인.
- **번역 어휘 통일:** zh 방카(螃蟹船), ru 방카('на банке'), ar 거리 단위, ja 루밴, th 「당일치기」("เที่ยววันเดียว" ↔ 어휘집 "เที่ยวไปกลับวันเดียว"), 240 ar 고유명사(음역·번역 혼재).
- **번역 지침·어휘집:** `AGENTS.md` 가 가리키는 `i18n/GUIDE.md`·`i18n/glossary/` 가 git 에 없고 `_i18n/`(git 무시)에만 있다. 정리해 git 에 넣는다.
- **빌드:** `build.mjs` 에 `data_version` 형식 검사를 넣는다(지금은 `content.mjs check`·`r2.mjs` 만 막는다).
- **데이터 결정:** 영어 번역 속 한국 독자 기준 문장을 현지화할지, 예산 기준(1일·투어 1회)을 `budget.basis` 같은 언어 공통 key 로 둘지.
- **옛 주소:** GitHub Pages 는 2026-10-01 판에서 멈춰 있다. 끌지는 사용자와 정한다.
- **101~200번:** WebSearch 한도가 찬 뒤 WebFetch 로 확인해 썼다. 현지 사정을 아는 사람이 한 번 훑어보면 좋다.
- **245 히나그다난 동굴:** 조사한 사실(요금·시간)이 있다. 사진이 늘면 다시 시도한다.
- **필고 웹사이트:** 여행 정보를 넣는다 — `travel.db` + `export` 폴더 + `TravelDb.php`.

### 스킬 쪽 남은 일 (고치는 곳은 `~/apps/skills`)

- Node 22.14 처럼 FTS5 가 없는 Node 에서 `travel.mjs`·`travel-db.mjs` 가 `no such module: fts5` 로 멈춘다. `--no-fts` 도 같이 멈춘다. FTS5 가 없으면 색인 없이 만들도록 고친다.
- 8개 언어 실제 번역으로 세 조회 구현(Node·PHP·Dart)의 결과를 다시 비교한다(ko·en·zh 만 끝냈다).
