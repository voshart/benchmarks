const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const stt=require('../lib/load-stt.cjs').loadSTT();
const ocr=require('../lib/load.cjs').loadOCR();
const Speech=require('../src/assets/js/speech.js');
const Estimates=require('../src/assets/js/speech-estimates.js');
const Rank=require('../lib/ranking.cjs');

test('October release audit adds bounded identities without mixing task catalogs',()=>{
 const speechAudit=require('../data/stt/research-release-audit-2026-10-22.json');
 const ocrAudit=require('../data/ocr/research-release-audit-2026-10-22.json');
 assert.equal(speechAudit.added_models.length,7);
 assert.equal(ocrAudit.added_models.length,9);
 for(const [data,audit,other] of [[stt,speechAudit,ocr],[ocr,ocrAudit,stt]]) for(const id of audit.added_models){
  const m=data.models.find(x=>x.id===id);assert.ok(m,id);assert.ok(data.sources[m.source_id]);assert.ok(!other.models.some(x=>x.id===id));
 }
 assert.ok(stt.config.accuracy_tests.includes('ibm-granite-plus-v2610-author-2026-10'));
 assert.equal(stt.accuracyTests.find(t=>t.id==='ibm-granite-plus-v2610-author-2026-10').summary_label,'LibriSpeech clean');
 assert.match(fs.readFileSync('src/stt/index.njk','utf8'),/test.summary_label/);
 assert.equal(stt.config.snapshot_date,'2026-10-22');assert.equal(ocr.config.snapshot_date,'2026-10-22');
});

test('Granite5.0 uses exact seven original columns, not publisher expanded-set average',()=>{
 const lines=fs.readFileSync('data/stt/evidence/open-asr-2026-10-21.csv','utf8').trim().split('\n');
 const values=Object.fromEntries(lines[0].split(',').map((key,i)=>[key,lines.find(x=>x.startsWith('ibm-granite/granite-speech-5.0-2b,')).split(',')[i]]));
 const record=stt.rawRecords.find(x=>x.model==='stt-ibm-granite-granite-speech-5-0-2b');
 const protocol=stt.accuracyTests.find(x=>x.id===stt.config.default_test);
 for(const metric of protocol.metrics)assert.equal(record.metrics[metric.id],Number(values[metric.source_column]));
 const row=Speech.build(stt).rows.find(x=>x.id===record.model);
 assert.ok(Math.abs(row.benchmarkValue-31.4/7)<1e-10);
 assert.equal(Speech.build(stt).benchmarkCount,65);
});

test('revised IBM weights cannot inherit old revision speed or accuracy',()=>{
 for(const id of ['stt-ibm-granite-granite-speech-4-1-2b-plus-v2610','stt-granite-turboctc-multilingual-2610']){
  const m=stt.models.find(x=>x.id===id),deployment=Estimates.getDeployment(stt,m,Speech.selectSize(stt,id));
  assert.ok(m.model_revision);assert.equal(deployment.speed,null);assert.equal(deployment.cost,null);assert.ok(deployment.memory.fp16_weights_gb>0);
  assert.ok(!stt.rawRecords.some(r=>r.model===id&&r.benchmark===stt.config.default_test));
 }
});

test('exact Hub deployment transfer requires matching revision when pinned',()=>{
 const model={...stt.models.find(m=>m.id==='stt-openai-whisper-large-v3'),model_revision:'abcdef1234567890'};
 const candidate=stt.models.find(m=>m.configuration_kind==='runtime_conversion'&&m.upstream_hub_id===model.hub_id);
 assert.ok(candidate);
 const scenario=commit=>({...stt,models:stt.models.map(m=>m.id===candidate.id?{...m,upstream_commit:commit}:m)});
 assert.ok(Estimates.getDeployment(scenario('abcdef1'),model,null).speed);
 assert.equal(Estimates.getDeployment(scenario('1234567'),model,null),null);
 assert.equal(Estimates.getDeployment(scenario(null),model,null),null);
});

test('new OCR author panels remain separate and currency conversion preserves contextual tariff status',()=>{
 const rows=Rank.build(ocr,undefined,{min:0}).rows;
 for(const id of ['ovisocr3','indra-ocr-1-1'])assert.equal(rows.find(r=>r.id===id).rank,null,id);for(const id of ['logics-parsing-v3','sarvam-vision-2-1','bodhan-indic-ocr'])assert.equal(rows.find(r=>r.id===id).rankStatus,'provisional',id);
 for(const id of ['omnidoc-ovis3-reported','omniparse-indra-1-1','mpdoc-logics-v3']){const protocol=ocr.tests.find(x=>x.id===id);assert.equal(protocol.core,false);assert.equal(protocol.primary,false);}
 assert.equal(rows.find(r=>r.id==='sarvam-vision-2-1').scores.olmocr.value,87.3);
 assert.equal(rows.find(r=>r.id==='logics-parsing-v3').scores['omnidoc-v16'].value,95.58);
 assert.match(ocr.priceInfoByModel['sarvam-vision-2-1'].label,/≈\$5\.27†/);
 assert.match(ocr.priceInfoByModel['sarvam-vision-2-1'].note,/Original tariff: INR 500/);
 assert.match(ocr.priceInfoByModel['falcon-ocr-arabic'].label,/Demo only/);
 assert.equal(ocr.pricingByModel['sarvam-vision-2-1'],undefined);
});
