<?php

declare(strict_types=1);

/**
 * 여행 정보 페이지 예시 — 목록(분류·달 거르기, 검색)과 상세. 원격 API 를 부르지 않고 서버에 넣어 둔 파일만 쓴다.
 *
 *   <서버>/data/travel.db     ← node travel-db.mjs build --out …/data/travel.db --langs ko,en        (웹 루트 밖)
 *   <서버>/lib/TravelDb.php   ← 스킬의 assets/TravelDb.php                                         (웹 루트 밖)
 *   <서버>/html/travel.php    ← 이 파일
 *   <서버>/html/travel/       ← node travel-db.mjs export --out …/html/travel --langs ko,en --no-json  (travel.css·renderer.js·images/)
 *
 * 목록은 서버가 HTML 로 그린다(검색엔진에 보인다). 상세는 블록 JSON 을 페이지에 넣고 renderer.js 가 그린다.
 * 검색엔진·JS 끈 사용자를 위해 상세에도 제목·요약·본문 글(<noscript>)·JSON-LD·canonical·hreflang 을 서버가 넣는다.
 * 필고처럼 계층을 나누는 사이트에서는 TravelDb 호출을 저장소 층으로, HTML 을 위젯·뷰로 옮겨 쓴다.
 * PHP 8.1+ (TravelDb.php 와 같다). 맨 위 설정 다섯 줄만 고치면 된다.
 */

// ── 설정 — 서버 배치에 맞게 고친다 ──
const TRAVEL_DB = __DIR__ . '/../data/travel.db';
const TRAVEL_LIB = __DIR__ . '/../lib/TravelDb.php';
const TRAVEL_ASSETS = '/travel/';                 // export 폴더의 웹 경로 (사진·travel.css·renderer.js)
const TRAVEL_ORIGIN = 'https://www.example.com'; // 이 사이트의 공개 주소 — canonical·hreflang·JSON-LD 에 쓴다 (Host 헤더를 믿지 않는다)
const TRAVEL_DEFAULT_LANG = 'ko';                // ?lang 도 Accept-Language 도 맞는 언어가 없을 때

require TRAVEL_LIB;

$travel = new TravelDb(TRAVEL_DB, imageBase: TRAVEL_ASSETS);
// 입력은 문자열만 — ?q[]=x 같은 배열이 들어와도 경고를 내지 않게
$param = static fn (string $key): string => is_string($_GET[$key] ?? null) ? trim($_GET[$key]) : '';
$codes = array_column($travel->languages(), 'code');
$primary = static fn (string $tag): string => strtolower(explode('-', str_replace('_', '-', $tag))[0]); // zh-CN → zh
// 언어: ?lang → 브라우저 Accept-Language 에서 처음 맞는 것 → 기본 언어. 그래도 DB 에 없으면 대체 언어(en)
$want = $primary($param('lang'));
if ($want === '') {
    preg_match_all('/([a-z]{2,3})(?:[-_][a-z0-9]+)*/i', (string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''), $m);
    $want = current(array_intersect(array_map($primary, $m[1]), $codes)) ?: TRAVEL_DEFAULT_LANG;
}
$lang = $travel->lang($want);
$fellBack = $lang !== $want; // 요청한 언어가 없어 대체 언어로 보인다 — 화면에 알린다
$dir = $travel->dir($lang);

// 화면 글 — API 의 8개 언어. 사이트의 다국어 시스템이 있으면 그것으로 바꾼다. 없는 언어는 영어.
$ui = [
    'ko' => ['site' => '필리핀 여행', 'all' => '전체', 'search' => '검색', 'placeholder' => '검색 (예: 고래상어)', 'month' => '가기 좋은 달', 'any' => '아무 때나', 'count' => '%d곳', 'back' => '← 목록', 'none' => '여행지를 찾을 수 없습니다.', 'best' => '최적기', 'empty' => '조건에 맞는 여행지가 없습니다.', 'fallback' => '요청한 언어로는 제공되지 않아 한국어로 보여 드립니다.', 'm' => '%d월'],
    'en' => ['site' => 'Philippines Travel', 'all' => 'All', 'search' => 'Search', 'placeholder' => 'Search (e.g. whale shark)', 'month' => 'Best month', 'any' => 'Any time', 'count' => '%d places', 'back' => '← List', 'none' => 'Place not found.', 'best' => 'Best time', 'empty' => 'No places match.', 'fallback' => 'Not available in the requested language — showing English.', 'm' => 'Month %d'],
    'zh' => ['site' => '菲律宾旅行', 'all' => '全部', 'search' => '搜索', 'placeholder' => '搜索（例：鲸鲨）', 'month' => '最佳月份', 'any' => '不限', 'count' => '%d 处', 'back' => '← 列表', 'none' => '找不到该地点。', 'best' => '最佳时间', 'empty' => '没有符合条件的地点。', 'fallback' => '暂不支持所请求的语言，现以中文显示。', 'm' => '%d月'],
    'ja' => ['site' => 'フィリピン旅行', 'all' => 'すべて', 'search' => '検索', 'placeholder' => '検索（例：ジンベエザメ）', 'month' => 'おすすめの月', 'any' => 'いつでも', 'count' => '%d件', 'back' => '← 一覧', 'none' => 'スポットが見つかりません。', 'best' => 'ベストシーズン', 'empty' => '条件に合うスポットがありません。', 'fallback' => 'ご希望の言語には対応していないため、日本語で表示しています。', 'm' => '%d月'],
    'th' => ['site' => 'เที่ยวฟิลิปปินส์', 'all' => 'ทั้งหมด', 'search' => 'ค้นหา', 'placeholder' => 'ค้นหา (เช่น ฉลามวาฬ)', 'month' => 'เดือนที่น่าไป', 'any' => 'เมื่อไรก็ได้', 'count' => '%d แห่ง', 'back' => '← รายการ', 'none' => 'ไม่พบสถานที่', 'best' => 'ช่วงเวลาที่ดีที่สุด', 'empty' => 'ไม่มีสถานที่ที่ตรงกับเงื่อนไข', 'fallback' => 'ยังไม่รองรับภาษาที่ขอ จึงแสดงเป็นภาษาไทย', 'm' => 'เดือน %d'],
    'vi' => ['site' => 'Du lịch Philippines', 'all' => 'Tất cả', 'search' => 'Tìm kiếm', 'placeholder' => 'Tìm kiếm (vd: cá mập voi)', 'month' => 'Tháng nên đi', 'any' => 'Bất kỳ lúc nào', 'count' => '%d địa điểm', 'back' => '← Danh sách', 'none' => 'Không tìm thấy địa điểm.', 'best' => 'Thời điểm đẹp nhất', 'empty' => 'Không có địa điểm phù hợp.', 'fallback' => 'Chưa hỗ trợ ngôn ngữ bạn yêu cầu nên trang hiển thị bằng tiếng Việt.', 'm' => 'Tháng %d'],
    'ru' => ['site' => 'Путешествия по Филиппинам', 'all' => 'Все', 'search' => 'Найти', 'placeholder' => 'Поиск (например, китовая акула)', 'month' => 'Лучший месяц', 'any' => 'В любое время', 'count' => 'Мест: %d', 'back' => '← К списку', 'none' => 'Место не найдено.', 'best' => 'Лучшее время', 'empty' => 'Ничего не найдено.', 'fallback' => 'Запрошенный язык пока не поддерживается — страница показана на русском.', 'm' => 'Месяц %d'],
    'ar' => ['site' => 'السفر إلى الفلبين', 'all' => 'الكل', 'search' => 'بحث', 'placeholder' => 'بحث (مثل: القرش الحوتي)', 'month' => 'أفضل شهر', 'any' => 'أي وقت', 'count' => 'عدد الأماكن: %d', 'back' => '→ القائمة', 'none' => 'لم يتم العثور على المكان.', 'best' => 'أفضل وقت', 'empty' => 'لا توجد أماكن مطابقة.', 'fallback' => 'اللغة المطلوبة غير متاحة، لذا تُعرض الصفحة بالعربية.', 'm' => 'الشهر %d'],
];
$t = $ui[$lang] ?? $ui['en'];
// 달 이름 — intl 확장이 있으면 그 언어의 이름(三月·มีนาคม·مارس), 없으면 'm' 형식
$monthName = static fn (int $m): string => class_exists(IntlDateFormatter::class)
    ? (string) IntlDateFormatter::formatObject(new DateTimeImmutable(sprintf('2026-%02d-01', $m)), 'LLLL', $lang)
    : sprintf($t['m'], $m);

$h = static fn (?string $s): string => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$link = static fn (array $query): string => '?' . http_build_query($query + ['lang' => $lang]);
$self = TRAVEL_ORIGIN . (parse_url($_SERVER['REQUEST_URI'] ?? '/travel.php', PHP_URL_PATH) ?: '/travel.php');
$absolute = static fn (string $url): string => str_starts_with($url, 'http') ? $url : TRAVEL_ORIGIN . $url;
// 정적 파일 주소 — 파일이 바뀌면 주소도 바뀌게(캐시). 이 파일 옆 폴더에서 못 찾으면 데이터 version 으로
$asset = static fn (string $file): string => TRAVEL_ASSETS . $file . '?v='
    . (is_file($path = __DIR__ . TRAVEL_ASSETS . $file) ? filemtime($path) : $travel->version());

$slug = $param('place') !== '' ? $param('place') : null;
$place = $slug !== null ? $travel->place($slug, $lang) : null;
if ($slug !== null && $place === null) {
    http_response_code(404);
}
$q = $param('q');
$category = $param('category');
$month = max(0, min(12, (int) $param('month')));
$filter = array_filter(['category' => $category, 'month' => $month]);
if ($place === null) {
    // 검색도 분류·달 거르기를 함께 쓴다. 여행지는 100곳 안팎이라 한 번에 모두 보인다
    $items = $q !== ''
        ? $travel->search($q, $lang, 200, $filter)
        : $travel->list($filter + ['sort' => 'rating'], $lang, 200)['items'];
    // 분류 칩의 수 — 지금 검색어·달을 반영한다 (조건이 없으면 전체 수)
    $chipCount = static fn (array $c): int => $q !== ''
        ? count($travel->search($q, $lang, 200, array_filter(['category' => $c['key'], 'month' => $month])))
        : ($month ? $travel->list(['category' => $c['key'], 'month' => $month], $lang, 1)['total'] : (int) $c['count']);
}
$text = $place !== null ? $travel->text($place['slug'], $lang) : null;
// 이 페이지의 언어별 주소 — canonical·hreflang
$pageUrl = static fn (string $l): string => $self . '?' . http_build_query(array_filter(['place' => $slug, 'category' => $category, 'month' => $month ?: null, 'lang' => $l]));
?>
<!doctype html>
<html lang="<?= $h($lang) ?>" dir="<?= $h($dir) ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= $h($place !== null ? $place['title']['text'] . ' — ' . ($place['tagline']['text'] ?? '') : $t['site']) ?></title>
<link rel="canonical" href="<?= $h($pageUrl($lang)) ?>">
<?php foreach ($travel->languages() as $l): ?>
<link rel="alternate" hreflang="<?= $h($l['code']) ?>" href="<?= $h($pageUrl($l['code'])) ?>">
<?php endforeach ?>
<link rel="alternate" hreflang="x-default" href="<?= $h($pageUrl($travel->lang(null))) ?>">
<?php if ($q !== ''): ?><meta name="robots" content="noindex"><?php endif /* 검색 결과 쪽은 색인하지 않는다 */ ?>
<link rel="stylesheet" href="<?= $h($asset('travel.css')) ?>">
<?php /* 아이콘·제목 글꼴. 외부(Google) 요청이라 방문 기록이 남는다 — 사이트 원칙에 따라 자체 호스팅으로 바꾼다 (embedding.md §3.4) */ ?>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&family=Noto+Serif+KR:wght@500&display=swap">
<style>main{max-width:960px;margin:0 auto;padding:16px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.chips a{padding:4px 10px;border:1px solid var(--cdt-border);border-radius:999px;color:inherit;text-decoration:none}.chips a[aria-current]{background:var(--cdt-accent);color:var(--cdt-on-accent)}mark{background:var(--cdt-accent-soft);color:inherit}form{display:flex;flex-wrap:wrap;gap:8px}</style>
<?php if ($place !== null): ?>
<meta name="description" content="<?= $h($text['summary']) ?>">
<script type="application/ld+json"><?= json_encode([
    '@context' => 'https://schema.org',
    '@type' => 'TouristAttraction',
    'name' => $place['title']['text'],
    'description' => $text['summary'],
    'url' => $pageUrl($lang),
    'image' => [ // 사진 저작자도 함께 — CC 라이선스 표기
        '@type' => 'ImageObject',
        'url' => $absolute($place['image']['url']),
        'creditText' => $place['image']['credit'] ?? null,
        'acquireLicensePage' => $place['image']['source'] ?? null,
    ],
    'geo' => ['@type' => 'GeoCoordinates', 'latitude' => $place['latitude']['value'], 'longitude' => $place['longitude']['value']],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?></script>
<?php endif ?>
</head>
<body class="cdt-root">
<main>
<nav class="chips">
  <?php foreach ($travel->languages() as $l): ?>
    <a href="<?= $h('?' . http_build_query(array_filter(['place' => $slug, 'lang' => $l['code']]))) ?>"<?= $l['code'] === $lang ? ' aria-current="true"' : '' ?>><?= $h($l['name']) ?></a>
  <?php endforeach ?>
</nav>
<?php if ($fellBack): ?><p role="status"><?= $h($t['fallback'] ?? $ui['en']['fallback']) ?></p><?php endif ?>
<?php if ($place !== null): ?>
  <p><a href="<?= $h($link([])) ?>"><?= $h($t['back']) ?></a></p>
  <div id="place"><noscript>
    <h1><?= $h($text['title']) ?></h1>
    <p><?= $h($text['tagline']) ?></p>
    <p><?= $h($text['summary']) ?></p>
    <?php foreach (explode("\n\n", $text['body']) as $part): ?><p><?= nl2br($h($part)) ?></p><?php endforeach ?>
  </noscript></div>
  <script type="application/json" id="place-json"><?= json_encode($place, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
  <script type="module">
    import { renderPlace, enhance } from '<?= $h($asset('renderer.js')) ?>';
    const root = document.getElementById('place');
    const lang = document.documentElement.lang;
    root.innerHTML = renderPlace(JSON.parse(document.getElementById('place-json').textContent), {
      base: '', lang, dir: document.documentElement.dir,
      placeHref: (slug) => `?place=${encodeURIComponent(slug)}&lang=${encodeURIComponent(lang)}`,
    });
    enhance(root);
  </script>
<?php elseif ($slug !== null): ?>
  <p><?= $h($t['none']) ?> <a href="<?= $h($link([])) ?>"><?= $h($t['back']) ?></a></p>
<?php else: ?>
  <form>
    <input type="hidden" name="lang" value="<?= $h($lang) ?>">
    <input type="search" name="q" value="<?= $h($q) ?>" placeholder="<?= $h($t['placeholder']) ?>">
    <select name="month" aria-label="<?= $h($t['month']) ?>">
      <option value=""><?= $h($t['month']) ?>: <?= $h($t['any']) ?></option>
      <?php for ($m = 1; $m <= 12; $m++): ?><option value="<?= $m ?>"<?= $m === $month ? ' selected' : '' ?>><?= $h($monthName($m)) ?></option><?php endfor ?>
    </select>
    <?php if ($category !== ''): ?><input type="hidden" name="category" value="<?= $h($category) ?>"><?php endif ?>
    <button><?= $h($t['search']) ?></button>
  </form>
  <nav class="chips">
    <a href="<?= $h($link(array_filter(['q' => $q, 'month' => $month]))) ?>"<?= $category === '' ? ' aria-current="true"' : '' ?>><?= $h($t['all']) ?></a>
    <?php foreach ($travel->terms('category', $lang) as $c): ?>
      <a href="<?= $h($link(array_filter(['q' => $q, 'category' => $c['key'], 'month' => $month]))) ?>"<?= $c['key'] === $category ? ' aria-current="true"' : '' ?>><?= $h($c['name']) ?> <?= $chipCount($c) ?></a>
    <?php endforeach ?>
  </nav>
  <p><?= $h(sprintf($t['count'], count($items))) ?></p>
  <?php if (!$items): ?><p><?= $h($t['empty']) ?></p><?php endif ?>
  <div class="cdt-grid" style="--cols:3">
  <?php foreach ($items as $row): ?>
    <a class="cdt-card" href="<?= $h($link(['place' => $row['slug']])) ?>" style="display:block;color:inherit;text-decoration:none;padding:0;overflow:hidden">
      <div class="cdt-card__media" style="margin:0">
        <img src="<?= $h($row['image_url']) ?>" alt="<?= $h($row['title']) ?>" width="<?= (int) $row['image_width'] ?>" height="<?= (int) $row['image_height'] ?>" loading="lazy" style="display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover">
        <small class="cdt-credit cdt-credit--overlay"><?= $h($row['image_credit']) ?></small>
      </div>
      <div style="padding:16px">
        <span class="cdt-badge"><?= $h($row['category']) ?></span>
        <h3 style="margin:8px 0 4px"><?= $h($row['title']) ?></h3>
        <p style="margin:0 0 8px"><?= isset($row['snippet_html']) ? $row['snippet_html'] : $h($row['tagline']) ?></p>
        <small>★ <?= $h((string) $row['rating']) ?> · <?= $h($row['region']) ?> · <?= $h($t['best']) ?> <?= $h($row['best_season']) ?></small>
      </div>
    </a>
  <?php endforeach ?>
  </div>
<?php endif ?>
<p><small>data <?= $h($travel->version()) ?></small></p>
</main>
</body>
</html>
