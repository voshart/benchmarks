/* One-time materialization cleanup; removed before merge. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
const ledger = read('data/ocr/research-ocria-20261026.json');
for (const { id } of ledger.protocols) {
  const p = 'data/ocr/tests/' + id + '.json';
  const definition = read(p);
  // Default family cells already expose variants. Do not add duplicate family columns.
  definition.matrix_extra = false;
  write(p, definition);
  const file = 'data/ocr/results/' + id + '.jsonl';
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  for (const row of rows) {
    if (row.evidence === 'secondary') {
      row.measurement_operator = row.model === 'indra-ocr-omniparse-20261023'
        ? 'Indra authors; republished by Datalab, exact source-run version unresolved'
        : 'Original publication operator; reprinted by LlamaIndex, not a new LlamaIndex run';
    }
  }
  fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}
function replace(file, before, after) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(after)) return;
  assert.equal(text.split(before).length - 1, 1, 'Exact patch anchor changed: ' + file);
  fs.writeFileSync(file, text.replace(before, after));
}
replace('tests/model-expansion.test.cjs',
  '    assert.equal(row.coreCount, 3);',
  `    assert.ok(row.coreCount >= 3, 'Previously established whole-document families remain');
    assert.equal(row.coreCount, new Set(row.rankContributions.map((c) => c.family)).size);
    assert.ok(row.rankContributions.every((c) => {
      const protocol = data.tests.find((t) => t.id === c.benchmark);
      return protocol.core || protocol.aggregate_eligible;
    }));`);
replace('tests/ocr-competitor-backfill.test.cjs',
  "  assert.equal(get('lightonocr-3-4b').coreCount, 3);",
  `  const lighton = get('lightonocr-3-4b');
  assert.ok(lighton.coreCount >= 3, 'Retain the original whole-document family coverage');
  assert.equal(lighton.coreCount, new Set(lighton.rankContributions.map((c) => c.family)).size);
  assert.ok(lighton.rankContributions.every((c) => !c.benchmark.includes('gt-layout')));`);
replace('tests/ocr-comparison.test.cjs',
  "  assert.equal(r.rank, null);\n  assert.equal(r.scores['parsebench-nemotron35-triple'].value, 75.20375371099965);",
  `  // Scope the single-checkpoint triple-pass assertion to that protocol. Later,
  // independently recorded whole-document panels may legitimately connect this model.
  const tripleOnly = { ...data, tests: data.tests.filter((t) => t.id === 'parsebench-nemotron35-triple') };
  const isolated = build(tripleOnly, data.config.snapshot_date, { min: 0 }).rows.find((row) => row.id === m.id);
  assert.equal(isolated.rank, null);
  assert.ok(r.rankContributions.every((c) => c.benchmark !== 'parsebench-nemotron35-triple'));
  assert.equal(r.scores['parsebench-nemotron35-triple'].value, 75.20375371099965);`);
replace('tests/releases-oct22.test.cjs',
  "  assert.equal(ocr.config.snapshot_date, '2026-10-22');",
  "  assert.ok(ocr.config.snapshot_date >= '2026-10-22', 'Current OCR snapshot includes the historical release audit');");
const extra = `

test('OCRia renders only its H100 range in the main speed cell and preserves B200 in Details', () => {
  const OCR = require('../src/assets/js/ocr-comparison.js');
  const result = Rank.build(data);
  const row = result.rows.find((r) => r.id === 'ocria-1');
  const html = OCR.renderRows({ ...result, rows: [row] }, data);
  const cell = html.match(/<td class="ocr-speed"[^>]*>([\\s\\S]*?)<\\/td>/)?.[1];
  assert.ok(cell);
  assert.match(cell, /≈0\\.3(?:0)?–6(?:\\.0)?/);
  assert.doesNotMatch(cell, /B200|10\\.21|8\\.67/);
  assert.match(html, /B200/);
  assert.match(html, /Hypothetical H100 equivalent/);
  const Template = require('../src/ocr/dimensions.11ty.js');
  const template = new Template();
  template.assetUrl = (url) => url;
  const diagnostic = template.render({ dimensionId: 'charts-formatting' });
  assert.match(diagnostic, /<tbody id="dimensionBody"><tr>/);
  assert.doesNotMatch(diagnostic, />Table rating /);
});
`;
const testfile = 'tests/ocria-20261026.test.cjs';
if (!fs.readFileSync(testfile, 'utf8').includes('OCRia renders only its H100 range')) fs.appendFileSync(testfile, extra);
console.log('Kept existing family columns; retained copied-source provenance; scoped historical test assumptions.');
