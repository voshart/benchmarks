const {test}=require('node:test'),assert=require('node:assert/strict');
const data=require('../lib/load.cjs').loadOCR(),Rank=require('../lib/ranking.cjs'),OCR=require('../src/assets/js/ocr-comparison.js');
test('Gemini3.8 exact protocols and tariff retain their cells under configured column order',()=>{
 const result=Rank.build(data),row=result.rows.find(r=>r.id==='gemini-3-8-flash');assert.equal(result.columns.length,13);
 assert.equal(row.scores['omniparse-datalab-overall-20261023'].value,92.9);
 const parse=row.scores['parsebench-published-9af4102'];assert.equal(parse.value,70.7);assert.equal(parse.metrics.high_overall,72.08);assert.equal(parse.metrics.low_overall,70.15);assert.match(parse.configuration,/Medium.*API-default/);
 const rf=row.scores['roboflow-ocr-202610'];assert.equal(rf.value,78.7);assert.equal(rf.metrics.low,72.8);
 assert.ok(Math.abs(row.scores['inksight-public-handwriting-202610'].value-16.778607801980428)<1e-10);
 assert.equal(row.rank,60);assert.deepEqual(row.rankContributions.map(c=>c.percentile),[85,35]);
 const other=OCR.cellObservation(row,result.columns.find(t=>t.id==='reported-other'),data,result.columns);assert.equal(other.test.id,'parsebench-published-9af4102');assert.equal(other.observation.value,70.7);
 const d=OCR.deployment(data,data.models.find(m=>m.id===row.id));assert.equal(d.cost.value,4.5);assert.equal(d.cost.kind,'token scenario');assert.match(d.cost.note,/2026-12-31/);assert.equal(d.speed,null);assert.equal(d.records.length,2);assert.ok(d.records.every(r=>!r.comparison_default&&!r.cost_eligible));
 const html=OCR.renderRows({...result,rows:[row]},data);assert.match(html,/≈\$4.50/);assert.match(html,/data-protocol="parsebench-published-9af4102"/);assert.match(html,/>70.7<\/a>/);assert.doesNotMatch(html,/available-scores|inline-score/);
});
