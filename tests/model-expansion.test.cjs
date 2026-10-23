const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadOCR}=require('../lib/load.cjs');
const {build,choose}=require('../lib/ranking.cjs');
const data=loadOCR();
const additions=require('../data/ocr/research-missing-models-2026-10-13.json').added_models;

test('every requested addition is discoverable without inventing core coverage',()=>{
 const catalog=build(data,data.config.snapshot_date,{min:0});
 for(const id of additions){const model=data.models.find(m=>m.id===id),row=catalog.rows.find(r=>r.id===id);assert.ok(model&&row,id);assert.ok(data.sources[row.modelSourceId],id);assert.ok(row.modelNote,id);}
 for(const id of ['docling-pipeline','amazon-textract','google-docai-ocr','tesseract']){
  const row=catalog.rows.find(r=>r.id===id);assert.equal(row.count,0);assert.equal(row.rank,null);assert.equal(data.records.some(r=>r.model===id && data.tests.find(t=>t.id===r.benchmark).core),false);
 }
});
test('Jina qualifies provisionally while LightOn task tests never manufacture rank families',()=>{
 const rows=build(data,data.config.snapshot_date,{min:0}).rows;
 const jina=rows.find(r=>r.id==='jina-ocr-v1');assert.equal(jina.coreCount,2);assert.equal(jina.rankStatus,'provisional');assert.ok(jina.provisionalReasons.some(r=>r.includes('author-reported')));
 for(const size of ['0.8','1','4']){const row=rows.find(r=>r.id==='lightonocr-3-'+size+'b');assert.equal(row.coreCount,1);assert.equal(row.rank,null);assert.equal(row.count,1);}
 const research=build(data,data.config.snapshot_date,{view:'new'});
 for(const id of ['jina-ocr-v1','lightonocr-3-4b','nemotron-parse-2','hiro-moss-ocr-0-3b'])assert.ok(research.rows.some(r=>r.id===id),id);
});
test('ground-truth layout and task-only results remain distinct from full parsing',()=>{
 assert.equal(choose(data,'hiro-moss-ocr-0-3b','omnidoc-v16'),null);
 assert.equal(choose(data,'hiro-moss-ocr-0-3b','omnidoc-v16-gt-layout-moss').value,94.46);
 assert.equal(choose(data,'nemotron-parse-2','omnidoc-v16'),null);
 assert.equal(choose(data,'nemotron-parse-2','omnidoc-notes-nemotron').value,.3395);
 assert.equal(data.tests.find(t=>t.id==='omnidoc-notes-nemotron').direction,'lower');
 for(const id of require('../data/ocr/research-missing-models-2026-10-13.json').new_secondary_variants){const t=data.tests.find(t=>t.id===id);assert.equal(t.core,false);assert.equal(t.primary,false);}
 assert.equal(choose(data,'jina-ocr-v1','parsebench-lighton-202610').metrics.visual_grounding,0);
});
test('page-rate tiers and API modes preserve the standard volume configuration',()=>{
 for(const [id,value] of [['amazon-textract',1.5],['google-docai-ocr',1.5],['mathpix-ocr',5]]){const selected=data.pricingByModel[id];assert.equal(selected.usd_per_1000_pages,value);assert.equal(selected.comparison_default,true);assert.equal(selected.version_scope,'current_service');assert.equal(data.priceInfoByModel[id].label,'$'+value.toFixed(2)+'†');}
 assert.equal(data.pricing.filter(p=>p.model==='mathpix-ocr').length,4);
 assert.equal(data.pricing.some(p=>p.model==='tesseract'),false);
});
test('verified availability dates apply to historical cohorts while undated catalogs stay current-only',()=>{
 let rows=build(data,'2026-10-07',{min:0}).rows;
 assert.equal(rows.some(r=>r.id.startsWith('lightonocr-3-')),false);
 rows=build(data,'2026-10-08',{min:0}).rows;assert.equal(rows.filter(r=>r.id.startsWith('lightonocr-3-')).length,3);
 assert.equal(rows.some(r=>r.id==='tesseract'),false);
 const jina=data.models.find(m=>m.id==='jina-ocr-v1');assert.equal(jina.release_date,'2026-09-14');assert.equal(jina.release_source_id,'jina-ocr-v1-release');
});
