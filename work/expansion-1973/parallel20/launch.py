"""사용자 요청에 따른 원문 분석용 Codex CLI 20개를 별도 결과 경로로 실행한다."""
import json,pathlib,subprocess,datetime,sys
R=pathlib.Path.cwd();P=R/'_i18n/work/expansion-1973/parallel20';W=R/'work/expansion-1973/parallel20';P.mkdir(parents=True,exist_ok=True)
index=[json.loads(x)for x in (R/'work/expansion-1973/source-fetch-index.jsonl').read_text().splitlines()if x.strip()];byid={str(x['idx']):x for x in index}
posts=[]
for f in sorted((R/'_i18n/work/expansion-1973/posts').glob('*.json')):
 d=json.loads(f.read_text());body=d.get('content','')
 if body and body.strip():posts.append((f,d))
places=[]
for f in sorted((R/'data/ko').glob('*.json')):
 d=json.loads(f.read_text());places.append({'id':d['id'],'slug':d['slug'],'ko':d['title']['text'],'en':d['title_en']['text'],'location':d['location']['text']})
(P/'registered.json').write_text(json.dumps(places,ensure_ascii=False,indent=2)+'\n')
manifest={'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':'입력 두파일의 공개 원문 전체를20등분하여 사람이름·가짜지명·중복을검토하고미수록여행지후보추출.추출은등록완료가아님.','registered_snapshot':len(places),'body_count':len(posts),'parallel_cli_count':20,'jobs':[]}
for i in range(20):
 name=f'part-{i+1:02d}';dst=P/name;dst.mkdir(exist_ok=True);chunk=posts[i::20];rows=[]
 for f,d in chunk:
  idx=str(d.get('idx',f.stem));source=byid.get(idx,{})
  rows.append({'idx':idx,'subject':d.get('subject',''),'original_input':source.get('source'),'original_row':source.get('row'),'body':d['content']})
 (dst/'input.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n'for x in rows))
 prompt=f'''당신은 사용자 지시로 동시에 실행되는20명 분석가 중 {i+1}번이다. 모든 설명/작업기록은한국어. 기존 api-skill 기준 유지. 먼저 AGENTS.md, /Users/thruthesky/apps/skills/skills/api-skill/SKILL.md, references/pipeline.md를읽는다. 이번역할은 원문후보추출이며 완성콘텐츠제작/사진확보역할아니다.
허용쓰기경로는 {dst} 뿐이다. 공유data/sources/work파일수정·메타/빌드·커밋·push·배포·다른에이전트/CLI실행·외부API/다운로드 금지. 기존원문은이미공개본문을확보했으므로네트워크없이정밀분석한다. 입력 {dst}/input.jsonl 전체 {len(rows)}개글을내용까지모두읽고, 등록목록 {P}/registered.json 327곳과대조한다. 긴출력으로잘려원문안읽은채완료표시하지말고5~10글씩순서대로읽으며저장한다. 원문에는그럴듯한거짓·동명이인·다른섬장소·광고·상투적정보가섞여있으므로실재확인은후속단계로명시한다.
목표: 두파일의현재미수록여행지를본문의하위명소까지빠짐없이찾아준다. 제목1개=여행지1개로제한하지않는다. 섬/도시/성당/박물관/공원/해변/폭포/축제상설방문지/동굴/시장/항구/쇼핑몰등 독립목적지를추출하되호텔식당은구체고유명있는것만,사람·추상활동·가공이름·같은대상별칭을새장소로부풀리지않는다. 기존도시안의독립박물관이단순언급됐다고박물관개별등록으로치지말고 existing_context_only로구별한다. 반대로기존정식항목과같은곳을다른이름으로추가하지않는다. 예약진행중기긴토/실라이산디에고성당/오반도/바코르/산페드로라구나는 pending_other_worker 표시.
결과1 {dst}/candidates.jsonl 각줄: {{"post_idx":"...","name_ko":"...","name_en":"...or null","locality":"...or null","kind":"...","evidence":"원문에실제로있는고유명또는짧은구절,60자이내","identity_notes":"동일명/허위가능성/문맥","registration_status":"candidate_unregistered|already_registered|existing_context_only|pending_other_worker|ambiguous_or_nonplace","matched_ids":[],"source_scope":"전체주제|하위언급","verification_needed":[]}}. 독립원문에없는장소를지식으로추가하지않는다. 원문철자오류는그대로evidence보존하고후보정규명은불확실표시. 동일post내중복은합친다.
결과2 {dst}/coverage.jsonl:모든입력글각1줄 {{"post_idx":"...","read_full_body":true,"candidate_count":N,"decision":"분석결과","issues":[]}}. 모든글을읽었을때만true. 결과3 summary.json:실제분석글수/후보수/상태별수/남은분석수/외부검증안함/usage. 입력전체개수와coverage unique개수가같은지자체검증한다. 10글단위중간저장으로작업을잃지말것. 원문전문을결과파일로복제금지. 출력은완료개수와3결과파일경로만보고한다. 전체사용자목표의완료나등록성공이라고표시하지말것.'''
 (dst/'prompt.txt').write_text(prompt+'\n');log=(dst/'cli.log').open('w');inp=(dst/'prompt.txt').open();proc=subprocess.Popen(['codex','exec','-s','workspace-write','-o',str(dst/'final.txt'),'-'],stdin=inp,stdout=log,stderr=subprocess.STDOUT,cwd=R,start_new_session=True);inp.close();log.close();manifest['jobs'].append({'part':name,'pid':proc.pid,'posts':len(rows),'input':str(dst/'input.jsonl'),'output':str(dst),'status':'launched'})
(P/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(W/'launch-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'launched':20,'posts':len(posts),'pids':[x['pid']for x in manifest['jobs']]},ensure_ascii=False))
