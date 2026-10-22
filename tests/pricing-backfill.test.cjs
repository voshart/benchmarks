const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSTT}=require('../lib/load-stt.cjs');
const Speech=require('../src/assets/js/speech.js');
const data=loadSTT();

test('Scribe v2 and GPT-Transcribe use verified exact-model duration tariffs',()=>{
 for(const [id,provider,source,amount,unit,published,tier] of [
  ['stt-elevenlabs-scribe-v2','ElevenLabs','elevenlabs-scribe-v2-pricing',0.22,'currency_per_audio_hour',0.22,'Pay As You Go'],
  ['stt-openai-gpt-transcribe','OpenAI','openai-gpt-transcribe-pricing',0.27,'currency_per_audio_minute',0.0045,'Standard API']
 ]) {
  const record=Speech.selectPrice(data,id);
  assert.equal(record.provider,provider);assert.equal(record.source_id,source);
  assert.equal(record.mode,'pre-recorded');assert.equal(record.tier,tier);
  assert.equal(record.currency,'USD');assert.equal(record.unit,'currency_per_audio_hour');
  assert.equal(record.amount,amount);assert.equal(record.published_unit,unit);assert.equal(record.published_amount,published);
  assert.equal(record.basis,'vendor_list');assert.equal(record.version_scope,'current_service');
  assert.equal(record.verification_status,'verified');assert.equal(record.verified_on,'2026-10-22');
  assert.equal(data.sources[source].verified_on,'2026-10-22');
  assert.equal(Speech.build(data).rows.find(row=>row.id===id).price.source_id,source);
 }
 assert.match(data.sources['openai-gpt-transcribe-pricing'].url,/\/models\/gpt-transcribe$/);
 assert.match(data.sources['openai-gpt-transcribe-pricing'].quote,/Transcription audio duration/);
 assert.match(data.sources['elevenlabs-scribe-v2-pricing'].url,/elevenlabs\.io\/pricing\/api/);
 assert.equal(Speech.selectPrice(data,'stt-openai-whisper-large-v3'),null);
});

test('Modulate and Pulse preserve batch defaults, streaming alternatives and approximate rates',()=>{
 for(const [id,provider,source,batch,stream,approximate] of [
  ['stt-modulate-multilingual','Modulate','modulate-multilingual-pricing',0.03,0.06,false],
  ['stt-smallestai-pulse','Smallest AI','smallest-pulse-pricing',0.18,0.24,true]
 ]) {
  const records=data.pricing.filter(record=>record.model===id);
  assert.equal(records.length,2);
  const selected=Speech.selectPrice(data,id);
  assert.equal(selected.mode,'pre-recorded');assert.equal(selected.amount,batch);
  assert.equal(selected.source_id,source);assert.equal(selected.provider,provider);
  assert.equal(selected.currency,'USD');assert.equal(selected.unit,'currency_per_audio_hour');
  assert.equal(selected.tier,'Pay As You Go');assert.equal(selected.version_scope,'current_service');
  for(const record of records) {
   assert.equal(record.verification_status,'verified');assert.equal(record.verified_on,'2026-10-22');
   assert.equal(Boolean(record.approximate),approximate);
  }
  const alternate=records.find(record=>record.mode==='streaming');
  assert.equal(alternate.amount,stream);assert.equal(alternate.comparison_default,false);
  assert.equal(data.sources[source].verified_on,'2026-10-22');
 }
 const pulse=Speech.selectPrice(data,'stt-smallestai-pulse');
 assert.equal(pulse.published_unit,'currency_per_audio_minute');assert.equal(pulse.published_amount,0.003);
 assert.match(pulse.note,/Approximate/);
});


test('approximate price is visibly marked without losing numeric sorting precision',()=>{
 const Speech=require('../src/assets/js/speech.js');
 const d=require('../src/_data/stt.cjs')();
 const r=Speech.build(d,{compact:true,query:'smallestai'});
 assert.match(Speech.renderRows(r,d),/≈\$0\.18/);
 assert.equal(r.rows.find(row=>row.id==='stt-smallestai-pulse').price.amount,0.18);
});
