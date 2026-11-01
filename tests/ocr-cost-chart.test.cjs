const test = require('node:test');
const assert = require('node:assert/strict');
const Chart = require('../src/assets/js/ocr-cost-chart.js');

const row = (id, rating, cost, extra = {}) => ({
  id,
  name: id,
  rank: rating,
  deployment: { cost: { value: cost, kind: 'API', ...extra } }
});
const data = {
  models: [{ id: 'a', organization: 'Example' }],
  sources: { tariff: { url: 'https://example.org/prices' } }
};

test('chart uses finite ratings and positive matched costs, preserving zero rating', () => {
  const rows = [
    row('a', 70, 2),
    row('zero-rating', 0, 1),
    row('missing-rating', null, 1),
    row('nan', NaN, 1),
    row('unknown-cost', 50, null),
    row('context', 50, 2, { kind: 'context' }),
    row('current-service', 50, 2, { kind: 'current service' }),
    row('zero-cost', 50, 0),
    row('negative', 50, -1),
    row('infinite', 50, Infinity)
  ];
  const selected = Chart.points({ rows }, data);
  assert.deepEqual(
    selected.points.map((p) => p.id),
    ['a', 'zero-rating']
  );
  assert.deepEqual(selected.omitted, { unrated: 2, unpriced: 4, nonpositive: 2, basis: 0 });
});

test('frontier handles dominated points, cost ties, rating ties, and identical coordinates', () => {
  const input = [
    { id: 'low', cost: 1, rating: 40 },
    { id: 'same-cost-better', cost: 1, rating: 50 },
    { id: 'exact-tie', cost: 1, rating: 50 },
    { id: 'dearer-tie', cost: 2, rating: 50 },
    { id: 'higher', cost: 3, rating: 70 },
    { id: 'dominated', cost: 4, rating: 60 },
    { id: 'highest', cost: 8, rating: 80 }
  ];
  const copy = structuredClone(input);
  assert.deepEqual(
    Chart.frontier(input).map((p) => p.id),
    ['exact-tie', 'same-cost-better', 'higher', 'highest']
  );
  assert.deepEqual(input, copy);
  assert.deepEqual(Chart.frontier([]), []);
});

test('chart is derived from current filtered rows, not the full model registry', () => {
  const result = { rows: [row('a', 65, 2)] };
  const context = { ...data, models: [...data.models, { id: 'hidden', organization: 'Hidden' }] };
  const copy = structuredClone(result);
  assert.deepEqual(
    Chart.points(result, context).points.map((p) => p.id),
    ['a']
  );
  Chart.render(result, context);
  assert.deepEqual(result, copy);
});

test('ranges retain the table midpoint and cost basis; chart filters never alter inputs', () => {
  const result = {
    rows: [
      row('a', 70, 4, { kind: 'H100 scenario', low: 1, high: 16, estimated: true }),
      row('hosted', 80, 10)
    ]
  };
  const selected = Chart.points(result, data, { basis: 'local' });
  assert.equal(selected.points.length, 1);
  assert.equal(selected.points[0].cost, 4);
  assert.equal(selected.points[0].low, 1);
  assert.equal(selected.points[0].high, 16);
  assert.equal(selected.omitted.basis, 1);
  assert.equal(Chart.points(result, data, { basis: 'hosted' }).points[0].id, 'hosted');
});

test('invalid ranges fall back to the central value, not invented zero endpoints', () => {
  const selected = Chart.points({ rows: [row('a', 50, 2, { low: 0, high: 5 })] }, data);
  assert.equal(selected.points[0].low, 2);
  assert.equal(selected.points[0].high, 2);
});

test('single-point and wide-range logarithmic geometry stays finite', () => {
  for (const input of [
    [{ cost: 1, low: 1, high: 1 }],
    [
      { cost: 0.000001, low: 0.000001, high: 0.0001 },
      { cost: 10000, low: 10, high: 10000 }
    ]
  ]) {
    const plot = Chart.geometry(input);
    for (const p of input) assert.ok(Number.isFinite(plot.x(p.cost)));
    assert.ok(plot.ticks.every((tick) => tick > 0));
    assert.ok(plot.ticks.length <= 9);
  }
});

test('render is accessible, escapes labels and omits unsafe source URLs', () => {
  const result = { rows: [row('a', 50, 2, { source_id: 'unsafe' })] };
  result.rows[0].name = '<script>alert(1)</script>';
  const html = Chart.render(result, {
    ...data,
    sources: { unsafe: { url: 'javascript:alert(1)' } }
  });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|javascript:|NaN|Infinity/);
  assert.match(html, /tabindex="0" role="button"/);
  assert.match(html, /Chart data and cost sources/);
  assert.match(html, /not confidence intervals/);
});

test('empty state explains omissions without rendering an invalid log chart', () => {
  const html = Chart.render({ rows: [row('missing', null, null)] }, data);
  assert.match(html, /0 plotted of 1/);
  assert.match(html, /Missing values are never plotted as zero/);
  assert.doesNotMatch(html, /<svg|NaN|Infinity/);
});

test('plot toggles affect display only; vendor colors are stable across cohorts', () => {
  const result = { rows: [row('a', 60, 2, { low: 1, high: 4 })] };
  const enabled = Chart.render(result, data);
  const disabled = Chart.render(result, data, { labels: 'none', ranges: false });
  assert.match(enabled, /class="ocr-chart-range"/);
  assert.doesNotMatch(disabled, /class="ocr-chart-range"/);
  assert.equal(Chart.color('Example'), Chart.color('Example'));
});
