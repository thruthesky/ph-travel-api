#!/usr/bin/env node
// 여행 정보 API(ph-travel-api 등)를 받아 캐시하고, 목록·상세·검색·가까운 곳·표시 방법을 읽기 좋은 글로 보여 준다.
// places.json(약 2MB)을 대화에 통째로 읽지 않고 필요한 부분만 꺼내 보려고 쓴다.
// 외부 패키지 없음. Node 18 이상. 사용법: node travel.mjs help
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(here, 'apis.json'), 'utf8'));
const BOOL = new Set(['json', 'offline', 'refresh', 'help', 'css']);

const HELP = `사용: node travel.mjs <명령> [옵션]

명령
  countries                    등록된 나라 API 목록 (apis.json)
  info                         manifest(version·count)와 캐시 상태
  list [거르기]                 여행지 목록 표
  show <slug|id|이름> [--section key,…]   여행지 한 곳을 읽기 좋은 글로 (section 은 key 또는 제목 일부)
  search <낱말…>                모든 글에서 찾기 — 낱말이 모두 들어 있는 여행지와 그 문장
  near <slug|위도,경도> [--limit 5]  직선거리로 가까운 여행지
  types [type] [--css]         content_display_type 목록 또는 한 type 의 규격
  values [속성]                 거르기에 쓸 수 있는 값과 개수 — category·island_group·region·difficulty·tags·months

거르기 (list) — 글 값은 부분 일치 (--category 해변 → 해변·섬), 쓸 수 있는 값은 values 명령
  --month 12 (best_season.months)  --category 해변  --island 비사야  --region 세부 (지역·위치)
  --difficulty 쉬움  --tag 가족  --max-budget 3000 (budget.min 이하)  --min-rating 4.5
  --q 낱말 (이름·카피·요약·태그)  --sort id|rating(높은 순)|budget(싼 순)|name  --limit 30

공통 옵션
  --country ph      나라 코드 (기본: apis.json 의 default)
  --base <주소|폴더> API 주소를 직접 지정 — 로컬 빌드는 --base <저장소>/_site/v2 (환경변수 TRAVEL_API_BASE 도 된다)
  --offline         받지 않고 캐시만 쓴다        --refresh   캐시를 무시하고 다시 받는다
  --json            가공하지 않은 JSON 으로 출력`;

// ───────────── 인자 ─────────────

function parseArgs(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const [key, value] = a.slice(2).split(/=(.*)/s);
    if (value !== undefined) opts[key] = value;
    else if (!BOOL.has(key) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) opts[key] = argv[++i];
    else opts[key] = true;
  }
  return [rest, opts];
}

const fail = (message) => {
  console.error(message);
  process.exit(1);
};
const warn = (message) => console.error(`(알림) ${message}`);

// ───────────── 받기와 캐시 — README 의 클라이언트 업데이트 절차 그대로 ─────────────

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** manifest 를 받아 version 이 캐시와 다를 때만 places·content_display_type 을 다시 받는다. */
async function load(opts) {
  const code = String(opts.country ?? registry.default);
  const api = registry.countries[code];
  const base = String(opts.base ?? process.env.TRAVEL_API_BASE ?? api?.base ?? '');
  if (!base) fail(`등록되지 않은 나라 — ${code}. 등록된 나라: ${Object.keys(registry.countries).join(', ')}`);

  // 로컬 폴더(예: 저장소의 _site/v2)는 캐시 없이 바로 읽는다.
  if (!/^https?:\/\//.test(base)) {
    const dir = resolve(base);
    const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
    if (!existsSync(join(dir, 'manifest.json'))) fail(`manifest.json 이 없음 — ${dir} (먼저 node scripts/build.mjs)`);
    const manifest = read('manifest.json');
    return finish({ code, api, base: `${dir}/`, manifest, places: read(manifest.places), cdt: read(manifest.content_display_type), fromCache: 'local' });
  }

  const root = base.endsWith('/') ? base : `${base}/`;
  const cacheDir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'travel-api-skill', code);
  const cachePath = (name) => join(cacheDir, name);
  const cached = ['manifest.json', 'places.json', 'content_display_type.json'].every((n) => existsSync(cachePath(n)))
    ? {
        manifest: JSON.parse(readFileSync(cachePath('manifest.json'), 'utf8')),
        places: JSON.parse(readFileSync(cachePath('places.json'), 'utf8')),
        cdt: JSON.parse(readFileSync(cachePath('content_display_type.json'), 'utf8')),
      }
    : null;
  if (opts.offline) {
    if (!cached) fail('캐시가 없어서 --offline 으로는 읽을 수 없음');
    return finish({ code, api, base: root, ...cached, fromCache: true });
  }

  let manifest;
  try {
    manifest = await fetchJson(`${root}manifest.json`);
  } catch (e) {
    if (!cached) fail(`manifest 를 받지 못함 — ${e.message}`);
    warn(`manifest 를 받지 못해 캐시(version ${cached.manifest.version})를 쓴다 — ${e.message}`);
    return finish({ code, api, base: root, ...cached, fromCache: true });
  }
  if (cached && !opts.refresh && cached.manifest.version === manifest.version) {
    return finish({ code, api, base: root, ...cached, fromCache: true });
  }
  const v = `?v=${manifest.version}`;
  const [places, cdt] = await Promise.all([fetchJson(`${root}${manifest.places}${v}`), fetchJson(`${root}${manifest.content_display_type}${v}`)]);
  // 세 파일의 version·count 가 맞을 때만 저장본을 통째로 바꾼다.
  if (places.version !== manifest.version || cdt.version !== manifest.version || places.count !== places.places.length) {
    fail('받은 파일의 version·count 가 manifest 와 다름 — 배포 중일 수 있으니 잠시 뒤 다시 시도');
  }
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath('places.json'), JSON.stringify(places));
  writeFileSync(cachePath('content_display_type.json'), JSON.stringify(cdt));
  writeFileSync(cachePath('manifest.json'), JSON.stringify(manifest));
  return finish({ code, api, base: root, manifest, places, cdt, fromCache: false });
}

function finish(data) {
  if (data.api && data.manifest.schema !== data.api.schema) {
    warn(`이 스킬은 schema ${data.api.schema} 를 알고, API 는 schema ${data.manifest.schema} 다 — /travel-api-skill update 로 스킬을 갱신할 것`);
  }
  return { ...data, list: data.places.places };
}

// ───────────── 노드를 글로 ─────────────

const runsText = (runs) => (Array.isArray(runs) ? runs.map((r) => r.text).join('') : '');
const absUrl = (base, url) => (/^https?:\/\//.test(url) ? url : base + url);

/** 값 노드 하나를 짧은 글로. */
function valueText(node) {
  if (node == null || typeof node !== 'object') return String(node ?? '');
  if (node.type === 'rating' || node.type === 'level') return node.type === 'level' ? `${node.text} (${node.value}/${node.max})` : `${node.value} / ${node.max}`;
  if (node.type === 'tags') return node.items.join(', ');
  if (node.text !== undefined) return node.text;
  if (node.value !== undefined) return String(node.value);
  if (node.children) return runsText(node.children);
  return '';
}

const ALERT = { info: '안내', success: '추천', warning: '주의', danger: '위험' };

/** 블록 노드를 마크다운 비슷한 글로. 모르는 type 은 content_display_type.json 의 rules 대로 대체한다. */
function blockText(b, base, depth = 3) {
  const h = '#'.repeat(Math.min(depth, 6));
  const inner = (blocks) => (blocks ?? []).map((x) => blockText(x, base, depth + 1)).join('\n\n');
  switch (b.type) {
    case 'section': return `## ${b.title} (${b.key})\n\n${(b.blocks ?? []).map((x) => blockText(x, base, 3)).join('\n\n')}`;
    case 'paragraph': return runsText(b.children);
    case 'caption': return `(참고) ${runsText(b.children)}`;
    case 'heading': return `${h} ${b.text}`;
    case 'title': case 'subtitle': case 'typography': return b.text;
    case 'blockquote': return `> ${runsText(b.children)}${b.cite ? ` — ${b.cite}` : ''}`;
    case 'alert': return `> [${ALERT[b.variant] ?? '알림'}] ${b.title ? `${b.title}: ` : ''}${runsText(b.children)}`;
    case 'list': return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${runsText(it.children)}`).join('\n');
    case 'stepper': return b.items.map((it) => `- ${it.time ? `${it.time} — ` : ''}${it.title ? `${it.title}: ` : ''}${runsText(it.children)}`).join('\n');
    case 'tabs': case 'accordion':
      return b.items.map((it) => `${h} ${it.title}${it.subtitle ? ` — ${it.subtitle}` : ''}\n\n${inner(it.blocks)}`).join('\n\n');
    case 'collapse': return `${h} ${b.title}\n\n${inner(b.blocks)}`;
    case 'grid': case 'masonry': return (b.blocks ?? []).map((x) => blockText(x, base, depth)).join('\n');
    case 'card':
      return `- ${b.number ? `${b.number}. ` : ''}**${b.title}**${b.place ? ` (여행지 slug: ${b.place})` : ''}${b.children ? ` — ${runsText(b.children)}` : ''}`;
    case 'pricing':
      return [`| ${b.columns.join(' | ')} |`, `|${b.columns.map(() => '---').join('|')}|`, ...b.items.map((it) => `| ${it.label} | ${it.price} | ${it.note ?? ''} |`)].join('\n');
    case 'table':
      return [`| ${b.columns.join(' | ')} |`, `|${b.columns.map(() => '---').join('|')}|`, ...b.rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
    case 'image': return `사진: ${absUrl(base, b.url)} — ${b.credit}`;
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

const HEAD = new Set(['id', 'slug', 'title', 'title_en', 'tagline', 'summary', 'image', 'gallery', 'sections', 'latitude', 'longitude']);

function placeText(p, base, sectionFilter) {
  const lines = [`# ${p.title.text} (${p.title_en?.text ?? ''}) — slug: ${p.slug}, id: ${p.id}`];
  const keys = sectionFilter ? String(sectionFilter).split(',').map((s) => s.trim()) : null;
  // 단락만 볼 때는 머리말을 되풀이하지 않는다.
  if (keys) {
    for (const s of p.sections ?? []) if (keys.some((k) => s.key === k || s.title.includes(k))) lines.push('', blockText(s, base));
    if (lines.length === 1) lines.push('', `맞는 단락 없음 — key: ${(p.sections ?? []).map((s) => s.key).join(', ')}`);
    return lines.join('\n');
  }
  if (p.tagline) lines.push(`> ${p.tagline.text}`, '');
  // label 이 있는 속성은 "이름표: 값" 한 줄씩 — 나라마다 속성이 달라도 그대로 보인다.
  for (const [key, node] of Object.entries(p)) {
    if (HEAD.has(key) || !node || typeof node !== 'object' || Array.isArray(node)) continue;
    lines.push(`- ${node.label ?? key}: ${valueText(node)}`);
  }
  if (p.latitude && p.longitude) lines.push(`- 좌표: ${p.latitude.value}, ${p.longitude.value}`);
  if (p.image) lines.push(`- 대표 사진: ${absUrl(base, p.image.url)} (${p.image.credit})`);
  for (const g of p.gallery?.items ?? []) lines.push(`- 사진: ${absUrl(base, g.url)} (${g.credit})`);
  if (p.summary) lines.push('', runsText(p.summary.children));
  for (const s of p.sections ?? []) lines.push('', blockText(s, base));
  return lines.join('\n');
}

/** 여행지 한 곳에서 화면에 보이는 모든 글과 그 글이 있는 단락 제목. */
function visibleTexts(p) {
  const out = [];
  const walk = (node, where) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, where));
    if (!node || typeof node !== 'object') return;
    if (node.type === 'section') where = node.title;
    if (Array.isArray(node.children)) out.push([where, runsText(node.children)]);
    for (const k of ['text', 'title', 'subtitle', 'time', 'label', 'price', 'note']) {
      if (typeof node[k] === 'string' && !(k === 'title' && node.type === 'section')) out.push([where, node[k]]);
    }
    if (Array.isArray(node.items) && node.items.every((i) => typeof i === 'string')) out.push([where, node.items.join(', ')]);
    for (const [k, v] of Object.entries(node)) if (k !== 'children' && typeof v === 'object') walk(v, where);
  };
  walk(p, '기본 정보');
  return out;
}

// ───────────── 찾기 ─────────────

function findPlace(list, key) {
  if (!key) fail('여행지를 지정할 것 — slug, id, 이름');
  const k = String(key).toLowerCase();
  const exact = list.find((p) => p.slug === k || String(p.id) === k || p.title.text === key || p.title_en?.text.toLowerCase() === k);
  if (exact) return exact;
  const partial = list.filter((p) => p.title.text.includes(key) || p.title_en?.text.toLowerCase().includes(k) || p.slug.includes(k));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) fail(`여러 곳이 맞음 — ${partial.map((p) => `${p.title.text}(${p.slug})`).join(', ')}`);
  fail(`여행지를 찾지 못함 — ${key}. search 명령으로 찾아 볼 것`);
}

function haversine(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** 예산 한 칸 — 기준(투어 1회 등)이 text 끝 괄호에 있으면 붙인다. 없으면 대개 1인 1일이다. */
function budgetText(b) {
  if (!b) return '';
  const n = (v) => Number(v).toLocaleString('en-US');
  const basis = /\(([^()]*)\)\s*$/.exec(b.text)?.[1];
  return `₱${n(b.min)}~${n(b.max)}${basis ? ` (${basis})` : ''}`;
}
const row = (p) => ({
  id: p.id, slug: p.slug, title: p.title.text, title_en: p.title_en?.text, category: p.category?.text,
  island_group: p.island_group?.text, region: p.region?.text, rating: p.rating?.value,
  budget: budgetText(p.budget), best_season: p.best_season?.text, difficulty: p.difficulty?.text,
  tags: p.tags?.items.join(', '),
});
function table(rows, extra = []) {
  const cols = ['id', 'slug', 'title', 'category', 'region', 'difficulty', 'rating', 'budget', 'best_season', 'tags', ...extra];
  const names = { id: 'id', slug: 'slug', title: '이름', category: '분류', region: '지역', difficulty: '난이도', rating: '추천도', budget: '예산(1인)', best_season: '최적기', tags: '태그', km: '거리(km)' };
  return [`| ${cols.map((c) => names[c] ?? c).join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`)].join('\n');
}

// ───────────── 명령 ─────────────

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

const data = await load(opts);
const { list, base, manifest, cdt } = data;
const out = (value) => console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));

switch (command) {
  case 'info':
    out(`나라: ${data.code}${data.api ? ` (${data.api.name})` : ''}\n주소: ${base}\nschema ${manifest.schema} · version ${manifest.version} · 여행지 ${manifest.count}곳 · 빌드 ${manifest.generated_at}\n${data.fromCache === 'local' ? '로컬 폴더에서 읽음' : data.fromCache ? '캐시에서 읽음 (manifest version 같음)' : '새로 받아 캐시에 저장함'}`);
    break;

  case 'list': {
    let rows = list.filter((p) => {
      const has = (node, v) => v === undefined || valueText(node).includes(String(v));
      if (opts.month && !p.best_season?.months?.includes(Number(opts.month))) return false;
      if (!has(p.category, opts.category) || !has(p.island_group, opts.island) || !has(p.difficulty, opts.difficulty)) return false;
      if (opts.region && !(valueText(p.region).includes(opts.region) || valueText(p.location).includes(opts.region))) return false;
      if (opts.tag && !p.tags?.items.some((t) => t.includes(opts.tag))) return false;
      if (opts['max-budget'] && !(p.budget?.min <= Number(opts['max-budget']))) return false;
      if (opts['min-rating'] && !(p.rating?.value >= Number(opts['min-rating']))) return false;
      if (opts.q && ![p.title.text, p.title_en?.text, p.tagline?.text, runsText(p.summary?.children), ...(p.tags?.items ?? [])].join(' ').includes(opts.q)) return false;
      return true;
    });
    const sorters = {
      id: (a, b) => a.id - b.id,
      rating: (a, b) => (b.rating?.value ?? 0) - (a.rating?.value ?? 0) || a.id - b.id,
      budget: (a, b) => (a.budget?.min ?? 0) - (b.budget?.min ?? 0) || a.id - b.id,
      name: (a, b) => a.title.text.localeCompare(b.title.text, 'ko'),
    };
    rows.sort(sorters[opts.sort ?? 'id'] ?? sorters.id);
    const total = rows.length;
    rows = rows.slice(0, Number(opts.limit ?? 30));
    if (opts.json) out(rows.map(row));
    else out(`${total}곳${total > rows.length ? ` 중 ${rows.length}곳 (--limit 로 늘림)` : ''}\n\n${table(rows.map(row))}`);
    break;
  }

  case 'show': {
    const p = findPlace(list, args.join(' '));
    out(opts.json ? p : placeText(p, base, opts.section));
    break;
  }

  case 'search': {
    const words = args.map((w) => w.trim()).filter(Boolean);
    if (!words.length) fail('찾을 낱말을 줄 것');
    const hits = [];
    for (const p of list) {
      const texts = visibleTexts(p);
      if (!words.every((w) => texts.some(([, t]) => t.includes(w)))) continue;
      const found = texts.filter(([, t]) => t.includes(words[0]));
      const [where, t] = found[0];
      const i = t.indexOf(words[0]);
      hits.push({ p, n: found.length, where, snippet: `${i > 40 ? '…' : ''}${t.slice(Math.max(0, i - 40), i + 60)}${t.length > i + 60 ? '…' : ''}` });
    }
    hits.sort((a, b) => b.n - a.n || a.p.id - b.p.id);
    if (opts.json) out(hits.map((h) => ({ ...row(h.p), matches: h.n, section: h.where, snippet: h.snippet })));
    else out(hits.length ? `${hits.length}곳${hits.length > Number(opts.limit ?? 20) ? ` 중 ${Number(opts.limit ?? 20)}곳 (--limit 로 늘림)` : ''} — 짧은 낱말은 다른 낱말 속에도 걸린다(아이 → 파오아이)\n\n${hits.slice(0, Number(opts.limit ?? 20)).map((h) => `- ${h.p.title.text} (${h.p.slug}) · ${h.n}회 · [${h.where}] ${h.snippet}`).join('\n')}` : '찾은 곳 없음');
    break;
  }

  case 'near': {
    const key = args.join(' ');
    const coord = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(key);
    const from = coord ? null : findPlace(list, key);
    const origin = coord ? [Number(coord[1]), Number(coord[2])] : [from.latitude.value, from.longitude.value];
    const rows = list
      .filter((p) => p !== from && p.latitude && p.longitude)
      .map((p) => ({ ...row(p), km: Math.round(haversine(origin, [p.latitude.value, p.longitude.value])) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, Number(opts.limit ?? 5));
    if (opts.json) out(rows);
    else out(`${from ? from.title.text : key} 에서 직선거리로 가까운 곳 (실제 이동 거리·시간은 더 길다)\n\n${table(rows, ['km'])}`);
    break;
  }

  case 'types': {
    const name = args[0];
    if (!name) {
      const groups = {};
      for (const [t, spec] of Object.entries(cdt.types)) (groups[spec.group] ??= []).push(`${t}(${spec.used})`);
      out(`content_display_type ${Object.keys(cdt.types).length}개 — 괄호 안은 지금 쓰인 횟수\n\n${Object.entries(groups).map(([g, ts]) => `- ${cdt.groups[g] ?? g}\n  ${ts.join(' ')}`).join('\n')}`);
      break;
    }
    const spec = cdt.types[name];
    if (!spec) fail(`모르는 type — ${name}`);
    if (opts.json) { out(spec); break; }
    const props = Object.entries(spec.props ?? {}).map(([k, r]) => `  - ${k} (${r.kind}${r.required ? ', 필수' : ''}${r.enum ? `, ${r.enum.join('|')}` : ''}${r.types ? `, ${r.types.join('|')}` : ''}): ${r.description}${r.item ? `\n${Object.entries(r.item).map(([ik, ir]) => `      · ${ik} (${ir.kind}${ir.required ? ', 필수' : ''}): ${ir.description}`).join('\n')}` : ''}`);
    out([
      `${name} — ${spec.name} (${cdt.groups[spec.group] ?? spec.group}, 자리: ${spec.context.join('·')}, 쓰인 횟수 ${spec.used})`,
      spec.role,
      `props\n${props.join('\n') || '  (없음)'}`,
      spec.variants ? `variants\n${Object.entries(spec.variants).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}` : '',
      `html: ${spec.html}`,
      `flutter: ${spec.flutter}`,
      opts.css ? `css: ${spec.css}` : '',
      `예시: ${JSON.stringify(spec.example)}`,
    ].filter(Boolean).join('\n\n'));
    break;
  }

  case 'values': {
    const fields = args.length ? args : ['category', 'island_group', 'region', 'difficulty', 'tags', 'months'];
    const lines = [];
    for (const f of fields) {
      const count = {};
      for (const p of list) {
        const vals = f === 'tags' ? p.tags?.items ?? [] : f === 'months' ? p.best_season?.months ?? [] : [p[f]?.text ?? valueText(p[f])];
        for (const v of vals) if (v !== '') count[v] = (count[v] ?? 0) + 1;
      }
      const entries = Object.entries(count).sort((a, b) => (f === 'months' ? a[0] - b[0] : b[1] - a[1]));
      lines.push(`${f} (${entries.length}개)\n  ${entries.map(([v, n]) => `${f === 'months' ? `${v}월` : v}(${n})`).join(' ')}`);
    }
    out(opts.json ? lines : lines.join('\n\n'));
    break;
  }

  default:
    fail(`모르는 명령 — ${command}\n\n${HELP}`);
}
