const { readJSON: get, readJSONL: jsonl, readProtocols, readResults } = require('./read-data.cjs');
const { normalizeTariff, normalizePriceContext } = require('./currency.cjs');

function loadSTT() {
  const config = get('stt/config.json');
  const models = get('models/registry.json').filter((model) => model.topics?.includes('stt'));
  const sources = get('stt/sources.json');
  const tests = readProtocols('stt');
  const accuracyTests = tests.filter((test) => test.task === 'transcription');
  const rawRecords = readResults('stt', accuracyTests);
  // Selection operates on one source's measured metric, never on an invented
  // suite average. The raw published rows remain intact for validation/audit.
  const resultsByKey = {};
  for (const record of rawRecords) {
    for (const [metric, value] of Object.entries(record.metrics || {})) {
      const key = record.model + '|' + record.benchmark + ':' + metric;
      (resultsByKey[key] ??= []).push({ ...record, metric, value });
    }
  }
  const rawPricing = jsonl('stt/pricing.jsonl');
  return {
    config,
    models,
    sources,
    tests,
    accuracyTests,
    rawRecords,
    resultsByKey,
    rawPricing,
    sizes: jsonl('stt/sizes.jsonl'),
    throughput: jsonl('stt/throughput.jsonl'),
    latency: jsonl('stt/latency.jsonl'),
    pricingContexts: get('stt/pricing-access.json').map((record) => normalizePriceContext(record)),
    pricing: rawPricing.map((record) => normalizeTariff(record)),
    tokenPricing: jsonl('stt/pricing-tokens.jsonl')
  };
}

module.exports = { loadSTT };
