const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadSVG, validateSVG } = require('../lib/load-svg.cjs');
const matrix = require('../src/assets/js/svg-matrix.js');
const comparison = require('../src/assets/js/svg-comparison.js');

function fixture() {
  const data = structuredClone(loadSVG());
  data.models = Object.fromEntries(
    ['monotrace', 'potrace', 'vtracer'].map((id) => [id, data.models[id]])
  );
  const full = structuredClone(data.runs.find((r) => r.id === 'fonts-full-20261104'));
  full.rows = [
    { model: 'monotrace', values: { dino: 0.9, segments: 100 } },
    { model: 'potrace', values: { dino: 0.8, segments: 1 } }
  ];
  const pilot = {
    ...structuredClone(full),
    id: 'pilot',
    priority: 1,
    rows: [
      { model: 'monotrace', values: { dino: 0.6 } },
      { model: 'potrace', values: { dino: 0.7 } },
      { model: 'vtracer', values: { dino: 0 } }
    ]
  };
  const poly = {
    ...structuredClone(full),
    id: 'binary',
    family: 'polyfit',
    rows: [
      { model: 'monotrace', values: { dino: 0.7 } },
      { model: 'potrace', values: { dino: 0.9 } }
    ]
  };
  data.runs = [full, pilot, poly];
  return data;
}

test('one SVG matrix includes local and published configurations without merging unverified versions', () => {
  const data = loadSVG(),
    result = matrix.build(data);
  for (const id of [
    'monotrace',
    'autotrace-paper',
    'starvector-8b',
    'omnisvg4b-2025',
    'layertracer-2025'
  ])
    assert(
      result.rows.some((r) => r.id === id),
      id
    );
  const local = result.rows.find((r) => r.id === 'potrace'),
    paper = result.rows.find((r) => r.id === 'potrace-paper');
  assert(local && paper);
  assert(local.observations.every((o) => o.run.report_type === 'maintainer'));
  assert(paper.observations.every((o) => o.run.report_type === 'published'));
  assert(
    !result.columns.some((c) => c.id === data.overview.id),
    'derived five-set mean is not another vote'
  );
  assert.deepEqual(
    data.matrixResult,
    matrix.build(data),
    'SSR and browser use the same pure calculation'
  );
  const html = matrix.renderRows(result, data);
  assert(html.includes('data-model="monotrace"') && html.includes('data-model="starvector-8b"'));
});

test('SVG index reuses finite-cohort percentiles and counts the overlapping font subset once', () => {
  const data = fixture(),
    result = matrix.build(data);
  const row = (id) => result.rows.find((r) => r.id === id);
  assert.equal(row('monotrace').index, 50); // 75th percentile in fonts; 25th in binary.
  assert.equal(row('potrace').index, 50);
  assert.equal(row('monotrace').position, row('potrace').position);
  assert.equal(row('monotrace').count, 2);
  assert.equal(row('monotrace').scores.fonts.run.id, 'fonts-full-20261104');
  assert.equal(row('vtracer').index, 100 / 6); // A measured zero loses its three-way pilot cohort.
  assert.equal(row('vtracer').scores.fonts.row.values.dino, 0);
  assert.equal(row('monotrace').observations.filter((o) => o.run.family === 'fonts').length, 2);
  const html = matrix.renderRows(result, data);
  assert(html.includes('Multiple protocols are available'));
  assert(html.includes('Limited coverage'));
  const before = row('monotrace').index;
  data.runs[0].rows[0].values.dino = 0.8;
  data.runs[0].rows[1].values.dino = 0.7;
  assert.equal(
    matrix.build(data).rows.find((r) => r.id === 'monotrace').index,
    before,
    'raw scales are never averaged across protocols'
  );
});

test('colour filtering precedes index calculation; search, sorting and complexity follow it', () => {
  const data = loadSVG(),
    all = matrix.build(data),
    single = matrix.build(data, { mode: 'single' }),
    multi = matrix.build(data, { mode: 'multi' });
  assert(single.columns.every((c) => c.colour === 'single'));
  assert(multi.columns.every((c) => c.colour === 'multi'));
  assert(single.rows.some((r) => r.id === 'monotrace'));
  assert(!multi.rows.some((r) => r.id === 'monotrace'), 'unmeasured colour ability is not a score');
  const expected = single.rows.find((r) => r.id === 'monotrace');
  const searched = matrix.build(data, {
    mode: 'single',
    query: 'Monotrace',
    key: 'segments',
    complexity: true
  });
  assert.equal(searched.rows.length, 1);
  assert.equal(searched.rows[0].index, expected.index);
  assert.equal(searched.rows[0].position, expected.position);
  assert.equal(searched.cohortCount, single.cohortCount);
  assert.equal(all.rows.find((r) => r.id === 'monotrace').index, expected.index);
  const gradient = matrix.build(data, { mode: 'gradient' });
  assert.equal(gradient.rows.length, 0);
  assert(matrix.renderRows(gradient, data).includes('No gradient-specific results'));
});

test('missing SVG scores are not votes or zeros and sort last in both directions', () => {
  const data = fixture();
  data.runs[0].rows[1].values.dino = null;
  data.runs[1].rows = [];
  const result = matrix.build(data);
  assert.equal(
    result.rows.find((r) => r.id === 'monotrace').count,
    1,
    'one scored configuration cannot create a percentile'
  );
  assert.equal(result.rows.find((r) => r.id === 'potrace').scores.fonts, null);
  for (const direction of ['asc', 'desc']) {
    const sorted = matrix.build(data, { key: 'fonts', direction });
    assert.equal(sorted.rows[0].id, 'monotrace');
    assert.equal(sorted.rows.at(-1).id, 'potrace');
  }
});

test('SVG complexity retains its original units, dataset and source outside quality ranking', () => {
  const data = loadSVG(),
    result = matrix.build(data, { complexity: true });
  const html = matrix.renderRows(result, data),
    head = matrix.renderHead(result, data);
  for (const metric of ['segments', 'paths', 'tokens_k'])
    assert(head.includes('data-svg-sort="' + metric + '"'));
  assert(html.includes('not an average across datasets'));
  const mono = result.rows.find((r) => r.id === 'monotrace');
  assert.equal(mono.complexity.segments.run.id, 'fonts-full-20261104');
  assert.equal(mono.complexity.paths, null);
  assert.equal(mono.complexity.tokens_k, null);
  for (const run of data.runs)
    for (const row of run.rows)
      for (const metric of ['segments', 'paths', 'tokens_k'])
        if (row.values[metric] != null) row.values[metric] *= 1000;
  assert.deepEqual(
    matrix.build(data).rows.map((r) => [r.id, r.index]),
    result.rows.map((r) => [r.id, r.index])
  );
});

test('SVG source conflicts and all original measurements remain available in the unified table', () => {
  const data = loadSVG(),
    html = matrix.renderRows(matrix.build(data), data);
  for (const value of ['0.98842', '0.967', '0.98643', '0.964']) assert(html.includes(value), value);
  assert(comparison.renderDifferences(data).includes('pipelines are not matched'));
  data.models.monotrace.name = '<script>&"';
  const escaped = matrix.renderRows(matrix.build(data), data);
  assert(!escaped.includes('<script>'));
  assert(escaped.includes('&lt;script&gt;&amp;&quot;'));
});

test('SVG matrix metadata rejects unknown colour, family, default and priority definitions', () => {
  for (const mutate of [
    (d) => (d.matrix.columns[0].colour = 'missing'),
    (d) => (d.runs[0].family = 'missing'),
    (d) => (d.runs[0].priority = -1),
    (d) => (d.default_run = 'missing'),
    (d) => d.matrix.modes.push(d.matrix.modes[0]),
    (d) => d.matrix.columns.push(d.matrix.columns[0])
  ]) {
    const data = structuredClone(loadSVG());
    mutate(data);
    assert.throws(() => validateSVG(data));
  }
});

test('SVG controller updates one matrix for mode, search, sorting, complexity, reset and failure fallback', async () => {
  const data = loadSVG();
  const node = () => ({
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    events: {},
    addEventListener(name, fn) {
      this.events[name] = fn;
    }
  });
  const ids = Object.fromEntries(
    [
      'themeToggle',
      'svgMode',
      'svgSearch',
      'svgComplexity',
      'svgReset',
      'svgStatus',
      'svgMatrix',
      'svgHead',
      'svgRows'
    ].map((id) => [id, node()])
  );
  const body = { dataset: {} },
    events = {},
    location = { hash: '' };
  const context = {
    SVGMatrix: matrix,
    document: { body, documentElement: { dataset: {} }, getElementById: (id) => ids[id] },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }),
    location,
    history: {
      replaceState(a, b, hash) {
        location.hash = hash;
      }
    },
    window: {
      addEventListener(name, fn) {
        events[name] = fn;
      }
    }
  };
  const source = fs.readFileSync('src/assets/js/svg-page.js', 'utf8');
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  assert.equal(body.dataset.enhanced, 'true');
  assert.equal(ids.svgMode.value, 'all');
  assert.equal(ids.svgRows.innerHTML, matrix.renderRows(data.matrixResult, data));
  ids.svgMode.value = 'single';
  ids.svgMode.events.change();
  assert(ids.svgRows.innerHTML.includes('data-model="monotrace"'));
  assert(!ids.svgRows.innerHTML.includes('data-model="omnisvg4b-2025"'));
  ids.svgSearch.value = 'Monotrace';
  ids.svgSearch.events.input();
  assert.equal((ids.svgRows.innerHTML.match(/<tr data-model=/g) || []).length, 1);
  ids.svgComplexity.checked = true;
  ids.svgComplexity.events.change();
  assert(ids.svgHead.innerHTML.includes('data-svg-sort="segments"'));
  ids.svgMatrix.events.click({ target: { closest: () => ({ dataset: { svgSort: 'segments' } }) } });
  assert(ids.svgHead.innerHTML.includes('aria-sort="ascending"'));
  ids.svgMode.value = 'gradient';
  ids.svgMode.events.change();
  assert(ids.svgRows.innerHTML.includes('No gradient-specific results'));
  ids.svgReset.events.click();
  assert.equal(ids.svgMode.value, 'all');
  assert.equal(ids.svgComplexity.checked, false);
  assert.equal(ids.svgRows.innerHTML, matrix.renderRows(data.matrixResult, data));
  location.hash = '#multi';
  events.hashchange();
  assert.equal(ids.svgMode.value, 'multi');
  assert(!ids.svgRows.innerHTML.includes('data-model="monotrace"'));
  context.fetch = () => Promise.reject(new Error('Offline'));
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  assert.equal(body.dataset.enhanced, undefined);
  assert(ids.svgStatus.textContent.includes('All results shown'));
});
