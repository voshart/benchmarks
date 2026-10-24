const { readJSON: get, readJSONL: jsonl, readProtocols, readResults } = require('./read-data.cjs');
const { selectPagePrices, describePrices } = require('./pricing.cjs');
const { exchangeRates, normalizePriceContext } = require('./currency.cjs');

function loadOCR() {
  const config = get('ocr/config.json');
  const models = get('models/registry.json')
    .filter((model) => !model.topics || model.topics.includes('ocr'))
    .map((model) =>
      model.price_context
        ? { ...model, price_context: normalizePriceContext(model.price_context) }
        : model
    );
  const sources = get('ocr/sources.json');
  const tests = readProtocols('ocr');
  const rawRecords = readResults('ocr', tests);
  const records = [];
  for (const record of rawRecords) {
    const test = tests.find((test) => test.id === record.benchmark);
    const value = record.metrics?.[test.primary_metric];
    if (typeof value === 'number' && Number.isFinite(value)) {
      records.push({
        ...record,
        value,
        evidence: record.evidence || sources[record.source_id]?.kind || 'imported'
      });
    }
  }
  const resultsByKey = {};
  for (const record of records)
    (resultsByKey[record.model + '|' + record.benchmark] ??= []).push(record);
  const pricing = jsonl('ocr/pricing.jsonl');
  const tokenPricing = jsonl('ocr/pricing-tokens.jsonl');
  const throughput = jsonl('ocr/throughput.jsonl');
  const throughputEstimates = jsonl('ocr/throughput-estimates.jsonl');
  const ocrReference = get('ocr/reference-throughput.json');
  const pricingByModel = selectPagePrices(pricing);
  const priceInfoByModel = describePrices(models, pricing, tokenPricing, pricingByModel);
  const primaryTests = tests.filter((test) => test.primary !== false);
  return {
    config,
    models,
    tests,
    primaryTests,
    coverageTests: tests.filter((test) => test.coverage ?? test.primary !== false),
    sources,
    exchangeRates,
    throughput,
    throughputEstimates,
    ocrReference,
    rawRecords,
    records,
    resultsByKey,
    pricing,
    tokenPricing,
    pricingByModel,
    priceInfoByModel
  };
}
module.exports = { loadOCR };
