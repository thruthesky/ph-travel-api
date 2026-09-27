# ph-travel-api

필리핀 여행지 100선을 JSON 으로 제공하는 정적 API 다. `main` 에 push 하면 GitHub Actions 가 `data/` 를 JSON 으로 빌드해 GitHub Pages 에 배포한다. 서버 코드는 없다.

- 기본 주소: `https://thruthesky.github.io/ph-travel-api/v1/`
- 원본: `data/*.md` (작성 규격 [data/README.md](data/README.md)), 사진 `data/images/*.webp`
- 빌드: `node scripts/build.mjs` → `_site/v1/` (외부 패키지 없음, Node 만 필요)

## 1. 파일

| 주소 | 내용 |
|------|------|
| `v1/manifest.json` | 버전 확인용 작은 파일. 클라이언트는 이것만 주기적으로 받는다 |
| `v1/places.json` | 여행지 전체 (약 1.3MB, 전송 때 gzip 으로 약 400KB) |
| `v1/images/<이름>.webp` | 사진. JSON 의 `url` 로만 접근한다 |

GitHub Pages 는 모든 응답에 `Cache-Control: max-age=600` 과 `Access-Control-Allow-Origin: *` 를 붙인다. 그래서 push 한 내용이 클라이언트에 보이기까지 최대 10분 걸릴 수 있고, 다른 도메인의 웹에서도 바로 불러 쓸 수 있다.

## 2. manifest.json

```json
{
  "schema": 1,
  "version": "68cef818ff36",
  "count": 100,
  "places": "places.json",
  "generated_at": "2026-09-27T10:27:14.357Z"
}
```

| 키 | 뜻 |
|----|----|
| `schema` | JSON 구조 번호. 구조가 바뀌면 경로가 `v2/` 로 바뀌고 `v1/` 은 그대로 남는다 |
| `version` | 내용 해시. **이 값이 바뀌었을 때만** `places.json` 을 다시 받는다. 문서만 고친 push 에서는 바뀌지 않는다 |
| `count` | 여행지 수 |
| `places` | 여행지 전체 파일 (manifest 기준 상대 경로) |
| `generated_at` | 빌드 시각. 참고용이며 비교에 쓰지 않는다 |

## 3. places.json

```json
{ "schema": 1, "version": "68cef818ff36", "count": 100, "places": [ { ... } ] }
```

여행지 하나의 키는 [data/README.md](data/README.md) 의 앞머리 키와 같고, 사진과 본문만 구조가 다르다.

| 키 | 형식 |
|----|------|
| `id` · `rating` · `latitude` · `longitude` | 숫자 |
| `tags` | 문자열 배열 |
| `slug` · `title` · `title_en` · `tagline` · `island_group` · `region` · `location` · `category` · `best_season` · `duration` · `budget` · `difficulty` · `airport` · `summary` | 문자열 |
| `image` | `{ "url", "credit", "source" }` 대표 사진 |
| `gallery` | 추가 사진 배열 (같은 형식, 없으면 `[]`) |
| `sections` | `[{ "title", "markdown" }]` 본문 `##` 단락 10개, 규격 순서 그대로 |

- 사진 `url` 은 `images/030-vigan.webp?v=2869bd00` 처럼 **places.json 이 있는 폴더 기준 상대 경로**다. `https://thruthesky.github.io/ph-travel-api/v1/` 에 이어 붙여 쓴다. `?v=` 는 사진 내용 해시라서 사진이 바뀌면 주소도 바뀐다. 그러니 주소를 키로 삼아 오래 캐시해도 된다.
- `sections[].markdown` 은 원문 그대로다.
  - `[**엘니도**](place:el-nido)` 는 다른 여행지로 가는 링크다. `place:` 뒤가 `slug` 다.
  - `3시간~4시간` 처럼 `~` 가 범위 표기로 쓰인다. `~` 두 개 사이를 취소선으로 그리는 마크다운 렌더러에서는 `\~` 로 이스케이프한다.
- 사진 저작자 표기(`credit`·`source`)는 CC 라이선스 조건이라서 화면에 반드시 보여야 한다.

## 4. 클라이언트 업데이트 절차

1. 처음 실행하면 `manifest.json` 을 받고, 이어서 `places.json` 을 받는다. 받은 `places.json` 을 기기에 저장하고 그 안의 `version` 도 함께 저장한다.
2. 앱 시작·포그라운드 복귀 때 `manifest.json` 을 받는다. 6시간에 한 번처럼 간격을 둔다.
3. `manifest.version` 이 저장된 값과 다르면 `places.json?v=<version>` 을 받는다.
   - `schema` 와 `count` 를 확인한 뒤 저장본을 **통째로** 바꾼다. 삭제된 여행지도 이것으로 함께 반영된다.
   - `?v=` 를 붙이면 HTTP 캐시에 남은 옛 파일 대신 새 파일을 받는다.
4. 받거나 확인하는 도중 실패하면 저장된 내용을 그대로 쓴다.
5. 사진은 미리 받지 않는다. 화면에 보일 때 받아서 `url` 을 키로 디스크에 캐시한다.

## 5. 여행지 추가·수정

1. `data/` 의 마크다운과 사진을 고친다 ([data/README.md](data/README.md) 규격).
2. 저장소 루트에서 `node scripts/build.mjs` 로 규격을 검사한다.
3. 커밋하고 `main` 에 push 하면 1~2분 뒤 배포된다. 진행 상황은 저장소의 Actions 탭에서 본다.

규격 검사에 실패하면 Actions 가 멈추고, 이전에 배포된 내용이 그대로 남는다.
