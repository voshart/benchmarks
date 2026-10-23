const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
const resultPopovers=html=>[...html.matchAll(/<section id="([^"]+)" class="rank-note ocr-result-details"[^>]*>[\s\S]*?<\/section>/g)].map(match=>({id:match[1],html:match[0]}));
const compactCells=html=>html.replace(/<section id="[^"]+" class="rank-note ocr-result-details"[^>]*>[\s\S]*?<\/section>/g,'');
const numericCells=html=>compactCells(html.split('</th>')[1]).replace(/<div id="rank-note-[^"]+" class="rank-note" popover>[\s\S]*?<\/div>/g,'');
const textContent=html=>html.replace(/<[^>]*>/g,'');

test('default catalog exposes secondary-only models without inventing aggregate scores',()=>{
 const data=loadOCR(),all=build(data),filtered=build(data,data.config.snapshot_date,{min:2});
 for(const id of ['chandra-2-5-api','gemini-4-argon']){
  const row=all.rows.find(r=>r.id===id);assert.ok(row,id);if(id==='chandra-2-5-api'){assert.ok(Number.isFinite(row.rank));assert.equal(row.coreCount,1);}else{assert.equal(row.rank,null);assert.equal(row.coreCount,0);}
  const html=OCR.renderRows({...all,rows:[row]},data);assert.doesNotMatch(html,/>Reported results</);if(row.rank==null)assert.match(html,/No comparable overall index/);assert.match(html,/Reported benchmark results/);assert.doesNotMatch(html,/No benchmark results recorded/);
 }
 for(const query of ['Chandra 2.5','chandra2.5','chandra-2-5-api'])assert.ok(build(data,data.config.snapshot_date,{query}).rows.some(r=>r.id==='chandra-2-5-api'));
 const chandra=all.rows.find(r=>r.id==='chandra-2-5-api'),html=OCR.renderRows({...all,rows:[chandra]},data);
 assert.match(html,/86.9/);assert.match(html,/92.7/);assert.match(html,/headers\/footers/);assert.match(html,/https:\/\/www.datalab.to\/blog\/chandra-2-5/);
 for(const row of filtered.rows){const same=all.rows.find(r=>r.id===row.id);assert.equal(same.rank,row.rank);assert.deepEqual(same.rankContributions,row.rankContributions);}
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');assert.match(template,/value="0"\{% if ocr.config.default_families == 0 %\} selected/);
});

test('unranked rank cells stay compact with accessible explanation in Details',()=>{
 const data=loadOCR(),all=build(data);
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
 const data=loadOCR(),all=build(data);
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
 const html=OCR.renderRows({...all,rows:[chandra]},data).split('</th>')[1];
 assert.match(html,/>92\.7<\/a>/);assert.match(html,/>86\.9<\/a>/);assert.match(html,/aria-label="olmOCR · Chandra2.5 release, no headers\/footers: 86\.9%"/);assert.doesNotMatch(compactCells(html),/class="protocol-label"/);
 const gemini=all.rows.find(r=>r.id==='gemini-3-8-flash');assert.match(OCR.renderRows({...all,rows:[gemini]},data).split('</th>')[1],/>92\.9<\/a>/);
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');assert.doesNotMatch(template,/id="ocrBenchmark"/);
});

test('variant fallback never becomes a main-protocol sorting value or aggregate vote',()=>{
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='chandra-2-5-api');
 assert.equal(row.scores.olmocr,null);assert.equal(row.rankContributions[0].benchmark,'chandra-2-5-olm-no-hf');
 const cell=OCR.cellObservation(row,data.tests.find(t=>t.id==='olmocr'),data,all.columns);
 assert.equal(cell.observation.value,86.9);assert.equal(cell.variant,true);
});


test('default family cells expose every recorded protocol once outside model details',()=>{
 const data=loadOCR(),all=build(data),before=JSON.stringify(all);
 for(const row of all.rows){
  const cells=all.columns.flatMap(column=>OCR.cellObservations(row,column,data,all.columns));
  const expected=data.tests.filter(t=>row.scores[t.id]?.value!=null).map(t=>t.id).sort();
  assert.deepEqual(cells.map(cell=>cell.test.id).sort(),expected,row.id);
  const html=compactCells(OCR.renderRows({...all,rows:[row]},data).split('</th>')[1]);
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
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='glm-5-3-flash');
 const column=data.tests.find(t=>t.id==='puredoc');
 Object.assign(column,{metric_labels:{precise:'Text <edit>',zero:'Zero score'},metric_units:{precise:'ratio',zero:'percent'},metric_directions:{precise:'lower',zero:'higher'}});
 row.scores.puredoc={...row.scores.puredoc,metrics:{avg3:79.69,precise:0.0289,zero:0,unknown:null},visible_context:'Public split <only>; 20 pages.',dataset_version:'Pinned benchmark v1.5 / clean split',measurement_operator:'Example & operator',comparable:false};
 const html=OCR.renderRows({...all,rows:[row]},data).split('</th>')[1];
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
  const result=build(data,data.config.snapshot_date,{view}),html=OCR.renderRows(result,data),popovers=resultPopovers(html);
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
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='glm-5-3-flash'),test=data.tests.find(t=>t.id==='puredoc');
 test.metric_units={ratio:'ratio',percent:'percent'};
 const observation=row.scores.puredoc={...row.scores.puredoc,source_url:'https://example.com/pinned.csv?rev=abc&split=clean',value:79.69,metrics:{avg3:79.69,ratio:0.02891234567891234,percent:98.12345678912345,unspecified:12.12345678912345}};
 const before=JSON.stringify(observation);
 const html=OCR.renderRows({...all,rows:[row]},data),visible=compactCells(html.split('</th>')[1]);
 const popup=resultPopovers(html).find(p=>p.id.endsWith('--puredoc--puredoc')).html;
 assert.match(visible,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">79\.69<\/a>/);
 assert.match(html,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">Source ↗<\/a>/);
 assert.match(popup,/<dd data-metric="ratio">0\.0289 ratio<\/dd>/);
 assert.match(popup,/<dd data-metric="percent">98\.12%<\/dd>/);
 assert.match(popup,/<dd data-metric="unspecified">12\.1235<\/dd>/);
 assert.equal(JSON.stringify(observation),before,'display rounding never changes stored evidence');
 delete observation.source_url;
 const fallback=OCR.renderRows({...all,rows:[row]},data).split('</th>')[1];
 assert.ok(fallback.includes('href="'+data.sources[observation.source_id].url+'"'),'registered source URL remains the fallback');
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');
 assert.match(popup,/Component values rounded for display; source data retains full precision/);
 assert.match(template,/Use ⓘ for benchmark details/);
});


test('numeric columns omit repeated words and retain prices under changed assumptions',()=>{
 const data=loadOCR(),all=build(data);
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
 assert.match(cells,/>₹500†<\/a>/,'contextual rupee price retains its currency and amount');
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
  const before=build(legacy,legacy.config.snapshot_date,{view}),after=build(data,data.config.snapshot_date,{view});
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
