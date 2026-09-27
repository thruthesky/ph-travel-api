#!/usr/bin/env node
// 여행 정보 API 조회 도구 — JSON 을 받아 SQLite(travel.db)에 넣고, 그 DB 로 목록·상세·검색·가까운 곳을 보여 준다.
// 이 스킬이 API 를 쓰는 기본 방식이다: 받기(version 이 바뀔 때만) → SQLite → 언어별 전문 검색·인덱스 → 조회.
// DB 는 ~/.cache/travel-api-skill/<나라>/travel.db 에 모든 언어를 넣어 두고, manifest.version 이 바뀌면 다시 만든다.
// 외부 패키지 없음. Node 22.13+ (node:sqlite). 사용법: node travel.mjs help
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDb, cacheDirOf, loadBundle, openDb, registry, runsText, searchPlaces } from './travel-db.mjs';

const BOOL = new Set(['json', 'offline', 'refresh', 'help', 'css']);
const REPEAT = new Set(['tag']);
const VALUED = new Set(['lang', 'country', 'base', 'section', 'limit', 'month', 'category', 'island', 'region', 'difficulty', 'tag', 'max-budget', 'min-rating', 'q', 'sort']);
const HELP = `사용: node travel.mjs <명령> [옵션]

명령
  countries                     등록된 나라 API 목록 (apis.json)
  info                          DB·API 정보 — version, 언어, 여행지 수, DB 파일 위치
  list [거르기]                  여행지 목록 표
  show <slug|id|이름> [--section key,…]   여행지 한 곳을 읽기 좋은 글로 (단락만 볼 수도 있다)
  search <낱말…> [거르기]         전문 검색 — 낱말이 모두 들어 있는 여행지와 그 문장 (3글자 이상은 FTS5 trigram)
                                "life vest" 처럼 따옴표로 감싸면 구절. list 의 거르기(--region 등)를 함께 쓸 수 있다
  near <slug|위도,경도> [--limit 5]  직선거리로 가까운 여행지
  values [kind…]                 거르기에 쓸 수 있는 값과 개수 — category·island_group·region·difficulty·tags·months·languages
  types [type] [--css]          표시 방법(meta.display.types) 목록 또는 한 type 의 규격
  sql "<SELECT …>"              DB 에 읽기 전용 SQL — 스키마는 assets/travel-schema.sql

거르기 (list·search) — 분류·권역·지역·태그는 key(beach) 나 어느 언어 이름의 일부(해변, Beach, 海滩)로
  --month 12 (12월·12月·Dec 도 됨)  --category 해변  --island 비사야  --region 세부 (지역·위치)
  --difficulty 쉬움|easy|1  --tag 가족 (여러 번 주면 모두 · 태그는 곳마다 대표 5개뿐 — 활동은 search 로)
  --max-budget 3000 (예산 범위의 아래 끝 budget_min 이 이하 — 기준(1일·투어 1회)은 예산 칸 괄호)
  --min-rating 4.5  --q 낱말 (이름·카피·요약·태그만 — 본문까지는 search)
  --sort id|rating(높은 순)|budget(싼 순)|name  --limit 30

공통 옵션
  --lang ko         결과 언어 (기본 ko, 환경변수 TRAVEL_API_LANG). zh-CN·en_US 처럼 줘도 앞부분으로 맞춘다
  --country ph      나라 (기본: apis.json 의 default)
  --base <주소|폴더> API 주소 직접 지정 — 로컬 빌드는 --base <저장소>/_site/v2 (환경변수 TRAVEL_API_BASE)
  --offline         받지 않고 캐시만    --refresh   캐시를 무시하고 다시 받아 DB 를 새로 만든다
  --json            가공하지 않은 JSON·행으로 출력`;

// ───────────── 인자 ─────────────

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const [key, value] = a.slice(2).split(/=(.*)/s);
    // 모르는 옵션(오타)을 조용히 넘기면 거르기가 빠진 답을 하게 된다 — 멈춘다
    if (!BOOL.has(key) && !VALUED.has(key)) fail(`모르는 옵션 — --${key} (node travel.mjs help)`);
    let v = true;
    if (value !== undefined) v = value;
    else if (!BOOL.has(key) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) v = argv[++i];
    if (VALUED.has(key) && v === true) fail(`--${key} 에 값을 줄 것`);
    // 같은 옵션을 두 번 주면 앞의 것이 조용히 사라진다 — 태그는 모두(AND), 나머지는 멈춘다
    if (REPEAT.has(key)) (opts[key] ??= []).push(v);
    else if (key in opts) fail(`--${key} 를 두 번 줬다 — 하나만 준다`);
    else opts[key] = v;
  }
  return [rest, opts];
}
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

// ───────────── DB 준비 — 받기 → (필요하면) 다시 만들기 → 열기 ─────────────

async function ensureDb(opts) {
  // 캐시 DB 에는 모든 언어를 넣는다 — 어느 언어 이름으로도 찾고(show 奥斯洛布), --lang 을 바꿔도 다시 만들지 않는다
  const bundle = await loadBundle({ country: opts.country, base: opts.base, langs: 'all', offline: opts.offline, refresh: opts.refresh });
  // 로컬 폴더는 폴더 경로별로 따로 둔다 — 원격 캐시 DB 와 섞이지 않게
  const dir = bundle.from === 'local' ? cacheDirOf(`local-${createHash('sha256').update(bundle.base).digest('hex').slice(0, 10)}`) : cacheDirOf(bundle.code);
  const path = join(dir, 'travel.db');
  let rebuild = !existsSync(path) || opts.refresh;
  if (!rebuild) {
    try {
      const db = openDb(path);
      const get = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value;
      const langs = JSON.parse(get('languages') ?? '[]');
      rebuild = get('version') !== bundle.manifest.version || !bundle.langs.every((l) => langs.includes(l)) || get('source') !== bundle.base;
      db.close();
    } catch {
      rebuild = true; // 스키마가 바뀌었거나 깨진 DB
    }
  }
  if (rebuild) buildDb(bundle, path);
  return { db: openDb(path), bundle, path, rebuilt: rebuild };
}

// ───────────── 노드를 글로 ─────────────

const absUrl = (base, url) => (/^https?:\/\//.test(url) ? url : base + url);

function valueText(node) {
  if (node == null || typeof node !== 'object') return String(node ?? '');
  if (node.type === 'rating') return `${node.value} / ${node.max}`;
  if (node.type === 'level') return `${node.text} (${node.value}/${node.max})`;
  if (node.type === 'tags') return node.items.join(', ');
  if (node.text !== undefined) return node.text;
  if (node.value !== undefined) return String(node.value);
  if (node.children) return runsText(node.children);
  return '';
}

/** 블록 노드를 마크다운 비슷한 글로. 모르는 type 은 rules 대로 대체한다. */
function blockText(b, base, depth = 3) {
  const h = '#'.repeat(Math.min(depth, 6));
  const inner = (blocks) => (blocks ?? []).map((x) => blockText(x, base, depth + 1)).join('\n\n');
  switch (b.type) {
    case 'section': return `## ${b.title} (${b.key})\n\n${(b.blocks ?? []).map((x) => blockText(x, base, 3)).join('\n\n')}`;
    case 'paragraph': return runsText(b.children);
    case 'caption': return `(${runsText(b.children)})`;
    case 'heading': return `${h} ${b.text}`;
    case 'title': case 'subtitle': case 'typography': return b.text;
    case 'blockquote': return `> ${runsText(b.children)}${b.cite ? ` — ${b.cite}` : ''}`;
    case 'alert': return `> [${b.variant ?? 'info'}] ${b.title ? `${b.title}: ` : ''}${runsText(b.children)}`;
    case 'list': return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${runsText(it.children)}`).join('\n');
    case 'stepper': return b.items.map((it) => `- ${it.time ? `${it.time} — ` : ''}${it.title ? `${it.title}: ` : ''}${runsText(it.children)}`).join('\n');
    case 'tabs': case 'accordion':
      return b.items.map((it) => `${h} ${it.title}${it.subtitle ? ` — ${it.subtitle}` : ''}\n\n${inner(it.blocks)}`).join('\n\n');
    case 'collapse': return `${h} ${b.title}\n\n${inner(b.blocks)}`;
    case 'grid': case 'masonry': return (b.blocks ?? []).map((x) => blockText(x, base, depth)).join('\n');
    case 'card': return `- ${b.number ? `${b.number}. ` : ''}**${b.title}**${b.place ? ` (slug: ${b.place})` : ''}${b.children ? ` — ${runsText(b.children)}` : ''}`;
    case 'pricing': return [`| ${b.columns.join(' | ')} |`, `|${b.columns.map(() => '---').join('|')}|`, ...b.items.map((it) => `| ${it.label} | ${it.price} | ${it.note ?? ''} |`)].join('\n');
    case 'table': return [`| ${b.columns.join(' | ')} |`, `|${b.columns.map(() => '---').join('|')}|`, ...b.rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
    case 'image': return `${ui.photo}: ${absUrl(base, b.url)} — ${b.credit}`;
    case 'figure': return `${blockText(b.image, base)}${b.children ? `\n${runsText(b.children)}` : ''}`;
    case 'carousel': return (b.items ?? []).map((x) => blockText(x, base)).join('\n');
    case 'map': return `지도: ${b.latitude}, ${b.longitude}`;
    case 'youtube': return `유튜브: https://youtu.be/${b.video_id}${b.title ? ` (${b.title})` : ''}`;
    case 'video': case 'audio': case 'music': case 'avatar': return `${b.title ?? b.name ?? b.type}: ${absUrl(base, b.url)}`;
    case 'hr': return '---';
    default:
      if (b.label) return `${b.label}: ${valueText(b)}`;
      if (b.text !== undefined) return b.text;
      if (b.children) return runsText(b.children);
      if (b.blocks) return inner(b.blocks);
      return '';
  }
}

const ui = { photo: '사진' }; // 결과 언어의 화면 글 — 명령을 처리하기 전에 채운다
const HEAD = new Set(['id', 'slug', 'title', 'title_en', 'tagline', 'summary', 'image', 'gallery', 'sections', 'latitude', 'longitude']);

function placeText(p, base, sectionFilter) {
  const en = p.title_en?.text && p.title_en.text !== p.title.text ? ` (${p.title_en.text})` : ''; // 영어에서 두 번 쓰지 않게
  const lines = [`# ${p.title.text}${en} — slug: ${p.slug}, id: ${p.id}`];
  const keys = sectionFilter ? String(sectionFilter).split(',').map((s) => s.trim()) : null;
  if (keys) { // 단락만 볼 때는 머리말을 되풀이하지 않는다
    for (const s of p.sections ?? []) if (keys.some((k) => s.key === k || s.title.includes(k))) lines.push('', blockText(s, base));
    if (lines.length === 1) lines.push('', `맞는 단락 없음 — key: ${(p.sections ?? []).map((s) => s.key).join(', ')}`);
    return lines.join('\n');
  }
  if (p.tagline) lines.push(`> ${p.tagline.text}`, '');
  for (const [key, node] of Object.entries(p)) {
    if (HEAD.has(key) || !node || typeof node !== 'object' || Array.isArray(node)) continue;
    lines.push(`- ${node.label ?? key}: ${valueText(node)}`);
  }
  if (p.latitude && p.longitude) lines.push(`- ${p.latitude.label ?? 'lat'}/${p.longitude.label ?? 'lng'}: ${p.latitude.value}, ${p.longitude.value}`);
  if (p.image) lines.push(`- ${ui.photo}: ${absUrl(base, p.image.url)} (${p.image.credit})`);
  for (const g of p.gallery?.items ?? []) lines.push(`- ${ui.photo}: ${absUrl(base, g.url)} (${g.credit})`);
  if (p.summary) lines.push('', runsText(p.summary.children));
  for (const s of p.sections ?? []) lines.push('', blockText(s, base));
  return lines.join('\n');
}

// ───────────── 표 ─────────────

const money = (min, max, basisText) => {
  if (min == null) return '';
  const n = (v) => Number(v).toLocaleString('en-US');
  const basis = /[(（]([^()（）]*)[)）]\s*$/.exec(basisText ?? '')?.[1]; // zh·ja 는 전각 괄호
  return `₱${n(min)}~${n(max)}${basis ? ` (${basis})` : ''}`;
};
function table(rows, cols, names = {}) {
  const cell = (v) => String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
  return [`| ${cols.map((c) => names[c] ?? c).join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`)].join('\n');
}
const LIST_COLS = ['id', 'slug', 'title', 'category', 'region', 'difficulty_text', 'rating', 'budget_text', 'best_season', 'tags'];
const LIST_NAMES = { title: '이름', category: '분류', region: '지역', difficulty_text: '난이도', rating: '추천도', budget_text: '예산(1인)', best_season: '최적기', tags: '태그', km: '거리(km)' };
const listRows = (db, lang, ids) => {
  if (!ids.length) return [];
  const rows = db.prepare(`SELECT * FROM place_list WHERE lang = ? AND id IN (${ids.map(() => '?').join(',')})`).all(lang, ...ids);
  const byId = new Map(rows.map((r) => [r.id, { ...r, budget_text: money(r.budget_min, r.budget_max, r.budget) }]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

// ───────────── 찾기 ─────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** 12 · 12월 · 12月 · Dec · December → 12. 모르면 멈춘다 (NaN 으로 조용히 0곳이 되지 않게). */
function parseMonth(v) {
  const s = String(v).trim().toLowerCase();
  const m = /^\d{1,2}/.test(s) ? parseInt(s, 10) : MONTHS.findIndex((x) => s.startsWith(x)) + 1;
  if (!(m >= 1 && m <= 12)) fail(`달을 모르겠다 — ${v} (1~12, 12월·12月·Dec)`);
  return m;
}

/** 분류·권역·지역 인자 → key 목록. key 그대로거나, 어느 언어 이름의 일부. */
function termKeys(db, kind, arg) {
  return db.prepare('SELECT DISTINCT key FROM terms WHERE kind = ? AND (key = ? OR name LIKE ?)').all(kind, String(arg), `%${arg}%`).map((r) => r.key);
}

/** list·search 의 거르기 → place_list 의 WHERE 조각과 인자. lang 조건은 부르는 쪽이 붙인다. */
function filterSql(db, opts) {
  const where = [];
  const params = [];
  const inKeys = (col, kind, arg) => {
    const keys = termKeys(db, kind, arg);
    if (!keys.length) fail(`${kind} 에 맞는 값이 없다 — ${arg}. values ${kind} 로 확인할 것`);
    where.push(`${col} IN (${keys.map(() => '?').join(',')})`);
    params.push(...keys);
  };
  if (opts.month) { where.push('id IN (SELECT place_id FROM place_months WHERE month = ?)'); params.push(parseMonth(opts.month)); }
  if (opts.category) inKeys('category_key', 'category', opts.category);
  if (opts.island) inKeys('island_group_key', 'island_group', opts.island);
  if (opts.region) {
    const keys = termKeys(db, 'region', opts.region);
    where.push(`(region_key IN (${keys.map(() => '?').join(',') || "''"}) OR location LIKE ?)`);
    params.push(...keys, `%${opts.region}%`);
  }
  if (opts.difficulty) {
    const d = String(opts.difficulty);
    const hit = /^\d$/.test(d) ? Number(d) : (meta.difficulties ?? []).find((x) => x.key === d || Object.values(x.name ?? {}).some((n) => n.includes(d)))?.value;
    if (!hit) fail(`난이도를 모르겠다 — ${d} (1·2·3, easy·moderate·hard, 쉬움·보통·어려움)`);
    where.push('difficulty = ?');
    params.push(hit);
  }
  // 태그는 어느 언어로 줘도 된다 — 같은 여행지의 태그는 언어마다 같은 뜻이다 (--lang en --tag 가족 도 된다)
  for (const t of opts.tag ?? []) { where.push('id IN (SELECT place_id FROM place_tags WHERE tag LIKE ?)'); params.push(`%${t}%`); }
  if (opts['max-budget']) { where.push('budget_min <= ?'); params.push(Number(opts['max-budget'])); }
  if (opts['min-rating']) { where.push('rating >= ?'); params.push(Number(opts['min-rating'])); }
  if (opts.q) { where.push('(title LIKE ? OR title_en LIKE ? OR tagline LIKE ? OR summary LIKE ? OR tags LIKE ?)'); params.push(...Array(5).fill(`%${opts.q}%`)); }
  return { where, params };
}

function findPlaceId(db, key) {
  if (!key) fail('여행지를 지정할 것 — slug, id, 이름');
  const k = String(key);
  const exact = db.prepare(`SELECT p.id FROM places p WHERE p.slug = lower(?) OR CAST(p.id AS TEXT) = ?
    UNION SELECT place_id FROM place_texts WHERE title = ? OR lower(title_en) = lower(?)`).all(k, k, k, k);
  if (exact.length === 1) return exact[0].id;
  const partial = db.prepare(`SELECT DISTINCT p.id, p.slug FROM places p JOIN place_texts t ON t.place_id = p.id
    WHERE p.slug LIKE ? OR t.title LIKE ? OR t.title_en LIKE ?`).all(`%${k.toLowerCase()}%`, `%${k}%`, `%${k}%`);
  if (partial.length === 1) return partial[0].id;
  if (partial.length > 1) fail(`여러 곳이 맞는다 — ${partial.map((p) => p.slug).join(', ')}`);
  fail(`여행지를 찾지 못했다 — ${key}. search 명령으로 찾아 볼 것`);
}

function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// ───────────── 명령 ─────────────

// 받기 실패·계약 위반은 스택 대신 한 줄로 — 원인과 할 일이 message 에 있다
process.on('uncaughtException', (e) => fail(`오류 — ${e.message}`));
const [[command, ...args], opts] = parseArgs(process.argv.slice(2));
if (!command || command === 'help' || opts.help) {
  console.log(HELP);
  process.exit(0);
}
if (command === 'countries') {
  for (const [code, a] of Object.entries(registry.countries)) {
    console.log(`${code}${code === registry.default ? ' (기본)' : ''} — ${a.name} ${a.name_en} · ${a.base} · schema ${a.schema} · github.com/${a.repo}`);
  }
  process.exit(0);
}

// zh-CN·en_US·ZH 는 앞부분으로, 흔한 나라 코드(cn·jp·kr·vn)는 언어 코드로
const langArg = String(opts.lang ?? process.env.TRAVEL_API_LANG ?? 'ko');
const primary = langArg.toLowerCase().split(/[-_]/)[0];
const lang = { cn: 'zh', jp: 'ja', kr: 'ko', vn: 'vi' }[primary] ?? primary;
const { db, bundle, path, rebuilt } = await ensureDb(opts);
if (!bundle.manifest.languages.includes(lang)) fail(`없는 언어 — ${langArg}. 있는 언어: ${bundle.manifest.languages.join(', ')}`);
const base = bundle.base;
const out = (value) => console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
const meta = JSON.parse(db.prepare("SELECT value FROM meta WHERE key = 'meta_json'").get().value);
// 표 머리·사진 줄은 결과 언어로 — 답에 그대로 옮겨도 언어가 섞이지 않게. 한국어는 원래 머리(예산(1인) 등)
const UI = {
  title: { ko: '이름', en: 'Name', zh: '名称', ja: '名前', th: 'ชื่อ', vi: 'Tên', ru: 'Название', ar: 'الاسم' },
  photo: { ko: '사진', en: 'Photo', zh: '照片', ja: '写真', th: 'ภาพ', vi: 'Ảnh', ru: 'Фото', ar: 'صورة' },
};
ui.photo = UI.photo[lang] ?? UI.photo.en;
const names = lang === 'ko' ? LIST_NAMES : Object.fromEntries(Object.keys(LIST_NAMES).map((c) => [c,
  c === 'title' ? UI.title[lang] ?? UI.title.en : c === 'km' ? 'km' : meta.fields?.[{ difficulty_text: 'difficulty', budget_text: 'budget' }[c] ?? c]?.label?.[lang] ?? c]));

switch (command) {
  case 'info': {
    const get = (k) => db.prepare('SELECT value FROM meta WHERE key = ?').get(k)?.value;
    out([
      `나라: ${bundle.code}${bundle.api ? ` (${bundle.api.name})` : ''} · 주소: ${base}`,
      `schema ${get('schema')} · version ${get('version')} · 여행지 ${get('count')}곳 · API 빌드 ${get('generated_at')}`,
      `API 언어: ${bundle.manifest.languages.join(', ')} (원본 ${bundle.manifest.source_language}, 대체 ${bundle.manifest.fallback_language})`,
      `DB 언어: ${JSON.parse(get('languages')).join(', ')} · DB ${path} (${(statSync(path).size / 1048576).toFixed(1)}MB, ${rebuilt ? '방금 만듦' : '그대로 씀'}) · JSON ${bundle.from === 'download' ? '새로 받음' : bundle.from === 'cache' ? '캐시' : '로컬 폴더'}`,
    ].join('\n'));
    break;
  }

  case 'list': {
    const f = filterSql(db, opts);
    const order = { id: 'id', rating: 'rating DESC, id', budget: 'budget_min, id', name: 'title COLLATE NOCASE' }[opts.sort ?? 'id'] ?? 'id';
    const ids = db.prepare(`SELECT id FROM place_list WHERE ${['lang = ?', ...f.where].join(' AND ')} ORDER BY ${order}`).all(lang, ...f.params).map((r) => r.id);
    const limit = Number(opts.limit ?? 30);
    const rows = listRows(db, lang, ids.slice(0, limit));
    if (opts.json) out(rows);
    else out(`${ids.length}곳${ids.length > rows.length ? ` 중 ${rows.length}곳 (--limit 로 늘림)` : ''} · 언어 ${lang}\n\n${table(rows, LIST_COLS, names)}`);
    break;
  }

  case 'show': {
    const id = findPlaceId(db, args.join(' '));
    const row = db.prepare('SELECT json FROM place_texts WHERE place_id = ? AND lang = ?').get(id, lang);
    const p = JSON.parse(row.json);
    out(opts.json ? p : placeText(p, base, opts.section));
    break;
  }

  case 'search': {
    const q = args.join(' ');
    if (!q.trim()) fail('찾을 낱말을 줄 것');
    const limit = Number(opts.limit ?? 20);
    let hits = searchPlaces(db, q, lang, 200);
    const f = filterSql(db, opts); // search 鲸鲨 --region 巴拉望 — 본문 검색과 거르기를 함께
    if (f.where.length) {
      const ok = new Set(db.prepare(`SELECT id FROM place_list WHERE ${['lang = ?', ...f.where].join(' AND ')}`).all(lang, ...f.params).map((r) => r.id));
      hits = hits.filter((h) => ok.has(h.place_id));
    }
    const rows = listRows(db, lang, hits.map((h) => h.place_id));
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (opts.json) { out(hits.slice(0, limit).map((h) => ({ ...byId.get(h.place_id), snippet: h.snippet }))); break; }
    out(hits.length
      ? `${hits.length}곳${hits.length > limit ? ` 중 ${limit}곳 (--limit 로 늘림)` : ''} · 언어 ${lang} — 부분 문자열 검색이라 짧은 낱말은 다른 낱말 속에도 걸린다\n\n${hits.slice(0, limit).map((h) => `- ${byId.get(h.place_id).title} (${byId.get(h.place_id).slug}) · ${h.snippet}`).join('\n')}`
      : `찾은 곳 없음 (언어 ${lang})`);
    break;
  }

  case 'near': {
    const key = args.join(' ');
    const coord = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(key);
    const fromId = coord ? null : findPlaceId(db, key);
    const all = db.prepare('SELECT id, latitude, longitude FROM places').all();
    const origin = coord ? [Number(coord[1]), Number(coord[2])] : (({ latitude, longitude }) => [latitude, longitude])(all.find((p) => p.id === fromId));
    const near = all.filter((p) => p.id !== fromId).map((p) => ({ id: p.id, km: Math.round(haversine(origin, [p.latitude, p.longitude])) })).sort((a, b) => a.km - b.km).slice(0, Number(opts.limit ?? 5));
    const rows = listRows(db, lang, near.map((n) => n.id)).map((r, i) => ({ ...r, km: near[i].km }));
    if (opts.json) out(rows);
    else out(`기준: ${fromId ? db.prepare('SELECT title FROM place_texts WHERE place_id = ? AND lang = ?').get(fromId, lang).title : key} — 직선거리로 가까운 곳 (실제 이동 거리·시간은 더 길다)\n\n${table(rows, [...LIST_COLS, 'km'], names)}`);
    break;
  }

  case 'values': {
    const kinds = args.length ? args : ['category', 'island_group', 'region', 'difficulty', 'tags', 'months', 'languages'];
    const col = { category: 'category_key', island_group: 'island_group_key', region: 'region_key', difficulty: 'difficulty' };
    const lines = [];
    for (const kind of kinds) {
      let rows;
      if (col[kind]) rows = db.prepare(`SELECT t.key, t.name, (SELECT count(*) FROM places p WHERE CAST(p.${col[kind]} AS TEXT) = t.key) AS n FROM terms t WHERE t.kind = ? AND t.lang = ? ORDER BY n DESC, t.key`).all(kind, lang).map((r) => `${r.name}[${r.key}](${r.n})`);
      else if (kind === 'tags') rows = db.prepare('SELECT tag, count(*) n FROM place_tags WHERE lang = ? GROUP BY tag ORDER BY n DESC, tag').all(lang).map((r) => `${r.tag}(${r.n})`);
      else if (kind === 'months') rows = db.prepare('SELECT month, count(*) n FROM place_months GROUP BY month ORDER BY month').all().map((r) => `${r.month}(${r.n})`);
      else if (kind === 'languages') rows = bundle.manifest.languages.map((l) => `${l}${(meta.languages ?? []).find((x) => x.code === l)?.dir === 'rtl' ? '(rtl)' : ''}`);
      else fail(`모르는 kind — ${kind}`);
      lines.push(`${kind} (${rows.length}개)\n  ${rows.join(' ')}`);
    }
    out(lines.join('\n\n'));
    break;
  }

  case 'types': {
    const display = meta.display ?? {};
    const types = display.types ?? {};
    const name = args[0];
    if (!name) {
      const groups = {};
      for (const [t, spec] of Object.entries(types)) (groups[spec.group] ??= []).push(`${t}(${spec.used ?? '?'})`);
      out(`표시 방법(type) ${Object.keys(types).length}개 — 괄호 안은 지금 쓰인 횟수\n\n${Object.entries(groups).map(([g, ts]) => `- ${display.groups?.[g] ?? g}\n  ${ts.join(' ')}`).join('\n')}`);
      break;
    }
    const spec = types[name];
    if (!spec) fail(`모르는 type — ${name}`);
    if (opts.json) { out(spec); break; }
    const propLine = ([k, r]) => `  - ${k} (${r.kind}${r.required ? ', 필수' : ''}${r.translate ? ', 번역' : ''}${r.enum ? `, ${r.enum.join('|')}` : ''}${r.types ? `, ${r.types.join('|')}` : ''}): ${r.description}${r.item ? `\n${Object.entries(r.item).map(([ik, ir]) => `      · ${ik} (${ir.kind}${ir.required ? ', 필수' : ''}${ir.translate ? ', 번역' : ''}): ${ir.description}`).join('\n')}` : ''}`;
    out([
      `${name} — ${spec.name} (${display.groups?.[spec.group] ?? spec.group}, 자리: ${spec.context.join('·')}, 쓰인 횟수 ${spec.used ?? '?'})`,
      spec.role,
      `props\n${Object.entries(spec.props ?? {}).map(propLine).join('\n') || '  (없음)'}`,
      spec.variants ? `variants\n${Object.entries(spec.variants).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}` : '',
      `html: ${spec.html}`,
      `flutter: ${spec.flutter}`,
      opts.css ? `css: ${spec.css}` : '',
      `예시: ${JSON.stringify(spec.example)}`,
    ].filter(Boolean).join('\n\n'));
    break;
  }

  case 'sql': {
    const sql = args.join(' ').trim();
    if (!/^(select|with|pragma|explain)\b/i.test(sql)) fail('sql 은 읽기(SELECT·WITH·PRAGMA)만 된다');
    let rows;
    try {
      rows = db.prepare(sql).all();
    } catch (e) {
      fail(`SQL 오류 — ${e.message}`);
    }
    if (opts.json) { out(rows); break; }
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const cut = (v) => (typeof v === 'string' && v.length > 120 ? `${v.slice(0, 120)}…` : v);
    out(rows.length ? `${rows.length}행\n\n${table(rows.slice(0, Number(opts.limit ?? 100)).map((r) => Object.fromEntries(cols.map((c) => [c, cut(r[c])]))), cols)}` : '0행');
    break;
  }

  default:
    fail(`모르는 명령 — ${command}\n\n${HELP}`);
}
db.close();
