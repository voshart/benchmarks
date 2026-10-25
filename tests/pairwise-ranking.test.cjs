const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Rank = require('../lib/ranking.cjs');
const Pair = require('../src/assets/js/pairwise-ranking.js');

function fixture(panels) {
  const ids = [...new Set(panels.flatMap((p) => Object.keys(p.values)))].sort();
  const tests = panels.map((p, i) => ({
    id: 'p' + i,
    family: p.family || 'f' + i,
    label: 'Panel ' + i,
    core: true,
    direction: 'higher',
    ...p,
    values: undefined
  }));
  const resultsByKey = {};
  panels.forEach((p, i) =>
    Object.entries(p.values).forEach(([id, value]) => {
      resultsByKey[id + '|p' + i] = [{ value, source_id: 'source', evidence: 'third_party' }];
    })
  );
  return {
    config: {
      rank_policy_version: 4,
      reported_index: true,
      pairwise_prior: 0.5,
      snapshot_date: '2026-10-22',
      default_families: 0,
      min_core_for_rank: 3,
      min_core_for_provisional: 1
    },
    models: ids.map((id) => ({ id, name: id, release_date: '2026-01-01', access: 'open' })),
    tests,
    primaryTests: tests,
    coverageTests: tests,
    resultsByKey,
    sources: { source: { kind: 'third_party' } },
    pricingByModel: {}
  };
}
const rows = (d, opts) => new Map(Rank.build(d, undefined, opts).rows.map((r) => [r.id, r]));
const ratings = (d) => Object.fromEntries([...rows(d)].sort().map(([id, r]) => [id, r.rank]));
const graph = (d) => Pair.graph(d, Rank.latestByLine(d.models), Rank.choose);

test('shared opponents connect incomplete panels; direction, ties and score improvement are respected', () => {
  const d = fixture([{ values: { a: 90, b: 80 } }, { values: { b: 80, c: 70 } }]);
  const r = rows(d);
  assert.ok(r.get('a').rank > r.get('b').rank && r.get('b').rank > r.get('c').rank);
  d.tests.forEach((t) => (t.direction = 'lower'));
  assert.ok(rows(d).get('c').rank > rows(d).get('a').rank);
  const tie = fixture([{ values: { a: 90, b: 90, c: 80 } }]);
  assert.ok(Math.abs(rows(tie).get('a').rank - rows(tie).get('b').rank) < 1e-7);
  const before = rows(tie).get('c').rank;
  tie.resultsByKey['c|p0'][0].value = 95;
  assert.ok(rows(tie).get('c').rank > before);
});

test('sparse perfect records are finite and strengthened only by additional independent families', () => {
  const d = fixture([{ values: { a: 90, b: 80 } }]);
  const one = rows(d).get('a');
  assert.ok(one.rank > 50 && one.rank < 80);
  const duplicate = structuredClone(d.tests[0]);
  duplicate.id = 'duplicate';
  d.tests.push(duplicate);
  for (const id of ['a', 'b']) d.resultsByKey[id + '|duplicate'] = d.resultsByKey[id + '|p0'];
  assert.equal(rows(d).get('a').rank, one.rank);
  duplicate.family = 'independent';
  assert.ok(rows(d).get('a').rank > one.rank);
  assert.equal(rows(d).get('a').coreCount, 2);
  const strongerPrior = structuredClone(d);
  strongerPrior.config.pairwise_prior = 1;
  assert.ok(rows(strongerPrior).get('a').rank < rows(d).get('a').rank);
});

test('fixed per-pair family priority uses only shared protocols and does not cherry-pick variants', () => {
  const d = fixture([
    { family: 'one', values: { a: 90, b: 80 } },
    {
      family: 'one',
      core: false,
      aggregate_eligible: true,
      aggregate_priority: 100,
      values: { a: 1, b: 2, c: 3 }
    }
  ]);
  const g = graph(d);
  assert.equal(g.edges.length, 3);
  const ab = g.edges.find((e) => g.nodes[e.a].id === 'a' && g.nodes[e.b].id === 'b');
  assert.equal(ab.test.id, 'p0');
  assert.equal(ab.outcome, 1);
  assert.ok(g.edges.filter((e) => e !== ab).every((e) => e.test.id === 'p1'));
  assert.equal(rows(d).get('a').coreCount, 1);
});

test('configuration clones share evidence and prior budget; same-checkpoint modes cannot rank each other', () => {
  const d = fixture([{ values: { a: 3, b: 2, c: 1 } }]);
  d.models.find((m) => m.id === 'b').ranking_identity = 'b-weights';
  const before = ratings(d);
  d.models.push({ ...d.models.find((m) => m.id === 'b'), id: 'b-copy', name: 'b-copy' });
  d.resultsByKey['b-copy|p0'] = structuredClone(d.resultsByKey['b|p0']);
  for (const [id, value] of Object.entries(before))
    assert.ok(Math.abs(rows(d).get(id).rank - value) < 1e-6);
  assert.ok(Math.abs(rows(d).get('b-copy').rank - before.b) < 1e-6);
  d.models.forEach((m) => (m.ranking_identity = 'one'));
  assert.ok([...rows(d).values()].every((r) => r.rank === null));
});

test('family comparison budget grows linearly and singleton or excluded evidence cannot create wins', () => {
  const d = fixture([{ values: { a: 3, b: 2, c: 1 } }]);
  assert.equal(
    graph(d).edges.reduce((s, e) => s + e.weight, 0),
    3 / 2
  );
  for (const change of [
    (o) => (o.evidence = 'assumed'),
    (o) => (o.status = 'assumed'),
    (o) => (o.evidence = 'vendor_internal'),
    (o) => (o.comparable = false)
  ]) {
    const copy = structuredClone(d);
    for (const records of Object.values(copy.resultsByKey)) change(records[0]);
    assert.ok([...rows(copy).values()].every((r) => r.rank === null));
  }
  const one = fixture([{ values: { a: 100 } }]);
  assert.equal(rows(one).get('a').rank, null);
  d.tests[0].core = false;
  assert.equal(graph(d).edges.length, 0);
});

test('an incomparable preferred observation does not mask a usable alternative', () => {
  const d = fixture([{ values: { a: 3, b: 2 } }]);
  d.resultsByKey['a|p0'].unshift({
    value: 1,
    comparable: false,
    evidence: 'official',
    source_id: 'excluded'
  });
  const e = graph(d).edges[0];
  assert.equal(e.outcome, 1);
  assert.equal(e.observations[0].source_id, 'source');
  assert.equal(
    rows(d).get('a').scores.p0.value,
    1,
    'display preserves preferred raw evidence and its context-only label'
  );
});

test('disconnected groups remain visible without fabricated global placement', () => {
  const d = fixture([{ values: { a: 3, b: 2, c: 1 } }, { values: { x: 10, y: 9 } }]);
  assert.equal(rows(d).get('x').rank, null);
  assert.match(rows(d).get('x').rankExplanation, /disconnected/);
  assert.equal(rows(d).get('x').count, 1);
  assert.ok(rows(d).get('a').rank > 50);
});

test('filters, source labels and cost do not change ratings; history cannot borrow a later generation score', () => {
  const d = fixture([{ values: { a: 3, b: 2, c: 1 } }]);
  const before = ratings(d);
  assert.equal(rows(d, { query: 'a', min: 1 }).get('a').rank, before.a);
  d.pricingByModel.a = { usd_per_1000_pages: 999 };
  for (const records of Object.values(d.resultsByKey)) records[0].evidence = 'author_reported';
  assert.deepEqual(ratings(d), before);
  d.models.find((m) => m.id === 'a').lineage = 'a';
  d.models.push({ id: 'a-new', name: 'new', lineage: 'a', release_date: '2026-10-10' });
  assert.equal(rows(d).get('a-new').rank, null);
  assert.equal(rows(d).has('a'), false);
  assert.ok(Rank.build(d, '2026-10-01').rows.some((r) => r.id === 'a' && r.rank != null));
});

test('browser and build share deterministic ratings and the solver converges', () => {
  const d = fixture([{ values: { a: 3, b: 2, c: 1 } }, { values: { a: 1, b: 3, c: 2 } }]);
  const context = {};
  for (const file of ['pairwise-ranking.js', 'ranking.js'])
    vm.runInNewContext(
      fs.readFileSync(require.resolve('../src/assets/js/' + file), 'utf8'),
      context
    );
  assert.equal(JSON.stringify(context.BenchmarkRank.build(d)), JSON.stringify(Rank.build(d)));
  const reverse = structuredClone(d);
  reverse.models.reverse();
  reverse.tests.reverse();
  assert.deepEqual(ratings(reverse), ratings(d));
  assert.ok(Pair.fit(graph(d)).residual < 1e-7);
});
