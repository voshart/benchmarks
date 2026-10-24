const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Estimates = require('../src/assets/js/speech-estimates.js');
const Speech = require('../src/assets/js/speech.js');
const loadData = require('../src/_data/stt.cjs');
const data = loadData();
const model = data.models.find((m) => m.id === 'stt-openai-whisper-large-v3');
const size = Speech.selectSize(data, model.id);

test('exact upstream proxy retains observations, clip span and reciprocal cost', () => {
  const before = JSON.stringify(data);
  const result = Estimates.getDeployment(data, model, size, { hourlyRate: 2 });
  assert.equal(result.status, 'assumed');
  assert.equal(result.speed.proxy, true);
  assert.equal(result.speed.model, 'stt-handy-whisper-large-v3-q8-0');
  assert.deepEqual([result.speed.low, result.speed.high], [14.76, 19.74]);
  assert.equal(result.speed.confidence_interval, false);
  assert.equal(result.cost.low, 2 / 19.74);
  assert.equal(result.cost.high, 2 / 14.76);
  assert.equal(result.cost.market_price, false);
  assert.equal(result.memory.fp16_weights_gb, size.parameters_million * 0.002);
  assert.equal(result.memory.runtime_extra, true);
  assert.equal(result.memory.documented_vram.gb, 10);
  assert.equal(JSON.stringify(data), before);
});

test('same exact Q8 model is observed span, with only cost/memory assumed', () => {
  const id = 'stt-handy-whisper-large-v3-q8-0';
  const result = Estimates.getDeployment(data, id, Speech.selectSize(data, id));
  assert.equal(result.status, 'observed');
  assert.equal(result.speed.proxy, false);
  assert.equal(result.cost.status, 'assumed');
  assert.equal(result.memory.documented_vram, null);
});

test('closed API, unknown model and fuzzy HF aliases do not receive speed proxies', () => {
  assert.equal(Estimates.getDeployment(data, { ...model, access: 'closed' }, size), null);
  assert.equal(Estimates.getDeployment(data, 'absent', size), null);
  for (const id of [
    'niagara-9m-batch-en',
    'stt-google-gemma-4-e4b-it',
    'stt-thestageai-thewhisper-large-v3-turbo'
  ]) {
    const result = Estimates.getDeployment(data, id, Speech.selectSize(data, id));
    assert.equal(result?.speed ?? null, null, id);
  }
});

test('matching is case insensitive but otherwise exact; no conflicting conversion selection', () => {
  assert.ok(
    Estimates.getDeployment(data, { ...model, hub_id: model.hub_id.toUpperCase() }, size).speed
  );
  const duplicate = {
    ...data.models.find((m) => m.id === 'stt-handy-whisper-large-v3-q8-0'),
    id: 'duplicate'
  };
  assert.equal(
    Estimates.getDeployment({ ...data, models: [...data.models, duplicate] }, model, size).speed,
    null
  );
});

test('panel rejects incomplete, wrong hardware, runtime, batch, assumed and mixed revision clips', () => {
  for (const change of [
    { hardware: 'm5' },
    { runtime: 'other' },
    { batch_size: 128 },
    { status: 'assumed' },
    { engine_sha: 'other' },
    { rtfx: 0 },
    { load_time_included: true }
  ]) {
    const throughput = data.throughput.map((r) =>
      r.model === 'stt-handy-whisper-large-v3-q8-0' &&
      r.sample === 'jfk' &&
      r.hardware === 'm4-max' &&
      r.runtime.includes('metal')
        ? { ...r, ...change }
        : r
    );
    assert.equal(
      Estimates.getDeployment({ ...data, throughput }, model, size).speed,
      null,
      JSON.stringify(change)
    );
  }
});

test('memory is a parameter floor, never file-size VRAM; exact Whisper documentation only', () => {
  const noSize = Estimates.getDeployment(data, model, { download_mb: 999 });
  assert.equal(noSize.memory, null);
  const turbo = Estimates.getDeployment(data, 'whisper-large-v3-turbo', {
    parameters_million: 809
  });
  assert.equal(turbo.memory.documented_vram.gb, 6);
  const distil = Estimates.getDeployment(
    data,
    { ...model, hub_id: 'distil-whisper/distil-large-v3.5' },
    { parameters_million: 800 }
  );
  assert.equal(distil.memory.documented_vram, null);
  assert.equal(Estimates.getDeployment(data, model, size, { hourlyRate: -1 }).cost, null);
  assert.equal(Estimates.getDeployment(data, model, size, { hourlyRate: Infinity }).cost, null);
});

test('browser UMD export matches CommonJS deployment calculations', () => {
  const context = {};
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../src/assets/js/speech-estimates.js'), 'utf8'),
    context
  );
  assert.equal(typeof context.BenchmarkSpeechEstimates.getDeployment, 'function');
  const actual = Estimates.getDeployment(data, model, size);
  const browser = context.BenchmarkSpeechEstimates.getDeployment(data, model, size);
  assert.equal(JSON.stringify(browser), JSON.stringify(actual));
});

test('three reviewed HF lineages add alternate deployments, never measured HF speed', () => {
  const cases = [
    ['qwen3-asr-0-6b-hf', 61.54, 72.46],
    ['qwen3-asr-1-7b-hf', 36.16, 44.31],
    ['stt-funaudiollm-fun-asr-nano-2512-hf', 72.05, 79.98]
  ];
  const before = JSON.stringify(data);
  for (const [id, low, high] of cases) {
    const m = data.models.find((m) => m.id === id),
      result = Estimates.getDeployment(data, m, Speech.selectSize(data, id));
    assert.equal(result.speed.status, 'assumed');
    assert.equal(result.speed.proxy, true);
    assert.deepEqual([result.speed.low, result.speed.high], [low, high]);
    assert.ok(result.speed.lineage.sources.length >= 2);
    assert.match(result.speed.lineage.note, /unverified/);
    assert.equal(result.cost.high, 1 / low);
    assert.equal(result.speed.records.length, 2);
    const html = Speech.renderRows(
      {
        ...Speech.build(data, { compact: true }),
        rows: Speech.build(data).rows.filter((r) => r.id === id)
      },
      data
    );
    assert.match(html, /Deployment lineage/);
    assert.match(html, /Official model card/);
    assert.equal(Estimates.getDeployment(data, { ...m, id: 'unreviewed-copy' }, null), null);
    assert.equal(
      Estimates.getDeployment(data, { ...m, hub_id: m.hub_id + '-fine-tuned' }, null),
      null
    );
  }
  assert.equal(JSON.stringify(data), before);
  const noLineages = structuredClone(data);
  for (const m of noLineages.models)
    if (cases.some(([id]) => id === m.id)) m.hub_id += '-unreviewed';
  const rank = (r) => r.rows.map((x) => [x.id, x.benchmarkRank, x.benchmarkValue]);
  assert.deepEqual(rank(Speech.build(data)), rank(Speech.build(noLineages)));
});
