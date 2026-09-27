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
 */

// ── 설정 — 서버 배치에 맞게 고친다 ──
const TRAVEL_DB = __DIR__ . '/../data/travel.db';
const TRAVEL_LIB = __DIR__ . '/../lib/TravelDb.php';
const TRAVEL_ASSETS = '/travel/';   // export 폴더의 웹 경로 (사진·travel.css·renderer.js)

require TRAVEL_LIB;

$travel = new TravelDb(TRAVEL_DB, imageBase: TRAVEL_ASSETS);
$lang = $travel->lang(isset($_GET['lang']) ? (string) $_GET['lang'] : 'ko');
$dir = $travel->dir($lang);

// 화면 글 — 사이트의 다국어 시스템이 있으면 그것으로 바꾼다. 없는 언어는 영어.
$ui = [
    'ko' => ['site' => '필리핀 여행', 'all' => '전체', 'search' => '검색', 'placeholder' => '검색 (예: 고래상어)', 'month' => '가기 좋은 달', 'any' => '아무 때나', 'count' => '%d곳', 'back' => '← 목록', 'none' => '여행지를 찾을 수 없습니다.', 'best' => '최적기', 'm' => '%d월'],
    'en' => ['site' => 'Philippines Travel', 'all' => 'All', 'search' => 'Search', 'placeholder' => 'Search (e.g. whale shark)', 'month' => 'Best month', 'any' => 'Any time', 'count' => '%d places', 'back' => '← List', 'none' => 'Place not found.', 'best' => 'Best time', 'm' => 'Month %d'],
];
$t = $ui[$lang] ?? $ui['en'];

$h = static fn (?string $s): string => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$link = static fn (array $query): string => '?' . http_build_query($query + ['lang' => $lang]);
$origin = (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$self = $origin . strtok($_SERVER['REQUEST_URI'] ?? '/travel.php', '?');
$absolute = static fn (string $url): string => str_starts_with($url, 'http') ? $url : $origin . $url;

$slug = isset($_GET['place']) ? (string) $_GET['place'] : null;
$place = $slug !== null ? $travel->place($slug, $lang) : null;
if ($slug !== null && $place === null) {
    http_response_code(404);
}
$q = trim(isset($_GET['q']) ? (string) $_GET['q'] : '');
$category = isset($_GET['category']) ? (string) $_GET['category'] : '';
$month = isset($_GET['month']) ? max(0, min(12, (int) $_GET['month'])) : 0;
if ($place === null) {
    $items = $q !== ''
        ? $travel->search($q, $lang, 50)
        : $travel->list(array_filter(['category' => $category, 'month' => $month, 'sort' => 'rating']), $lang, 100)['items'];
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
<link rel="stylesheet" href="<?= $h(TRAVEL_ASSETS) ?>travel.css?v=<?= $h($travel->version()) ?>">
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
    'image' => $absolute($place['image']['url']),
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
    import { renderPlace, enhance } from '<?= $h(TRAVEL_ASSETS) ?>renderer.js';
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
      <?php for ($m = 1; $m <= 12; $m++): ?><option value="<?= $m ?>"<?= $m === $month ? ' selected' : '' ?>><?= $h(sprintf($t['m'], $m)) ?></option><?php endfor ?>
    </select>
    <?php if ($category !== ''): ?><input type="hidden" name="category" value="<?= $h($category) ?>"><?php endif ?>
    <button><?= $h($t['search']) ?></button>
  </form>
  <nav class="chips">
    <a href="<?= $h($link(array_filter(['month' => $month]))) ?>"<?= $category === '' && $q === '' ? ' aria-current="true"' : '' ?>><?= $h($t['all']) ?></a>
    <?php foreach ($travel->terms('category', $lang) as $c): ?>
      <a href="<?= $h($link(array_filter(['category' => $c['key'], 'month' => $month]))) ?>"<?= $c['key'] === $category ? ' aria-current="true"' : '' ?>><?= $h($c['name']) ?> <?= (int) $c['count'] ?></a>
    <?php endforeach ?>
  </nav>
  <p><?= $h(sprintf($t['count'], count($items))) ?></p>
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
