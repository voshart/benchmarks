const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadOCR } = require('../lib/load.cjs');
const { build, choose, rankable } = require('../lib/ranking.cjs');
const { renderRank, scoreTooltip } = require('../src/assets/js/rank-ui.js');

function fixture() {
  const models = Array.from({ length: 6 }, (_, i) => ({
    id: 'm' + i,
    name: 'Model ' + i,
    organization: 'Org ' + (i % 3),
    release_date: '2026-01-01',
    access: 'open'
  }));
  const tests = Array.from({ length: 3 }, (_, i) => ({
    id: 'test' + i,
    label: 'Family ' + i,
    family: 'family' + i,
    core: true,
    direction: 'higher'
  }));
  const sources = {
    official: {
      title: 'Benchmark operator',
      url: 'https://example.org/official',
      kind: 'official'
    },
    author: { title: 'Author report', url: 'https://example.org/author', kind: 'author_reported' }
  };
  const resultsByKey = {};
  for (const test of tests)
    for (const [i, model] of models.entries())
      resultsByKey[model.id + '|' + test.id] = [
        {
          model: model.id,
          benchmark: test.id,
          value: 90 - i,
          source_id: 'official',
          evidence: 'official'
        }
      ];
  return {
    config: {
      snapshot_date: '2026-10-13',
      default_families: 1,
      min_core_for_rank: 3,
      min_core_for_provisional: 2
    },
    models,
    tests,
    primaryTests: tests,
    coverageTests: tests,
    resultsByKey,
    sources,
    pricingByModel: {}
  };
}

test('three clean mature families support a rank without a provisional marker', () => {
  const row = build(fixture()).rows.find((r) => r.id === 'm0');
  assert.equal(row.rank, 100);
  assert.equal(row.rankStatus, 'supported');
  assert.deepEqual(row.provisionalReasons, []);
  assert.equal(renderRank(row).includes('rank-marker'), false);
});

test('two mature families give a qualified number, one gives no aggregate', () => {
  const data = fixture();
  delete data.resultsByKey['m0|test2'];
  let row = build(data).rows.find((r) => r.id === 'm0');
  assert.equal(row.rank, 100);
  assert.equal(row.rankStatus, 'provisional');
  assert.match(row.rankExplanation, /2 mature core families/);
  delete data.resultsByKey['m0|test1'];
  row = build(data).rows.find((r) => r.id === 'm0');
  assert.equal(row.rank, null);
  assert.match(row.rankExplanation, /at least 2 required/);
});

test('author and vendor public-benchmark measurements follow the same eligibility rule', () => {
  assert.equal(rankable({ value: 90, evidence: 'author_reported' }), true);
  assert.equal(rankable({ value: 90, evidence: 'vendor' }), true);
  assert.equal(rankable({ value: 90, evidence: 'vendor_comparison' }), true);
  assert.equal(rankable({ value: 90, evidence: 'assumed' }), false);
  assert.equal(rankable({ value: 90, evidence: 'official', status: 'assumed' }), false);
  assert.equal(rankable({ value: 90, evidence: 'vendor_internal' }), false);
  assert.equal(rankable({ value: 90, evidence: 'official', comparable: false }), false);
});

test('qualified cohort evidence qualifies all indices using that cohort', () => {
  const data = fixture();
  data.resultsByKey['m0|test0'][0].evidence = 'author_reported';
  data.resultsByKey['m0|test0'][0].source_id = 'author';
  const rows = build(data).rows;
  assert.equal(rows.find((r) => r.id === 'm0').rankStatus, 'provisional');
  assert.equal(rows.find((r) => r.id === 'm1').rankStatus, 'provisional');
  assert.ok(
    rows
      .find((r) => r.id === 'm1')
      .provisionalReasons.some((r) => /Comparison cohorts.*author-reported/.test(r))
  );
});

test('an assumed result cannot satisfy maturity, coverage or source selection', () => {
  const data = fixture();
  data.resultsByKey['m0|test0'][0].evidence = 'assumed';
  assert.equal(choose(data, 'm0', 'test0'), null);
  const row = build(data).rows.find((r) => r.id === 'm0');
  assert.equal(row.count, 2);
  assert.equal(row.coreCount, 2);
  assert.equal(row.rankStatus, 'provisional');
});

test('one variant per family contributes and unrelated secondary tasks do not boost rank coverage', () => {
  const data = fixture();
  data.tests[2].family = data.tests[1].family;
  const row = build(data).rows.find((r) => r.id === 'm0');
  assert.equal(row.coreCount, 2);
  assert.equal(row.rankStatus, 'provisional');
  const real = loadOCR(),
    x = build(real).rows.find((r) => r.id === 'xiaomi-ocr-0');
  assert.equal(x.coreCount, 2);
  assert.ok(
    !x.rankContributions.some((c) => c.benchmark.includes('xiaomi') || c.benchmark === 'real5')
  );
});

test('maintainer Real5 result is selected and conflicting author result is preserved', () => {
  const data = loadOCR(),
    observed = data.resultsByKey['xiaomi-ocr-0|real5'];
  assert.equal(observed.length, 2);
  const chosen = choose(data, 'xiaomi-ocr-0', 'real5');
  assert.equal(chosen.value, 92.73);
  assert.ok(observed.some((r) => r.value === 95.24 && r.evidence === 'author_reported'));
  assert.match(scoreTooltip(chosen, data, 'xiaomi-ocr-0', 'real5'), /95.24/);
});

test('rank marker exposes reasons by hover title and native clickable popover, safely escaped', () => {
  const data = fixture();
  delete data.resultsByKey['m0|test2'];
  const row = build(data).rows.find((r) => r.id === 'm0');
  row.name = '<script>bad</script>';
  const html = renderRank(row, data.sources);
  assert.match(html, /title="[^"]*Limited coverage/);
  assert.match(html, /popovertarget="rank-note-m0"/);
  assert.match(html, /id="rank-note-m0" class="rank-note" popover/);
  assert.match(html, /popovertargetaction="hide"/);
  assert.ok(!html.includes('<script>bad</script>'));
});

test('search and coverage filters never change the ranking reference cohort', () => {
  const data = fixture();
  const all = build(data).rows.find((r) => r.id === 'm1');
  const filtered = build(data, undefined, { query: 'Model 1', min: 3 }).rows[0];
  assert.equal(filtered.rank, all.rank);
});
