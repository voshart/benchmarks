const assert = require('node:assert/strict');
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const evidence = new Set(['official', 'third_party', 'community', 'author_reported', 'vendor_comparison', 'vendor', 'mixed', 'research', 'imported', 'secondary', 'vendor_internal', 'assumed']);

function validateFX(fx) {
  assert.ok(fx && finite(fx.rate) && fx.rate > 0 && date(fx.as_of), 'invalid speech FX rate or date');
  assert.ok(typeof fx.source_id === 'string' && fx.source_id && typeof fx.source_label === 'string' && fx.source_label,
    'missing speech FX provenance');
  assert.match(fx.source_url || '', /^https:\/\//, 'speech FX requires a direct HTTPS source');
}

function validateUsdTariff(record) {
  assert.equal(record.currency, 'USD', 'speech display tariff must be normalized to USD');
  assert.ok(finite(record.amount), 'invalid speech tariff amount');
  if (record.fx || record.original_currency != null || record.original_amount != null) {
    validateFX(record.fx);
    assert.match(record.original_currency || '', /^[A-Z]{3}$/, 'invalid speech original currency');
    assert.notEqual(record.original_currency, 'USD', 'USD speech tariffs do not need FX');
    assert.ok(finite(record.original_amount), 'invalid speech original tariff amount');
    assert.equal(record.published_currency, record.original_currency, 'speech published tariff currency changed');
    assert.equal(record.approximate, true, 'converted speech tariff must be marked approximate');
    assert.ok(Math.abs(record.amount-record.original_amount*record.fx.rate)<1e-10, 'invalid speech USD conversion');
  } else if (record.published_currency != null) assert.equal(record.published_currency, 'USD');
}

function validateSTT(data) {
  const models = new Map(data.models.map(model => [model.id, model]));
  const tests = new Map(data.tests.map(test => [test.id, test]));
  assert.equal(models.size, data.models.length, 'duplicate speech model ID');
  assert.equal(tests.size, data.tests.length, 'duplicate speech test ID');
  assert.ok(date(data.config.snapshot_date), 'invalid speech snapshot date');
  assert.equal(data.config.ranking, 'speech-distinct-corpora-v1', 'unknown speech ranking methodology');
  assert.equal(data.config.default_families, 2, 'speech default coverage must remain two families');
  assert.equal(data.config.min_core_for_provisional, 2);
  assert.equal(data.config.min_core_for_rank, 3);
  assert.ok(date(data.config.release_start) && data.config.release_start <= data.config.snapshot_date, 'invalid speech history range');
  assert.ok(data.config.accuracy_tests.includes(data.config.default_test), 'invalid default speech protocol');
  for (const id of data.config.accuracy_tests) assert.equal(tests.get(id)?.task, 'transcription', 'unknown speech protocol');
  for (const source of Object.values(data.sources)) {
    assert.match(source.url, /^https:\/\//, 'speech source requires a direct HTTPS URL');
    assert.ok(date(source.verified_on), 'invalid speech source verification date');
    assert.ok(source.publication_operator && source.measurement_operator && source.quote, 'speech source requires provenance');
  }
  for (const model of data.models) {
    assert.ok(model.release_date == null || date(model.release_date), 'invalid speech release date');
    assert.ok(data.sources[model.source_id], 'unknown speech model source');
    if (model.release_date != null) assert.ok(data.sources[model.release_source_id], 'unknown speech release source');
  }
  for (const test of data.tests) {
    assert.ok(data.sources[test.source], 'unknown speech test source');
    assert.ok(['transcription', 'throughput', 'latency'].includes(test.task), 'unknown speech task');
    if (test.task !== 'transcription') {
      assert.equal(test.core, false, 'timing checks cannot add accuracy votes');
      assert.equal(test.unit, test.task === 'throughput' ? 'audio_seconds_per_wall_second' : 'milliseconds');
      continue;
    }
    assert.equal(test.direction, 'lower', 'speech transcription summaries must rank lower error as better');
    if (test.core) {
      assert.ok(data.config.matrix_tests.includes(test.id), 'unreviewed speech core family');
      assert.equal(test.min_models || 6, 6, 'speech maturity requires six models');
      assert.equal(test.min_organizations || 3, 3, 'speech maturity requires three organizations');
      assert.ok(['open-asr-english','coraal','multilingual'].includes(test.family), 'unreviewed speech corpus family');
    }
    assert.equal(new Set(test.metrics.map(metric => metric.id)).size, test.metrics.length, 'duplicate speech metric');
    for (const metric of test.metrics) {
      assert.ok(['wer_percent','oiwer_percent'].includes(metric.unit), 'unknown speech error metric');
      if (metric.unit === 'oiwer_percent') assert.equal(test.core, false, 'Hindi lattice OI-WER remains secondary');
      assert.equal(metric.direction, 'lower');
      assert.ok(metric.dataset && metric.dataset.split && metric.source_column, 'speech metric requires exact split/source label');
    }
    for (const id of test.mean_metrics) assert.ok(test.metrics.some(metric => metric.id === id), 'unknown mean component');
    if (test.summary_metric) assert.ok(test.metrics.some(metric => metric.id === test.summary_metric), 'unknown speech summary metric');
    if (test.component_sources) for (const metric of test.metrics) assert.ok(data.sources[metric.source_id], 'unknown language component source');
  }
  const seen = new Set();
  const observation = record => {
    assert.ok(models.has(record.model), 'unknown speech model ' + record.model);
    assert.ok(data.sources[record.source_id], 'unknown speech source ' + record.source_id);
    assert.ok(['observed', 'assumed'].includes(record.status), 'invalid speech observation status');
    assert.ok(date(record.verified_on || record.as_of), 'invalid speech observation date');
  };
  for (const record of data.rawRecords) {
    observation(record);
    const test = tests.get(record.benchmark);
    assert.equal(test?.task, 'transcription', 'unknown speech benchmark');
    assert.ok(evidence.has(record.evidence) && record.measurement_operator && record.source_model, 'missing speech measurement provenance');
    if (record.source_id === 'open-asr-2026-10-17') assert.equal(record.source_model, models.get(record.model).hub_id, 'speech generation mismatch');
    assert.ok(record.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics), 'invalid speech metrics');
    const keys = new Set([...test.metrics.map(metric => metric.id), test.published_mean_metric].filter(Boolean));
    for (const [key, value] of Object.entries(record.metrics)) {
      assert.ok(keys.has(key), 'unknown speech metric ' + key);
      // WER can exceed 100% because insertions count as errors.
      assert.ok(value == null || finite(value), 'invalid speech WER');
    }
    const key = [record.benchmark, record.model, record.source_id].join('|');
    assert.ok(!seen.has(key), 'duplicate speech observation'); seen.add(key);
  }
  for (const record of data.sizes) {
    observation(record);
    assert.ok(record.basis && (record.download_mb != null || record.parameters_million != null), 'missing speech size basis');
    for (const field of ['download_mb', 'parameters_million']) if (record[field] != null) assert.ok(finite(record[field]) && record[field] > 0, 'invalid speech size');
    if (record.download_bytes != null) {
      assert.ok(Number.isSafeInteger(record.download_bytes) && record.download_bytes > 0, 'invalid speech artifact bytes');
      assert.equal(record.download_mb, record.download_bytes / 1e6, 'speech artifact MB must use decimal bytes');
    }
    const key = ['size', record.model, record.source_id].join('|');
    assert.ok(!seen.has(key), 'duplicate speech size observation'); seen.add(key);
  }
  for (const record of data.throughput) {
    observation(record);
    assert.equal(tests.get(record.test_id)?.task, 'throughput', 'unknown speech throughput test');
    assert.ok(finite(record.rtfx) && record.rtfx > 0, 'invalid speech throughput');
    assert.ok(record.hardware && record.runtime && record.measurement_operator && evidence.has(record.evidence), 'missing speech hardware/runtime/operator');
    assert.ok(Number.isInteger(record.batch_size) && record.batch_size > 0, 'invalid speech batch size');
    assert.equal(typeof record.load_time_included, 'boolean');
    assert.equal(typeof record.feature_extraction_included, 'boolean');
    if (record.measured_on != null) assert.ok(date(record.measured_on), 'invalid speech timing date');
    const key = ['speed', record.model, record.test_id, record.source_id, record.hardware, record.runtime, record.batch_size, record.sample].join('|');
    assert.ok(!seen.has(key), 'duplicate speech throughput observation'); seen.add(key);
  }
  for (const record of data.latency) {
    observation(record);
    assert.equal(tests.get(record.test_id)?.task, 'latency', 'unknown speech latency test');
    assert.ok(finite(record.milliseconds), 'invalid speech latency');
    assert.ok(record.hardware && record.runtime && record.statistic && record.measurement_operator && evidence.has(record.evidence), 'missing latency definition/operator');
    const key = ['latency',record.model,record.test_id,record.source_id].join('|');
    assert.ok(!seen.has(key), 'duplicate speech latency observation'); seen.add(key);
  }
  const contextModels = new Set();
  for (const record of data.pricingContexts || []) {
    assert.ok(models.has(record.model), 'unknown price context model');
    assert.ok(!contextModels.has(record.model), 'duplicate price context model'); contextModels.add(record.model);
    assert.ok(date(record.verified_on) && record.label && record.status && record.note, 'incomplete price context');
    assert.ok(record.source_urls?.length && record.source_urls.every(url=>/^https:\/\//.test(url)), 'price context needs sources');
    if (record.hourly_estimate) {
      assert.equal(record.hourly_estimate.basis, 'vendor_estimate');
      assert.ok(finite(record.hourly_estimate.usd) && record.hourly_estimate.note, 'invalid hourly token estimate');
    }
    if (record.prices != null) {
      assert.ok(Array.isArray(record.prices) && record.prices.length, 'invalid contextual speech tariffs');
      for (const price of record.prices) {
        validateUsdTariff(price);
        assert.ok(['currency_per_month','currency_per_audio_hour'].includes(price.unit), 'invalid contextual speech tariff unit');
        assert.ok(price.label && price.basis && date(price.as_of), 'incomplete contextual speech tariff');
        assert.match(price.source_url || '', /^https:\/\//, 'contextual speech tariff requires a source');
      }
      if (record.fx) {
        validateFX(record.fx);
        assert.deepEqual(record.fx, record.prices.find(price => price.fx)?.fx, 'contextual speech FX provenance mismatch');
      }
    }
  }
  for (const record of [...data.pricing,...data.tokenPricing]) {
    assert.ok(models.has(record.model), 'unknown speech pricing model');
    assert.ok(data.sources[record.source_id], 'unknown speech pricing source');
    assert.ok(date(record.as_of) && date(record.verified_on), 'invalid speech pricing date');
    assert.ok(record.provider && record.mode && record.tier && record.version_scope, 'missing speech price configuration');
    assert.equal(record.verification_status, 'verified');
    const key = ['price',record.model,record.source_id,record.mode,record.tier,record.unit,record.as_of].join('|');
    assert.ok(!seen.has(key), 'duplicate speech price'); seen.add(key);
    if (record.unit === 'currency_per_audio_hour') {
      validateUsdTariff(record);
      assert.ok(finite(record.amount) && finite(record.published_amount), 'invalid speech hourly rate');
      const multiplier = record.published_unit === 'currency_per_audio_minute' ? 60 : record.published_unit === 'currency_per_audio_hour' ? 1 : null;
      assert.ok(multiplier && Math.abs((record.original_amount ?? record.amount)-record.published_amount*multiplier)<1e-10, 'invalid speech price normalization');
      assert.equal(record.input_audio_usd_per_million_tokens, undefined, 'token tariff in hourly record');
    } else {
      assert.equal(record.unit, 'usd_per_million_tokens', 'unknown speech pricing unit');
      assert.equal(record.currency, 'USD');
      assert.equal(record.amount, undefined, 'hourly estimate mixed with token rates');
      for (const field of ['input_audio_usd_per_million_tokens','input_text_usd_per_million_tokens','output_text_usd_per_million_tokens']) assert.ok(finite(record[field]), 'invalid speech token tariff');
    }
  }
}

module.exports = {validateSTT};
