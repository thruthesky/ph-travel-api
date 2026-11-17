"""분할 원문 분석이 실제 끝난 자리에서 공항별 상세 작성 CLI를 이어 실행한다."""
import pathlib,json,datetime,subprocess,time,re
R=pathlib.Path.cwd();P=R/'_i18n/work/expansion-1973/parallel20';W=R/'work/expansion-1973/parallel20';Q=P/'authors';Q.mkdir(exist_ok=True)
targets=[
(407,'puerto-princesa-airport','푸에르토 프린세사 국제공항','Puerto Princesa International Airport','PPS','푸에르토.?프린세사.{0,15}공항|Puerto Princesa.*Airport'),
(408,'kalibo-airport','칼리보 국제공항','Kalibo International Airport','KLO','칼리보.{0,10}공항|Kalibo.*Airport'),
(409,'caticlan-airport','카티클란 공항','Godofredo P. Ramos Airport (Caticlan)','MPH','카티클란.{0,10}공항|Caticlan.*Airport'),
(410,'siargao-sayak-airport','시아르가오 사약 공항','Siargao Airport (Sayak)','IAO','시아르가오.{0,10}공항|사약.{0,10}공항|Sayak Airport'),
(411,'laguindingan-airport','라긴딩안 공항','Laguindingan Airport','CGY','라긴딩안|Laguindingan'),
(412,'davao-airport','다바오 국제공항','Francisco Bangoy International Airport','DVO','다바오.{0,10}공항|Davao.*Airport'),
(413,'iloilo-airport','일로일로 국제공항','Iloilo International Airport','ILO','일로일로.{0,10}공항|Iloilo.*Airport'),
(414,'bacolod-silay-airport','바콜로드 실라이 공항','Bacolod-Silay Airport','BCD','바콜로드.{0,10}공항|실라이.{0,10}공항|Bacolod.*Airport'),
(415,'bohol-panglao-airport','보홀 팡라오 국제공항','Bohol-Panglao International Airport','TAG','팡라오.{0,10}공항|타그빌라란.{0,10}공항|Panglao.*Airport'),
(416,'tacloban-airport','타클로반 공항','Daniel Z. Romualdez Airport','TAC','타클로반.{0,10}공항|Tacloban.*Airport'),
(417,'general-santos-airport','제너럴 산토스 공항','General Santos International Airport','GES','산토스.{0,10}공항|General Santos.*Airport'),
(418,'butuan-airport','부투안 공항','Bancasi Airport (Butuan)','BXU','부투안.{0,10}공항|Butuan.*Airport|Bancasi'),
(419,'dumaguete-airport','두마게테 공항','Sibulan Airport (Dumaguete)','DGT','두마게테.{0,10}공항|Dumaguete.*Airport|Sibulan.*Airport'),
(420,'tuguegarao-airport','투게가라오 공항','Tuguegarao Airport','TUG','투게가라오.{0,10}공항|Tuguegarao.*Airport'),
(421,'bicol-airport','비콜 국제공항','Bicol International Airport','DRP','비콜.{0,10}공항|레가스피.{0,10}공항|Bicol.*Airport|Legazpi.*Airport'),
(422,'busuanga-airport','부수앙가 공항','Francisco B. Reyes Airport (Busuanga)','USU','부수앙가.{0,10}공항|Busuanga.*Airport|코론.{0,10}공항'),
(423,'el-nido-lio-airport','엘니도 리오 공항','El Nido Airport (Lio)','ENI','엘니도.{0,10}공항|El Nido.*Airport|Lio.*Airport'),
(424,'cauayan-airport','카우아얀 공항','Cauayan Airport','CYZ','카우아얀.{0,10}공항|Cauayan.*Airport'),
(425,'laoag-airport','라오아그 국제공항','Laoag International Airport','LAO','라오아그.{0,10}공항|Laoag.*Airport'),
(426,'pagadian-airport','파가디안 공항','Pagadian Airport','PAG','파가디안.{0,10}공항|Pagadian.*Airport')]
manifest={'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targets':[],'goal':'전체미수록여행지추가목표의공항별상세작성20분담.미완성후보는등록수0.','dispatch_policy':'대응원문분석CLI의terminal상태+final+전체coverage확인후새CLI1개만실행','common_get':'work/expansion-1973/parallel20/commons_get.py'}
posts=[]
for f in (R/'_i18n/work/expansion-1973/posts').glob('*.json'):
 d=json.loads(f.read_text());posts.append((f,d))
for n,(id,slug,ko,en,code,pattern)in enumerate(targets,1):
 out=Q/f'{id}-{slug}';out.mkdir(exist_ok=True);matches=[{'idx':str(d.get('idx',f.stem)),'subject':d.get('subject',''),'file':str(f)}for f,d in posts if re.search(pattern,d.get('subject','')+' '+d.get('content',''),re.I)];(out/'original-posts.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2)+'\n')
 prompt=f'''사용자가1973개이상여행정보를추가하고20개이상AI로동시진행하라고명시지시했다. 당신은공항콘텐츠분담{n}/20이며예약ID{id},slug {slug}, 한국어 {ko},영문 {en}, IATA {code}의상세여행정보를끝까지준비한다. 기존data에는독립공항상세가없고352NAIA/335CEB와다르다. 조사결과실제중복/폐쇄/독립사진부족이면정직하게보류하고이유를남긴다. 당신은이미CodexCLI이므로다른CodexCLI/하위AI호출은금지,사용자에게질문하지말고자율작업한다.
필수문서: AGENTS.md, /Users/thruthesky/apps/skills/skills/api-skill/SKILL.md, references/pipeline.md 및 maintain.md, data/README.md, i18n/GUIDE.md, data/meta.json. 한글설명/주석. 사용자예외로ko/en우선이고나머지6언어는부모가명시적영어fallback한다. 공유data/sources/work대장/meta/빌드출력/커밋/push/배포/상위submodule수정금지. 허용쓰기루트는 {out} 하나다. 전체목표완료선언금지.
원문입력 {out}/original-posts.json의실제원문을읽고도시/공항이언급된범위를기록한다. 필고원문은오래된내용과사실오류가많으므로이름단서로만사용한다. 옛공항과현재공항/이전완료와계획·임시터미널·공항이름/IATA구분. 항공편노선시간표/공항철도/셔틀/요금/환승시간을추측하지않는다. 요금/운영/공사/현행은실제본문공식A+최근독립B등2곳이상읽어교차하고sources에날짜·says·decision·본문읽음/접속실패를정직하게적는다. 검색스니펫만으로확정금지. 특히고정20분환승/보안구역관광/드론비행/활주로진입/승객구역촬영허가를만들지않는다. 시설과도착/출발/육로이동/공항밖식사·숙박결정을실용적으로안내하되공항투어명목의비행기사진나열로장수채우지않는다. 좌표는현재터미널지도2곳대조·공유OSM상류가능성명시. 예산/평점/소요시간은편집계획값과실제정가를구별.
사진을먼저확인:실제정확한공항사진10장,대표1+gallery9,원본실측폭1080이상·다른구도/전경/터미널/외부접근/승객시설. 항공기만크게찍은사진/워터마크/인물주제/로고/큰광고/위치불명/옛사라진시설만/유사구도반복금지. 작가별칭RamonFVelasquez/Judgefloro/JFVelasquezFloro/FBenjr123/SwarmCheng은같은Floro군,PaulGorduiz/Thewideawake1같음,Ryomaandres/KejAndres같음. 같은작가같은날/연속여행1장,날짜만다르다고독립10여행을조작하지않는다.10확보불가능하면잘못된사진을채우지말고pending으로남기고등록하지않음. 다른공항사진을임시로복사하지말것.
모든Commons메타/파일GET은공유직렬화 도구 python3 work/expansion-1973/parallel20/commons_get.py <공개정상URL> --out <당신루트하위파일> 를쓴다. 이도구는글로벌15초간격이고403/429뒤최소10분냉각이다. exit75는요청안보냈으므로다른공식출처조사를진행한뒤재시도시간이지났는지검사한다. HTTP403/429실패URL반복·다른호스트/UserAgent/IP우회금지. 메타는공식CommonsAPIbatch titles/category/search로한번에모으되타이틀/설명/촬영일/라이선스/위치정확히보존. 다운로드는공식API imageinfo iiurlwidth=1600이반환한thumburl그대로만쓴다. 원본이1080~1920이고thumburl도원본이면그정상API반환URL다운로드가능,큰전체원본대신공식사이즈만. 정해진URL호스트/치수자체조립금지.이작업은CodexCLI내부이므로실측1080이상입력을cwebp q80 resize1080종횡비유지/no crop/no color/no upscale로당신도구가수치변환할수있다. 이미지생성/리터칭/합성은요청없으므로하지않는다. 입력원본과출력최종10을각각직접view_image로눈검수·SHA전후/파일디코딩/가로1080/비율검증.프롬프트원문옆보존. 성공원본재다운로드금지. 외부AIAPI/키사용금지.
산출물 {out}/ready/ko/{id}-{slug}.json,en동일,sources/{id}-{slug}.json,images/{id}-{slug}[-2..-10].webp+prompt.txt. data/ko335또는352는구조참고만하고모든글은목표공항전용새집필. 실제ko본문5000~7000자·10섹션·정수번호6~8볼거리카드·구체적실용정보. 공항이라는이유로무의미경고문반복해길이채우기금지. 원본ko완성후별도scratch에공식scripts/i18n.mjs/place-files.mjs/meta복사→export/check/import en수행·모양일치검증. 8언어전역build/stamp는부모담당. 실제10사진이없으면data모양완성됐다고주장하지말고pending-research.json에진행/부족/출처/다음동작기록.
완성시 completion.json에id/slug/한영글자수/10섹션/카드수/사진10/독립방문10의판정/사진눈검수/변환report·prompt/i18n89등실측/중복대조/원문연결범위/지도비교/source본문검토/실제모든사용횟수/ready파일경로를적고최종인계한다. 연구를중간저장해컨텍스트압축에도계속하고,한두검색실패를전체포기로삼지말며다른정상공식출처/남은사진후보를검토한다. 모든조건충족전에는등록완료표시금지.'''
 (out/'prompt.txt').write_text(prompt+'\n');manifest['targets'].append({'part':f'part-{n:02d}','id':id,'slug':slug,'name':ko,'en':en,'iata':code,'original_matches':len(matches),'directory':str(out),'status':'queued'})
if (Q/'manifest.json').exists():
 previous=json.loads((Q/'manifest.json').read_text());byid={x['id']:x for x in previous['targets']}
 for target in manifest['targets']:
  if target['id'] in byid:target.update(byid[target['id']])
(Q/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(W/'author-assignments.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
while any(t['status']=='queued'for t in manifest['targets']):
 if (Q/'STOP').exists():break
 changed=False
 for t in manifest['targets']:
  if t['status']!='queued':continue
  part=P/t['part'];final=part/'final.txt';cv=part/'coverage.jsonl'
  if not final.exists()or not cv.exists():continue
  try:covered={str(json.loads(x)['post_idx'])for x in cv.read_text().splitlines()if x.strip()};expected={str(json.loads(x)['idx'])for x in (part/'input.jsonl').read_text().splitlines()if x.strip()}
  except Exception:continue
  if covered!=expected:continue
  original_job=next(j for j in json.loads((P/'manifest.json').read_text())['jobs']if j['part']==t['part']);ps=subprocess.run(['ps','-p',str(original_job['pid']),'-o','stat='],capture_output=True,text=True)
  if ps.stdout.strip()and not ps.stdout.lstrip().startswith('Z'):continue
  out=pathlib.Path(t['directory']);log=(out/'cli.log').open('w');inp=(out/'prompt.txt').open();proc=subprocess.Popen(['codex','exec','-c','web_search="live"','-o',str(out/'final.txt'),'-'],stdin=inp,stdout=log,stderr=subprocess.STDOUT,cwd=R,start_new_session=True);inp.close();log.close();t.update(status='launched',pid=proc.pid,started_at=datetime.datetime.now(datetime.timezone.utc).isoformat());changed=True
 if changed:
  (Q/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');(W/'author-assignments.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 time.sleep(10)
