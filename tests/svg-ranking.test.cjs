const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadSVG, validateSVG } = require('../lib/load-svg.cjs');
const comparison = require('../src/assets/js/svg-comparison.js');

function fixture() {
  const data = loadSVG();
  data.overview = {
    ...data.overview,
    columns: ['mean_dino', 'stack', 'fonts'],
    components: [
      { run_id: 'fixture-a', metric: 'dino', column: 'stack' },
      { run_id: 'fixture-b', metric: 'dino', column: 'fonts' }
    ]
  };
  const models = ['monotrace', 'potrace', 'vtracer', 'live-paper'];
  data.runs = [
    [0.9, 0.8, 0.7, 0.99],
    [0.7, 0.8, 0.5, null]
  ].map((values, i) => ({
    id: 'fixture-' + (i ? 'b' : 'a'),
    dataset: 'Dataset ' + i,
    source_id: 'starvector',
    primary: 'dino',
    columns: ['dino', 'segments'],
    rows: models.map((model, n) => ({
      model,
      attribution: 'competitor-reported',
      values: { dino: values[n], segments: [100, 1, 20, 30][n] }
    }))
  }));
  return data;
}

test('fixed SVG panel requires all components, retains ties and does not average partial results', () => {
  const data = fixture(),
    result = comparison.select(data, data.overview.id);
  const row = (model) => result.rows.find((row) => row.model === model);
  assert.equal(row('monotrace').values.mean_dino, 0.8);
  assert.equal(row('potrace').values.mean_dino, 0.8);
  assert.equal(row('monotrace').rank, 1);
  assert.equal(row('potrace').rank, 1);
  assert.equal(row('vtracer').rank, 3);
  assert.equal(row('live-paper').values.mean_dino, null);
  assert.equal(row('live-paper').rank, null);
  assert.equal(result.unrankedRows.length, 1);
  const filtered = comparison.select(data, data.overview.id, 'VTracer');
  assert.equal(filtered.rows[0].rank, 3);
  assert.equal(filtered.cohortCount, 3);
  assert(!comparison.renderRows(result, data).includes('data-model="live-paper"'));
  assert(comparison.renderRows(result, data, true).includes('missing Fonts'));
});

test('complexity sorting changes order without changing full-cohort quality ranks', () => {
  const data = fixture();
  const result = comparison.select(data, 'fixture-a', '', 'segments', 'asc');
  assert.equal(result.rows[0].model, 'potrace');
  assert.equal(result.rows[0].rank, 3);
  assert.equal(result.rows.find((row) => row.model === 'monotrace').rank, 2);
  const searched = comparison.select(data, 'fixture-a', 'Potrace', 'segments', 'asc');
  assert.equal(searched.rows[0].rank, 3);
  assert.equal(searched.cohortCount, 4);
  data.runs[0].rows[0].values.segments = 1000000;
  assert.equal(
    comparison.select(data, 'fixture-a').rows.find((row) => row.model === 'monotrace').rank,
    2
  );
});

test('all StarVector source cells are preserved and overview means are derived, not observations', () => {
  const data = loadSVG();
  const csv = fs
    .readFileSync(path.join(__dirname, '../data/svg/evidence/starvector-models-2025.csv'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(','));
  const headers = csv.shift();
  for (const cells of csv) {
    const model = Object.entries(data.models).find(
      ([id, model]) =>
        model.name === cells[0] &&
        data.runs
          .find((run) => run.id === 'svg-fonts-published-2025')
          .rows.some((row) => row.model === id)
    )[0];
    for (const component of data.overview.components) {
      const run = data.runs.find((run) => run.id === component.run_id);
      const original = cells[headers.indexOf(component.column)];
      assert.equal(
        run.rows.find((row) => row.model === model).values.dino,
        original === '-' ? null : Number(original)
      );
    }
    const row = comparison.select(data, data.overview.id).rows.find((row) => row.model === model);
    const values = cells.slice(1);
    assert.equal(
      row.values.mean_dino,
      values.includes('-')
        ? null
        : values.reduce((sum, value) => sum + Number(value), 0) / values.length
    );
  }
  assert(
    data.runs.every((run) => run.rows.every((row) => !Object.hasOwn(row.values, 'mean_dino')))
  );
  assert.equal(comparison.select(data, data.overview.id, 'Monotrace').rows.length, 0);
  assert(data.overview.method.includes('dataset-specific'));
  assert(
    data.runs
      .filter((run) => run.source_id === 'starvector')
      .every((run) => !run.columns.includes('tokens_k'))
  );
});

test('difference disclosure derives both scores and preserves full-run versus pilot scope', () => {
  const data = loadSVG();
  const html = comparison.renderDifferences(data);
  for (const value of [
    '0.98842',
    '0.967',
    '0.98643',
    '0.964',
    '4,821 local images',
    '256-image local pilot'
  ])
    assert(html.includes(value), value);
  assert(html.includes('pipelines are not matched'));
  data.runs
    .find((run) => run.id === 'fonts-full-20261104')
    .rows.find((row) => row.model === 'potrace').values.dino = 0.7;
  assert(comparison.renderDifferences(data).includes('0.70000'));
});

test('SVG validation prevents duplicate dataset votes, mixed sources and complexity ranks', () => {
  for (const mutate of [
    (data) => {
      data.overview.components[1].run_id = data.overview.components[0].run_id;
    },
    (data) => {
      data.overview.components[0].run_id = 'fonts-full-20261104';
    },
    (data) => {
      data.runs[0].primary = 'segments';
    },
    (data) => {
      data.differences[0].local.model = 'missing';
    }
  ]) {
    const data = structuredClone(loadSVG());
    mutate(data);
    assert.throws(() => validateSVG(data));
  }
});

test('default SVG overview exposes local and published results with independent table sorting', async () => {
  const data = loadSVG();
  const node = () => ({
    value: '',
    hidden: false,
    textContent: '',
    innerHTML: '',
    events: {},
    addEventListener(name, callback) {
      this.events[name] = callback;
    }
  });
  const ids = Object.fromEntries(
    ['themeToggle', 'svgRun', 'svgSearch', 'svgReset', 'svgStatus'].map((id) => [id, node()])
  );
  const panels = data.panels.map(({ run }) => {
    const parts = Object.fromEntries(
      ['.svg-ranked-body', '.svg-unranked-body', '.svg-unranked', '.svg-unranked summary'].map(
        (key) => [key, node()]
      )
    );
    return {
      dataset: { svgRun: run.id },
      hidden: false,
      parts,
      querySelector: (key) => parts[key],
      querySelectorAll: () => [node(), node()]
    };
  });
  const events = {},
    body = { dataset: {} };
  const context = {
    SVGComparison: comparison,
    document: {
      body,
      documentElement: { dataset: {} },
      getElementById: (id) => ids[id],
      querySelectorAll: () => panels,
      addEventListener: (name, callback) => {
        events[name] = callback;
      }
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(data) }),
    location: { hash: '' },
    history: { replaceState() {} },
    window: { addEventListener() {} }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src/assets/js/svg-page.js'), 'utf8'),
    context
  );
  await new Promise(setImmediate);
  assert.equal(ids.svgRun.value, data.landing.id);
  assert.deepEqual(
    panels.filter((panel) => !panel.hidden).map((panel) => panel.dataset.svgRun),
    data.landing.panels
  );
  assert.equal(body.dataset.enhanced, 'true');
  const local = panels.find((panel) => panel.dataset.svgRun === 'fonts-full-20261104');
  const published = panels.find((panel) => panel.dataset.svgRun === data.overview.id);
  assert(local.parts['.svg-ranked-body'].innerHTML.includes('data-model="monotrace"'));
  const publishedRows = published.parts['.svg-ranked-body'].innerHTML;
  events.click({
    target: {
      closest: (selector) =>
        selector === '[data-svg-sort]'
          ? { dataset: { svgSort: 'segments', svgSortPanel: local.dataset.svgRun } }
          : null
    }
  });
  assert(
    local.parts['.svg-ranked-body'].innerHTML.indexOf('data-model="potrace"') <
      local.parts['.svg-ranked-body'].innerHTML.indexOf('data-model="monotrace"')
  );
  assert(local.parts['.svg-ranked-body'].innerHTML.includes('Rank 2 of 2'));
  assert.equal(local.parts['.svg-unranked'].hidden, true);
  assert.equal(published.parts['.svg-ranked-body'].innerHTML, publishedRows);
  events.click({
    target: {
      closest: (selector) =>
        selector === '[data-svg-sort]'
          ? { dataset: { svgSort: 'rank', svgSortPanel: local.dataset.svgRun } }
          : null
    }
  });
  assert(
    local.parts['.svg-ranked-body'].innerHTML.indexOf('data-model="monotrace"') <
      local.parts['.svg-ranked-body'].innerHTML.indexOf('data-model="potrace"')
  );
  ids.svgSearch.value = 'Monotrace';
  ids.svgSearch.events.input();
  assert.equal(local.hidden, false);
  assert.equal(published.hidden, true);
  assert(local.parts['.svg-ranked-body'].innerHTML.includes('Rank 1 of 2'));
  ids.svgReset.events.click();
  assert.equal(panels.filter((panel) => !panel.hidden).length, data.landing.panels.length);
  let closed = false;
  const link = {
    dataset: { svgLink: data.overview.id },
    closest: () => ({
      hidePopover() {
        closed = true;
      }
    })
  };
  events.click({
    preventDefault() {},
    target: { closest: (selector) => (selector === '[data-svg-link]' ? link : null) }
  });
  assert.equal(closed, true);
  assert.equal(panels.find((panel) => !panel.hidden).dataset.svgRun, data.overview.id);
});

test('SVG landing groups are validated without changing observation values or rank eligibility', () => {
  const data = loadSVG();
  const selected = comparison.selectPanels(data, data.default_run);
  assert.deepEqual(
    selected.map((result) => result.run.id),
    data.landing.panels
  );
  assert.equal(selected[0].run.id, 'fonts-full-20261104');
  assert(selected[0].rankedRows.some((row) => row.model === 'monotrace'));
  assert(!selected[1].rows.some((row) => row.model === 'monotrace'));
  assert.deepEqual(selected[1].rows, comparison.select(data, data.overview.id).rows);
  for (const ids of [
    ['missing', data.overview.id],
    [data.overview.id, data.overview.id]
  ]) {
    const invalid = structuredClone(data);
    invalid.landing.panels = ids;
    assert.throws(() => validateSVG(invalid));
  }
});
