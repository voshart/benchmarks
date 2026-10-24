const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readJSON, readJSONL } = require('../lib/read-data.cjs');
const { loadOCR } = require('../lib/load.cjs');
const { loadSTT } = require('../lib/load-stt.cjs');
const { validateData } = require('../lib/validate.cjs');
const { validateSTT } = require('../lib/validate-stt.cjs');
const Rank = require('../lib/ranking.cjs');
const OCR = require('../src/assets/js/ocr-comparison.js');

test('data parsing identifies the exact file and JSONL line without hiding blank lines', (t) => {
  const directory = fs.mkdtempSync(path.join(__dirname, 'parse-fixture-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const json = path.join(directory, 'broken.json');
  const jsonl = path.join(directory, 'broken.jsonl');
  fs.writeFileSync(json, '{');
  fs.writeFileSync(jsonl, '{"value":0}\n\n{broken}\n');
  assert.throws(
    () => readJSON(json),
    (error) => error.message.includes('broken.json:')
  );
  assert.throws(
    () => readJSONL(jsonl),
    (error) => error.message.includes('broken.jsonl:3:')
  );
  fs.writeFileSync(jsonl, '{"value":0}\n\n{"value":null}\n');
  assert.deepEqual(readJSONL(jsonl), [{ value: 0 }, { value: null }]);
});

test('OCR display metadata can add a protocol and change views without changing quality', () => {
  const data = loadOCR();
  const baseline = Rank.build(data, undefined, { min: 0 });
  const protocol = {
    ...data.tests[0],
    id: 'maintenance-fixture',
    family: 'maintenance-fixture',
    primary: false,
    core: false,
    aggregate_eligible: false,
    matrix_extra: true
  };
  data.tests.push(protocol);
  data.config.views.fixture = { tests: [protocol.id], filter: 'scored' };
  const row = baseline.rows.find((row) => Object.values(row.scores).some((score) => score));
  const observation = Object.values(row.scores).find(Boolean);
  data.resultsByKey[row.id + '|' + protocol.id] = [{ ...observation, benchmark: protocol.id }];
  const changed = Rank.build(data, undefined, { min: 0 });
  assert.deepEqual(
    changed.rows.map((row) => [row.id, row.rank, row.count]),
    baseline.rows.map((row) => [row.id, row.rank, row.count])
  );
  assert.ok(changed.columns.some((column) => column.id === protocol.id));
  const specialized = Rank.build(data, undefined, { view: 'fixture' });
  assert.deepEqual(
    specialized.columns.map((column) => column.id),
    [protocol.id]
  );
  assert.deepEqual(
    specialized.rows.map((row) => row.id),
    [row.id]
  );
  assert.equal(specialized.rows[0].rank, row.rank);
});

test('OCR metadata validation catches view typos, eligibility types and evidence classes', () => {
  for (const change of [
    (data) => {
      data.config.views.fixture = { tests: ['missing-protocol'] };
    },
    (data) => {
      data.config.views.fixture = { tests: [], filter: 'best-score' };
    },
    (data) => {
      data.tests[0].coverage = 'yes';
    },
    (data) => {
      data.tests[0].aggregate_eligible = 'false';
    },
    (data) => {
      data.tests[0].aggregate_eligble = true;
    },
    (data) => {
      data.tests[0].metric_units = { overall: 'milliseconds' };
    },
    (data) => {
      data.rawRecords[0].evidence = 'independant';
    },
    (data) => {
      data.sources[Object.keys(data.sources)[0]].kind = 'independant';
    }
  ]) {
    const data = loadOCR();
    change(data);
    assert.throws(() => validateData(data), /ocr\//);
  }
});

test('speech display lists validate all protocol references and duplicates', () => {
  for (const key of ['accuracy_tests', 'matrix_tests', 'small_tests', 'secondary_tests']) {
    const unknown = loadSTT();
    unknown.config[key].push('missing-protocol');
    assert.throws(() => validateSTT(unknown), /unknown.*protocol/);
    const duplicate = loadSTT();
    duplicate.config[key].push(duplicate.config[key][0]);
    assert.throws(() => validateSTT(duplicate), /duplicate protocol/);
  }
});

test('OCR deployment calculations expose the same API in the browser and Node', () => {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../src/assets/js/ocr-deployment.js'), 'utf8'),
    context
  );
  const data = loadOCR();
  for (const model of data.models) {
    assert.equal(
      JSON.stringify(context.OCRDeployment.deployment(data, model)),
      JSON.stringify(OCR.deployment(data, model)),
      model.id
    );
  }
});
