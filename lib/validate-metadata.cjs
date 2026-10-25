const assert = require('node:assert/strict');

const evidenceKinds = new Set([
  'official',
  'third_party',
  'community',
  'author_reported',
  'vendor_comparison',
  'vendor',
  'mixed',
  'research',
  'imported',
  'secondary',
  'vendor_internal',
  'assumed'
]);

// Reject misspelled eligibility/display fields instead of silently ignoring them.
const protocolFields = new Set([
  'id',
  'short',
  'label',
  'source',
  'family',
  'primary_metric',
  'unit',
  'direction',
  'core',
  'primary',
  'coverage',
  'aggregate_eligible',
  'aggregate_priority',
  'aggregate_note',
  'aggregate_caveat',
  'rank_priority',
  'matrix_extra',
  'matrix_order',
  'metric_labels',
  'metric_units',
  'metric_directions',
  'metric_tables',
  'min_models',
  'min_organizations',
  'configuration',
  'dataset_source_id',
  'dataset_version',
  'note',
  'scope'
]);

function validateOCRMetadata(data) {
  const configFile = 'ocr/config.json';
  const tests = new Map(data.tests.map((test) => [test.id, test]));
  const text = (value, message) => assert.ok(typeof value === 'string' && value.trim(), message);
  for (const key of ['default_families', 'min_core_for_rank', 'min_core_for_provisional']) {
    assert.ok(
      Number.isInteger(data.config[key]) && data.config[key] >= 0,
      `${configFile}: invalid ${key}`
    );
  }
  assert.equal(data.config.rank_policy_version, 4, `${configFile}: unknown OCR ranking policy`);
  assert.ok(
    Number.isFinite(data.config.pairwise_prior) && data.config.pairwise_prior > 0,
    `${configFile}: invalid pairwise_prior`
  );
  assert.equal(
    data.config.reported_index,
    true,
    `${configFile}: policy v4 requires reported_index`
  );
  assert.ok(
    data.config.min_core_for_provisional >= 1 &&
      data.config.min_core_for_provisional <= data.config.min_core_for_rank,
    `${configFile}: invalid ranking thresholds`
  );
  for (const [id, source] of Object.entries(data.sources)) {
    const label = `ocr/sources.json: ${id}`;
    assert.ok(
      evidenceKinds.has(source.kind) || source.kind === 'vendor_price',
      `${label}: unknown source kind`
    );
    assert.match(source.url || '', /^https?:\/\//, `${label}: missing source URL`);
  }
  for (const test of data.tests) {
    const file = `ocr/tests/${test.id}.json`;
    for (const key of Object.keys(test))
      assert.ok(protocolFields.has(key), `${file}: unknown field ${key}`);
    for (const key of ['id', 'short', 'label', 'family', 'primary_metric'])
      text(test[key], `${file}: missing ${key}`);
    for (const key of ['core', 'primary', 'coverage', 'aggregate_eligible', 'matrix_extra']) {
      if (test[key] != null) assert.equal(typeof test[key], 'boolean', `${file}: invalid ${key}`);
    }
    for (const key of ['aggregate_priority', 'rank_priority', 'matrix_order']) {
      if (test[key] != null) assert.ok(Number.isFinite(test[key]), `${file}: invalid ${key}`);
    }
    for (const [key, unit] of Object.entries(test.metric_units || {})) {
      assert.ok(['percent', 'ratio'].includes(unit), `${file}: unknown metric unit for ${key}`);
    }
    for (const [key, direction] of Object.entries(test.metric_directions || {})) {
      assert.ok(
        ['higher', 'lower'].includes(direction),
        `${file}: unknown metric direction for ${key}`
      );
    }
  }
  for (const record of data.rawRecords) {
    if (record.evidence != null)
      assert.ok(
        evidenceKinds.has(record.evidence),
        `ocr/results/${record.benchmark}.jsonl: ${record.model}: unknown evidence class`
      );
  }
  assert.ok(
    data.config.views && typeof data.config.views === 'object' && !Array.isArray(data.config.views),
    `${configFile}: missing views`
  );
  for (const [id, view] of Object.entries(data.config.views)) {
    const label = `${configFile}: view ${id}`;
    assert.ok(
      view && typeof view === 'object' && !Array.isArray(view),
      `${label}: invalid definition`
    );
    assert.ok(
      view.filter == null || ['scored', 'author_reported'].includes(view.filter),
      `${label}: unknown filter`
    );
    assert.ok(
      Array.isArray(view.tests) || view.primary === false,
      `${label}: select tests or secondary protocols`
    );
    if (view.tests) {
      assert.equal(new Set(view.tests).size, view.tests.length, `${label}: duplicate protocol`);
      for (const test of view.tests)
        assert.ok(tests.has(test), `${label}: unknown protocol ${test}`);
    }
  }
  if (data.config.column_family_order) {
    assert.ok(
      Array.isArray(data.config.column_family_order),
      `${configFile}: invalid column_family_order`
    );
    assert.equal(
      new Set(data.config.column_family_order).size,
      data.config.column_family_order.length,
      `${configFile}: duplicate column family`
    );
  }
  if (data.config.other_column) {
    assert.equal(
      data.config.other_column.catch_all,
      true,
      `${configFile}: other_column must declare catch_all`
    );
    for (const key of ['id', 'short', 'label', 'family'])
      text(data.config.other_column[key], `${configFile}: other_column requires ${key}`);
    assert.ok(
      !tests.has(data.config.other_column.id),
      `${configFile}: other_column collides with a protocol`
    );
  }
}

module.exports = { validateOCRMetadata };
