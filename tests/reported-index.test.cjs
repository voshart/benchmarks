const { test } = require('node:test');
const assert = require('node:assert/strict');
const Rank = require('../lib/ranking.cjs'),
  { loadOCR } = require('../lib/load.cjs');
function fixture(direction = 'higher') {
  const models = ['a', 'b', 'c'].map((id) => ({
    id,
    name: id,
    organization: id,
    release_date: '2026-01-01',
    access: 'open'
  }));
  const tests = [
    { id: 'panel', label: 'Panel', family: 'one', aggregate_eligible: true, direction }
  ];
  const resultsByKey = Object.fromEntries(
    models.map((m, i) => [
      m.id + '|panel',
      [
        {
          model: m.id,
          benchmark: 'panel',
          value: 90 - i * 10,
          source_id: 'author',
          evidence: 'author_reported'
        }
      ]
    ])
  );
  return {
    config: {
      reported_index: true,
      snapshot_date: '2026-10-23',
      default_families: 0,
      min_core_for_rank: 3,
      min_core_for_provisional: 1
    },
    models,
    tests,
    primaryTests: tests,
    coverageTests: tests,
    resultsByKey,
    sources: { author: { kind: 'author_reported' } },
    pricingByModel: {}
  };
}
const indexes = (d) => Object.fromEntries(Rank.build(d).rows.map((r) => [r.id, r.rank]));
test('finite-cohort formula respects direction, ties and monotonicity without singleton perfect scores', () => {
  const d = fixture();
  assert.deepEqual(indexes(d), { a: (100 * 2.5) / 3, b: 50, c: (100 * 0.5) / 3 });
  d.tests[0].direction = 'lower';
  assert.deepEqual(indexes(d), { c: (100 * 2.5) / 3, b: 50, a: (100 * 0.5) / 3 });
  d.resultsByKey['b|panel'][0].value = 90;
  assert.equal(indexes(d).a, indexes(d).b);
  d.tests[0].direction = 'higher';
  const before = indexes(d).c;
  d.resultsByKey['c|panel'][0].value = 95;
  assert.ok(indexes(d).c > before);
  d.models = d.models.slice(0, 1);
  assert.equal(indexes(d).a, null);
});
test('one-family self report ranks provisionally, source label changes do not alter numeric quality', () => {
  const d = fixture(),
    before = indexes(d);
  assert.ok(Rank.build(d).rows.every((r) => r.rankStatus === 'provisional'));
  for (const records of Object.values(d.resultsByKey)) records[0].evidence = 'vendor_comparison';
  assert.deepEqual(indexes(d), before);
  for (const records of Object.values(d.resultsByKey)) records[0].evidence = 'third_party';
  assert.deepEqual(indexes(d), before);
});
test('canonical priority and one-family vote cannot be inflated by adding a better variant or duplicating a panel', () => {
  const d = fixture();
  d.tests[0].core = true;
  const before = indexes(d);
  const extra = {
    id: 'extra',
    label: 'Extra',
    family: 'one',
    aggregate_eligible: true,
    aggregate_priority: 100,
    direction: 'higher'
  };
  d.tests.push(extra);
  for (const [i, m] of d.models.entries())
    d.resultsByKey[m.id + '|extra'] = [
      {
        model: m.id,
        benchmark: 'extra',
        value: i * 50,
        source_id: 'author',
        evidence: 'author_reported'
      }
    ];
  assert.deepEqual(indexes(d), before);
  assert.ok(
    Rank.build(d).rows.every(
      (r) => r.coreCount === 1 && r.rankContributions[0].benchmark === 'panel'
    )
  );
  delete d.resultsByKey['c|panel'];
  assert.equal(
    Rank.build(d).rows.find((r) => r.id === 'c').rankContributions[0].benchmark,
    'extra'
  );
});
test('single checkpoint modes, assumed scores and component-only panels cannot manufacture an index', () => {
  const d = fixture();
  d.models.forEach((m) => (m.ranking_identity = 'one-checkpoint'));
  assert.ok(Object.values(indexes(d)).every((x) => x === null));
  d.models.forEach((m) => delete m.ranking_identity);
  for (const records of Object.values(d.resultsByKey)) records[0].evidence = 'assumed';
  assert.ok(Object.values(indexes(d)).every((x) => x === null));
  for (const records of Object.values(d.resultsByKey)) records[0].evidence = 'author_reported';
  delete d.tests[0].aggregate_eligible;
  assert.ok(Object.values(indexes(d)).every((x) => x === null));
});
test('search/access and parameters/speed/cost metadata never alter the index', () => {
  const d = fixture(),
    before = indexes(d);
  const row = Rank.build(d, undefined, { query: 'a', access: 'open' }).rows[0];
  assert.equal(row.rank, before.a);
  d.models.forEach((m, i) => {
    m.parameters_million = 10 ** i;
    m.download_size_mb = 99999 - i;
  });
  d.pricingByModel.a = { usd_per_1000_pages: 1e8 };
  d.throughput = [{ model: 'a', pages_per_second: 1e8 }];
  assert.deepEqual(indexes(d), before);
});
test('all current models use unique family contributions; Chandra and Gemini receive actual qualified indices', () => {
  const d = loadOCR(),
    r = Rank.build(d, undefined, { min: 0 });
  for (const row of r.rows) {
    assert.equal(
      new Set(row.rankContributions.map((c) => c.family)).size,
      row.rankContributions.length
    );
    for (const c of row.rankContributions) {
      assert.ok(c.cohortSize >= 2);
      assert.ok(c.percentile > 0 && c.percentile < 100);
    }
  }
  const c = r.rows.find((x) => x.id === 'chandra-2-5-api'),
    g = r.rows.find((x) => x.id === 'gemini-3-8-flash');
  assert.equal(c.rankStatus, 'provisional');
  assert.deepEqual(
    c.rankContributions.map((x) => x.benchmark),
    ['chandra-2-5-olm-no-hf']
  );
  assert.equal(g.rankStatus, 'provisional');
  assert.deepEqual(
    g.rankContributions.map((x) => x.benchmark),
    ['omniparse-datalab-overall-20261023', 'parsebench-published-9af4102']
  );
  assert.ok(
    !r.rows.some((x) =>
      x.rankContributions.some((c) => c.benchmark === 'omniparse-chandra-2-5-release')
    )
  );
  for (const row of r.rows.filter((x) =>
    x.rankContributions.some((c) => c.benchmark === 'openocr-hard')
  ))
    assert.match(row.rankExplanation, /20 pages/);
});
