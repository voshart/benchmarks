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
    if (model.price_context) {
      const context=model.price_context;
      assert.ok(context.label && context.note && date(context.verified_on) && data.sources[context.source_id], 'invalid model price context');
      if (context.amount_per_1000_pages != null) assert.ok(context.currency && finite(context.amount_per_1000_pages), 'invalid contextual price');
    }
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
  const speedIds = new Set();
  for (const record of data.throughput || []) {
    assert.ok(record.id && !speedIds.has(record.id), 'duplicate or missing throughput ID'); speedIds.add(record.id);
    assert.ok(models.has(record.model), 'unknown throughput model');
    assert.ok(data.sources[record.source_id], 'unknown throughput source');
    assert.ok(date(record.as_of), 'invalid throughput date');
    assert.ok(['pages_per_second', 'median_seconds_per_page', 'seconds_per_image', 'pages_per_day_lower_bound'].includes(record.unit), 'unknown throughput unit');
    assert.ok(['observed', 'reported_claim'].includes(record.status), 'unknown throughput status');
    assert.ok(['author_reported', 'vendor_comparison'].includes(record.evidence), 'missing throughput evidence class');
    for (const key of ['comparison_default', 'hardware_known', 'cost_eligible']) assert.equal(typeof record[key], 'boolean', 'missing throughput eligibility: '+key);
    for (const key of ['hardware', 'pipeline', 'dataset', 'batch', 'precision', 'comparison_cohort']) assert.ok(typeof record[key] === 'string' && record[key], 'missing throughput context: '+key);
    if (record.unit === 'pages_per_second') assert.ok(finite(record.pages_per_second) && record.pages_per_second > 0, 'invalid pages/sec');
    else assert.ok(record.display_value, 'context-only speed needs display value');
    if (record.comparison_default) {
      assert.equal(record.unit, 'pages_per_second', 'non-throughput default speed');
      assert.equal(record.status, 'observed', 'claim cannot be default speed');
      assert.equal(record.hardware_known, true, 'default speed requires reported hardware');
      assert.ok(finite(record.selection_priority), 'default speed requires declared source priority');
    }
    if (record.cost_eligible) {
      assert.equal(record.unit, 'pages_per_second', 'cost requires aggregate throughput, not median latency');
      assert.equal(record.hardware_known, true, 'cost requires known setup');
    }
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
