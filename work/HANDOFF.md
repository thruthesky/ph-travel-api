# 다른 팀 인계 — 현재 작업 정리

사용자는 2026-11-17(한국 시각) 대량 추가 작업을 이 팀에서 계속하지 않고, 현재 진행분만 마무리한 뒤 다른 팀에 넘기도록 지시했다. **최소 1,973개 추가 목표는 달성되지 않았다. 새 후보를 시작하지 않는다.** 현재 진행분은 아래와 같이 모두 등록 여부를 판정하고 인계 정리를 끝냈다. 실행 중인 공항 CLI·요청 도구·분담 실행기는 0개이며, 확인 기록은 `work/handoff-runtime-check.json`에 있다. 이번 인계 정리 중 신규 등록은 0개다.

## 검증·커밋된 데이터

- 로컬 항목 **331개**. 고정 기준 `dee9c2e`의 295개에서 **36개 추가**했다. 당시 최소 목표 총 2,268개까지 **1,937개 미완료**다. 최초 268개 기준으로는 누적 63개가 추가된 상태다. 이 숫자의 기준을 바꾸어 완료율을 부풀리지 않는다.
- 한국어·영어 실제 파일 각 331개. 다른 6개 언어는 실제 파일 각 268개이며 신규 63개는 `i18n/fallbacks.json`에 명시된 영어 대체다. 실제 번역 378개가 남았다.
- 사진 2,709장. 현재 고정 기준 이후 신규 36곳은 각각 10장이다. 기존 120곳의 사진 844장 부족은 별도 미완료 사항이다.
- 최종 콘텐츠 커밋 `81fcee4`, 실제 커밋 날짜 대장 반영 `1b851fc`.
- 최종 검증: 전체 331개 × 8언어 빌드·콘텐츠 검사 성공. `version=25e96048921c`, `data_version=2026-11-17T12:08:16Z`. 최근 불라칸 마을 사진 검사는 10장/수정0/먼위치0/눈검토8/맞음2. 한국어 불라칸 마을, 영어 실라이 성당, 아랍어의 오반도 영어 대체 조회도 성공했다.
- 데이터 위치는 오직 `data/`. 원본 `data/ko`, 영어 `data/en`, 사진 `data/images`, 근거 `sources`다. `_site/`는 생성물이므로 커밋하지 않는다.
- 현재 확정 36개의 ID·본문 실측·근거는 `work/expansion-1973/accepted-entry-review.json`, 기준 대비 추가 파일은 `net-additions.json`을 읽는다.

## 입력과 미수록 후보 분석

1. 원본 입력은 `work/philgo-travel-posts-before-2025-08-09.csv` 388행과 `work/philgo-travel-posts-since-2025-08-10.tsv` 1,153행, 합계 서로 다른 게시물 1,541개다. 파일 해시는 `work/expansion-1973/source-fetch-summary.json`에 있다.
2. 공개 본문 1,501개를 확보해 20개의 Codex CLI가 분할하여 전문을 읽고 1차 후보를 추출했다. 나머지는 입력 삭제35·빈본문3·공개불가2다. 본문 전문은 Git에서 제외된 `_i18n/work/expansion-1973/posts/<idx>.json`에 보존했다.
3. 통합 결과 `work/expansion-1973/parallel20/candidates.jsonl`은 18,365행이다. 미수록 분류7,322행·기존 문맥만3,383행 등의 수는 **게시물 간 중복·별칭·오류를 포함한 추출행 수**이며, 최종 고유 여행지 수나 등록 완료 수가 아니다.
4. `coverage.jsonl`의 1,501개 게시물 ID와 `read_full_body=true`를 대조했다. `first-pass-review.json`에는 20개 최종 산출물의 SHA256과 실제 사용량이 있다. 표시글 비교로 못 찾은 40개 구절은 원문 표기·HTML 속성·URL에서 모두 찾았다. 다만 사진 파일명은 그 장소가 본문 주제이거나 실제 그곳을 찍었다는 증거가 아니다. `evidence_channel`과 `evidence-attribute-review.json`을 참고한다.
5. 제목과 자동 정규식 기반 옛 후보 대장도 보존했지만 그것만으로 수록 여부를 확정하지 않는다. 정확한 장소 실재, 별칭, 기존 독립 상세와의 중복, 폐쇄/이전, 원문 연결 범위를 후보별로 재검토해야 한다. 도시 항목 안에 박물관이 한 번 등장했다고 박물관 독립 항목이 등록된 것으로 세지 않는다.

## 현재 진행분 — 새 작업 착수 금지

| 담당/예약 | 현재 정리 범위 | 재개에 필요한 자료 |
|---|---|---|
| 루손 | 387 보카우에: 원본7장 검수·조건부 독립2묶음으로 사진 부족 보류. 388 칼룸핏은 예비 조사만 보존, 389–406 미착수 | `work/parallel-1992/luzon/HANDOFF.json`, `387*`, `388*`, `_i18n/work/parallel-1992/luzon/` |
| 비사야 | 343 푸엔테 오스메냐 서클: 잠정9촬영묶음·원본 눈검수0으로 미완성 보류. 복원은 협약/계획 단계이며 착공·완공으로 쓰지 않음. 뒤의 후보는 예비 자료만 보존 | `work/parallel-1992/visayas/HANDOFF.json`, `343*`, `_i18n/work/parallel-1992/visayas/` |
| 민다나오 담당 | 363 바코르: 원본12장 검수·독립8묶음(조건부 포함9)으로 사진 부족 보류. 364 남부 칼로오칸·365 서부 만달루용·366 라로마 묘지는 예비 조사만 | `work/parallel-1992/mindanao/HANDOFF.json`, `363-366-network-results.json`, `_i18n/work/parallel-1992/mindanao/` |
| 부모 | 377 산페드로 라구나: 원본16장 확보·직접 검수 후 사진/본문/지도 미완성으로 보류. 추가 아치 사진은 워터마크·반사·흐림으로 탈락. 장소 오인/인물 주제/흔들림/중복 방문으로 탈락한 사진을 장수에 포함하지 않음 | `work/expansion-1973/377-pending-review.json`, `_i18n/work/expansion-1973/root/sanpedro-*`, `377-*` |
| 부모 | 378 타굼·379 파나보: 미등록 예비 후보. 타굼 원문·공식/독립 본문 기록만 보존, 추가 착수하지 않음 | `work/expansion-1973/378-tagum-research.json` |
| 공항20개 | 407–426 모두 미등록·미완성으로 인계 정리 종료. 자연 보류9개·사용자 요청 후 자료 정리11개. 사진 충족 가능성 탐색 단계도 있어 사진 확보 불가능으로 일괄 단정하지 않음 | `work/expansion-1973/parallel20/airport-handoff-index.json`, `author-assignments.json`, `_i18n/work/expansion-1973/parallel20/authors/<id>-<slug>/` |

공항별 최종 파일과 SHA256은 `airport-handoff-index.json`에 모았다. private 작업 폴더의 `pending-research.json`, `HANDOFF.json`(11개), `final-handoff.txt` 또는 `final-resumed.txt`/`final.txt`, 조사 원본을 함께 본다. `completion.json`이 있어도 콘텐츠 등록 준비 완료를 뜻하지 않는다. 공항20개에서 신규 등록은 0개다. 특히 414 바콜로드 실라이 공항은 메타에서 14작가그룹 가능성을 찾았지만 원본5장 검수·최종승인0·한영 집필0인 상태에서 사용자 요청에 따라 정리했다. 새 조사 없이 현재 자료만 인계했다.

루손·민다나오·비사야 담당도 최종 인계서를 제출하고 종료했다. 377 추가 원본 확보 CLI는 exit0을 확인했으며 원본16장 모두 직접 검수했다. 비사야의 344 옛 요청 핸들은 존재하지 않지만 전송 여부와 종료 코드는 확정하지 못했으므로 원기록의 미확정 상태를 보존했다. 현재 실행 없음과 모든 과거 요청의 성공은 구별한다.

예약 ID는 기존 대상과 연결되어 있다. 특히 357 다구판 철회, 360 피나글라바난 사진 부족 보류가 있으며 해당 번호를 다른 장소에 재사용하지 않는다. 이전 보고서가 남아 있다는 이유로 357을 복구·등록하지 않는다.

## 다른 팀이 지켜야 할 작업 규격

- 먼저 저장소 `AGENTS.md`와 `/Users/thruthesky/apps/skills/skills/api-skill/SKILL.md`, `references/pipeline.md`, `references/maintain.md`, `data/README.md`를 읽는다. `i18n/GUIDE.md`가 없는 환경에서는 실제 `_i18n/GUIDE.md`를 확인한다.
- 상세 기준은 한글 본문 약5,000–7,000자·10섹션·정수 번호6–8개 볼거리 카드·정확한 사진10장이다. 원본 가로1080 이상, 같은 작가 같은 날/연속 여행1장, 거의 같은 구도 반복 금지다. 작가 별칭도 정규화한다. 정확한 사진을 못 구하면 보류하며 숫자를 채우기 위해 다른 장소나 항공기 단독 사진을 섞지 않는다.
- 원문은 단서다. 변동 사실은 공식/최근 독립 본문을 실제 읽어 대조하고 `sources`에 날짜·판정·실패도 남긴다. 지도 두 곳이 OSM을 공유하면 독립 측량처럼 쓰지 않는다.
- 이미지 픽셀 생성/변경/정량 변환은 반드시 Codex CLI로 한다. 원본 확보와 열람은 가능하다. 이번 추가 사진은 생성 모델을 쓰지 않았고 Codex CLI에서 1080px/q80 WebP 수치 변환만 했다. 프롬프트·변환 보고서를 보존한다.
- 모든 담당은 scratch에만 완성본을 준비하고 **통합 담당 한 사람만** `data/ko,en/images`, `sources`로 복사한다. 여러 담당이 전역 데이터·대장을 동시에 수정하지 않는다.
- 공유 Commons 요청 도구는 `work/expansion-1973/parallel20/commons_get.py`다. 요청 도착 순서 FIFO·전역1요청·현재6초 간격, 실제403/429에는 Retry-After와 최소10분 휴식을 적용한다. exit75는 요청을 보내지 않은 냉각 상태다. URL/호스트/User-Agent를 바꾸어 원격 거부를 우회하지 않는다. 현재의 고정 식별 UA와 간격 근거는 `network-policy.json`에 있다.
- categorymembers가 수백 개를 반환해도 `imageinfo`가 붙은 수는50개뿐일 수 있다. 실제 메타가 있는 후보만 세고, 필요한 제목은 최대50개 묶음으로 보완한다. 성공한 파일은 재다운로드하지 않는다.
- 공항 CLI 최초 실행의 `workspace-write` 지정으로 발생한 `HTTP0/curl6`은 로컬 실행환경 문제였다. 기본 사용자 설정 `approval_policy=never`, `sandbox_mode=danger-full-access`의 동일 세션으로 재개해 정상200을 확인했다. 네트워크 실패를 실재하지 않는 원격403/429로 기록하지 않는다.

## 검증·커밋·배포

```sh
node scripts/i18n.mjs export <ID>
node scripts/i18n.mjs check en <ID>
node scripts/i18n.mjs import en <ID>
node /Users/thruthesky/apps/skills/skills/api-skill/scripts/content.mjs stamp data/meta.json
node scripts/build.mjs
node /Users/thruthesky/apps/skills/skills/api-skill/scripts/content.mjs check --dir _site/v2 --allow-few-images
node /Users/thruthesky/apps/skills/skills/api-skill/scripts/content.mjs images --dir _site/v2 --ids <ID목록>
node scripts/catalog.mjs --check
node scripts/candidates.mjs --check
```

`--allow-few-images`는 기존120곳 부족만 위한 예외다. 새 항목의 사진10장·라이선스·출처·직접 눈검수는 별도로 모두 통과해야 한다. `verify-checkpoint.mjs`는 부모가 인계 검토한 신규 ID만 검사하는 보조도구이며 사진 눈검수·사실 판단을 대신하지 않는다. `_i18n/work/expansion-1973/checkpoint-latest.json`과 검사 로그는 재확인 자료다.

**배포하지 않았고 GitHub에 push하지 않았다.** 이 저장소는 로컬 커밋까지만 하는 정책이며 R2 배포는 별도의 사용자 요청이 있어야 한다. 상위 필고 서브모듈 포인터도 커밋하지 않는다. 키 값은 읽어 출력하거나 인계 문서에 복사하지 않는다.

## 다른 팀에 전달하는 방법

가장 간단한 방법은 **이 작업 폴더 자체를 같은 컴퓨터의 다른 팀에서 여는 것**이다:

`/Users/thruthesky/apps/philgo/submodules/ph-travel-api`

GitHub에서 새로 clone하면 이 컴퓨터의 미푸시 커밋을 얻지 못한다. 이 폴더는 서브모듈이어서 `.git`이 상위 저장소의 실제 Git 디렉터리를 가리킬 수 있다. 다른 컴퓨터로 옮길 때에는 폴더만 복사하고 Git 기록도 옮겨졌다고 생각하지 말고, 최종 로컬 커밋에서 `git bundle create <전달경로>/ph-travel-api.bundle --all`로 기록을 만들고 받는 쪽에서 `git clone <전달경로>/ph-travel-api.bundle ph-travel-api`로 복원한다. bundle은 아직 만들지 않았다. 그 뒤 Git에서 제외된 `_i18n/work/expansion-1973/`, `_i18n/work/parallel-1992/`, `_i18n/GUIDE.md`도 전달해야 한다. 이 폴더들에는 원문·사진 원본·아직 미등록인 조사 자료가 있다. 자료 안의 절대 경로는 이동한 위치에 맞춰 대조한다. api-skill이 없는 컴퓨터에는 해당 스킬을 별도로 설치해야 한다. 키 폴더나 `~/.codex` 인증 정보를 전달하지 않는다.

다음 요청문을 복사해 전달하면 된다:

> `work/HANDOFF.md`와 `AGENTS.md`를 먼저 읽으세요. 현재 검증된 로컬 데이터와 후보 분석을 기준으로 이어받으세요. 현재 로컬 등록 수는331개이며 신규분은 한영으로 검증되었고, 고정295개 기준 최소1973개 추가 목표 중36개가 등록된 상태였습니다. 미완성 후보와 영어 fallback을 완료로 세지 마세요. scratch의 현재 작업 판정과 기존 항목 중복을 확인하고, 제가 새로 지시하는 범위만 진행하세요. GitHub push·R2 배포·상위 서브모듈 포인터 커밋은 하지 마세요.
