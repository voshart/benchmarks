const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');

test('GLM OpenOCR receipt retains the exact hard corpus, zero results, and source limitations',()=>{
 const data=loadOCR(),record=data.rawRecords.find(r=>r.model==='glm-5-3-flash'&&r.benchmark==='openocr-hard');
 assert.ok(record);
 assert.deepEqual(record.metrics,{quality:55,ci95:7.96,degraded:61.5,math:0,tables:68,columns:90.5,blank_page:100,blank_penalty:0});
 assert.equal(record.source_url,'https://open-ocr.com/rankings/z-ai/glm-5.3-flash');
 assert.equal(record.dataset_version,'olmocr-hard-20/v2');
 assert.equal(record.scorer_version,'olmocr-bench-harness/2026-07 + openocr four-category mean (in-repo v3)');
 assert.equal(record.page_count,20);assert.equal(record.sample_count,141);
 assert.equal(record.source_rank,33);assert.equal(record.source_ranked_models,97);
 assert.equal(record.run_date,'2026-08-29');
 assert.match(record.measurement_operator,/OpenOCR.*OpenRouter/);
 assert.match(record.provisional_reasons.join(' '),/immutable backend/);
 assert.match(record.provisional_reasons.join(' '),/2026-08-29.*2026-08-31/);
 assert.equal(data.models.find(m=>m.id==='glm-5-3-flash').release_provenance,'legacy_import');
 assert.equal(record.metrics.quality,(record.metrics.degraded+record.metrics.math+record.metrics.tables+record.metrics.columns)/4);
 assert.notEqual(record.comparable,false,'source-named generation uses existing qualified evidence rules');
 assert.equal(data.rawRecords.some(r=>r.model==='kimi-k3'&&r.benchmark==='openocr-hard'),false,'the separate 11-image clean result is not a hard-corpus measurement');
});

test('new GLM observation changes only its eligible OpenOCR cohort through existing family weighting',()=>{
 const data=loadOCR(),without=structuredClone(data);
 const keep=r=>!(r.model==='glm-5-3-flash'&&r.benchmark==='openocr-hard');
 without.records=without.records.filter(keep);without.rawRecords=without.rawRecords.filter(keep);
 delete without.resultsByKey['glm-5-3-flash|openocr-hard'];
 const before=build(without),after=build(data),prior=new Map(before.rows.map(r=>[r.id,r]));
 const cohort=new Set(data.records.filter(r=>r.benchmark==='openocr-hard').map(r=>r.model));
 const changed=after.rows.filter(r=>r.rank!==prior.get(r.id).rank).map(r=>r.id).sort();
 assert.deepEqual(changed,[...cohort].sort(),'only the existing OpenOCR participants and GLM change numeric indices');
 const glm=after.rows.find(r=>r.id==='glm-5-3-flash');
 assert.deepEqual(glm.rankContributions.map(c=>c.family).sort(),['openocr','puredoc']);
 assert.equal(glm.rank,glm.rankContributions.reduce((sum,c)=>sum+c.percentile,0)/2);
 assert.equal(glm.rankStatus,'provisional');assert.match(glm.rankExplanation,/20 pages/);
 assert.equal(glm.scores.olmocr,null,'small hard subset is not imported as full olmOCR-Bench');
 for(const row of after.rows){
  for(const [id,observation] of Object.entries(prior.get(row.id).scores)){
   if(observation)assert.equal(row.scores[id]?.value,observation.value,'existing headline unchanged: '+row.id+' / '+id);
  }
 }
});
