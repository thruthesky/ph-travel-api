import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePlaceFiles, isPlaceFile, placeId, placeSlug } from './place-files.mjs';

test('1000번 이상도 빌드·번역 대상으로 인식한다', () => {
  for (const f of ['001-intramuros.json', '999-place.json', '1000-new-place.json', '12345-another-place.json']) assert.ok(isPlaceFile(f));
  for (const f of ['meta.json', 'data.csv', '10-bad.json', '1000-image.webp']) assert.ok(!isPlaceFile(f));
  assert.equal(placeId('1000-new-place.json'), 1000);
  assert.equal(placeSlug('1000-new-place.json'), 'new-place');
  // 잘못된 slug도 읽은 뒤 기존 규격 검사에서 실패해야 한다. 탐색 단계에서 숨기지 않는다.
  assert.ok(isPlaceFile('1000-Invalid_Slug.json'));
});
test('세 자리와 네 자리 파일이 섞여도 숫자 순서로 읽는다', () => {
  assert.deepEqual(['1000-d.json', '101-b.json', '999-c.json', '100-a.json'].sort(comparePlaceFiles),
    ['100-a.json', '101-b.json', '999-c.json', '1000-d.json']);
});
