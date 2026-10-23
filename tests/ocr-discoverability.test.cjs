const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
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
  assert.match(html,/>Details<\/button>/);
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
 assert.match(html,/>92\.7<\/a>/);assert.match(html,/>86\.9<\/a>/);assert.match(html,/<small class="protocol-label">olmOCR · Chandra2.5 release, no headers\/footers<\/small>/);
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
  const html=OCR.renderRows({...all,rows:[row]},data).split('</th>')[1];
  const visibleProtocols=[...html.matchAll(/class="ocr-result" data-protocol="([^"]+)"/g)].map(m=>m[1]).sort();
  assert.deepEqual(visibleProtocols,expected,row.id);
  for(const cell of cells){
   assert.equal(cell.observation.value,row.scores[cell.test.id].value);
   assert.equal(cell.variant,!all.columns.some(column=>column.id===cell.test.id));
  }
 }
 assert.equal(JSON.stringify(all),before,'rendering does not alter ranking inputs or selected values');
 const datalab=all.rows.find(r=>r.id==='datalab-accurate-20261020');
 assert.equal(OCR.cellObservations(datalab,all.columns[0],data,all.columns).length,3,'overall and both tag slices stay expanded together');
 const gemini=all.rows.find(r=>r.id==='gemini-3-pro-preview'),column=all.columns.find(t=>t.id==='mdp-private');
 assert.ok(OCR.cellObservations(gemini,column,data,all.columns).some(c=>c.test.id==='mdp-public'),'public split is visible beside private');
});

test('component scores preserve precision, mixed scales and scope outside popovers',()=>{
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='glm-5-3-flash');
 const column=data.tests.find(t=>t.id==='puredoc');
 Object.assign(column,{metric_labels:{precise:'Text <edit>',zero:'Zero score'},metric_units:{precise:'ratio',zero:'percent'},metric_directions:{precise:'lower',zero:'higher'}});
 row.scores.puredoc={...row.scores.puredoc,metrics:{avg3:79.69,precise:0.0289,zero:0,unknown:null},visible_context:'Public split <only>; 20 pages.',measurement_operator:'Example & operator',comparable:false};
 const html=OCR.renderRows({...all,rows:[row]},data).split('</th>')[1];
 const scores=html.slice(html.indexOf('<td class="score"'));
 assert.match(scores,/>79\.69<\/a>/);
 assert.match(scores,/<dt>Text &lt;edit&gt; ↓<\/dt><dd data-metric="precise">0\.0289 ratio<\/dd>/);
 assert.match(scores,/<dt>Zero score ↑<\/dt><dd data-metric="zero">0%<\/dd>/);
 assert.doesNotMatch(scores,/data-metric="unknown"/);
 assert.match(scores,/<small class="score-context">Public split &lt;only&gt;; 20 pages\.<\/small>/);
 assert.match(scores,/Operator: Example &amp; operator/);
 assert.match(scores,/Context only · not comparable for ranking/);
 assert.doesNotMatch(scores,/<details|popover| hidden/,'visible data must not require opening a disclosure');
 const head=OCR.renderHead(all);
 assert.match(head,/Sorts the named primary protocol only/);
});


test('score links use exact observation sources and long decimals round only for display',()=>{
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='glm-5-3-flash'),test=data.tests.find(t=>t.id==='puredoc');
 test.metric_units={ratio:'ratio',percent:'percent'};
 const observation=row.scores.puredoc={...row.scores.puredoc,source_url:'https://example.com/pinned.csv?rev=abc&split=clean',value:79.69,metrics:{avg3:79.69,ratio:0.02891234567891234,percent:98.12345678912345,unspecified:12.12345678912345}};
 const before=JSON.stringify(observation);
 const html=OCR.renderRows({...all,rows:[row]},data),visible=html.split('</th>')[1];
 assert.match(visible,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">79\.69<\/a>/);
 assert.match(html,/<a href="https:\/\/example\.com\/pinned\.csv\?rev=abc&amp;split=clean" target="_blank" rel="noreferrer">Source ↗<\/a>/);
 assert.match(visible,/<dd data-metric="ratio">0\.0289 ratio<\/dd>/);
 assert.match(visible,/<dd data-metric="percent">98\.12%<\/dd>/);
 assert.match(visible,/<dd data-metric="unspecified">12\.1235<\/dd>/);
 assert.equal(JSON.stringify(observation),before,'display rounding never changes stored evidence');
 delete observation.source_url;
 const fallback=OCR.renderRows({...all,rows:[row]},data).split('</th>')[1];
 assert.ok(fallback.includes('href="'+data.sources[observation.source_id].url+'"'),'registered source URL remains the fallback');
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');
 assert.match(template,/Component values rounded for display; source data retains full precision/);
});
