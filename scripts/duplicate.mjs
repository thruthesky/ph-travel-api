// 신규 항목을 쓰기 전에 data.csv 와 대조한다. 가까운 장소·본문 언급은 검토 후보다.
// node scripts/duplicate.mjs --name 'Manila Zoo' [--latitude 14.5648 --longitude 120.9883]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize, parseTable } from './catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]; const value = process.argv[i + 1];
  if (!['--name', '--latitude', '--longitude', '--wikidata', '--osm'].includes(key) || !value) throw new Error('사용법: node scripts/duplicate.mjs --name 이름 [--latitude 위도 --longitude 경도] [--wikidata Q번호] [--osm URL]');
  options[key.slice(2)] = value;
}
if (!options.name && !options.wikidata && !options.osm) throw new Error('이름 또는 외부 식별자를 입력한다.');
if (Boolean(options.latitude) !== Boolean(options.longitude)) throw new Error('위도·경도는 함께 입력한다.');
if (options.latitude && (!Number.isFinite(Number(options.latitude)) || !Number.isFinite(Number(options.longitude)))) throw new Error('좌표는 숫자여야 한다.');
const distance = (a, b, c, d) => {
  const rad = (v) => v * Math.PI / 180;
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};
const rows = parseTable(readFileSync(join(root, 'data.csv'), 'utf8'));
const results = rows.flatMap((row) => {
  const reasons = [];
  if (options.name && row['중복 대조 이름 키'].split(' | ').includes(normalize(options.name))) reasons.push('이름·별칭 일치');
  if (options.wikidata && row['Wikidata ID'] === options.wikidata) reasons.push('Wikidata ID 일치');
  if (options.osm && row['OSM URL'] === options.osm) reasons.push('OSM 식별자 일치');
  const km = options.latitude ? distance(Number(options.latitude), Number(options.longitude), Number(row['위도']), Number(row['경도'])) : null;
  if (km !== null && km <= 0.3) reasons.push('300m 이내·별개 명소인지 확인');
  if (!reasons.length) return [];
  return [{ id: Number(row.ID), slug: row.slug, '이름': row['이름'], '이유': reasons, '거리 km': km === null ? null : Number(km.toFixed(3)), 'JSON': row['파일이름'] }];
});
console.log(JSON.stringify({ '대장 항목 수': rows.length, '후보': options, '대조 결과': results, '안내': '일치 없음은 신규 확정이 아니다. 본문 언급·인접 명소·다른 표기도 조사한다.' }, null, 2));
