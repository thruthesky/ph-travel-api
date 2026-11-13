// 두 전체 게시글 목록을 현재 한국어 원본·대장·공개판과 대조한다.
// 기존 목록의 판정은 단서로 보존하고 자동 검색 실패를 확정 미수록으로 바꾸지 않는다.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { csvText, parseTable, loadPlaces, normalize, visibleText } from './catalog.mjs';

const dir = 'work';
const cache = '_i18n/work/registration-audit';
mkdirSync(cache, { recursive: true });
const { places } = loadPlaces();
const byId = new Map(places.map(x => [String(x.p.id), x]));
const bySlug = new Map(places.map(x => [x.p.slug, x]));
const unique = a => [...new Set(a.filter(Boolean))];
const readTable = (path, sep = ',') => parseTable(readFileSync(path, 'utf8'), sep);
const namesFor = (ko, en = '') => unique([ko, en,
  // 괄호 안이 한국어 핵심 명소명인 옛 복합 이름은 함부로 줄이지 않는다.
  ...(!/\([^)]*[가-힣]/.test(ko) ? [ko.replace(/\s*\([^)]*\)/g, '').trim()] : []),
  en.replace(/\s*\([^)]*\)/g, '').trim(),
  // 영문 이름 뒤 쉼표로 덧붙인 행정 위치를 제거한 이름도 대조한다.
  ...(en.includes(',') ? [en.split(',')[0].replace(/\s*\([^)]*\)/g, '').trim()] : []),
]);
const index = new Map();
for (const x of places) for (const n of x.names.flatMap(n => namesFor(n))) {
  const key = normalize(n);
  if (key.length < 2) continue;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(x.p.slug);
}
const annotation = new Map();
for (const [path, sep] of [[`${dir}/philgo-travel-posts-not-in-api-since-2025-08-10.tsv`, '\t'], [`${dir}/philgo-travel-posts-not-in-api.csv`, ',']]) {
  for (const row of readTable(path, sep)) for (const id of row['글 번호'].match(/\d+/g) ?? []) {
    if (!annotation.has(id)) annotation.set(id, []);
    annotation.get(id).push(row);
  }
}
const raw = [];
const inputs = [
  [`${dir}/philgo-travel-posts-before-2025-08-09.csv`, ','],
  [`${dir}/philgo-travel-posts-since-2025-08-10.tsv`, '\t'],
];
const snapshots = inputs.map(([path, sep]) => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), rows: readTable(path, sep).length }));
for (const [path, sep] of inputs) for (const [i, r] of readTable(path, sep).entries()) {
  const recent = Boolean(r.idx);
  raw.push({ source: path, row: i + 2, id: r.idx ?? r['글 번호'], date: r.date ?? r['날짜'],
    kind: r.kind ?? r['분류'], category: r.category ?? r['분류'], area: r.area ?? r['지역'],
    ko: r.name_ko ?? r['여행명소 이름'], en: r.name_en ?? '', title: r['제목'] ?? r.name_ko,
    length: Number(r.content_len ?? r['본문 글자 수']), deleted: r['삭제'] === '삭제',
    oldMatch: r.api_match ?? r['ph-travel-api 항목'], dup: r.dup ?? '', note: r.note ?? '', recent });
}
if (new Set(raw.map(r => r.id)).size !== raw.length) throw new Error('원본 간 중복 글 번호: 합산 전에 검토 필요');

// 실제 확인한 다른 표기를 추가할 수 있는 별도 파일이다. 자동 유사도는 수록 확정에 쓰지 않는다.
const overrides = existsSync(`${dir}/registration-audit-overrides.json`) ? JSON.parse(readFileSync(`${dir}/registration-audit-overrides.json`)) : {};
const remoteSnapshot = JSON.parse(readFileSync(`${dir}/registration-public-snapshot.json`));
const remoteManifest = remoteSnapshot;
const remote = new Set(remoteSnapshot.slugs);
if (remote.size !== remoteManifest.count) throw new Error('공개판 스냅샷 개수 불일치');
const bodies = places.map(x => ({ slug: x.p.slug, body: normalize(visibleText(x.p.sections)) }));

for (const r of raw) {
  const notes = annotation.get(r.id) ?? [];
  const override = overrides[r.id] ?? {};
  const annotationNames = notes.map(n => n['여행명소 이름']).filter(Boolean);
  // 옛 목록의 '누에바에시하(판타방안 호수)'를 '누에바에시하'로 줄이면
  // 다른 항목의 주 이름까지 호수 언급으로 오판한다. 상세 후보명이 있으면 우선한다.
  const searchNames = unique([
    ...(override.names ?? (!r.recent && annotationNames.length ? annotationNames.flatMap(n => namesFor(n)) : namesFor(r.ko, r.en))),
  ]);
  let direct = unique(searchNames.flatMap(n => index.get(normalize(n)) ?? []));
  if (override.direct !== undefined) direct = override.direct;
  if (direct.some(s => !bySlug.has(s))) throw new Error(`${r.id}: 없는 독립 항목`);
  const named = Boolean(r.ko || r.en);
  const broad = !r.recent && /\(전체\)| 주$| 지방$|축제 전반|북부 루손 일주|전통 음식 레촌|술루·홀로·마라위·소크사르젠/.test(r.ko);
  const subject = override.subject ?? (r.recent ? r.kind === '명소' : named && !broad && !['질문·동행', '공지·잡담·기타', '여행 준비·일반 정보', '필리핀 외'].includes(r.kind));
  const priorMissing = notes.some(n => /없음|언급만/.test(n['API 상태']));
  const priorCovered = notes.filter(n => n['API 상태'] === '기존 항목이 다룸');
  const linked = unique([
    ...r.oldMatch.split(/[,;|·\s]+/).flatMap(s => bySlug.has(s.replace(/^\d+-/, '')) ? [s.replace(/^\d+-/, '')] : byId.has(String(Number(s))) ? [byId.get(String(Number(s))).p.slug] : []),
    ...notes.flatMap(n => { const m = (n['1차 결과(2026-11-13)'] ?? '').match(/^(\d+) 추가/); return m && byId.has(String(Number(m[1]))) ? [byId.get(String(Number(m[1]))).p.slug] : []; }),
    ...priorCovered.flatMap(n => (n['관련 API 항목']?.match(/\d+/g) ?? []).flatMap(id => byId.has(String(Number(id))) ? [byId.get(String(Number(id))).p.slug] : [])),
    ...(override.covered ?? []),
  ]).filter(s => !direct.includes(s));
  const priorMentions = notes.filter(n => /언급만/.test(n['API 상태'])).flatMap(n =>
    unique([...(n['관련 API 항목']?.match(/\d+/g) ?? []), ...[...(n['비고'] ?? '').matchAll(/\((\d{3,})\)/g)].map(m => m[1])])
      .flatMap(id => byId.has(String(Number(id))) ? [byId.get(String(Number(id))).p.slug] : []));
  const mentions = unique([...bodies.filter(x => searchNames.some(n => normalize(n).length >= 4 && x.body.includes(normalize(n)))).map(x => x.slug), ...priorMentions]).filter(s => !direct.includes(s));
  r.mentionEvidence = unique([
    bodies.some(x => searchNames.some(n => normalize(n).length >= 4 && x.body.includes(normalize(n)))) ? '현재 본문 문자열 검색' : '',
    priorMentions.length ? '이전 팀의 언급 판정·연결 번호' : '',
    override.mentions ? '개별 검토 규칙' : '',
  ]).join(' | ');
  r.direct = direct;
  r.linked = linked;
  r.mentions = override.mentions ?? mentions;
  r.subject = subject;
  r.annotation = unique(notes.map(n => [n['API 상태'], n['1차 결과(2026-11-13)'], n['비고']].filter(Boolean).join(': '))).join(' | ');
  r.block = override.block ?? unique(notes.map(n => n['1차 결과(2026-11-13)']).filter(n => /보류|폐쇄/.test(n ?? ''))).join(' | ');
  r.status = direct.length ? '독립 항목 수록' : !subject ? '일반·광역·기타 글' : linked.length && (!priorMissing || priorCovered.length || notes.some(n => /^\d+ 추가/.test(n['1차 결과(2026-11-13)'] ?? '')) || override.covered) ? '기존 항목 연결·범위 검토' : r.mentions.length ? '본문 언급·독립 항목 미확인' : '이름 검색 미검출·미수록 후보';
  if (override.status) r.status = override.status;
  r.review = override.note ?? (r.status === '이름 검색 미검출·미수록 후보' ? '이름·별칭·본문 자동 대조에서 찾지 못함. 오기·동의어·같은 지역의 다른 장소 여부를 조사해야 신규 확정 가능.' : r.status === '본문 언급·독립 항목 미확인' ? '단순 언급과 실제 상세 설명을 구분한 뒤 독립 항목 필요성을 검토.' : r.status === '기존 항목 연결·범위 검토' ? '원본 목록의 API 연결 또는 이전 추가 결과가 있음. 같은 곳의 다른 표기인지, 별도 하위 명소인지 검토.' : r.status === '일반·광역·기타 글' ? '지역 개요·일정·교통·질문·홍보 등은 개별 여행지 수와 구분. 필요한 정보는 기존 항목 보강에 활용 가능.' : '현재 원본의 독립 항목 이름·별칭 일치 또는 개별 검토로 확인.');
  r.candidate = ['본문 언급·독립 항목 미확인', '이름 검색 미검출·미수록 후보'].includes(r.status);
  r.priority = override.priority ?? '';
  r.business = /리조트|숙소|식당|맛집|음식|쇼핑|밤문화|스파/.test(r.category) || /호텔|리조트|쌀국수집/.test(r.ko);
}

// 같은 이름 또는 원본이 지정한 중복 링크만 합친다. 764라는 이전 추정에 맞춰 묶지 않는다.
const parent = new Map(raw.filter(r => r.subject).map(r => [r.id, r.id]));
function find(id) { let p = parent.get(id); if (p !== id) { p = find(p); parent.set(id, p); } return p; }
function union(a, b) { if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b)); }
const last = new Map();
for (const r of raw.filter(r => r.subject)) {
  const keys = unique([normalize(overrides[r.id]?.group ?? (r.en || r.ko)), normalize(r.ko), normalize(r.en)]);
  for (const key of keys) {
    if (last.has(key)) union(r.id, last.get(key));
    last.set(key, r.id);
  }
  for (const id of r.dup.match(/\d{5,}/g) ?? []) union(r.id, id);
}
const groups = new Map();
for (const r of raw.filter(r => r.subject)) {
  const key = find(r.id); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r);
}
// 한 묶음 안에 수록 증거가 있으면 전파하되, 모든 구성 글을 같은 내용이라고 주장하지 않는다.
for (const members of groups.values()) {
  const direct = unique(members.flatMap(r => r.direct));
  if (direct.length) for (const r of members.filter(r => !r.direct.length)) {
    r.direct = direct; r.status = '독립 항목 수록'; r.candidate = false;
    r.review = '동일 이름/원본 중복 링크로 묶인 다른 글에서 독립 수록 확인. 개별 글 내용 전체가 반영되었다는 뜻은 아님.';
  }
}
const headers = ['원본 파일', '원본 행', '글 번호', '날짜', '종류', '분류', '지역', '이름', '영문 이름', '제목', '본문 글자 수', '삭제 표시', '원본 API 연결', '현재 대조 상태', '독립 수록 API', '기존 연결 API', '본문 언급 API', '독립 수록 공개 여부', '미수록 후보', '기존 보류 기록', '이전 판정', '판정 근거·다음 할 일', '글 URL', '본문 대조 근거', '우선 검토'];
const rowFor = r => ({ '원본 파일': r.source, '원본 행': r.row, '글 번호': r.id, '날짜': r.date, '종류': r.kind, '분류': r.category, '지역': r.area, '이름': r.ko, '영문 이름': r.en, '제목': r.title, '본문 글자 수': r.length, '삭제 표시': r.deleted ? '삭제' : '', '원본 API 연결': r.oldMatch, '현재 대조 상태': r.status, '독립 수록 API': r.direct.join(' | '), '기존 연결 API': r.linked.join(' | '), '본문 언급 API': r.mentions.join(' | '), '독립 수록 공개 여부': r.direct.length ? r.direct.every(s => remote.has(s)) ? '공개판에도 있음' : r.direct.some(s => remote.has(s)) ? '일부 로컬에만 있음' : '로컬에만 있음·미배포' : '', '미수록 후보': r.candidate ? '예' : '', '기존 보류 기록': r.block, '이전 판정': r.annotation, '판정 근거·다음 할 일': r.review, '글 URL': `https://www.philgo.com/?module=post&action=view&idx=${r.id}` });
const completeRow = r => ({ ...rowFor(r), '본문 대조 근거': r.mentionEvidence, '우선 검토': r.priority });
writeFileSync(`${dir}/philgo-registration-audit.csv`, csvText(headers, raw.map(completeRow)));
const candidates = [...groups.values()].map(g => g.filter(r => r.candidate)).filter(g => g.length).map(g => {
  const best = [...g].sort((a, b) => b.length - a.length)[0];
  const row = completeRow(best);
  return { ...row, '글 번호': g.map(r => r.id).join('|'), '원본 파일': unique(g.map(r => r.source)).join(' | '), '이름': unique(g.map(r => r.ko)).join(' | '), '영문 이름': unique(g.map(r => r.en)).join(' | '), '원본 글 수': g.length, '본문 글자 수': Math.max(...g.map(r => r.length)), '분류': unique(g.map(r => r.category)).join(' | '), '현재 대조 상태': unique(g.map(r => r.status)).join(' | '), '기존 보류 기록': unique(g.map(r => r.block)).join(' | '), '본문 언급 API': unique(g.flatMap(r => r.mentions)).join(' | '), '개별 업소 성격': g.some(r => r.business) ? '적합성 검토' : '', '삭제 원문 포함': g.some(r => r.deleted) ? '원문 재활용 대신 재조사' : '', '글 URL': g.map(r => `https://www.philgo.com/?module=post&action=view&idx=${r.id}`).join(' | '), '우선 검토': unique(g.map(r => r.priority)).join(' | '), '본문 대조 근거': unique(g.map(r => r.mentionEvidence)).join(' | ') };
}).sort((a, b) => b['본문 글자 수'] - a['본문 글자 수']);
const ch = [...headers.slice(0, 11), '원본 글 수', ...headers.slice(11), '개별 업소 성격', '삭제 원문 포함'];
writeFileSync(`${dir}/philgo-unregistered-places.csv`, csvText(ch, candidates));
const counts = rows => Object.fromEntries(unique(rows.map(r => r.status)).sort().map(s => [s, rows.filter(r => r.status === s).length]));
const summary = { checked_at: new Date().toISOString(), inputs: snapshots, total_posts: raw.length, local_count: places.length,
  public: { version: remoteManifest.version, count: remoteManifest.count, generated_at: remoteManifest.generated_at, checked_at: remoteSnapshot.checked_at },
  local_only: places.filter(x => !remote.has(x.p.slug)).map(x => ({ id: x.p.id, slug: x.p.slug, name: x.p.title.text })),
  by_source: inputs.map(([source]) => { const rows = raw.filter(r => r.source === source); return { source, count: rows.length, named: rows.filter(r => r.ko || r.en).length, deleted: rows.filter(r => r.deleted).length, min_date: rows.map(r => r.date).sort()[0], max_date: rows.map(r => r.date).sort().at(-1), statuses: counts(rows), candidates: rows.filter(r => r.candidate).length }; }),
  statuses: counts(raw), candidate_posts: raw.filter(r => r.candidate).length, candidate_groups: candidates.length,
  candidate_groups_without_mention: candidates.filter(r => r['현재 대조 상태'] === '이름 검색 미검출·미수록 후보').length,
  candidate_groups_with_mention: candidates.filter(r => r['본문 언급 API']).length,
  candidate_groups_business: candidates.filter(r => r['개별 업소 성격']).length,
  candidate_groups_with_hold: candidates.filter(r => r['기존 보류 기록']).length,
};
writeFileSync(`${cache}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
writeFileSync(`${dir}/registration-audit-summary.json`, JSON.stringify(summary, null, 2) + '\n');
writeFileSync(`${cache}/rows.json`, JSON.stringify(raw, null, 2) + '\n');
if (Object.values(summary.statuses).reduce((a, b) => a + b, 0) !== raw.length) throw new Error('전체 상태 집계 불일치');
if (candidates.reduce((n, r) => n + r['원본 글 수'], 0) !== summary.candidate_posts) throw new Error('후보 글 수 집계 불일치');
if (candidates.flatMap(r => r['글 번호'].split('|')).some(id => !raw.some(r => r.id === id && r.candidate))) throw new Error('비후보 글이 후보 목록에 섞임');
console.log(JSON.stringify({ ...summary, local_only: summary.local_only.length }, null, 2));

const statuses = ['독립 항목 수록', '기존 항목 연결·범위 검토', '본문 언급·독립 항목 미확인', '이름 검색 미검출·미수록 후보', '일반·광역·기타 글'];
const before = summary.by_source[0], after = summary.by_source[1];
const priority = candidates.filter(r => r['우선 검토']);
const md = s => String(s).replaceAll('|', ' / ').replaceAll('\n', ' ');
const report = [
  '# 필고 원본 글의 API 수록 대조', '',
  `확인: ${summary.checked_at}. 현재 로컬 한국어 원본 ${places.length}건, 공개판 ${remote.size}건.`, '',
  '## 원본 건수', '',
  '| 원본 | 글 수 | 실제 파일의 날짜 범위 | 삭제 표시 |', '|---|---:|---|---:|',
  ...summary.by_source.map(x => `| [${x.source.split('/').at(-1)}](${x.source.split('/').at(-1)}) | ${x.count} | ${x.min_date} ~ ${x.max_date} | ${x.deleted} |`),
  `| 합계 | ${raw.length} | 두 파일 사이 글 번호 중복 없음 | ${before.deleted + after.deleted} |`, '',
  '글 1건은 여행지 1곳과 다르다. 같은 곳의 중복 글, 여러 명소를 다룬 글, 지역 개요·일정·교통·질문 등이 섞여 있다. 이후 파일의 원래 kind 분류는 명소850·지역가이드140·전국정보88·일정43·교통21·사용자글11이다. 명소로 분류된 글 중에도 식당 종합목록·일정·교통 안내가 있어 개별 검토했다.', '',
  '## 글 기준 대조 결과', '',
  '| 현재 판정 | 이전 글 | 이후 글 | 합계 |', '|---|---:|---:|---:|',
  ...statuses.map(s => `| ${s} | ${before.statuses[s] ?? 0} | ${after.statuses[s] ?? 0} | ${summary.statuses[s] ?? 0} |`),
  `| 합계 | ${before.count} | ${after.count} | ${raw.length} |`, '',
  `**미수록 조사 후보는 ${summary.candidate_posts}개 글(이전${before.candidates}·이후${after.candidates})이다. 이름·원본 중복 연결·개별 검토 규칙으로 ${summary.candidate_groups}묶음으로 추렸다.**`, '',
  `이 중 ${summary.candidate_groups_without_mention}묶음은 이름 검색에서 미검출됐고, 나머지는 본문 언급 또는 이전 팀의 언급 판정이 있다. 개별 업소 성격 검토 표시는 ${summary.candidate_groups_business}묶음, 이전 보류·제외 기록 표시는 ${summary.candidate_groups_with_hold}묶음이다. 이 두 표시는 서로 겹칠 수 있다.`, '',
  `**후보 ${summary.candidate_groups}묶음은 검증 완료된 독립 여행지 수가 아니다.**`,
  '다른 이름의 같은 곳이 남을 수 있고, 같은 이름의 다른 지역 명소도 원문 위치 확인이 필요하다. 이전 팀의764곳은 이후 명소850글만 의미별로 묶은 값이고, 이번 값은 이전 글까지 포함한 미수록 검토 집합이라 기준이 다르다. 기존 항목 연결317글은 이미 완전히 반영됐다고 확정하지도, 신규 후보라고 확정하지도 않았다.', '',
  '## 등록되지 않은 이유', '',
  '1. **원본 CSV·TSV와 data.csv가 자동 등록 입력이 아니다.** `scripts/build.mjs`는 `data/ko/`와 번역 폴더의 여행지 JSON을 읽는다. `scripts/catalog.mjs`는 JSON에서 data.csv를 만드는 반대 방향의 도구다. 표에 후보를 적거나 이름을 추가해도 여행지 JSON이 생성되지 않는다.',
  '2. **기존 후보 도구는 두 전체 원본을 읽지 않았다.** `scripts/candidates.mjs`의 입력은 이미 추려진 이후 후보606행과 이전 후보76행이다. 사용자가 지목한 이전388글·이후1153글을 한 번에 대조하는 도구가 아니었다. 이번에 별도 전체 대조 도구를 만들었다. 이 자체가 원문 누락의 확정 원인이라는 뜻은 아니며 이전 도구의 조사 범위가 다르다는 뜻이다.',
  '3. **후보 발견 이후의 개별 가공이 끝나지 않았다.** 새 항목에는 위치·동의어 대조, 최신 출처, 사진10장, 한국어 본문,7개 번역,10개 섹션과 빌드 검사가 필요하다. 이번 표만으로 모든 후보의 사진 수나 운영 상태를 판단할 수 없다. 개별 보류 기록이 없는 항목은 일괄적으로 사진 부족이라고 설명하지 않는다.',
  '4. **이미 다루는 곳과 독립 항목이 없는 하위 명소가 섞여 있다.** 핀토 미술관은117, 마인드 뮤지엄은006 본문에 있다. 반면 옛 베니스 몰·라이트 공원·말라이발라이 글은 이후274·275·292에 수록됐으므로 오래된 없음 판정을 갱신했다. 검은 나사렛 축제는101의 트라슬라시온 표기를 확인해 단순 미검출에서 언급 후보로 고쳤다.',
  '5. **개별 보류·특정 실패 사유가 있다.** 마타붕카이8장·카티바와산7장·클라우드9 새 타워1장·날루수안/힐루퉁안 등 사진 부족, 사그바얀의 과거 폐쇄 조사, 잠보앙가 관련 이전 제외 기록이 있다. 이는 과거 작업 기록이며 현재 운영·경보를 이번에 새로 검증한 결과는 아니다. 필리핀 민속촌·피나모앙 폭포·CWC 클락은 장소 특정부터 검토해야 한다.',
  `6. **로컬 수록과 공개 배포가 다르다.** 공개 manifest와 한국어 파일을 읽어 확인한 판은 ${remoteManifest.count}건·version ${remoteManifest.version}·생성${remoteManifest.generated_at}이다. 로컬${places.length}건 중${summary.local_only.length}건은 공개판에 없다. 이전 추가 작업이 로컬 커밋까지만 끝났기 때문이다. AGENTS 지침상 배포는 사용자 요청 시에만 한다. 이번 분석은 배포하지 않았다.`, '',
  '## 추린 목록', '',
  '- [전체1541글 대조 CSV](philgo-registration-audit.csv): 글마다 원본 연결, 현재 판정, 실제 수록 slug, 본문 언급 근거, 공개 여부와 다음 작업.',
  `- [미수록 조사 후보 CSV](philgo-unregistered-places.csv): ${summary.candidate_posts}글을 ${summary.candidate_groups}묶음으로 압축. 기존 수록·일반 글을 제외했으며 ${priority.length}개 우선 재조사 묶음을 표시했다.`,
  '- [집계와 원본 SHA256](registration-audit-summary.json), [개별 검토 규칙](registration-audit-overrides.json), [공개판 스냅샷](registration-public-snapshot.json).', '',
  '| 먼저 검토할 후보 | 글 번호 | 최장 본문 | 대조 상태 |', '|---|---|---:|---|',
  ...priority.map(r => `| ${md(r['이름'])} | ${md(r['글 번호'])} | ${r['본문 글자 수']}자 | ${md(r['현재 대조 상태'])} |`), '',
  '이 우선순위는 제목·본문 길이·독립 방문 주제를 기준으로 한 조사 순서다. 사진10장과 현재 운영 검증을 끝냈다는 뜻은 아니다.', '',
  '## 로컬에는 있고 공개판에 없는 항목', '',
  ...summary.local_only.map(x => `- ${x.id} ${x.name} (${x.slug})`), '',
  '## 재현과 한계', '',
  '```bash', 'node scripts/audit-post-registration.mjs', '```', '',
  '원본 두 파일은 수정하지 않았다. 원본 행 번호는 헤더를 포함한 논리적 레코드 번호다. 전체 원문 본문을 다시 내려받은 분석이 아니라 목록의 이름·분류·글번호와 현재 API본문·대장·이전 작업 기록을 대조했다. 따라서 본문 문자열 미검출은 확정 부재가 아니다.',
  '공개판은 기록된 확인시각의 스냅샷을 재사용한다. 재조사 시 공개manifest와한국어파일의version/count를함께확인해스냅샷을갱신해야한다. 동의어·복합 장소는 검토 규칙 파일에서 글 번호별로 보정하고 다시 실행한다. API콘텐츠와 data_version은이번분석에서바꾸지않았다.', '',
].join('\n');
writeFileSync(`${dir}/philgo-registration-audit.md`, report);
