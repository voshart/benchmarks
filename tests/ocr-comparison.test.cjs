const { test } = require('node:test');
const assert = require('node:assert/strict');
const OCR = require('../src/assets/js/ocr-comparison.js');
const { loadOCR } = require('../lib/load.cjs');
const { build } = require('../lib/ranking.cjs');
const model = { id: 'fixture', name: 'Fixture', access: 'open' };
const base = () => ({
  models: [model],
  sources: { s: { url: 'https://example.com/evidence' } },
  throughput: [],
  pricing: [],
  tokenPricing: []
});
const speed = (extra = {}) => ({
  model: model.id,
  source_id: 's',
  comparison_default: true,
  unit: 'pages_per_second',
  pages_per_second: 2,
  selection_priority: 10,
  as_of: '2026-10-22',
  hardware_known: true,
  cost_eligible: true,
  hardware: '2 GPUs + CPU',
  ...extra
});
const price = (extra = {}) => ({
  model: model.id,
  source_id: 's',
  verification_status: 'verified',
  comparison_default: true,
  basis: 'vendor_list',
  usd_per_1000_pages: 3,
  as_of: '2026-10-22',
  ...extra
});

test('OCR evidence selection uses declared priority, not fastest observation', () => {
  const data = base();
  data.throughput = [
    speed({ pages_per_second: 999, comparison_default: false }),
    speed({ pages_per_second: 100, selection_priority: 20 }),
    speed({ pages_per_second: 2, selection_priority: 10 }),
    speed({ pages_per_second: 3, selection_priority: 10, as_of: '2026-10-21' })
  ];
  const snapshot = JSON.stringify(data);
  const d = OCR.deployment(data, model);
  assert.equal(d.speed.pages_per_second, 2);
  assert.equal(d.records.length, 4);
  assert.equal(JSON.stringify(data), snapshot);
});

test('OCR all sortable numeric/text columns keep missing values last in either direction', () => {
  const make = (id, n) => ({
    id,
    name: n === null ? null : String(n),
    rank: n,
    scores: { accuracy: { value: n } },
    deployment: { speed: n === null ? null : { pages_per_second: n }, cost: { value: n } }
  });
  const rows = [
    make('missing1', null),
    make('two', 2),
    make('missing2', null),
    make('one', 1),
    make('two-tie', 2)
  ];
  for (const key of ['model', 'rank', 'speed', 'price', 'accuracy'])
    for (const direction of ['asc', 'desc']) {
      const sorted = OCR.sortRows(rows, key, direction);
      assert.deepEqual(
        sorted.slice(-2).map((r) => r.id),
        ['missing1', 'missing2'],
        `${key}/${direction}`
      );
      assert.deepEqual(
        sorted.slice(0, 3).map((r) => r.id),
        direction === 'asc' ? ['one', 'two', 'two-tie'] : ['two', 'two-tie', 'one']
      );
    }
  assert.equal(rows[0].id, 'missing1');
});

test('OCR token scenarios use per-million rates and cap billable inputs at200000', () => {
  const data = base();
  data.tokenPricing = [
    {
      model: model.id,
      verification_status: 'verified',
      source_id: 's',
      input_usd_per_million_tokens: 2,
      output_usd_per_million_tokens: 8,
      as_of: '2026-10-22'
    }
  ];
  const d = OCR.deployment(data, model, { inputTokens: 2000, outputTokens: 500 });
  assert.equal(d.cost.value, 8);
  assert.equal(d.cost.kind, 'token scenario');
  assert.equal(d.cost.estimated, true);
  assert.match(d.cost.note, /billable input/);
  assert.match(d.cost.note, /reasoning/);
  assert.deepEqual(OCR.assumptions({ inputTokens: Infinity, outputTokens: -1, hourlyRate: NaN }), {
    inputTokens: 1000,
    outputTokens: 0,
    hourlyRate: 1
  });
  assert.equal(
    OCR.deployment(data, model, { inputTokens: 999999, outputTokens: 999999 }).cost.value,
    2000
  );
  data.tokenPricing[0].verification_status = 'unverified';
  assert.equal(OCR.deployment(data, model).cost.value, null);
  data.tokenPricing[0].verification_status = 'verified';
  data.tokenPricing[0].comparison_default = false;
  assert.equal(OCR.deployment(data, model).cost.value, null);
});

test('OCR local cost is per complete reported setup-hour and requires positive eligible throughput', () => {
  const data = base();
  data.throughput = [speed()];
  const d = OCR.deployment(data, model, { hourlyRate: 7.2 });
  assert.equal(d.cost.value, 1);
  assert.equal(d.cost.kind, 'local compute');
  assert.match(d.cost.note, /complete reported setup/);
  assert.match(d.cost.note, /100% utilization/);
  assert.match(d.cost.note, /not a hardware market price/);
  for (const override of [
    { hardware_known: undefined },
    { cost_eligible: undefined },
    { hardware_known: false },
    { cost_eligible: false },
    { comparison_default: false },
    { pages_per_second: 0 },
    { pages_per_second: -1 },
    { pages_per_second: NaN },
    { pages_per_second: Infinity },
    { unit: 'tokens_per_second' }
  ]) {
    data.throughput = [speed(override)];
    assert.equal(OCR.deployment(data, model).cost.value, null, JSON.stringify(override));
  }
  data.throughput = [speed()];
  assert.equal(OCR.deployment(data, { ...model, access: 'closed' }).cost.value, null);
  assert.equal(
    OCR.deployment(data, model, { hourlyRate: 0 }).cost.value,
    0,
    'explicit zero assumption is not an API free claim'
  );
});

test('OCR exact API, benchmark estimate, current service and unverified prices remain distinct', () => {
  const data = base();
  data.pricing = [price({ basis: 'benchmark_estimate', usd_per_1000_pages: 0.1 }), price()];
  let d = OCR.deployment(data, model);
  assert.equal(d.cost.value, 3);
  assert.equal(d.cost.kind, 'API');
  assert.equal(d.cost.estimated, false);
  data.pricing = [price({ basis: 'benchmark_estimate' })];
  d = OCR.deployment(data, model);
  assert.equal(d.cost.kind, 'benchmark est.');
  assert.equal(d.cost.estimated, true);
  data.pricing = [price({ version_scope: 'current_service' })];
  d = OCR.deployment(data, model);
  assert.equal(d.cost.value, 3);
  assert.equal(d.cost.kind, 'current service');
  assert.equal(d.cost.estimated, false);
  assert.match(d.cost.label, /^Service \$/);
  assert.match(d.cost.note, /historical benchmark generation/);
  data.pricing = [price({ version_scope: 'current_service', comparison_default: false })];
  d = OCR.deployment(data, model);
  assert.equal(d.cost.value, null);
  assert.match(d.cost.label, /^Service \$/);
  data.pricing = [price({ verification_status: 'unverified' })];
  assert.equal(OCR.deployment(data, model).cost.value, null);
  data.pricing = [price({ basis: 'third_party_listing' })];
  assert.equal(OCR.deployment(data, model).cost.value, null);
  data.pricing = [price({ comparison_default: false })];
  assert.equal(OCR.deployment(data, model).cost.value, null);
});

test('OCR real evidence retains selected speed sources, exact tariffs and conservative contexts', () => {
  const data = loadOCR();
  const rows = data.models.map((m) => ({ model: m, ...OCR.deployment(data, m) }));
  for (const [id, value] of [
    ['lightonocr-3-0.8b', 3.32],
    ['lightonocr-3-1b', 3.52],
    ['lightonocr-3-4b', 2.03],
    ['chandra-2-open', 1.68],
    ['lightonocr-2-1b', 5.71]
  ])
    assert.equal(rows.find((r) => r.model.id === id).speed.pages_per_second, value, id);
  const tariff = data.tokenPricing.find((p) => p.model === 'gemini-3-6-flash');
  assert.equal(tariff.api_model, 'gemini-3.6-flash');
  assert.equal(tariff.input_usd_per_million_tokens, 0.75);
  assert.equal(tariff.output_usd_per_million_tokens, 3.75);
  assert.equal(tariff.verification_status, 'verified');
  assert.match(tariff.note, /2026-12-31/);
  const gemini = rows.find((r) => r.model.id === 'gemini-3-6-flash');
  assert.equal(gemini.cost.kind, 'token scenario');
  assert.equal(gemini.cost.value, 4.5);
  const indra = rows.find((r) => r.model.id === 'indra-ocr-1-1');
  assert.equal(indra.speed, null, 'median latency and OCR-only alternate are not auto throughput');
  assert.equal(indra.cost.kind, 'H100 scenario');
  assert.equal(indra.estimate.low, 0.5);
  const service = rows.find((r) => r.model.id === 'datalab-convert-accurate');
  assert.equal(service.cost.kind, 'current service');
  assert.equal(service.cost.value, 10);
  assert.match(service.cost.label, /^Service \$/);
  const context = rows.find((r) => r.model.id === 'chandra-2-1-api');
  assert.equal(context.cost.value, null);
});

test('OCR deployment assumptions never mutate raw accuracy or quality ranks', () => {
  const data = loadOCR();
  const result = build(data, data.config.snapshot_date, { min: 0 });
  const before = JSON.stringify(result),
    records = JSON.stringify(data.rawRecords);
  const low = OCR.enrich(result, data, { hourlyRate: 0.1, inputTokens: 100, outputTokens: 50 });
  const high = OCR.enrich(result, data, {
    hourlyRate: 100,
    inputTokens: 200000,
    outputTokens: 200000
  });
  const quality = (r) => r.rows.map(({ deployment, ...row }) => row);
  assert.deepEqual(quality(low), result.rows);
  assert.deepEqual(quality(high), result.rows);
  assert.equal(JSON.stringify(result), before);
  assert.equal(JSON.stringify(data.rawRecords), records);
  assert.ok(
    low.rows.some((r, i) => r.deployment.cost.value !== high.rows[i].deployment.cost.value),
    'scenario actually changes some costs'
  );
});

test('OCR speed details retain input, configuration and concurrency, with accessible column sorting', () => {
  const data = loadOCR(),
    result = build(data, data.config.snapshot_date, { min: 0 });
  const sample = result.rows[0];
  const scoped = {
    ...data,
    throughput: [
      speed({
        model: sample.id,
        source_id: Object.keys(data.sources)[0],
        input_type: 'PDF raster',
        configuration: 'layout <strict>',
        concurrency: 512,
        pipeline: 'vLLM',
        dataset: '512 pages',
        hardware_short: 'H100'
      })
    ]
  };
  const html = OCR.renderRows({ ...result, rows: [sample] }, scoped);
  assert.match(html, /input: PDF raster/);
  assert.match(html, /configuration: layout &lt;strict&gt;/);
  assert.match(html, /concurrency: 512/);
  const head = OCR.renderHead(result, { sortKey: 'speed', sortDirection: 'desc' });
  assert.match(head, /aria-sort="descending"/);
  assert.match(head, /<button type="button" class="column-sort" data-ocr-sort="speed"/);
  assert.match(head, /Quality only; speed and cost never affect this index/);
});

test('OCR throughput validation rejects source/identity/unit/eligibility mistakes', () => {
  const { validateData } = require('../lib/validate.cjs');
  for (const change of [
    { model: 'missing-model' },
    { source_id: 'missing-source' },
    { pages_per_second: -1 },
    { comparison_default: true, unit: 'median_seconds_per_page' },
    { cost_eligible: true, hardware_known: false },
    { cost_eligible: true, unit: 'median_seconds_per_page', comparison_default: false }
  ]) {
    const data = loadOCR();
    Object.assign(data.throughput[0], change);
    assert.throws(() => validateData(data));
  }
  const data = loadOCR();
  data.throughput.push({ ...data.throughput[0] });
  assert.throws(() => validateData(data), /duplicate/);
  assert.equal(
    loadOCR().throughput.find((r) => r.source_id === 'ocr-speed-glm-v2').batch,
    'unspecified'
  );
});

const estimate = (extra = {}) => ({
  model: model.id,
  status: 'assumed',
  confidence: 'low',
  low: 0.2,
  high: 4,
  hardware: 'Assumed1 A10080GB',
  hardware_short: 'A100 · batch',
  source_ids: ['s'],
  ...extra
});
test('OCR modeled ranges are separate, inverse-costed and subordinate to measured evidence and tariffs', () => {
  const data = base();
  data.throughputEstimates = [estimate()];
  let d = OCR.deployment(data, model);
  assert.equal(d.speed, null);
  assert.equal(d.records.length, 0);
  assert.equal(d.estimate.low, 0.2);
  assert.equal(d.cost.kind, 'modeled compute');
  assert.equal(d.cost.low, 1000 / (4 * 3600));
  assert.equal(d.cost.high, 1000 / (0.2 * 3600));
  assert.match(d.cost.note, /not market pricing/);
  assert.match(d.cost.note, /Low-confidence/);
  const doubled = OCR.deployment(data, model, { hourlyRate: 2 });
  assert.equal(doubled.cost.low, 2 * d.cost.low);
  assert.equal(doubled.cost.high, 2 * d.cost.high);
  assert.equal(doubled.estimate.low, 0.2);
  assert.equal(OCR.deployment(data, model, { hourlyRate: 0 }).cost.value, 0);
  data.throughput = [speed()];
  d = OCR.deployment(data, model);
  assert.equal(d.speed.pages_per_second, 2);
  assert.equal(d.cost.kind, 'local compute');
  data.pricing = [price()];
  assert.equal(OCR.deployment(data, model).cost.kind, 'API');
  for (const bad of [
    { status: 'observed' },
    { confidence: 'high' },
    { low: 0 },
    { low: NaN },
    { low: Infinity },
    { high: -1 },
    { high: 0.1 },
    { high: Infinity }
  ]) {
    data.throughput = [];
    data.pricing = [];
    data.throughputEstimates = [estimate(bad)];
    assert.equal(OCR.deployment(data, model).estimate, null);
    assert.equal(OCR.deployment(data, model).cost.value, null);
  }
  data.throughputEstimates = [estimate()];
  assert.equal(
    OCR.deployment(data, { ...model, access: 'closed' }).cost.value,
    null,
    'local scenario is not a hosted API price'
  );
});

test('OCR ranges sort by geometric midpoint with true ties and unknowns last in both directions', () => {
  const rows = [
    { id: 'unknown', deployment: {} },
    { id: 'wide', deployment: { estimate: estimate({ low: 0.1, high: 10 }), cost: { value: 1 } } },
    { id: 'measured', deployment: { speed: { pages_per_second: 1 }, cost: { value: 1 } } },
    { id: 'fast', deployment: { estimate: estimate({ low: 2, high: 8 }), cost: { value: 2 } } }
  ];
  for (const key of ['speed', 'price']) {
    assert.deepEqual(
      OCR.sortRows(rows, key, 'asc').map((r) => r.id),
      ['wide', 'measured', 'fast', 'unknown']
    );
    assert.deepEqual(
      OCR.sortRows(rows, key, 'desc').map((r) => r.id),
      ['fast', 'wide', 'measured', 'unknown']
    );
  }
});

test('OCR real modeled evidence is visible, sourced and isolated from accuracy', () => {
  const data = loadOCR(),
    result = build(data, data.config.snapshot_date, { min: 0 });
  const d = OCR.deployment(
    data,
    data.models.find((m) => m.id === 'teleocr')
  );
  assert.equal(d.speed, null);
  assert.equal(d.estimate.low, 0.2);
  assert.equal(d.estimate.high, 4);
  assert.match(d.cost.label, /≈\$0.03–\$1.39/);
  const tele = result.rows.find((r) => r.id === 'teleocr'),
    html = OCR.renderRows({ ...result, rows: [tele] }, data);
  assert.match(html, /≈0.2–9.2/);
  assert.match(html, /Common reference: H100 80GB/);
  assert.match(html, /Low-confidence modeled speed/);
  assert.match(html, /NOT a measurement, guarantee or statistical confidence interval/);
  assert.match(html, /popovertarget="ocr-details-teleocr"/);
  assert.match(html, /geometric midpoint/);
  const paddle = OCR.deployment(
    data,
    data.models.find((m) => m.id === 'paddleocr-vl-1-6')
  );
  assert.equal(paddle.speed.pages_per_second, 0.562);
  assert.equal(paddle.speed.hardware_short, 'H20 · 930p');
  assert.equal(paddle.cost.kind, 'H100 scenario');
  for (const id of ['hunyuanocr-1-5', 'glm-ocr', 'deepseek-ocr-2'])
    assert.equal(
      OCR.deployment(
        data,
        data.models.find((m) => m.id === id)
      ).speed.source_id,
      'ocr-speed-hunyuan15-h20-930-ar'
    );
  const without = build(
    { ...data, throughput: [], throughputEstimates: [] },
    data.config.snapshot_date,
    { min: 0 }
  );
  assert.deepEqual(result.rows, without.rows);
});

test('OCR estimate schema rejects fabricated status, missing context and invalid ranges', () => {
  const { validateData } = require('../lib/validate.cjs');
  for (const bad of [
    { model: 'missing' },
    { status: 'observed' },
    { confidence: 'high' },
    { source_ids: ['missing'] },
    { low: 0 },
    { high: -1 },
    { low: NaN },
    { high: Infinity },
    { hardware: '' },
    { workload: '' },
    { basis: '' },
    { limitations: '' }
  ]) {
    const data = loadOCR();
    Object.assign(data.throughputEstimates[0], bad);
    assert.throws(() => validateData(data));
  }
  const data = loadOCR();
  data.throughputEstimates.push({ ...data.throughputEstimates[0] });
  assert.throws(() => validateData(data), /duplicate speed estimate/);
});

test('OCR common-card estimates replace mixed hardware in sorting and all local compute costs', () => {
  const data = loadOCR(),
    get = (id) =>
      OCR.deployment(
        data,
        data.models.find((m) => m.id === id)
      );
  for (const e of data.ocrReference.models) {
    const d = get(e.model);
    assert.equal(e.profile, 'h100-80gb-v1');
    if (e.status === 'estimated') {
      assert.equal(d.referenceCost.kind, 'H100 scenario');
      assert.equal(d.referenceCost.low, 1000 / (e.high * 3600));
      assert.equal(d.referenceCost.high, 1000 / (e.low * 3600));
      const two = OCR.deployment(
        data,
        data.models.find((m) => m.id === e.model),
        { hourlyRate: 2 }
      );
      assert.equal(two.referenceCost.low, 2 * d.referenceCost.low);
      assert.equal(two.referenceCost.high, 2 * d.referenceCost.high);
      assert.deepEqual(two.reference, d.reference);
    } else if (['too-large', 'tight-fit'].includes(e.status)) {
      assert.equal(d.cost.value, null);
      assert.equal(e.low, undefined);
    }
  }
  const p = get('paddleocr-vl-1-6');
  assert.equal(p.speed.pages_per_second, 0.562, 'original H20 evidence retained');
  assert.equal(p.reference.low, 0.5);
  assert.equal(p.reference.high, 3.2);
  const a = get('teleocr'),
    b = get('xiaomi-ocr-0');
  assert.match(a.reference.basis, /A100/);
  assert.match(b.reference.basis, /not a measured hardware ratio/);
  assert.equal(get('indra-ocr-1-1').reference.path, 'cpu');
  assert.match(get('indra-ocr-1-1').reference.fit, /GPU unused/);
  assert.equal(get('qwen3-vl-plus').reference.status, 'hosted');
  assert.equal(get('gemini-3-6-flash').cost.kind, 'token scenario');
  const rows = [
    { id: 'missing', deployment: get('qwen3-5-397b-a17b') },
    { id: 'paddle', deployment: p },
    { id: 'xiaomi', deployment: b }
  ];
  assert.deepEqual(
    OCR.sortRows(rows, 'speed', 'asc').map((r) => r.id),
    ['xiaomi', 'paddle', 'missing']
  );
  assert.deepEqual(
    OCR.sortRows(rows, 'speed', 'desc').map((r) => r.id),
    ['paddle', 'xiaomi', 'missing']
  );
});

test('OCR reference validation rejects unsupported speed and preserves quality inputs', () => {
  const { validateData } = require('../lib/validate.cjs');
  for (const bad of [
    { status: 'observed' },
    { profile: 'a100' },
    { confidence: 'high' },
    { low: 0 },
    { high: Infinity },
    { source_ids: ['missing'] },
    { status: 'too-large' }
  ]) {
    const d = loadOCR();
    Object.assign(
      d.ocrReference.models.find((r) => r.status === 'estimated'),
      bad
    );
    assert.throws(() => validateData(d));
  }
  const data = loadOCR(),
    original = JSON.stringify(data.rawRecords),
    before = build(data, data.config.snapshot_date, { min: 0 });
  const noReference = build({ ...data, ocrReference: null }, data.config.snapshot_date, { min: 0 });
  assert.deepEqual(before, noReference);
  OCR.enrich(before, data, { hourlyRate: 100 });
  assert.equal(JSON.stringify(data.rawRecords), original);
});

test('Chandra 2.5 preserves hosted modes and excludes incompatible scores from ranking', () => {
  const data = loadOCR(),
    m = data.models.find((m) => m.id === 'chandra-2-5-api'),
    d = OCR.deployment(data, m);
  assert.equal(m.release_date, '2026-10-14');
  assert.equal(m.access, 'closed');
  assert.equal(d.speed, null);
  assert.equal(d.estimate, null);
  assert.equal(d.cost.value, 10);
  assert.match(d.cost.note, /balanced \$4/);
  assert.equal(d.records.length, 3);
  assert.ok(
    d.records.every(
      (r) => !r.cost_eligible && !r.comparison_default && r.unit === 'median_seconds_per_page'
    )
  );
  const result = build(data, data.config.snapshot_date, { min: 0 }),
    row = result.rows.find((r) => r.id === m.id);
  assert.equal(row.coreCount, 1);
  assert.equal(row.scores.olmocr, null);
  assert.equal(row.scores['chandra-2-5-olm-no-hf'].value, 86.9);
  assert.equal(row.scores['omniparse-chandra-2-5-release'].value, 92.7);
  assert.equal(data.resultsByKey[m.id + '|omniparse-indra-1-1'], undefined);
  assert.match(OCR.renderRows({ ...result, rows: [row] }, data), /balanced 91.6/);
});

test('Gemini 4 Argon keeps exact identity, OCR task protocols and token scenario separate', () => {
  const data = loadOCR(),
    m = data.models.find((m) => m.id === 'gemini-4-argon'),
    d = OCR.deployment(data, m);
  assert.equal(m.access, 'closed');
  assert.equal(d.speed, null);
  assert.equal(d.estimate, null);
  assert.equal(d.cost.kind, 'token scenario');
  assert.equal(d.cost.value, 12);
  assert.match(d.cost.note, /2026-11-30/);
  assert.match(d.cost.note, /2026-12-01/);
  const result = build(data, data.config.snapshot_date, { min: 0 }),
    row = result.rows.find((r) => r.id === m.id);
  assert.equal(row.rank, null);
  assert.equal(row.coreCount, 0);
  assert.equal(row.scores.olmocr, null);
  assert.equal(row.scores['roboflow-ocr-202610'].value, 88);
  assert.equal(row.scores['inksight-public-handwriting-202610'].value, 8.7);
  assert.equal(
    data.tests.find((t) => t.id === 'inksight-public-handwriting-202610').direction,
    'lower'
  );
  assert.ok(d.records.every((r) => !r.comparison_default && !r.cost_eligible));
  assert.equal(OCR.deployment(data, m, { inputTokens: 2000, outputTokens: 1000 }).cost.value, 14);
});

test('small OCR additions separate page scenarios, text-only components and matching triple-pass quality', () => {
  const data = loadOCR(),
    ids = [
      'pp-ocrv5-server',
      'pp-ocrv5-mobile',
      'pp-ocrv4-mobile',
      'jina-ocr-v1',
      'surya-ocr-2',
      'nemotron-parse-2',
      'nemotron-3-5-parse'
    ];
  for (const id of ids) {
    const m = data.models.find((m) => m.id === id),
      d = OCR.deployment(data, m);
    assert.equal(d.reference.status, 'estimated');
    assert.equal(d.cost.kind, 'H100 scenario');
    assert.equal(OCR.deployment(data, m, { hourlyRate: 2 }).cost.low, 2 * d.cost.low);
    assert.equal(OCR.deployment(data, m, { hourlyRate: 2 }).cost.high, 2 * d.cost.high);
  }
  for (const id of ids.slice(0, 3)) {
    const m = data.models.find((m) => m.id === id),
      d = OCR.deployment(data, m);
    assert.match(m.name, /text only/);
    assert.equal(d.speed, null);
    assert.equal(d.records[0].unit, 'seconds_per_image');
    assert.equal(d.records[0].cost_eligible, false);
    assert.match(d.reference.basis, /50 text lines/);
  }
  const m = data.models.find((m) => m.id === 'nemotron-3-5-parse'),
    d = OCR.deployment(data, m);
  assert.equal(m.release_date, '2026-10-17');
  assert.equal(d.reference.low, 4);
  assert.equal(d.reference.high, 22);
  assert.match(d.reference.basis, /triple-pass/i);
  assert.match(d.reference.basis, /40\/2,078/);
  assert.ok(d.speed.pages_per_second > 10 && d.speed.pages_per_second < 11);
  const r = build(data, data.config.snapshot_date, { min: 0 }).rows.find((r) => r.id === m.id);
  assert.equal(r.rank, null);
  assert.equal(r.scores['parsebench-nemotron35-triple'].value, 75.20375371099965);
  assert.equal(r.scores.olmocr, null);
  assert.equal(
    build(data, '2026-10-01', { min: 0 }).rows.some((r) => r.id === m.id),
    false
  );
});

test('hypothetical hosted H100 equivalents preserve service prices and quality ranks', () => {
  const data = loadOCR();
  const before = build(data, undefined, { min: 0 });
  for (const id of ['nanonets-ocr-3', 'nanonets-ocr2-plus']) {
    const model = data.models.find((m) => m.id === id);
    const result = OCR.deployment(data, model);
    assert.equal(result.reference.hypothetical, true);
    assert.equal(result.reference.confidence, 'low');
    assert.ok(result.referenceCost.low > 0);
    assert.notEqual(result.cost.kind, 'H100 scenario');
    const without = OCR.deployment({ ...data, ocrReference: null }, model);
    assert.deepEqual(result.cost, without.cost);
    const row = before.rows.find((r) => r.id === id);
    const html = OCR.renderRows({ ...before, rows: [row] }, data);
    assert.match(html, /Hypothetical H100 equivalent/);
    assert.match(html, /separate from the hosted price/);
  }
  const without = build({ ...data, ocrReference: null }, undefined, { min: 0 });
  assert.deepEqual(before.rows, without.rows);
});
