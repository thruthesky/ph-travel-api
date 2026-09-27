#!/usr/bin/env node
// 여행 정보 API 의 JSON 을 받아(또는 로컬 폴더에서 읽어) SQLite DB 파일 하나로 만든다.
// 웹 서버(PHP)·앱에 넣어(임베딩) 쓰는 파일이다. 스키마는 ../assets/travel-schema.sql.
//
//   node travel-db.mjs build --out travel.db [--country ph] [--base <주소|폴더>] [--langs ko,en] [--no-fts]
//   node travel-db.mjs export --out ./public/travel [--langs ko,en] [--no-images]   웹·앱에 넣을 파일 폴더
//   node travel-db.mjs sync [--country ph] [--langs ko]      캐시 폴더의 JSON 을 최신으로 (version 같으면 받지 않음)
//
// 모듈로도 쓴다 — travel.mjs 가 import 한다: loadBundle · buildDb · exportFiles · openDb · searchPlaces · visibleText
// 외부 패키지 없음. Node 22.13+ 의 내장 node:sqlite 를 쓴다.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// node:sqlite 는 아직 실험 단계라 경고를 한 줄 찍는다 — 출력이 지저분해지지 않게 그 경고만 끈다.
const emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w?.message ?? w).includes('SQLite') ? undefined : emitWarning.call(process, w, ...rest));
let DatabaseSync;
try {
  ({ DatabaseSync } = await import('node:sqlite'));
} catch {
  console.error(`node:sqlite 가 없다 — Node 22.13 이상이 필요하다 (지금 ${process.version})`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
export const registry = JSON.parse(readFileSync(join(here, 'apis.json'), 'utf8'));
export const SCHEMA_SQL = readFileSync(join(here, '..', 'assets', 'travel-schema.sql'), 'utf8');
export const DB_SCHEMA_VERSION = 1; // travel-schema.sql 의 PRAGMA user_version 과 같아야 한다

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
const warn = (message) => console.error(`(알림) ${message}`);
const isRemote = (base) => /^https?:\/\//.test(base);

/** 나라 코드와 주소를 정한다 — --base > 환경변수 TRAVEL_API_BASE > apis.json. */
export function resolveApi({ country, base } = {}) {
  const code = String(country ?? registry.default);
  const api = registry.countries[code];
  const where = base ?? process.env.TRAVEL_API_BASE ?? api?.base;
  if (!where) fail(`등록되지 않은 나라 — ${code}. 등록된 나라: ${Object.keys(registry.countries).join(', ')}`);
  const root = isRemote(where) ? (where.endsWith('/') ? where : `${where}/`) : `${resolve(where)}/`;
  return { code, api, base: root };
}

export const cacheDirOf = (code) => join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'travel-api-skill', code);

// ───────────── 받기 — manifest 의 version 이 바뀌었을 때만 ─────────────

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** 쓸 언어 — 요청한 것 + 대체 언어(fallback). 'all' 이면 모두. manifest 에 없는 언어는 오류. */
function pickLangs(manifest, langs) {
  const all = manifest.languages ?? [];
  if (!langs || langs === 'all') return all;
  const want = [...new Set([...String(langs).split(',').map((s) => s.trim()).filter(Boolean), manifest.fallback_language].filter(Boolean))];
  const missing = want.filter((l) => !all.includes(l));
  if (missing.length) fail(`없는 언어 — ${missing.join(', ')}. 있는 언어: ${all.join(', ')}`);
  return all.filter((l) => want.includes(l));
}

function checkBundle(manifest, meta, places) {
  if (!manifest.places || typeof manifest.places !== 'object' || !manifest.meta) {
    throw new Error('manifest 가 다국어 형식이 아니다 (places 가 언어별 객체, meta 가 있어야 한다) — 스킬이나 API 가 옛 버전이다');
  }
  if (meta.version !== manifest.version) throw new Error('meta.json 의 version 이 manifest 와 다르다');
  for (const [lang, file] of Object.entries(places)) {
    if (file.version !== manifest.version || file.count !== file.places.length || file.count !== manifest.count) {
      throw new Error(`places.${lang} 의 version·count 가 manifest 와 다르다 — 배포 중일 수 있으니 잠시 뒤 다시`);
    }
  }
}

/**
 * JSON 묶음을 읽는다. 로컬 폴더면 바로 읽고, 주소면 캐시(~/.cache/travel-api-skill/<나라>/)를 쓰며
 * manifest.version 이 캐시와 다르거나 필요한 언어 파일이 없을 때만 받는다. 받지 못하면 캐시로 대신한다.
 * 돌려주는 값: { code, api, base, manifest, meta, places: { <lang>: places 파일 }, langs, from }
 */
export async function loadBundle({ country, base, langs, offline = false, refresh = false } = {}) {
  const where = resolveApi({ country, base });
  if (!isRemote(where.base)) {
    const dir = where.base;
    if (!existsSync(join(dir, 'manifest.json'))) fail(`manifest.json 이 없다 — ${dir}`);
    const manifest = readJson(join(dir, 'manifest.json'));
    const meta = readJson(join(dir, manifest.meta ?? 'meta.json'));
    const use = pickLangs(manifest, langs);
    const places = Object.fromEntries(use.map((l) => [l, readJson(join(dir, manifest.places[l]))]));
    checkBundle(manifest, meta, places);
    return { ...where, manifest, meta, places, langs: use, from: 'local' };
  }

  const cache = cacheDirOf(where.code);
  const cached = existsSync(join(cache, 'manifest.json')) ? readJson(join(cache, 'manifest.json')) : null;
  const fromCache = (use) => {
    const meta = readJson(join(cache, 'meta.json'));
    const places = Object.fromEntries(use.map((l) => [l, readJson(join(cache, cached.places[l]))]));
    return { ...where, manifest: cached, meta, places, langs: use, from: 'cache' };
  };
  const haveAll = (m, use) => existsSync(join(cache, 'meta.json')) && use.every((l) => existsSync(join(cache, m.places[l])));

  let manifest;
  if (offline) {
    if (!cached) fail('캐시가 없어서 --offline 으로는 읽을 수 없다');
    const use = pickLangs(cached, langs);
    if (!haveAll(cached, use)) fail(`캐시에 없는 언어가 있다 — ${use.join(', ')}`);
    return fromCache(use);
  }
  try {
    manifest = await fetchJson(`${where.base}manifest.json`);
  } catch (e) {
    if (cached && haveAll(cached, pickLangs(cached, langs))) {
      warn(`manifest 를 받지 못해 캐시(version ${cached.version})를 쓴다 — ${e.message}`);
      return fromCache(pickLangs(cached, langs));
    }
    fail(`manifest 를 받지 못했다 — ${e.message}`);
  }
  if (where.api && manifest.schema !== where.api.schema) {
    warn(`이 스킬은 schema ${where.api.schema} 를 알고, API 는 schema ${manifest.schema} 다 — /travel-api-skill update 로 스킬을 갱신할 것`);
  }
  const use = pickLangs(manifest, langs);
  if (!refresh && cached?.version === manifest.version && haveAll(manifest, use)) return fromCache(use);

  // version 이 바뀌었으면 옛 언어 파일은 버린다(섞이지 않게). 같으면 없는 언어만 더 받는다.
  const same = cached?.version === manifest.version && !refresh;
  const v = `?v=${manifest.version}`;
  const meta = same && existsSync(join(cache, 'meta.json')) ? readJson(join(cache, 'meta.json')) : await fetchJson(`${where.base}${manifest.meta}${v}`);
  const places = {};
  await Promise.all(use.map(async (l) => {
    const path = join(cache, manifest.places[l]);
    places[l] = same && existsSync(path) ? readJson(path) : await fetchJson(`${where.base}${manifest.places[l]}${v}`);
  }));
  checkBundle(manifest, meta, places);
  if (!same) rmSync(cache, { recursive: true, force: true });
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, 'meta.json'), JSON.stringify(meta));
  for (const l of use) writeFileSync(join(cache, manifest.places[l]), JSON.stringify(places[l]));
  writeFileSync(join(cache, 'manifest.json'), JSON.stringify(manifest)); // 마지막에 — 중간에 끊기면 다음에 다시 받는다
  return { ...where, manifest, meta, places, langs: use, from: 'download' };
}

// ───────────── 글 모으기 ─────────────

export const runsText = (runs) => (Array.isArray(runs) ? runs.map((r) => r.text).join('') : '');
const VISIBLE = ['title', 'subtitle', 'label', 'time', 'text', 'price', 'note', 'cite'];

/** 노드 안의 보이는 글을 문서 순서대로 한 문자열로 — 검색·요약용. 사진 저작자·주소·아이콘 이름은 뺀다. */
export function visibleText(node) {
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.type === 'image') return;
    for (const k of VISIBLE) if (typeof n[k] === 'string') out.push(n[k]);
    if (Array.isArray(n.children)) out.push(runsText(n.children));
    if (Array.isArray(n.columns)) out.push(n.columns.join(' '));
    if (Array.isArray(n.rows)) n.rows.forEach((r) => out.push(r.join(' ')));
    if (Array.isArray(n.items) && n.items.every((i) => typeof i === 'string')) out.push(n.items.join(', '));
    for (const [k, v] of Object.entries(n)) if (k !== 'children' && v && typeof v === 'object') walk(v);
  };
  walk(node);
  return out.filter(Boolean).join('\n');
}

const keyOf = (node) => String(node?.value ?? node?.text ?? '');

// ───────────── DB 만들기 ─────────────

/**
 * 묶음을 SQLite 파일로. 임시 파일에 만든 뒤 이름을 바꿔 통째로 교체한다 — 읽는 쪽이 반쯤 만든 DB 를 보지 않게.
 * fts=false 면 place_fts 를 만들지 않는다(파일이 작아진다 — 검색은 LIKE 로).
 */
export function buildDb(bundle, outPath, { fts = true } = {}) {
  const { manifest, meta, places, langs, code, base } = bundle;
  const out = resolve(outPath);
  mkdirSync(dirname(out), { recursive: true });
  const tmp = `${out}.tmp-${process.pid}`;
  rmSync(tmp, { force: true });
  const db = new DatabaseSync(tmp);
  try {
    db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA_SQL);
    if (!fts) db.exec('DROP TABLE place_fts;');
    db.exec('BEGIN');

    const source = places[manifest.source_language] ?? places[langs[0]];
    const set = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    // base 는 공개 API 주소(사진 주소의 기본값), source 는 실제로 읽은 곳(로컬 폴더일 수 있다)
    const publicBase = bundle.api?.base ?? (/^https?:\/\//.test(base) ? base : '');
    const metaRows = {
      country: code, base: publicBase, source: base, schema: manifest.schema, version: manifest.version, count: manifest.count,
      generated_at: manifest.generated_at, built_at: new Date().toISOString(),
      languages: JSON.stringify(langs), source_language: manifest.source_language, fallback_language: manifest.fallback_language,
      fts: fts ? 1 : 0, meta_json: JSON.stringify(meta),
    };
    for (const [k, v] of Object.entries(metaRows)) if (v !== undefined && v !== null) set.run(k, String(v));

    const langInfo = new Map((meta.languages ?? []).map((l) => [l.code, l]));
    const addLang = db.prepare('INSERT INTO languages (code, name, dir, is_default) VALUES (?, ?, ?, ?)');
    for (const l of langs) addLang.run(l, langInfo.get(l)?.native ?? l, langInfo.get(l)?.dir === 'rtl' ? 'rtl' : 'ltr', l === manifest.source_language ? 1 : 0);

    // 다국어 용어 — meta 의 목록에서. 없는 언어 이름은 대체 언어 → key 순서로 채운다.
    const addTerm = db.prepare('INSERT INTO terms (kind, key, lang, name, icon) VALUES (?, ?, ?, ?, ?)');
    const nameIn = (name, l) => name?.[l] ?? name?.[manifest.fallback_language] ?? null;
    const lists = [['category', meta.categories, 'key'], ['island_group', meta.island_groups, 'key'], ['region', meta.regions, 'key'], ['difficulty', meta.difficulties, 'value']];
    for (const [kind, list, keyField] of lists) {
      for (const item of list ?? []) for (const l of langs) addTerm.run(kind, String(item[keyField]), l, nameIn(item.name, l) ?? String(item[keyField]), item.icon ?? null);
    }

    // 언어와 상관없는 값 — 원본 언어 파일에서 한 번만 (빌드가 언어끼리 같음을 보장한다)
    const addPlace = db.prepare(`INSERT INTO places (id, slug, category_key, island_group_key, region_key, rating, difficulty,
      budget_min, budget_max, currency, latitude, longitude, airport_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const addMonth = db.prepare('INSERT OR IGNORE INTO place_months (place_id, month) VALUES (?, ?)');
    const addImage = db.prepare('INSERT INTO place_images (place_id, position, url, width, height, credit, source) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const idOf = new Map(source.places.map((p) => [p.slug, p.id]));
    const addLink = db.prepare('INSERT OR IGNORE INTO place_links (place_id, target_id, position) VALUES (?, ?, ?)');
    for (const p of source.places) {
      addPlace.run(p.id, p.slug, keyOf(p.category), keyOf(p.island_group), keyOf(p.region), p.rating?.value ?? 0, p.difficulty?.value ?? 0,
        p.budget?.min ?? null, p.budget?.max ?? null, p.budget?.currency ?? null, p.latitude?.value ?? 0, p.longitude?.value ?? 0, p.airport?.code ?? null);
      for (const m of p.best_season?.months ?? []) addMonth.run(p.id, m);
      [p.image, ...(p.gallery?.items ?? [])].filter(Boolean).forEach((img, i) => addImage.run(p.id, i, img.url, img.width ?? null, img.height ?? null, img.credit, img.source));
    }
    // 링크는 모든 여행지를 넣은 뒤에 — 대상 여행지가 먼저 있어야 한다(외래 키)
    for (const p of source.places) {
      let pos = 0;
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (!n || typeof n !== 'object') return;
        if (n.type === 'card' && n.place && idOf.has(n.place)) addLink.run(p.id, idOf.get(n.place), pos++);
        Object.values(n).forEach(walk);
      };
      walk(p.sections);
    }

    // 언어별 글 — 목록용 짧은 값, 본문 전체, 단락, 태그, 전문 검색
    const addText = db.prepare(`INSERT INTO place_texts (place_id, lang, title, title_en, tagline, summary, category, island_group, region,
      location, best_season, duration, budget, difficulty, airport, tags, body, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const addSection = db.prepare('INSERT INTO place_sections (place_id, lang, key, position, title, text) VALUES (?, ?, ?, ?, ?, ?)');
    const addTag = db.prepare('INSERT OR IGNORE INTO place_tags (place_id, lang, tag) VALUES (?, ?, ?)');
    for (const l of langs) {
      for (const p of places[l].places) {
        const t = (node) => node?.text ?? null;
        const tags = (p.tags?.items ?? []).join(', ');
        const summary = runsText(p.summary?.children);
        const body = (p.sections ?? []).map((s) => `${s.title}\n${visibleText(s.blocks)}`).join('\n\n');
        addText.run(p.id, l, p.title?.text ?? p.slug, t(p.title_en), t(p.tagline), summary, t(p.category), t(p.island_group), t(p.region),
          t(p.location), t(p.best_season), t(p.duration), t(p.budget), t(p.difficulty), t(p.airport), tags, body, JSON.stringify(p));
        (p.sections ?? []).forEach((s, i) => addSection.run(p.id, l, s.key, i, s.title, visibleText(s.blocks)));
        for (const tag of p.tags?.items ?? []) addTag.run(p.id, l, tag);
      }
    }
    // 외부 콘텐츠 FTS — 글은 place_texts 에 있으니 색인만 한 번에 만든다
    if (fts) db.exec("INSERT INTO place_fts(place_fts) VALUES ('rebuild'); INSERT INTO place_fts(place_fts) VALUES ('optimize');");
    db.exec('COMMIT');
    db.exec('VACUUM');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    db.close();
    rmSync(tmp, { force: true });
    throw e;
  }
  db.close();
  renameSync(tmp, out);
  // 앱에 넣을 때 쓰는 버전 표시 — 앱은 이 글자가 바뀌었을 때만 DB 를 다시 복사한다 (references/embedding.md §4)
  writeFileSync(`${out}.version`, `${manifest.version}\n`);
  return out;
}

/** DB 를 연다. 읽기 전용이 기본이다 — DB 는 고치지 않고 새로 만들어 바꾼다. */
export function openDb(path, { readOnly = true } = {}) {
  const db = new DatabaseSync(path, { readOnly });
  const v = db.prepare('PRAGMA user_version').get().user_version;
  if (v !== DB_SCHEMA_VERSION) {
    db.close();
    throw new Error(`DB 스키마 버전 ${v} — 이 스킬은 ${DB_SCHEMA_VERSION} 을 안다. 다시 만들 것`);
  }
  return db;
}

// ───────────── 검색 — 3글자 이상은 FTS5 trigram, 짧은 낱말은 LIKE ─────────────

/** trigram 은 코드 포인트 3개 단위로 색인한다 — 글자 수도 코드 포인트로 센다(PHP 의 mb_strlen 과 같다). */
const chars = (s) => [...s].length;

/**
 * 낱말(공백으로 나눔)이 모두 들어 있는 여행지를 찾는다. 결과: [{ place_id, snippet, score }]
 * trigram 은 3글자 미만을 찾지 못하므로 짧은 낱말은 place_texts 에서 LIKE 로 거른다. 100곳이라 충분히 빠르다.
 */
export function searchPlaces(db, query, lang, limit = 20) {
  const words = String(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const long = words.filter((w) => chars(w) >= 3);
  const short = words.filter((w) => chars(w) < 3);
  const hasFts = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'place_fts'").get();
  let rows;
  if (long.length && hasFts) {
    const match = long.map((w) => `"${w.replace(/"/g, '""')}"`).join(' AND ');
    rows = db.prepare(`SELECT t.place_id, snippet(place_fts, 3, '[', ']', '…', 64) AS snippet, bm25(place_fts, 10, 6, 3, 1) AS score
      FROM place_fts JOIN place_texts t ON t.id = place_fts.rowid
      WHERE place_fts MATCH ? AND t.lang = ? ORDER BY score LIMIT 200`).all(match, lang);
  } else {
    rows = db.prepare('SELECT place_id, NULL AS snippet, 0 AS score FROM place_texts WHERE lang = ?').all(lang);
    short.unshift(...long); // FTS 가 없으면 모든 낱말을 LIKE 로
    long.length = 0;
  }
  const like = db.prepare("SELECT body, title, tags FROM place_texts WHERE place_id = ? AND lang = ?");
  const out = [];
  for (const r of rows) {
    const t = like.get(r.place_id, lang);
    const hay = `${t.title}\n${t.tags}\n${t.body}`;
    if (!short.every((w) => hay.includes(w))) continue;
    let snippet = r.snippet;
    if (!snippet) {
      const w = short[0];
      const i = hay.indexOf(w);
      snippet = `${i > 30 ? '…' : ''}${hay.slice(Math.max(0, i - 30), i)}[${w}]${hay.slice(i + w.length, i + w.length + 50)}…`.replace(/\n/g, ' ');
      r.score = -(hay.split(w).length - 1); // 많이 나올수록 앞으로
    }
    out.push({ place_id: r.place_id, snippet: snippet.replace(/\n/g, ' '), score: r.score });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}

// ───────────── 넣어 쓸 파일 폴더 (임베딩) ─────────────

/**
 * 웹·앱에 그대로 넣을 폴더를 만든다 — API 와 같은 모양이라 같은 코드로 읽는다.
 *   manifest.json (넣은 언어만) · meta.json · places.<lang>.json · images/ · travel.css · renderer.js
 * travel.css 는 렌더러의 catalogCss(meta) 결과다 — PHP 가 서버에서 그린 목록도 JS 없이 모양이 잡힌다.
 */
export async function exportFiles(bundle, dir, { images = true, json = true } = {}) {
  const out = resolve(dir);
  mkdirSync(out, { recursive: true });
  const { manifest, meta, places, langs } = bundle;
  // json=false 는 PHP 사이트용 — 페이지가 DB 를 읽으므로 화면에 필요한 travel.css·renderer.js·사진만 둔다
  if (json) {
    const files = Object.fromEntries(langs.map((l) => [l, manifest.places[l]]));
    writeFileSync(join(out, 'manifest.json'), `${JSON.stringify({ ...manifest, languages: manifest.languages.filter((l) => langs.includes(l)), places: files }, null, 2)}\n`);
    writeFileSync(join(out, manifest.meta), JSON.stringify({ ...meta, languages: (meta.languages ?? []).filter((l) => langs.includes(l.code)) }));
    for (const l of langs) writeFileSync(join(out, files[l]), JSON.stringify(places[l]));
  }
  const renderer = join(here, '..', 'assets', 'renderer.mjs');
  const { catalogCss } = await import(pathToFileURL(renderer).href);
  writeFileSync(join(out, 'travel.css'), `${catalogCss(meta)}\n`);
  writeFileSync(join(out, 'renderer.js'), readFileSync(renderer)); // .js — 웹 서버가 모듈 MIME 을 확실히 붙이게
  const pics = images ? await downloadImages(bundle, out) : null;
  return { dir: out, langs, images: pics, json };
}

/** 모든 사진을 <dir>/images/ 에 받는다. 이미 있고 내용 해시(?v=)가 같으면 건너뛴다. */
export async function downloadImages(bundle, dir) {
  const source = bundle.places[bundle.manifest.source_language] ?? bundle.places[bundle.langs[0]];
  const urls = new Set();
  for (const p of source.places) for (const img of [p.image, ...(p.gallery?.items ?? [])].filter(Boolean)) urls.add(img.url);
  let got = 0;
  let kept = 0;
  for (const url of urls) {
    const [path, query] = url.split('?');
    const hash = new URLSearchParams(query ?? '').get('v');
    const dest = join(dir, path);
    if (existsSync(dest) && hash && createHash('sha256').update(readFileSync(dest)).digest('hex').startsWith(hash)) { kept++; continue; }
    mkdirSync(dirname(dest), { recursive: true });
    if (isRemote(bundle.base)) {
      const res = await fetch(bundle.base + url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    } else {
      writeFileSync(dest, readFileSync(join(bundle.base, path)));
    }
    got++;
  }
  return { total: urls.size, downloaded: got, kept };
}

// ───────────── 명령 ─────────────

const FLAGS = ['no-fts', 'no-images', 'no-json', 'offline', 'refresh', 'help'];
const VALUED = ['out', 'langs', 'country', 'base'];

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const [key, value] = a.slice(2).split(/=(.*)/s);
    // 오타(--lang 대신 --langs 등)를 조용히 넘기면 엉뚱한 DB 가 만들어진다 — 모르는 옵션은 멈춘다
    if (!FLAGS.includes(key) && !VALUED.includes(key)) fail(`모르는 옵션 — --${key}\n\n${HELP}`);
    if (value !== undefined) opts[key] = value;
    else if (!FLAGS.includes(key) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) opts[key] = argv[++i];
    else opts[key] = true;
  }
  return [rest, opts];
}

const HELP = `사용: node travel-db.mjs <명령> [옵션]

  build --out <파일>   JSON 을 받아 SQLite DB 를 만든다 (웹 서버·앱에 넣어 쓰는 파일). <파일>.version 도 쓴다
      --langs ko,en    넣을 언어 (기본: 모든 언어). 대체 언어(fallback)는 늘 들어간다
      --no-fts         전문 검색 색인(place_fts)을 빼서 파일을 줄인다 — 검색은 글에서 직접 찾는다
  export --out <폴더>  웹·앱에 넣을 파일 폴더 — manifest·meta·places.<lang>.json·images/·travel.css·renderer.js
      --langs ko,en    넣을 언어 (기본: 모든 언어)
      --no-images      사진은 받지 않는다 (API 주소의 사진을 그대로 쓸 때)
      --no-json        JSON 은 빼고 travel.css·renderer.js·images/ 만 — DB 를 읽는 PHP 사이트용
  sync                 캐시 폴더(~/.cache/travel-api-skill/<나라>/)의 JSON 을 최신으로 — version 이 같으면 받지 않는다

공통: --country ph · --base <주소|폴더> (환경변수 TRAVEL_API_BASE) · --offline · --refresh`;

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const [[command], opts] = parseArgs(process.argv.slice(2));
  if (!command || opts.help || command === 'help') {
    console.log(HELP);
    process.exit(0);
  }
  if (command === 'sync') {
    const b = await loadBundle({ country: opts.country, base: opts.base, langs: opts.langs ?? 'all', offline: opts.offline, refresh: opts.refresh });
    console.log(`${b.code} · version ${b.manifest.version} · 언어 ${b.langs.join(',')} · ${b.from === 'download' ? '새로 받음' : b.from === 'cache' ? '캐시 그대로 (version 같음)' : '로컬 폴더'} → ${b.from === 'local' ? b.base : cacheDirOf(b.code)}`);
  } else if (command === 'build') {
    if (!opts.out || opts.out === true) fail('--out <파일> 이 필요하다');
    const b = await loadBundle({ country: opts.country, base: opts.base, langs: opts.langs ?? 'all', offline: opts.offline, refresh: opts.refresh });
    const t0 = Date.now();
    const out = buildDb(b, opts.out, { fts: !opts['no-fts'] });
    const mb = (statSync(out).size / 1048576).toFixed(1);
    console.log(`${basename(out)} — ${b.code} version ${b.manifest.version} · ${b.manifest.count}곳 · 언어 ${b.langs.join(',')} · ${opts['no-fts'] ? 'FTS 없음' : 'FTS5 trigram'} · ${mb}MB · ${Date.now() - t0}ms`);
  } else if (command === 'export') {
    if (!opts.out || opts.out === true) fail('--out <폴더> 가 필요하다');
    const b = await loadBundle({ country: opts.country, base: opts.base, langs: opts.langs ?? 'all', offline: opts.offline, refresh: opts.refresh });
    const r = await exportFiles(b, opts.out, { images: !opts['no-images'], json: !opts['no-json'] });
    console.log(`${r.dir} — version ${b.manifest.version} · 언어 ${r.langs.join(',')} · ${r.json ? 'manifest·meta·places·' : ''}travel.css·renderer.js${r.images ? ` · 사진 ${r.images.total}장 (받음 ${r.images.downloaded}, 그대로 ${r.images.kept})` : ' · 사진 없음'}`);
  } else {
    fail(`모르는 명령 — ${command}\n\n${HELP}`);
  }
}
