// 한국어 원본에서 여행지 대장을 만든다. 실행: node scripts/catalog.mjs [--check]
// 수동 보충 정보는 work/catalog-details.json 에 둔다. CSV를 직접 고치지 않는다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { comparePlaceFiles, isPlaceFile } from './place-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
export const normalize = (s) => String(s ?? '').normalize('NFKD').toLowerCase()
  .replace(/([a-z])\p{M}+/gu, '$1').normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]/gu, '');
const unique = (a) => [...new Set(a.filter((x) => x !== undefined && x !== null && x !== ''))];
const joinValues = (a) => unique(a).join(' | ');
const digest = (s) => createHash('sha256').update(s).digest('hex');

// RFC 4180. 수식처럼 보이는 문자열은 스프레드시트에서 실행되지 않게 한다.
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+@\t\r]/.test(s) || /^-\D/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
export function csvText(headers, rows) {
  return '\uFEFF' + [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))]
    .map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// 따옴표·필드 안 줄바꿈·BOM 을 보존하여 옛 팀의 CSV/TSV도 읽는다.
export function parseTable(text, delimiter = ',') {
  const rows = []; let row = []; let field = ''; let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); if (row.some((v) => v !== '')) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('닫히지 않은 CSV 따옴표');
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() ?? [];
  if (new Set(headers).size !== headers.length) throw new Error('중복 CSV 헤더');
  return rows.map((r, i) => {
    if (r.length !== headers.length) throw new Error(`CSV ${i + 2}행: 열 ${r.length}/${headers.length}`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}

export function visibleText(v) {
  if (Array.isArray(v)) return v.map(visibleText).join(' ');
  if (!v || typeof v !== 'object') return '';
  const keys = new Set(['text', 'title', 'subtitle', 'time', 'label', 'price', 'note', 'cite']);
  return Object.entries(v).map(([k, x]) => keys.has(k) && typeof x === 'string' ? x : visibleText(x)).filter(Boolean).join(' ');
}
function allUrls(v) {
  if (typeof v === 'string') return v.match(/https?:\/\/[^\s<>"\]]+/g) ?? [];
  if (!v || typeof v !== 'object') return [];
  return Object.values(v).flatMap(allUrls);
}
function contentLinks(v) {
  if (!v || typeof v !== 'object') return [];
  return [...(v.type === 'link' && /^https?:/.test(v.url) ? [v.url] : []), ...Object.values(v).flatMap(contentLinks)];
}
function gitDates() {
  const dates = new Map();
  const log = execFileSync('git', ['log', '--format=@@%cI', '--name-only', '--', 'data/ko'], { cwd: root, encoding: 'utf8' });
  let date;
  for (const line of log.split('\n')) {
    if (line.startsWith('@@')) date = line.slice(2);
    else if (/^data\/ko\/.*\.json$/.test(line)) {
      const old = dates.get(line);
      dates.set(line, { created: date, modified: old?.modified ?? date });
    }
  }
  return dates;
}
const detailKeys = new Set(['aliases', 'subcategory', 'province', 'city', 'barangay', 'street', 'postal_code',
  'full_address', 'phone', 'website', 'email', 'facebook', 'operator', 'opening_hours', 'admission',
  'wikidata', 'osm', 'philgo_post_ids', 'sources', 'checked_at', 'notes', 'distinct_from']);

export function loadPlaces() {
  const meta = read('data/meta.json');
  const details = existsSync(join(root, 'work/catalog-details.json')) ? read('work/catalog-details.json') : {};
  const dates = gitDates();
  const places = readdirSync(join(root, 'data/ko')).filter(isPlaceFile).sort(comparePlaceFiles).map((file) => {
    const path = `data/ko/${file}`; const raw = readFileSync(join(root, path)); const p = JSON.parse(raw);
    const d = details[p.slug] ?? {};
    for (const key of Object.keys(d)) if (!detailKeys.has(key)) throw new Error(`${p.slug}: 알 수 없는 보충 필드 ${key}`);
    const sp = `sources/${file}`; const source = existsSync(join(root, sp)) ? read(sp) : null;
    const languageFiles = meta.languages.map(({ code }) => [`data/${code}/${file}`, code]).filter(([f]) => existsSync(join(root, f)));
    const titles = languageFiles.map(([f]) => read(f).title.text);
    const names = unique([p.slug, p.title.text, p.title_en.text, ...titles, ...(d.aliases ?? [])]);
    const postIds = unique([...(d.philgo_post_ids ?? []), ...JSON.stringify(source ?? {}).matchAll(/(?:philgo:travel\/|(?:module=post[^"\s]*?idx=))(\d+)/g)].map((v) => Array.isArray(v) ? v[1] : String(v)));
    const images = [p.image, ...p.gallery.items];
    return { p, d, path, raw, source, sourcePath: source ? sp : '', names, postIds, images, languageFiles,
      sha: digest(raw), dates: dates.get(path), stat: statSync(join(root, path)),
      sourceUrls: unique(allUrls(source).filter((u) => !u.includes('commons.wikimedia.org'))),
      contentUrls: unique(contentLinks(p)) };
  });
  const slugs = new Set(places.map(({ p }) => p.slug));
  for (const slug of Object.keys(details)) if (!slugs.has(slug)) throw new Error(`없는 여행지의 보충 정보: ${slug}`);
  return { meta, places };
}

export const headers = ['ID', 'slug', '수록 상태', '국가 코드', '국가', '여행 카테고리 대분류', '대분류 키',
  '여행 카테고리 소분류', '이름', '영문 이름', '별칭·다국어 이름', '권역', '권역 키', '지역', '지역 키',
  '주', '시·군', '바랑가이', '도로명', '우편번호', '전체 주소', '원본 위치 설명', '주소 확인 상태',
  '위도', '경도', '전화번호', '홈페이지', '이메일', '페이스북', '운영 주체', '연락처 확인 상태',
  '운영 시간', '입장료', '태그', '추천도', '여행 최적기', '최적기 월', '권장 여행 기간',
  '예산 설명', '예산 최소 PHP', '예산 최대 PHP', '난이도', '공항 이름', '공항 코드', '요약',
  '사진 수', '사진 10장 충족', '대표 사진 경로', '지원 언어', '번역 파일 수', '언어별 JSON 경로',
  '본문 글자 수', '근거 파일 경로', '근거 URL 수', '근거 URL', '본문 외부 링크', '필고 글 번호',
  '필고 글 URL', 'Wikidata ID', 'OSM URL', '정보 확인일', '파일이름', '파일 용량 바이트',
  '전체 언어 JSON 용량 바이트', '최초 작성일', '수정일', '날짜 기준', '파일시스템 수정일',
  'JSON SHA256', '중복 대조 이름 키', '메모'];

function rowsFor(places, meta) {
  return places.map(({ p, d, path, raw, source, sourcePath, names, postIds, images, languageFiles, sha, dates, stat, sourceUrls, contentUrls }) => {
    // 원문에 주·시 접미사가 명시된 부분만 분리한다. 나머지는 주소로 추측하지 않는다.
    const city = p.location.text.includes('푸에르토 프린세사시') ? '푸에르토 프린세사시'
      : p.location.text.match(/(?:세부|록사스) 시티/)?.[0]
        ?? p.location.text.match(/[가-힣]+시(?:티)?(?=[\s·(]|$)/)?.[0] ?? '';
    // 지리적으로 인접한 주와 행정 소속을 혼동하지 않도록 독립 도시는 자동 주 추출을 하지 않는다.
    const independent = /바기오|세부시|세부 시티|일로일로시|바콜로드시|라푸라푸시|카가얀데오로시|이리간시|다바오시|제너럴산토스시|푸에르토 프린세사시|타클로반시|오르목시|올롱가포|나가시/.test(p.location.text);
    const province = independent ? '' : p.location.text.match(/^(.{1,25}?)\s*주(?=\s|$)/)?.[1]?.trim() ?? '';
    return {
    ID: p.id, slug: p.slug, '수록 상태': '수록', '국가 코드': 'PH', '국가': '필리핀',
    '여행 카테고리 대분류': p.category.text, '대분류 키': p.category.value, '여행 카테고리 소분류': d.subcategory ?? '',
    '이름': p.title.text, '영문 이름': p.title_en.text, '별칭·다국어 이름': joinValues(names.filter((n) => n !== p.slug)),
    '권역': p.island_group.text, '권역 키': p.island_group.value, '지역': p.region.text, '지역 키': p.region.value,
    '주': d.province ?? province, '시·군': d.city ?? city, '바랑가이': d.barangay ?? '', '도로명': d.street ?? '',
    '우편번호': d.postal_code ?? '', '전체 주소': d.full_address ?? '', '원본 위치 설명': p.location.text,
    '주소 확인 상태': d.full_address || d.city ? '보충 정보 출처 참조·빈 필드는 미확인' : province || city ? '원본 문장 분리·행정 관계 및 상세 주소 미검증' : '원본 위치만 있음·세부 확인 필요',
    '위도': p.latitude.value, '경도': p.longitude.value, '전화번호': d.phone ?? '', '홈페이지': d.website ?? '',
    '이메일': d.email ?? '', '페이스북': d.facebook ?? '', '운영 주체': d.operator ?? '',
    '연락처 확인 상태': [d.phone, d.website, d.email, d.facebook].some(Boolean) ? '보충 정보 출처 참조' : '미확인',
    '운영 시간': d.opening_hours ?? '', '입장료': d.admission ?? '', '태그': joinValues(p.tags.items), '추천도': p.rating.value,
    '여행 최적기': p.best_season.text, '최적기 월': p.best_season.months.join('|'), '권장 여행 기간': p.duration.text,
    '예산 설명': p.budget.text, '예산 최소 PHP': p.budget.min, '예산 최대 PHP': p.budget.max,
    '난이도': p.difficulty.text, '공항 이름': p.airport.text, '공항 코드': p.airport.code, '요약': visibleText(p.summary).trim(),
    '사진 수': images.length, '사진 10장 충족': images.length >= 10 ? '예' : '아니오', '대표 사진 경로': `data/${p.image.url}`,
    '지원 언어': languageFiles.map(([, l]) => l).join('|'), '번역 파일 수': languageFiles.length,
    '언어별 JSON 경로': languageFiles.map(([f]) => f).join(' | '), '본문 글자 수': visibleText(p.sections).trim().length,
    '근거 파일 경로': sourcePath, '근거 URL 수': unique([...sourceUrls, ...(d.sources ?? [])]).length,
    '근거 URL': joinValues([...sourceUrls, ...(d.sources ?? [])]), '본문 외부 링크': contentUrls.join(' | '),
    '필고 글 번호': postIds.join('|'), '필고 글 URL': postIds.map((id) => `https://www.philgo.com/?module=post&action=view&idx=${id}`).join(' | '),
    'Wikidata ID': d.wikidata ?? '', 'OSM URL': d.osm ?? '', '정보 확인일': d.checked_at ?? source?.checked_at ?? '',
    '파일이름': path, '파일 용량 바이트': raw.length,
    '전체 언어 JSON 용량 바이트': languageFiles.reduce((sum, [f]) => sum + statSync(join(root, f)).size, 0),
    '최초 작성일': dates?.created ?? '', '수정일': dates?.modified ?? '',
    '날짜 기준': dates ? 'Git 기록상 최초 추가·최종 커밋 시각(실제 집필일과 다를 수 있음)' : '미커밋·작성일 미확정',
    '파일시스템 수정일': stat.mtime.toISOString(), 'JSON SHA256': sha, '중복 대조 이름 키': joinValues(names.map(normalize)), '메모': d.notes ?? '',
  }; });
}

export function nameIndex(places) {
  const index = new Map();
  for (const place of places) for (const key of unique(place.names.map(normalize))) {
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(place);
  }
  return index;
}
export function duplicatePairs(places) {
  const pairs = new Map();
  for (const [name, matches] of nameIndex(places)) for (const a of matches) for (const b of matches) {
    if (a.p.id >= b.p.id || a.d.distinct_from?.includes(b.p.slug) || b.d.distinct_from?.includes(a.p.slug)) continue;
    const key = `${a.p.id}:${b.p.id}`;
    if (!pairs.has(key)) pairs.set(key, { a, b, names: [] });
    pairs.get(key).names.push(name);
  }
  return [...pairs.values()];
}

function writeOutput(file, text, check) {
  if (check) {
    if (!existsSync(join(root, file)) || readFileSync(join(root, file), 'utf8') !== text) throw new Error(`${file} 갱신 필요: node scripts/catalog.mjs`);
  } else writeFileSync(join(root, file), text);
}
function main() {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== '--check')) throw new Error('사용법: node scripts/catalog.mjs [--check]');
  const check = args.includes('--check'); const { meta, places } = loadPlaces();
  const ids = places.map(({ p }) => p.id); const slugs = places.map(({ p }) => p.slug);
  if (new Set(ids).size !== ids.length || new Set(slugs).size !== slugs.length) throw new Error('중복 ID·slug');
  const rows = rowsFor(places, meta);
  writeOutput('data.csv', csvText(headers, rows), check);
  const pairs = duplicatePairs(places);
  const report = ['# 기존 항목의 이름 중복 검토', '', '이름이 같아도 별개 장소일 수 있으므로 자동 삭제하지 않는다. 정규화는 공백·문장부호·악센트 차이만 없앤다.', '',
    ...pairs.map(({ a, b, names }) => `- ${a.p.id} ${a.p.title.text} (${a.p.slug}) / ${b.p.id} ${b.p.title.text} (${b.p.slug}) — ${joinValues(names)}`),
    ...(!pairs.length ? ['동일한 이름 키를 가진 서로 다른 항목이 없다.'] : []), ''].join('\n');
  writeOutput('work/catalog-duplicates.md', report, check);
  console.log(`여행지 대장 ${rows.length}행 · ${headers.length}열 · 이름 중복 검토 ${pairs.length}쌍 · 목표 1,000곳까지 ${Math.max(0, 1000 - rows.length)}곳`);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
