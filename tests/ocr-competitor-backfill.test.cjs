const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
const data=loadOCR();
test('competitor panels preserve full, subset and PDF-text-assisted protocols',()=>{
 const rows=build(data,data.config.snapshot_date,{min:0}).rows;
 const get=id=>rows.find(r=>r.id===id);
 assert.equal(data.resultsByKey['lightonocr-3-4b|chandra-2-5-olm-no-hf'][0].metrics.pp3,86);
 assert.equal(get('lightonocr-3-4b').coreCount,1);
 for(const id of ['marker2-pdf-pipeline','parsebench-published-9af4102']){const t=data.tests.find(t=>t.id===id);assert.equal(t.core,false);assert.equal(t.primary,false);}
 assert.equal(get('docling-pipeline').rank,null);
 assert.equal(get('docling-pipeline').scores['marker2-pdf-pipeline'].value,50.3);
 assert.equal(data.resultsByKey['ovisocr2|olmocr'].find(r=>r.source_id==='lighton3-pinned-olm-reproduction').metrics.overall,70.5);
 assert.equal(data.resultsByKey['hunyuanocr-1-5|omnidoc-v16'].find(r=>r.source_id==='jina-quoted-omnidoc16').evidence,'secondary');
 assert.equal(data.models.some(m=>/surya.*2[.-]5/i.test(m.id)),false);
});
test('exact checkpoint competitor speeds never become measurements of normalized estimates',()=>{
 for(const id of ['infinity-parser2-flash','kdl-frontier-parser-nano','mineru2-5-pro-2605']){
  const model=data.models.find(m=>m.id===id),d=OCR.deployment(data,model);
  assert.equal(model.release_date,null);assert.equal(d.reference.status,'estimated');assert.equal(d.reference.confidence,'low');
  assert.equal(d.cost.kind,'H100 scenario');assert.equal(d.cost.low,1000/(3600*d.reference.high));
  assert.ok(d.records.some(r=>r.source_id==='small-specialist-nemotron-matched-timing'&&!r.comparison_default));
  assert.equal(build(data,data.config.snapshot_date,{min:0}).rows.find(r=>r.id===id).rank,null);
 }
 assert.ok(data.throughput.some(r=>r.model==='dots-mocr'&&r.pages_per_second===.55));
 assert.ok(data.throughput.some(r=>r.model==='infinity-parser-7b'&&r.pages_per_second===.64));
 const pairs=data.throughput.map(r=>r.model+'|'+r.source_id);
 for(const source of ['small-specialist-jina-throughput','small-specialist-nemotron-matched-timing']){const subset=pairs.filter(p=>p.endsWith('|'+source));assert.equal(subset.length,new Set(subset).size);}
});
