// 공개 본문의 명소 이름 단서를 추출한다. 조사·독립 항목 판정이나 사실 검증을 대신하지 않는다.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseTable,normalize,loadPlaces} from '../../scripts/catalog.mjs';
const root='work/expansion-1973';
const hash=s=>createHash('sha256').update(s).digest('hex');
const index=new Map(readFileSync(root+'/source-fetch-index.jsonl','utf8').trim().split('\n').filter(Boolean).map(l=>{const d=JSON.parse(l);return[d.idx,d];}));
const existing=loadPlaces().places;
const details=JSON.parse(readFileSync('work/catalog-details.json'));
const aliases=new Map();
const addAlias=(a,slug)=>{const k=normalize(a);if(k.length<3)return;if(!aliases.has(k))aliases.set(k,new Set());aliases.get(k).add(slug);};
for(const p of existing){for(const a of [p.p.title.text,p.p.title_en.text,...(details[p.p.slug]?.aliases??[])])addAlias(a,p.p.slug);}
const sources=[['work/philgo-travel-posts-before-2025-08-09.csv',','],['work/philgo-travel-posts-since-2025-08-10.tsv','\t']];
const placeWord=/해변|비치|폭포|호수|섬$|동굴|국립공원|생태공원|성당|교회|사원|박물관|미술관|건물|빌딩|광장|시장|거리|리조트|호텔|축제|수족관|동물원|교량|전망대|기념관|수목원|공항|온천|화산|\b(?:beach|island|falls|lake|river|cave|park|church|cathedral|museum|gallery|building|plaza|market|street|resort|hotel|festival|airport|springs|volcano|mount|fort|temple|sanctuary|mall|lagoon|reef|cove|bay|university|aquarium|zoo|bridge|tower)\b/iu;
const generic=/^(?:한눈에|개요|소개|목차|항목|내용|정보|위치|주소|교통|교통편|가는\s*방법|이동|운영|영업|입장|요금|가격|비용|예산|일정|추천|주의|팁|참고|준비|여행\s*팁|역사적\s*배경|역사와|역사\s*및|주요\s*명소|주요\s*시설|특징|볼거리|기본\s*정보|숙소|숙박|날씨|최적|방문|관련|추가|결론|마무리|핵심|안전|구분|출발|목적지|수단|소요|거리|시간|날짜|시기|대상|이름|연락|기타|overview|highlights|tips|getting\s*there|best\s*time|costs|itinerary|opening\s*hours|address|location|budget|transport|safety|food|accommodation)(?:\s|[:：·(]|$)/iu;
const clean=s=>s.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').replace(/^[\s#>*\-①-⑳]+/u,'').replace(/^\d{1,2}[.)]\s+/u,'').replace(/[*_`]/g,'').replace(/\s+/g,' ').trim();
const variants=s=>[s,...[...s.matchAll(/\(([^)]+)\)/g)].map(x=>x[1]),s.replace(/\s*\([^)]*\)/g,'').trim()].map(clean).filter(Boolean);
const rows=[];const posts=[];
for(const[path,sep]of sources){
 const input=parseTable(readFileSync(path,'utf8'),sep);
 for(const[rowNo,row]of input.entries()){
  const idx=String(row.idx??row['글 번호']),record=index.get(idx);const refs=new Map();
  const add=(raw,kind,line,allowPlain=false)=>{
   const name=clean(raw);if(name.length<3||name.length>140||name.split(/\s+/).length>20||generic.test(name)||/https?:|₱|\$|\d+\s*(?:페소|분|시간|원|월|일|박|명|회)|[!?。]/iu.test(name))return;
   if(!allowPlain&&!placeWord.test(name)&&!/[가-힣].*\([A-Za-z]|[A-Za-z].*\([가-힣]/u.test(name))return;
   const key=normalize(name);if(!key)return;
   if(!refs.has(key))refs.set(key,{name,variants:variants(name),provenance:[]});refs.get(key).provenance.push({kind,line});
  };
  const primary=row.name_ko??row['여행명소 이름'];if(primary)add(primary,'input_name',rowNo+2,true);
  let body='';if(record?.status==='fetched'){
   const bytes=readFileSync(record.cache);if(hash(bytes)!==record.cache_sha256)throw Error('본문 캐시 변경:'+idx);
   const d=JSON.parse(bytes);body=d.content.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/giu,(_,n,s)=>'\n'+'#'.repeat(+n)+' '+s+'\n').replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/giu,'**$1**').replace(/<br\s*\/?\s*>|<\/p>|<\/div>/giu,'\n');
   for(const[n,line]of body.split('\n').entries()){
    if(/^\s*#{2,6}\s+/u.test(line))add(line,'body_heading',n+1);
    const bold=line.match(/^\s*(?:[-*]|\d+[.)])?\s*\*\*([^*]+)\*\*/u);if(bold)add(bold[1],'body_lead_bold',n+1);
    if(/^\s*\|/u.test(line)){
     const cells=line.trim().split('|').slice(1,-1).map(clean);if(cells.length>1){
      add(cells[0],'table_first_cell',n+1);
      if(/^(?:주요\s*명소|대표\s*명소|인근\s*명소|함께\s*갈\s*곳|주변\s*명소)$/u.test(cells[0]))for(const part of cells[1].split(/[,;·]/u))add(part,'table_place_list',n+1);
     }
    }
   }
  }
  for(const item of refs.values()){
   const matched=new Set(item.variants.flatMap(v=>[...(aliases.get(normalize(v))??[])]));
   rows.push({candidate_id:hash(idx+'\0'+normalize(item.name)).slice(0,20),post_id:idx,input_path:path,input_row:rowNo+2,input_area:row.area??row['지역']??'',...item,exact_name_matches:[...matched],review_status:matched.size?'이름일치·범위확인필요':'독립여행지여부·실재·중복·사진조사필요'});
  }
  posts.push({post_id:idx,input_path:path,input_row:rowNo+2,fetch_status:record?.status??'pending',body_characters:record?.content_characters??0,candidate_mentions:refs.size,manual_review_complete:false});
 }
}
const groups=new Map();for(const row of rows){const key=normalize(row.name);if(!groups.has(key))groups.set(key,{name:row.name,mention_ids:[],post_ids:new Set(),exact_name_matches:new Set(),kinds:new Set()});const g=groups.get(key);g.mention_ids.push(row.candidate_id);for(const p of row.provenance)g.kinds.add(p.kind);g.post_ids.add(row.post_id);for(const s of row.exact_name_matches)g.exact_name_matches.add(s);}
const grouped=[...groups.values()].map(x=>({...x,post_ids:[...x.post_ids],exact_name_matches:[...x.exact_name_matches],kinds:[...x.kinds],review_status:'자동 이름 묶음이며 동명이소·복합이름 분리 검토 필요'}));
const shortlist=grouped.filter(x=>!x.exact_name_matches.length&&placeWord.test(x.name)&&x.name.length<=85&&x.kinds.includes('body_heading')&&/\([A-Za-z][A-Za-z \-’.&]+\)/u.test(x.name)&&!/(?:한눈에|가이드|기본 정보|방법|소요|운영 시간|영업 시간|입장료|예산|추천 일정|여행 팁|주의사항)/u.test(x.name)).sort((a,b)=>b.post_ids.length-a.post_ids.length);
writeFileSync(root+'/body-candidate-priority-review.jsonl',shortlist.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(root+'/body-candidate-mentions.jsonl',rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(root+'/body-candidate-name-groups.jsonl',grouped.map(x=>JSON.stringify(x)).join('\n')+'\n');
writeFileSync(root+'/post-body-review.jsonl',posts.map(x=>JSON.stringify(x)).join('\n')+'\n');
const summary={generated_at:new Date().toISOString(),input_posts:posts.length,body_posts:posts.filter(x=>x.fetch_status==='fetched').length,candidate_mentions:rows.length,automatic_name_groups:grouped.length,groups_with_exact_name_match:grouped.filter(x=>x.exact_name_matches.length).length,groups_without_exact_name_match:grouped.filter(x=>!x.exact_name_matches.length).length,priority_review_name_groups:shortlist.length,registered_places_at_scan:existing.length,manual_reviews_complete:0,registration_complete:false,limitations:['명칭이 있는 제목·강조·표 위주의 자동 추출이며 서술문 속 모든 고유명사를 식별한 결과가 아니다.','자동 후보에는 음식·일반명사·오류·복합명칭이 포함될 수 있다. 존재나 미등록 독립명소로 확정하지 않는다.','동일 철자의 장소도 동명이소일 수 있으며 같은 도시 안내에 언급돼도 하위 명소가 독립 수록된 것은 아니다.','공개 차단·삭제·빈 본문은 별도 상태로 보존한다. 공개 본문 원문은 _i18n의 비커밋 캐시에만 둔다.']};
writeFileSync(root+'/body-candidate-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(summary);
