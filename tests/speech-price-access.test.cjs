const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSTT}=require('../lib/load-stt.cjs');
const {validateSTT}=require('../lib/validate-stt.cjs');
const Speech=require('../src/assets/js/speech.js');
const data=loadSTT();
test('every hosted model has sourced price or dated actionable access context',()=>{
 for(const model of data.models.filter(m=>m.access==='closed')) {
  const price=Speech.selectPrice(data,model.id),context=data.pricingContexts.find(c=>c.model===model.id);
  assert.ok(price||context,model.id);
  if(context) {assert.equal(context.verified_on,'2026-10-22');assert.ok(context.source_urls.length);assert.ok(context.note.length>50);}
 }
 assert.equal(data.pricingContexts.length,17);
});
test('new exact-model API rates normalize correctly and retain product scope',()=>{
 for(const [model,amount] of Object.entries({'sprag-symphony':.09,'speechmatics-enhanced':.75,'revai-machine':.20,'google-chirp':.96,'microsoft-azure-speech-07-2026':.36,'meta-muse-voice-transcribe':.18})) {
  const record=Speech.selectPrice(data,'stt-'+model);assert.equal(record.amount,amount,model);assert.equal(record.version_scope,'current_service');
 }
 assert.equal(Speech.selectPrice(data,'stt-revai-machine').language,'en');
 for(const model of ['otterai-speech-v3-1','zoom-scribe-v1','zoom-scribe-v2-pro','reson8-resonant-1','reson8-resonant-1-flash','microsoft-azure-speech-06-2026','revai-fusion','assemblyai-universal-3-pro']) assert.equal(Speech.selectPrice(data,'stt-'+model),null,model);
});
test('token estimates and subscription context never masquerade as flat model tariffs',()=>{
 const result=Speech.build(data,{missing:true,compact:true});
 for(const [id,value] of [['stt-soniox-stt-async-v5',.10],['stt-gemini-gemini-3-5-transcribe',.30]]) {
  const row=[...result.rows,...result.unscoredRows].find(r=>r.id===id);assert.equal(row.price,null);assert.equal(Speech.costSortValue(row),value);assert.equal(row.priceContext.hourly_estimate.basis,'vendor_estimate');
 }
 const otter=result.rows.find(r=>r.id==='stt-otterai-speech-v3-1');assert.equal(Speech.costSortValue(otter),undefined);assert.match(otter.priceContext.note,/NOT API prices/);
 const rendered=Speech.renderRows(result,data)+Speech.renderUnscored(result,data);assert.match(rendered,/token est\./);assert.match(rendered,/Subscription/);assert.match(rendered,/€0\.16/);assert.match(rendered,/Retired/);
});
test('price sorting leaves nonnumeric contexts last in both directions and never changes accuracy ranks',()=>{
 const base=Speech.build(data,{compact:true});const ranks=base.rows.map(r=>[r.id,r.benchmarkRank,r.benchmarkValue]).sort();
 for(const sortDirection of ['asc','desc']) {
  const result=Speech.build(data,{compact:true,sort:'price',sortDirection});assert.deepEqual(result.rows.map(r=>[r.id,r.benchmarkRank,r.benchmarkValue]).sort(),ranks);
  let unknown=false; for(const row of result.rows) {const n=Speech.costSortValue(row);if(n==null)unknown=true;else assert.equal(unknown,false);}
 }
 assert.equal(base.priceCount,8);assert.equal(base.localCostCount,23);
 const clone=structuredClone(data);clone.pricingContexts[0].verified_on='invalid';assert.throws(()=>validateSTT(clone));
});
