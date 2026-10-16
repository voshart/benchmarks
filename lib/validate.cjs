const assert = require('node:assert/strict');
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function validateData(data) {
  const models = new Set(data.models.map(model => model.id));
  const tests = new Map(data.tests.map(test => [test.id, test]));
  assert.equal(models.size, data.models.length, 'duplicate model ID');
  assert.equal(tests.size, data.tests.length, 'duplicate test ID');
  assert.ok(date(data.config.snapshot_date) && date(data.config.release_start), 'invalid snapshot range');
  assert.ok(data.config.release_start <= data.config.snapshot_date, 'reversed snapshot range');
  const seen = new Set();
  for (const model of data.models) {
    assert.ok(model.release_date == null || date(model.release_date), 'invalid model release date: ' + model.id);
    if (model.release_source_id) assert.ok(data.sources[model.release_source_id], 'unknown release source');
  }
  for (const record of data.rawRecords) {
    assert.ok(models.has(record.model), 'unknown model ' + record.model);
    assert.ok(tests.has(record.benchmark), 'unknown benchmark');
    assert.ok(data.sources[record.source_id], 'unknown source ' + record.source_id);
    assert.ok(record.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics), 'invalid metrics');
    for (const value of Object.values(record.metrics)) assert.ok(value == null || finite(value), 'invalid metric for ' + record.model);
    const test = tests.get(record.benchmark), value = record.metrics[test.primary_metric];
    if (value != null) assert.ok(value <= (test.unit === 'ratio' ? 1 : 100), 'primary metric outside unit range');
    const key = [record.benchmark, record.model, record.source_id].join('|');
    assert.ok(!seen.has(key), 'duplicate observation ' + key); seen.add(key);
  }
  for (const test of data.tests) {
    assert.ok(['percent', 'ratio'].includes(test.unit));
    assert.ok(['higher', 'lower'].includes(test.direction));
    assert.ok(data.sources[test.source], 'unknown test source');
  }
  const priceKeys = new Set();
  for (const price of [...data.pricing, ...data.tokenPricing]) {
    assert.ok(models.has(price.model), 'unknown pricing model ' + price.model);
    assert.ok(data.sources[price.source_id], 'unknown pricing source');
    assert.ok(date(price.as_of), 'invalid price date');
    if (price.verified_on) assert.ok(date(price.verified_on), 'invalid verification date');
    assert.ok(['verified', 'unverified_import'].includes(price.verification_status), 'missing verification status');
    if (price.verification_status === 'verified') assert.ok(price.verified_on && price.mode, 'verified price requires mode and verification date');
    const key = [price.model, price.source_id, price.mode, price.unit, price.as_of].join('|');
    assert.ok(!priceKeys.has(key), 'duplicate price ' + key); priceKeys.add(key);
    if (price.unit === 'usd_per_1000_pages') {
      assert.ok(finite(price.usd_per_1000_pages), 'invalid page price');
      assert.equal(price.input_usd_per_million_tokens, undefined, 'token fields in page-price record');
      for (const field of ['batch_usd_per_1000_pages', 'annotated_usd_per_1000_pages']) if (price[field] != null) assert.ok(finite(price[field]), 'invalid alternate page price');
    } else {
      assert.equal(price.unit, 'usd_per_million_tokens', 'unknown price unit');
      assert.equal(price.usd_per_1000_pages, undefined, 'page field in token-price record');
      for (const field of ['input_usd_per_million_tokens', 'output_usd_per_million_tokens']) assert.ok(finite(price[field]), 'invalid token price');
      if (price.cached_input_usd_per_million_tokens != null) assert.ok(finite(price.cached_input_usd_per_million_tokens), 'invalid cached token price');
    }
  }
}
module.exports = {validateData};
