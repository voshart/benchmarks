const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');
const OCR=require('../src/assets/js/ocr-comparison.js');
const ledger=require('../data/ocr/datalab-scoreboard-audit-20261023.json');
const data=loadOCR();
test('all33 Datalab scoreboard observations are represented with exact protocol and label',()=>{
 assert.equal(ledger.rows.length,33);assert.equal(ledger.rows.filter(r=>r.status==='already_exact_do_not_duplicate').length,3);
 for(const entry of ledger.rows){const matches=data.resultsByKey[entry.model+'|'+entry.test]||[];assert.ok(matches.some(r=>r.metrics[entry.metric||'overall']===entry.score),entry.source_label+' '+entry.board);}
 for(const board of ['overall','tables','multi-column']){const id='omniparse-datalab-'+board+'-20261023',test=data.tests.find(t=>t.id===id);assert.equal(test.core,false);assert.equal(test.primary,false);assert.equal(data.records.filter(r=>r.benchmark===id).length,10);}
});
test('verified Chandra service identity preserves distinct run measurements and unknown revision dates',()=>{
 const rows=build(data).rows;
 const accurate=data.models.find(m=>m.id==='datalab-accurate-20261020');assert.equal(accurate.name,'Chandra 2.5 (accurate)');assert.equal(accurate.source_id,'datalab-convert-chandra-2-5');assert.equal(data.sources[accurate.source_id].url,'https://www.datalab.to/platform/processors/convert');
 for(const board of ['overall','tables','multi-column']){const id='omniparse-datalab-'+board+'-20261023',observation=data.resultsByKey[accurate.id+'|'+id][0];assert.equal(observation.run_date,'2026-10-20');assert.match(observation.configuration,/Chandra 2\.5 accurate/);assert.doesNotMatch(data.tests.find(t=>t.id===id).label,/Oct8\/20/);}
 for(const id of ['datalab-accurate-20261020','datalab-balanced-omniparse-20261008','gemini-3-8-flash','reducto-omniparse-20261008','llamaparse-omniparse-20261008','mistral-ocr-omniparse-20261008','extend-omniparse-20261008','azure-content-understanding-omniparse-20261008']){
  const row=rows.find(r=>r.id===id);assert.ok(row,id);assert.ok(Number.isFinite(row.rank));assert.equal(row.coreCount,id==='gemini-3-8-flash'?2:1);assert.equal(row.rankStatus,'provisional');assert.equal(data.models.find(m=>m.id===id).release_date,null);
 }
 assert.equal(data.resultsByKey['chandra-2-5-api|omniparse-chandra-2-5-release'][0].metrics.accurate,92.7);
 assert.equal(data.resultsByKey['datalab-accurate-20261020|omniparse-datalab-overall-20261023'][0].value,93.5);
 assert.equal(data.resultsByKey['azure-document-intelligence|omniparse-datalab-overall-20261023'],undefined);
 for(const [id,price] of [['datalab-accurate-20261020',10],['datalab-balanced-omniparse-20261008',4]]){const d=OCR.deployment(data,data.models.find(m=>m.id===id));assert.equal(d.cost.value,price);assert.equal(d.speed,null);assert.equal(d.reference?.status,undefined);}
 const chandra=rows.find(r=>r.id==='datalab-accurate-20261020');const html=OCR.renderRows({rows:[chandra],columns:[],ranges:{}},data);assert.match(html,/Reported benchmark results/);assert.match(html,/93.5/);assert.match(html,/95.2/);assert.match(html,/94.2/);
});
