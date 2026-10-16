const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadOCR} = require('../lib/load.cjs');
const {selectPagePrices} = require('../lib/pricing.cjs');
const {validateData} = require('../lib/validate.cjs');
const {build} = require('../lib/ranking.cjs');

test('standard OCR price survives cheaper batch and more expensive annotated offerings', () => {
  const data = loadOCR();
  const observations = data.pricing.filter(p => p.model === 'mistral-ocr-4-1');
  const selected = selectPagePrices(observations.reverse());
  assert.equal(selected['mistral-ocr-4-1'].usd_per_1000_pages, 4);
  assert.ok(observations.some(p => p.mode === 'Batch' && p.usd_per_1000_pages === 2));
  assert.ok(observations.some(p => p.mode === 'Annotated' && p.usd_per_1000_pages === 5));
});

test('benchmark estimates retain operator provenance instead of becoming vendor tariffs', () => {
  const data = loadOCR(), price = data.pricingByModel['gpt-5-2'];
  assert.equal(price.basis, 'benchmark_estimate');
  assert.equal(price.usd_per_1000_pages, 21.35);
  assert.equal(data.sources[price.source_id].url, 'https://benchmarking.nanonets.com/models/gpt-5-2');
  assert.equal(data.tokenPricing.find(p => p.model === 'gpt-5-2').input_usd_per_million_tokens, 1.75);
});

test('token rates and open weights do not invent page prices', () => {
  const data = loadOCR();
  assert.equal(data.pricingByModel['gpt-5-4'], undefined);
  assert.equal(data.priceInfoByModel['gpt-5-4'].label, 'Token-priced');
  assert.equal(data.pricingByModel.teleocr, undefined);
  assert.equal(data.priceInfoByModel.teleocr.label, 'Self-hosted');
  assert.equal(data.pricingByModel['chandra-2-api'], undefined);
  assert.match(data.priceInfoByModel['chandra-2-api'].label, /^Service /);
});

test('raw invalid records cannot escape validation through loader filtering', () => {
  const data = loadOCR();
  data.rawRecords.push({model:'unknown-model', benchmark:'omnidoc-v16', source_id:'omni-official', metrics:{overall:null}});
  assert.throws(() => validateData(data), /unknown model/);
});

test('pricing validation rejects mixed units, missing provenance, and impossible dates', () => {
  const data = loadOCR();
  data.tokenPricing[0].usd_per_1000_pages = 10;
  assert.throws(() => validateData(data), /page field in token/);
  delete data.tokenPricing[0].usd_per_1000_pages;
  data.tokenPricing[0].as_of = '2026-02-30';
  assert.throws(() => validateData(data), /invalid price date/);
  data.tokenPricing[0].as_of = '2026-10-13';
  data.tokenPricing[0].source_id = 'missing-source';
  assert.throws(() => validateData(data), /unknown pricing source/);
});

test('new research shows qualified models while retaining default coverage and rank policy', () => {
  const data = loadOCR(), rows = build(data, undefined, {view:'new'}).rows;
  assert.ok(rows.some(r => r.id === 'xiaomi-ocr-0'));
  assert.ok(rows.some(r => r.id === 'polyocr-9b-layout'));
  assert.equal(rows.find(r => r.id === 'xiaomi-ocr-0').rankStatus, 'provisional');
  assert.ok(build(data).rows.some(r => r.id === 'xiaomi-ocr-0'));
  assert.ok(rows.filter(r => r.id.startsWith('polyocr')).every(r => r.rank == null));
  assert.equal(data.tests.find(t => t.id === 'omnidoc-v15-idp').core, false);
  assert.ok(!data.primaryTests.some(t => t.id === 'omnidoc-v15-idp'));
});

test('model release provenance separates public weights from reports with unreleased weights', () => {
  const data = loadOCR();
  assert.equal(data.models.find(m => m.id === 'xiaomi-ocr-0').release_date, '2026-09-30');
  assert.equal(data.models.find(m => m.id === 'polyocr-2-7b').release_date, null);
  assert.ok(!build(data, '2026-09-29', {view:'new'}).rows.some(r => r.id === 'xiaomi-ocr-0'));
});
