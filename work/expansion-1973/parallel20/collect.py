"""20개 원문 분석 결과를 합치며 누락·중복·형식 오류를 기록한다. 등록 완료로 세지 않는다."""
import pathlib,json,datetime,subprocess,re,html,collections,urllib.parse
R=pathlib.Path.cwd();P=R/'_i18n/work/expansion-1973/parallel20';W=R/'work/expansion-1973/parallel20';m=json.loads((P/'manifest.json').read_text());allc=[];allv=[];jobs=[];seen=set();errors=[]
normalize=lambda s:re.sub(r'\s+','',html.unescape(re.sub('<[^>]+>',' ',str(s)))).casefold()
normalize_raw=lambda s:re.sub(r'[\W_]+','',html.unescape(urllib.parse.unquote(str(s)))).casefold()
for job in m['jobs']:
 d=pathlib.Path(job['output']);source=[json.loads(x)for x in (d/'input.jsonl').read_text().splitlines()if x.strip()];byid={str(x['idx']):x for x in source};row={'part':job['part'],'pid':job['pid'],'input_posts':len(source)}
 ps=subprocess.run(['ps','-p',str(job['pid']),'-o','stat='],capture_output=True,text=True);row['process_state']=ps.stdout.strip()or'missing';row['live']=bool(ps.stdout.strip())and not ps.stdout.lstrip().startswith('Z');row['has_final']=(d/'final.txt').exists()
 for name,target in [('coverage.jsonl',allv),('candidates.jsonl',allc)]:
  file=d/name;rows=[]
  if file.exists():
   for n,line in enumerate(file.read_text().splitlines(),1):
    if not line.strip():continue
    try:v=json.loads(line)
    except Exception as e:errors.append({'part':job['part'],'file':name,'line':n,'error':str(e)});continue
    idx=str(v.get('post_idx',''));v['part']=job['part'];v['source_input']=byid.get(idx,{}).get('original_input');v['source_row']=byid.get(idx,{}).get('original_row')
    if idx not in byid:errors.append({'part':job['part'],'file':name,'line':n,'error':'입력에없는글번호'})
    if name=='candidates.jsonl':
     original=byid.get(idx,{}).get('body','')+' '+byid.get(idx,{}).get('subject','');evidence=v.get('evidence','');visible=bool(evidence)and normalize(evidence)in normalize(original);raw=bool(evidence)and normalize_raw(evidence)in normalize_raw(original)
     v['evidence_found_in_original']=visible or raw;v['evidence_channel']='본문표시글' if visible else ('원문표기·HTML속성·URL' if raw else '원문대조필요')
    rows.append(v)
  row[name.replace('.jsonl','')+'_rows']=len(rows);target.extend(rows)
 row['covered_unique']=len({str(v.get('post_idx'))for v in allv if v['part']==job['part']});row['all_inputs_covered']=row['covered_unique']==len(source);jobs.append(row)
for name,rows in [('candidates',allc),('coverage',allv)]:
 (W/(name+'.jsonl')).write_text(''.join(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n'for x in rows))
counts=collections.Counter(x.get('registration_status','missing')for x in allc);groups=collections.defaultdict(list)
for c in allc:
 key=normalize(c.get('name_en')or c.get('name_ko'))+'|'+normalize(c.get('locality')or'미상');groups[key].append(c)
summary={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'input_body_count':m['body_count'],'registered_snapshot':m['registered_snapshot'],'process_live':sum(x['live']for x in jobs),'parts':jobs,'covered_unique':len({str(x.get('post_idx'))for x in allv}),'candidate_rows':len(allc),'status_counts':dict(counts),'name_locality_groups_before_alias_review':len(groups),'evidence_not_exactly_found':sum(not x['evidence_found_in_original']for x in allc),'nonvisible_evidence_rows':sum(x.get('evidence_channel')=='원문표기·HTML속성·URL'for x in allc),'full_body_read_true':sum(x.get('read_full_body')is True for x in allv),'format_errors':errors,'all_parts_covered':all(x['all_inputs_covered']for x in jobs),'registration_complete':False,'note':'후보 추출과기계적이름·지역묶음이며실재·별칭·사진·출처교차검증·항목등록은후속단계.목표추가수로세지않음.'};(W/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:summary[k]for k in ['process_live','covered_unique','candidate_rows','status_counts','format_errors','all_parts_covered']},ensure_ascii=False))
