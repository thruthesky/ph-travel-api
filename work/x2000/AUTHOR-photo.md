# 사진 담당 안내 (photo)

이미 `data/` 에 본문(ko·en)이 있는 여행지 한 곳에 정확한 사진 10~12장을 찾아 둔다. 저장소 뿌리는 `/Users/thruthesky/apps/philgo/submodules/ph-travel-api` 이고 모든 명령은 뿌리에서 실행한다.
받은 값: **이름 `<id>-<slug>`(예: 1370-bencab-museum)·한글·영문 이름·지역·좌표·작업 폴더 `W` = `_i18n/work/x2000/<이름>/`**.

## 절대 규칙

- **쓰는 곳은 `W` 안뿐이다.** `data/`·`sources/`·`work/`·`i18n/`·git·meta 는 건드리지 않는다. 변환·적용·커밋은 통합 담당이 한다.
- Commons 요청은 `work/x2000/photos.py` 로만 한다(전역 직렬·6초 간격 — 사이트 부담을 줄이려고 일부러 느리다). curl·WebFetch 로 commons/upload.wikimedia.org 를 직접 부르지 않는다. exit 75(냉각 중)이면 몇 분 뒤 다시 한다. 한 곳에 `find` 는 많아야 5번, `get` 은 14장 안쪽으로 한다.
- 픽셀을 바꾸지 않는다(크기·변환 포함). 받은 JPEG 를 Read 로 열어 보기만 한다.
- **정확한 사진 10장이 안 되면 `W/photo-done.json` 에 `{"status":"hold","reason":"…"}` 를 쓰고 끝낸다.** 다른 장소 사진·비슷한 장소 사진·가짜 사진으로 채우지 않는다.
- 다른 에이전트를 부르지 않는다. 사용자에게 묻지 않는다.

## 순서

1. **본문 읽기** — `data/ko/<이름>.json` 의 제목·소개·highlights 에서 이 항목이 어떤 장소·명소를 말하는지 안다. 사진은 본문이 말하는 모습이어야 한다.
2. **찾기**
   ```bash
   python3 work/x2000/photos.py subcats W --cat "<분류 이름>"        # 하위 분류와 파일 수
   python3 work/x2000/photos.py find W --cat "<분류>" [--cat "<하위 분류>"] [--search "<이름> <지역>"] [--max 150]
   python3 work/x2000/photos.py get W "File:….jpg" "File:….jpg" …     # → W/orig/<n>.jpg (가로 1280)
   ```
   - 분류 이름은 영문 이름·위키백과 문서의 Commons 링크에서 얻는다. 분류가 없으면 `--search` 와 좌표 근처(후보 GPS)로 찾는다.
   - `find` 는 쓸 수 있는 후보(가로 1080 이상, CC BY·BY-SA·CC0·PD)만 보여 준다.
3. **12~14장을 골라 `get` 으로 받고, 받은 파일을 모두 Read 로 열어 직접 본다.** 기준:
   - 그 장소가 맞다(설명·분류에 이름이 있고, 이웃 장소·동명이소가 아니다).
   - 워터마크·큰 글자·로고·광고판이 주제가 아니다. 사람 얼굴이 주제가 아니다. 흐리지 않다. 문서·지도·도면·옛 흑백 사진·표지판 글자만 찍은 사진이 아니다.
   - **10장이 서로 다른 면을 보여 준다** — 대표 전경, 다른 각도·시간, 본문 highlights 의 명소, 활동, 그곳의 것이 분명한 음식·축제. 거의 같은 구도는 한 장만. 같은 작가가 같은 날 찍은 사진은 대상·구도가 분명히 다를 때만 여러 장, 가능한 한 작가·날짜를 섞는다.
   - 대표 사진(첫 장)은 장소 전경이 보이는 가로 사진이다.
   - 재해·재건으로 모습이 바뀐 곳은 바뀐 뒤 사진.
   - 후보를 다 봐도 합격 10장이 안 되면 hold.
4. **`W/photo-spec.json` 을 쓴다.**
   ```json
   { "images": [ { "file": "File:….jpg", "alt": "한국어 설명(그 사진에 실제로 보이는 것)", "alt_en": "English description of what the photo shows" }, … 10~12장, 첫 장이 대표 ],
     "checks": [ "images 와 같은 순서·같은 개수. 무엇을 보고 이 장소가 맞다고 판단했는지(분류·설명·GPS·보이는 것)", … ] }
   ```
   - `file` 은 `photos.json` 에 있고 `orig/index.json` 에 받은 것이어야 한다. 같은 사진을 두 번 쓰지 않는다.
5. **`W/photo-done.json`**
   ```json
   { "status": "ready", "id": 1370, "slug": "bencab-museum", "images": 10, "authors": 6, "commons_requests": 17, "notes": "본문과 사진이 어긋나는 점·사람이 볼 점" }
   ```
   본문(ko)이 사진을 보고 알게 된 사실과 다르면(없어진 건물·이름·위치 등) `notes` 에 적는다. 본문은 고치지 않는다.

마지막 답은 한 줄: `ready|hold — <이름> — <한 줄 사유·특이점>`.
