const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSTT } = require('../lib/load-stt.cjs');
const { validateSTT } = require('../lib/validate-stt.cjs');
const Speech = require('../src/assets/js/speech.js');
const Matrix = require('../src/assets/js/speech-matrix.js');
const fs = require('node:fs');
const path = require('node:path');
const data = loadSTT();
test('every hosted model has sourced price or dated actionable access context', () => {
  for (const model of data.models.filter((m) => m.access === 'closed')) {
    const price = Speech.selectPrice(data, model.id),
      context = data.pricingContexts.find((c) => c.model === model.id);
    assert.ok(price || context, model.id);
    if (context) {
      assert.equal(context.verified_on, '2026-10-22');
      assert.ok(context.source_urls.length);
      assert.ok(context.note.length > 50);
    }
  }
});
test('new exact-model API rates normalize correctly and retain product scope', () => {
  for (const [model, amount] of Object.entries({
    'sprag-symphony': 0.09,
    'speechmatics-enhanced': 0.75,
    'revai-machine': 0.2,
    'google-chirp': 0.96,
    'microsoft-azure-speech-07-2026': 0.36,
    'meta-muse-voice-transcribe': 0.18
  })) {
    const record = Speech.selectPrice(data, 'stt-' + model);
    assert.equal(record.amount, amount, model);
    assert.equal(record.version_scope, 'current_service');
  }
  assert.equal(Speech.selectPrice(data, 'stt-revai-machine').language, 'en');
  for (const model of [
    'otterai-speech-v3-1',
    'zoom-scribe-v1',
    'zoom-scribe-v2-pro',
    'reson8-resonant-1',
    'reson8-resonant-1-flash',
    'microsoft-azure-speech-06-2026',
    'revai-fusion',
    'assemblyai-universal-3-pro'
  ])
    assert.equal(Speech.selectPrice(data, 'stt-' + model), null, model);
});
test('token estimates and subscription context never masquerade as flat model tariffs', () => {
  const result = Speech.build(data, { missing: true, compact: true });
  for (const [id, value] of [
    ['stt-soniox-stt-async-v5', 0.1],
    ['stt-gemini-gemini-3-5-transcribe', 0.3]
  ]) {
    const row = [...result.rows, ...result.unscoredRows].find((r) => r.id === id);
    assert.equal(row.price, null);
    assert.equal(Speech.costSortValue(row), value);
    assert.equal(row.priceContext.hourly_estimate.basis, 'vendor_estimate');
  }
  const otter = result.rows.find((r) => r.id === 'stt-otterai-speech-v3-1');
  assert.equal(Speech.costSortValue(otter), undefined);
  assert.match(otter.priceContext.note, /NOT API prices/);
  const rendered = Speech.renderRows(result, data) + Speech.renderUnscored(result, data);
  assert.match(rendered, /token est\./);
  assert.match(rendered, /Subscription/);
  assert.match(rendered, /≈\$0\.1791/);
  assert.match(rendered, /Retired/);
});
test('price sorting leaves nonnumeric contexts last in both directions and never changes accuracy ranks', () => {
  const base = Speech.build(data, { compact: true });
  const ranks = base.rows.map((r) => [r.id, r.benchmarkRank, r.benchmarkValue]).sort();
  for (const sortDirection of ['asc', 'desc']) {
    const result = Speech.build(data, { compact: true, sort: 'price', sortDirection });
    assert.deepEqual(
      result.rows.map((r) => [r.id, r.benchmarkRank, r.benchmarkValue]).sort(),
      ranks
    );
    let unknown = false;
    for (const row of result.rows) {
      const n = Speech.costSortValue(row);
      if (n == null) unknown = true;
      else assert.equal(unknown, false);
    }
  }
  assert.equal(base.priceCount, 9);
  assert.equal(base.localCostCount, 23);
  const clone = structuredClone(data);
  clone.pricingContexts[0].verified_on = 'invalid';
  assert.throws(() => validateSTT(clone));
});

test('USD tariffs preserve native source amounts, units, dates and full conversion precision', () => {
  const source = fs
    .readFileSync(path.join(__dirname, '../data/stt/pricing.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map(JSON.parse);
  assert.deepEqual(data.rawPricing, source);
  assert.ok(data.pricing.every((record) => record.currency === 'USD'));
  for (const [i, original] of source.entries()) {
    const record = data.pricing[i];
    if (original.currency === 'USD') {
      assert.deepEqual(record, original);
      continue;
    }
    assert.equal(record.original_currency, original.currency);
    assert.equal(record.original_amount, original.amount);
    assert.equal(record.published_currency, original.currency);
    assert.equal(record.amount, original.amount * record.fx.rate);
    assert.equal(record.fx.rate, 1.1193);
    assert.equal(record.fx.as_of, '2026-10-23');
    assert.equal(record.approximate, true);
    for (const key of [
      'published_amount',
      'published_unit',
      'unit',
      'source_id',
      'as_of',
      'verified_on',
      'mode',
      'tier',
      'comparison_default',
      'verification_status',
      'version_scope'
    ])
      assert.deepEqual(record[key], original[key], key);
  }
  const gladia = Speech.selectPrice(data, 'stt-gladia-solaria-3');
  assert.equal(gladia.amount, 0.179088);
  assert.equal(gladia.original_amount, 0.16);
  const payload = JSON.parse(new (require('../src/stt/data.11ty.js'))().render());
  assert.deepEqual(payload.pricing, data.pricing);
  assert.deepEqual(payload.rawPricing, source);
});

test('converted USD prices sort numerically in both STT views without changing accuracy ranks', () => {
  const native = { ...data, pricing: data.rawPricing };
  const accuracy = (result) =>
    result.rows
      .map((row) => [
        row.id,
        row.benchmarkRank ?? row.rank,
        row.benchmarkValue ?? null,
        row.coreCount ?? null
      ])
      .sort();
  assert.deepEqual(
    accuracy(Speech.build(data, { compact: true, missing: true })),
    accuracy(Speech.build(native, { compact: true, missing: true }))
  );
  assert.deepEqual(
    accuracy(Matrix.build(data, { min: 0 })),
    accuracy(Matrix.build(native, { min: 0 }))
  );
  for (const renderer of [Speech, Matrix]) {
    const result = renderer.build(data, { compact: true, missing: true, min: 0, sort: 'price' });
    const value = (row) =>
      renderer === Speech ? Speech.costSortValue(row) : row.priceInfo.record?.amount;
    const ordered = result.rows.filter((row) => Number.isFinite(value(row)));
    for (let i = 1; i < ordered.length; i++)
      assert.ok(
        value(ordered[i - 1]) <= value(ordered[i]),
        renderer === Speech ? 'protocol' : 'matrix'
      );
    const gladia = ordered.find((row) => row.id === 'stt-gladia-solaria-3');
    assert.equal(value(gladia), 0.16 * 1.1193);
    assert.ok(
      ordered.findIndex((row) => row.id === 'stt-assemblyai-universal-2') < ordered.indexOf(gladia)
    );
    assert.ok(
      ordered.indexOf(gladia) <
        ordered.findIndex((row) => row.id === 'stt-voxtral-mini-transcribe-2602-api')
    );
  }
});

test('USD conversion keeps subscription version uncertainty and exposes linked FX only in details', () => {
  const result = Speech.build(data, { compact: true, missing: true });
  for (const model of ['stt-reson8-resonant-1', 'stt-reson8-resonant-1-flash']) {
    const row = result.rows.find((row) => row.id === model),
      context = row.priceContext;
    assert.equal(context.status, 'subscription_version_unverified');
    assert.equal(Speech.selectPrice(data, model), null);
    assert.equal(Speech.costSortValue(row), undefined);
    assert.equal(Speech.priceInfo(data, row.model).record, undefined);
    assert.deepEqual(
      context.prices.map((price) => price.original_amount),
      [20, 100, 0.2, 0.36, 0.24]
    );
    for (const price of context.prices) {
      assert.equal(price.currency, 'USD');
      assert.equal(price.amount, price.original_amount * 1.1193);
      assert.equal(price.comparison_default, false);
    }
    assert.match(context.note, /mapping remains unverified/);
    assert.match(context.note, /USD context:/);
    const details = Speech.renderPriceDetails(model, data);
    assert.ok(details.includes(`href="${context.fx.source_url}"`));
    assert.ok(details.includes(context.fx.as_of));
    assert.match(details, /Original tariffs:/);
    assert.match(details, /≈\$22\.39/);
  }
  const gladia = result.rows.find((row) => row.id === 'stt-gladia-solaria-3');
  const html = Speech.renderRows({ ...result, rows: [gladia] }, data);
  const cell = html
    .match(/<td class="deployment-cost">([\s\S]*?)<\/td>/)[1]
    .replace(/<[^>]+>/g, '');
  assert.equal(cell, '≈$0.1791API');
  assert.doesNotMatch(cell, /EUR|€|Original|Converted/);
  const details = Speech.renderPriceDetails(gladia.id, data);
  assert.match(details, /≈USD 0\.1791 \/ audio hour/);
  assert.match(details, /≈USD 0\.7611 \/ audio hour/);
  assert.match(details, /Original tariff: EUR 0\.16/);
  assert.ok(details.includes(`href="${gladia.price.fx.source_url}"`));
  const matrix = Matrix.build(data, { query: 'Gladia', min: 0 });
  const matrixHtml = Matrix.renderRows(matrix, data);
  assert.match(matrixHtml, /popovertarget="speech-price-stt-gladia-solaria-3"/);
  assert.match(
    matrixHtml,
    /popover="auto" role="dialog" aria-labelledby="speech-price-stt-gladia-solaria-3-title"/
  );
  assert.match(matrixHtml, /≈\$0\.1791†/);
  assert.ok(matrixHtml.includes(`href="${gladia.price.fx.source_url}"`));
});

test('STT validation rejects broken FX arithmetic, missing provenance and native-unit drift', () => {
  assert.doesNotThrow(() => validateSTT(data));
  for (const mutate of [
    (record) => {
      record.amount = 0.16;
    },
    (record) => {
      record.fx.rate = 0;
    },
    (record) => {
      record.fx.as_of = '2026-02-30';
    },
    (record) => {
      record.fx.source_url = '';
    },
    (record) => {
      delete record.fx.source_label;
    },
    (record) => {
      delete record.fx;
    },
    (record) => {
      record.original_amount = 0.17;
    },
    (record) => {
      record.published_amount = 0.17;
    },
    (record) => {
      record.published_currency = 'USD';
    }
  ]) {
    const altered = structuredClone(data);
    mutate(altered.pricing.find((record) => record.original_currency === 'EUR'));
    assert.throws(() => validateSTT(altered), /speech/);
  }
  const context = structuredClone(data);
  context.pricingContexts.find((record) => record.prices).prices[0].fx.as_of = 'invalid';
  assert.throws(() => validateSTT(context), /speech FX/);
});
