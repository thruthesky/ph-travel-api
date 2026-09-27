// 여행지 마크다운(data/*.md)과 사진(data/images/*.webp)을 정적 JSON API 로 만든다.
//
// 실행: node scripts/build.mjs  →  _site/v1/ 에 manifest.json · places.json · images/ 를 만든다.
// 규격을 어기는 파일이 하나라도 있으면 오류를 모두 출력하고 exit 1 로 끝나서 배포되지 않는다.
// 외부 패키지를 쓰지 않는다 — Node 만 있으면 된다.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** JSON 구조가 바뀌어 옛 클라이언트가 읽을 수 없게 되면 올리고, 출력 경로도 /v2/ 로 바꾼다. */
const SCHEMA = 1;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, '_site', 'v1');

// 작성 규격(data/README.md)과 같은 값들.
const ISLAND_GROUPS = ['루손', '비사야', '민다나오'];
const CATEGORIES = ['해변·섬', '다이빙·해양', '산·트레킹', '폭포·호수·강', '역사·문화', '도시·미식', '자연 경관'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];
const REQUIRED_TEXT = [
  'title', 'title_en', 'tagline', 'region', 'location', 'best_season',
  'duration', 'budget', 'airport', 'image', 'image_credit', 'image_source', 'summary',
];
const SECTIONS = [
  '한눈에 보기', '꼭 해봐야 할 것', '추천 일정', '가는 방법', '여행 최적기와 날씨',
  '예상 비용', '숙소와 먹거리', '여행 팁', '주의사항', '함께 가보면 좋은 곳',
];

const errors = [];

/** 앞머리(`---` 사이)와 본문을 나눈다. 한 줄에 `키: 값`, 첫 콜론에서 자른다. */
function splitFrontMatter(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return [{}, raw];
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) return [{}, raw];
  const meta = {};
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return [meta, lines.slice(end + 1).join('\n')];
}

/** 본문을 `## ` 제목 단위로 나눈다. 마크다운은 가공하지 않고 그대로 둔다. */
function splitSections(body) {
  const sections = [];
  let title = null;
  let buffer = [];
  const flush = () => {
    const markdown = buffer.join('\n').trim();
    if (title !== null || markdown) sections.push({ title: title ?? '', markdown });
    buffer = [];
  };
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      title = line.slice(3).trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/** `[가, 나, 다]` 한 줄 목록. */
const parseList = (value) => value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);

/** `a | b` 처럼 ` | ` 로 나눈 값. */
const splitBar = (value) => (value ? value.split(' | ').map((s) => s.trim()) : []);

const sha = (data) => createHash('sha256').update(data).digest('hex');

/** 사진 한 장 — 파일을 복사하고, 내용이 바뀌면 주소도 바뀌도록 `?v=<해시>` 를 붙인다. */
function photo(file, image, credit, source) {
  const path = join(dataDir, image);
  if (!/^images\/[a-z0-9-]+\.webp$/.test(image) || !existsSync(path)) {
    errors.push(`${file}: 사진 파일 없음 또는 경로 형식 오류 — ${image}`);
    return { url: image, credit, source };
  }
  if (!credit) errors.push(`${file}: ${image} 저작자 표기 없음`);
  if (!source.startsWith('https://')) errors.push(`${file}: ${image} 원본 주소가 https:// 로 시작하지 않음`);
  copyFileSync(path, join(outDir, image));
  return { url: `${image}?v=${sha(readFileSync(path)).slice(0, 8)}`, credit, source };
}

function parsePlace(file) {
  const [meta, body] = splitFrontMatter(readFileSync(join(dataDir, file), 'utf8'));
  const text = (key) => meta[key] ?? '';
  const fail = (message) => errors.push(`${file}: ${message}`);

  const id = Number(text('id'));
  const slug = text('slug');
  const rating = Number(text('rating'));
  const latitude = Number(text('latitude'));
  const longitude = Number(text('longitude'));
  const tags = parseList(text('tags'));
  const sections = splitSections(body);

  if (!Number.isInteger(id) || id <= 0) fail(`id 가 양의 정수가 아님 — ${text('id')}`);
  if (!/^[a-z0-9-]+$/.test(slug)) fail(`slug 형식 오류 — ${slug}`);
  if (file !== `${String(id).padStart(3, '0')}-${slug}.md`) fail('파일 이름이 id·slug 와 다름');
  for (const key of REQUIRED_TEXT) if (!text(key)) fail(`${key} 가 비어 있음`);
  if (!ISLAND_GROUPS.includes(text('island_group'))) fail(`island_group 값 오류 — ${text('island_group')}`);
  if (!CATEGORIES.includes(text('category'))) fail(`category 값 오류 — ${text('category')}`);
  if (!DIFFICULTIES.includes(text('difficulty'))) fail(`difficulty 값 오류 — ${text('difficulty')}`);
  if (tags.length < 3 || tags.length > 6) fail(`tags 는 3~6개 — ${tags.length}개`);
  if (!(rating >= 4 && rating <= 5)) fail(`rating 은 4.0~5.0 — ${text('rating')}`);
  // 필리핀 영역 (북위 4~22도, 동경 116~127도)
  if (!(latitude >= 4 && latitude <= 22)) fail(`latitude 범위 오류 — ${text('latitude')}`);
  if (!(longitude >= 116 && longitude <= 127)) fail(`longitude 범위 오류 — ${text('longitude')}`);
  if (sections.map((s) => s.title).join('|') !== SECTIONS.join('|')) fail('본문 ## 단락 제목·순서가 규격과 다름');
  for (const s of sections) if (!s.markdown) fail(`「${s.title}」 단락이 비어 있음`);
  const markdown = sections.map((s) => s.markdown).join('');
  if (markdown.includes('```')) fail('코드 블록 금지');
  if (markdown.length <= 2500) fail(`본문이 너무 짧음 — ${markdown.length}자`);

  const galleryImages = splitBar(text('gallery'));
  const galleryCredits = splitBar(text('gallery_credits'));
  const gallerySources = splitBar(text('gallery_sources'));
  if (galleryCredits.length !== galleryImages.length || gallerySources.length !== galleryImages.length) {
    fail('gallery·gallery_credits·gallery_sources 개수가 다름');
  }

  return {
    id,
    slug,
    title: text('title'),
    title_en: text('title_en'),
    tagline: text('tagline'),
    island_group: text('island_group'),
    region: text('region'),
    location: text('location'),
    category: text('category'),
    tags,
    rating,
    latitude,
    longitude,
    best_season: text('best_season'),
    duration: text('duration'),
    budget: text('budget'),
    difficulty: text('difficulty'),
    airport: text('airport'),
    summary: text('summary'),
    image: photo(file, text('image'), text('image_credit'), text('image_source')),
    gallery: galleryImages.map((image, i) => photo(file, image, galleryCredits[i] ?? '', gallerySources[i] ?? '')),
    sections,
  };
}

rmSync(join(root, '_site'), { recursive: true, force: true });
mkdirSync(join(outDir, 'images'), { recursive: true });

const files = readdirSync(dataDir).filter((name) => /^\d{3}-.+\.md$/.test(name)).sort();
const places = files.map(parsePlace).sort((a, b) => a.id - b.id);

// 겹침 검사와 본문의 다른 여행지 링크 `[**엘니도**](place:el-nido)` 검사.
const slugs = new Set(places.map((p) => p.slug));
if (places.length === 0) errors.push('여행지 파일이 하나도 없음');
if (new Set(places.map((p) => p.id)).size !== places.length) errors.push('id 가 겹치는 여행지가 있음');
if (slugs.size !== places.length) errors.push('slug 가 겹치는 여행지가 있음');
for (const place of places) {
  for (const section of place.sections) {
    for (const [, slug] of section.markdown.matchAll(/\]\(place:([a-z0-9-]+)\)/g)) {
      if (!slugs.has(slug)) errors.push(`${place.slug}: place:${slug} 링크 대상 없음`);
      if (slug === place.slug) errors.push(`${place.slug}: 자기 자신 링크`);
    }
  }
}

if (errors.length) {
  console.error(`규격 오류 ${errors.length}건 — 배포하지 않는다.\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

// version 은 내용 해시다. 사진 주소에 사진 해시가 들어 있으므로 사진만 바꿔도 version 이 바뀐다.
// README 만 고친 push 는 version 이 그대로라서 클라이언트가 다시 받지 않는다.
const version = sha(JSON.stringify(places)).slice(0, 12);
const count = places.length;
writeFileSync(join(outDir, 'places.json'), JSON.stringify({ schema: SCHEMA, version, count, places }));
writeFileSync(
  join(outDir, 'manifest.json'),
  `${JSON.stringify({ schema: SCHEMA, version, count, places: 'places.json', generated_at: new Date().toISOString() }, null, 2)}\n`,
);
console.log(`여행지 ${count}곳 → _site/v1/ (version ${version})`);
