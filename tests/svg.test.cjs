const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSVG, validateSVG } = require('../lib/load-svg.cjs');
const comparison = require('../src/assets/js/svg-comparison.js');
const fresh = () => JSON.parse(JSON.stringify(loadSVG()));

test('SVG groups never mix published and locally executed observations', () => {
  const data = loadSVG();
  const published = data.runs.find((run) => run.source_id === 'starvector');
  const local = comparison.select(data, 'fonts-full-20261104');
  assert(local.rows.every((row) => !published.rows.some((other) => other.model === row.model)));
  assert.equal(comparison.select(data, published.id, 'Monotrace').rows.length, 0);
  assert.equal(published.sample_count, null);
  assert.throws(() => comparison.select(data, 'nonexistent'), /Unknown SVG protocol/);
});

test('SVG missing scores sort last in either direction and measured zeros remain zero', () => {
  const data = fresh(),
    run = data.runs[0];
  run.rows = [
    { model: 'monotrace', values: { dino: null } },
    { model: 'potrace', values: { dino: 0 } },
    { model: 'vtracer', values: { dino: 0.5 } }
  ];
  assert.deepEqual(
    comparison.select(data, run.id, '', 'dino', 'asc').rows.map((row) => row.model),
    ['potrace', 'vtracer', 'monotrace']
  );
  assert.deepEqual(
    comparison.select(data, run.id, '', 'dino', 'desc').rows.map((row) => row.model),
    ['vtracer', 'potrace', 'monotrace']
  );
  assert.equal(comparison.format(null, data.metrics.dino), '—');
  assert.equal(comparison.format(0, data.metrics.trace_errors), '0');
});

test('SVG filtering searches configuration and preserves metric order', () => {
  const data = loadSVG();
  assert.equal(
    comparison.select(data, 'fonts-full-20261104', '  C 1.16 ').rows[0].model,
    'potrace'
  );
  assert.match(
    comparison.renderRows(comparison.select(data, 'fonts-full-20261104', 'absent'), data),
    /No tracers match/
  );
  assert.equal(
    comparison.select(data, 'fonts-full-20261104', '', 'mean_boundary').rows[0].model,
    'potrace'
  );
  assert.equal(comparison.select(data, 'fonts-full-20261104').rows[0].model, 'monotrace');
});

test('SVG full-run observations preserve the source summary including failures', () => {
  const data = loadSVG();
  const source = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/svg/evidence/full-fonts-summary.json'), 'utf8')
  );
  const run = data.runs.find((run) => run.source_id === 'local_full');
  for (const row of run.rows.filter((row) => row.model !== 'vtracer')) {
    const engine = source.engines.find((engine) => engine.engine === row.model);
    assert.equal(run.sample_count, engine.attempted);
    assert.equal(row.values.dino, engine.mean_dino_all_cases);
    assert.equal(
      row.values.mean_boundary,
      engine.mean_boundary_all_cases_including_256px_empty_output_penalty
    );
    assert.equal(row.values.median_boundary, engine.median_boundary_all_cases);
    assert.equal(
      row.values.no_output,
      engine.visible_references_without_ink_at_scoring_threshold_including_failures
    );
    assert.equal(row.values.trace_errors, engine.trace_failures);
    assert.equal(
      row.conditional.mean_boundary,
      engine.mean_boundary_on_paired_successful_nonempty_visible_cases
    );
  }
});

test('SVG row details escape evidence text and retain attribution and conditional scope', () => {
  const data = fresh();
  data.models.monotrace.name = '<script> & "tracer"';
  const result = comparison.select(data, 'fonts-full-20261104');
  const html = comparison.renderRows(result, data);
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt; &amp; &quot;tracer&quot;'));
  assert(html.includes('popover'));
  assert(html.includes('Monotrace maintainer'));
  assert(html.includes('4,813 cases'));
  assert(html.includes('Errors and empty outputs are excluded'));
  const head = comparison.renderHead(result, data);
  assert(head.includes('aria-sort="ascending"'));
  assert(head.includes('data-svg-sort="mean_boundary"'));
});

test('SVG validation rejects ambiguous protocols, sources and invalid values', () => {
  for (const mutate of [
    (data) => data.runs.push(data.runs[0]),
    (data) => {
      data.runs[0].source_id = 'missing';
    },
    (data) => {
      data.runs[0].rows[0].values.dino = 2;
    },
    (data) => {
      data.runs[0].rows[0].values.dino = -0.1;
    },
    (data) => {
      data.runs[0].rows[0].values.unverified = 0;
    },
    (data) => {
      data.sources.local_full.operator = '';
    },
    (data) => {
      data.sources.local_full.url = 'javascript:alert(1)';
    },
    (data) => {
      data.runs[0].rows[0].conditional.count = 9000;
    }
  ]) {
    const data = fresh();
    mutate(data);
    assert.throws(() => validateSVG(data));
  }
});

test('VTracer full-run observations match their packaged summaries including failures', () => {
  const data = loadSVG();
  for (const [runId, file] of [
    ['fonts-full-20261104', 'full-fonts-vtracer-summary.json'],
    ['icons-full-20261105', 'full-icons-vtracer-summary.json']
  ]) {
    const source = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/svg/evidence', file), 'utf8')
    );
    const run = data.runs.find((run) => run.id === runId),
      row = run.rows.find((row) => row.model === 'vtracer');
    assert.equal(run.sample_count, source.cases);
    assert.equal(row.values.dino, source.mean_dino_all_cases);
    assert.equal(row.values.median_boundary, source.median_boundary_all_cases);
    assert.equal(
      row.values.mean_boundary,
      source.mean_boundary_all_cases_including_256px_empty_output_penalty
    );
    assert.equal(row.values.iou, source.mean_iou_all_cases);
    assert.equal(row.values.no_output, source.empty_outputs_with_visible_reference);
    assert.equal(row.values.trace_errors, source.trace_failures);
  }
});
