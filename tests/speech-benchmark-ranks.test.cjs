const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSTT}=require('../lib/load-stt.cjs');
const Speech=require('../src/assets/js/speech.js');
const Matrix=require('../src/assets/js/speech-matrix.js');
const data=loadSTT();
const find=(result,id)=>result.rows.find(row=>row.id===id);

test('Phonon ranks above Niagara by shared English WER without inventing an overall index',()=>{
 const small=Matrix.build(data,{view:'small'});
 assert.equal(find(small,'phonon-2').rank,null);
 assert.equal(find(small,'niagara-9m-batch-en').rank,null);
 assert.ok(small.rows.findIndex(row=>row.id==='phonon-2')<small.rows.findIndex(row=>row.id==='niagara-9m-batch-en'));
 assert.equal(small.sortTest.id,data.config.default_test);
 const english=Speech.build(data);
 assert.ok(find(english,'phonon-2').benchmarkRank<find(english,'niagara-9m-batch-en').benchmarkRank);
 assert.equal(find(english,'phonon-2').benchmarkValue.toFixed(2),'5.21');
 assert.equal(find(english,'niagara-9m-batch-en').benchmarkValue.toFixed(2),'12.98');
 assert.match(Matrix.renderRows(small,data),/No overall index/);
 assert.match(Matrix.renderRows(small,data),/View benchmark rank/);
});

test('benchmark positions and denominator stay fixed under display filters',()=>{
 const all=Speech.build(data);
 const filtered=Speech.build(data,{query:'Phonon-2',access:'open',maxDownload:200,sort:'name'});
 assert.equal(filtered.benchmarkCount,all.benchmarkCount);
 assert.equal(find(filtered,'phonon-2').benchmarkRank,find(all,'phonon-2').benchmarkRank);
 const result=Speech.build(data,{missing:true});
 assert.equal(result.rows.at(-1).benchmarkValue,null);
 const altered=structuredClone(data);
 const protocol=altered.accuracyTests.find(test=>test.id===data.config.default_test);
 const first=altered.resultsByKey['phonon-2|'+protocol.id+':ls_clean'][0];
 first.comparable=false;
 assert.equal(find(Speech.build(altered,{missing:true}),'phonon-2').benchmarkRank,undefined);
});

test('partial-language evidence is visible and rankable only on its matching metric',()=>{
 const id=data.models.find(model=>model.hub_id==='facebook/mms-1b-all').id;
 const panel=Speech.build(data,{test:'open-asr-fleurs'});
 assert.equal(find(panel,id).mean,null);
 assert.equal(find(panel,id).benchmarkRank,undefined);
 const armenian=Speech.build(data,{test:'open-asr-fleurs',rankMetric:'hy'});
 assert.equal(find(armenian,id).benchmarkValue,13.43);
 assert.ok(find(armenian,id).benchmarkRank>0);
 assert.equal(find(armenian,id).mean,null);
 const secondary=Matrix.build(data,{view:'secondary'});
 assert.ok(find(secondary,id));
 assert.match(Matrix.renderRows(Matrix.build(data,{min:0}),data),/Partial: \d+ metrics/);
});

test('original Moonshine paper backfill supplies secondary-only matched benchmark positions',()=>{
 const result=Speech.build(data,{test:'moonshine-v1-paper'});
 assert.equal(result.benchmarkCount,4);
 assert.equal(result.rows.length,4);
 assert.equal(result.rows[0].id,'stt-usefulsensors-moonshine-base');
 assert.equal(result.rows[0].benchmarkValue,10.07);
 assert.equal(result.rows[0].benchmarkRank,1);
 assert.equal(find(result,'stt-openai-whisper-tiny-en').benchmarkRank,4);
 assert.equal(result.test.core,false);
 assert.equal(find(Matrix.build(data,{min:0}),'stt-usefulsensors-moonshine-base').rank,null);
 assert.match(Speech.renderRows(result,data),/Author run/);
 assert.match(Speech.renderRows(result,data),/Competitor run/);
});

test('equal benchmark scores share a position before filters',()=>{
 const altered=structuredClone(data);
 for(const key of Object.keys(altered.resultsByKey).filter(key=>key.startsWith('niagara-9m-batch-en|'+data.config.default_test+':'))) {
  const metric=key.split(':').at(-1), other=altered.resultsByKey['phonon-2|'+data.config.default_test+':'+metric];
  if(other) altered.resultsByKey[key][0].value=other[0].value;
 }
 const result=Speech.build(altered);
 assert.equal(find(result,'phonon-2').benchmarkRank,find(result,'niagara-9m-batch-en').benchmarkRank);
});

test('metric ranking links its exact source and keeps selected detail visible',()=>{
 const result=Speech.build(data,{test:'open-asr-fleurs',rankMetric:'de'});
 for(const row of result.rows.filter(row=>row.benchmarkRank)) assert.equal(row.provenance.source_id,row.scores.de.source_id);
 const armenian=Speech.build(data,{test:'open-asr-fleurs',rankMetric:'hy'});
 assert.ok(armenian.columns.some(metric=>metric.id==='hy'));
 const id=data.models.find(model=>model.hub_id==='facebook/mms-1b-all').id;
 const matrix=Matrix.build(data,{min:0});
 assert.match(Matrix.renderRows({...matrix,rows:[find(matrix,id)]},data),/data-metric="hy">View benchmark rank/);
});

test('benchmark navigation handles partial links, sort labels and repeated view changes',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const elements={},defaults={speechProtocol:data.config.default_test,speechSort:'score',speechCoverage:'2',speechAccess:'all'};
 const element=id=>elements[id]??={value:defaults[id]||'',checked:false,handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(event,fn){this.handlers[event]=fn;}};
 element('speechSort').options=[{value:'score'},{value:'wer:open-asr-fleurs'}];
 const buttons=['matrix','benchmark','english','small','secondary'].map(view=>({...element(view),dataset:{view}}));
 const document={getElementById:element,querySelector:()=>({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}),querySelectorAll:()=>buttons};
 vm.runInNewContext(fs.readFileSync('src/assets/js/speech-page.js','utf8'),{document,BenchmarkSpeech:Speech,BenchmarkSpeechMatrix:Matrix,fetch:async()=>({ok:true,json:async()=>data}),console,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 const click=view=>buttons.find(button=>button.dataset.view===view).handlers.click();
 click('small');
 assert.equal(element('speechSort').value,'wer:'+data.config.default_test);
 assert.ok(element('speechBody').innerHTML.indexOf('>Phonon-2</a>')<element('speechBody').innerHTML.indexOf('>Niagara 9M batch.en</a>'));
 click('benchmark');
 assert.equal(element('speechSort').options[1].disabled,true);
 element('speechBody').handlers.click({target:{closest:()=>({dataset:{benchmark:'open-asr-fleurs',model:'mms-1b-all',metric:'hy'}})}});
 assert.equal(element('speechRankMetric').value,'hy');
 assert.match(element('speechBody').innerHTML,/13.43/);
 assert.match(element('speechStatus').textContent,/Armenian/);
 element('speechSort').value='download';element('speechSort').handlers.change();
 assert.match(element('speechStatus').textContent,/Download size/);
 assert.doesNotMatch(element('speechStatus').textContent,/missing scores last/);
 click('matrix');
 assert.equal(element('speechSort').options[1].disabled,false);
 click('small');click('english');click('small');
 assert.equal(element('speechSort').value,'wer:'+data.config.default_test);
 click('english');
 element('speechRankMetric').value='ls_clean';element('speechRankMetric').handlers.change();
 click('english');assert.equal(element('speechRankMetric').value,'');
 element('speechSearch').value='gemma';element('speechSize').value='200';element('speechSort').value='params';
 element('speechAccess').value='closed';element('speechRankMetric').value='ls_other';element('historyRange').value='0';
 element('speechReset').handlers.click();
 assert.equal(element('speechSearch').value,'');assert.equal(element('speechSize').value,'');
 assert.equal(element('speechSort').value,'score');assert.equal(element('speechAccess').value,'all');assert.equal(element('speechRankMetric').value,'');
 assert.match(element('speechStatus').textContent,/64 models/);
 assert.match(element('speechUnscoredSummary').textContent,/108 configurations/);
 assert.ok(element('speechBody').innerHTML.indexOf('>Phonon-2</a>')<element('speechBody').innerHTML.indexOf('>gemma-4-E4B-it</a>'));
 assert.doesNotMatch(element('speechBody').innerHTML,/GGUF Q8_0/);
 assert.match(element('speechUnscoredList').innerHTML,/GGUF Q8_0/);
});

test('English landing separates no-score models and orders Phonon above every Gemma4 variant',()=>{
 const result=Speech.build(data);
 const html=Speech.renderRows(result,data),unscored=Speech.renderUnscored(result,data);
 assert.equal(result.benchmarkCount,64);
 assert.equal(result.unscoredRows.length,108);
 for(const id of ['stt-google-gemma-4-e4b-it','stt-google-gemma-4-e2b-it','stt-google-gemma-4-12b-it']) {
  assert.ok(find(result,'phonon-2').benchmarkRank<find(result,id).benchmarkRank);
  assert.ok(html.indexOf('>Phonon-2</a>')<html.indexOf('>'+find(result,id).name+'</a>'));
 }
 assert.doesNotMatch(html,/No matched score|No overall index/);
 assert.ok(unscored.includes('GGUF Q8_0'));
 assert.equal(Speech.renderRows({...result,rows:[...result.rows,...result.unscoredRows]},data),html);
 const header=Speech.renderHead(result);
 assert.ok(header.indexOf('mean WER')<header.indexOf('Download (MB)'));
});

test('download and parameter metadata never affect accuracy values, positions or default order',()=>{
 const original=Speech.build(data),altered=structuredClone(data);
 for(const size of altered.sizes) {size.download_mb=999999;size.parameters_million=0.001;}
 const changed=Speech.build(altered);
 assert.deepEqual(changed.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]),original.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]));
 const values=original.rows.filter(row=>row.benchmarkRank).map(row=>row.benchmarkValue);
 assert.deepEqual(values,values.slice().sort((a,b)=>a-b));
});

test('server template starts in English accuracy, including without JavaScript',()=>{
 const fs=require('node:fs');
 const template=fs.readFileSync('src/stt/index.njk','utf8');
 assert.match(template,/<option value="english" selected>/);
 assert.match(template,/stt.protocolInitial \| speechRows/);
 assert.match(template,/stt.protocolInitial \| speechUnscored/);
 assert.match(template,/Download sizes and parameter counts are metadata, not ranking weights/);
 assert.doesNotMatch(template,/id="speechMissing"/);
});

test('compact leaderboard preserves ranks and evidence with only six visible columns',()=>{
 const compact=Speech.build(data,{compact:true});
 const full=Speech.build(data);
 assert.deepEqual(compact.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]),full.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]));
 assert.equal(compact.columns.length,0);
 const head=Speech.renderHead(compact),body=Speech.renderRows(compact,data);
 assert.equal((head.match(/<th /g)||[]).length,6);
 assert.match(head,/<th scope="col">Rank<\/th><th scope="col">Model/);
 assert.match(body,/LibriSpeech test.clean/);
 assert.match(body,/aria-label="Evidence and qualifications for Phonon-2"/);
 assert.match(body,/>Details<\/button>/);
 const template=require('node:fs').readFileSync('src/stt/index.njk','utf8');
 assert.doesNotMatch(template,/<nav class="views"/);
 assert.match(template,/<details id="speechMore" class="speech-more"><summary>More filters/);
 assert.ok(template.indexOf('id="speechMore"')<template.indexOf('id="historyRange"'));
 assert.ok(template.indexOf('id="speechProtocol"')<template.indexOf('id="speechMore"'));
});
