const fs = require('node:fs');
const path = require('node:path');
const directory = path.join(__dirname, '..', 'data');
const get = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const jsonl = file => fs.readFileSync(path.join(directory, file), 'utf8').split(/\r?\n/).filter(line => line.trim()).map(JSON.parse);

function loadSTT() {
  const config = get('stt/config.json');
  const models = get('models/registry.json').filter(model => model.topics?.includes('stt'));
  const sources = get('stt/sources.json');
  const tests = fs.readdirSync(path.join(directory, 'stt/tests')).filter(file => file.endsWith('.json')).map(file => get('stt/tests/' + file));
  const accuracyTests = tests.filter(test => test.task === 'transcription');
  const files = fs.readdirSync(path.join(directory, 'stt/results')).filter(file => file.endsWith('.jsonl'));
  for (const file of files) {
    if (!accuracyTests.some(test => file === test.id + '.jsonl')) throw Error('Unknown speech result file: ' + file);
  }
  const rawRecords = accuracyTests.flatMap(test => jsonl('stt/results/' + test.id + '.jsonl').map(record => ({...record, benchmark: test.id})));
  // Selection operates on one source's measured metric, never on an invented
  // suite average. The raw published rows remain intact for validation/audit.
  const resultsByKey = {};
  for (const record of rawRecords) {
    for (const [metric, value] of Object.entries(record.metrics || {})) {
      const key = record.model + '|' + record.benchmark + ':' + metric;
      (resultsByKey[key] ??= []).push({...record, metric, value});
    }
  }
  return {config, models, sources, tests, accuracyTests, rawRecords, resultsByKey,
    sizes: jsonl('stt/sizes.jsonl'), throughput: jsonl('stt/throughput.jsonl'), latency:jsonl('stt/latency.jsonl'),
    pricingContexts:get('stt/pricing-access.json'), pricing:jsonl('stt/pricing.jsonl'), tokenPricing:jsonl('stt/pricing-tokens.jsonl')};
}

module.exports = {loadSTT};
