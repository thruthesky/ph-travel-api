// 앞선 두 팀의 필고 후보를 대장과 대조한다. 후보 행수는 API 수록 건수가 아니다.
// 실행: node scripts/candidates.mjs [--check]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvText, loadPlaces, normalize, parseTable, visibleText } from './catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = [
  ['work/philgo-travel-posts-not-in-api-since-2025-08-10.tsv', '\t'],
  ['work/philgo-travel-posts-not-in-api.csv', ','],
];
// 이름·글 번호를 실제로 대조하여 확인한 표기 차이만 합친다.
const aliases = new Map([
  ['Sinulog Detail', 'Sinulog Festival'], ['Bacolod Masskara', 'Masskara Festival Bacolod'],
  ['Ati Atihan Festival Kalibo', 'Ati Atihan Festival'],
  ['Guimaras Island Manggahan Festival', 'Guimaras Mango Festival'],
  ['Halaran Festival (Sinadya sa Halaran)', 'Sinadya sa Halaran'],
].map(([a, b]) => [normalize(a), normalize(b)]));
const keyFor = (r) => {
  const n = normalize(r['영문 이름'] || r['여행명소 이름']);
  return aliases.get(n) ?? n;
};
const headers = ['후보 키', '종류', '분류', '권역', '지역', '이름', '영문 이름', '다른 이름', '필고 글 번호',
  '필고 글 URL', '원본 행 수', '최장 본문 글자 수', '대조 상태', '일치한 API slug', '본문 언급 API slug',
  '이전 팀 API 상태', '이전 팀 작업 결과', '원본 파일', '비고'];

const args = process.argv.slice(2);
if (args.some((a) => a !== '--check')) throw new Error('사용법: node scripts/candidates.mjs [--check]');
const { places } = loadPlaces();
const catalogPath = join(root, 'data.csv');
if (!existsSync(catalogPath)) throw new Error('먼저 node scripts/catalog.mjs 로 data.csv 를 만든다.');
const catalog = parseTable(readFileSync(catalogPath, 'utf8'));
const index = new Map();
for (const r of catalog) for (const key of r['중복 대조 이름 키'].split(' | ')) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(r.slug);
}
if (catalog.length !== places.length || places.some(({ p, sha }) => !catalog.some((r) => r.slug === p.slug && r['JSON SHA256'] === sha))) {
  throw new Error('data.csv 가 원본과 다름. 먼저 node scripts/catalog.mjs 를 실행한다.');
}
const groups = new Map();
const unique = (a) => [...new Set(a.filter(Boolean))];
const list = (a) => unique(a).join(' | ');
let inputRows = 0;
for (const [path, delimiter] of inputs) {
  if (!existsSync(join(root, path))) continue;
  for (const r of parseTable(readFileSync(join(root, path), 'utf8'), delimiter)) {
    inputRows++;
    const key = keyFor(r);
    if (!key) throw new Error(`${path}: 이름 없는 후보`);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...r, path });
  }
}
const bodies = places.map((p) => [p.p.slug, normalize(visibleText(p.p.sections))]);
const rows = [...groups.entries()].map(([key, members]) => {
  const values = (k) => unique(members.map((r) => r[k]));
  const names = unique([...values('여행명소 이름'), ...values('영문 이름')].flatMap((n) => {
    const base = n.replace(/\s*\([^)]*\)/g, '').trim();
    return [n, base, base.split(' — ').at(-1), ...[...n.matchAll(/\(([^)]+)\)/g)].map((m) => m[1])];
  }));
  const posts = unique(values('글 번호').flatMap((v) => v.match(/\d+/g) ?? []));
  const matches = unique(names.flatMap((n) => index.get(normalize(n)) ?? []));
  // 원글 번호가 출처에 들어 있다고 모두 같은 여행지는 아니다. 이름 일치만 확정한다.
  const mentions = unique([...bodies.filter(([, body]) => names.some((n) => {
    const k = normalize(n); return k.length >= 4 && body.includes(k);
  })).map(([slug]) => slug), ...members.filter((r) => r['API 상태'] === '언급만').flatMap((r) =>
    [...(r['비고'] ?? '').matchAll(/\((\d{3,})\)/g)].flatMap((m) => places.filter(({ p }) => p.id === Number(m[1])).map(({ p }) => p.slug)))])
    .filter((slug) => !matches.includes(slug));
  const results = values('1차 결과(2026-11-13)');
  // 이전 차수에서 여러 명소를 한 지구 항목에 함께 실은 경우를 보존한다.
  const covered = unique(results.flatMap((r) => /^(\d+) 추가/.test(r)
    ? places.filter(({ p }) => p.id === Number(r.match(/^(\d+)/)[1])).map(({ p }) => p.slug) : []));
  const blocked = results.some((r) => /보류|폐쇄/.test(r));
  const type = values('종류').join(' | ') || '장소(이전 팀 분류)';
  const status = matches.length ? '기존 독립 항목·추가 제외' : covered.length ? '기존 지구 항목에 수록·분리 여부 검토' : blocked ? '이전 검토 보류·재확인 필요'
    : /업소|숙소|음식점|기타|교통|안내|주제/.test(type) || values('비고').some((n) => n.includes('명소가 아님')) ? '여행지 적합성 검토 필요'
      : mentions.length ? '본문 언급·독립 항목 여부 검토' : '미수록 후보·조사 및 사진 확인 필요';
  return {
    '후보 키': key, '종류': type, '분류': list(values('분류')), '권역': list(values('권역')), '지역': list(values('지역')),
    '이름': values('여행명소 이름')[0], '영문 이름': values('영문 이름')[0] ?? '', '다른 이름': names.slice(1).join(' | '),
    '필고 글 번호': posts.join('|'), '필고 글 URL': posts.map((id) => `https://www.philgo.com/?module=post&action=view&idx=${id}`).join(' | '),
    '원본 행 수': members.length, '최장 본문 글자 수': Math.max(0, ...members.map((r) => Number(r['본문 글자 수(가장 긴 글)'] ?? r['본문 글자 수'] ?? 0))),
    '대조 상태': status, '일치한 API slug': matches.join(' | '), '본문 언급 API slug': list([...covered, ...mentions]),
    '이전 팀 API 상태': list(values('API 상태')), '이전 팀 작업 결과': list(results), '원본 파일': list(members.map((r) => r.path)),
    '비고': list(values('비고')),
  };
}).sort((a, b) => b['최장 본문 글자 수'] - a['최장 본문 글자 수'] || a['후보 키'].localeCompare(b['후보 키']));
const output = csvText(headers, rows);
const path = join(root, 'work/addition-candidates.csv');
if (args.includes('--check')) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== output) throw new Error('후보 대장 갱신 필요: node scripts/candidates.mjs');
} else writeFileSync(path, output);
const counts = {};
for (const r of rows) counts[r['대조 상태']] = (counts[r['대조 상태']] ?? 0) + 1;
console.log(JSON.stringify({ '원본 행': inputRows, '묶은 후보': rows.length, 'API 수록': places.length, '분류': counts }, null, 2));
