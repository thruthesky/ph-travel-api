// 원본 목록의 공개 글을 재개 가능한 캐시로 읽는다. 회원·댓글 필드는 보관하지 않는다.
import {readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseTable} from '../../scripts/catalog.mjs';

const work='work/expansion-1973';
const cache='_i18n/work/expansion-1973/posts';
mkdirSync(cache,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const sources=[['work/philgo-travel-posts-before-2025-08-09.csv',','],['work/philgo-travel-posts-since-2025-08-10.tsv','\t']];
const inputs=[];const posts=[];
for(const[path,separator]of sources){
 const raw=readFileSync(path,'utf8');const rows=parseTable(raw,separator);
 inputs.push({path,sha256:hash(raw),rows:rows.length});
 for(const[r,row]of rows.entries())posts.push({idx:String(row.idx??row['글 번호']),source:path,row:r+2,deleted:row['삭제']==='삭제',title:row['제목']??row.name_ko,category:row.category??row['분류']});
}
if(posts.length!==1541||new Set(posts.map(x=>x.idx)).size!==1541)throw Error('원본1541행/고유글번호 불일치');
const prior=new Map();
function collect(dir){
 if(!existsSync(dir))return;
 for(const e of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,e.name);
  if(e.isDirectory()&&!/originals|assets|validation|held-/.test(e.name))collect(p);
  else if(e.isFile()&&/post.*\.json$|original-post.*\.json$/.test(e.name)){
   try{const d=JSON.parse(readFileSync(p,'utf8'));if(d.idx&&typeof d.content==='string'&&d.content)prior.set(String(d.idx),{d,path:p});}catch{}
  }
 }
}
collect('_i18n/work/parallel-1992');collect('_i18n/work/expansion-2000');
const results=new Map();let attempts=0;let next=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const indexPath=join(work,'source-fetch-index.jsonl');
if(existsSync(indexPath))for(const line of readFileSync(indexPath,'utf8').trim().split('\n')){try{const d=JSON.parse(line);results.set(String(d.idx),d);}catch{}}
const save=d=>{results.set(d.idx,d);appendFileSync(indexPath,JSON.stringify(d)+'\n');};
function summary(){
 const rows=posts.map(p=>results.get(p.idx));const counts={};for(const r of rows)counts[r?.status??'pending']=(counts[r?.status??'pending']??0)+1;
 const s={checked_at:new Date().toISOString(),inputs,total_posts:posts.length,counts,http_attempts_this_run:attempts,complete:rows.every(r=>r&&['fetched','fetched_empty','deleted_in_input','public_unavailable'].includes(r.status)),note:'공개 본문 수집 완료와 미수록 명소 검증·등록 완료는 다르다. 원문은 조사 단서이며 사실 근거가 아니다.'};
 writeFileSync(join(work,'source-fetch-summary.json'),JSON.stringify(s,null,2)+'\n');return s;
}
async function processPost(p){
 const file=join(cache,p.idx+'.json');
 if(existsSync(file)){
  const raw=readFileSync(file);const d=JSON.parse(raw);save({...p,status:d.content?'fetched':'fetched_empty',cache:file,cache_sha256:hash(raw),content_characters:d.content?.length??0,checked_at:new Date().toISOString(),reused_cache:true});return;
 }
 if(p.deleted){save({...p,status:'deleted_in_input',checked_at:new Date().toISOString()});return;}
 if(prior.has(p.idx)){
  const{d,path}=prior.get(p.idx);const safe={idx:p.idx,subject:d.subject??'',content:d.content,source_url:`https://www.philgo.com/?module=post&action=view&idx=${p.idx}`,cache_origin:path};const raw=JSON.stringify(safe,null,2)+'\n';writeFileSync(file,raw);save({...p,status:'fetched',cache:file,cache_sha256:hash(raw),content_characters:safe.content.length,checked_at:new Date().toISOString(),reused_cache:true});return;
 }
 const url=`https://www.philgo.com/api.php?method=post.get&idx=${p.idx}`;
 let error='';
 for(let attempt=0;attempt<3;attempt++){
  try{
   attempts++;const r=await fetch(url,{headers:{'User-Agent':'ph-travel-api content research/1.0'},signal:AbortSignal.timeout(30000)});
   if(!r.ok)throw Error(`HTTP ${r.status}`);
   const d=await r.json();
   if(d.success===false&&d.message==='해당 게시글을 찾을 수 없습니다.'){
    save({...p,status:'public_unavailable',message:d.message,checked_at:new Date().toISOString()});return;
   }
   if(typeof d.content!=='string'&&typeof d.subject!=='string')throw Error('공개 제목/본문 필드 없음');
   const safe={idx:p.idx,subject:d.subject??'',content:d.content??'',source_url:`https://www.philgo.com/?module=post&action=view&idx=${p.idx}`,retrieved_at:new Date().toISOString()};const raw=JSON.stringify(safe,null,2)+'\n';writeFileSync(file,raw);
   save({...p,status:safe.content?'fetched':'fetched_empty',cache:file,cache_sha256:hash(raw),content_characters:safe.content.length,checked_at:safe.retrieved_at});return;
  }catch(e){error=String(e.message).slice(0,150);if(attempt<2)await sleep(2000*(attempt+1));}
 }
 save({...p,status:'fetch_failed',error,checked_at:new Date().toISOString()});
}
const pending=posts.filter(p=>{
 const r=results.get(p.idx);
 if(!r||r.status==='fetch_failed')return true;
 return ['fetched','fetched_empty'].includes(r.status)&&!existsSync(join(cache,p.idx+'.json'));
});
async function worker(){
 while(next<pending.length){const p=pending[next++];await processPost(p);if(next%25===0){const s=summary();console.log(JSON.stringify({scheduled:next,pending_this_run:pending.length,total:posts.length,counts:s.counts}));}await sleep(500);}
}
console.log(JSON.stringify({event:'수집 시작',total:posts.length,pending_this_run:pending.length,reusable_cache:prior.size}));
await Promise.all([worker(),worker()]);console.log(JSON.stringify(summary()));
