const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadOCR } = require('../lib/load.cjs');
const { validateData } = require('../lib/validate.cjs');
const Rank = require('../src/assets/js/ranking.js');
const Comparison = require('../src/assets/js/ocr-comparison.js');
const Chart = require('../src/assets/js/ocr-cost-chart.js');

const data = loadOCR();

test('real chart points use the table cost selector and current filtered cohort', () => {
  const result = Rank.build(data, data.config.snapshot_date, { query: 'lighton', min: 0 });
  const enriched = Comparison.enrich(result, data, { hourlyRate: 2 });
  const points = Chart.points(enriched, data).points;
  assert.ok(points.length > 0);
  for (const point of points) {
    const row = enriched.rows.find((r) => r.id === point.id);
    assert.ok(row);
    assert.equal(point.rating, row.rank);
    assert.equal(point.cost, row.deployment.cost.value);
  }
  const cheaper = Chart.points(Comparison.enrich(result, data, { hourlyRate: 1 }), data).points;
  for (const point of points.filter((p) => p.costKind === 'H100 scenario')) {
    const expected = cheaper.find((p) => p.id === point.id).cost * 2;
    assert.ok(Math.abs(point.cost - expected) <= 1e-12 * Math.max(1, expected));
  }
});

test('browser and static chart renderers are identical for the same enriched result', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync('src/assets/js/ocr-cost-chart.js', 'utf8'), context);
  const result = Comparison.enrich(Rank.build(data), data);
  assert.equal(context.OCRCostChart.render(result, data), Chart.render(result, data));
});

test('OCRia supplement retains separate Table 21 B200 measurements and hosted p90', () => {
  const expected = [
    ['ocria-b200-table21-c1-20261101', 1, 2.17, 4734],
    ['ocria-b200-table21-c8-20261101', 8, 7.83, 1932]
  ];
  for (const [id, concurrency, pps, tokens] of expected) {
    const r = data.throughput.find((r) => r.id === id);
    assert.ok(r);
    assert.equal(r.model, 'ocria-1');
    assert.equal(r.concurrency, concurrency);
    assert.equal(r.pages_per_second, pps);
    assert.equal(r.output_tokens_per_second_per_request, tokens);
    assert.equal(r.comparison_cohort, 'ocria-report-table21-b200');
    assert.equal(r.evidence, 'author_reported');
    assert.equal(r.comparison_default, false);
    assert.equal(r.cost_eligible, false);
    assert.match(r.hardware, /B200/);
    assert.ok(data.sources[r.source_id]);
  }
  const latency = data.throughput.find((r) => r.id === 'ocria-router-p90-20261101');
  assert.equal(latency.model, 'ocria-1-opendocrouter-20261022');
  assert.equal(latency.unit, 'p90_seconds_per_page');
  assert.equal(latency.p90_seconds_per_page, 9.3);
  assert.equal(latency.median_seconds_per_page, 2.2);
  assert.equal(latency.pages_per_second, undefined);
  assert.equal(latency.cost_eligible, false);
  assert.equal(
    data.throughput.find((r) => r.id === 'ocria-b200-c8-report-202610').pages_per_second,
    7.42
  );
});

test('deployment enrichment does not add quality votes or fabricate an OCRia cost', () => {
  const without = {
    ...data,
    throughput: data.throughput.filter((r) => !r.id.endsWith('-20261101'))
  };
  const ranks = (d) => Rank.build(d).rows.map((r) => [r.id, r.rank]);
  assert.deepEqual(ranks(data), ranks(without));
  const result = Comparison.enrich(Rank.build(data), data);
  const ocria = result.rows.find((r) => r.id === 'ocria-1');
  assert.ok(ocria);
  assert.equal(ocria.deployment.cost.value, null);
  assert.ok(!Chart.points(result, data).points.some((p) => p.id === 'ocria-1'));
});

test('p90 latency validates its unit and cannot become default throughput or compute evidence', () => {
  const latency = data.throughput.find((r) => r.id === 'ocria-router-p90-20261101');
  const validate = (patch) =>
    validateData({
      ...data,
      throughput: data.throughput.map((r) => (r.id === latency.id ? { ...r, ...patch } : r))
    });
  assert.doesNotThrow(() => validate({}));
  assert.throws(() => validate({ p90_seconds_per_page: NaN }), /invalid p90/);
  assert.throws(() => validate({ p90_seconds_per_page: 1 }), /at least the median/);
  assert.throws(() => validate({ pages_per_second: 1 / 9.3 }), /latency is not throughput/);
  assert.throws(() => validate({ comparison_default: true }), /non-throughput default/);
  assert.throws(() => validate({ cost_eligible: true }), /cost requires aggregate throughput/);
});
