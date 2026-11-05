const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const matrix = require('../src/assets/js/svg-matrix.js');

function validateSVG(data) {
  assert.equal(data.schema_version, 1);
  for (const metric of Object.values(data.metrics)) {
    assert(
      ['quality', 'complexity', 'diagnostic', 'time'].includes(metric.role),
      'Invalid SVG metric role'
    );
    assert(['asc', 'desc'].includes(metric.direction), 'Invalid SVG metric direction');
    assert(
      Number.isInteger(metric.precision) && metric.precision >= 0 && metric.precision <= 8,
      'Invalid SVG precision'
    );
    assert(metric.label && metric.description, 'Incomplete SVG metric');
  }
  const ids = new Set();
  for (const run of data.runs) {
    assert(['maintainer', 'published'].includes(run.report_type), 'Invalid SVG report type');
    assert(!ids.has(run.id), 'Duplicate SVG protocol');
    ids.add(run.id);
    assert(data.sources[run.source_id] && data.sources[run.dataset_source], 'Unknown SVG source');
    assert(run.columns.includes(run.primary), 'Primary metric must be visible');
    assert.equal(
      data.metrics[run.primary]?.role,
      'quality',
      'Complexity cannot supply quality rank'
    );
    assert.equal(new Set(run.columns).size, run.columns.length, 'Duplicate SVG metric column');
    assert(
      run.sample_count === null || (Number.isInteger(run.sample_count) && run.sample_count > 0)
    );
    for (const metric of run.columns) assert(data.metrics[metric], 'Unknown SVG metric');
    const models = new Set();
    for (const row of run.rows) {
      assert(data.models[row.model] && !models.has(row.model), 'Unknown or duplicate SVG model');
      models.add(row.model);
      if (run.report_type === 'published') {
        assert(
          ['author-reported', 'competitor-reported'].includes(row.attribution),
          'Missing SVG row attribution'
        );
      }
      for (const [metric, value] of Object.entries(row.values)) {
        assert(data.metrics[metric], 'Unknown SVG observation metric');
        assert(
          value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0),
          'Invalid SVG value'
        );
        if (['dino', 'dino_cosine', 'iou', 'ssim'].includes(metric) && value !== null)
          assert(value <= 1);
      }
      if (row.conditional) {
        assert(
          Number.isInteger(row.conditional.count) &&
            row.conditional.count > 0 &&
            row.conditional.count <= run.sample_count,
          'Invalid conditional SVG cohort'
        );
        assert(
          Number.isFinite(row.conditional.mean_boundary) && row.conditional.mean_boundary >= 0,
          'Invalid conditional SVG value'
        );
      }
    }
  }
  if (data.overview) {
    const panel = data.overview;
    assert(!ids.has(panel.id), 'Duplicate SVG overview ID');
    ids.add(panel.id);
    assert(
      data.sources[panel.source_id] && data.sources[panel.dataset_source],
      'Unknown SVG overview source'
    );
    assert(
      panel.columns.includes(panel.primary) && data.metrics[panel.primary]?.role === 'quality'
    );
    assert.equal(new Set(panel.columns).size, panel.columns.length);
    assert(panel.components.length >= 2, 'Fixed SVG panel requires multiple datasets');
    const datasets = new Set(),
      columns = new Set();
    for (const component of panel.components) {
      const run = data.runs.find((run) => run.id === component.run_id);
      assert(run && run.source_id === panel.source_id, 'SVG overview must use one matched source');
      assert.equal(component.metric, panel.components[0].metric, 'SVG overview metrics must match');
      assert(
        run.columns.includes(component.metric) && data.metrics[component.metric]?.role === 'quality'
      );
      assert(data.metrics[component.column] && panel.columns.includes(component.column));
      assert(
        !datasets.has(run.dataset) && !columns.has(component.column),
        'Repeated SVG dataset vote'
      );
      datasets.add(run.dataset);
      columns.add(component.column);
    }
    assert.equal(panel.columns.length, panel.components.length + 1);
  }
  assert(data.matrix, 'Missing SVG matrix definition');
  const modes = new Set(data.matrix.modes.map((mode) => mode.id));
  assert.equal(modes.size, data.matrix.modes.length, 'Duplicate SVG colour mode');
  assert(
    modes.has(data.matrix.default_mode) && modes.has(data.default_run),
    'Unknown default SVG colour mode'
  );
  const families = new Set(data.matrix.columns.map((column) => column.id));
  assert.equal(families.size, data.matrix.columns.length, 'Duplicate SVG matrix family');
  for (const column of data.matrix.columns) {
    assert(modes.has(column.colour), 'Unknown SVG colour mode');
    if (column.colour_source)
      assert(data.sources[column.colour_source], 'Unknown SVG colour evidence');
    assert(
      data.metrics[column.metric]?.role === 'quality',
      'SVG matrix columns require quality metrics'
    );
  }
  for (const test of data.matrix.next_tests || []) {
    assert.equal(test.status, 'eligible-unmeasured', 'SVG eligibility is not a measurement');
    assert(Number.isInteger(test.rows) && test.rows > 0);
    assert.equal(new URL(test.url).protocol, 'https:');
  }
  for (const metric of data.matrix.complexity_metrics)
    assert(
      data.metrics[metric]?.role === 'complexity',
      'SVG complexity columns require complexity metrics'
    );
  for (const run of data.runs) {
    assert(families.has(run.family), 'Unknown SVG matrix family');
    assert.equal(
      data.matrix.columns.find((column) => column.id === run.family).metric,
      run.primary,
      'SVG family metrics must match'
    );
    assert(Number.isInteger(run.priority) && run.priority >= 0, 'Invalid SVG protocol priority');
    assert(run.source_label, 'Missing SVG source label');
  }
  for (const model of Object.values(data.models))
    assert(model.configuration_label, 'Missing SVG configuration label');
  assert(Number.isInteger(data.matrix.minimum_families) && data.matrix.minimum_families > 0);
  assert(
    Number.isInteger(data.matrix.full_coverage_families) &&
      data.matrix.full_coverage_families >= data.matrix.minimum_families
  );
  for (const difference of data.differences || []) {
    for (const [side, type] of [
      ['local', 'maintainer'],
      ['published', 'published']
    ]) {
      const ref = difference[side],
        run = data.runs.find((run) => run.id === ref.run_id);
      assert(run && run.report_type === type, 'Invalid SVG difference source');
      assert(
        Number.isFinite(run.rows.find((row) => row.model === ref.model)?.values[ref.metric]),
        'Missing SVG difference value'
      );
    }
  }
  for (const source of Object.values(data.sources)) {
    assert.equal(new URL(source.url).protocol, 'https:');
    assert(source.operator && source.attribution);
  }
  return data;
}

function loadSVG() {
  const data = validateSVG(
    JSON.parse(fs.readFileSync(path.join(__dirname, '../data/svg/results.json'), 'utf8'))
  );
  return { ...data, matrixResult: matrix.build(data) };
}
module.exports = { loadSVG, validateSVG };
