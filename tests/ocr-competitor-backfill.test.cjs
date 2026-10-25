const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadOCR } = require('../lib/load.cjs');
const { build } = require('../lib/ranking.cjs');
const OCR = require('../src/assets/js/ocr-comparison.js');
const data = loadOCR();
test('competitor panels preserve full, subset and PDF-text-assisted protocols', () => {
  const rows = build(data, data.config.snapshot_date, { min: 0 }).rows;
  const get = (id) => rows.find((r) => r.id === id);
  assert.equal(data.resultsByKey['lightonocr-3-4b|chandra-2-5-olm-no-hf'][0].metrics.pp3, 86);
  assert.equal(get('lightonocr-3-4b').coreCount, 3);
  for (const id of ['marker2-pdf-pipeline', 'parsebench-published-9af4102']) {
    const t = data.tests.find((t) => t.id === id);
    assert.equal(t.core, false);
    assert.equal(t.primary, false);
  }
  assert.ok(Number.isFinite(get('docling-pipeline').rank));
  assert.equal(get('docling-pipeline').scores['marker2-pdf-pipeline'].value, 50.3);
  assert.equal(
    data.resultsByKey['ovisocr2|olmocr'].find(
      (r) => r.source_id === 'lighton3-pinned-olm-reproduction'
    ).metrics.overall,
    70.5
  );
  assert.equal(
    data.resultsByKey['hunyuanocr-1-5|omnidoc-v16'].find(
      (r) => r.source_id === 'jina-quoted-omnidoc16'
    ).evidence,
    'secondary'
  );
  assert.equal(
    data.models.some((m) => /surya.*2[.-]5/i.test(m.id)),
    false
  );
});
test('exact checkpoint competitor speeds never become measurements of normalized estimates', () => {
  for (const id of ['infinity-parser2-flash', 'kdl-frontier-parser-nano', 'mineru2-5-pro-2605']) {
    const model = data.models.find((m) => m.id === id),
      d = OCR.deployment(data, model);
    const releaseDates = {
      'infinity-parser2-flash': '2026-05-11',
      'kdl-frontier-parser-nano': null,
      'mineru2-5-pro-2605': '2026-05-21'
    };
    assert.equal(model.release_date, releaseDates[id]);
    if (model.release_date) assert.ok(data.sources[model.release_source_id]);
    assert.equal(d.reference.status, 'estimated');
    assert.equal(d.reference.confidence, 'low');
    assert.equal(d.cost.kind, 'H100 scenario');
    assert.equal(d.cost.low, 1000 / (3600 * d.reference.high));
    assert.ok(
      d.records.some(
        (r) => r.source_id === 'small-specialist-nemotron-matched-timing' && !r.comparison_default
      )
    );
    assert.equal(
      build(data, data.config.snapshot_date, { min: 0 }).rows.find((r) => r.id === id).rankStatus,
      'provisional'
    );
  }
  assert.ok(data.throughput.some((r) => r.model === 'dots-mocr' && r.pages_per_second === 0.55));
  assert.ok(
    data.throughput.some((r) => r.model === 'infinity-parser-7b' && r.pages_per_second === 0.64)
  );
  const pairs = data.throughput.map((r) => r.model + '|' + r.source_id);
  for (const source of [
    'small-specialist-jina-throughput',
    'small-specialist-nemotron-matched-timing'
  ]) {
    const subset = pairs.filter((p) => p.endsWith('|' + source));
    assert.equal(subset.length, new Set(subset).size);
  }
});
test('second source sweep preserves versions, derived means and uncertain timing context', () => {
  const glm = data.tests.find((t) => t.id === 'omnidoc-v15-glm-report');
  assert.equal(glm.core, false);
  assert.equal(glm.primary, false);
  const pure = data.records.filter(
    (r) => r.source_id === 'teleocr-card-70a19' && r.benchmark === 'puredoc'
  );
  assert.equal(pure.length, 17);
  for (const r of pure) {
    assert.equal(
      r.metrics.avg3,
      Math.round(((r.metrics.clean + r.metrics.digital + r.metrics.real) / 3) * 100) / 100
    );
    assert.match(r.note, /computed|derived/i);
  }
  const sweep = data.throughput.filter((r) => r.source_id === 'hunyuan15-paper-table6');
  assert.equal(sweep.length, 12);
  assert.ok(sweep.every((r) => !r.hardware_known && !r.cost_eligible && !r.comparison_default));
  const financial = data.throughput.filter((r) => r.source_id === 'infinity-report-v1');
  assert.equal(financial.length, 11);
  assert.ok(
    financial.every(
      (r) => r.unit === 'seconds_per_image' && !r.cost_eligible && !r.comparison_default
    )
  );
  const more = data.resultsByKey['hunyuanocr-1-5|more'].find(
    (r) => r.source_id === 'hunyuan15-paper-table10'
  );
  assert.equal(more.metrics.overall, 91.9);
});
test('Nemotron mode-specific quality and speed stay paired, multilingual soup stays separate', () => {
  for (const [mode, quality] of [
    ['single', 72.73584672666817],
    ['double', 74.92348404837536]
  ]) {
    const id = 'nemotron-3-5-parse-' + mode,
      m = data.models.find((m) => m.id === id),
      d = OCR.deployment(data, m);
    assert.equal(m.release_date, '2026-10-17');
    assert.ok(
      Math.abs(
        data.resultsByKey[id + '|parsebench-nemotron35-triple'][0].metrics.overall - quality
      ) < 1e-10
    );
    assert.match(d.speed.pipeline, new RegExp(mode + '-pass'));
    assert.equal(d.reference.status, 'estimated');
    assert.equal(d.cost.high, 1000 / (d.reference.low * 3600));
  }
  const old = data.resultsByKey['nemotron-parse-2|moscar-nemotron'][0];
  assert.equal(old.metrics.boc_f1, 0.9102);
  const recent = data.resultsByKey['nemotron-parse-2|moscar-nvidia-released-checkpoints-202610'][0];
  assert.equal(recent.metrics.overall, 97.44);
  assert.equal(
    data.tests.find((t) => t.id === 'moscar-nvidia-released-checkpoints-202610').core,
    false
  );
});
test('OXR source backfill keeps excluded categories, hosted deployments and altered scoring separate', () => {
  const result = build(data, undefined, { min: 0 }),
    get = (id) => result.rows.find((r) => r.id === id);
  for (const id of ['lightonocr-2-1b', 'lightonocr-1b-1025', 'deepseek-ocr-2', 'glm-ocr-zai-api']) {
    assert.equal(get(id).scores.olmocr, null);
    assert.ok(get(id).rankContributions.some((c) => c.benchmark === 'olmocr-no-headers-footers'));
  }
  assert.equal(get('glm-ocr').scores.olmocr.value, 68.4);
  assert.equal(data.models.find((m) => m.id === 'glm-ocr-zai-api').access, 'closed');
  assert.equal(
    get('deepseek-ocr-2').scores['olmocr-no-headers-footers'].metrics.headers_footers,
    undefined
  );
  for (const [id, variant] of [
    ['falconocr', 'olmocr-falcon-paper-en'],
    ['mineru2-5', 'olmocr-mineru-cdm-exprate']
  ]) {
    assert.equal(get(id).scores.olmocr, null);
    assert.ok(get(id).scores[variant]);
    assert.ok(
      !get(id).rankContributions.some((c) => c.benchmark === variant),
      'one identity cannot create a comparative cohort'
    );
  }
  assert.equal(data.resultsByKey['mineru2-5|olmocr-mineru-cdm-exprate'].length, 2);
  assert.equal(get('mineru-2-5-4').rank, null);
  assert.equal(data.config.default_families, 0);
});
test('RTX PRO 6000 observations stay visible without changing H100 speed, cost or quality', () => {
  const source = 'oxr-1-0-author-benchmarks',
    records = data.throughput.filter((r) => r.source_id === source);
  const without = { ...data, throughput: data.throughput.filter((r) => r.source_id !== source) };
  for (const r of records) {
    const model = data.models.find((m) => m.id === r.model),
      current = OCR.deployment(data, model),
      previous = OCR.deployment(without, model);
    assert.equal(r.comparison_default, false);
    assert.equal(r.cost_eligible, false);
    assert.deepEqual(current.speed, previous.speed);
    assert.deepEqual(current.reference, previous.reference);
    assert.deepEqual(current.cost, previous.cost);
  }
  const result = build(data, undefined, { min: 0 });
  assert.deepEqual(
    result.rows.map((r) => [r.id, r.rank]),
    build(without, undefined, { min: 0 }).rows.map((r) => [r.id, r.rank])
  );
  const subset = {
    ...result,
    rows: result.rows.filter((r) => ['oxr-1-0', 'teleocr'].includes(r.id))
  };
  const html = OCR.renderRows(subset, data);
  for (const value of ['0.990373', '100.972', '557.77', '0.135909', '735.789', '352.66'])
    assert.ok(html.includes(value), 'exact timing value remains in details: ' + value);
  assert.match(html, /RTX PRO 6000 Blackwell/);
});
