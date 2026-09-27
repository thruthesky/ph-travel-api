-- 여행 정보 API(ph-travel-api 등) → SQLite 스키마.
--
-- 한 DB 파일(travel.db)에 한 나라의 여행지를 모든 언어로 담는다.
--   · 언어와 상관없는 값(좌표·예산·달·사진·분류 key)은 places 에 한 번만 둔다 → 거르기·정렬·지도.
--   · 언어별 글은 place_texts 에, 단락은 place_sections 에 둔다 → 화면 그리기(json 열)와 단락별 보기.
--   · 언어별 전체 텍스트(place_texts.body)를 place_fts(FTS5 trigram)로 색인한다 → 띄어쓰기 없는 언어(zh·ja·th)와
--     조사가 붙는 한국어도 부분 문자열로 찾는다. 3글자 미만 낱말은 trigram 이 못 찾으므로 글에서 직접 찾는다.
--   · place_fts 는 글을 복사하지 않는 외부 콘텐츠(content=place_texts) 표다 — 파일이 작다.
--     place_texts 를 다 넣은 뒤 INSERT INTO place_fts(place_fts) VALUES('rebuild') 로 색인을 만든다.
--   · 큰 행(여행지 JSON)이 있는 표는 WITHOUT ROWID 로 만들지 않는다 — SQLite 는 큰 행에서 그 형식이 비효율적이다.
-- 만드는 도구: scripts/travel-db.mjs (Node 22.13+ 내장 node:sqlite). SQLite 3.34 이상(trigram) 필요.
-- DB 는 읽기 전용으로 쓴다. 자료가 바뀌면 고치지 말고 새로 만들어 통째로 바꾼다.

PRAGMA user_version = 1;           -- 이 스키마의 버전. 구조를 바꾸면 올린다.

-- 데이터 출처와 버전 — country, base(공개 API 주소 — 사진 주소의 기본값), source(실제로 읽은 곳 — 로컬 폴더일 수 있다),
--   schema, version(API 내용 해시), count, generated_at, built_at, languages(JSON 배열), source_language, fallback_language, fts, meta_json
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 지원 언어 — dir 은 글 방향(ar 은 rtl)
CREATE TABLE languages (
  code       TEXT PRIMARY KEY,     -- ko, en, zh, ja, th, vi, ru, ar …
  name       TEXT NOT NULL,        -- 그 언어로 쓴 언어 이름 (한국어, English, 中文 …)
  dir        TEXT NOT NULL DEFAULT 'ltr' CHECK (dir IN ('ltr', 'rtl')),
  is_default INTEGER NOT NULL DEFAULT 0
);

-- 언어와 상관없는 여행지 값 — 모든 언어 파일에서 같아야 하는 값
CREATE TABLE places (
  id               INTEGER PRIMARY KEY,   -- API 의 id
  slug             TEXT NOT NULL UNIQUE,  -- 링크·주소에 쓰는 이름
  category_key     TEXT NOT NULL,         -- 분류 key (terms.kind='category')
  island_group_key TEXT NOT NULL,         -- 권역 key
  region_key       TEXT NOT NULL,         -- 지역 key
  rating           REAL NOT NULL,         -- 추천도 (4.0~5.0)
  difficulty       INTEGER NOT NULL,      -- 난이도 1 쉬움 · 2 보통 · 3 어려움
  budget_min       INTEGER,               -- 1인 예산 하한 (currency 단위)
  budget_max       INTEGER,
  currency         TEXT,                  -- PHP …
  latitude         REAL NOT NULL,
  longitude        REAL NOT NULL,
  airport_code     TEXT                   -- IATA
);

-- 여행 최적기의 달 — 12월에 가기 좋은 곳: WHERE month = 12
CREATE TABLE place_months (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  month    INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  PRIMARY KEY (place_id, month)
) WITHOUT ROWID;

-- 사진 — position 0 이 대표 사진, 1 부터 추가 사진. credit·source 는 화면에 반드시 보인다(CC 라이선스)
CREATE TABLE place_images (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url      TEXT NOT NULL,                 -- API 폴더 기준 상대 경로 + ?v=해시 (meta.base 에 이어 붙인다)
  width    INTEGER,
  height   INTEGER,
  credit   TEXT NOT NULL,
  source   TEXT NOT NULL,
  PRIMARY KEY (place_id, position)
) WITHOUT ROWID;

-- 함께 가보면 좋은 곳 — nearby 단락의 card.place 링크
CREATE TABLE place_links (
  place_id  INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  PRIMARY KEY (place_id, target_id)
) WITHOUT ROWID;

-- 언어별 글 — 목록·상세에 쓰는 짧은 값과 본문 전체
CREATE TABLE place_texts (
  id           INTEGER PRIMARY KEY,  -- 행 번호 — place_fts 가 이 번호로 글을 가리킨다
  place_id     INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL REFERENCES languages(code),
  title        TEXT NOT NULL,
  title_en     TEXT,
  tagline      TEXT,
  summary      TEXT,
  category     TEXT,          -- 그 언어의 분류 이름
  island_group TEXT,
  region       TEXT,
  location     TEXT,
  best_season  TEXT,
  duration     TEXT,
  budget       TEXT,          -- 기준(투어 1회 등)이 괄호에 붙은 원문
  difficulty   TEXT,
  airport      TEXT,
  tags         TEXT,          -- 태그를 ', ' 로 이은 것
  body         TEXT NOT NULL, -- 본문 10단락의 보이는 글 전체 (단락 제목 포함) — 검색·요약용
  json         TEXT NOT NULL, -- 그 언어의 여행지 JSON 원본 — 블록 렌더러에 그대로 넘긴다
  UNIQUE (place_id, lang)
);

-- 단락 — 한 단락의 글만 보거나, 검색이 어느 단락에서 걸렸는지 알 때
CREATE TABLE place_sections (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  lang     TEXT NOT NULL REFERENCES languages(code),
  key      TEXT NOT NULL,      -- overview · highlights · itinerary · getting_there · best_time · costs · stay_and_food · tips · cautions · nearby
  position INTEGER NOT NULL,
  title    TEXT NOT NULL,
  text     TEXT NOT NULL,      -- 단락의 보이는 글 (노드 원본은 place_texts.json 의 sections 에서 key 로 꺼낸다)
  UNIQUE (place_id, lang, key)
);

-- 태그 — 언어마다 다르다
CREATE TABLE place_tags (
  place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  lang     TEXT NOT NULL,
  tag      TEXT NOT NULL,
  PRIMARY KEY (place_id, lang, tag)
) WITHOUT ROWID;

-- 다국어 용어 — 분류·권역·지역의 key 와 언어별 이름 (거르기 메뉴에 쓴다)
CREATE TABLE terms (
  kind TEXT NOT NULL CHECK (kind IN ('category', 'island_group', 'region', 'difficulty')),
  key  TEXT NOT NULL,
  lang TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,                   -- Material Symbols 이름 (분류)
  PRIMARY KEY (kind, key, lang)
) WITHOUT ROWID;

-- 언어별 전문 검색 — trigram 은 3글자 이상을 부분 문자열로 찾는다. 글은 place_texts 에 있고 여기는 색인만 둔다.
--   SELECT t.place_id, snippet(place_fts, 3, '[', ']', '…', 64) AS snippet, bm25(place_fts, 10, 6, 3, 1) AS score
--   FROM place_fts JOIN place_texts t ON t.id = place_fts.rowid
--   WHERE place_fts MATCH '"엘니도"' AND t.lang = 'ko' ORDER BY score;
CREATE VIRTUAL TABLE place_fts USING fts5(
  title, tags, summary, body,
  content = 'place_texts',
  content_rowid = 'id',
  tokenize = 'trigram'
);

CREATE INDEX places_category     ON places(category_key);
CREATE INDEX places_island_group ON places(island_group_key);
CREATE INDEX places_region       ON places(region_key);
CREATE INDEX places_rating       ON places(rating DESC);
CREATE INDEX places_budget       ON places(budget_min);
CREATE INDEX place_months_month  ON place_months(month);
CREATE INDEX place_texts_lang    ON place_texts(lang, title);
CREATE INDEX place_sections_lang ON place_sections(lang, key);
CREATE INDEX place_tags_tag      ON place_tags(lang, tag);

-- 목록 한 줄 — WHERE lang = ? 로 언어를 고른다
CREATE VIEW place_list AS
SELECT p.id, p.slug, t.lang, t.title, t.title_en, t.tagline, t.summary, t.category, t.island_group, t.region, t.location,
       p.category_key, p.island_group_key, p.region_key, p.rating, p.difficulty, t.difficulty AS difficulty_text,
       p.budget_min, p.budget_max, p.currency, t.budget, t.best_season, t.duration, t.tags,
       p.latitude, p.longitude,
       i.url AS image_url, i.width AS image_width, i.height AS image_height, i.credit AS image_credit, i.source AS image_source
FROM places p
JOIN place_texts t ON t.place_id = p.id
LEFT JOIN place_images i ON i.place_id = p.id AND i.position = 0;
