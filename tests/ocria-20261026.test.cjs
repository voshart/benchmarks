const test = require('node:test');
const assert = require('node:assert/strict');
const { loadOCR } = require('../lib/load.cjs');
const Rank = require('../src/assets/js/ranking.js');
const Deployment = require('../src/assets/js/ocr-deployment.js');
const Dimensions = require('../src/assets/js/ocr-dimensions.js');
const policy = require('../data/ocr/dimensions.json');
const ledger = require('../data/ocr/research-ocria-20261026.json');
const data = loadOCR();
const record = (benchmark, model, source) => data.rawRecords.find((r) => r.benchmark === benchmark && r.model === model && (!source || r.source_id === source));

test('October source tables retain every reported row, native precision and genuine zeros', () => {
  for (const panel of ledger.protocols) {
    const rows = data.rawRecords.filter((r) => r.benchmark === panel.id && r.source_id === panel.source);
    assert.equal(rows.length, panel.values.length, panel.id);
    panel.values.forEach((values, i) => {
      const row = record(panel.id, panel.models[i], panel.source);
      assert.ok(row, panel.id + '/' + panel.models[i]);
      panel.keys.forEach((key, j) => {
        if (values[j] === null) assert.equal(row.metrics[key], undefined);
        else assert.equal(row.metrics[key], values[j]);
      });
    });
  }
  const dots = record('parsebench-ocria-four-202610', 'dots-mocr', 'ocria-report-202610');
  assert.equal(dots.metrics.charts, 0);
  assert.equal(record('parsebench-ocria-four-202610', 'dots-mocr', 'ocria-announcement-20261022').metrics.charts, 0.1);
});

test('four/five-category means, renderings and hosted recipes cannot become the same panel', () => {
  const four = data.tests.find((t) => t.id === 'parsebench-ocria-four-202610');
  const five = data.tests.find((t) => t.id === 'parsebench-published-9af4102');
  assert.notEqual(four.id, five.id);
  assert.equal(four.family, five.family);
  assert.equal(four.metric_labels.layout, undefined);
  assert.equal(record('olmocr-ocria-published-202610', 'ocria-1').metrics.overall, 84.6);
  assert.equal(record('olmocr-ocria-1288-202610', 'ocria-1').metrics.overall, 83.5);
  assert.equal(record('olmocr-ocria-1288-202610', 'lightonocr-3-4b').metrics.overall, 82.1);
  assert.equal(record('parsebench-ocria-router-20261026', 'ocria-1-opendocrouter-20261022').metrics.overall, 84.67);
  assert.equal(record('parsebench-ocria-router-20261026', 'ocria-1'), undefined);
  assert.equal(data.sources['opendocrouter-ocria-20261026'].kind, 'vendor');
  assert.ok(data.models.find((m) => m.id === 'ocria-1').access === 'closed');
});

test('reprinted baselines and ambiguous Indra configuration cannot enter matched comparisons', () => {
  const rows = data.rawRecords.filter((r) => r.benchmark === 'olmocr-ocria-1288-202610' && r.evidence === 'secondary');
  assert.equal(rows.length, 2);
  for (const row of rows) assert.equal(row.comparable, false);
  const indra = record('omniparse-open-20261023', 'indra-ocr-omniparse-20261023');
  assert.equal(indra.evidence, 'secondary');
  assert.equal(indra.comparable, false);
});

test('genuine OmniParse table-cell components survive absent headline/layout, unlike mixed tags', () => {
  const panel = policy.views.tables.panels.find((p) => p.id === 'opb-cell');
  assert.equal(panel.benchmark, 'omniparse-open-20261023');
  assert.deepEqual(panel.keys, ['tables']);
  assert.equal(panel.rating, true);
  const models = ledger.protocols.find((p) => p.id === panel.benchmark).models;
  for (const model of models.slice(-2)) {
    const row = record(panel.benchmark, model);
    assert.equal(row.metrics.overall, undefined);
    assert.equal(row.metrics.layout, undefined);
    assert.ok(row.metrics.tables > 0);
    const projected = Dimensions.project(data, policy, 'tables');
    assert.ok(projected.resultsByKey[model + '|opb-cell'].length > 0);
  }
  assert.ok(!policy.views.tables.panels.some((p) => p.rating && p.benchmark === 'omniparse-datalab-tables-20261023'));
});

test('cropped-table averages retain coverage and do not create rating votes', () => {
  const pulse = record('pulsebench-tab-ocria-202610', 'ocria-1');
  assert.equal(pulse.metrics.coverage, 99.1);
  assert.equal(pulse.perfect_tables, 485);
  assert.equal(pulse.table_count, 1820);
  for (const p of policy.views.tables.panels.filter((p) => p.benchmark === pulse.benchmark)) assert.equal(p.rating, false);
  assert.equal(policy.views['charts-formatting'].mode, 'diagnostic');
});

test('OCRia headline speed is the hypothetical H100 range, never the B200 maximum or API latency', () => {
  const model = data.models.find((m) => m.id === 'ocria-1');
  const d = Deployment.deployment(data, model);
  assert.equal(d.referenceMode, true);
  assert.equal(d.reference.profile, 'h100-80gb-v1');
  assert.equal(d.reference.status, 'estimated');
  assert.equal(d.reference.evidence, 'assumed');
  assert.equal(d.reference.confidence, 'low');
  assert.equal(d.reference.hypothetical, true);
  assert.deepEqual([d.reference.low, d.reference.high], [0.3, 6]);
  assert.equal(d.speed, null);
  const assumptions = d.reference.transfer_assumptions;
  const anchor = assumptions.source_pages_per_second * assumptions.target_bandwidth_tb_s / assumptions.source_bandwidth_tb_s;
  assert.equal(assumptions.source_concurrency, 16);
  assert.equal(assumptions.target_max_concurrency, 16);
  assert.ok(anchor * assumptions.subjective_runtime_workload_factors[0] < d.reference.low);
  assert.ok(Math.abs(anchor * assumptions.subjective_runtime_workload_factors[1] - d.reference.high) < 0.05);
  assert.match(d.reference.basis, /not a universal GPU conversion/);
  for (const row of d.records) {
    assert.match(row.hardware, /B200/);
    assert.equal(row.comparison_default, false);
    assert.equal(row.cost_eligible, false);
  }
  assert.equal(d.records.find((r) => r.id === 'ocria-b200-c64-report-202610').pages_per_second, 10.21);
  assert.notEqual(d.cost.kind, 'H100 scenario');
  assert.equal(d.referenceCost.kind, 'H100 scenario');
  const hosted = Deployment.deployment(data, data.models.find((m) => m.id === 'ocria-1-opendocrouter-20261022'));
  assert.equal(hosted.cost.kind, 'benchmark est.');
  assert.equal(hosted.cost.value, 13.04);
  assert.equal(hosted.speed, null);
  assert.equal(hosted.records[0].unit, 'median_seconds_per_page');
});

test('native B200 concurrency ladder retains all source observations without unit conversion', () => {
  for (const [concurrency, pps, tokens, aggregate] of ledger.source_speed_ladder) {
    const row = data.throughput.find((r) => r.id === 'ocria-b200-c' + concurrency + '-report-202610');
    assert.equal(row.pages_per_second, pps);
    assert.equal(row.output_tokens_per_second_per_request, tokens);
    assert.equal(row.aggregate_output_tokens_per_second, aggregate === null ? undefined : aggregate);
    assert.equal(row.evidence, 'author_reported');
  }
});

test('changing assumed H100 speed cannot change overall or component quality ratings', () => {
  const changed = structuredClone(data);
  const ref = changed.ocrReference.models.find((r) => r.model === 'ocria-1');
  ref.low = 0.001;
  ref.high = 1000;
  const ranks = (result) => result.rows.map((r) => [r.id, r.rank]);
  assert.deepEqual(ranks(Rank.build(data)), ranks(Rank.build(changed)));
  assert.deepEqual(ranks(Dimensions.build(data, policy, 'tables')), ranks(Dimensions.build(changed, policy, 'tables')));
});
