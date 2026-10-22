(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const controls = {test:$('speechProtocol'),rankMetric:$('speechRankMetric'),query:$('speechSearch'),sort:$('speechSort'),maxDownload:$('speechSize'),
    maxParams:$('speechParams'),access:$('speechAccess'),min:$('speechCoverage'),extra:$('speechExtra')};
  const panels = {matrix:$('speechMatrixPanel'),throughput:$('speechThroughputPanel'),latency:$('speechLatencyPanel'),price:$('speechPricingPanel')};
  const history = document.querySelector('.history-bar');
  const start = history.dataset.releaseStart, end = history.dataset.snapshotDate;
  const day = value => Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/864e5);
  const date = value => new Date(Date.parse(start+'T00:00:00Z')+value*864e5).toISOString().slice(0,10);
  const protocolViews = {english:'open-asr-english-2026-10-17',longform:'open-asr-longform',multilingual:'open-asr-fleurs',robustness:'open-asr-robustness'};
  let data, view='english', timer, metricProtocol;
  function render() {
    if (!data) return;
    const cutoff = date(Number($('historyRange').value));
    $('historyDate').textContent = cutoff;
    const protocol = view === 'benchmark' || Boolean(protocolViews[view]);
    if (metricProtocol !== controls.test.value) {
      const selected = data.accuracyTests.find(test => test.id === controls.test.value);
      controls.rankMetric.innerHTML = '<option value="">Complete panel / headline metric</option>'+selected.metrics.map(metric => `<option value="${BenchmarkSpeech.escape(metric.id)}">${BenchmarkSpeech.escape(metric.label)}</option>`).join('');
      controls.rankMetric.value=''; metricProtocol=controls.test.value;
    }
    $('speechBenchmarkNote').hidden = !protocol;
    $('speechAccuracyTitle').hidden = !protocol;
    const scoreOption=Array.from(controls.sort.options || []).find(option=>option.value==='score');
    if (scoreOption) scoreOption.textContent=protocol ? 'Best accuracy first' : 'Highest cross-family index';
    for (const option of controls.sort.options || []) if (option.value.startsWith('wer:')) {option.hidden=protocol;option.disabled=protocol;}
    if (protocol && controls.sort.value.startsWith('wer:')) controls.sort.value='score';
    controls.min.hidden = protocol;
    $('speechComparability').hidden = protocol;
    $('speechProtocolControls').hidden = !protocol;
    const options = {cutoff,view,test:controls.test.value,query:controls.query.value,sort:controls.sort.value,
      maxDownload:controls.maxDownload.value,maxParams:controls.maxParams.value,access:controls.access.value,min:controls.min.value,
      extra:controls.extra.checked,compact:!controls.extra.checked,rankMetric:controls.rankMetric.value};
    const result = protocol ? BenchmarkSpeech.build(data,options) : BenchmarkSpeechMatrix.build(data,options);
    $('speechHead').innerHTML = protocol ? BenchmarkSpeech.renderHead(result) : BenchmarkSpeechMatrix.renderHead(result);
    $('speechBody').innerHTML = protocol ? BenchmarkSpeech.renderRows(result,data) : BenchmarkSpeechMatrix.renderRows(result,data);
    $('speechUnscored').hidden = !protocol;
    if (protocol) {
      $('speechUnscoredSummary').textContent=`${result.unscoredRows.length} configurations without a matched score — not ranked`;
      $('speechUnscoredList').innerHTML=BenchmarkSpeech.renderUnscored(result,data);
      const isEnglish=result.test.id===data.config.default_test && !result.rankMetric;
      $('speechAccuracyTitle').textContent=isEnglish ? 'English accuracy — seven-set mean WER' : `${result.test.label} — ${result.rankMetric?.label || 'benchmark accuracy'}`;
      $('speechBenchmarkNote').textContent=(!['score','mean'].includes(controls.sort.value)) ? 'Sorted by your selected field. Accuracy ranks still use only error scores.' : isEnglish ? 'English accuracy. Lower word error is better.' : 'Benchmark accuracy. Lower word error is better.';
    }
    $('speechProtocolNote').textContent = protocol ? result.test.note : view === 'small'
      ? 'Models with a reported download ≤1,000 MB or ≤1,000 M parameters. Secondary and one-family measurements remain visible; they cannot manufacture an aggregate index. Original and GGUF configurations stay separate.'
      : view === 'new' ? 'Author and competitor research, including the original Phonon models and Moonshine paper. Alternate protocols do not add another core family.'
      : view === 'secondary' ? 'Alternate corpora, language details and runtime protocols are preserved as secondary evidence; they do not add aggregate votes.'
      : data.config.ranking_note;
    const otherSort = {name:'Model name',download:'Download size (MB), unknowns last',params:'Parameters (M), unknowns last',price:'USD / audio hour, unknowns last'}[controls.sort.value];
    const ordering = otherSort || (protocol ? 'Accuracy, lower error is better; missing scores listed separately'
      : result.sortTest ? (result.sortTest.short || result.sortTest.label)+' WER, lower is better; missing scores last'
      : 'Overall index first; models without an index follow (not a performance ranking)');
    $('speechStatus').textContent = protocol ? `${result.rows.filter(row=>row.benchmarkRank).length} models${result.rankMetric ? ' · '+result.rankMetric.label : ''} · ${otherSort || 'best accuracy first'}`
      : `${result.rows.length} models · ${result.matureCount} mature core families · Sort: ${ordering}`;
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
    if (!data) return;
    const previous = view;
    $('speechView').value=next;
    view = next;
    if (view === 'small') controls.sort.value='wer:'+data.config.default_test;
    else if (previous === 'small' || view === 'benchmark' || protocolViews[view]) controls.sort.value='score';
    const panel = ['throughput','latency','price'].includes(view) ? view : 'matrix';
    for (const [name,element] of Object.entries(panels)) element.hidden = name !== panel;
    document.querySelectorAll('.views button').forEach(button => {
      button.classList.toggle('active',button.dataset.view === view);
      button.setAttribute('aria-pressed',String(button.dataset.view === view));
    });
    if (protocolViews[view]) {controls.test.value = protocolViews[view];controls.rankMetric.value='';}
    if (panel === 'throughput') renderTiming();
    else if (panel === 'matrix') render();
  }
  for (const [name,control] of Object.entries(controls)) control.addEventListener(name === 'query' ? 'input' : 'change', () => {
    if (name === 'test') {controls.rankMetric.value='';setView('benchmark');return;}
    if (name === 'query') {clearTimeout(timer); timer=setTimeout(render,100);} else render();
  });
  $('speechView').addEventListener('change',()=>setView($('speechView').value));
  const openBenchmark=event => {
    const button=event.target.closest('[data-benchmark]');
    if (!button || !data) return;
    controls.test.value=button.dataset.benchmark;
    controls.query.value=button.dataset.model || '';
    controls.maxDownload.value='';controls.maxParams.value='';controls.access.value='all';
    setView('benchmark');
    if (button.dataset.metric) {controls.rankMetric.value=button.dataset.metric;render();}
  };
  $('speechBody').addEventListener('click',openBenchmark);
  $('speechUnscoredList').addEventListener('click',openBenchmark);
  $('speechReset').addEventListener('click',()=>{
    controls.query.value='';controls.maxDownload.value='';controls.maxParams.value='';controls.access.value='all';
    controls.extra.checked=false;controls.rankMetric.value='';controls.min.value='2';controls.sort.value='score';
    $('historyRange').value=day(end);$('speechUnscored').open=false;$('speechMore').open=false;setView('english');
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
  fetch('/stt/data.json',{cache:'no-cache'}).then(response => {if (!response.ok) throw Error('HTTP '+response.status);return response.json();})
    .then(result => {data=result;const requested=typeof location!=='undefined' ? location.hash.slice(1) : '';if (['english','benchmark','matrix','longform','multilingual','robustness','small','new','secondary','throughput','latency','price'].includes(requested)) setView(requested);else render();}).catch(error => {
      $('speechStatus').textContent='Static snapshot available · interactive filters unavailable';
      for (const control of Object.values(controls)) control.disabled=true;
      console.warn('Speech data load',error);
    });
})();
