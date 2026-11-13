// 실제 원본을 임시 폴더에 복사해 999/1000 경계를 빌드·번역 도구까지 통과시킨다.
// 운영 data/ 에 테스트 항목을 만들지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
test('실제 빌드와 번역 내보내기가 1000번을 누락하지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ph-travel-large-id-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    for (const file of ['build.mjs', 'i18n.mjs', 'place-files.mjs']) copyFileSync(join(root, 'scripts', file), join(dir, 'scripts', file));
    const meta = JSON.parse(readFileSync(join(root, 'data/meta.json')));
    delete meta.destinations; delete meta.monthly_picks;
    mkdirSync(join(dir, 'data/images'), { recursive: true });
    writeFileSync(join(dir, 'data/meta.json'), JSON.stringify(meta));
    const source = readdirSync(join(root, 'data/ko')).find((f) => f.startsWith('001-'));
    for (const { code } of meta.languages) {
      mkdirSync(join(dir, 'data', code), { recursive: true });
      for (const id of [999, 1000]) {
        const p = JSON.parse(readFileSync(join(root, 'data', code, source)));
        p.id = id; p.slug = id === 999 ? 'fixture-nine' : 'fixture-thousand';
        const walk = (v) => {
          if (Array.isArray(v)) return v.forEach(walk);
          if (!v || typeof v !== 'object') return;
          if (v.type === 'place_link') v.slug = id === 999 ? 'fixture-thousand' : 'fixture-nine';
          if (v.place) v.place = id === 999 ? 'fixture-thousand' : 'fixture-nine';
          if (v.type === 'image' && !existsSync(join(dir, 'data', v.url))) copyFileSync(join(root, 'data', v.url), join(dir, 'data', v.url));
          Object.values(v).forEach(walk);
        };
        walk(p);
        writeFileSync(join(dir, 'data', code, `${id}-${p.slug}.json`), JSON.stringify(p));
      }
    }
    const run = (script, ...args) => execFileSync(process.execPath, ['scripts/' + script, ...args], { cwd: dir, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    run('build.mjs');
    const built = JSON.parse(readFileSync(join(dir, '_site/v2/places.ko.json')));
    assert.deepEqual(built.places.map((p) => p.id), [999, 1000]);
    for (const arg of ['1000', 'fixture-thousand', '1000-fixture-thousand.json']) {
      run('i18n.mjs', 'export', arg);
      assert.ok(readFileSync(join(dir, '_i18n/src/1000-fixture-thousand.txt'), 'utf8').includes('@1 '));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
