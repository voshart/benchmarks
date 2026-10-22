(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const controls={test:$('speechProtocol'),query:$('speechSearch'),access:$('speechAccess'),maxDownload:$('speechSize'),maxParams:$('speechParams')};
  const historyBar=document.querySelector('.history-bar');
  const start=historyBar.dataset.releaseStart,end=historyBar.dataset.snapshotDate;
  const day=value=>Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/864e5);
  const date=value=>new Date(Date.parse(start+'T00:00:00Z')+value*864e5).toISOString().slice(0,10);
  let data,timer,sort='score',sortDirection='asc';
  function render() {
    if(!data) return;
    const [test,rankMetric]=controls.test.value.split('::');
    const cutoff=date(Number($('historyRange').value));
    const result=BenchmarkSpeech.build(data,{test,rankMetric,compact:true,cutoff,sort,sortDirection,query:controls.query.value,access:controls.access.value,maxDownload:controls.maxDownload.value,maxParams:controls.maxParams.value});
    $('speechHead').innerHTML=BenchmarkSpeech.renderHead(result);
    $('speechUnscoredHead').innerHTML=BenchmarkSpeech.renderHead(result);
    $('speechBody').innerHTML=BenchmarkSpeech.renderRows(result,data);
    $('speechUnscoredList').innerHTML=BenchmarkSpeech.renderUnscored(result,data);
    $('speechUnscoredSummary').textContent=`${result.unscoredRows.length} configurations without a matched accuracy score`;
    $('speechBenchmarkNote').textContent='Lower error and price. Higher speed.';
    $('speechProtocolNote').textContent=result.test.note;
    $('speechSpeedNote').textContent=(result.speedLabel.startsWith('M4') ? 'Speed: M4 Max, JFK clip, community-run.' : 'Speed: M5, 20 dictations, vendor-run.')+' Price: published USD/audio-hour; mode and tier in Details.';
    const labels={rank:'quality rank',score:'error',name:'model name',speed:result.speedLabel,price:'USD/audio hour'};
    $('speechStatus').textContent=`${result.rows.filter(row=>row.benchmarkRank).length} ranked · ${sort==='score' && sortDirection==='asc' ? 'best accuracy first' : labels[sort]+' '+(sortDirection==='asc' ? '↑' : '↓')} · ${result.speedCount} speed results · ${result.priceCount} USD rates`;
    $('historyDate').textContent=cutoff;
    const undated=data.models.filter(model=>!model.release_date).length;
    $('historyStatus').textContent=cutoff===end ? `${undated} undated configurations included only in the current snapshot` : `${undated} undated configurations excluded · availability cutoff, not evaluation date`;
  }
  function resetSort(){sort='score';sortDirection='asc';}
  for(const [key,control] of Object.entries(controls)) control.addEventListener(key==='query' ? 'input' : 'change',()=>{
    if(key==='test') resetSort();
    if(key==='query'){clearTimeout(timer);timer=setTimeout(render,100);} else render();
  });
  const sortColumn=event=>{
    const button=event.target.closest('[data-sort-key]');
    if(!button || !['rank','name','score','speed','price'].includes(button.dataset.sortKey)) return;
    if(sort===button.dataset.sortKey) sortDirection=sortDirection==='asc' ? 'desc' : 'asc';
    else {sort=button.dataset.sortKey;sortDirection=sort==='speed' ? 'desc' : 'asc';}
    render();
    // Re-rendered buttons retain keyboard focus after activation.
    const head=event.currentTarget;
    if(head?.querySelector) head.querySelector(`[data-sort-key="${sort}"]`)?.focus();
  };
  $('speechHead').addEventListener('click',sortColumn);
  $('speechUnscoredHead').addEventListener('click',sortColumn);
  const openBenchmark=event=>{
    const button=event.target.closest('[data-benchmark]');
    if(!button || !data) return;
    controls.test.value=button.dataset.benchmark+(button.dataset.metric ? '::'+button.dataset.metric : '');
    controls.query.value=button.dataset.model || '';
    controls.maxDownload.value='';controls.maxParams.value='';controls.access.value='all';
    resetSort();render();
  };
  $('speechBody').addEventListener('click',openBenchmark);
  $('speechUnscoredList').addEventListener('click',openBenchmark);
  $('speechReset').addEventListener('click',()=>{
    if(!data) return;
    controls.test.value=data.config.default_test;controls.query.value='';controls.access.value='all';controls.maxDownload.value='';controls.maxParams.value='';
    $('historyRange').value=day(end);$('speechUnscored').open=false;$('speechMore').open=false;
    if(typeof location!=='undefined') globalThis.history?.replaceState(null,'',location.pathname+location.search);
    resetSort();render();
  });
  $('historyRange').max=day(end);$('historyRange').value=day(end);
  $('historyRange').addEventListener('input',render);
  $('historyRange').addEventListener('change',()=>{
    if(!data) return;
    const dates=[0,day(end),...data.models.map(model=>model.release_date ? day(model.release_date) : null).filter(value=>value!=null && value>=0 && value<=day(end))];
    const current=Number($('historyRange').value);
    $('historyRange').value=dates.reduce((a,b)=>Math.abs(a-current)<=Math.abs(b-current) ? a : b);render();
  });
  $('historyLatest').addEventListener('click',()=>{$('historyRange').value=day(end);render();});
  $('themeToggle').addEventListener('click',()=>{
    const root=document.documentElement;root.dataset.theme=root.dataset.theme==='dark' ? 'light' : 'dark';
    try{localStorage.setItem('bench-theme',root.dataset.theme);}catch(_){}
  });
  fetch('/stt/data.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();}).then(result=>{
    data=result;
    const requested=typeof location!=='undefined' ? location.hash.slice(1) : '';
    const legacy={longform:'open-asr-longform',multilingual:'open-asr-fleurs',robustness:'open-asr-robustness'};
    const [testId,metricId]=requested.split('::');
    const selectedTest=data.accuracyTests.find(test=>test.id===testId);
    const validMetric=selectedTest?.metrics.some(metric=>metric.id===metricId && metric.id!==selectedTest.summary_metric && metric.id!==selectedTest.published_mean_metric);
    const selection=legacy[requested] || (selectedTest ? testId+(validMetric ? '::'+metricId : '') : data.config.default_test);
    controls.test.value=selection;render();
  }).catch(error=>{
    $('speechStatus').textContent='Static snapshot available · interactive controls unavailable';
    for(const control of Object.values(controls)) control.disabled=true;
    console.warn('Speech data load',error);
  });
})();
