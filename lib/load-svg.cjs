const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const comparison = require('../src/assets/js/svg-comparison.js');

function validateSVG(data) {
  assert.equal(data.schema_version, 1);
  for (const metric of Object.values(data.metrics)) {
    assert(['asc', 'desc'].includes(metric.direction), 'Invalid SVG metric direction');
    assert(
      Number.isInteger(metric.precision) && metric.precision >= 0 && metric.precision <= 8,
      'Invalid SVG precision'
    );
    assert(metric.label && metric.description, 'Incomplete SVG metric');
  }
  const ids = new Set();
  for (const run of data.runs) {
    assert(!ids.has(run.id), 'Duplicate SVG protocol');
    ids.add(run.id);
    assert(data.sources[run.source_id] && data.sources[run.dataset_source], 'Unknown SVG source');
    assert(run.columns.includes(run.primary), 'Primary metric must be visible');
    assert.equal(new Set(run.columns).size, run.columns.length, 'Duplicate SVG metric column');
    assert(
      run.sample_count === null || (Number.isInteger(run.sample_count) && run.sample_count > 0)
    );
    for (const metric of run.columns) assert(data.metrics[metric], 'Unknown SVG metric');
    const models = new Set();
    for (const row of run.rows) {
      assert(data.models[row.model] && !models.has(row.model), 'Unknown or duplicate SVG model');
      models.add(row.model);
      for (const [metric, value] of Object.entries(row.values)) {
        assert(data.metrics[metric], 'Unknown SVG observation metric');
        assert(
          value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0),
          'Invalid SVG value'
        );
        if ((metric === 'dino' || metric === 'iou') && value !== null) assert(value <= 1);
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
  assert(ids.has(data.default_run));
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
  return { ...data, panels: data.runs.map((run) => comparison.select(data, run.id)) };
}
module.exports = { loadSVG, validateSVG };
