<?php

declare(strict_types=1);

/**
 * travel.db(SQLite) 조회 — 여행 정보를 웹 서버에서 검색·조회하는 참고 구현.
 *
 * DB 는 로컬 개발 컴퓨터에서 만들어 서버에 올린다(서버가 원격 API 를 부르지 않는다):
 *   node <스킬 폴더>/scripts/travel-db.mjs build --out travel.db
 * 읽기 전용으로 연다. 자료가 바뀌면 새 파일을 올려 통째로 바꾼다.
 * 필요한 것: PHP 8.1+, pdo_sqlite (SQLite 3.34+ — FTS5 trigram). 외부 패키지 없음.
 *
 *   $travel = new TravelDb(__DIR__ . '/travel.db', imageBase: 'https://thruthesky.github.io/ph-travel-api/v2/');
 *   $lang   = $travel->lang($_GET['lang'] ?? 'ko');                   // 없는 언어면 대체 언어
 *   $page   = $travel->list(['month' => 12, 'category' => 'beach'], $lang, limit: 20);
 *   $hits   = $travel->search('고래상어', $lang);
 *   $place  = $travel->place('boracay', $lang);                        // 블록 JSON (배열) — 렌더러에 넘긴다
 */
final class TravelDb
{
    private PDO $db;

    /** @var array<string, string> meta 표 (country, version, languages, fallback_language …) */
    private array $meta;

    private bool $hasFts;

    /**
     * @param string $path DB 파일 경로
     * @param string|null $imageBase 사진 url 앞에 붙일 주소. 사진을 서버로 복사했다면 그 경로('/travel/'), 아니면 API 주소.
     *                               null 이면 공개 API 주소(meta.base)
     */
    public function __construct(string $path, private ?string $imageBase = null)
    {
        if (!is_file($path)) {
            throw new RuntimeException("travel.db 가 없다 — {$path}");
        }
        // PHP 8.4+ 는 Pdo\Sqlite 상수를, 그 전 버전은 PDO::SQLITE_* 상수를 쓴다.
        $readOnly = class_exists(\Pdo\Sqlite::class)
            ? [\Pdo\Sqlite::ATTR_OPEN_FLAGS => \Pdo\Sqlite::OPEN_READONLY]
            : [PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY];
        $this->db = new PDO('sqlite:' . $path, null, null, $readOnly + [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $version = (int) $this->db->query('PRAGMA user_version')->fetchColumn();
        if ($version !== 1) {
            throw new RuntimeException("travel.db 스키마 버전 {$version} — 이 코드는 1 을 안다");
        }
        $this->meta = $this->db->query("SELECT key, value FROM meta WHERE key != 'meta_json'")->fetchAll(PDO::FETCH_KEY_PAIR);
        // 표가 있어도 서버의 SQLite 가 trigram 을 모르면(3.34 미만) MATCH 가 예외를 낸다 — 한 번 찾아 보고, 안 되면 글에서 직접 찾는다
        $this->hasFts = false;
        if ($this->db->query("SELECT 1 FROM sqlite_master WHERE name = 'place_fts'")->fetchColumn()) {
            try {
                $this->db->query("SELECT rowid FROM place_fts WHERE place_fts MATCH '\"abc\"' LIMIT 1")->fetchAll();
                $this->hasFts = true;
            } catch (PDOException) {
            }
        }
        $this->imageBase ??= $this->meta['base'] ?? '';
    }

    /** API 내용 해시 — 캐시 키·화면 아래 표시에 쓴다. */
    public function version(): string
    {
        return $this->meta['version'] ?? '';
    }

    /** @return list<array{code: string, name: string, dir: string, is_default: int}> */
    public function languages(): array
    {
        return $this->db->query('SELECT code, name, dir, is_default FROM languages ORDER BY is_default DESC, code')->fetchAll();
    }

    /** 요청한 언어가 DB 에 있으면 그것을, 없으면 대체 언어(fallback)를 돌려준다. */
    public function lang(?string $want): string
    {
        $codes = array_column($this->languages(), 'code');
        return in_array($want, $codes, true) ? $want : ($this->meta['fallback_language'] ?? $codes[0]);
    }

    /** 글 방향 — ar 은 rtl. <html dir="…"> 에 쓴다. */
    public function dir(string $lang): string
    {
        $st = $this->db->prepare('SELECT dir FROM languages WHERE code = ?');
        $st->execute([$lang]);
        return (string) ($st->fetchColumn() ?: 'ltr');
    }

    /**
     * 거르기 메뉴 — 분류(category)·권역(island_group)·지역(region)·난이도(difficulty)의 key, 그 언어의 이름, 여행지 수.
     * @return list<array{key: string, name: string, icon: ?string, count: int}>
     */
    public function terms(string $kind, string $lang): array
    {
        $column = ['category' => 'category_key', 'island_group' => 'island_group_key', 'region' => 'region_key', 'difficulty' => 'difficulty'][$kind]
            ?? throw new InvalidArgumentException("모르는 kind — {$kind}");
        $st = $this->db->prepare("SELECT t.key, t.name, t.icon, (SELECT count(*) FROM places p WHERE CAST(p.{$column} AS TEXT) = t.key) AS count
            FROM terms t WHERE t.kind = ? AND t.lang = ? ORDER BY count DESC, t.key");
        $st->execute([$kind, $lang]);
        return array_map(fn (array $r) => ['count' => (int) $r['count']] + $r, $st->fetchAll());
    }

    /**
     * 여행지 목록.
     * @param array{month?: int, category?: string, island_group?: string, region?: string, difficulty?: int,
     *              tag?: string, max_budget?: int, min_rating?: float, q?: string, sort?: string} $filter key 로 거른다
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    public function list(array $filter, string $lang, int $limit = 30, int $offset = 0): array
    {
        [$sqlWhere, $bind] = $this->filterWhere($filter, $lang);
        // 정렬은 정해진 값만 — 사용자 입력을 SQL 에 그대로 넣지 않는다
        $order = ['rating' => 'rating DESC, id', 'budget' => 'budget_min, id', 'name' => 'title', 'id' => 'id'][$filter['sort'] ?? 'id'] ?? 'id';

        $count = $this->db->prepare("SELECT count(*) FROM place_list WHERE {$sqlWhere}");
        $count->execute($bind);
        $st = $this->db->prepare("SELECT * FROM place_list WHERE {$sqlWhere} ORDER BY {$order} LIMIT :limit OFFSET :offset");
        foreach ($bind + [':limit' => $limit, ':offset' => $offset] as $k => $v) {
            $st->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $st->execute();
        return ['total' => (int) $count->fetchColumn(), 'items' => array_map($this->withImage(...), $st->fetchAll())];
    }

    /**
     * list·search 의 거르기 → place_list 의 WHERE 와 바인딩 값. 값은 모두 바인딩 인자로 넘긴다.
     * @return array{0: string, 1: array<string, int|float|string>}
     */
    private function filterWhere(array $filter, string $lang): array
    {
        $where = ['lang = :lang'];
        $bind = [':lang' => $lang];
        if (!empty($filter['month'])) {
            $where[] = 'id IN (SELECT place_id FROM place_months WHERE month = :month)';
            $bind[':month'] = (int) $filter['month'];
        }
        foreach (['category' => 'category_key', 'island_group' => 'island_group_key', 'region' => 'region_key'] as $name => $column) {
            if (!empty($filter[$name])) {
                $where[] = "{$column} = :{$name}";
                $bind[":{$name}"] = (string) $filter[$name];
            }
        }
        if (!empty($filter['difficulty'])) {
            $where[] = 'difficulty = :difficulty';
            $bind[':difficulty'] = (int) $filter['difficulty'];
        }
        if (!empty($filter['tag'])) {
            $where[] = 'id IN (SELECT place_id FROM place_tags WHERE lang = :lang AND tag = :tag)';
            $bind[':tag'] = (string) $filter['tag'];
        }
        if (!empty($filter['max_budget'])) {
            $where[] = 'budget_min <= :max_budget';
            $bind[':max_budget'] = (int) $filter['max_budget'];
        }
        if (!empty($filter['min_rating'])) {
            $where[] = 'rating >= :min_rating';
            $bind[':min_rating'] = (float) $filter['min_rating'];
        }
        if (!empty($filter['q'])) {
            $where[] = "(title LIKE :q ESCAPE '\\' OR tagline LIKE :q ESCAPE '\\' OR summary LIKE :q ESCAPE '\\' OR tags LIKE :q ESCAPE '\\')";
            $bind[':q'] = '%' . addcslashes((string) $filter['q'], '%_\\') . '%';
        }
        return [implode(' AND ', $where), $bind];
    }

    /** 발췌에서 찾은 낱말을 감싸는 표시 — 글에 나올 수 없는 개인 영역 문자라서 원문의 [ ] 와 섞이지 않는다. */
    private const MARK_OPEN = "\u{E000}";
    private const MARK_CLOSE = "\u{E001}";

    /**
     * 검색어 → 낱말. "…" 로 감싼 곳은 한 구절("life vest"), 나머지는 공백과 문장부호(, ， 、 ; ； 。 ! ！ ? ？)로 나눈다.
     * @return list<string>
     */
    public static function words(string $query): array
    {
        preg_match_all('/"([^"]+)"|[^\s,，、;；。!！?？"]+/u', $query, $m, PREG_SET_ORDER);
        $words = [];
        foreach ($m as $x) {
            $w = trim(isset($x[1]) && $x[1] !== '' ? $x[1] : $x[0]);
            if ($w !== '') {
                $words[] = $w;
            }
        }
        return $words;
    }

    /** $text 에 낱말이 모두 들어 있나 — 대소문자를 가리지 않는다(trigram 과 같게). */
    private static function hasAll(?string $text, array $words): bool
    {
        $low = mb_strtolower((string) $text);
        foreach ($words as $w) {
            if (!str_contains($low, mb_strtolower($w))) {
                return false;
            }
        }
        return true;
    }

    /**
     * 전문 검색 — 낱말(words())이 모두 들어 있는 여행지. 3글자 이상은 FTS5 trigram, 짧은 낱말은 글에서 직접 찾는다.
     * $filter 는 list() 와 같다 — 검색과 분류·달 거르기를 함께 쓴다('sort' 는 무시).
     * 순서: 제목에 모든 낱말 → 대표 태그에 모든 낱말 → 점수 → id (Node·Dart 구현과 같다).
     * 행에 snippet(찾은 낱말을 [ ] 로 감싼 글)과 snippet_html(이스케이프한 뒤 <mark> 로 감싼 HTML — 그대로 출력)이 붙는다.
     * @return list<array<string, mixed>>
     */
    public function search(string $query, string $lang, int $limit = 20, array $filter = []): array
    {
        $words = self::words($query);
        if (!$words) {
            return [];
        }
        $long = array_values(array_filter($words, fn (string $w) => mb_strlen($w) >= 3));
        $short = array_values(array_filter($words, fn (string $w) => mb_strlen($w) < 3));
        if ($long && $this->hasFts) {
            $match = implode(' AND ', array_map(fn (string $w) => '"' . str_replace('"', '""', $w) . '"', $long));
            $st = $this->db->prepare("SELECT t.place_id, t.title, t.tags, snippet(place_fts, 3, :open, :close, '…', 64) AS snippet, bm25(place_fts, 10, 6, 3, 1) AS score
                FROM place_fts JOIN place_texts t ON t.id = place_fts.rowid
                WHERE place_fts MATCH :match AND t.lang = :lang ORDER BY score LIMIT 200");
            $st->execute([':open' => self::MARK_OPEN, ':close' => self::MARK_CLOSE, ':match' => $match, ':lang' => $lang]);
        } else {
            $st = $this->db->prepare('SELECT place_id, title, tags, NULL AS snippet, 0 AS score FROM place_texts WHERE lang = ?');
            $st->execute([$lang]);
            $short = $words; // FTS 가 없으면 모든 낱말을 글에서 찾는다 (점수·발췌는 첫 낱말 기준)
        }
        unset($filter['sort']);
        $allowed = null;
        if (array_filter($filter)) {
            [$sqlWhere, $bind] = $this->filterWhere($filter, $lang);
            $ids = $this->db->prepare("SELECT id FROM place_list WHERE {$sqlWhere}");
            $ids->execute($bind);
            $allowed = array_flip($ids->fetchAll(PDO::FETCH_COLUMN));
        }
        $hay = $this->db->prepare('SELECT title, tags, summary, body FROM place_texts WHERE place_id = ? AND lang = ?'); // FTS 의 네 열과 같게
        $hits = [];
        foreach ($st->fetchAll() as $row) {
            if ($allowed !== null && !isset($allowed[$row['place_id']])) {
                continue;
            }
            if ($short) {
                $hay->execute([$row['place_id'], $lang]);
                $t = $hay->fetch();
                $all = "{$t['title']}\n{$t['tags']}\n{$t['summary']}\n{$t['body']}";
                if (!self::hasAll($all, $short)) {
                    continue;
                }
                if ($row['snippet'] === null) {
                    $w = mb_strtolower($short[0]);
                    $n = mb_strlen($w);
                    // 발췌는 요약·본문에서 먼저 — 제목·태그 나열로 시작하지 않게
                    $text = self::hasAll("{$t['summary']}\n{$t['body']}", [$w]) ? "{$t['summary']}\n{$t['body']}" : $all;
                    $i = (int) mb_strpos(mb_strtolower($text), $w);
                    $row['snippet'] = ($i > 30 ? '…' : '') . mb_substr($text, max(0, $i - 30), min($i, 30)) . self::MARK_OPEN . mb_substr($text, $i, $n) . self::MARK_CLOSE
                        . mb_substr($text, $i + $n, 50) . '…';
                    $row['score'] = -substr_count(mb_strtolower($all), $w); // 많이 나올수록 앞으로
                }
            }
            // 이름으로 찾으면 그 여행지가, 대표 태그가 맞으면 그곳이 앞 — bm25 는 긴 본문에 불리하다
            $row['boost'] = self::hasAll($row['title'], $words) ? 2 : (self::hasAll($row['tags'], $words) ? 1 : 0);
            $raw = str_replace("\n", ' ', (string) $row['snippet']);
            $row['snippet'] = str_replace([self::MARK_OPEN, self::MARK_CLOSE], ['[', ']'], $raw);
            $row['snippet_html'] = str_replace([self::MARK_OPEN, self::MARK_CLOSE], ['<mark>', '</mark>'], htmlspecialchars($raw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
            $hits[] = $row;
        }
        usort($hits, fn (array $a, array $b) => [-$a['boost'], $a['score'], $a['place_id']] <=> [-$b['boost'], $b['score'], $b['place_id']]);
        $hits = array_slice($hits, 0, $limit);
        if (!$hits) {
            return [];
        }
        $items = $this->rows(array_column($hits, 'place_id'), $lang);
        return array_map(fn (array $h) => $items[$h['place_id']] + ['snippet' => $h['snippet'], 'snippet_html' => $h['snippet_html']], $hits);
    }

    /** 여행지 한 곳의 블록 JSON (그 언어). 사진 url 은 imageBase 를 붙인 절대 주소로 바꾼다. slug 가 없으면 null. */
    public function place(string $slug, string $lang): ?array
    {
        $st = $this->db->prepare('SELECT t.json FROM place_texts t JOIN places p ON p.id = t.place_id WHERE p.slug = ? AND t.lang = ?');
        $st->execute([$slug, $lang]);
        $json = $st->fetchColumn();
        if ($json === false) {
            return null;
        }
        $place = json_decode((string) $json, true, 512, JSON_THROW_ON_ERROR);
        array_walk_recursive($place, function (&$value, $key) {
            if ($key === 'url' && is_string($value) && str_starts_with($value, 'images/')) {
                $value = $this->imageBase . $value;
            }
        });
        return $place;
    }

    /** 본문 전체 글 — <noscript>·meta description·검색엔진용. */
    public function text(string $slug, string $lang): ?array
    {
        $st = $this->db->prepare('SELECT t.title, t.tagline, t.summary, t.body FROM place_texts t JOIN places p ON p.id = t.place_id WHERE p.slug = ? AND t.lang = ?');
        $st->execute([$slug, $lang]);
        return $st->fetch() ?: null;
    }

    /** 직선거리로 가까운 여행지 — 200곳 안팎이라 PHP 에서 계산한다. @return list<array<string, mixed>> */
    public function near(string $slug, string $lang, int $limit = 5): array
    {
        $all = $this->db->query('SELECT id, slug, latitude, longitude FROM places')->fetchAll();
        $from = current(array_filter($all, fn (array $p) => $p['slug'] === $slug)) ?: throw new InvalidArgumentException("없는 slug — {$slug}");
        $km = [];
        foreach ($all as $p) {
            if ($p['id'] !== $from['id']) {
                $km[$p['id']] = self::haversine((float) $from['latitude'], (float) $from['longitude'], (float) $p['latitude'], (float) $p['longitude']);
            }
        }
        asort($km);
        $ids = array_slice(array_keys($km), 0, $limit);
        $items = $this->rows($ids, $lang);
        return array_map(fn (int $id) => $items[$id] + ['km' => (int) round($km[$id])], $ids);
    }

    /** @param list<int> $ids @return array<int, array<string, mixed>> id => 목록 한 줄 */
    private function rows(array $ids, string $lang): array
    {
        $st = $this->db->prepare('SELECT * FROM place_list WHERE lang = ? AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
        $st->execute([$lang, ...$ids]);
        $out = [];
        foreach ($st->fetchAll() as $row) {
            $out[(int) $row['id']] = $this->withImage($row);
        }
        return $out;
    }

    /** 목록 한 줄의 대표 사진 주소를 절대 주소로. 저작자(image_credit·image_source)는 화면에 반드시 보인다. */
    private function withImage(array $row): array
    {
        if (isset($row['image_url']) && str_starts_with((string) $row['image_url'], 'images/')) {
            $row['image_url'] = $this->imageBase . $row['image_url'];
        }
        return $row;
    }

    private static function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $rad = M_PI / 180;
        $h = sin(($lat2 - $lat1) * $rad / 2) ** 2 + cos($lat1 * $rad) * cos($lat2 * $rad) * sin(($lng2 - $lng1) * $rad / 2) ** 2;
        return 2 * 6371 * asin(sqrt($h));
    }
}
