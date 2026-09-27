// 여행지 JSON(data/*.json)·표시 방법 목록(data/content_display_type.json)·사진(data/images/*.webp)을 정적 JSON API 로 만든다.
//
// 실행: node scripts/build.mjs  →  _site/v2/ 에 manifest.json · places.json · content_display_type.json · images/ 를 만든다.
// 규격을 어기는 파일이 하나라도 있으면 오류를 모두 출력하고 exit 1 로 끝나서 배포되지 않는다.
// 외부 패키지를 쓰지 않는다 — Node 만 있으면 된다.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** JSON 구조가 바뀌어 옛 클라이언트가 읽을 수 없게 되면 올리고, 출력 경로도 /v3/ 으로 바꾼다. */
const SCHEMA = 2;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, '_site', `v${SCHEMA}`);

// 작성 규격(data/README.md)과 같은 값들.
const ISLAND_GROUPS = ['루손', '비사야', '민다나오'];
const CATEGORIES = ['해변·섬', '다이빙·해양', '산·트레킹', '폭포·호수·강', '역사·문화', '도시·미식', '자연 경관'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];
/** 여행지의 속성과 그 속성에 써야 하는 content_display_type. 이 순서가 파일 안의 키 순서다. */
const FIELDS = {
  title: 'title', title_en: 'subtitle', tagline: 'typography', island_group: 'badge', region: 'badge',
  location: 'address', category: 'badge', tags: 'tags', rating: 'rating', latitude: 'latitude', longitude: 'longitude',
  best_season: 'date', duration: 'duration', budget: 'price', difficulty: 'level', airport: 'airport',
  image: 'image', gallery: 'carousel', summary: 'paragraph',
};
/** 본문 단락 10개 — key · 제목 · 순서가 정확히 같아야 한다. */
const SECTIONS = [
  ['overview', '한눈에 보기'], ['highlights', '꼭 해봐야 할 것'], ['itinerary', '추천 일정'],
  ['getting_there', '가는 방법'], ['best_time', '여행 최적기와 날씨'], ['costs', '예상 비용'],
  ['stay_and_food', '숙소와 먹거리'], ['tips', '여행 팁'], ['cautions', '주의사항'], ['nearby', '함께 가보면 좋은 곳'],
];

const errors = [];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const catalog = JSON.parse(readFileSync(join(dataDir, 'content_display_type.json'), 'utf8'));
const TYPES = catalog.types;
const COMMON = new Set(Object.keys(catalog.common_props));
const INLINE_KEYS = new Set(Object.keys(catalog.inline.props));
const STYLE_PROPS = new Set(catalog.style_properties);
const used = Object.fromEntries(Object.keys(TYPES).map((t) => [t, 0]));

// ───────────── content_display_type.json 규격 검사 ─────────────

/** 표시 방법 목록 자체가 올바른지 본다 — 이 파일이 모든 노드 검사의 기준이라서 먼저 검사한다. */
function checkCatalog() {
  const fail = (m) => errors.push(`content_display_type.json: ${m}`);
  for (const [name, spec] of Object.entries(TYPES)) {
    if (!(spec.group in catalog.groups)) fail(`${name} 의 group 오류 — ${spec.group}`);
    if (!spec.context?.length || spec.context.some((c) => c !== 'block' && c !== 'inline')) fail(`${name} 의 context 오류`);
    if (spec.context?.includes('inline') && !spec.props?.text?.required) fail(`${name} 은 inline 이므로 text 가 필수여야 함`);
    for (const key of ['name', 'role', 'html', 'css', 'flutter']) if (!spec[key]) fail(`${name} 의 ${key} 없음`);
    const checkProps = (props, where) => {
      for (const [prop, rule] of Object.entries(props ?? {})) {
        if (!(rule.kind in catalog.prop_kinds)) fail(`${where}.${prop} 의 kind 오류 — ${rule.kind}`);
        if (rule.kind === 'items') checkProps(rule.item, `${where}.${prop}`);
      }
    };
    checkProps(spec.props, name);
    if (spec.example) checkNode(spec.example, `content_display_type.json: ${name}.example`, 'block', null);
  }
  for (const [name, layout] of Object.entries(catalog.layouts)) {
    if (!isObject(layout)) continue;
    for (const slot of layout.slots) {
      if (!TYPES[slot.type]) fail(`layouts.${name} 의 모르는 type — ${slot.type}`);
      for (const f of slot.fields) if (!(f in FIELDS) && f !== 'sections') fail(`layouts.${name} 의 모르는 속성 — ${f}`);
    }
  }
}

// ───────────── 노드 검사 — content_display_type.json 의 props 규격대로 ─────────────

/** 노드 하나와 그 안의 노드를 모두 검사한다. context 는 block 또는 inline. place 가 있으면 쓰인 횟수를 센다. */
function checkNode(node, where, context, place) {
  const fail = (m) => errors.push(`${where}: ${m}`);
  if (!isObject(node)) return fail('객체가 아님');
  if (node.style !== undefined) checkStyle(node.style, where);
  if (context === 'inline') {
    if (typeof node.text !== 'string' || !node.text) fail('글 조각의 text 가 비어 있음');
    for (const mark of ['bold', 'italic', 'underline', 'strike']) {
      if (node[mark] !== undefined && typeof node[mark] !== 'boolean') fail(`${mark} 는 true·false`);
    }
    if (node.type === undefined) {
      for (const key of Object.keys(node)) if (!INLINE_KEYS.has(key)) fail(`글 조각의 모르는 키 — ${key}`);
      return;
    }
  }
  const spec = TYPES[node.type];
  if (!spec) return fail(`모르는 type — ${node.type}`);
  if (!spec.context.includes(context)) fail(`${node.type} 은 ${context} 자리에 쓸 수 없음`);
  if (place) used[node.type]++;
  if (node.variant !== undefined && !(spec.variants && node.variant in spec.variants)) fail(`${node.type} 의 variant 오류 — ${node.variant}`);
  if (node.icon !== undefined && !/^[a-z0-9_]+$/.test(node.icon)) fail(`icon 은 Material Symbols 이름 — ${node.icon}`);
  if (node.label !== undefined && (typeof node.label !== 'string' || !node.label)) fail('label 이 빈 글');
  const props = spec.props ?? {};
  for (const key of Object.keys(node)) {
    if (!(key in props) && !COMMON.has(key) && !(context === 'inline' && INLINE_KEYS.has(key))) fail(`${node.type} 의 모르는 키 — ${key}`);
  }
  checkProps(node, props, `${where}(${node.type})`, place);
}

function checkProps(obj, props, where, place) {
  for (const [name, rule] of Object.entries(props)) {
    if (obj[name] === undefined) {
      if (rule.required) errors.push(`${where}: ${name} 없음`);
      continue;
    }
    checkValue(obj[name], rule, `${where}.${name}`, place);
  }
}

function checkValue(value, rule, where, place) {
  const fail = (m) => errors.push(`${where}: ${m}`);
  const list = (check) => {
    if (!Array.isArray(value)) return fail('배열이 아님');
    if (rule.min && value.length < rule.min) fail(`${rule.min}개 이상이어야 함 — ${value.length}개`);
    value.forEach((v, i) => check(v, `${where}[${i}]`));
  };
  const text = (v) => typeof v === 'string' && v.trim() !== '';
  switch (rule.kind) {
    case 'string':
      if (!text(value)) return fail('빈 글');
      if (rule.enum && !rule.enum.includes(value)) fail(`${rule.enum.join('·')} 중 하나여야 함 — ${value}`);
      return;
    case 'number': return Number.isFinite(value) || fail('숫자가 아님');
    case 'integer': return Number.isInteger(value) || fail('정수가 아님');
    case 'boolean': return typeof value === 'boolean' || fail('true·false 가 아님');
    case 'url': return (text(value) && /^(https:\/\/|images\/)/.test(value)) || fail(`https:// 또는 images/ 로 시작해야 함 — ${value}`);
    case 'slug':
      if (!text(value) || !/^[a-z0-9-]+$/.test(value)) return fail(`slug 형식 오류 — ${value}`);
      if (place) place.links.push(value);
      return;
    case 'strings': return list((v, w) => text(v) || errors.push(`${w}: 빈 글`));
    case 'numbers': return list((v, w) => Number.isFinite(v) || errors.push(`${w}: 숫자가 아님`));
    case 'integers': return list((v, w) => Number.isInteger(v) || errors.push(`${w}: 정수가 아님`));
    case 'rows': return list((row, w) => (Array.isArray(row) && row.every((c) => typeof c === 'string')) || errors.push(`${w}: 글 배열이 아님`));
    case 'runs': return list((v, w) => checkNode(v, w, 'inline', place));
    case 'node':
      checkNode(value, where, 'block', place);
      if (rule.types && !rule.types.includes(value?.type)) fail(`${rule.types.join('·')} 만 쓸 수 있음 — ${value?.type}`);
      return;
    case 'blocks':
      return list((v, w) => {
        checkNode(v, w, 'block', place);
        if (rule.types && !rule.types.includes(v?.type)) errors.push(`${w}: ${rule.types.join('·')} 만 쓸 수 있음 — ${v?.type}`);
      });
    case 'items':
      return list((item, w) => {
        if (!isObject(item)) return errors.push(`${w}: 객체가 아님`);
        for (const key of Object.keys(item)) if (!(key in rule.item)) errors.push(`${w}: 모르는 키 — ${key}`);
        checkProps(item, rule.item, w, place);
      });
    default: return fail(`모르는 kind — ${rule.kind}`);
  }
}

function checkStyle(style, where) {
  if (!isObject(style)) return errors.push(`${where}: style 은 객체`);
  for (const [k, v] of Object.entries(style)) {
    if (!STYLE_PROPS.has(k)) errors.push(`${where}: style 에 쓸 수 없는 속성 — ${k}`);
    if (typeof v !== 'string' || !v) errors.push(`${where}: style.${k} 는 빈 글이 아닌 문자열`);
  }
}

// ───────────── 사진 ─────────────

/** WebP 머리에서 가로·세로 픽셀을 읽는다 (VP8 · VP8L · VP8X). */
function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return null;
}

/** 여행지 안의 모든 image 노드 — 파일을 복사하고, 내용이 바뀌면 주소도 바뀌도록 `?v=<해시>` 와 크기를 붙인다. */
function resolveImages(node, file) {
  if (Array.isArray(node)) return node.map((n) => resolveImages(n, file));
  if (!isObject(node)) return node;
  const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveImages(v, file)]));
  if (node.type !== 'image') return out;
  const path = join(dataDir, node.url ?? '');
  if (!/^images\/[a-z0-9-]+\.webp$/.test(node.url ?? '') || !existsSync(path)) {
    errors.push(`${file}: 사진 파일 없음 또는 경로 형식 오류 — ${node.url}`);
    return out;
  }
  if (!node.source?.startsWith('https://')) errors.push(`${file}: ${node.url} 원본 주소가 https:// 로 시작하지 않음`);
  const buf = readFileSync(path);
  const size = webpSize(buf);
  if (!size) errors.push(`${file}: ${node.url} WebP 크기를 읽을 수 없음`);
  copyFileSync(path, join(outDir, node.url));
  return { ...out, url: `${node.url}?v=${sha(buf).slice(0, 8)}`, ...(size ? { width: size[0], height: size[1] } : {}) };
}

// ───────────── 여행지 한 곳 ─────────────

/** 노드 안의 모든 문자열을 모은다 — 마크다운 흔적 검사에 쓴다. */
function texts(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (isObject(node)) Object.values(node).forEach((v) => texts(v, out));
  else if (typeof node === 'string') out.push(node);
  return out;
}

/** 화면에 보이는 글만 모은다 — 본문 길이 계산에 쓴다. type·key·icon 같은 이름은 빼고 센다. */
const VISIBLE = new Set(['text', 'title', 'subtitle', 'time', 'label', 'price', 'note', 'cite']);
function visibleText(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => visibleText(n, out));
  else if (isObject(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (VISIBLE.has(k) && typeof v === 'string') out.push(v);
      else visibleText(v, out);
    }
  }
  return out;
}

function parsePlace(file) {
  const fail = (message) => errors.push(`${file}: ${message}`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(dataDir, file), 'utf8'));
  } catch (e) {
    fail(`JSON 문법 오류 — ${e.message}`);
    return null;
  }
  const place = { links: [] };
  const { id, slug, sections } = raw;

  if (!Number.isInteger(id) || id <= 0) fail(`id 가 양의 정수가 아님 — ${id}`);
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) fail(`slug 형식 오류 — ${slug}`);
  if (file !== `${String(id).padStart(3, '0')}-${slug}.json`) fail('파일 이름이 id·slug 와 다름');
  for (const key of Object.keys(raw)) if (!(key in FIELDS) && !['id', 'slug', 'sections'].includes(key)) fail(`모르는 속성 — ${key}`);

  // 속성마다 정해진 type 이어야 하고, 그 type 의 규격을 지켜야 한다.
  for (const [key, type] of Object.entries(FIELDS)) {
    if (!isObject(raw[key])) { fail(`${key} 없음`); continue; }
    if (raw[key].type !== type) fail(`${key} 의 type 은 ${type} 이어야 함 — ${raw[key].type}`);
    checkNode(raw[key], `${file}: ${key}`, 'block', place);
  }
  const v = (key, prop) => raw[key]?.[prop];
  if (!ISLAND_GROUPS.includes(v('island_group', 'text'))) fail(`island_group 값 오류 — ${v('island_group', 'text')}`);
  if (!CATEGORIES.includes(v('category', 'text'))) fail(`category 값 오류 — ${v('category', 'text')}`);
  const level = DIFFICULTIES.indexOf(v('difficulty', 'text')) + 1;
  if (!level) fail(`difficulty 값 오류 — ${v('difficulty', 'text')}`);
  if (v('difficulty', 'value') !== level || v('difficulty', 'max') !== DIFFICULTIES.length) fail(`difficulty 의 value·max 는 ${level}·${DIFFICULTIES.length}`);
  const tags = v('tags', 'items') ?? [];
  if (tags.length < 3 || tags.length > 6) fail(`tags 는 3~6개 — ${tags.length}개`);
  if (!(v('rating', 'value') >= 4 && v('rating', 'value') <= 5) || v('rating', 'max') !== 5) fail(`rating 은 4.0~5.0 (max 5) — ${v('rating', 'value')}`);
  // 필리핀 영역 (북위 4~22도, 동경 116~127도)
  if (!(v('latitude', 'value') >= 4 && v('latitude', 'value') <= 22)) fail(`latitude 범위 오류 — ${v('latitude', 'value')}`);
  if (!(v('longitude', 'value') >= 116 && v('longitude', 'value') <= 127)) fail(`longitude 범위 오류 — ${v('longitude', 'value')}`);
  const months = v('best_season', 'months');
  if (!Array.isArray(months) || !months.length || months.some((m) => !(m >= 1 && m <= 12)) || new Set(months).size !== months.length) {
    fail('best_season.months 는 겹치지 않는 1~12 의 배열');
  }
  if (!(v('budget', 'min') <= v('budget', 'max')) || v('budget', 'currency') !== 'PHP') fail('budget 은 currency PHP, min ≤ max');

  // 본문 단락
  if (!Array.isArray(sections)) {
    fail('sections 가 배열이 아님');
  } else {
    if (sections.map((s) => `${s?.key}:${s?.title}`).join('|') !== SECTIONS.map(([k, t]) => `${k}:${t}`).join('|')) {
      fail('sections 의 key·title·순서가 규격과 다름');
    }
    sections.forEach((s, i) => {
      if (s?.type !== 'section') fail(`sections[${i}] 의 type 은 section`);
      checkNode(s, `${file}: sections[${i}]`, 'block', place);
    });
    const length = visibleText(sections).join('').length;
    if (length <= 2500) fail(`본문이 너무 짧음 — ${length}자`);
  }
  // JSON 에는 마크다운이 남아 있으면 안 된다 — 굵게·링크는 노드로 표현한다.
  for (const t of texts(raw)) if (/\*\*|\]\(/.test(t)) fail(`마크다운 기호가 남아 있음 — ${t.slice(0, 40)}`);

  return { ...resolveImages(raw, file), links: place.links };
}

// ───────────── 빌드 ─────────────

rmSync(join(root, '_site'), { recursive: true, force: true });
mkdirSync(join(outDir, 'images'), { recursive: true });

checkCatalog();
const files = readdirSync(dataDir).filter((name) => /^\d{3}-.+\.json$/.test(name)).sort();
const parsed = files.map(parsePlace).filter(Boolean).sort((a, b) => a.id - b.id);

// 겹침 검사와 다른 여행지로 가는 링크(card.place · place_link.slug) 검사.
const slugs = new Set(parsed.map((p) => p.slug));
if (parsed.length === 0) errors.push('여행지 파일이 하나도 없음');
if (new Set(parsed.map((p) => p.id)).size !== parsed.length) errors.push('id 가 겹치는 여행지가 있음');
if (slugs.size !== parsed.length) errors.push('slug 가 겹치는 여행지가 있음');
for (const place of parsed) {
  for (const slug of place.links) {
    if (!slugs.has(slug)) errors.push(`${place.slug}: 링크 대상 여행지 없음 — ${slug}`);
    if (slug === place.slug) errors.push(`${place.slug}: 자기 자신 링크`);
  }
}

if (errors.length) {
  console.error(`규격 오류 ${errors.length}건 — 배포하지 않는다.\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

const places = parsed.map(({ links, ...place }) => place);
// 쓰인 횟수를 붙인 표시 방법 목록. 클라이언트는 used 가 0 이 아닌 type 부터 구현하면 된다.
const displayTypes = {
  ...catalog,
  types: Object.fromEntries(Object.entries(TYPES).map(([name, spec]) => [name, { ...spec, used: used[name] }])),
};
// version 은 내용 해시다. 사진 주소에 사진 해시가 들어 있으므로 사진만 바꿔도 version 이 바뀐다.
// 표시 방법 목록이 바뀌어도 version 이 바뀐다. README 만 고친 push 는 version 이 그대로라서 클라이언트가 다시 받지 않는다.
const version = sha(JSON.stringify([places, displayTypes])).slice(0, 12);
const count = places.length;
const head = { schema: SCHEMA, version };
writeFileSync(join(outDir, 'places.json'), JSON.stringify({ ...head, count, places }));
writeFileSync(join(outDir, 'content_display_type.json'), `${JSON.stringify({ ...head, ...displayTypes }, null, 2)}\n`);
writeFileSync(
  join(outDir, 'manifest.json'),
  `${JSON.stringify({ ...head, count, places: 'places.json', content_display_type: 'content_display_type.json', generated_at: new Date().toISOString() }, null, 2)}\n`,
);
const unused = Object.keys(used).filter((t) => !used[t]);
console.log(`여행지 ${count}곳 → _site/v${SCHEMA}/ (version ${version})`);
console.log(`content_display_type ${Object.keys(TYPES).length}개 중 ${Object.keys(TYPES).length - unused.length}개 사용 — 미사용: ${unused.join(', ')}`);
