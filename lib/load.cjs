const fs = require('node:fs');
const path = require('node:path');
const {selectPagePrices, describePrices} = require('./pricing.cjs');
const dir = path.join(__dirname, '..', 'data');
const get = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const jsonl = file => fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter(line => line.trim()).map(JSON.parse);

function loadOCR() {
  const config = get('ocr/config.json');
  const models = get('models/registry.json').filter(model => !model.topics || model.topics.includes('ocr'));
  const sources = get('ocr/sources.json');
  const tests = fs.readdirSync(path.join(dir, 'ocr/tests')).filter(file => file.endsWith('.json')).map(file => get('ocr/tests/' + file));
  const rawRecords = tests.flatMap(test => jsonl('ocr/results/' + test.id + '.jsonl').map(record => ({...record, benchmark: test.id})));
  const records = [];
  for (const record of rawRecords) {
    const test = tests.find(test => test.id === record.benchmark);
    const value = record.metrics?.[test.primary_metric];
    if (typeof value === 'number' && Number.isFinite(value)) {
      records.push({...record, value, evidence: record.evidence || sources[record.source_id]?.kind || 'imported'});
    }
  }
  const resultsByKey = {};
  for (const record of records) (resultsByKey[record.model + '|' + record.benchmark] ??= []).push(record);
  const pricing = jsonl('ocr/pricing.jsonl');
  const tokenPricing = jsonl('ocr/pricing-tokens.jsonl');
  const throughput=jsonl('ocr/throughput.jsonl');
  const pricingByModel = selectPagePrices(pricing);
  const priceInfoByModel = describePrices(models, pricing, tokenPricing, pricingByModel);
  const primaryTests = tests.filter(test => test.primary !== false && !['openocr-hard', 'chandra-internal', 'omnidoc-v16-en', 'mdp-public'].includes(test.id));
  return {config, models, tests, primaryTests, coverageTests: tests.filter(test => primaryTests.includes(test) || test.id === 'omnidoc-v16-en'),
    sources, throughput, rawRecords, records, resultsByKey, pricing, tokenPricing, pricingByModel, priceInfoByModel};
}
module.exports = {loadOCR};
