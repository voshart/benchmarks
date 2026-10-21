(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const controls = {test:$('speechProtocol'),query:$('speechSearch'),sort:$('speechSort'),maxDownload:$('speechSize'),
    maxParams:$('speechParams'),access:$('speechAccess'),min:$('speechCoverage'),missing:$('speechMissing'),extra:$('speechExtra')};
  const panels = {matrix:$('speechMatrixPanel'),throughput:$('speechThroughputPanel'),latency:$('speechLatencyPanel'),price:$('speechPricingPanel')};
  const history = document.querySelector('.history-bar');
  const start = history.dataset.releaseStart, end = history.dataset.snapshotDate;
  const day = value => Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/864e5);
  const date = value => new Date(Date.parse(start+'T00:00:00Z')+value*864e5).toISOString().slice(0,10);
  const protocolViews = {english:'open-asr-english-2026-10-17',longform:'open-asr-longform',multilingual:'open-asr-fleurs',robustness:'open-asr-robustness'};
  let data, view='matrix', timer;
  function render() {
    if (!data) return;
    const cutoff = date(Number($('historyRange').value));
    $('historyDate').textContent = cutoff;
    const protocol = Boolean(protocolViews[view]);
    controls.min.hidden = protocol;
    $('speechProtocolControls').hidden = !protocol;
    const options = {cutoff,view,test:controls.test.value,query:controls.query.value,sort:controls.sort.value,
      maxDownload:controls.maxDownload.value,maxParams:controls.maxParams.value,access:controls.access.value,min:controls.min.value,
      missing:controls.missing.checked,extra:controls.extra.checked};
    const result = protocol ? BenchmarkSpeech.build(data,options) : BenchmarkSpeechMatrix.build(data,options);
    $('speechHead').innerHTML = protocol ? BenchmarkSpeech.renderHead(result) : BenchmarkSpeechMatrix.renderHead(result);
    $('speechBody').innerHTML = protocol ? BenchmarkSpeech.renderRows(result,data) : BenchmarkSpeechMatrix.renderRows(result,data);
    $('speechProtocolNote').textContent = protocol ? result.test.note : view === 'small'
      ? 'Models with a reported download ≤1,000 MB or ≤1B parameters. Secondary and one-family measurements remain visible; they cannot manufacture an aggregate index. Original and GGUF configurations stay separate.'
      : view === 'new' ? 'Author and competitor research, including the original Phonon models and Moonshine paper. Alternate protocols do not add another core family.'
      : view === 'secondary' ? 'Alternate corpora, language details and runtime protocols are preserved as secondary evidence; they do not add aggregate votes.'
      : data.config.ranking_note;
    $('speechStatus').textContent = protocol ? `${result.rows.length} models · ${result.test.metrics.every(metric=>metric.unit==='oiwer_percent') ? 'OI-WER' : 'WER'} %, lower is better · ${result.test.label}`
      : `${result.rows.length} models · ${result.matureCount} mature core families · index higher is better; WER lower is better`;
    const undated = data.models.filter(model => !model.release_date).length;
    $('historyStatus').textContent = cutoff === end ? `${undated} undated configurations included only in the current view · rates retain their pricing dates`
      : `${undated} undated configurations excluded · model availability cutoff, not the date results were published`;
  }
  function renderTiming() {
    if (!data) return;
    const rows = BenchmarkSpeechMatrix.timingRows(data,{test:$('timingTest').value,hardware:$('timingHardware').value,sample:$('timingSample').value,query:$('timingSearch').value});
    $('timingBody').innerHTML = BenchmarkSpeechMatrix.renderTiming(rows,data);
    $('timingStatus').textContent = `${rows.length} measurements · exact workload, hardware and runtime per row`;
  }
  function setView(next) {
    view = next;
    const panel = ['throughput','latency','price'].includes(view) ? view : 'matrix';
    for (const [name,element] of Object.entries(panels)) element.hidden = name !== panel;
    document.querySelectorAll('.views button').forEach(button => {
      button.classList.toggle('active',button.dataset.view === view);
      button.setAttribute('aria-pressed',String(button.dataset.view === view));
    });
    if (protocolViews[view]) controls.test.value = protocolViews[view];
    if (panel === 'throughput') renderTiming();
    else if (panel === 'matrix') render();
  }
  for (const [name,control] of Object.entries(controls)) control.addEventListener(name === 'query' ? 'input' : 'change', () => {
    if (name === 'query') {clearTimeout(timer); timer=setTimeout(render,100);} else render();
  });
  document.querySelectorAll('.views button').forEach(button => button.addEventListener('click',() => setView(button.dataset.view)));
  for (const id of ['timingTest','timingHardware','timingSample','timingSearch']) $(id).addEventListener(id === 'timingSearch' ? 'input' : 'change',renderTiming);
  $('historyRange').max = day(end); $('historyRange').value = day(end);
  $('historyRange').addEventListener('input',render);
  $('historyRange').addEventListener('change',() => {
    if (!data) return;
    const dates=[0,day(end),...data.models.map(model => model.release_date ? day(model.release_date) : null).filter(value => value != null && value >= 0 && value <= day(end))];
    const current=Number($('historyRange').value);
    $('historyRange').value=dates.reduce((a,b) => Math.abs(a-current) <= Math.abs(b-current) ? a : b);
    render();
  });
  $('historyLatest').addEventListener('click',() => {$('historyRange').value=day(end);render();});
  $('themeToggle').addEventListener('click',() => {
    const root=document.documentElement; root.dataset.theme=root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {localStorage.setItem('bench-theme',root.dataset.theme);} catch (_) {}
  });
  fetch('/stt/data.json').then(response => {if (!response.ok) throw Error('HTTP '+response.status);return response.json();})
    .then(result => {data=result;render();}).catch(error => {
      $('speechStatus').textContent='Static snapshot available · interactive filters unavailable';
      for (const control of Object.values(controls)) control.disabled=true;
      console.warn('Speech data load',error);
    });
})();
