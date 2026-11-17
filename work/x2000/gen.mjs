// 간단 명세(spec.json) → 규격에 맞는 한국어 원본 JSON. 사용: node work/x2000/gen.mjs <작업폴더>
// 글 안 표기: ⟦price|₱50⟧ ⟦time|08:00⟧ ⟦date|11~5월⟧ ⟦duration|2시간⟧ ⟦distance|3km⟧ ⟦temperature|30℃⟧ ⟦b|굵게⟧ ⟦place_link|비간|vigan⟧
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = process.argv[2];
if (!dir) { console.error('작업 폴더를 주세요'); process.exit(2); }
const meta = JSON.parse(readFileSync(join(root, 'data/meta.json'), 'utf8'));
const spec = JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8'));
const photos = existsSync(join(dir, 'photos.json')) ? JSON.parse(readFileSync(join(dir, 'photos.json'), 'utf8')) : {};
const errs = [];
const L = (k) => meta.fields[k].label.ko;
const TYPES = new Set(['price', 'time', 'date', 'duration', 'distance', 'temperature']);
function runs(s, where) {
  if (typeof s !== 'string' || !s.trim()) { errs.push(`${where}: 빈 글`); return [{ text: '?' }]; }
  if (/\*\*|\]\(/.test(s)) errs.push(`${where}: 마크다운 금지`);
  const out = []; let last = 0;
  for (const m of s.matchAll(/⟦([a-z_]+)\|([^⟧]*)⟧/g)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const [t, body] = [m[1], m[2]];
    if (t === 'b') out.push({ text: body, bold: true });
    else if (t === 'place_link') { const [text, slug] = body.split('|'); if (!slug) errs.push(`${where}: place_link 에 slug 없음`); out.push({ type: 'place_link', text, slug }); }
    else if (TYPES.has(t)) out.push({ type: t, text: body });
    else errs.push(`${where}: 모르는 조각 ${t}`);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  if (/[⟦⟧]/.test(out.filter((r) => !r.type).map((r) => r.text).join(''))) errs.push(`${where}: 조각 괄호가 깨짐`);
  return out;
}
const para = (s, w) => ({ type: 'paragraph', children: runs(s, w) });
const list = (items, icon, w) => ({ type: 'list', ordered: false, ...(icon ? { icon } : {}), items: items.map((x, i) => ({ children: runs(x, `${w}[${i}]`) })) });
const region = meta.regions.find((r) => r.key === spec.region);
if (!region) errs.push(`region 은 다음 중 하나: ${meta.regions.map((r) => r.key).join(' ')}`);
const group = meta.island_groups.find((g) => g.key === region?.island_group);
const cat = meta.categories.find((c) => c.key === spec.category);
if (!cat) errs.push(`category 는 다음 중 하나: ${meta.categories.map((c) => c.key).join(' ')}`);
const diff = meta.difficulties.find((d) => d.value === spec.difficulty);
if (!diff) errs.push('difficulty 는 1·2·3');
const name = `${String(spec.id).padStart(3, '0')}-${spec.slug}`;
function image(im, i) {
  const p = photos[im.file];
  if (!p) { errs.push(`images[${i}]: photos.json 에 없는 파일 ${im.file}`); return {}; }
  if (!im.alt) errs.push(`images[${i}]: alt 없음`);
  return { type: 'image', url: `images/${name}${i ? `-${i + 1}` : ''}.webp`, alt: im.alt, credit: `${p.author} / ${p.license} / Wikimedia Commons`, source: p.page };
}
const imgs = (spec.images || []).map(image);
if (imgs.length && imgs.length < 10) errs.push(`사진 ${imgs.length}장 — 0장(텍스트 먼저, 사진은 나중) 또는 10장 이상`);
if (new Set((spec.images || []).map((x) => x.file)).size !== imgs.length) errs.push('사진 겹침');
const sec = (key, blocks) => { const s = meta.sections.find((x) => x.key === key); return { type: 'section', key, title: s.title.ko, icon: s.icon, blocks }; };
const S = spec;
const need = (c, m) => { if (!c) errs.push(m); };
need(S.overview?.length >= 3 && S.overview.length <= 4, 'overview 문단 3~4개');
need(S.highlights?.length >= 6 && S.highlights.length <= 8, 'highlights 카드 6~8개');
need(S.itinerary?.length >= 1, 'itinerary 탭 1개 이상');
need(S.getting_there?.length >= 2, 'getting_there 수단 2개 이상');
need(S.best_time?.rows?.length >= 3 && S.best_time.rows.length <= 5 && S.best_time.rows.every((r) => r.length === 3), 'best_time.rows 3~5행 × 3칸');
need(S.costs?.length >= 6 && S.costs.length <= 9, 'costs 6~9개');
need(S.tips?.length >= 6 && S.tips.length <= 10, 'tips 6~10개');
need(S.cautions?.items?.length >= 4 && S.cautions.items.length <= 6, 'cautions.items 4~6개');
need(S.nearby?.length >= 3 && S.nearby.length <= 5, 'nearby 3~5개');
need(S.tags?.length >= 3 && S.tags.length <= 6, 'tags 3~6개');
need(S.tagline && S.tagline.length >= 12 && S.tagline.length <= 40 && !/[.。]$/.test(S.tagline), 'tagline 20~32자, 마침표 없음');
need(S.rating >= 4 && S.rating <= 5, 'rating 4.0~5.0');
need(S.lat >= 4 && S.lat <= 22 && S.lon >= 116 && S.lon <= 127, '좌표 범위');
need(/^[A-Z]{3}$/.test(S.airport?.code || ''), 'airport.code IATA 3자리');
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
const out = {
  id: S.id, slug: S.slug,
  title: { type: 'title', text: S.title },
  title_en: { type: 'subtitle', lang: 'en', text: S.title_en },
  tagline: { type: 'typography', variant: 'tagline', text: S.tagline },
  island_group: { type: 'badge', label: L('island_group'), value: group.key, text: group.name.ko },
  region: { type: 'badge', label: L('region'), value: region.key, text: region.name.ko },
  location: { type: 'address', label: L('location'), icon: 'location_on', text: S.location },
  category: { type: 'badge', label: L('category'), icon: cat.icon, value: cat.key, text: cat.name.ko },
  tags: { type: 'tags', label: L('tags'), items: S.tags },
  rating: { type: 'rating', label: L('rating'), value: S.rating, max: 5 },
  latitude: { type: 'latitude', label: L('latitude'), value: Math.round(S.lat * 1e4) / 1e4 },
  longitude: { type: 'longitude', label: L('longitude'), value: Math.round(S.lon * 1e4) / 1e4 },
  best_season: { type: 'date', label: L('best_season'), icon: 'calendar_month', text: S.best_season.text, months: S.best_season.months },
  duration: { type: 'duration', label: L('duration'), icon: 'schedule', text: S.duration },
  budget: { type: 'price', label: L('budget'), icon: 'payments', text: S.budget.text, currency: 'PHP', min: S.budget.min, max: S.budget.max },
  difficulty: { type: 'level', label: L('difficulty'), icon: 'signal_cellular_alt', text: diff.name.ko, value: diff.value, max: 3 },
  airport: { type: 'airport', label: L('airport'), icon: 'flight', text: S.airport.text, code: S.airport.code },
  ...(imgs.length ? { image: imgs[0], gallery: { type: 'carousel', label: L('gallery'), items: imgs.slice(1) } } : {}),
  summary: { type: 'paragraph', variant: 'lead', children: runs(S.summary, 'summary') },
  sections: [
    sec('overview', S.overview.map((p, i) => para(p, `overview[${i}]`))),
    sec('highlights', [{ type: 'grid', columns: 2, blocks: S.highlights.map((h, i) => ({ type: 'card', number: i + 1, title: h.title, children: runs(h.text, `highlights[${i}]`) })) }]),
    sec('itinerary', [{ type: 'tabs', items: S.itinerary.map((t, i) => ({ title: t.title, ...(t.subtitle ? { subtitle: t.subtitle } : {}), blocks: [{ type: 'stepper', items: t.steps.map((s, j) => ({ ...(s.time ? { time: s.time } : {}), children: runs(s.text, `itinerary[${i}].steps[${j}]`) })) }, ...(t.note ? [para(t.note, `itinerary[${i}].note`)] : [])] })) }]),
    sec('getting_there', [{ type: 'accordion', items: S.getting_there.map((g, i) => ({ title: g.title, icon: g.icon || 'route', blocks: [list(g.items, null, `getting_there[${i}]`), ...(g.note ? [para(g.note, `getting_there[${i}].note`)] : [])] })) }]),
    sec('best_time', [...S.best_time.paragraphs.map((p, i) => para(p, `best_time[${i}]`)), { type: 'table', label: '시기별 한눈에 보기', icon: 'calendar_month', columns: ['시기', '날씨', '여행 포인트'], rows: S.best_time.rows }]),
    sec('costs', [{ type: 'pricing', currency: 'PHP', columns: ['항목', '예상 비용', '비고'], items: S.costs.map((c) => ({ label: c[0], price: c[1], ...(c[2] ? { note: c[2] } : {}) })) }, { type: 'caption', children: [{ text: '요금은 ' }, { type: 'date', text: '2026년' }, { text: ' 기준 대략치이며 현지 사정에 따라 달라질 수 있습니다.' }] }]),
    sec('stay_and_food', S.stay_and_food.map((p, i) => para(p, `stay_and_food[${i}]`))),
    sec('tips', [list(S.tips, 'check_circle', 'tips')]),
    sec('cautions', [...(S.cautions.alert ? [{ type: 'alert', variant: 'warning', icon: 'warning', children: runs(S.cautions.alert, 'cautions.alert') }] : []), list(S.cautions.items, 'error', 'cautions')]),
    sec('nearby', [{ type: 'grid', columns: 2, blocks: S.nearby.map((n, i) => ({ type: 'card', title: n.title, ...(n.place ? { place: n.place } : {}), children: runs(n.text, `nearby[${i}]`) })) }]),
  ],
};
const vis = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && ['text', 'title', 'subtitle', 'time', 'label', 'price', 'note'].includes(k) && o.type !== 'section') vis.push(v); else walk(v); } } })(out.sections);
const len = vis.join('').length;
mkdirSync(join(dir, 'ready/ko'), { recursive: true });
writeFileSync(join(dir, 'ready/ko', `${name}.json`), JSON.stringify(out, null, 2) + '\n');
console.log(`ready/ko/${name}.json — 본문 약 ${len}자 (기준 5,000~7,000자)${len < 4800 ? ' ← 짧다, 구체 정보를 더 쓴다' : len > 7600 ? ' ← 길다' : ''}`);
