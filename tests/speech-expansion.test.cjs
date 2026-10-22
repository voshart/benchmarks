const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadSTT}=require('../lib/load-stt.cjs');
const {validateSTT}=require('../lib/validate-stt.cjs');
const Speech=require('../src/assets/js/speech.js');
const Matrix=require('../src/assets/js/speech-matrix.js');
const Rank=require('../lib/ranking.cjs');
const data=loadSTT();
const byHub=hub=>data.models.find(model=>model.hub_id===hub);
const getRow=(result,id)=>result.rows.find(row=>row.id===id);

test('full expansion preserves raw observations, missing long-form values and separate corpus roles',()=>{
 validateSTT(data);
 assert.equal(data.models.length,172);
 assert.equal(data.rawRecords.length,975);
 assert.equal(data.accuracyTests.length,11);
 assert.equal(data.rawRecords.filter(record=>record.benchmark==='open-asr-longform').length,27);
 const m=byHub('nvidia/stt_en_conformer_transducer_small');
 const record=data.rawRecords.find(record=>record.model===m.id&&record.benchmark==='open-asr-longform');
 assert.equal(record.metrics.coraal,null);
 const standard=byHub('nvidia/parakeet-tdt-0.6b-v3');
 const summary=Speech.summarize(data,data.accuracyTests.find(test=>test.id==='open-asr-longform'),standard.id);
 assert.equal(summary.mean,15.57);
 assert.equal(summary.scores.earnings22.value,14.58);
 assert.equal(summary.summary.components.length,1);
 assert.equal(summary.summary.components[0].metric,'coraal');
 for (const id of ['open-asr-mcv','open-asr-mls','open-asr-robustness','handy-fleurs-en','handy-librispeech-clean']) assert.equal(data.accuracyTests.find(test=>test.id===id).core,false);
});

test('fixed FLEURS panel retains five exact sources and never fills missing languages',()=>{
 const model=byHub('nvidia/parakeet-tdt-0.6b-v3');
 const protocol=data.accuracyTests.find(test=>test.id==='open-asr-fleurs');
 const summary=Speech.summarize(data,protocol,model.id);
 assert.notEqual(summary.mean,null);
 assert.equal(summary.summary.source_ids.length,5);
 assert.deepEqual(summary.summary.components.map(component=>component.metric),['fr','de','es','it','pt']);
 assert.equal(protocol.metrics.some(metric=>metric.id==='hy'),true);
 const expanded=Speech.build(data,{test:protocol.id,extra:true,query:'parakeet-tdt-0.6b-v3'});
 assert.equal(getRow(expanded,model.id).mean,summary.mean);
 const altered=structuredClone(data);
 altered.resultsByKey[model.id+'|open-asr-fleurs:pt'][0].value=null;
 assert.equal(Speech.summarize(altered,protocol,model.id).mean,null);
 assert.equal(Speech.summarize(altered,protocol,model.id).scores.fr.value,4.68);
 assert.equal(protocol.metrics.find(metric=>metric.id==='fr').dataset.repository,'nithinraok/asr-leaderboard-datasets');
 assert.equal(protocol.metrics.find(metric=>metric.id==='fr').dataset.config,'fleurs_fr');
 const hindi=data.accuracyTests.find(test=>test.id==='open-asr-monsoon-hi');
 assert.equal(hindi.metrics[0].unit,'oiwer_percent');assert.equal(hindi.core,false);
 assert.equal(hindi.metrics[0].dataset.repository,'VoiceArena/Monsoon_hi_test');
});

test('maintainer publication priority is separate from known author execution',()=>{
 const altered=structuredClone(data);
 const otter=byHub('OtterAI/speech-v3.1');
 const key=otter.id+'|'+data.config.default_test+':ami';
 const original=altered.resultsByKey[key][0];
 assert.equal(original.evidence,'author_reported');
 altered.sources['test-independent']={kind:'third_party'};
 altered.resultsByKey[key].push({...original,source_id:'test-independent',value:99,evidence:'third_party'});
 const selected=Speech.summarize(altered,data.accuracyTests.find(test=>test.id===data.config.default_test),otter.id);
 assert.equal(selected.scores.ami.value,original.value);
 assert.equal(selected.scores.ami.evidence,'author_reported');
 assert.equal(selected.scores.ami.source_id,'open-asr-2026-10-17');
});

test('aggregate index uses mature disjoint families, qualifies evidence and keeps Phonon single-family',()=>{
 const result=Matrix.build(data);
 assert.equal(result.matureCount,3);
 assert.ok(result.rows.length>30);
 const scribe=getRow(result,byHub('elevenlabs/scribe_v2').id);
 assert.equal(scribe.coreCount,3);
 assert.equal(scribe.rankStatus,'provisional');
 assert.ok(scribe.provisionalReasons.some(reason=>reason.includes('execution operator not established')));
 assert.ok(scribe.provisionalReasons.some(reason=>reason.includes('cohort')&&reason.includes('undated')));
 assert.ok(!scribe.provisionalReasons.some(reason=>reason.startsWith('Limited coverage')));
 const qwen=getRow(result,'qwen3-asr-0-6b-hf');
 assert.equal(qwen.coreCount,2);
 assert.ok(qwen.provisionalReasons.some(reason=>reason.startsWith('Limited coverage')));
 const small=Matrix.build(data,{view:'small'});
 const phonon=getRow(small,'phonon-2');
 assert.equal(phonon.count,1);assert.equal(phonon.rank,null);assert.equal(phonon.rankStatus,'unranked');
 const html=Matrix.renderRows(result,data);
 assert.match(html,/popovertarget="rank-note-/);
 assert.match(html,/aria-label="Why .* has a provisional rank"/);
 assert.ok(html.includes('multilingual_evals/blob/'),'Rank explanation must link exact language CSV revisions');
 assert.match(html,/French/);
 assert.match(html,/Portuguese/);
});

test('query, access and size filters do not change percentile cohorts or qualifications',()=>{
 const model=byHub('nvidia/parakeet-tdt-0.6b-v3');
 const normal=getRow(Matrix.build(data),model.id);
 const filtered=getRow(Matrix.build(data,{query:'parakeet-tdt-0.6b-v3',access:'open'}),model.id);
 assert.equal(filtered.rank,normal.rank);
 assert.deepEqual(filtered.provisionalReasons,normal.provisionalReasons);
 const all=Matrix.build(data,{min:0});
 assert.equal(all.rows.length,data.models.length);
 assert.equal(all.rows.some(row=>row.model.access==='closed'),true);
});

test('runtime decoding variants do not multiply a weights reference cohort',()=>{
 const prepared=Matrix.rankingData(data);
 const cohort=Rank.scored(prepared,data.config.snapshot_date,data.accuracyTests.find(test=>test.id===data.config.default_test));
 assert.equal(cohort.filter(row=>row.model.hub_id?.startsWith('nvidia/parakeet-tdt-0.6b-v3')).length,1);
 assert.equal(cohort.find(row=>row.model.hub_id==='nvidia/parakeet-tdt-0.6b-v3').model.id,'parakeet-tdt-0-6b-v3');
 const altered=structuredClone(data);
 altered.accuracyTests.find(test=>test.id==='open-asr-mcv').core=true;
 assert.equal(Matrix.build(altered).matureCount,3);
});

test('historical cohorts use verified availability and exclude unknown conversion releases',()=>{
 const before=Matrix.build(data,{cutoff:'2026-09-28',min:0});
 const after=Matrix.build(data,{cutoff:'2026-09-29',min:0});
 assert.equal(getRow(before,'phonon-2'),undefined);
 assert.ok(getRow(after,'phonon-2'));
 assert.equal(getRow(after,'stt-handy-phonon-2-q8-0'),undefined);
 assert.ok(getRow(Matrix.build(data,{min:0}),'stt-handy-phonon-2-q8-0'));
 assert.ok(before.rows.every(row=>row.model.release_date!=null));
});

test('a conflicting cohort observation qualifies every dependent index without averaging scores',()=>{
 const altered=structuredClone(data);
 const key='parakeet-tdt-0-6b-v3|open-asr-longform:coraal';
 const original=altered.resultsByKey[key][0];
 altered.resultsByKey[key].push({...original,value:1,source_id:'fermion-phonon-2-launch',evidence:'vendor_comparison'});
 const baseline=Matrix.build(data);
 const changed=Matrix.build(altered);
 const id=byHub('elevenlabs/scribe_v2').id;
 assert.equal(getRow(changed,id).rank,getRow(baseline,id).rank);
 assert.ok(getRow(changed,id).provisionalReasons.some(reason=>reason.includes('cohort')&&reason.includes('conflicting')));
 assert.equal(getRow(changed,'parakeet-tdt-0-6b-v3').scores['open-asr-longform'].value,15.57);
});

test('original Phonon and GGUF Q8 observations retain distinct sizes, weights and uncertainty',()=>{
 const id='stt-handy-phonon-2-q8-0';
 assert.equal(Speech.selectSize(data,'phonon-2').download_mb,164);
 assert.equal(Speech.selectSize(data,id).download_bytes,739508608);
 const source=data.rawRecords.find(record=>record.model===id&&record.benchmark==='handy-fleurs-en');
 assert.equal(source.metrics.wer,5.49);
 assert.equal(source.uncertainty.n_utterances,647);
 assert.deepEqual(source.uncertainty.ci95,[4.99,6]);
 assert.equal(source.configuration.quant,'Q8_0');
 assert.equal(source.configuration.engine_sha,'66ad945d');
 assert.equal(data.models.find(model=>model.id===id).release_date,null);
 assert.equal(data.rawRecords.some(record=>record.model==='phonon-2'&&record.benchmark==='handy-fleurs-en'),false);
 const snapshot=JSON.parse(fs.readFileSync(require.resolve('../data/stt/evidence/handy-q8-catalog.json'),'utf8'));
 for (const entry of snapshot.entries) {
   const model=data.models.find(model=>model.source_id==='handy-'+entry.variant.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
   const cell=entry.accuracy_benchmarks.find(cell=>cell.quant==='Q8_0'&&cell.dataset==='fleurs'&&cell.language==='en');
   assert.equal(data.rawRecords.find(record=>record.model===model.id&&record.benchmark==='handy-fleurs-en').metrics.wer,cell.err_pct);
 }
});

test('timing remains separate from accuracy and matches exact sample, engine and timing boundary',()=>{
 assert.equal(data.throughput.length,464);assert.equal(data.latency.length,9);
 const rows=Matrix.timingRows(data,{test:'handy-single-clip-speed',hardware:'m4-max',sample:'dots',query:'Phonon-2'});
 assert.equal(rows.length,2);
 const metal=rows.find(row=>row.runtime.includes('metal'));
 assert.equal(metal.rtfx,213.72);assert.equal(metal.rtfx_compute,222.32);
 assert.equal(metal.load_ms,199.9);assert.equal(metal.engine_sha,'66ad945d');
 assert.equal(metal.sample,'dots');assert.equal(metal.audio_seconds,35.332);
 assert.equal(metal.load_time_included,false);
 assert.equal(data.latency.find(row=>row.model==='stt-usefulsensors-moonshine-streaming-tiny').milliseconds,50);
 assert.ok(data.latency.every(row=>row.statistic==='unspecified'));
 assert.equal(data.tests.filter(test=>test.task!=='transcription').some(test=>test.core),false);
});

test('price units, currencies, current endpoints and token meters cannot be substituted',()=>{
 assert.equal(data.pricing.length,9);assert.equal(data.tokenPricing.length,2);
 const gladia=data.pricing.find(row=>row.provider==='Gladia'&&row.mode==='async');
 assert.equal(gladia.currency,'EUR');assert.equal(gladia.amount,0.16);
 const deepgram=data.pricing.find(row=>row.provider==='Deepgram'&&row.mode==='pre-recorded'&&row.model.includes('monolingual'));
 assert.equal(deepgram.published_amount,0.0043);assert.ok(Math.abs(deepgram.amount-0.258)<1e-10);
 assert.equal(data.pricing.some(row=>row.provider==='Soniox'),false);
 assert.equal(data.tokenPricing.find(row=>row.mode==='async').input_audio_usd_per_million_tokens,1.5);
 assert.equal(data.rawRecords.some(row=>row.model==='stt-voxtral-mini-transcribe-2602-api'),false);
 assert.equal(Speech.priceInfo(data,data.models.find(model=>model.id==='phonon-2')).label,'Self-hosted');
 const altered=structuredClone(data);altered.pricing[0].amount=0;
 assert.throws(()=>validateSTT(altered),/invalid speech price normalization/);
});

test('download and parameter columns stay separate in matrix and protocol views',()=>{
 const cases=[
   [{download_mb:164}, /<td><a [^>]*>164<\/a><\/td><td>—<\/td>/],
   [{parameters_million:9}, /<td>—<\/td><td><a [^>]*>9<\/a><\/td>/],
   [{download_mb:164,parameters_million:9}, /<td><a [^>]*>164<\/a><\/td><td><a [^>]*>9<\/a><\/td>/],
   [{}, /<td>—<\/td><td>—<\/td>/]
 ];
 for (const [values,pattern] of cases) {
   const altered=structuredClone(data);
   altered.sizes=altered.sizes.filter(record=>record.model!=='phonon-2');
   altered.sizes.push({model:'phonon-2',...values,source_id:'fermion-phonon-2-launch',status:'observed',as_of:'2026-10-19',note:'Reported quantities'});
   for (const renderer of [Speech,Matrix]) {
     const result=renderer.build(altered,{query:'phonon-2',min:0});
     const head=renderer.renderHead(result);
     assert.match(head,/Download \(MB\)/);assert.match(head,/Parameters \(M\)/);
     assert.doesNotMatch(head,/Download \/ params/);
     const single={...result,rows:result.rows.filter(row=>row.id==='phonon-2')};
     assert.match(renderer.renderRows(single,altered),pattern);
     const columns=(head.match(/<th /g)||[]).length;
     assert.match(renderer.renderRows({...result,rows:[]},altered),new RegExp(`colspan="${columns}"`));
   }
 }
});

test('size sorting and filters compare only their own unit and put unknowns last',()=>{
 for (const renderer of [Speech,Matrix]) {
   for (const [sort,field,filter] of [['download','download_mb','maxDownload'],['params','parameters_million','maxParams']]) {
     const options={sort,min:0,missing:true};
     const result=renderer.build(data,options);
     const values=result.rows.map(row=>row.size?.[field]);
     assert.ok(values.some(value=>value==null));
     let previous=-Infinity;
     for (const value of values) {
       const comparable=value??Infinity;
       assert.ok(comparable>=previous);previous=comparable;
     }
     const filtered=renderer.build(data,{...options,[filter]:200});
     assert.ok(filtered.rows.length>0);
     assert.ok(filtered.rows.every(row=>row.size?.[field]!=null&&row.size[field]<=200));
   }
 }
});

test('size quantities select independent sources while retaining priority and precision',()=>{
 const altered=structuredClone(data);
 altered.sizes=[
   {model:'phonon-2',parameters_million:42.9,source_id:'params-new',as_of:'2026-10-22',note:'New count'},
   {model:'phonon-2',parameters_million:33.57,source_id:'params-preferred',selection_priority:-1,as_of:'2026-10-20',note:'Preferred count'},
   {model:'phonon-2',download_mb:164.25,download_bytes:164250000,source_id:'download',as_of:'2026-10-21',note:'Artifact bytes'},
   {model:'phonon-2',download_mb:1,parameters_million:1,source_id:'assumed',selection_priority:-2,status:'assumed',as_of:'2026-10-22'},
   {model:'phonon-1',parameters_million:33.56,source_id:'other',as_of:'2026-10-22'}
 ];
 for (const id of ['params-new','params-preferred','download','other']) altered.sources[id]={url:`https://example.com/${id}`};
 const selected=Speech.selectSize(altered,'phonon-2');
 assert.equal(selected.download_mb,164.25);
 assert.equal(selected.download_bytes,164250000);
 assert.equal(selected.parameters_million,33.57);
 assert.equal(selected.field_records.parameters_million.source_id,'params-preferred');
 assert.equal(selected.field_records.download_mb.source_id,'download');
 const html=Speech.renderSizeCells(selected,altered);
 assert.match(html,/href="https:\/\/example.com\/download"[^>]*title="Artifact bytes"[^>]*>164.3<\/a>/);
 assert.match(html,/href="https:\/\/example.com\/params-preferred"[^>]*title="Preferred count"[^>]*>34<\/a>/);
 assert.doesNotMatch(html,/33.6|params-new/);
 for (const renderer of [Speech,Matrix]) {
   const result=renderer.build(altered,{sort:'params',min:0,missing:true,query:'Phonon-'});
   assert.equal(result.rows[0].id,'phonon-1');
   assert.equal(result.rows[1].id,'phonon-2');
   assert.equal(result.rows[1].size.parameters_million,33.57);
   const filtered=renderer.build(altered,{maxParams:33.56,min:0,missing:true,query:'Phonon-'});
   assert.deepEqual(filtered.rows.map(row=>row.id),['phonon-1']);
 }
 assert.equal(altered.sizes[1].parameters_million,33.57);
});
