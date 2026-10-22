const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {loadSTT} = require('../lib/load-stt.cjs');
const {loadOCR} = require('../lib/load.cjs');
const {validateSTT} = require('../lib/validate-stt.cjs');
const Speech = require('../src/assets/js/speech.js');
const Matrix = require('../src/assets/js/speech-matrix.js');
const BenchmarkRank = require('../lib/ranking.cjs');
const data = loadSTT();
const official = data.config.default_test;
const launch = 'phonon-2-launch-english';
const row = (result, id='phonon-2') => result.rows.find(row => row.id === id);

function csvRows(text) {
  const rows=[]; let record=[],field='',quoted=false;
  for (let i=0;i<text.length;i++) {
    const char=text[i];
    if (char==='"') {
      if (quoted && text[i+1]==='"') {field+='"';i++;} else quoted=!quoted;
    } else if (char===',' && !quoted) {record.push(field);field='';}
    else if (char==='\n' && !quoted) {record.push(field.replace(/\r$/,''));rows.push(record);record=[];field='';}
    else field+=char;
  }
  if (field || record.length) {record.push(field);rows.push(record);}
  const header=rows.shift();
  return rows.map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]||''])));
}

test('speech rows reproduce the pinned CSV per dataset without importing its changing average', () => {
  validateSTT(data);
  const rows = csvRows(fs.readFileSync(require.resolve('../data/stt/evidence/open-asr-2026-10-17.csv'), 'utf8'));
  const protocol = data.accuracyTests.find(test => test.id === official);
  for (const observation of data.rawRecords.filter(record => record.benchmark === official)) {
    const values = rows.find(row => row.model === observation.source_model);
    for (const metric of protocol.metrics) {
      const original = values[metric.source_column];
      assert.equal(observation.metrics[metric.id], original ? Number(original) : null, observation.model + ':' + metric.id);
    }
    assert.equal(observation.metrics.avg, undefined);
    assert.equal(observation.metrics.published_mean_wer, undefined);
    assert.equal(observation.measurement_operator, observation.source_model === 'OtterAI/speech-v3.1' ? 'OtterAI contributor (public scores)' : 'unspecified');
  }
  assert.equal(data.rawRecords.filter(record => record.benchmark === official).length, 64);
});

test('maintainer and launch observations stay separate and never become two ranking families', () => {
  const current = Speech.build(data);
  const original = Speech.build(data, {test:launch});
  assert.equal(row(current).scores.ami.value, 9.32);
  assert.equal(row(original).scores.ami.value, 9.37);
  assert.equal(row(current).scores.ls_clean.value, 1.73);
  assert.equal(row(original).scores.ls_clean.value, 1.72);
  assert.equal(row(current, 'parakeet-tdt-0-6b-v3').scores.voxpopuli.value, 3.05);
  assert.equal(row(original, 'parakeet-tdt-0-6b-v3').scores.voxpopuli.value, 3.19);
  assert.equal(row(original).mean, 5.21);
  assert.equal(row(original).meanBasis, 'published');
  assert.ok(Math.abs(row(current).mean - 36.44 / 7) < 1e-10);
  assert.equal(row(current).meanBasis, 'derived');
  assert.ok([...current.rows, ...original.rows].every(row => row.rank === null && row.familyCount === 1));
  assert.equal(data.accuracyTests.find(test => test.id === official).family,data.accuracyTests.find(test => test.id === launch).family);
  assert.deepEqual(data.tests.filter(test=>test.core).map(test=>test.id).sort(),['open-asr-english-2026-10-17','open-asr-fleurs','open-asr-longform']);
  assert.equal(row(current, 'phonon-1'), undefined);
  assert.equal(row(Speech.build(data, {missing:true}), 'phonon-1').mean, null);
});

test('launch operators distinguish author, competitor and copied leaderboard rows', () => {
  const result = Speech.build(data, {test:launch});
  assert.equal(Speech.evidenceLabel(row(result).provenance), 'Author run');
  assert.equal(Speech.evidenceLabel(row(result, 'parakeet-redux').provenance), 'Competitor run');
  assert.equal(Speech.evidenceLabel(row(result, 'canary-180m-flash').provenance), 'Quoted leaderboard row');
  const html = Speech.renderRows(Speech.build(data), data);
  assert.match(html, /Maintainer publication/);
  assert.match(html, /Measurement operator: unspecified/);
  assert.match(html, /popovertarget="speech-evidence-/);
  assert.match(html, /aria-label="Evidence and qualifications for Phonon-2"/);
  assert.match(html, /publication is not proof of independent reproduction/i);
  assert.doesNotMatch(html, /independently reproduced/);
});

test('adding noise/accent columns and filtering models cannot change the fixed seven-set mean', () => {
  const standard = Speech.build(data);
  const expanded = Speech.build(data, {extra:true, query:'phonon'});
  assert.equal(standard.columns.length, 7);
  assert.equal(expanded.columns.length, 10);
  assert.equal(expanded.rows.length, 1);
  assert.equal(row(standard).mean, row(expanded).mean);
  assert.equal(row(expanded).scores.urgent24.value, 14.9);
  assert.equal(row(expanded).scores.monsoon.value, 4.91);
  assert.equal(row(expanded).scores.urgent24_clean.value, 7.67);
});

test('size budgets use observed download MB, leaving parameters, estimates and RAM distinct', () => {
  assert.deepEqual(Speech.build(data, {maxDownload:200}).rows.map(row => row.id), ['phonon-2','niagara-9m-batch-en']);
  assert.deepEqual(Speech.build(data, {test:launch, maxDownload:200}).rows.map(row => row.id), ['phonon-2','parakeet-redux']);
  assert.equal(Speech.selectSize(data, 'niagara-9m-batch-en').parameters_million, 9);
  assert.equal(Speech.selectSize(data, 'niagara-9m-batch-en').download_mb, 139.58092);
  assert.equal(Speech.selectSize(data, 'voxtral-mini-4b-realtime-2602').parameters_million, 4429.67936);
  const altered = structuredClone(data);
  altered.sizes.push({model:'qwen3-asr-0-6b-hf', download_mb:1, status:'assumed', as_of:'2026-10-19'});
  assert.equal(Speech.selectSize(altered, 'qwen3-asr-0-6b-hf').download_mb, 1564.928088);
  assert.equal(row(Speech.build(altered, {maxDownload:200}), 'qwen3-asr-0-6b-hf'), undefined);
});

test('source preference preserves alternatives and forbids mixed-source or incomplete means', () => {
  const altered = structuredClone(data);
  const key = 'phonon-2|' + official + ':ami';
  const original = altered.resultsByKey[key][0];
  altered.resultsByKey[key].push({...original, source_id:'fermion-phonon-2-launch', value:99, evidence:'author_reported'});
  assert.equal(row(Speech.build(altered)).scores.ami.value, 9.32);
  assert.match(Speech.renderRows(Speech.build(altered), altered), /Other observations: 99%/);
  // A lower-preference source can fill a cell, but not silently blend a mean.
  original.value = null;
  assert.equal(row(Speech.build(altered)).scores.ami.value, 99);
  assert.equal(row(Speech.build(altered)).mean, null);
  altered.resultsByKey[key].pop();
  assert.equal(row(Speech.build(altered)).scores.ami, null);
  assert.equal(row(Speech.build(altered)).mean, null);
});

test('assumed scores never select or count, while true zero WER and WER over 100 remain valid', () => {
  const altered = structuredClone(data);
  const key = 'phonon-2|' + official + ':ami';
  altered.resultsByKey[key][0].status = 'assumed';
  assert.equal(row(Speech.build(altered)).scores.ami, null);
  assert.equal(row(Speech.build(altered)).mean, null);
  assert.equal(row(Speech.build(altered)).count, 6);
  altered.resultsByKey[key][0].status = 'observed';
  altered.resultsByKey[key][0].value = 0;
  assert.equal(row(Speech.build(altered)).scores.ami.value, 0);
  assert.notEqual(row(Speech.build(altered)).mean, null);
  const raw = altered.rawRecords.find(record => record.model === 'phonon-2' && record.benchmark === official);
  raw.metrics.ami = 125;
  validateSTT(altered);
  raw.metrics.ami = -1;
  assert.throws(() => validateSTT(altered), /invalid speech WER/);
});

test('incomparable and internal observations cannot create comparable coverage or a mean', () => {
  for (const change of [{comparable:false}, {evidence:'vendor_internal'}]) {
    const altered = structuredClone(data);
    for (const key of Object.keys(altered.resultsByKey).filter(key => key.startsWith('phonon-2|' + official + ':'))) {
      Object.assign(altered.resultsByKey[key][0], change);
    }
    const result = row(Speech.build(altered, {missing:true}));
    assert.equal(result.count, 0);
    assert.equal(result.familyCount, 0);
    assert.equal(result.mean, null);
    assert.equal(result.rank, null);
  }
});

test('throughput retains workload, runtime and batch distinctions and never supplies accuracy', () => {
  const speed = data.throughput.filter(record => record.model === 'phonon-2');
  assert.equal(speed.find(record => record.hardware === 'NVIDIA H100 80 GB' && record.batch_size === 1).rtfx, 465);
  assert.equal(speed.find(record => record.hardware === 'NVIDIA H100 80 GB' && record.batch_size === 128).rtfx, 6680);
  assert.equal(speed.find(record => record.runtime === 'MLX, Apple GPU').test_id, 'fermion-20-dictations');
  assert.ok(data.throughput.every(record => !record.load_time_included && record.feature_extraction_included));
  assert.equal(data.rawRecords.some(record => record.benchmark === 'fermion-20-dictations'), false);
  const altered = structuredClone(data);
  delete altered.throughput[0].hardware;
  assert.throws(() => validateSTT(altered), /missing speech hardware/);
});

test('new speech identities remain outside OCR cohorts and unknown release dates remain null', () => {
  const ocr = loadOCR();
  assert.equal(ocr.models.length, 177);
  assert.equal(ocr.records.length, 381);
  assert.equal(ocr.models.some(model => model.topics?.includes('stt')), false);
  assert.equal(BenchmarkRank.build(ocr, ocr.config.snapshot_date, {min:0}).rows.some(row => row.id === 'phonon-2'), false);
  assert.equal(data.models.find(model => model.id === 'phonon-2').release_date, '2026-09-29');
  assert.equal(data.models.find(model => model.id === 'qwen3-asr-0-6b-hf').release_date, null);
});

test('speech UI switches its single benchmark selector and applies a download budget', async () => {
  const elements = {};
  const defaults={speechProtocol:official,speechAccess:'all',timingTest:'fermion-20-dictations'};
  const removed=new Set(['speechView','speechSort','speechRankMetric','speechExtra','speechCoverage']);
  const element = id => {assert.ok(!removed.has(id),'removed control '+id+' must not be requested');return elements[id] ??= {value:defaults[id] || '',checked:false, handlers:{}, dataset:{},classList:{toggle(){}},setAttribute(){},addEventListener(event, handler) {this.handlers[event] = handler;}};};
  const document = {getElementById:element,querySelector:()=>({dataset:{releaseStart:data.config.release_start,snapshotDate:data.config.snapshot_date}}),querySelectorAll:()=>[]};
  const context = {document, BenchmarkSpeech:Speech,BenchmarkSpeechMatrix:Matrix,fetch:async () => ({ok:true, json:async () => data}), console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/assets/js/speech-page.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(element('speechStatus').textContent, /64 ranked/);
  assert.equal((element('speechHead').innerHTML.match(/<th /g)||[]).length,6);
  assert.match(element('speechHead').innerHTML,/Rank/);
  assert.match(element('speechHead').innerHTML, /Error %/);
  assert.match(element('speechBody').innerHTML, /e85ed601d17ab0e008721a19fc9cba36b4ee9c9c/);
  element('speechProtocol').value = launch;
  element('speechProtocol').handlers.change();
  assert.match(element('speechStatus').textContent, /^8 ranked/);
  assert.match(element('speechBody').innerHTML, /Quoted leaderboard row/);
  assert.match(element('speechProtocolNote').textContent, /same evidence family/);
  element('speechSize').value = '200';
  element('speechSize').handlers.change();
  assert.match(element('speechStatus').textContent, /^2 ranked/);
  assert.match(element('speechBody').innerHTML, /Phonon-2/);
  assert.match(element('speechBody').innerHTML, /Parakeet Redux/);
  assert.doesNotMatch(element('speechBody').innerHTML, /Canary 180M/);
  assert.match(element('speechHead').innerHTML,/M5 speed ×/);
  assert.match(element('speechHead').innerHTML,/\$\/audio hr/);
  assert.doesNotMatch(element('speechHead').innerHTML,/Download|Parameters/);
});

test('speech rendering escapes model and source text', () => {
  const altered = structuredClone(data);
  altered.models.find(model => model.id === 'phonon-2').name = '<img src=x onerror=alert(1)>';
  const html = Speech.renderRows(Speech.build(altered, {query:'phonon'}), altered);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
