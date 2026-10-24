const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadOCR}=require('../lib/load.cjs');
const {build}=require('../lib/ranking.cjs');

const domains=['academic','education','legal_gov','business','finance','medical','publishing','technical','logistics','certificate'];
const tracks=['clean','digital','real'];
const components={overall:['percent','higher'],text_edit:['ratio','lower'],formula_cdm:['percent','higher'],table_teds:['percent','higher'],reading_edit:['ratio','lower']};
const revision='fdae62435871eb7ba058a804574ad1a9d2fd6cf1';

test('GLM PureDoc retains all published domain scopes, source precision and mixed metric units',()=>{
 const data=loadOCR(),benchmark=data.tests.find(t=>t.id==='puredoc');
 const record=data.rawRecords.find(r=>r.model==='glm-5-3-flash'&&r.benchmark==='puredoc');
 const expected=domains.flatMap(domain=>tracks.flatMap(track=>Object.keys(components).map(metric=>'domain_'+domain+'_'+track+'_'+metric)));
 assert.equal(expected.length,150);
 assert.deepEqual(Object.keys(record.metrics).filter(key=>key.startsWith('domain_')).sort(),expected.slice().sort());
 for(const domain of domains)for(const track of tracks)for(const [metric,[unit,direction]] of Object.entries(components)){
  const key='domain_'+domain+'_'+track+'_'+metric,value=record.metrics[key];
  assert.ok(Number.isFinite(value)&&value>=0&&value<=(unit==='ratio'?1:100),key);
  assert.equal(benchmark.metric_units[key],unit,key+' unit');
  assert.equal(benchmark.metric_directions[key],direction,key+' direction');
  assert.ok(benchmark.metric_labels[key],key+' label');
 }
 assert.equal(record.source_revision,revision);
 assert.equal(record.category_component_source_url,'https://github.com/zhihengli-casia/PureDocBench/blob/'+revision+'/results/category_components.csv');
 // Independent anchors copied from that pinned CSV, without display rounding.
 assert.equal(record.metrics.domain_academic_clean_overall,93.9733338284974);
 assert.equal(record.metrics.domain_finance_real_text_edit,0.3528610203812);
 assert.equal(record.metrics.domain_certificate_real_reading_edit,0.652684467687811);
 assert.equal(record.metrics.domain_legal_gov_clean_formula_cdm,94.8);
 assert.deepEqual(['clean','digital','real','avg3'].map(key=>record.metrics[key]),[83.04,81.03,74.99,79.69]);
 assert.match(record.note,/unweighted mean must not replace global/);
});

test('domain component detail changes neither selected overall values nor aggregate contributions',()=>{
 const data=loadOCR();
 const ranking=()=>build(data,undefined,{min:0}).rows.map(row=>({
  id:row.id,rank:row.rank,coreCount:row.coreCount,
  contributions:row.rankContributions.map(c=>({benchmark:c.benchmark,family:c.family,percentile:c.percentile,cohortSize:c.cohortSize,source:c.observation.source_id,value:c.observation.value}))
 }));
 const withDomains=ranking();
 for(const record of data.rawRecords){
  if(record.model!=='glm-5-3-flash'||record.benchmark!=='puredoc')continue;
  for(const key of Object.keys(record.metrics))if(key.startsWith('domain_'))delete record.metrics[key];
 }
 assert.deepEqual(ranking(),withDomains,'all rows retain the same contribution values and cohort ranks');
});

test('official model cards establish open weights without supplying historical run revisions',()=>{
 const data=loadOCR();
 for(const [id,organization,url] of [
  ['glm-5-3-flash','Z.ai','https://huggingface.co/zai-org/GLM-5.3-Flash'],
  ['kimi-k3','Moonshot AI','https://huggingface.co/moonshotai/Kimi-K3']
 ]){
  const model=data.models.find(m=>m.id===id);
  assert.equal(model.access,'open');
  assert.equal(model.organization,organization);
  assert.equal(data.sources[model.source_id].url,url);
  assert.match(model.evidence_note,/checkpoint/);
  assert.notEqual(model.release_source_id,model.source_id,'availability card is not a release-date citation');
 }
 assert.equal(data.models.find(m=>m.id==='kimi-k3').release_date,null);
});
