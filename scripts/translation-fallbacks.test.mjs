// 실제 빌드에서 미번역 신규 항목만 영어로 표시하고 누락·오류를 숨기지 않는지 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const newFile = '1000-fixture-new.json';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'ph-travel-fallback-'));
  for (const path of ['scripts', 'data/images', 'i18n']) mkdirSync(join(dir, path), { recursive: true });
  for (const file of ['build.mjs', 'place-files.mjs']) copyFileSync(join(root, 'scripts', file), join(dir, 'scripts', file));
  const meta = JSON.parse(readFileSync(join(root, 'data/meta.json')));
  delete meta.destinations; delete meta.monthly_picks;
  writeFileSync(join(dir, 'data/meta.json'), JSON.stringify(meta));
  const missing = meta.languages.map(x => x.code).filter(x => !['ko', 'en'].includes(x));
  for (const { code } of meta.languages) {
    mkdirSync(join(dir, 'data', code));
    for (const id of [999, 1000]) {
      if (id === 1000 && missing.includes(code)) continue;
      const p = JSON.parse(readFileSync(join(root, 'data', code, '001-intramuros.json')));
      p.id = id; p.slug = id === 999 ? 'fixture-old' : 'fixture-new';
      const walk = v => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (!v || typeof v !== 'object') return;
        if (v.type === 'place_link') v.slug = id === 999 ? 'fixture-new' : 'fixture-old';
        if (v.place) v.place = id === 999 ? 'fixture-new' : 'fixture-old';
        if (v.type === 'image' && !existsSync(join(dir, 'data', v.url))) copyFileSync(join(root, 'data', v.url), join(dir, 'data', v.url));
        Object.values(v).forEach(walk);
      };
      walk(p);
      writeFileSync(join(dir, 'data', code, `${id}-${p.slug}.json`), JSON.stringify(p));
    }
  }
  const policy = { source_language: 'en', entries: { [newFile]: missing } };
  const save = () => writeFileSync(join(dir, 'i18n/fallbacks.json'), JSON.stringify(policy));
  const run = () => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: dir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const read = path => JSON.parse(readFileSync(join(dir, path)));
  save();
  return { dir, missing, policy, save, run, read, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('한·영 신규 항목은 명시한 언어에서 영어로 표시하고 기존 번역은 보존한다', () => {
  const f = fixture();
  try {
    const r = f.run(); assert.equal(r.status, 0, r.stderr);
    const manifest = f.read('_site/v2/manifest.json');
    assert.equal(manifest.count, 2); assert.equal(manifest.languages.length, 8);
    const english = f.read('_site/v2/places.en.json').places[1];
    for (const lang of f.missing) {
      const bundle = f.read(`_site/v2/places.${lang}.json`);
      assert.deepEqual(bundle.places[1], english);
      assert.deepEqual(bundle.fallback_places, ['fixture-new']);
      assert.equal(bundle.fallback_language, 'en');
      assert.deepEqual(manifest.translation_fallbacks[lang], ['fixture-new']);
      assert.equal(bundle.places[0].title.text, f.read(`data/${lang}/999-fixture-old.json`).title.text);
      assert.ok(!existsSync(join(f.dir, 'data', lang, newFile)));
    }
    assert.ok(!manifest.translation_fallbacks.en && !manifest.translation_fallbacks.ko);
    assert.deepEqual(f.read('_site/v2/meta.json').translation_fallbacks, manifest.translation_fallbacks);
  } finally { f.cleanup(); }
});

test('영어 필수 원본·미선언 누락·실제 번역의 오류는 계속 빌드를 막는다', () => {
  const f = fixture();
  try {
    const englishPath = join(f.dir, 'data/en', newFile), english = readFileSync(englishPath);
    rmSync(englishPath);
    assert.match(f.run().stderr, /en\/1000-fixture-new.json: 번역 파일 없음/);
    writeFileSync(englishPath, english);
    f.policy.entries[newFile] = f.missing.filter(x => x !== 'zh'); f.save();
    assert.match(f.run().stderr, /zh\/1000-fixture-new.json: 번역 파일 없음/);
    const broken = f.read('data/zh/999-fixture-old.json');
    broken.id = 1000; broken.slug = 'fixture-new'; broken.latitude.value = 90;
    writeFileSync(join(f.dir, 'data/zh', newFile), JSON.stringify(broken));
    assert.match(f.run().stderr, /latitude 범위 오류/);
  } finally { f.cleanup(); }
});

test('원본·대체 언어·알 수 없는 파일 및 이미 번역된 파일의 대체 선언을 거부한다', () => {
  const f = fixture();
  try {
    for (const lang of ['ko', 'en', 'xx']) {
      f.policy.entries[newFile] = [lang]; f.save();
      assert.match(f.run().stderr, /대체할 수 없는 언어/);
    }
    f.policy.entries = { '1999-unknown.json': ['zh'] }; f.save();
    assert.match(f.run().stderr, /원본에 없는 파일/);
    f.policy.entries = { '999-fixture-old.json': ['zh'] }; f.save();
    assert.match(f.run().stderr, /실제 번역이 있으므로 대체 선언을 제거/);
  } finally { f.cleanup(); }
});
