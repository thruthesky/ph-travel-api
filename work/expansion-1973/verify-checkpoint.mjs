// 부모가 인계 검토를 끝낸 ID만 받는다. 사진 눈검수나 출처 사실 판단을 자동 완료로 바꾸지 않는다.
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {visibleText} from '../../scripts/catalog.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const work='work/expansion-1973';
const scratch='_i18n/work/expansion-1973';
const content='/Users/thruthesky/apps/skills/skills/api-skill/scripts/content.mjs';
const given=process.argv[2]??'';
if(!/^\d+(?:,\d+)*$/.test(given))throw Error('사용: node work/expansion-1973/verify-checkpoint.mjs 318,319,…');
const ids=[...new Set(given.split(',').map(Number))].sort((a,b)=>a-b);
const progress=read(work+'/progress.json');
const baseline=read(work+'/baseline.json');
const baselinePaths=new Set(baseline.files.map(x=>x.path));
const accepted=new Set([...progress.new_verified_ids,...ids]);
const files=readdirSync('data/ko').filter(x=>/^\d+-.*\.json$/.test(x));
const pending=files.filter(f=>!baselinePaths.has('data/ko/'+f));
const unknown=pending.filter(f=>!accepted.has(read('data/ko/'+f).id));
if(unknown.length)throw Error('아직 인계 검토하지 않은 완성본 존재: '+unknown.join(', '));
const actualPaths=new Set(files.map(f=>'data/ko/'+f));
const removed=[...baselinePaths].filter(p=>!actualPaths.has(p));
if(removed.length)throw Error('기준판 항목 삭제 발견: '+removed.join(', '));
const details=read('work/catalog-details.json');
const records=[];
for(const file of pending){
 const ko=read('data/ko/'+file);
 if(!existsSync('data/en/'+file)||!existsSync('sources/'+file))throw Error('한영/근거 인계 미완성: '+file);
 const en=read('data/en/'+file),source=read('sources/'+file);
 if(source.id!==ko.id||source.slug!==ko.slug||!source.facts?.length)throw Error('근거 식별 불일치: '+file);
 if(!details[ko.slug])throw Error('대장 보충 정보 필요: '+ko.slug);
 for(const p of [ko,en]){
  const highlights=p.sections.find(s=>s.key==='highlights')?.blocks?.[0]?.blocks;
  if(p.sections.length!==10||!Array.isArray(highlights)||highlights.length<6||highlights.length>8||highlights.some((c,i)=>c.number!==i+1))throw Error('단락/정수볼거리 오류: '+file);
  if([p.image,...p.gallery.items].length<10)throw Error('신규 사진 부족: '+file);
  for(const photo of [p.image,...p.gallery.items])if(!existsSync('data/'+photo.url)||!photo.credit||!photo.source)throw Error('사진/크레딧 오류: '+file);
 }
 records.push({id:ko.id,file,ko_body_characters:visibleText(ko.sections).length,en_body_characters:visibleText(en.sections).length,section_count:10,integer_highlights:ko.sections.find(s=>s.key==='highlights').blocks[0].blocks.length,photos:1+ko.gallery.items.length});
}
const fallback=read('i18n/fallbacks.json');
for(const record of records)fallback.entries[record.file]=['zh','ja','th','vi','ru','ar'];
write('i18n/fallbacks.json',fallback);
mkdirSync(scratch,{recursive:true});
const run=(args,log)=>{
 const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:20*1024*1024});
 const out=(result.stdout??'')+(result.stderr??'');
 if(log)writeFileSync(scratch+'/'+log,out);else process.stdout.write(out);
 if(result.error||result.status!==0)throw Error('명령 실패: node '+args.join(' ')+'\n'+(result.error?.message??'')+out);
};
run([content,'stamp','data/meta.json']);
run(['scripts/build.mjs'],'build-latest.log');
const manifest=read('_site/v2/manifest.json'),meta=read('data/meta.json');
if(manifest.count!==baseline.registered_count+records.length)throw Error('빌드/순증 개수 불일치');
run([content,'check','--dir','_site/v2','--allow-few-images'],'check-latest.log');
run([content,'images','--dir','_site/v2','--ids',ids.join(',')],'images-latest.log');
run(['scripts/catalog.mjs'],'catalog-latest.log');
run(['scripts/candidates.mjs'],'candidates-latest.log');
run(['scripts/audit-post-registration.mjs'],'audit-latest.log');
run(['scripts/catalog.mjs','--check'],'catalog-verify-latest.log');
run(['scripts/candidates.mjs','--check'],'candidates-verify-latest.log');
const photoLog=readFileSync(scratch+'/images-latest.log','utf8');
const tally=photoLog.match(/사진 (\d+)장 — 고칠 것 (\d+) · 먼저 볼 것 (\d+)[^\n]* · 눈으로 볼 것 (\d+) · 맞음 (\d+)/);
if(!tally||Number(tally[2])||Number(tally[3]))throw Error('사진 자동검사 결과 수동 확인 필요: '+scratch+'/images-latest.log');
const report={checked_at:new Date().toISOString(),reviewed_batch_ids:ids,baseline_registered:baseline.registered_count,registered:manifest.count,new_verified_count:records.length,remaining_new_minimum:Math.max(0,progress.required_new_minimum-records.length),version:manifest.version,data_version:meta.data_version,records,images_check:{total:+tally[1],fix:+tally[2],distant:+tally[3],visual:+tally[4],matched:+tally[5]},check:'기존120곳 사진부족만예외·신규사진10장별도검사',complete:false,note:'검사통과가전체목표완료나배포를뜻하지않음.부모가출처/사진눈검수/작업기록갱신후커밋한다.'};
write(scratch+'/checkpoint-latest.json',report);
console.log(JSON.stringify({registered:report.registered,new:report.new_verified_count,remaining:report.remaining_new_minimum,version:report.version,images_check:report.images_check},null,2));
