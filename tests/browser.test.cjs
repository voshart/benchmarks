const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadOCR} = require('../lib/load.cjs');
const BenchmarkRank = require('../lib/ranking.cjs');
const BenchmarkRankUI = require('../src/assets/js/rank-ui.js');

test('browser renders updated snapshot dates, source links, contextual prices and new research', async () => {
  const data = loadOCR();
  data.config.snapshot_date = '2026-11-13';
  const elements = {};
  const element = id => elements[id] ??= {value:id==='coverage'?String(data.config.default_families):id==='access'?'all':'', handlers:{},
    addEventListener(event, handler) {this.handlers[event]=handler;}, classList:{toggle(){}}};
  const buttons = ['all','new','price','secondary'].map(view => ({...element(view), dataset:{view}}));
  const document = {getElementById:element, querySelector:() => ({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}), querySelectorAll:() => buttons};
  const context = {document, BenchmarkRank, BenchmarkRankUI, fetch:async () => ({ok:true,json:async () => data}), console, setTimeout, clearTimeout};
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
