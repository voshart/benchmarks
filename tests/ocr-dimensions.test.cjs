const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Dimensions = require('../src/assets/js/ocr-dimensions.js');
const View = require('../src/assets/js/ocr-dimensions-view.js');

function fixture() {
  const sources = {
    official: { kind: 'official', title: 'Published', url: 'https://example.org/official' },
    vendor: { kind: 'vendor', title: 'Vendor', url: 'https://example.org/vendor' },
    internal: { kind: 'vendor_internal', title: 'Internal', url: 'https://example.org/internal' }
  };
  const tests = ['one', 'two'].map((id) => ({
    id,
    label: id,
    family: id,
    source: 'official',
    primary_metric: 'overall',
    unit: 'percent',
    direction: 'higher'
  }));
  const models = ['a', 'b', 'c'].map((id) => ({
    id,
    name: id.toUpperCase(),
    release_date: '2026-01-01',
    organization: id,
    access: id === 'a' ? 'closed' : 'open'
  }));
  const rawRecords = models.flatMap((model, index) => [
    {
      benchmark: 'one',
      model: model.id,
      source_id: 'official',
      metrics: { overall: 100, table: 90 - index * 30, structure: 99, order: 0.3 - index * 0.1 }
    },
    {
      benchmark: 'two',
      model: model.id,
      source_id: 'official',
      metrics: { overall: 100, table: 0.9 - index * 0.2, kie: 80 + index }
    }
  ]);
  const panels = [
    {
      id: 'first',
      benchmark: 'one',
      short: 'First',
      label: 'Table',
      keys: ['table', 'table_teds'],
      unit: 'percent',
      direction: 'higher',
      rating: true
    },
    {
      id: 'second',
      benchmark: 'two',
      short: 'Second',
      label: 'Table',
      keys: ['table'],
      unit: 'ratio',
      direction: 'higher',
      rating: true
    },
    {
      id: 'structure',
      benchmark: 'one',
      short: 'Structure',
      label: 'Structure only',
      keys: ['structure'],
      unit: 'percent',
      direction: 'higher',
      rating: false
    }
  ];
  const policy = {
    version: 1,
    views: {
      tables: { label: 'Tables', mode: 'rating', min_families: 2, panels },
      layout: {
        label: 'Layout',
        mode: 'diagnostic',
        panels: [
          { ...panels[0], id: 'order', keys: ['order'], direction: 'lower', unit: 'ratio', rating: false }
        ]
      },
      fields: {
        label: 'Fields',
        mode: 'diagnostic',
        panels: [{ ...panels[1], id: 'kie', keys: ['kie'], unit: 'percent', rating: false }]
      }
    }
  };
  const data = {
    config: { snapshot_date: '2026-10-22', release_start: '2026-01-01', pairwise_prior: 0.25 },
    sources,
    tests,
    models,
    rawRecords
  };
  return { data, policy };
}
const build = ({ data, policy }, view = 'tables', options) =>
  Dimensions.build(data, policy, view, options);
const ratings = (result) => Object.fromEntries(result.rows.map((row) => [row.id, row.rank]));
const get = (result, id) => result.rows.find((row) => row.id === id);
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

test('table ratings use components, preserve native scales and do not mutate evidence', () => {
  const f = deepFreeze(fixture());
  const result = build(f);
  assert.ok(get(result, 'a').rank > get(result, 'b').rank);
  assert.ok(get(result, 'b').rank > get(result, 'c').rank);
  assert.equal(get(result, 'a').scores.second.value, 0.9);
  assert.equal(get(result, 'a').count, 2);
  assert.match(get(result, 'a').rankExplanation, /not overall OCR accuracy/);
});

test('component selection happens before source priority; absent headline is allowed', () => {
  const f = fixture();
  delete f.data.rawRecords[0].metrics.table;
  f.data.rawRecords.push({
    benchmark: 'one',
    model: 'a',
    source_id: 'vendor',
    metrics: { table: 42 }
  });
  const result = build(f);
  assert.equal(get(result, 'a').scores.first.value, 42);
  assert.equal(get(result, 'a').scores.first.evidence, 'vendor');
  assert.equal(get(result, 'a').scores.first.source_id, 'vendor');
  assert.notEqual(get(result, 'a').scores.first.value, 100);
});

test('source priority selects evidence, never the best component value', () => {
  const f = fixture();
  f.data.rawRecords.push({
    benchmark: 'one',
    model: 'a',
    source_id: 'vendor',
    metrics: { table: 100 }
  });
  assert.equal(get(build(f), 'a').scores.first.value, 90);
  assert.match(View.renderRows(build(f)), /Alternative: 100/);
});

test('missing components stay missing and genuine zero survives both sort directions', () => {
  const f = fixture();
  f.data.rawRecords[0].metrics.table = 0;
  delete f.data.rawRecords.find((row) => row.model === 'c' && row.benchmark === 'one').metrics.table;
  const asc = build(f, 'tables', { sortKey: 'first', sortDirection: 'asc' });
  const desc = build(f, 'tables', { sortKey: 'first', sortDirection: 'desc' });
  assert.equal(asc.rows[0].id, 'a');
  assert.equal(get(asc, 'a').scores.first.value, 0);
  assert.equal(asc.rows.at(-1).id, 'c');
  assert.equal(desc.rows.at(-1).id, 'c');
  assert.equal(get(asc, 'c').scores.first, null);
  assert.equal(get(asc, 'c').rank, null);
});

test('assumed/internal/context-only records cannot create table-rating comparisons', () => {
  const f = fixture();
  for (const row of f.data.rawRecords.filter((row) => row.model === 'a')) row.status = 'assumed';
  for (const row of f.data.rawRecords.filter((row) => row.model === 'b'))
    row.source_id = 'internal';
  const result = build(f);
  assert.equal(get(result, 'a'), undefined);
  assert.equal(get(result, 'b').rank, null);
  assert.equal(get(result, 'b').count, 0);
  assert.equal(get(result, 'c').rank, null);
  assert.equal(get(result, 'c').count, 0);
});

test('context-only preferred display does not suppress a comparable alternative', () => {
  const f = fixture();
  f.data.rawRecords[0].comparable = false;
  f.data.rawRecords.push({
    benchmark: 'one',
    model: 'a',
    source_id: 'vendor',
    metrics: { table: 80 }
  });
  const row = get(build(f), 'a');
  assert.equal(row.scores.first.value, 90);
  assert.equal(row.scores.first.comparable, false);
  assert.equal(row.rankContributions.find((item) => item.benchmark === 'first').observation.value, 80);
  assert.equal(row.count, 2);
  assert.notEqual(row.rank, null);
});

test('aliases are explicit, with conflicting aliases excluded rather than cherry-picked', () => {
  const f = fixture();
  f.data.rawRecords[0].metrics.table_teds = 91;
  const row = get(build(f), 'a');
  assert.equal(row.scores.first.value, 90);
  assert.equal(row.scores.first.comparable, false);
  assert.equal(row.rank, null);
  assert.match(row.scores.first.provisional_reasons.join(' '), /Conflicting metric aliases/);
});

test('component-specific provenance does not inherit a headline source classification', () => {
  const f = fixture();
  f.data.rawRecords[0].component_source_id = 'vendor';
  assert.equal(get(build(f), 'a').scores.first.evidence, 'vendor');
  assert.equal(get(build(f), 'a').scores.first.source_id, 'vendor');
  delete f.data.rawRecords[0].component_source_id;
  f.data.rawRecords[0].component_source_url = 'https://example.org/unclassified-components';
  assert.equal(get(build(f), 'a').scores.first.evidence, 'research');
});

test('UI filters cannot change a retained model rating or reference cohort', () => {
  const f = fixture();
  const baseline = build(f);
  const filtered = build(f, 'tables', { query: 'A', access: 'closed', min: 2 });
  assert.equal(filtered.rows.length, 1);
  assert.equal(filtered.rows[0].rank, get(baseline, 'a').rank);
  assert.equal(filtered.ratedCount, baseline.ratedCount);
});

test('diagnostic metrics and repeated panels cannot multiply a family vote', () => {
  const f = fixture();
  const baseline = ratings(build(f));
  for (const row of f.data.rawRecords) row.metrics.structure = row.model === 'c' ? 100 : 0;
  f.policy.views.tables.panels.push({ ...f.policy.views.tables.panels[0], id: 'repeated' });
  assert.deepEqual(ratings(build(f)), baseline);
});

test('identity copies share budgets rather than creating more benchmark evidence', () => {
  const f = fixture();
  f.data.models[0].ranking_identity = 'identity-a';
  const baseline = build(f);
  f.data.models.push({ ...f.data.models[0], id: 'a-copy', name: 'A copy' });
  f.data.rawRecords.push(
    ...f.data.rawRecords.filter((row) => row.model === 'a').map((row) => ({ ...row, model: 'a-copy' }))
  );
  const copied = build(f);
  for (const id of ['a', 'b', 'c'])
    assert.ok(Math.abs(get(baseline, id).rank - get(copied, id).rank) < 1e-7);
});

test('disconnected multi-family components remain visible but unranked', () => {
  const f = fixture();
  for (const id of ['d', 'e'])
    f.data.models.push({ id, name: id, release_date: '2026-01-01', access: 'open' });
  for (const id of ['three', 'four']) {
    f.data.tests.push({ ...f.data.tests[0], id, family: id });
    f.policy.views.tables.panels.push({ ...f.policy.views.tables.panels[0], id, benchmark: id });
    for (const [model, table] of [['d', 80], ['e', 60]])
      f.data.rawRecords.push({ benchmark: id, model, source_id: 'official', metrics: { table } });
  }
  const result = build(f);
  assert.equal(get(result, 'd').count, 2);
  assert.equal(get(result, 'd').rank, null);
  assert.match(get(result, 'd').rankExplanation, /disconnected/);
  assert.notEqual(get(result, 'a').rank, null);
});

test('latest generation is selected before scoring; historical and undated models stay distinct', () => {
  const f = fixture();
  f.data.models[0].lineage = 'line';
  f.data.models.push({ id: 'new-a', name: 'New A', lineage: 'line', release_date: '2026-09-01' });
  f.data.models.push({ id: 'unknown', name: 'Unknown', release_date: null });
  f.data.rawRecords.push({
    benchmark: 'one',
    model: 'unknown',
    source_id: 'official',
    metrics: { table: 88 }
  });
  assert.equal(get(build(f), 'a'), undefined);
  assert.ok(get(build(f), 'unknown'));
  const old = build(f, 'tables', { cutoff: '2026-08-01' });
  assert.ok(get(old, 'a'));
  assert.equal(get(old, 'new-a'), undefined);
  assert.equal(get(old, 'unknown'), undefined);
});

test('layout and fields expose native metrics, never aggregate ratings', () => {
  const f = fixture();
  const layout = build(f, 'layout', { sortKey: 'order' });
  assert.equal(layout.sortDirection, 'asc');
  assert.equal(layout.rows[0].id, 'c');
  for (const name of ['layout', 'fields']) {
    const result = build(f, name);
    assert.ok(result.rows.length > 0);
    assert.ok(result.rows.every((row) => row.rank === null));
    assert.doesNotMatch(View.renderHead(result), /Table rating/);
    assert.doesNotMatch(View.renderRows(result), /estimated rating/);
  }
});

test('unknown protocols and unsafe diagnostic eligibility fail policy validation', () => {
  const f = fixture();
  f.policy.views.tables.panels[0].benchmark = 'unknown';
  assert.throws(() => build(f), /Unknown protocol/);
  const g = fixture();
  g.policy.views.fields.panels[0].rating = true;
  assert.throws(() => build(g), /Diagnostic panel/);
});

test('markup escapes model/source text, rejects unsafe source URLs and exposes evidence', () => {
  const f = fixture();
  f.data.models[0].name = '<img src=x onerror=alert(1)>';
  f.data.sources.official.url = 'javascript:alert(1)';
  f.data.sources.official.note = '<script>bad</script>';
  const html = View.renderRows(build(f));
  assert.doesNotMatch(html, /<img|<script|href="javascript:/);
  assert.match(html, /&lt;img/);
  assert.match(html, /popovertarget/);
  assert.match(html, /Recorded metric/);
  assert.match(html, /Source details/);
});

test('CommonJS and browser globals produce identical ratings and markup', () => {
  const context = vm.createContext({});
  for (const name of ['pairwise-ranking', 'ranking', 'rank-ui', 'ocr-dimensions', 'ocr-dimensions-view'])
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, '../src/assets/js/' + name + '.js'), 'utf8'),
      context
    );
  const { data, policy } = fixture();
  for (const dimension of ['tables', 'layout', 'fields']) {
    const common = Dimensions.build(data, policy, dimension);
    const browser = context.OCRDimensions.build(data, policy, dimension);
    assert.deepEqual(JSON.parse(JSON.stringify(browser)), JSON.parse(JSON.stringify(common)));
    assert.equal(context.OCRDimensionsView.renderHead(browser), View.renderHead(common));
    assert.equal(context.OCRDimensionsView.renderRows(browser), View.renderRows(common));
  }
});

test('repository mappings have recorded components and leave overall OCR evidence/ranks unchanged', () => {
  const { loadOCR } = require('../lib/load.cjs');
  const Rank = require('../src/assets/js/ranking.js');
  const policy = require('../data/ocr/dimensions.json');
  const data = loadOCR();
  const raw = JSON.stringify(data.rawRecords);
  const before = ratings(Rank.build(data));
  for (const dimension of Object.keys(policy.views)) {
    const result = Dimensions.build(data, policy, dimension);
    assert.ok(result.rows.length > 0, dimension);
    for (const panel of policy.views[dimension].panels)
      assert.ok(
        data.rawRecords.some(
          (row) =>
            row.benchmark === panel.benchmark &&
            panel.keys.some((key) => Number.isFinite(row.metrics?.[key]))
        ),
        `No recorded component for ${dimension}/${panel.id}`
      );
  }
  assert.equal(JSON.stringify(data.rawRecords), raw);
  assert.deepEqual(ratings(Rank.build(data)), before);
  assert.ok(Dimensions.build(data, policy, 'tables').rows.some((row) => row.rank !== null));
});

module.exports = { fixture };

async function browserHarness(dimension = 'tables', fail = false) {
  const { data, policy } = fixture();
  const elements = {};
  const element = (id, value = '') =>
    (elements[id] = {
      value,
      textContent: '',
      innerHTML: 'STATIC SNAPSHOT',
      disabled: true,
      dataset: {},
      listeners: {},
      addEventListener(event, callback) {
        this.listeners[event] = callback;
      },
      querySelector(selector) {
        return { focus: () => (this.focused = selector) };
      }
    });
  element('ocrDimension').dataset = { dimension, snapshot: data.config.snapshot_date };
  element('dimensionPolicy').textContent = JSON.stringify(policy);
  element('dimensionCutoff', data.config.snapshot_date).min = data.config.release_start;
  element('dimensionSearch');
  element('dimensionCoverage', '0');
  element('dimensionAccess', 'all');
  for (const id of ['Head', 'Body', 'Status', 'Reset', 'Theme']) element('dimension' + id);
  const controls = ['Cutoff', 'Search', 'Coverage', 'Access', 'Reset'].map(
    (id) => elements['dimension' + id]
  );
  const context = vm.createContext({
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => controls,
      documentElement: { dataset: {} }
    },
    OCRDimensions: Dimensions,
    OCRDimensionsView: View,
    fetch: async (url) => {
      assert.equal(url, '/ocr/data.json');
      if (fail) throw Error('offline');
      return { ok: true, json: async () => data };
    },
    console: { warn() {} },
    localStorage: { setItem() {} },
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    clearTimeout() {}
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../src/assets/js/ocr-dimensions-page.js'), 'utf8'),
    context
  );
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, controls, data, policy };
}

test('browser filtering, sorting, cutoff and reset preserve the static/browser contract', async () => {
  const { elements: ui, controls } = await browserHarness();
  assert.ok(controls.every((element) => element.disabled === false));
  assert.match(ui.dimensionBody.innerHTML, /estimated rating/);
  ui.dimensionSearch.value = 'A';
  ui.dimensionSearch.listeners.input();
  assert.match(ui.dimensionStatus.textContent, /1 shown/);
  ui.dimensionReset.listeners.click();
  assert.equal(ui.dimensionSearch.value, '');
  assert.match(ui.dimensionStatus.textContent, /3 shown/);
  const click = () =>
    ui.dimensionHead.listeners.click({
      target: { closest: () => ({ dataset: { dimensionSort: 'first' } }) }
    });
  click();
  click();
  assert.match(ui.dimensionHead.innerHTML, /aria-sort="ascending"/);
  assert.ok(
    ui.dimensionBody.innerHTML.indexOf('<th scope="row">C') <
      ui.dimensionBody.innerHTML.indexOf('<th scope="row">A')
  );
  assert.equal(ui.dimensionHead.focused, '[data-dimension-sort="first"]');
  ui.dimensionCutoff.value = '2027-01-01';
  ui.dimensionCutoff.listeners.change();
  assert.equal(ui.dimensionCutoff.value, '2026-10-22');
});

test('failed interactive data loading retains static rows and disabled filters', async () => {
  const { elements, controls } = await browserHarness('fields', true);
  assert.equal(elements.dimensionBody.innerHTML, 'STATIC SNAPSHOT');
  assert.ok(controls.every((element) => element.disabled));
  assert.match(elements.dimensionStatus.textContent, /Static snapshot available/);
});

test('all three dimension routes render the same engine without JavaScript', () => {
  const Template = require('../src/ocr/dimensions.11ty.js');
  const template = new Template();
  template.assetUrl = (url) => url;
  for (const dimensionId of ['tables', 'layout', 'fields']) {
    assert.equal(template.data().permalink({ dimensionId }), `/ocr/${dimensionId}/index.html`);
    const html = template.render({ dimensionId });
    assert.match(html, /<tbody id="dimensionBody"><tr>/);
    assert.match(html, /<noscript>/);
    assert.match(html, /dimensionPolicy/);
    assert.match(html, /aria-current="page"/);
    assert.ok(html.indexOf('pairwise-ranking.js') < html.indexOf('ocr-dimensions-page.js'));
    if (dimensionId !== 'tables') assert.doesNotMatch(html, />Table rating /);
  }
});
