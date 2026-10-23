const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
test('default catalog exposes secondary-only models without inventing aggregate scores',()=>{
 const data=loadOCR(),all=build(data),filtered=build(data,data.config.snapshot_date,{min:2});
 for(const id of ['chandra-2-5-api','gemini-4-argon']){
  const row=all.rows.find(r=>r.id===id);assert.ok(row,id);assert.equal(row.rank,null);assert.equal(row.coreCount,0);
  const html=OCR.renderRows({...all,rows:[row]},data);assert.doesNotMatch(html,/>Reported results</);assert.match(html,/No comparable overall index/);assert.match(html,/Reported benchmark results/);assert.doesNotMatch(html,/No benchmark results recorded/);
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

test('default Matrix shows Chandra release scores as sortable protocol columns, not only Details',()=>{
 const data=loadOCR(),all=build(data),ids=all.columns.map(t=>t.id);
 for(const id of ['omniparse-chandra-2-5-release','chandra-2-5-olm-no-hf','omniparse-datalab-overall-20261023'])assert.ok(ids.includes(id));
 const row=all.rows.find(r=>r.id==='chandra-2-5-api');
 const html=OCR.renderRows({...all,rows:[row]},data),cells=html.slice(html.indexOf('</th>'));
 assert.match(cells,/>92\.7<\/a>/);assert.match(cells,/>86\.9<\/a>/);assert.equal(row.rank,null);
 assert.match(OCR.renderHead(all),/data-ocr-sort="omniparse-chandra-2-5-release"/);
 const key='chandra-2-5-olm-no-hf',rows=OCR.enrich(all,data).rows;
 for(const direction of ['asc','desc']){const sorted=OCR.sortRows(rows,key,direction),values=sorted.map(r=>r.scores[key]?.value).filter(v=>v!=null);assert.deepEqual(values,[...values].sort((a,b)=>direction==='asc'?a-b:b-a));}
});

test('other recorded protocols remain visible in model cells without opening Details',()=>{
 const data=loadOCR(),all=build(data,data.config.snapshot_date,{view:'structure'}),row=all.rows.find(r=>r.id==='gemini-4-argon');
 const html=OCR.renderRows({...all,rows:[row]},data),inline=html.match(/<div class="ocr-inline-scores"[\s\S]*?<button/)[0];
 assert.match(inline,/[0-9]+\.[0-9]+/);assert.match(inline,/href=/);assert.doesNotMatch(inline,/popover/);
});

test('Matrix exposes all recorded protocols regardless of core or primary status',()=>{
 const data=loadOCR(),all=build(data);
 assert.deepEqual(new Set(all.columns.map(t=>t.id)),new Set(data.tests.filter(t=>all.rows.some(r=>r.scores[t.id]?.value!=null)).map(t=>t.id)));
 const enriched=OCR.enrich(all,data);
 for(const t of all.columns){
  for(const direction of ['asc','desc']){
   const rows=OCR.sortRows(enriched.rows,t.id,direction),values=rows.map(r=>r.scores[t.id]?.value).filter(v=>v!=null);
   assert.deepEqual(values,[...values].sort((a,b)=>direction==='asc'?a-b:b-a),t.id);
  }
 }
});
