const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
const resultPopovers=html=>[...html.matchAll(/<section id="([^"]+)" class="rank-note ocr-result-details"[^>]*>[\s\S]*?<\/section>/g)].map(match=>({id:match[1],html:match[0]}));
const compactCells=html=>html.replace(/<section id="[^"]+" class="rank-note ocr-result-details"[^>]*>[\s\S]*?<\/section>/g,'');
const afterModelCell=html=>html.slice(html.indexOf('<td class="index">'));
const numericCells=html=>compactCells(afterModelCell(html)).replace(/<div id="rank-note-[^"]+" class="rank-note" popover>[\s\S]*?<\/div>/g,'');
const textContent=html=>html.replace(/<[^>]*>/g,'');

test('default uses two primary families while All registered preserves secondary-only evidence',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0}),filtered=build(data);
 assert.equal(data.config.default_families,2);
 assert.ok(filtered.rows.length>0&&filtered.rows.length<all.rows.length);
 assert.deepEqual(filtered.rows,all.rows.filter(row=>row.count>=2),'default only filters visibility; survivor ranks, contributions and scores stay unchanged');
 assert.deepEqual(require('../src/_data/ocr.cjs')().initial.rows,filtered.rows,'static initial rows use the same default');
 for(const id of ['chandra-2-5-api','gemini-4-argon']){
  const row=all.rows.find(r=>r.id===id);assert.ok(row,id);if(id==='chandra-2-5-api'){assert.ok(Number.isFinite(row.rank));assert.equal(row.coreCount,1);}else{assert.equal(row.rank,null);assert.equal(row.coreCount,0);}
  const html=OCR.renderRows({...all,rows:[row]},data);assert.doesNotMatch(html,/>Reported results</);if(row.rank==null)assert.match(html,/No comparable overall index/);assert.match(html,/Reported benchmark results/);assert.doesNotMatch(html,/No benchmark results recorded/);
 }
 for(const query of ['Chandra 2.5','chandra2.5','chandra-2-5-api'])assert.ok(build(data,data.config.snapshot_date,{query,min:0}).rows.some(r=>r.id==='chandra-2-5-api'));
 const chandra=all.rows.find(r=>r.id==='chandra-2-5-api'),html=OCR.renderRows({...all,rows:[chandra]},data);
 assert.match(html,/86.9/);assert.match(html,/92.7/);assert.match(html,/headers\/footers/);assert.match(html,/https:\/\/www.datalab.to\/blog\/chandra-2-5/);
 for(const row of filtered.rows){const same=all.rows.find(r=>r.id===row.id);assert.equal(same.rank,row.rank);assert.deepEqual(same.rankContributions,row.rankContributions);}
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');assert.match(template,/value="\{\{ minimum \}\}"\{% if minimum == ocr.config.default_families %\} selected/);
});

test('unranked rank cells stay compact with accessible explanation in Details',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0});
 for(const row of all.rows.filter(r=>r.rank==null)){
  const html=OCR.renderRows({...all,rows:[row]},data);
  const cell=html.match(/<td class="index">(.*?)<\/td>/s)[1];
  assert.match(cell,/aria-label="Unranked: no comparable overall index. See Details.">—<\/span>/);
  assert.doesNotMatch(cell,/<small>|>Unranked<|<button/);
  assert.match(html,/<strong>No comparable overall index.<\/strong>/);
  assert.match(html,/<button type="button" class="ocr-details-button"[^>]*aria-label="Benchmark, speed and cost details for [^"]+"[^>]*><span aria-hidden="true">ⓘ<\/span><\/button>/);
 }
});

test('compact original matrix shows family results without duplicating model-name score lists',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0});
 assert.equal(all.columns.length+4,17);
 for(const row of all.rows){
  const html=OCR.renderRows({...all,rows:[row]},data),nameCell=html.split('<td class="index">')[0];
  assert.doesNotMatch(nameCell,/ocr-inline-scores|Other reported benchmark scores/);
  const available=Object.values(row.scores).some(o=>o?.value!=null);
  const cells=all.columns.map(t=>OCR.cellObservation(row,t,data,all.columns));
  if(available)assert.ok(cells.some(Boolean),row.id);
  for(const c of cells.filter(Boolean)){assert.equal(c.observation.value,row.scores[c.test.id].value);}
 }
 const chandra=all.rows.find(r=>r.id==='chandra-2-5-api');
 const html=afterModelCell(OCR.renderRows({...all,rows:[chandra]},data));
 assert.match(html,/>92\.7<\/a>/);assert.match(html,/>86\.9<\/a>/);assert.match(html,/aria-label="olmOCR · Chandra2.5 release, no headers\/footers: 86\.9%"/);assert.doesNotMatch(compactCells(html),/class="protocol-label"/);
 const gemini=all.rows.find(r=>r.id==='gemini-3-8-flash');assert.match(afterModelCell(OCR.renderRows({...all,rows:[gemini]},data)),/>92\.9<\/a>/);
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');assert.doesNotMatch(template,/id="ocrBenchmark"/);
});

test('variant fallback never becomes a main-protocol sorting value or aggregate vote',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0}),row=all.rows.find(r=>r.id==='chandra-2-5-api');
 assert.equal(row.scores.olmocr,null);assert.equal(row.rankContributions[0].benchmark,'chandra-2-5-olm-no-hf');
 const cell=OCR.cellObservation(row,data.tests.find(t=>t.id==='olmocr'),data,all.columns);
 assert.equal(cell.observation.value,86.9);assert.equal(cell.variant,true);
});


test('default family cells expose every recorded protocol once outside model details',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0}),before=JSON.stringify(all);
 for(const row of all.rows){
  const cells=all.columns.flatMap(column=>OCR.cellObservations(row,column,data,all.columns));
  const expected=data.tests.filter(t=>row.scores[t.id]?.value!=null).map(t=>t.id).sort();
  assert.deepEqual(cells.map(cell=>cell.test.id).sort(),expected,row.id);
  const html=compactCells(afterModelCell(OCR.renderRows({...all,rows:[row]},data)));
  assert.doesNotMatch(html,/<dl class="score-metrics"|class="score-context"/,'component tables and provenance stay out of compact cells');
  const visibleProtocols=[...html.matchAll(/class="ocr-result" data-protocol="([^"]+)"/g)].map(m=>m[1]).sort();
  assert.deepEqual(visibleProtocols,expected,row.id);
  for(const cell of cells){
   assert.equal(cell.observation.value,row.scores[cell.test.id].value);
   assert.equal(cell.variant,!all.columns.some(column=>column.id===cell.test.id));
  }
 }
 assert.equal(JSON.stringify(all),before,'rendering does not alter ranking inputs or selected values');
 const datalab=all.rows.find(r=>r.id==='datalab-accurate-20261020');
 assert.equal(OCR.cellObservations(datalab,all.columns.find(t=>t.id==='omniparse-datalab-overall-20261023'),data,all.columns).length,3,'overall and both tag slice headlines stay visible together');
 const gemini=all.rows.find(r=>r.id==='gemini-3-pro-preview'),column=all.columns.find(t=>t.id==='mdp-private');
 assert.ok(OCR.cellObservations(gemini,column,data,all.columns).some(c=>c.test.id==='mdp-public'),'public split is visible beside private');
});

test('compact cells keep headline scores while accessible result popovers retain components and scope',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0}),row=all.rows.find(r=>r.id==='glm-5-3-flash');
 const column=data.tests.find(t=>t.id==='puredoc');
 Object.assign(column,{metric_labels:{precise:'Text <edit>',zero:'Zero score'},metric_units:{precise:'ratio',zero:'percent'},metric_directions:{precise:'lower',zero:'higher'}});
 row.scores.puredoc={...row.scores.puredoc,metrics:{avg3:79.69,precise:0.0289,zero:0,unknown:null},visible_context:'Public split <only>; 20 pages.',dataset_version:'Pinned benchmark v1.5 / clean split',measurement_operator:'Example & operator',comparable:false};
 const html=afterModelCell(OCR.renderRows({...all,rows:[row]},data));
 const scores=compactCells(html.slice(html.indexOf('<td class="score"')));
 const popup=resultPopovers(html).find(p=>p.id.endsWith('--puredoc--puredoc'));
 assert.ok(popup);
 assert.match(scores,/>79\.69<\/a>/);
 assert.match(scores,/aria-label="PureDoc Avg₃: 79\.69%"/);
 assert.match(scores,/<sup class="score-context-mark" role="img" aria-label="Context-only result; excluded from ranking"[^>]*>‡<\/sup>/);
 assert.match(scores,/class="ocr-result-details-button"[^>]*aria-haspopup="dialog"[^>]*title="PureDoc Avg₃ · benchmark details"><span aria-hidden="true">ⓘ<\/span><\/button>/);
 assert.doesNotMatch(textContent(scores),/[A-Za-z]/,'score cells contain values, symbols and info controls only');
 assert.doesNotMatch(scores,/score-metrics|Public split|Operator:|data-metric=/,'cells contain no metric tables or provenance paragraphs');
 assert.match(popup.html,/<dt>Text &lt;edit&gt; ↓<\/dt><dd data-metric="precise">0\.0289 ratio<\/dd>/);
 assert.match(popup.html,/<dt>Zero score ↑<\/dt><dd data-metric="zero">0%<\/dd>/);
 assert.doesNotMatch(popup.html,/data-metric="unknown"/);
 assert.match(popup.html,/<small class="score-context">Public split &lt;only&gt;; 20 pages\.<\/small>/);
 assert.match(popup.html,/Operator: Example &amp; operator/);
 assert.match(popup.html,/<strong>Dataset:<\/strong> Pinned benchmark v1\.5 \/ clean split/);
 assert.match(popup.html,/Context only · not comparable for ranking/);
 assert.match(popup.html,/popover="auto" role="dialog" aria-labelledby=/,'native popover renders in the top layer, outside scroll-container clipping');
 const head=OCR.renderHead(all);
 assert.match(head,/Sorts the named primary protocol only/);
 assert.doesNotMatch(textContent(head),/higher is better|lower is better/i,'directions belong in header help, not repeated subtitles');
});

test('every result has a unique named native popover with keyboard and close controls',()=>{
 const data=loadOCR();
 for(const view of ['all','secondary']){
  const result=build(data,data.config.snapshot_date,{view,min:0}),html=OCR.renderRows(result,data),popovers=resultPopovers(html);
  assert.ok(popovers.length);
  assert.equal(new Set(popovers.map(p=>p.id)).size,popovers.length,'one unique id per model, column and protocol');
  for(const popup of popovers){
   assert.ok(html.includes('class="ocr-result-details-button" popovertarget="'+popup.id+'" aria-controls="'+popup.id+'" aria-haspopup="dialog" aria-label="Details for '));
   assert.ok(popup.html.includes('popover="auto" role="dialog" aria-labelledby="'+popup.id+'-title"'));
   assert.ok(popup.html.includes('<h3 id="'+popup.id+'-title">'));
   assert.ok(popup.html.includes('popovertarget="'+popup.id+'" popovertargetaction="hide" aria-label="Close benchmark details" autofocus'));
  }
 }
});


test('score links use exact observation sources and long decimals round only for display',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0}),row=all.rows.find(r=>r.id==='glm-5-3-flash'),test=data.tests.find(t=>t.id==='puredoc');
 test.metric_units={ratio:'ratio',percent:'percent'};
 const observation=row.scores.puredoc={...row.scores.puredoc,source_url:'https://example.com/pinned.csv?rev=abc&split=clean',value:79.69,metrics:{avg3:79.69,ratio:0.02891234567891234,percent:98.12345678912345,unspecified:12.12345678912345}};
 const before=JSON.stringify(observation);
 const html=OCR.renderRows({...all,rows:[row]},data),visible=compactCells(afterModelCell(html));
 const popup=resultPopovers(html).find(p=>p.id.endsWith('--puredoc--puredoc')).html;
 assert.match(visible,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">79\.69<\/a>/);
 assert.match(html,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">Source ↗<\/a>/);
 assert.match(popup,/<dd data-metric="ratio">0\.0289 ratio<\/dd>/);
 assert.match(popup,/<dd data-metric="percent">98\.12%<\/dd>/);
 assert.match(popup,/<dd data-metric="unspecified">12\.1235<\/dd>/);
 assert.equal(JSON.stringify(observation),before,'display rounding never changes stored evidence');
 delete observation.source_url;
 const fallback=afterModelCell(OCR.renderRows({...all,rows:[row]},data));
 assert.ok(fallback.includes('href="'+data.sources[observation.source_id].url+'"'),'registered source URL remains the fallback');
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');
 assert.match(popup,/Component values rounded for display; source data retains full precision/);
 assert.match(template,/Use ⓘ for benchmark details/);
});


test('numeric columns omit repeated words and retain prices under changed assumptions',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{min:0});
 for(const options of [{},{hourlyRate:0,inputTokens:0,outputTokens:0},{hourlyRate:1e7,inputTokens:200000,outputTokens:200000}]){
  for(const row of all.rows){
   const html=OCR.renderRows({...all,rows:[row]},data,options),cells=numericCells(html);
   assert.doesNotMatch(textContent(cells),/[A-Za-z]/,row.id+' has no numeric-cell prose');
   const cost=OCR.deployment(data,data.models.find(m=>m.id===row.id),options).cost;
   const price=textContent(cells.match(/<td class="price"[^>]*>([\s\S]*?)<\/td>/)[1]);
   if(Number.isFinite(cost.value))assert.equal(price,cost.label.replace(/^Service\s+/,''),row.id+' keeps its finite price');
  }
 }
 const sarvam=all.rows.find(r=>r.id==='sarvam-vision-2-1'),html=OCR.renderRows({...all,rows:[sarvam]},data),cells=numericCells(html);
 assert.match(cells,/>≈\$5\.27†<\/a>/,'contextual price is converted to compact USD');
 assert.doesNotMatch(textContent(cells),/[₹€£¥]/,'numeric cells consistently show USD');
 assert.match(cells,/<td class="ocr-speed"[^>]*>—<\/td>/,'unknown hosted reference speed uses an em dash');
 assert.match(cells,/aria-label="Context-only result; excluded from ranking"[^>]*>‡<\/sup>/);
 assert.match(html,/Context only · not comparable for ranking/,'qualification remains accessible in the popover');
});


test('configured family order changes only column presentation across views',()=>{
 const data=loadOCR(),legacy={...data,config:{...data.config}};
 delete legacy.config.column_family_order;
 const inputs=JSON.stringify([data.tests,data.primaryTests,data.rawRecords]),order=data.config.column_family_order;
 const cellProtocols=(result,source)=>result.rows.map(row=>[row.id,result.columns.slice().sort((a,b)=>a.id.localeCompare(b.id)).map(column=>[column.id,OCR.cellObservations(row,column,source,result.columns).map(cell=>[cell.test.id,cell.observation,cell.variant])])]);
 for(const view of ['all','structure','robust','multilingual','production','secondary','new','recognition','understanding']){
  const before=build(legacy,legacy.config.snapshot_date,{view,min:0}),after=build(data,data.config.snapshot_date,{view,min:0});
  assert.deepEqual(after.rows,before.rows,view+' preserves row order, ranks, selected scores and qualifications');
  assert.deepEqual(after.ranges,before.ranges,view+' preserves score scales');
  assert.deepEqual(after.columns.map(t=>t.id).sort(),before.columns.map(t=>t.id).sort(),view+' preserves column membership');
  assert.deepEqual(cellProtocols(after,data),cellProtocols(before,legacy),view+' preserves per-cell protocol variants and values');
  const listed=after.columns.filter(t=>order.includes(t.family)),unknown=after.columns.filter(t=>!order.includes(t.family));
  assert.deepEqual(after.columns,[...listed,...unknown],view+' puts unlisted families after configured ones');
  assert.deepEqual(listed.map(t=>order.indexOf(t.family)),listed.map(t=>order.indexOf(t.family)).sort((a,b)=>a-b),view+' follows configured family order');
  assert.deepEqual(unknown.map(t=>t.id),before.columns.filter(t=>!order.includes(t.family)).map(t=>t.id),view+' retains unlisted relative order');
 }
 assert.deepEqual(build(data).columns.map(t=>t.family),order,'default matrix follows the full editorial order, including Other');
 assert.equal(build(legacy).columns[0].id,'omniparse-datalab-overall-20261023','absent configuration retains legacy order');
 assert.equal(JSON.stringify([data.tests,data.primaryTests,data.rawRecords]),inputs,'display sorting does not mutate source or selection arrays');
 const speech=require('../src/assets/js/speech-matrix.js'),stt=require('../lib/load-stt.cjs').loadSTT(),prepared=speech.rankingData(stt);
 assert.equal(stt.config.column_family_order,undefined);
 assert.deepEqual(build(prepared).columns.map(t=>t.id),prepared.primaryTests.map(t=>t.id),'speech without this configuration keeps its selected column order');
});


test('specialized columns show only their exact protocol without cross-split or component fallback',()=>{
 const data=loadOCR();
 for(const view of ['structure','robust','multilingual','production','secondary','new','recognition','understanding']){
  const result=build(data,data.config.snapshot_date,{view,min:0});
  for(const row of result.rows)for(const column of result.columns){
   const cells=OCR.cellObservations(row,column,data,result.columns),expected=row.scores[column.id];
   assert.equal(cells.length,expected?.value!=null?1:0,view+'/'+row.id+'/'+column.id);
   for(const cell of cells){assert.equal(cell.test.id,column.id);assert.equal(cell.variant,false);assert.equal(cell.observation,expected);}
  }
 }
 const multilingual=build(data,data.config.snapshot_date,{view:'multilingual',min:0}),poly=multilingual.rows.find(r=>r.id==='polyocr-2-7b');
 assert.deepEqual(OCR.cellObservations(poly,multilingual.columns.find(t=>t.id==='mdp-private'),data,multilingual.columns),[],'public87 cannot populate the private split');
 assert.equal(OCR.cellObservations(poly,multilingual.columns.find(t=>t.id==='mdp-public'),data,multilingual.columns)[0].observation.value,87);
 const recognition=build(data,data.config.snapshot_date,{view:'recognition',min:0}),xiaomi=recognition.rows.find(r=>r.id==='xiaomi-ocr-0');
 assert.deepEqual(OCR.cellObservations(xiaomi,recognition.columns.find(t=>t.id==='omnidoc-v10-formula'),data,recognition.columns),[],'full-document96.83 cannot populate a formula subset');
 const all=build(data,data.config.snapshot_date,{min:0}),row=all.rows.find(r=>r.id==='polyocr-2-7b'),cells=OCR.cellObservations(row,all.columns.find(t=>t.id==='mdp-private'),data,all.columns);
 assert.deepEqual(cells.map(c=>[c.test.id,c.observation.value]),[['mdp-public',87]],'default family matrix still retains the public result');
});

test('heterogeneous Other column has no misleading sort control or sorted state',()=>{
 const result=build(loadOCR());
 for(const sortKey of ['rank','reported-other']){
  const head=OCR.renderHead(result,{sortKey}),other=head.match(/<th scope="col" title="Mixed protocols[^>]*>Other<\/th>/)?.[0];
  assert.ok(other);
  assert.doesNotMatch(other,/button|aria-sort|[↕↑↓]/);
  assert.doesNotMatch(head,/data-ocr-sort="reported-other"/);
 }
 assert.match(OCR.renderHead(result),/data-ocr-sort="omnidoc-v16"/,'exact primary protocols remain sortable');
});


test('PureDoc domain metrics use compact track tables inside popovers with native source precision',()=>{
 const data=loadOCR(),result=build(data,data.config.snapshot_date,{min:0}),row=result.rows.find(r=>r.id==='glm-5-3-flash'),observation=row.scores.puredoc;
 const before=JSON.stringify(observation),html=OCR.renderRows({...result,rows:[row]},data);
 const popup=resultPopovers(html).find(p=>p.id.endsWith('--puredoc--puredoc')).html;
 const groups=[...popup.matchAll(/<details class="score-metric-group">[\s\S]*?<\/details>/g)].map(m=>m[0]);
 assert.equal(groups.length,3);
 for(const [index,label] of ['Clean','Digital degradation','Real degradation'].entries()){
  const table=groups[index];
  assert.ok(table.includes('<summary>'+label+' · document domains (10)</summary>'));
  assert.equal((table.match(/<th scope="row">/g)||[]).length,10);
  assert.equal((table.match(/<th scope="col">/g)||[]).length,6);
  assert.equal((table.match(/<td data-metric=/g)||[]).length,50);
  assert.match(table,/role="region" aria-label="[^"]+" tabindex="0"/);
  assert.match(table,/<th scope="col">Overall ↑ \(%\)<\/th>/);
  assert.match(table,/<th scope="col">Text edit ↓ \(ratio\)<\/th>/);
  assert.ok(table.includes('href="'+observation.category_component_source_url+'"'));
 }
 const shown=[...groups.join('').matchAll(/data-metric="([^"]+)"/g)].map(m=>m[1]).sort();
 assert.deepEqual(shown,Object.keys(observation.metrics).filter(k=>k.startsWith('domain_')).sort(),'all150 values appear exactly once in the result tables');
 assert.match(popup,/<td data-metric="domain_academic_clean_overall">93\.97<\/td>/);
 assert.match(popup,/<td data-metric="domain_academic_clean_text_edit">0\.0919<\/td>/);
 assert.doesNotMatch(popup,/<dd data-metric="domain_/,'domain values are not repeated in the definition list');
 assert.doesNotMatch(numericCells(html),/score-metric-table|data-metric="domain_/,'domain tables stay out of matrix cells');
 assert.doesNotMatch(textContent(numericCells(html)),/document domains/,'matrix cells retain no added prose');
 assert.equal(JSON.stringify(observation),before,'rendering preserves full source precision');
 row.scores.puredoc={...observation,metrics:{avg3:79.69,domain_academic_clean_overall:0,domain_academic_clean_text_edit:null}};
 const sparse=resultPopovers(OCR.renderRows({...result,rows:[row]},data)).find(p=>p.id.endsWith('--puredoc--puredoc')).html;
 assert.match(sparse,/<td data-metric="domain_academic_clean_overall">0<\/td>/);
 assert.match(sparse,/<td data-metric="domain_academic_clean_text_edit">—<\/td>/,'missing table values remain distinct from zero');
 assert.equal((sparse.match(/<details class="score-metric-group">/g)||[]).length,1,'empty track tables do not appear for other observations');
});
