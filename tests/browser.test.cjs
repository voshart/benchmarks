const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadOCR} = require('../lib/load.cjs');
const BenchmarkRank = require('../lib/ranking.cjs');
const OCRComparison = require('../src/assets/js/ocr-comparison.js');
const BenchmarkRankUI = require('../src/assets/js/rank-ui.js');

test('browser renders updated snapshot dates, source links, contextual prices and new research', async () => {
  const data = loadOCR();
  data.config.snapshot_date = '2026-11-13';
  const elements = {};
  const element = id => elements[id] ??= {value:id==='coverage'?String(data.config.default_families):id==='access'?'all':'', handlers:{},
    addEventListener(event, handler) {this.handlers[event]=handler;}, classList:{toggle(){}}};
  const buttons = ['all','new','price','secondary'].map(view => ({...element(view), dataset:{view}}));
  const document = {getElementById:element, querySelector:() => ({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}), querySelectorAll:() => buttons};
  const context = {document, OCRComparison, BenchmarkRank, BenchmarkRankUI, fetch:async () => ({ok:true,json:async () => data}), console, setTimeout, clearTimeout};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/assets/js/bench.js'),'utf8'),context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(element('historyDate').textContent, '2026-11-13');
  assert.match(element('matrixBody').innerHTML, /Service \$4\.00/);
  assert.match(element('matrixBody').innerHTML, /Self-hosted/);
  assert.match(element('matrixBody').innerHTML, /https:\/\/app\.datalab\.to\/pricing/);
  buttons.find(b => b.dataset.view==='new').handlers.click();
  assert.match(element('matrixBody').innerHTML, /Xiaomi-OCR-0/);
  assert.match(element('matrixBody').innerHTML, /popovertarget="rank-note-xiaomi-ocr-0"/);
  assert.match(element('matrixBody').innerHTML, /Limited coverage/);
  assert.match(element('matrixBody').innerHTML, /author-reported/);
  assert.match(element('matrixBody').innerHTML, /arxiv\.org\/html\/2609\.36136/);
  buttons.find(b => b.dataset.view==='price').handlers.click();
  assert.equal(element('matrixPanel').hidden,true);
  assert.equal(element('pricingPanel').hidden,false);
});

test('OCR browser header sorting, assumptions, filters, history, and reset stay coherent',async()=>{
 const data=loadOCR(),elements={};
 const defaults={coverage:String(data.config.default_families),access:'all',ocrHourlyRate:'1',ocrInputTokens:'1000',ocrOutputTokens:'1000'};
 const element=id=>elements[id]??={value:defaults[id]??'',handlers:{},addEventListener(event,handler){this.handlers[event]=handler;},classList:{toggle(){}},querySelector(){return {focus(){}};}};
 const buttons=['all','new','price','secondary'].map(view=>({...element(view),dataset:{view}}));
 let requestOptions;
 const document={getElementById:element,querySelector:()=>({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}),querySelectorAll:()=>buttons};
 const context={document,OCRComparison,BenchmarkRank,BenchmarkRankUI,fetch:async(url,options)=>(requestOptions=options,{ok:true,json:async()=>data}),console,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/assets/js/bench.js'),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requestOptions.cache,'no-cache');
 const ids=()=>[...element('matrixBody').innerHTML.matchAll(/<tr data-model="([^"]+)"/g)].map(m=>m[1]);
 const result=BenchmarkRank.build(data,data.config.snapshot_date,{min:data.config.default_families,access:'all',query:'',view:'all'});
 const expected=OCRComparison.enrich(result,data);const original=ids();
 for(const key of ['model','speed','price',...result.columns.map(c=>c.id),'rank']){
  const direction=OCRComparison.defaultDirection(key,result);
  element('matrixHead').handlers.click({target:{closest:()=>({dataset:{ocrSort:key}})}});
  assert.deepEqual(ids(),OCRComparison.sortRows(expected.rows,key,direction).map(r=>r.id));
  assert.match(element('matrixHead').innerHTML,new RegExp('aria-sort="'+(direction==='asc'?'ascending':'descending')+'"[^]*?data-ocr-sort="'+key+'"'));
  element('matrixHead').handlers.click({target:{closest:()=>({dataset:{ocrSort:key}})}});
  assert.deepEqual(ids(),OCRComparison.sortRows(expected.rows,key,direction==='asc'?'desc':'asc').map(r=>r.id));
 }
 element('ocrInputTokens').value='300000';element('ocrInputTokens').handlers.input();assert.equal(element('ocrInputTokens').value,200000);
 element('ocrHourlyRate').value='2';element('ocrHourlyRate').handlers.input();assert.match(element('matrixBody').innerHTML,/\$2\.00\/reported setup-hour/);
 element('coverage').value='0';element('coverage').handlers.change();assert.ok(ids().length>original.length);
 element('access').value='open';element('access').handlers.change();assert.ok(ids().every(id=>data.models.find(m=>m.id===id).access==='open'));
 element('historyRange').value='0';element('historyRange').handlers.input();assert.equal(element('historyDate').textContent,data.config.release_start);
 buttons.find(b=>b.dataset.view==='price').handlers.click();assert.equal(element('matrixPanel').hidden,true);
 element('ocrReset').handlers.click();assert.equal(element('matrixPanel').hidden,false);assert.equal(element('pricingPanel').hidden,true);assert.equal(element('ocrHourlyRate').value,1);assert.equal(element('ocrInputTokens').value,1000);assert.equal(element('historyDate').textContent,data.config.snapshot_date);assert.deepEqual(ids(),original);
});
