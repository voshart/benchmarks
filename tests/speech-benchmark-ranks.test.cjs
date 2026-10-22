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

async function pageHarness(hash='') {
 const fs=require('node:fs'),vm=require('node:vm');
 const elements={},defaults={speechProtocol:data.config.default_test,speechAccess:'all',timingTest:'fermion-20-dictations'};
 const removed=new Set(['speechView','speechSort','speechRankMetric','speechExtra','speechCoverage']);
 const element=id=>{assert.ok(!removed.has(id),'removed control '+id+' must not be requested');return elements[id]??={value:defaults[id]||'',checked:false,handlers:{},dataset:{},attributes:{},classList:{toggle(){}},setAttribute(key,value){this.attributes[key]=value;},addEventListener(event,fn){this.handlers[event]=fn;}};};
 const document={getElementById:element,querySelector:()=>({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}),querySelectorAll:()=>[]};
 const location={hash,pathname:'/stt/',search:''};
 const history={replaceState(state,title,url){location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';}};
 vm.runInNewContext(fs.readFileSync('src/assets/js/speech-page.js','utf8'),{document,location,history,BenchmarkSpeech:Speech,BenchmarkSpeechMatrix:Matrix,fetch:async()=>({ok:true,json:async()=>data}),console,setTimeout,clearTimeout});
 await new Promise(resolve=>setImmediate(resolve));
 return {element,location};
}

test('single-selector navigation handles partial links, sortable headers and reset',async()=>{
 const {element,location}=await pageHarness('#small');
 const select=value=>{element('speechProtocol').value=value;element('speechProtocol').handlers.change();};
 const sort=key=>element('speechHead').handlers.click({target:{closest:()=>({dataset:{sortKey:key}})}});
 assert.equal(element('speechProtocol').value,data.config.default_test);
 assert.ok(element('speechBody').innerHTML.indexOf('>Phonon-2</a>')<element('speechBody').innerHTML.indexOf('>Niagara 9M batch.en</a>'));
 element('speechUnscoredList').handlers.click({target:{closest:()=>({dataset:{benchmark:'open-asr-fleurs',model:'mms-1b-all',metric:'hy'}})}});
 assert.equal(element('speechProtocol').value,'open-asr-fleurs::hy');
 assert.match(element('speechBody').innerHTML,/13.43/);
 assert.match(element('speechBody').innerHTML,/Armenian/);
 select(data.config.default_test);
 element('speechSearch').value='';element('speechSearch').handlers.input();
 await new Promise(resolve=>setTimeout(resolve,120));
 for(const key of ['rank','name','score','speed','price']) {
  sort(key);
  assert.match(element('speechHead').innerHTML,new RegExp('aria-sort="(?:ascending|descending)"'));
  assert.match(element('speechHead').innerHTML,new RegExp('data-sort-key="'+key+'"'));
  const first=element('speechHead').innerHTML.match(/aria-sort="(ascending|descending)"/)[1];
  sort(key);
  const second=element('speechHead').innerHTML.match(/aria-sort="(ascending|descending)"/)[1];
  assert.notEqual(second,first,key+' repeated click must toggle direction');
 }
 element('speechSearch').value='gemma';element('speechSize').value='200';element('speechParams').value='100';
 element('speechAccess').value='closed';element('historyRange').value='0';
 element('speechReset').handlers.click();
 assert.equal(element('speechProtocol').value,data.config.default_test);
 assert.equal(element('speechSearch').value,'');assert.equal(element('speechSize').value,'');assert.equal(element('speechParams').value,'');
 assert.equal(element('speechAccess').value,'all');assert.equal(location.hash,'');
 assert.equal(Number(element('historyRange').value),Number(element('historyRange').max));
 assert.match(element('speechStatus').textContent,/64 ranked/);
 assert.match(element('speechUnscoredSummary').textContent,/108 configurations/);
 assert.ok(element('speechBody').innerHTML.indexOf('>Phonon-2</a>')<element('speechBody').innerHTML.indexOf('>gemma-4-E4B-it</a>'));
 assert.doesNotMatch(element('speechBody').innerHTML,/GGUF Q8_0/);
 assert.match(element('speechUnscoredList').innerHTML,/GGUF Q8_0/);

});

test('legacy hashes resolve to the single accuracy selector',async()=>{
 const expected={english:data.config.default_test,benchmark:data.config.default_test,matrix:data.config.default_test,small:data.config.default_test,new:data.config.default_test,secondary:data.config.default_test,longform:'open-asr-longform',multilingual:'open-asr-fleurs',robustness:'open-asr-robustness',throughput:data.config.default_test,latency:data.config.default_test,price:data.config.default_test};
 for(const [hash,value] of Object.entries(expected)) {
  const {element}=await pageHarness('#'+hash);
  assert.equal(element('speechProtocol').value,value,hash);
 }
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
 assert.match(template,/id="speechProtocol"/);
 assert.match(template,/stt.config.default_test/);
 for(const id of ['speechView','speechSort','speechRankMetric','speechExtra','speechCoverage']) assert.ok(!template.includes('id="'+id+'"'),id);
 assert.match(template,/stt.protocolInitial \| speechRows/);
 assert.match(template,/stt.protocolInitial \| speechUnscored/);
 assert.doesNotMatch(template,/value="__(throughput|latency|price)"/);
 assert.doesNotMatch(template,/id="speechMissing"/);
});

test('compact leaderboard preserves ranks and evidence with only five visible columns',()=>{
 const compact=Speech.build(data,{compact:true});
 const full=Speech.build(data);
 assert.deepEqual(compact.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]),full.rows.map(row=>[row.id,row.benchmarkRank,row.benchmarkValue]));
 assert.equal(compact.columns.length,0);
 const head=Speech.renderHead(compact),body=Speech.renderRows(compact,data);
 assert.equal((head.match(/<th /g)||[]).length,5);
 assert.match(head,/data-sort-key="rank"/);
 assert.ok(head.indexOf('data-sort-key="rank"')<head.indexOf('data-sort-key="name"'));
 assert.match(body,/LibriSpeech test.clean/);
 assert.match(body,/aria-label="Evidence and qualifications for Phonon-2"/);
 assert.match(body,/>Details<\/button>/);
 assert.match(body,/<small class="model-vendor">OtterAI<\/small>/);
 const template=require('node:fs').readFileSync('src/stt/index.njk','utf8');
 assert.doesNotMatch(template,/<nav class="views"/);
 assert.match(template,/<details id="speechMore" class="speech-more"><summary>More filters/);
 assert.ok(template.indexOf('id="speechMore"')<template.indexOf('id="historyRange"'));
 assert.ok(template.indexOf('id="speechProtocol"')<template.indexOf('id="speechMore"'));
});


test('compact benchmark header preserves OI-WER unit for Hindi',()=>{
 const result=Speech.build(data,{test:'open-asr-monsoon-hi',compact:true});
 assert.match(Speech.renderHead(result),/OI-WER %/);
});


test('main numeric headers sort in both directions with unknowns last and fixed accuracy ranks',()=>{
 const baseline=Speech.build(data,{missing:true,compact:true});
 const positions=new Map(baseline.rows.map(row=>[row.id,row.benchmarkRank]));
 const valueFor={rank:row=>row.benchmarkRank,score:row=>row.benchmarkValue,
  speed:row=>data.throughput.find(record=>record.model===row.id&&record.test_id==='fermion-20-dictations'&&record.hardware==='Apple M5 MacBook Air'&&record.batch_size===1&&record.status!=='assumed')?.rtfx,
  price:row=>{const price=Speech.selectPrice(data,row.id);return price?.currency==='USD'&&price.unit==='currency_per_audio_hour'?price.amount:null;}};
 for(const [sort,value] of Object.entries(valueFor)) for(const sortDirection of ['asc','desc']) {
  const result=Speech.build(data,{missing:true,compact:true,sort,sortDirection});
  let unknown=false,previous;
  for(const row of result.rows) {
   assert.equal(row.benchmarkRank,positions.get(row.id));
   const current=value(row);
   if(!Number.isFinite(current)) {unknown=true;continue;}
   assert.equal(unknown,false,sort+' '+sortDirection+' unknowns must stay last');
   if(previous!==undefined) assert.ok(sortDirection==='asc'?previous<=current:previous>=current,sort+' '+sortDirection);
   previous=current;
  }
  const head=Speech.renderHead(result);
  assert.equal((head.match(/<th /g)||[]).length,5);
  assert.match(head,new RegExp('aria-sort="'+(sortDirection==='asc'?'ascending':'descending')+'"'));
 }
 for(const sortDirection of ['asc','desc']) {
  const result=Speech.build(data,{sort:'name',sortDirection,compact:true});
  const names=result.rows.map(row=>row.name),ordered=names.slice().sort((a,b)=>a.localeCompare(b)*(sortDirection==='asc'?1:-1));
  assert.deepEqual(names,ordered);
 }
 const head=Speech.renderHead(Speech.build(data,{compact:true}));
 for(const key of ['rank','name','score','speed','price']) assert.match(head,new RegExp('<button[^>]*type="button"[^>]*data-sort-key="'+key+'"'));
});

test('compact Details rounds size labels only and preserves precise size metadata',()=>{
 const result=Speech.build(data,{compact:true});
 const original=find(result,'niagara-9m-batch-en');
 const row={...original,size:{...original.size,download_mb:1234.56789,parameters_million:9.8}};
 const html=Speech.renderRows({...result,rows:[row]},data);
 assert.match(html,/<strong>Size:<\/strong> 1,235 MB download · 10 M parameters/);
 assert.match(html,/popovertarget="[^"]+"[^>]*>Details<\/button>/);
 assert.doesNotMatch(Speech.renderHead(result),/Download \(MB\)|Parameters \(M\)/);
 assert.equal(row.size.download_mb,1234.56789);
 assert.equal(row.size.parameters_million,9.8);
});

test('speed uses one explicitly labelled hardware workload cohort, without model alias inheritance',()=>{
 const english=Speech.build(data,{compact:true,missing:true});
 assert.equal(english.speedLabel,'M5 speed ×');
 assert.deepEqual(english.rows.filter(row=>row.speed).map(row=>[row.id,row.speed.rtfx]).sort(),[
  ['phonon-2',174],['parakeet-tdt-0-6b-v3',104.9],['parakeet-redux',27.8]
 ].sort());
 for(const row of english.rows.filter(row=>row.speed)) {
  assert.equal(row.speed.model,row.id);
  assert.equal(row.speed.test_id,'fermion-20-dictations');
  assert.equal(row.speed.hardware,'Apple M5 MacBook Air');
  assert.equal(row.speed.batch_size,1);
 }
 const handy=Speech.build(data,{test:'handy-fleurs-en',compact:true,missing:true});
 assert.equal(handy.speedLabel,'M4 speed ×');
 assert.equal(handy.rows.filter(row=>row.speed).length,58);
 for(const row of handy.rows.filter(row=>row.speed)) {
  assert.equal(row.speed.model,row.id);
  assert.equal(row.speed.test_id,'handy-single-clip-speed');
  assert.equal(row.speed.hardware,'m4-max');
  assert.equal(row.speed.runtime,'transcribe.cpp metal / Q8_0');
  assert.equal(row.speed.sample,'jfk');
  assert.equal(row.speed.batch_size,1);
 }
 const altered=structuredClone(data),valid=find(english,'phonon-2').speed;
 altered.throughput.unshift(...[
  {hardware:'m4-max'},{batch_size:8},{test_id:'handy-single-clip-speed'},{status:'assumed'}
 ].map(change=>({...valid,...change,rtfx:99999})));
 assert.equal(find(Speech.build(altered),'phonon-2').speed.rtfx,174);
 const handyRecord=handy.rows.find(row=>row.speed).speed;
 altered.throughput.unshift(...[
  {hardware:'m3-max'},{runtime:'transcribe.cpp cpu / Q8_0'},{sample:'different'},{batch_size:8},{status:'assumed'}
 ].map(change=>({...handyRecord,...change,rtfx:99999})));
 assert.equal(find(Speech.build(altered,{test:'handy-fleurs-en',missing:true}),handyRecord.model).speed.rtfx,handyRecord.rtfx);
});
