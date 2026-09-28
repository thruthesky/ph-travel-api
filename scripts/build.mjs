// 여행지 JSON(data/<언어>/*.json)·기준 정보(data/meta.json)·사진(data/images/*.webp)을 정적 JSON API 로 만든다.
//
// 실행: node scripts/build.mjs  →  _site/v2/ 에 manifest.json · meta.json · places.<언어>.json · images/ 를 만든다.
//        스킬(skills/travel-api-skill)도 검사해 설치·업데이트용 묶음 _site/skills/travel-api-skill.tar.gz 를 만든다.
// 규격을 어기는 파일이 하나라도 있으면 오류를 모두 출력하고 exit 1 로 끝나서 배포되지 않는다.
// 외부 패키지를 쓰지 않는다 — Node 와 시스템 tar 만 있으면 된다.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** JSON 구조가 바뀌어 옛 클라이언트가 읽을 수 없게 되면 올리고, 출력 경로도 /v3/ 으로 바꾼다. */
const SCHEMA = 2;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, '_site', `v${SCHEMA}`);
const SKILL = 'travel-api-skill';
const skillDir = join(root, 'skills', SKILL);

const errors = [];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 기준 정보 — 지원 언어, 분류·권역·지역·난이도 목록, 속성·단락, 표시 방법(type) 규격이 모두 여기에 있다.
const meta = JSON.parse(readFileSync(join(dataDir, 'meta.json'), 'utf8'));
const LANGS = meta.languages.map((l) => l.code);
const SOURCE = meta.source_language;
const DISPLAY = meta.display;
const TYPES = DISPLAY.types;
const COMMON = new Set(Object.keys(DISPLAY.common_props));
const INLINE_KEYS = new Set(Object.keys(DISPLAY.inline.props));
const STYLE_PROPS = new Set(DISPLAY.style_properties);
/** 여행지의 속성과 그 속성에 써야 하는 type. 이 순서가 파일 안의 키 순서다. */
const FIELDS = Object.fromEntries(Object.entries(meta.fields).map(([key, f]) => [key, f.type]));
const used = Object.fromEntries(Object.keys(TYPES).map((t) => [t, 0]));
/** 번역문이 원문보다 이만큼 짧으면 빠진 글이 있다고 본다 (중국어가 가장 짧다 — 한국어의 약 0.7배). */
const MIN_LENGTH_RATIO = 0.4;

// ───────────── meta.json 규격 검사 ─────────────

/** 기준 정보 자체가 올바른지 본다 — 이 파일이 모든 여행지 검사의 기준이라서 먼저 검사한다. */
function checkMeta() {
  const fail = (m) => errors.push(`meta.json: ${m}`);
  const names = (map, where) => {
    for (const lang of LANGS) if (typeof map?.[lang] !== 'string' || !map[lang].trim()) fail(`${where} 의 ${lang} 이름 없음`);
    for (const lang of Object.keys(map ?? {})) if (!LANGS.includes(lang)) fail(`${where} 의 모르는 언어 — ${lang}`);
  };
  // 언어
  if (new Set(LANGS).size !== LANGS.length) fail('languages 의 code 가 겹침');
  for (const l of meta.languages) {
    if (!/^[a-z]{2}$/.test(l.code)) fail(`language code 형식 오류 — ${l.code}`);
    for (const key of ['locale', 'name', 'native']) if (!l[key]) fail(`languages.${l.code} 의 ${key} 없음`);
    if (l.dir !== 'ltr' && l.dir !== 'rtl') fail(`languages.${l.code} 의 dir 은 ltr·rtl`);
  }
  if (!LANGS.includes(SOURCE)) fail(`source_language 가 languages 에 없음 — ${SOURCE}`);
  if (!LANGS.includes(meta.fallback_language)) fail(`fallback_language 가 languages 에 없음 — ${meta.fallback_language}`);
  // 정해진 값 목록
  for (const group of ['categories', 'island_groups', 'regions', 'difficulties']) {
    const keys = meta[group].map((x) => x.key);
    if (new Set(keys).size !== keys.length) fail(`${group} 의 key 가 겹침`);
    for (const item of meta[group]) {
      if (!/^[a-z0-9-]+$/.test(item.key ?? '')) fail(`${group} 의 key 형식 오류 — ${item.key}`);
      names(item.name, `${group}.${item.key}`);
    }
  }
  for (const c of meta.categories) if (!/^[a-z0-9_]+$/.test(c.icon ?? '')) fail(`categories.${c.key} 의 icon 오류`);
  for (const r of meta.regions) if (!meta.island_groups.some((g) => g.key === r.island_group)) fail(`regions.${r.key} 의 island_group 오류 — ${r.island_group}`);
  meta.difficulties.forEach((d, i) => d.value === i + 1 || fail(`difficulties 의 value 는 1부터 차례로 — ${d.key}`));
  // 속성·단락
  for (const [key, f] of Object.entries(meta.fields)) {
    if (!TYPES[f.type]) fail(`fields.${key} 의 모르는 type — ${f.type}`);
    if (f.label) names(f.label, `fields.${key}.label`);
    if (f.icon !== undefined && !/^[a-z0-9_]+$/.test(f.icon)) fail(`fields.${key} 의 icon 오류`);
    if (f.values && !['categories', 'island_groups', 'regions', 'difficulties'].includes(f.values)) fail(`fields.${key} 의 values 오류 — ${f.values}`);
  }
  const sectionKeys = meta.sections.map((s) => s.key);
  if (new Set(sectionKeys).size !== sectionKeys.length) fail('sections 의 key 가 겹침');
  for (const s of meta.sections) {
    if (!/^[a-z_]+$/.test(s.key ?? '') || !/^[a-z0-9_]+$/.test(s.icon ?? '')) fail(`sections 의 key·icon 오류 — ${s.key}`);
    names(s.title, `sections.${s.key}.title`);
  }
  // 표시 방법(type)
  for (const [name, spec] of Object.entries(TYPES)) {
    const where = `display.types.${name}`;
    if (!(spec.group in DISPLAY.groups)) fail(`${where} 의 group 오류 — ${spec.group}`);
    if (!spec.context?.length || spec.context.some((c) => c !== 'block' && c !== 'inline')) fail(`${where} 의 context 오류`);
    if (spec.context?.includes('inline') && !spec.props?.text?.required) fail(`${where} 는 inline 이므로 text 가 필수여야 함`);
    for (const key of ['name', 'role', 'html', 'css', 'flutter']) if (!spec[key]) fail(`${where} 의 ${key} 없음`);
    const checkProps = (props, at) => {
      for (const [prop, rule] of Object.entries(props ?? {})) {
        if (!(rule.kind in DISPLAY.prop_kinds)) fail(`${at}.${prop} 의 kind 오류 — ${rule.kind}`);
        if (rule.translate && !['string', 'strings', 'rows', 'runs'].includes(rule.kind)) fail(`${at}.${prop} 의 translate 는 string·strings·rows·runs 에만`);
        if (rule.kind === 'items') checkProps(rule.item, `${at}.${prop}`);
      }
    };
    checkProps(spec.props, where);
    if (spec.example) checkNode(spec.example, `meta.json: ${where}.example`, 'block', null);
  }
  for (const [name, layout] of Object.entries(DISPLAY.layouts)) {
    if (!isObject(layout)) continue;
    for (const slot of layout.slots) {
      if (!TYPES[slot.type]) fail(`display.layouts.${name} 의 모르는 type — ${slot.type}`);
      for (const f of slot.fields) if (!(f in FIELDS) && f !== 'sections') fail(`display.layouts.${name} 의 모르는 속성 — ${f}`);
    }
  }
}

// ───────────── 노드 검사 — meta.json 의 display.types 규격대로 ─────────────

/** 노드 하나와 그 안의 노드를 모두 검사한다. context 는 block 또는 inline. ctx 가 있으면 링크를 모으고, ctx.count 면 쓰인 횟수를 센다. */
function checkNode(node, where, context, ctx) {
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
  if (ctx?.count) used[node.type]++;
  if (node.variant !== undefined && !(spec.variants && node.variant in spec.variants)) fail(`${node.type} 의 variant 오류 — ${node.variant}`);
  if (node.icon !== undefined && !/^[a-z0-9_]+$/.test(node.icon)) fail(`icon 은 Material Symbols 이름 — ${node.icon}`);
  if (node.label !== undefined && (typeof node.label !== 'string' || !node.label)) fail('label 이 빈 글');
  const props = spec.props ?? {};
  for (const key of Object.keys(node)) {
    if (!(key in props) && !COMMON.has(key) && !(context === 'inline' && INLINE_KEYS.has(key))) fail(`${node.type} 의 모르는 키 — ${key}`);
  }
  checkProps(node, props, `${where}(${node.type})`, ctx);
}

function checkProps(obj, props, where, ctx) {
  for (const [name, rule] of Object.entries(props)) {
    if (obj[name] === undefined) {
      if (rule.required) errors.push(`${where}: ${name} 없음`);
      continue;
    }
    checkValue(obj[name], rule, `${where}.${name}`, ctx);
  }
}

function checkValue(value, rule, where, ctx) {
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
      ctx?.links.push(value);
      return;
    case 'strings': return list((v, w) => text(v) || errors.push(`${w}: 빈 글`));
    case 'numbers': return list((v, w) => Number.isFinite(v) || errors.push(`${w}: 숫자가 아님`));
    case 'integers': return list((v, w) => Number.isInteger(v) || errors.push(`${w}: 정수가 아님`));
    case 'rows': return list((row, w) => (Array.isArray(row) && row.every((c) => typeof c === 'string')) || errors.push(`${w}: 글 배열이 아님`));
    case 'runs':
      // "7~" + ⟦date|9월⟧ 처럼 기간의 시작이 조각 밖에 있으면 번역에서 "7–September" 가 된다. 기간은 한 조각에 담는다.
      if (Array.isArray(value)) value.forEach((r, i) => {
        const next = value[i + 1];
        if (!r?.type && next?.type === 'date' && (/\d\s*[~〜–—-]\s*$/.test(r?.text ?? '') || (/\d$/.test(r?.text ?? '') && /^\d/.test(next.text)))) {
          fail(`기간·숫자의 시작이 date 조각 밖에 있음 — …${r.text.slice(-12)}⟦${next.text}⟧`);
        }
      });
      return list((v, w) => checkNode(v, w, 'inline', ctx));
    case 'node':
      checkNode(value, where, 'block', ctx);
      if (rule.types && !rule.types.includes(value?.type)) fail(`${rule.types.join('·')} 만 쓸 수 있음 — ${value?.type}`);
      return;
    case 'blocks':
      return list((v, w) => {
        checkNode(v, w, 'block', ctx);
        if (rule.types && !rule.types.includes(v?.type)) errors.push(`${w}: ${rule.types.join('·')} 만 쓸 수 있음 — ${v?.type}`);
      });
    case 'items':
      return list((item, w) => {
        if (!isObject(item)) return errors.push(`${w}: 객체가 아님`);
        for (const key of Object.keys(item)) if (!(key in rule.item)) errors.push(`${w}: 모르는 키 — ${key}`);
        checkProps(item, rule.item, w, ctx);
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

// ───────────── 원문과 번역의 모양 비교 ─────────────

/** 글 조각 배열의 값 조각 종류 (정렬) — 번역은 어순이 달라도 같은 값 조각을 같은 수만큼 가져야 한다. */
const runSpecs = (runs) => (Array.isArray(runs) ? runs.filter((r) => r.type || r.bold || r.italic || r.underline || r.strike)
  .map((r) => [r.type, ...['bold', 'italic', 'underline', 'strike'].filter((m) => r[m])].filter(Boolean).join(',')).sort().join(' ') : '');

/**
 * 번역 노드가 원문 노드와 모양이 같은지 본다. translate 인 속성과 label 만 달라도 되고,
 * 나머지(type·icon·variant·숫자·코드·slug·사진·블록 순서와 개수)는 같아야 한다.
 */
function compareNode(a, b, where) {
  const fail = (m) => errors.push(`${where}: ${m} (원본 ${SOURCE} 와 다름)`);
  if (!isObject(a) || !isObject(b) || a.type !== b.type) return fail(`type — ${b?.type}`);
  if (Object.keys(a).sort().join() !== Object.keys(b).sort().join()) return fail(`키 목록 — ${Object.keys(b).join(',')}`);
  const props = TYPES[a.type]?.props ?? {};
  for (const key of Object.keys(a)) {
    if (key === 'label') continue;
    if (props[key]) compareValue(a[key], b[key], props[key], `${where}.${key}`);
    else if (!same(a[key], b[key])) fail(key);
  }
}

function compareValue(a, b, rule, where) {
  const fail = (m) => errors.push(`${where}: ${m} (원본 ${SOURCE} 와 다름)`);
  const sameLength = () => Array.isArray(b) && b.length === a.length;
  if (rule.translate) {
    if (rule.kind === 'runs' && runSpecs(a) !== runSpecs(b)) fail(`값 조각 [${runSpecs(b)}] — 원본 [${runSpecs(a)}]`);
    if (rule.kind === 'strings' && !sameLength()) fail(`개수 ${b?.length}`);
    if (rule.kind === 'rows' && (!sameLength() || a.some((row, i) => row.length !== b[i]?.length))) fail('표 모양');
    return;
  }
  switch (rule.kind) {
    case 'node': return compareNode(a, b, where);
    case 'blocks': return sameLength() ? a.forEach((x, i) => compareNode(x, b[i], `${where}[${i}]`)) : fail(`개수 ${b?.length}`);
    case 'items':
      if (!sameLength()) return fail(`개수 ${b?.length}`);
      return a.forEach((item, i) => {
        if (Object.keys(item).sort().join() !== Object.keys(b[i] ?? {}).sort().join()) return fail(`[${i}] 의 키 목록`);
        for (const key of Object.keys(item)) compareValue(item[key], b[i][key], rule.item[key] ?? {}, `${where}[${i}].${key}`);
      });
    default: return same(a, b) || fail(JSON.stringify(b)?.slice(0, 60));
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

/** 사진 한 장 — 한 번만 읽고 복사한다. 모든 언어가 같은 사진을 쓴다. */
const images = new Map();
function imageInfo(url) {
  if (!images.has(url)) {
    const buf = readFileSync(join(dataDir, url));
    const size = webpSize(buf);
    copyFileSync(join(dataDir, url), join(outDir, url));
    images.set(url, { hash: sha(buf).slice(0, 8), size });
  }
  return images.get(url);
}

/** 여행지 안의 모든 image 노드 — 내용이 바뀌면 주소도 바뀌도록 `?v=<해시>` 와 크기를 붙인다. */
function resolveImages(node, where) {
  if (Array.isArray(node)) return node.map((n) => resolveImages(n, where));
  if (!isObject(node)) return node;
  const out = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveImages(v, where)]));
  if (node.type !== 'image') return out;
  if (!/^images\/[a-z0-9-]+\.webp$/.test(node.url ?? '') || !existsSync(join(dataDir, node.url))) {
    errors.push(`${where}: 사진 파일 없음 또는 경로 형식 오류 — ${node.url}`);
    return out;
  }
  if (!node.source?.startsWith('https://')) errors.push(`${where}: ${node.url} 원본 주소가 https:// 로 시작하지 않음`);
  const { hash, size } = imageInfo(node.url);
  if (!size) errors.push(`${where}: ${node.url} WebP 크기를 읽을 수 없음`);
  return { ...out, url: `${node.url}?v=${hash}`, ...(size ? { width: size[0], height: size[1] } : {}) };
}

// ───────────── 여행지 한 곳 ─────────────

/** 노드 안의 모든 문자열을 모은다 — 마크다운 흔적·한글 검사에 쓴다. 저작자·주소는 뺀다. */
function texts(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => texts(n, out));
  else if (isObject(node)) {
    for (const [k, v] of Object.entries(node)) if (!['credit', 'source', 'url'].includes(k)) texts(v, out);
  } else if (typeof node === 'string') out.push(node);
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

/** 한 언어의 여행지 파일 하나를 읽고 검사한다. source 는 같은 여행지의 원본 언어 파일(원본을 검사할 때는 null). */
function parsePlace(lang, file, source) {
  const where = `${lang}/${file}`;
  const fail = (message) => errors.push(`${where}: ${message}`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(dataDir, lang, file), 'utf8'));
  } catch (e) {
    fail(`JSON 문법 오류 — ${e.message}`);
    return null;
  }
  const ctx = { links: [], count: !source };
  const { id, slug, sections } = raw;

  if (!Number.isInteger(id) || id <= 0) fail(`id 가 양의 정수가 아님 — ${id}`);
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) fail(`slug 형식 오류 — ${slug}`);
  if (file !== `${String(id).padStart(3, '0')}-${slug}.json`) fail('파일 이름이 id·slug 와 다름');
  for (const key of Object.keys(raw)) if (!(key in FIELDS) && !['id', 'slug', 'sections'].includes(key)) fail(`모르는 속성 — ${key}`);

  // 속성마다 정해진 type 이어야 하고, 그 type 의 규격을 지켜야 한다. 이름표·아이콘은 meta 의 fields 와 같아야 한다.
  for (const [key, type] of Object.entries(FIELDS)) {
    const node = raw[key];
    if (!isObject(node)) { fail(`${key} 없음`); continue; }
    if (node.type !== type) fail(`${key} 의 type 은 ${type} 이어야 함 — ${node.type}`);
    checkNode(node, `${where}: ${key}`, 'block', ctx);
    const field = meta.fields[key];
    if (field.label && node.label !== field.label[lang]) fail(`${key}.label 은 "${field.label[lang]}" (meta.fields) — ${node.label}`);
    if (field.icon && node.icon !== field.icon) fail(`${key}.icon 은 ${field.icon} (meta.fields) — ${node.icon}`);
  }
  const v = (key, prop) => raw[key]?.[prop];
  // 정해진 목록의 값 — value 는 언어와 무관한 key, text 는 그 언어의 이름
  const listed = (key, list) => {
    const item = meta[list].find((x) => x.key === v(key, 'value'));
    if (!item) return fail(`${key}.value 는 meta.${list} 의 key — ${v(key, 'value')}`);
    if (v(key, 'text') !== item.name[lang]) fail(`${key}.text 는 "${item.name[lang]}" (meta.${list}) — ${v(key, 'text')}`);
    return item;
  };
  listed('island_group', 'island_groups');
  const region = listed('region', 'regions');
  if (region && region.island_group !== v('island_group', 'value')) fail(`region ${region.key} 의 권역은 ${region.island_group} — island_group 은 ${v('island_group', 'value')}`);
  const category = listed('category', 'categories');
  if (category && v('category', 'icon') !== category.icon) fail(`category.icon 은 ${category.icon} (meta.categories)`);
  const level = meta.difficulties.find((d) => d.value === v('difficulty', 'value'));
  if (!level) fail(`difficulty.value 는 meta.difficulties 의 value — ${v('difficulty', 'value')}`);
  else if (v('difficulty', 'text') !== level.name[lang] || v('difficulty', 'max') !== meta.difficulties.length) {
    fail(`difficulty 의 text·max 는 "${level.name[lang]}"·${meta.difficulties.length} (meta.difficulties)`);
  }
  // 숫자 범위
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

  // 본문 단락 — key·순서·아이콘은 meta.sections 와 같고, 제목은 그 언어의 제목이다.
  let length = 0;
  if (!Array.isArray(sections)) {
    fail('sections 가 배열이 아님');
  } else {
    const want = meta.sections.map((s) => `${s.key}:${s.icon}:${s.title[lang]}`).join('|');
    if (sections.map((s) => `${s?.key}:${s?.icon}:${s?.title}`).join('|') !== want) fail('sections 의 key·icon·title·순서가 meta.sections 와 다름');
    sections.forEach((s, i) => {
      if (s?.type !== 'section') fail(`sections[${i}] 의 type 은 section`);
      checkNode(s, `${where}: sections[${i}]`, 'block', ctx);
    });
    length = visibleText(sections).join('').length;
    if (!source && length <= 2500) fail(`본문이 너무 짧음 — ${length}자`);
  }
  // JSON 에는 마크다운이 남아 있으면 안 된다 — 굵게·링크는 노드로 표현한다.
  for (const t of texts(raw)) if (/\*\*|\]\(/.test(t)) fail(`마크다운 기호가 남아 있음 — ${t.slice(0, 40)}`);

  // 번역 — 원본과 모양이 같고, 한글이 남아 있지 않고, 글이 크게 빠지지 않아야 한다.
  if (source) {
    if (id !== source.raw.id || slug !== source.raw.slug) fail('id·slug 가 원본과 다름');
    if (Object.keys(raw).join() !== Object.keys(source.raw).join()) fail('속성 순서가 원본과 다름');
    if (!same(raw.title_en, source.raw.title_en)) fail('title_en 은 모든 언어에서 같아야 함');
    for (const key of Object.keys(FIELDS)) if (isObject(raw[key])) compareNode(source.raw[key], raw[key], `${where}: ${key}`);
    if (Array.isArray(sections)) {
      if (sections.length !== source.raw.sections.length) fail('단락 수가 원본과 다름');
      else sections.forEach((s, i) => compareNode(source.raw.sections[i], s, `${where}: sections[${i}]`));
    }
    if (lang !== 'ko') {
      const left = texts(raw).find((t) => /[가-힣]/.test(t));
      if (left) fail(`번역되지 않은 한글 — ${left.slice(0, 40)}`);
    }
    if (length < source.length * MIN_LENGTH_RATIO) fail(`본문이 원본(${source.length}자)에 비해 너무 짧음 — ${length}자`);
  }

  return { raw, length, place: resolveImages(raw, where), links: ctx.links };
}

// ───────────── 스킬 ─────────────

/** 스킬 폴더를 검사한다. 이 저장소의 .claude/skills 에 있는 입구 SKILL.md 와 description 이 같아야 한다. */
function checkSkill() {
  const fail = (m) => errors.push(`skills/${SKILL}: ${m}`);
  const head = (path) => {
    const text = readFileSync(path, 'utf8');
    return text.startsWith('---\n') ? text.slice(4, text.indexOf('\n---', 4)) : '';
  };
  if (!existsSync(join(skillDir, 'SKILL.md'))) return fail('SKILL.md 없음');
  const main = head(join(skillDir, 'SKILL.md'));
  if (!new RegExp(`^name: ${SKILL}$`, 'm').test(main)) fail(`앞머리 name 이 ${SKILL} 가 아님`);
  if (!/^  version: "?[\w.-]+"?$/m.test(main)) fail('앞머리 metadata.version 없음');
  const entry = join(root, '.claude', 'skills', SKILL, 'SKILL.md');
  const description = (text) => /^description: (.+)$/m.exec(text)?.[1];
  if (existsSync(entry) && description(head(entry)) !== description(main)) fail('.claude/skills 입구 SKILL.md 의 description 이 원본과 다름');
  for (const file of ['scripts/travel.mjs', 'scripts/apis.json', 'scripts/update.sh']) if (!existsSync(join(skillDir, file))) fail(`${file} 없음`);
}

/** 설치·업데이트용 묶음. macOS 의 ._ 부가 파일이 들어가지 않게 COPYFILE_DISABLE 을 켠다. */
function packSkill() {
  const out = join(root, '_site', 'skills', `${SKILL}.tar.gz`);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('tar', ['-czf', out, '--exclude=.DS_Store', '-C', join(root, 'skills'), SKILL], { env: { ...process.env, COPYFILE_DISABLE: '1' } });
  return out;
}

// ───────────── 빌드 ─────────────

rmSync(join(root, '_site'), { recursive: true, force: true });
mkdirSync(join(outDir, 'images'), { recursive: true });

checkMeta();
checkSkill();
const placeFiles = (lang) => (existsSync(join(dataDir, lang)) ? readdirSync(join(dataDir, lang)).filter((name) => /^\d{3}-.+\.json$/.test(name)).sort() : []);
const files = placeFiles(SOURCE);
// 번역 중인 언어 — data/<언어>/ 폴더가 아직 없으면 이번 배포에서 뺀다. 폴더가 생기면 그때부터 모든 여행지가 있어야 한다.
const PENDING = LANGS.filter((l) => l !== SOURCE && !existsSync(join(dataDir, l)));
const PUBLISHED = LANGS.filter((l) => !PENDING.includes(l));
if (PENDING.includes(meta.fallback_language)) errors.push(`fallback_language(${meta.fallback_language}) 의 번역 폴더 data/${meta.fallback_language}/ 가 없음`);
for (const name of readdirSync(dataDir)) {
  if (name.startsWith('.')) continue;
  if (/\.json$/.test(name) && name !== 'meta.json') errors.push(`data/${name}: 여행지 파일은 data/<언어>/ 에 둔다`);
  else if (!/\.(json|md)$/.test(name) && name !== 'images' && !LANGS.includes(name)) errors.push(`data/${name}: 모르는 폴더 — 언어 폴더는 ${LANGS.join('·')}`);
}

// 원본 언어를 먼저 읽는다 — 다른 언어는 원본과 모양을 비교한다.
const parsed = { [SOURCE]: files.map((file) => parsePlace(SOURCE, file, null)) };
for (const lang of PUBLISHED.filter((l) => l !== SOURCE)) {
  const names = placeFiles(lang);
  for (const file of files) if (!names.includes(file)) errors.push(`${lang}/${file}: 번역 파일 없음`);
  for (const file of names) if (!files.includes(file)) errors.push(`${lang}/${file}: 원본(${SOURCE})에 없는 여행지`);
  parsed[lang] = files.map((file, i) => {
    const source = parsed[SOURCE][i];
    return names.includes(file) && source ? parsePlace(lang, file, source) : null;
  });
}

// 겹침 검사와 다른 여행지로 가는 링크(card.place · place_link.slug) 검사 — 링크는 모든 언어가 같으므로 원본만 본다.
const sources = parsed[SOURCE].filter(Boolean);
const slugs = new Set(sources.map((p) => p.raw.slug));
if (sources.length === 0) errors.push('여행지 파일이 하나도 없음');
if (new Set(sources.map((p) => p.raw.id)).size !== sources.length) errors.push('id 가 겹치는 여행지가 있음');
if (slugs.size !== sources.length) errors.push('slug 가 겹치는 여행지가 있음');
for (const { raw, links } of sources) {
  for (const slug of links) {
    if (!slugs.has(slug)) errors.push(`${raw.slug}: 링크 대상 여행지 없음 — ${slug}`);
    if (slug === raw.slug) errors.push(`${raw.slug}: 자기 자신 링크`);
  }
}

if (errors.length) {
  console.error(`규격 오류 ${errors.length}건 — 배포하지 않는다.\n${errors.slice(0, 300).map((e) => `  - ${e}`).join('\n')}${errors.length > 300 ? `\n  … 외 ${errors.length - 300}건` : ''}`);
  process.exit(1);
}

const places = Object.fromEntries(PUBLISHED.map((lang) => [lang, parsed[lang].map((p) => p.place).sort((a, b) => a.id - b.id)]));
// 쓰인 횟수를 붙인 기준 정보. 클라이언트는 used 가 0 이 아닌 type 부터 구현하면 된다. 모든 언어의 모양이 같아서 원본만 센다.
const metaOut = {
  ...meta,
  languages: meta.languages.filter((l) => PUBLISHED.includes(l.code)),
  display: { ...DISPLAY, types: Object.fromEntries(Object.entries(TYPES).map(([name, spec]) => [name, { ...spec, used: used[name] }])) },
};
// version 은 내용 해시다. 사진 주소에 사진 해시가 들어 있으므로 사진만 바꿔도 version 이 바뀐다.
// 기준 정보·어느 한 언어가 바뀌어도 version 이 바뀐다. README 만 고친 push 는 version 이 그대로라서 클라이언트가 다시 받지 않는다.
const version = sha(JSON.stringify([metaOut, PUBLISHED.map((lang) => places[lang])])).slice(0, 12);
const count = sources.length;
const head = { schema: SCHEMA, version };
const placesFile = (lang) => `places.${lang}.json`;
for (const { code, dir } of metaOut.languages) {
  writeFileSync(join(outDir, placesFile(code)), JSON.stringify({ ...head, lang: code, dir, count, places: places[code] }));
}
writeFileSync(join(outDir, 'meta.json'), `${JSON.stringify({ ...head, ...metaOut }, null, 2)}\n`);
writeFileSync(
  join(outDir, 'manifest.json'),
  `${JSON.stringify({
    ...head,
    count,
    source_language: SOURCE,
    fallback_language: meta.fallback_language,
    languages: PUBLISHED,
    meta: 'meta.json',
    places: Object.fromEntries(PUBLISHED.map((lang) => [lang, placesFile(lang)])),
    generated_at: new Date().toISOString(),
  }, null, 2)}\n`,
);
packSkill();
const unused = Object.keys(used).filter((t) => !used[t]);
console.log(`여행지 ${count}곳 × ${PUBLISHED.length}개 언어(${PUBLISHED.join('·')}) → _site/v${SCHEMA}/ (version ${version}) · 스킬 묶음 → _site/skills/${SKILL}.tar.gz`);
if (PENDING.length) console.log(`번역 중이라 뺀 언어: ${PENDING.join('·')} — data/<언어>/ 폴더가 생기면 함께 배포된다`);
console.log(`표시 방법(type) ${Object.keys(TYPES).length}개 중 ${Object.keys(TYPES).length - unused.length}개 사용 — 미사용: ${unused.join(', ')}`);
