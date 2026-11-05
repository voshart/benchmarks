const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSVG, validateSVG } = require('../lib/load-svg.cjs');
const comparison = require('../src/assets/js/svg-comparison.js');
const ledger = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/svg/evidence/published-tables-2025.json'), 'utf8')
);

test('published SVG imports reproduce every source cell and execution attribution', () => {
  const data = loadSVG();
  for (const table of ledger.tables) {
    const run = data.runs.find((run) => run.id === table.run_id);
    assert(run, table.run_id);
    assert.equal(run.report_type, 'published');
    assert.equal(run.source_id, table.source_id);
    assert.equal(run.sample_count, table.sample_count);
    assert.equal(data.sources[run.source_id].operator, table.measurement_operator);
    assert.equal(data.sources[run.source_id].url, table.source_url);
    assert.deepEqual(
      new Set(run.rows.map((row) => row.model)),
      new Set(table.rows.map((row) => row.model))
    );
    for (const source of table.rows) {
      const row = run.rows.find((row) => row.model === source.model);
      assert.equal(row.attribution, source.attribution);
      for (const [metric, cell] of Object.entries(source.cells)) {
        const value = Number(metric === 'tokens_k' ? cell.replace(/k$/, '') : cell);
        assert.equal(row.values[metric], value, `${run.id} / ${row.model} / ${metric}`);
      }
      assert(
        !Object.hasOwn(row.values, 'trace_errors'),
        'unreported failures must not become zero'
      );
      assert(
        !Object.hasOwn(row.values, 'segments'),
        'paths and tokens must not become curve segments'
      );
      assert(
        !Object.hasOwn(row.values, 'dino'),
        'published cosine must not inherit the local rescaling'
      );
    }
  }
});

test('published SVG metrics retain resolution, count and timing qualifications', () => {
  const data = loadSVG();
  const run = data.runs.find((run) => run.id === 'layertracer-vectorization-2025');
  const rows = comparison.select(data, run.id);
  const html = comparison.renderRows(rows, data);
  assert.equal(rows.rows[0].model, 'layertracer-2025');
  assert(html.includes('0.000196'));
  assert(html.includes('29.98'));
  assert(html.includes('34 s'));
  assert(html.includes('inference hardware and timing boundaries are unverified'));
  assert(
    !run.columns.includes('reported_seconds'),
    'unverified timing remains source context in Details'
  );
  const paper = data.runs.find((run) => run.id === 'mmsvg-icon-omnisvg2025');
  assert.equal(comparison.select(data, paper.id, 'Monotrace').rows.length, 0);
  assert.match(paper.sample_count_note, /exact evaluation file list/);
  assert.equal(paper.report_type, 'published');
});

test('SVG published rows require explicit reporting type and row attribution', () => {
  const data = loadSVG();
  const changed = structuredClone(data);
  const run = changed.runs.find((run) => run.report_type === 'published');
  delete run.rows[0].attribution;
  assert.throws(() => validateSVG(changed), /Missing SVG row attribution/);
  const unknown = structuredClone(data);
  unknown.runs[0].report_type = 'independent';
  assert.throws(() => validateSVG(unknown), /Invalid SVG report type/);
});
