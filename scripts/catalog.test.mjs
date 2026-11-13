// 대장·후보 CSV 는 중복 방지 기준이므로 인용부호와 이름 대조의 회귀를 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { csvText, duplicatePairs, normalize, parseTable } from './catalog.mjs';

test('한국어·아랍어·태국어 이름을 지우지 않고 공백·문장부호·악센트만 정규화한다', () => {
  assert.equal(normalize('Peñafrancia Festival'), normalize('Penafrancia-Festival'));
  assert.equal(normalize('리잘 대로'), '리잘대로');
  assert.notEqual(normalize('화이트 비치'), normalize('화이트 아일랜드'));
  assert.ok(normalize('العربية'));
  assert.ok(normalize('เทศกาล'));
  assert.notEqual(normalize('กา'), normalize('ก่า'));
});
test('BOM·따옴표·쉼표·줄바꿈·빈 칸을 왕복 보존한다', () => {
  const rows = [{ 이름: '산, 바다 "전경"', 메모: '첫 줄\n둘째 줄', 빈칸: '' }];
  assert.deepEqual(parseTable(csvText(['이름', '메모', '빈칸'], rows)), rows);
  assert.deepEqual(parseTable('이름\t지역\n"강\t공원"\t세부\n', '\t'), [{ 이름: '강\t공원', 지역: '세부' }]);
  assert.throws(() => parseTable('a,b\n"broken,b'), /따옴표/);
  assert.throws(() => parseTable('a,b\n1,2,3'), /열/);
});
test('CSV의 외부 문자열이 스프레드시트 수식이 되지 않게 한다', () => {
  const rows = parseTable(csvText(['값'], [{ 값: '=HYPERLINK("https://example.com")' }, { 값: '+63-2-1234' }]));
  assert.ok(rows.every((r) => r.값.startsWith("'")));
});
test('중복 이름은 보고하고 검토한 동명 별개 장소는 구분한다', () => {
  const a = { p: { id: 1, slug: 'a' }, names: ['White Beach'], d: {} };
  const b = { p: { id: 2, slug: 'b' }, names: ['White-Beach'], d: {} };
  assert.equal(duplicatePairs([a, b]).length, 1);
  b.d.distinct_from = ['a'];
  assert.equal(duplicatePairs([a, b]).length, 0);
});
