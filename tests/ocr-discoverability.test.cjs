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
 assert.match(html,/>92\.7<\/a>/);assert.match(html,/>86\.9<\/a>/);assert.match(html,/olm no H\/F/);
 const gemini=all.rows.find(r=>r.id==='gemini-3-8-flash');assert.match(OCR.renderRows({...all,rows:[gemini]},data).split('</th>')[1],/>92\.9<\/a>/);
 const template=fs.readFileSync(require.resolve('../src/ocr/index.njk'),'utf8');assert.doesNotMatch(template,/id="ocrBenchmark"/);
});

test('variant fallback never becomes a main-protocol sorting value or aggregate vote',()=>{
 const data=loadOCR(),all=build(data),row=all.rows.find(r=>r.id==='chandra-2-5-api');
 assert.equal(row.scores.olmocr,null);assert.equal(row.rankContributions[0].benchmark,'chandra-2-5-olm-no-hf');
 const cell=OCR.cellObservation(row,data.tests.find(t=>t.id==='olmocr'),data,all.columns);
 assert.equal(cell.observation.value,86.9);assert.equal(cell.variant,true);
});
