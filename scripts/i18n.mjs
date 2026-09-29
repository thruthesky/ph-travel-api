// 여행지 번역 도구 — 원본 언어(data/meta.json 의 source_language, 지금은 ko)의 여행지 JSON 에서 번역할 글을 뽑고,
// 번역을 받아 다른 언어의 여행지 JSON 을 만든다. 모든 언어의 여행지는 원본과 모양이 같고 글만 다르다.
//
//   node scripts/i18n.mjs export [파일…]         원본에서 번역할 글을 _i18n/src/<이름>.txt 로 뽑는다
//   node scripts/i18n.mjs check <언어> [파일…]    _i18n/<언어>/<이름>.txt 번역이 원본과 짝이 맞는지 검사한다
//   node scripts/i18n.mjs import <언어> [파일…]   번역을 원본 모양에 채워 data/<언어>/<이름>.json 을 만든다
//   node scripts/i18n.mjs sync [언어…]           원본의 언어와 무관한 값(숫자·코드·slug·사진 …)과 meta 의 이름표를 다른 언어 파일에 맞춘다
//   node scripts/i18n.mjs format [언어…]         data/<언어>/*.json 을 정해진 쓰기 형식으로 다시 쓴다
//
// 파일은 `030-vigan.json`·`030-vigan`·`vigan`·`30` 어느 것으로 적어도 된다. 없으면 전부다.
//
// 번역 파일(.txt) 형식 — 한 줄에 글 하나:
//   # overview · paragraph.children      ← 설명 줄 (# 로 시작, 가져올 때 무시)
//   @12 마닐라에서 약 ⟦duration|7~9시간⟧, 요금은 ⟦price|₱900~1,200⟧입니다.
// `@번호 ` 뒤가 글이다. ⟦type|글⟧ 은 값 조각(children 의 type 조각)이고, 번역에서도 같은 type 의 조각이 같은 수만큼 있어야 한다.
// 분류·권역·지역·난이도의 글, 속성 이름표(label), 단락 제목은 뽑지 않는다 — meta.json 의 언어별 이름으로 채운다.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const workDir = join(root, '_i18n');
const meta = JSON.parse(readFileSync(join(dataDir, 'meta.json'), 'utf8'));
const TYPES = meta.display.types;
const SOURCE = meta.source_language;
const LANGS = meta.languages.map((l) => l.code);
const MARKS = ['bold', 'italic', 'underline', 'strike'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ───────────── 쓰기 형식 ─────────────

function inline(v) {
  if (Array.isArray(v)) return v.length ? `[${v.map(inline).join(', ')}]` : '[]';
  if (isObject(v)) {
    const e = Object.entries(v);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
}

function pretty(v, indent, prefix) {
  const one = inline(v);
  if (!(Array.isArray(v) || isObject(v)) || (indent + prefix + one).length <= 100) return one;
  const next = `${indent}  `;
  if (Array.isArray(v)) return `[\n${v.map((x) => next + pretty(x, next, '')).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${pretty(x, next, `${JSON.stringify(k)}: `)}`).join(',\n')}\n${indent}}`;
}

/** 여행지 JSON 쓰기 형식 — 들여쓰기 2칸, 들여쓰기·키를 합쳐 100자 이내면 한 줄, 파일 끝 줄바꿈 1개. */
export function format(value) {
  return `${pretty(value, '', '')}\n`;
}

// ───────────── 번역할 글 뽑기 ─────────────

/** 조각 type 의 언어와 무관한 키 (link.url · place_link.slug) — 번역 줄에 넣지 않고 원본에서 옮긴다. */
const fixedKeys = (type) => Object.entries(TYPES[type]?.props ?? {}).filter(([k, r]) => k !== 'text' && !r.translate).map(([k]) => k);

/** 글 조각 배열 → 한 줄 글. 값 조각은 ⟦type|글⟧, 표시(bold …)는 ⟦bold|글⟧·⟦price,bold|글⟧ 로 쓴다. */
export function toMarkup(runs, where) {
  return runs.map((run) => {
    for (const key of Object.keys(run)) {
      if (key !== 'text' && key !== 'type' && !MARKS.includes(key) && !fixedKeys(run.type).includes(key)) throw new Error(`${where}: 번역 도구가 모르는 조각 키 — ${key}`);
    }
    if (/[⟦⟧\n]/.test(run.text)) throw new Error(`${where}: 글에 ⟦ ⟧ 또는 줄바꿈이 있음`);
    const spec = [run.type, ...MARKS.filter((m) => run[m])].filter(Boolean);
    return spec.length ? `⟦${spec.join(',')}|${run.text}⟧` : run.text;
  }).join('');
}

/** 한 줄 글 → 글 조각 배열. 형식이 틀리면 Error. */
export function fromMarkup(line) {
  const runs = [];
  let last = 0;
  const plain = (text) => {
    if (/[⟦⟧]/.test(text)) throw new Error(`⟦ ⟧ 짝이 맞지 않음 — …${text.slice(0, 30)}`);
    if (text) runs.push({ text });
  };
  for (const m of line.matchAll(/⟦([^|⟦⟧]+)\|([^⟦⟧]*)⟧/g)) {
    plain(line.slice(last, m.index));
    const [type, ...marks] = m[1].split(',').map((s) => s.trim());
    const run = {};
    if (MARKS.includes(type)) marks.unshift(type);
    else {
      if (!TYPES[type]?.context.includes('inline')) throw new Error(`글 조각에 쓸 수 없는 type — ${type}`);
      run.type = type;
    }
    if (!m[2]) throw new Error(`빈 값 조각 — ⟦${m[1]}|⟧`);
    run.text = m[2];
    for (const mark of marks) {
      if (!MARKS.includes(mark)) throw new Error(`모르는 표시 — ${mark}`);
      run[mark] = true;
    }
    runs.push(run);
    last = m.index + m[0].length;
  }
  plain(line.slice(last));
  if (!runs.length) throw new Error('글이 비어 있음');
  return runs;
}

/** 번역 조각에 원본 조각의 언어와 무관한 키(url·slug)를 옮긴다 — 같은 type 의 몇 번째 조각끼리 짝짓는다. */
export function carryFixed(runs, sourceRuns) {
  const seen = {};
  for (const run of runs) {
    const keys = fixedKeys(run.type);
    if (!keys.length) continue;
    const n = (seen[run.type] = (seen[run.type] ?? -1) + 1);
    const from = sourceRuns.filter((r) => r.type === run.type)[n];
    for (const k of keys) if (from?.[k] !== undefined) run[k] = from[k];
  }
  return runs;
}

const getPath = (obj, path) => path.reduce((o, k) => o?.[k], obj);

/** 값 조각의 종류 목록 (정렬) — 원문과 번역이 같아야 한다. */
const specsOf = (line) => [...line.matchAll(/⟦([^|⟦⟧]+)\|/g)].map((m) => m[1].split(',').map((s) => s.trim()).sort().join(',')).sort();
/** price 조각 안의 숫자 (자릿수 구분 기호를 뺀 값) — 원문과 번역이 같아야 한다. */
const pricesOf = (line) => [...line.matchAll(/⟦price[^|]*\|([^⟧]*)⟧/g)]
  .flatMap((m) => m[1].match(/\d{1,3}(?:[,.\s ]\d{3})+|\d+/g) ?? []).map((n) => n.replace(/\D/g, '')).sort();

/**
 * 여행지 하나에서 번역할 글을 차례로 뽑는다. 항목: { path, kind: 'string' | 'runs', value, hint }.
 * meta 로 채우는 글(속성 이름표·목록 값의 이름·단락 제목)과 언어와 무관한 title_en 은 뽑지 않는다.
 */
export function extract(place, file = '') {
  const out = [];
  const node = (n, path, section, skipLabel) => {
    const spec = TYPES[n?.type];
    if (!spec) return;
    for (const [key, value] of Object.entries(n)) {
      if (key === 'label') {
        if (!skipLabel) out.push({ path: [...path, key], kind: 'string', value, hint: `${section}${n.type}.label` });
        continue;
      }
      const rule = spec.props?.[key];
      if (rule) walk(value, rule, [...path, key], section, `${n.type}.${key}`);
    }
  };
  const walk = (value, rule, path, section, name) => {
    const hint = `${section}${name}`;
    if (rule.translate) {
      switch (rule.kind) {
        case 'string': return out.push({ path, kind: 'string', value, hint });
        case 'strings': return value.forEach((v, i) => out.push({ path: [...path, i], kind: 'string', value: v, hint }));
        case 'rows': return value.forEach((row, r) => row.forEach((v, c) => out.push({ path: [...path, r, c], kind: 'string', value: v, hint })));
        case 'runs': return out.push({ path, kind: 'runs', value: toMarkup(value, `${file} ${path.join('.')}`), hint });
        default: throw new Error(`translate 는 string·strings·rows·runs 에만 — ${name}`);
      }
    }
    switch (rule.kind) {
      case 'node': return node(value, path, section, false);
      case 'blocks': return value.forEach((v, i) => node(v, [...path, i], section, false));
      case 'items':
        return value.forEach((item, i) => {
          for (const [key, r] of Object.entries(rule.item)) {
            if (item[key] !== undefined) walk(item[key], r, [...path, i, key], section, `${name.split('.')[0]}.${key}`);
          }
        });
      default:
    }
  };
  for (const [key, field] of Object.entries(meta.fields)) {
    if (key === 'title_en' || !isObject(place[key])) continue;
    if (field.values) continue; // 분류·권역·지역·난이도 — 글은 meta 의 이름
    node(place[key], [key], `${key} · `, true);
  }
  (place.sections ?? []).forEach((s, i) => {
    for (const [j, b] of (s.blocks ?? []).entries()) node(b, ['sections', i, 'blocks', j], `${s.key} · `, false);
  });
  return out;
}

function setPath(obj, path, value) {
  let o = obj;
  for (const k of path.slice(0, -1)) o = o[k];
  o[path.at(-1)] = value;
}

/** meta 로 정해지는 값을 채운다 — 속성 이름표, 분류·권역·지역·난이도의 이름과 분류 아이콘, 단락 제목·아이콘. */
export function applyMeta(place, lang) {
  const byKey = (list, key) => list.find((x) => x.key === key);
  for (const [key, field] of Object.entries(meta.fields)) {
    const n = place[key];
    if (!isObject(n)) continue;
    if (field.label) n.label = field.label[lang];
    if (field.icon) n.icon = field.icon;
    if (field.values === 'difficulties') {
      const d = meta.difficulties.find((x) => x.value === n.value);
      if (d) Object.assign(n, { text: d.name[lang], max: meta.difficulties.length });
    } else if (field.values) {
      const item = byKey(meta[field.values], n.value);
      if (item) n.text = item.name[lang];
      if (item?.icon) n.icon = item.icon;
    }
  }
  (place.sections ?? []).forEach((s, i) => {
    const spec = meta.sections[i];
    if (spec && s.key === spec.key) Object.assign(s, { title: spec.title[lang], icon: spec.icon });
  });
  return place;
}

/** 키 순서를 원본과 같게 — 원본 모양에 번역만 바꿔 넣었으므로 이미 같지만, label·icon 을 새로 넣은 경우를 위해 맞춘다. */
function orderLike(ref, v) {
  if (Array.isArray(v)) return v.map((x, i) => orderLike(Array.isArray(ref) ? ref[i] : undefined, x));
  if (!isObject(v)) return v;
  const keys = isObject(ref) ? [...Object.keys(ref).filter((k) => k in v), ...Object.keys(v).filter((k) => !(k in ref))] : Object.keys(v);
  return Object.fromEntries(keys.map((k) => [k, orderLike(isObject(ref) ? ref[k] : undefined, v[k])]));
}

// ───────────── 파일 ─────────────

const placeFiles = (lang) => (existsSync(join(dataDir, lang)) ? readdirSync(join(dataDir, lang)).filter((f) => /^\d{3}-.+\.json$/.test(f)).sort() : []);
const readPlace = (lang, file) => JSON.parse(readFileSync(join(dataDir, lang, file), 'utf8'));

/** 인자로 받은 이름들을 원본 파일 이름으로 바꾼다. */
function resolveFiles(args) {
  const all = placeFiles(SOURCE);
  if (!args.length) return all;
  return args.map((a) => {
    const name = a.replace(/\.(json|txt)$/, '');
    const hit = all.find((f) => f === `${name}.json` || f.slice(4, -5) === name || Number(f.slice(0, 3)) === Number(name));
    if (!hit) throw new Error(`원본에 없는 여행지 — ${a}`);
    return hit;
  });
}

/** 번역 파일을 읽는다 → Map(번호 → 글). 형식 오류는 errors 에 넣는다. */
function readTranslation(lang, file, errors) {
  const path = join(workDir, lang, file.replace(/\.json$/, '.txt'));
  if (!existsSync(path)) {
    errors.push(`번역 파일 없음 — ${path}`);
    return null;
  }
  const map = new Map();
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const m = /^@(\d+) (.*)$/.exec(line);
    if (!m) return errors.push(`${i + 1}번째 줄 형식 오류 (\`@번호 글\` 이어야 함) — ${line.slice(0, 50)}`);
    if (map.has(Number(m[1]))) errors.push(`@${m[1]} 가 두 번 나옴`);
    map.set(Number(m[1]), m[2].trim());
  });
  return map;
}

/** 원본 항목과 번역을 짝지어 검사한다. 오류가 없으면 번역을 넣은 여행지를 돌려준다. */
function translate(lang, file, errors) {
  const source = readPlace(SOURCE, file);
  const units = extract(source, file);
  const map = readTranslation(lang, file, errors);
  if (!map) return null;
  const hangul = lang !== SOURCE && lang !== 'ko';
  units.forEach((u, i) => {
    const id = i + 1;
    const text = map.get(id);
    if (text === undefined) return errors.push(`@${id} 번역 없음 (${u.hint})`);
    if (!text) return errors.push(`@${id} 글이 비어 있음`);
    if (hangul && /[가-힣]/.test(text)) errors.push(`@${id} 한글이 남아 있음 — ${text.slice(0, 40)}`);
    if (/^\[[^\]]*\]|^#/.test(text)) errors.push(`@${id} 설명(hint)을 번역에 옮기지 말 것 — ${text.slice(0, 40)}`);
    if (/\*\*|\]\(/.test(text)) errors.push(`@${id} 마크다운 기호(** 또는 ](...))`);
    if (u.kind === 'runs') {
      try {
        fromMarkup(text);
      } catch (e) {
        return errors.push(`@${id} ${e.message}`);
      }
      // "7–⟦date|September⟧" 처럼 기간의 시작이 조각 밖에 숫자로 남으면 달 이름을 쓰는 언어에서 "7–September" 가 된다.
      if (/\d{1,2}\s*([~〜–—-]|to|đến|до|по|ถึง|إلى|至|から)\s*⟦date\|/.test(text) || /\d⟦date\|\d/.test(text)) {
        errors.push(`@${id} 기간의 시작이 값 조각 밖에 숫자로 남음 — 시작도 조각 안에 그 언어의 달 이름으로 쓴다 (예: ⟦date|July–September⟧, ⟦date|7〜9月⟧)`);
      }
      const [a, b] = [specsOf(u.value), specsOf(text)];
      if (a.join(' ') !== b.join(' ')) errors.push(`@${id} 값 조각이 원문과 다름 — 원문 [${a.join(' ')}] / 번역 [${b.join(' ')}]`);
      else if (pricesOf(u.value).join(' ') !== pricesOf(text).join(' ')) errors.push(`@${id} price 조각의 숫자가 원문과 다름 — 원문 ${pricesOf(u.value).join(',')} / 번역 ${pricesOf(text).join(',')}`);
    } else if (/[⟦⟧]/.test(text)) errors.push(`@${id} 이 글은 값 조각(⟦ ⟧)을 쓸 수 없음`);
  });
  for (const id of map.keys()) if (id < 1 || id > units.length) errors.push(`@${id} 원본에 없는 번호 (1~${units.length})`);
  if (errors.length) return null;
  const place = structuredClone(source);
  units.forEach((u, i) => setPath(place, u.path, u.kind === 'runs' ? carryFixed(fromMarkup(map.get(i + 1)), getPath(source, u.path)) : map.get(i + 1)));
  return orderLike(source, applyMeta(place, lang));
}

// ───────────── 명령 ─────────────

function cmdExport(args) {
  const out = join(workDir, 'src');
  mkdirSync(out, { recursive: true });
  let total = 0;
  for (const file of resolveFiles(args)) {
    const place = readPlace(SOURCE, file);
    const units = extract(place, file);
    total += units.length;
    const lines = [`# ${file.slice(0, -5)} — ${place.title.text} (${place.title_en.text}) · 원문 ${SOURCE} · ${units.length}줄`];
    let prev = '';
    units.forEach((u, i) => {
      if (u.hint !== prev) lines.push(`# ${u.hint}`);
      prev = u.hint;
      lines.push(`@${i + 1} ${u.value}`);
    });
    writeFileSync(join(out, file.replace(/\.json$/, '.txt')), `${lines.join('\n')}\n`);
  }
  console.log(`번역할 글 ${total}줄 → _i18n/src/`);
}

function cmdCheck(lang, args, write) {
  if (!LANGS.includes(lang) || lang === SOURCE) throw new Error(`번역 언어는 ${LANGS.filter((l) => l !== SOURCE).join('·')} 중 하나 — ${lang}`);
  let failed = 0;
  for (const file of resolveFiles(args)) {
    const errors = [];
    const place = translate(lang, file, errors);
    if (errors.length) {
      failed++;
      console.log(`✗ ${lang}/${file.replace(/\.json$/, '.txt')} — 오류 ${errors.length}건\n${errors.slice(0, 40).map((e) => `  - ${e}`).join('\n')}`);
      continue;
    }
    if (write) {
      mkdirSync(join(dataDir, lang), { recursive: true });
      writeFileSync(join(dataDir, lang, file), format(place));
    }
    console.log(`✓ ${lang}/${file}${write ? ' → data/' + lang + '/' + file : ''}`);
  }
  if (failed) process.exit(1);
}

function cmdSync(langs) {
  let changed = 0;
  let failed = 0;
  for (const lang of langs.length ? langs : LANGS) {
    for (const file of placeFiles(lang)) {
      const path = join(dataDir, lang, file);
      const before = readFileSync(path, 'utf8');
      let place = JSON.parse(before);
      if (lang !== SOURCE) {
        if (!existsSync(join(dataDir, SOURCE, file))) {
          failed++;
          console.log(`✗ ${lang}/${file} — 원본(${SOURCE})에 같은 파일이 없음`);
          continue;
        }
        const source = readPlace(SOURCE, file);
        const [a, b] = [extract(source, file), extract(place, file)];
        const mismatch = a.findIndex((u, i) => u.path.join('.') !== b[i]?.path.join('.') || u.kind !== b[i]?.kind);
        if (mismatch !== -1 || a.length !== b.length) {
          failed++;
          console.log(`✗ ${lang}/${file} — 원본과 모양이 다름 (${a[mismatch]?.path.join('.') ?? b[a.length]?.path.join('.')})`);
          continue;
        }
        const next = structuredClone(source);
        a.forEach((u, i) => setPath(next, u.path, u.kind === 'runs' ? carryFixed(fromMarkup(b[i].value), getPath(source, u.path)) : b[i].value));
        place = orderLike(source, next);
      }
      const after = format(applyMeta(place, lang));
      if (after !== before) {
        writeFileSync(path, after);
        changed++;
        console.log(`  고침 ${lang}/${file}`);
      }
    }
  }
  console.log(`sync — 고친 파일 ${changed}개${failed ? `, 실패 ${failed}개` : ''}`);
  if (failed) process.exit(1);
}

function cmdFormat(langs) {
  let changed = 0;
  for (const lang of langs.length ? langs : LANGS) {
    for (const file of placeFiles(lang)) {
      const path = join(dataDir, lang, file);
      const before = readFileSync(path, 'utf8');
      const after = format(JSON.parse(before));
      if (after !== before) {
        writeFileSync(path, after);
        changed++;
      }
    }
  }
  console.log(`format — 고친 파일 ${changed}개`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  try {
    switch (command) {
      case 'export': cmdExport(args); break;
      case 'check': cmdCheck(args[0], args.slice(1), false); break;
      case 'import': cmdCheck(args[0], args.slice(1), true); break;
      case 'sync': cmdSync(args); break;
      case 'format': cmdFormat(args); break;
      default:
        console.log('사용: node scripts/i18n.mjs export [파일…] | check <언어> [파일…] | import <언어> [파일…] | sync [언어…] | format [언어…]');
        process.exit(command ? 1 : 0);
    }
  } catch (e) {
    console.error(`오류 — ${e.message}`);
    process.exit(1);
  }
}
