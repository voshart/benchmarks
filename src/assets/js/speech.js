/* Speech evidence selection and rendering, shared by Eleventy and the browser. */
(function(root, make) {
  const api = make(typeof module === 'object' && module.exports ? require('./ranking.js') : root.BenchmarkRank, typeof module === 'object' && module.exports ? require('./speech-estimates.js') : root.BenchmarkSpeechEstimates);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkSpeech = api;
})(globalThis, (Rank, Estimates) => {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const observed = record => record && record.status !== 'assumed' && record.evidence !== 'assumed';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link = (source, label, title='') => source && /^https?:\/\//.test(source.url)
    ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</a>` : esc(label);
  const priceAmount = value => value.toLocaleString('en-US',{maximumFractionDigits:4});
  const evidenceLabel = record => !record ? 'No matched result' : ({official:'Maintainer publication', third_party:'Third-party run',
    community:'Community record', author_reported:'Author run', vendor_comparison:'Competitor run', secondary:'Quoted leaderboard row'})[record.evidence] || 'Qualified evidence';

  function selectSize(data, model) {
    const records = data.sizes.filter(record => record.model === model && observed(record))
      .slice().sort((a,b) => (a.selection_priority || 0) - (b.selection_priority || 0) || b.as_of.localeCompare(a.as_of));
    if (!records.length) return null;
    // A source may report only one quantity. Select each independently without
    // making the other disappear, and keep its own source and precision.
    const field_records = Object.fromEntries(['download_mb','parameters_million'].map(field =>
      [field, records.find(record => finite(record[field])) || null]));
    return {...records[0],
      download_mb:field_records.download_mb?.download_mb,
      download_bytes:field_records.download_mb?.download_bytes,
      parameters_million:field_records.parameters_million?.parameters_million,
      field_records};
  }

  function available(model, cutoff, snapshot) {
    return model.release_date ? model.release_date <= cutoff : cutoff >= snapshot;
  }

  function summarize(data, test, model) {
    const scores = Object.fromEntries(test.metrics.map(metric => [metric.id, Rank.choose(data, model, test.id + ':' + metric.id, true)]));
    const keys = test.summary_metric ? [test.summary_metric] : test.published_mean_metric
      ? test.metrics.filter(metric => metric.primary).map(metric => metric.id) : test.mean_metrics;
    const selected = keys.map(key => scores[key]);
    const complete = keys.length > 0 && selected.every(Rank.rankable);
    const sourceIds = new Set(selected.filter(Boolean).map(record => record.source_id));
    const matchedSources = test.component_sources
      ? keys.every(key => scores[key]?.source_id === test.metrics.find(metric => metric.id === key)?.source_id)
      : sourceIds.size === 1;
    let mean = null, meanBasis = null;
    if (complete && matchedSources) {
      if (test.published_mean_metric) {
        const record = Rank.choose(data, model, test.id + ':' + test.published_mean_metric, true);
        if (Rank.rankable(record) && sourceIds.has(record.source_id)) {mean = record.value; meanBasis = 'published';}
      } else {
        mean = selected.reduce((sum,record) => sum + record.value, 0) / selected.length;
        meanBasis = test.summary_metric ? 'published' : 'derived';
      }
    }
    const count = test.metrics.filter(metric => metric.primary && Rank.rankable(scores[metric.id])).length;
    const conflicts = keys.filter(key => scores[key] && (data.resultsByKey[model+'|'+test.id+':'+key] || [])
      .some(other => Rank.rankable(other) && other.value !== scores[key].value));
    const provenance = selected.find(Boolean) || Object.values(scores).find(Boolean) || null;
    let summary = null;
    if (mean != null) {
      const unclear = selected.some(record => /^unspecified/i.test(record.measurement_operator || '') || !record.measurement_operator);
      const qualified = selected.find(record => Rank.qualification(record));
      summary = {...provenance, value:mean, derived:meanBasis === 'derived', source_ids:[...sourceIds],
        evidence:qualified?.evidence || (unclear ? 'research' : provenance.evidence),
        publication_evidence:provenance.evidence,
        components:keys.map(key => ({metric:key, label:test.metrics.find(metric => metric.id === key).short,
          source_id:scores[key].source_id, value:scores[key].value, evidence:scores[key].evidence, measurement_operator:scores[key].measurement_operator})),
        provisional_reasons:conflicts.length ? [`Published observations disagree within ${test.label}: ${conflicts.join(', ')}; preferred sources are selected and alternatives preserved.`] : [],
        note:[test.note, provenance.note].filter(Boolean).join(' ')};
    }
    return {scores, count, mean, meanBasis, provenance, summary, conflicts};
  }

  function selectPrice(data, model) {
    return (data.pricing || []).filter(record => record.model === model && record.comparison_default !== false && record.verification_status === 'verified')
      .slice().sort((a,b) => b.as_of.localeCompare(a.as_of))[0] || null;
  }

  function priceInfo(data, model) {
    const selected = selectPrice(data, model.id);
    if (selected) return {record:selected, label:selected.currency === 'USD' ? (selected.approximate ? '≈$' : '$')
      + priceAmount(selected.amount) + '†' : '—', source_id:selected.source_id,
      note:[selected.provider,selected.mode,selected.tier,'as of '+selected.as_of,selected.note].join(' · ')};
    const context = (data.pricingContexts || []).find(record => record.model === model.id);
    if (context) return {label:context.label, note:context.note};
    const tokens = (data.tokenPricing || []).find(record => record.model === model.id);
    if (tokens) return {label:'Token-priced†',source_id:tokens.source_id,note:'Current service token tariff; see Pricing. No audio-hour workload cost is inferred.'};
    return {label:model.access === 'open' ? 'Self-hosted' : '—', note:model.access === 'open'
      ? 'Compute cost depends on hardware and workload. Open weights do not imply zero processing cost.' : 'No matched hourly rate verified.'};
  }

  function renderPriceDetails(model, data) {
    const fxSource = record => record.fx ? ' '+link({url:record.fx.source_url},record.fx.source_label+' FX · '+record.fx.as_of)+'.' : '';
    const context = (data.pricingContexts || []).find(record => record.model === model);
    return (context ? `<p><strong>Price &amp; access · checked ${esc(context.verified_on)}:</strong> ${esc(context.note)} ${context.source_urls.map((url,i)=>link({url},'Source '+(i+1))).join(' · ')}.${fxSource(context)}</p>` : '')
      + (data.pricing || []).filter(record=>record.model===model).map(record=>`<p>${link(data.sources[record.source_id],(record.approximate ? '≈' : '')+'USD '+priceAmount(record.amount)+' / audio hour')} · ${esc(record.mode)} · ${esc(record.tier)} · ${esc(record.as_of)}. ${esc(record.note)}${fxSource(record)}</p>`).join('')
      + (data.tokenPricing || []).filter(record=>record.model===model).map(record=>`<p>${link(data.sources[record.source_id],'Token pricing')}: USD per million input audio ${esc(record.input_audio_usd_per_million_tokens)}, input text ${esc(record.input_text_usd_per_million_tokens)}, output text ${esc(record.output_text_usd_per_million_tokens)} · ${esc(record.as_of)}. Not converted to a flat hourly rate.</p>`).join('');
  }

  // Keep the two quantities in separate columns; never substitute one for the other.
  function renderSizeCells(size, data) {
    return ['download_mb','parameters_million'].map(field => {
      const value = size?.[field];
      const record = size?.field_records?.[field] || size;
      const label = finite(value) ? value.toLocaleString('en-US',{maximumFractionDigits:0}) : '—';
      return `<td>${finite(value) ? link(data.sources[record.source_id], label, record.note) : label}</td>`;
    }).join('');
  }


  const number = value => value.toLocaleString('en-US',{maximumFractionDigits:value<1 ? 2 : 1});
  const dollars = value => value.toLocaleString('en-US',{maximumSignificantDigits:2});
  const speedNumber = value => value.toLocaleString('en-US',{maximumFractionDigits:value<10 ? 1 : 0});
  const usdPrice = row => row.price?.currency==='USD' && row.price?.unit==='currency_per_audio_hour';
  const costSortValue = row => usdPrice(row) ? row.price.amount : row.deployment?.cost?.high ?? row.priceContext?.hourly_estimate?.usd;
  function deploymentDetails(row,data,result) {
    const deployment=row.deployment,speed=deployment?.speed,memory=deployment?.memory,cost=deployment?.cost;
    return `<p><strong>Speed column:</strong> ${esc(result.speedNote)} ${speed ? (speed.proxy ? 'Estimated deployment proxy: ' : 'Measured configuration: ')+esc(speed.model)+'. '+speed.records.map(record=>link(data.sources[record.source_id],record.sample+': '+record.rtfx+'×')).join(' · ')+(speed.proxy ? ' This is a separately converted Q8 model linked by '+(speed.lineage ? 'reviewed official conversion lineage' : 'exact upstream Hub identity')+', not a measurement of the accuracy checkpoint. Quantization/runtime may change accuracy. The displayed error score remains the original source result.' : '') : 'No supported deployment proxy or matched measurement.'}</p>`
      + (speed?.lineage ? `<p><strong>Deployment lineage:</strong> ${esc(speed.lineage.note)} Checked ${esc(speed.lineage.verified_on)}. ${speed.lineage.sources.map((url,i)=>link({url},i===0 ? 'Official model card' : 'Conversion / runtime source')).join(' · ')}. Q8 upstream revision: ${esc(speed.upstream_commit || 'unverified')}.</p>` : '')
      + (memory ? `<p><strong>Memory:</strong> ≈${number(memory.fp16_weights_gb)} GB for FP16 weights alone (reported total parameters × 2 bytes). This is an assumed all-resident weight-memory floor, NOT required VRAM/RAM. Activations, caches, quantization metadata, runtime workspace and copies are extra. The speed scenario is Q8, not FP16; Apple M4 uses unified memory, not dedicated VRAM. ${memory.documented_vram ? link({url:memory.documented_vram.source_url},'OpenAI planning guidance')+': approximately '+memory.documented_vram.gb+' GB VRAM for the separate OpenAI PyTorch configuration, not the Q8 speed scenario.' : 'No supported full runtime-memory requirement is available.'}</p>` : '')
      + (cost ? `<p><strong>Estimated local compute:</strong> $${dollars(cost.low)}–$${dollars(cost.high)} / audio hour = illustrative $${number(cost.hourlyRate)} / device-hour ÷ throughput, at 100% utilization. The assumed rate is adjustable under More filters; it is NOT a verified M4 rental price or API tariff. Startup/loading, idle time, minimum billing, tax and other charges are excluded. Lower utilization increases cost; the clip span is not a confidence interval.</p>` : '');
  }
  function renderDecisionCells(row,data,result) {
    const speed=row.deployment?.speed,cost=row.deployment?.cost;
    const speedCell=speed ? link(data.sources[speed.records[0].source_id],(speed.proxy ? '≈' : '')+speedNumber(speed.low)+'–'+speedNumber(speed.high)+'×',result.speedNote)+`<small class="metric-kind">${speed.proxy ? 'est. Q8' : 'measured Q8'}</small>` : '—';
    const priceCell=usdPrice(row) ? link(data.sources[row.price.source_id],(row.price.approximate ? '≈$' : '$')+priceAmount(row.price.amount),[row.price.mode,row.price.tier,row.price.as_of,row.price.note].join(' · '))+'<small class="metric-kind">API'+(row.price.language ? ' · '+esc(row.price.language.toUpperCase()) : '')+'</small>' : cost ? `<span class="cost-range" title="Illustrative local compute at $${esc(cost.hourlyRate)}/device-hour and 100% utilization; not an API price"><span>≈$${dollars(cost.low)}–</span><wbr><span>$${dollars(cost.high)}</span></span><small class="metric-kind">est. local</small>` : row.model.access==='open' ? '<span title="No supported compute-cost estimate">Local —</span>' : row.priceContext?.hourly_estimate ? `<span title="${esc(row.priceContext.hourly_estimate.note)}">≈$${dollars(row.priceContext.hourly_estimate.usd)}</span><small class="metric-kind">token est.</small>` : row.priceContext ? `<span title="${esc(row.priceContext.note)}">${esc(row.priceContext.label)}</span>` : (data.tokenPricing || []).some(record=>record.model===row.id) ? 'Token rate' : 'Unverified';
    return `<td class="deployment-speed" title="${esc(result.speedNote)}">${speedCell}</td><td class="deployment-cost">${priceCell}</td>`;
  }

  function build(data, options={}) {
    const test = data.accuracyTests.find(test => test.id === options.test) || data.accuracyTests.find(test => test.id === data.config.default_test);
    const rankMetric = test.metrics.find(metric => metric.id === options.rankMetric) || null;
    const columns = options.compact ? [] : test.metrics.filter(metric => metric.primary || options.extra || test.show_all_metrics || metric === rankMetric);
    const speedLabel='M4 speed ×';
    const speedNote='M4 Max · Metal Q8_0 · batch 1 · two short clips, loading excluded. Ranges are observed clip spans, not confidence intervals or streaming latency.';
    const enteredRate=Number(options.hourlyRate);
    const hourlyRate=Number.isFinite(enteredRate)&&enteredRate>0&&enteredRate<=1000 ? enteredRate : 1;
    const query = (options.query || '').trim().toLowerCase();
    const cutoff = options.cutoff || data.config.snapshot_date;
    const candidates = data.models.filter(model => available(model,cutoff,data.config.snapshot_date)).map(model => {
      const selected = summarize(data,test,model.id);
      const size = selectSize(data, model.id);
      const deployment = Estimates.getDeployment(data,model,size,{hourlyRate});
      const rankRecord = rankMetric ? selected.scores[rankMetric.id] : selected.summary;
      return {model, id:model.id, name:model.name, ...selected, provenance:rankMetric ? rankRecord : selected.provenance, size, rank:null,
        benchmarkValue:Rank.rankable(rankRecord) ? rankRecord.value : null, deployment,price:selectPrice(data,model.id),priceContext:(data.pricingContexts || []).find(record=>record.model===model.id),
        familyCount:selected.count ? 1 : 0};
    });
    // Benchmark positions use every eligible configuration at this date, before UI filters.
    // Unlike the aggregate reference cohort, these explicitly compare runtime configurations too.
    const cohort = candidates.filter(row => finite(row.benchmarkValue)).sort((a,b) => a.benchmarkValue-b.benchmarkValue);
    cohort.forEach((row,i) => {row.benchmarkRank = i && row.benchmarkValue === cohort[i-1].benchmarkValue ? cohort[i-1].benchmarkRank : i+1;});
    const filtered = candidates.filter(row => (!query || (row.name + ' ' + row.model.organization + ' ' + row.model.hub_id).toLowerCase().includes(query))
      && (!options.access || options.access === 'all' || row.model.access === options.access)
      && (!options.maxParams || (finite(row.size?.parameters_million) && row.size.parameters_million <= Number(options.maxParams)))
      && (!options.maxDownload || (finite(row.size?.download_mb) && row.size.download_mb <= Number(options.maxDownload))));
    const unscoredRows = filtered.filter(row => !finite(row.benchmarkValue)).sort((a,b)=>a.name.localeCompare(b.name));
    const rows = filtered.filter(row => options.missing || (rankMetric ? Rank.rankable(row.scores[rankMetric.id]) : Object.values(row.scores).some(Rank.rankable)));
    const sort = options.sort || 'score', sortDirection=options.sortDirection === 'desc' ? 'desc' : 'asc';
    const direction=sortDirection==='desc' ? -1 : 1;
    const compare=(a,b)=>{
      if(sort==='name') return direction*a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      const value=row=>sort==='download' ? row.size?.download_mb : sort==='params' ? row.size?.parameters_million : sort==='speed' ? row.deployment?.speed?.low : sort==='price' ? costSortValue(row) : row.benchmarkValue;
      const av=value(a),bv=value(b);
      if(finite(av)!==finite(bv)) return finite(av) ? -1 : 1;
      return (finite(av) ? direction*(av-bv) : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    };
    rows.sort(compare);unscoredRows.sort(compare);
    return {test, columns, rows, unscoredRows, mode:'protocol',rankMetric,compact:Boolean(options.compact),benchmarkCount:cohort.length,sort,sortDirection,speedLabel,speedNote,speedCount:rows.filter(row=>finite(row.benchmarkValue)&&finite(row.deployment?.speed?.low)).length,priceCount:rows.filter(row=>finite(row.benchmarkValue)&&row.price?.currency==='USD'&&row.price?.unit==='currency_per_audio_hour').length,localCostCount:rows.filter(row=>finite(row.benchmarkValue)&&row.deployment?.cost).length};
  }

  function renderHead(result) {
    const compactMetric=result.rankMetric || result.test.metrics.find(metric=>metric.id === (result.test.summary_metric || result.test.published_mean_metric));
    if(result.compact) {
      const header=(key,label,title='',narrow=label)=>`<th scope="col" aria-sort="${result.sort===key ? (result.sortDirection==='desc' ? 'descending' : 'ascending') : 'none'}"><button type="button" class="column-sort" data-sort-key="${key}" title="${esc(title || 'Sort by '+label)}"><span class="header-label-wide">${esc(label)}</span><span class="header-label-narrow">${esc(narrow)}</span>${result.sort===key ? (result.sortDirection==='desc' ? ' ↓' : ' ↑') : ' ↕'}</button></th>`;
      return header('rank','Rank','Quality rank; unaffected by metadata sorting')+header('name','Model')+header('score',compactMetric?.unit==='oiwer_percent' ? 'OI-WER %' : 'Error %','Lower error is better')+header('speed',result.speedLabel,result.speedNote+' Sorts by the lower throughput in the span; higher is faster.',result.speedLabel.replace(' speed',''))+header('price','$/audio hr','USD API tariffs, vendor token-cost estimates, or estimated local compute. Converted tariffs use the dated FX rate in Details; sorting uses unrounded USD. Unknown/version-unverified prices stay last. Ranges sort by the higher cost (slower clip); not a confidence bound.','$/hr');
    }
    return (result.compact ? '<th scope="col">Rank</th><th scope="col">Model</th><th scope="col">' : '<th scope="col">Model</th><th scope="col">Accuracy rank</th><th scope="col">')
      + (result.compact ? (compactMetric?.unit === 'oiwer_percent' ? 'OI-WER % ↓' : 'WER % ↓') : result.rankMetric ? esc(result.rankMetric.short)+' '+(result.rankMetric.unit === 'oiwer_percent' ? 'OI-WER' : 'WER')+' ↓' : result.test.summary_metric ? esc(result.test.metrics.find(metric => metric.id === result.test.summary_metric).short)+(result.test.metrics.find(metric => metric.id === result.test.summary_metric).unit === 'oiwer_percent' ? ' ↓' : ' WER ↓')
        : result.test.published_mean_metric ? 'Reported mean WER ↓' : 'Fixed '+result.test.mean_metrics.length+' mean WER ↓') + '</th><th scope="col" title="Reported model artifact size, not a quality score">Download (MB)</th><th scope="col" title="Reported parameter count, not a quality score">Parameters (M)</th>'
      + result.columns.map(metric => `<th scope="col" title="${esc(metric.label)} · ${metric.unit === 'oiwer_percent' ? 'OI-WER' : 'WER'} %, lower is better">${esc(metric.short)}</th>`).join('')
      + '<th scope="col">Details</th>';
  }

  function renderRows(result, data, unscored=false) {
    const rankedRows=unscored ? result.unscoredRows : result.rows.filter(row=>finite(row.benchmarkValue));
    if (!rankedRows.length) return `<tr><td colspan="${result.columns.length + (result.compact ? 5 : 6)}">No models match these filters.</td></tr>`;
    return rankedRows.map(row => {
      const source = data.sources[row.provenance?.source_id];
      const infoId = 'speech-evidence-' + result.test.id + '-' + row.id;
      const modelNote = [row.model.configuration, row.model.release_date ? 'Released ' + row.model.release_date : 'Exact release date unverified'].filter(Boolean).join(' · ');
      const meanTitle = result.rankMetric ? result.rankMetric.label+' · matched protocol only, lower is better' : row.mean == null ? 'Every required comparable measurement and matched source is required.'
        : row.meanBasis === 'published' ? 'Exactly as reported by this source. Not an aggregate rank.'
        : 'Arithmetic mean of the '+result.test.mean_metrics.length+' named WER columns, calculated here. Not the current Open ASR default average or an aggregate rank. Extra columns never change this panel.';
      const details = `<div id="${esc(infoId)}" class="rank-note" popover><button type="button" class="rank-note-close" popovertarget="${esc(infoId)}" popovertargetaction="hide" aria-label="Close evidence explanation">×</button>`
        + `<strong>${esc(row.name)} · ${esc(evidenceLabel(row.provenance))}</strong><p>${esc(modelNote)}</p>`
        + (row.provenance ? `<p>Exact source row: ${esc(row.provenance.source_model)}. Measurement operator: ${esc(row.provenance.measurement_operator)}. ${esc(row.provenance.note)}</p>` : '')
        + `<p>${esc(result.test.note)}</p><ul>${result.test.metrics.filter(metric=>row.scores[metric.id]).map(metric=>`<li>${esc(metric.label)}: ${link(data.sources[row.scores[metric.id].source_id],row.scores[metric.id].value.toFixed(2)+'%')}</li>`).join('')}</ul>`
        + (source ? `<p>${link(source, source.title)}. ${esc(source.note)}</p>` : '')
        + `<p><strong>Size:</strong> ${finite(row.size?.download_mb) ? row.size.download_mb.toLocaleString('en-US',{maximumFractionDigits:0})+' MB download' : 'Download not reported'} · ${finite(row.size?.parameters_million) ? row.size.parameters_million.toLocaleString('en-US',{maximumFractionDigits:0})+' M parameters' : 'Parameters not reported'}. Metadata only, never accuracy weights.</p>`
        + deploymentDetails(row,data,result)
        + ((data.throughput || []).some(record=>record.model===row.id) ? '<details><summary>All reported speed measurements</summary><ul>'+(data.throughput || []).filter(record=>record.model===row.id).map(record=>`<li>${link(data.sources[record.source_id],String(record.rtfx)+'× realtime')}: ${esc(record.hardware)} · ${esc(record.runtime)} · ${esc(record.test_id)} ${esc(record.sample || '')} · batch ${esc(record.batch_size)} · ${esc(record.note)}</li>`).join('')+'</ul></details>' : '')
        + ((data.latency || []).filter(record=>record.model===row.id).map(record=>`<p>Response latency: ${link(data.sources[record.source_id],record.milliseconds+' ms')} · ${esc(record.hardware)} · ${esc(record.statistic)}. ${esc(record.note)}</p>`).join(''))
        + `<p><strong>Cost:</strong> ${row.model.access==='open' ? 'Self-hosted compute cost depends on deployment; not zero.' : 'Rates depend on service, mode and tier; not a claim about the benchmark endpoint.'}</p>`
        + renderPriceDetails(row.id,data)
        + (unscored ? availableBenchmark(row,result,data) : '')
        + (row.size ? [...new Set(Object.values(row.size.field_records || {size:row.size}).filter(Boolean))]
          .map(record => `<p>${link(data.sources[record.source_id], 'Size source')}: ${esc(record.note)}</p>`).join('') : '')
        + '</div>';
      const cells = result.columns.map(metric => {
        const record = row.scores[metric.id];
        if (!record) return '<td class="score">—</td>';
        const alternatives = (data.resultsByKey[row.id + '|' + result.test.id + ':' + metric.id] || [])
          .filter(other => observed(other) && finite(other.value) && other.source_id !== record.source_id)
          .map(other => `${other.value}% (${evidenceLabel(other)}; ${data.sources[other.source_id]?.title || other.source_id})`);
        const tooltip = [metric.label, (metric.unit === 'oiwer_percent' ? 'OI-WER' : 'WER')+' %, lower is better', evidenceLabel(record), 'Measurement operator: ' + record.measurement_operator,
          record.note, alternatives.length ? 'Other observations: ' + alternatives.join('; ') : ''].filter(Boolean).join(' · ');
        return `<td class="score">${link(data.sources[record.source_id], record.value.toFixed(2), tooltip)}</td>`;
      }).join('');
      const detailsButton=`<button type="button" class="rank-marker speech-details" popovertarget="${esc(infoId)}" title="Evidence, prices and qualifications" aria-label="Evidence and qualifications for ${esc(row.name)}" aria-describedby="${esc(infoId)}">ⓘ</button>`;
      const memory=row.deployment?.memory;
      const memoryLine=memory ? `<small class="model-memory" title="FP16 weights-only floor, not total VRAM or RAM. Runtime requires additional memory; see Details.">FP16 weights ≈${number(memory.fp16_weights_gb)} GB + runtime</small>` : '';
      const modelCell=`<th scope="row">${link(data.sources[row.model.source_id], row.name, modelNote)}${result.compact ? `<div class="model-subline"><small class="model-vendor">${esc(row.model.organization)}</small>${detailsButton}</div>${memoryLine}${details}` : ''}</th>`;
      const rankCell=`<td class="index" title="${row.benchmarkRank == null ? 'No matched accuracy rank' : 'Rank '+row.benchmarkRank+' of '+result.benchmarkCount+' configurations on this benchmark before filters; ties share a rank'}">${row.benchmarkRank == null ? '—' : result.compact ? row.benchmarkRank : '#'+row.benchmarkRank+' / '+result.benchmarkCount}</td>`;
      return '<tr>'+(result.compact ? rankCell+modelCell : modelCell+rankCell)
        + `<td class="index" title="${esc(meanTitle)}">${finite(row.benchmarkValue) ? row.benchmarkValue.toFixed(2) : '—'}</td>`
        + (result.compact ? renderDecisionCells(row,data,result) : renderSizeCells(row.size, data)) + cells
        + (result.compact ? '' : `<td>${result.compact ? '' : esc(evidenceLabel(row.provenance))}<button type="button" class="rank-marker speech-details" popovertarget="${esc(infoId)}" title="${esc(source?.note || modelNote)}" aria-label="Evidence and qualifications for ${esc(row.name)}" aria-describedby="${esc(infoId)}">${result.compact ? 'Details' : '†'}</button>${details}</td>`)+'</tr>';
    }).join('');
  }


  function availableBenchmark(row,result,data) {
    const alternatives=data.accuracyTests.filter(test=>test.id!==result.test.id).map(test=>({test,summary:summarize(data,test,row.id)}));
    const alternative=alternatives.find(item=>finite(item.summary.mean)) || alternatives.find(item=>Object.values(item.summary.scores).some(Rank.rankable));
    const metric=alternative && !finite(alternative.summary.mean) ? Object.values(alternative.summary.scores).find(Rank.rankable)?.metric : '';
    const ownMetric=Object.values(row.scores).find(Rank.rankable)?.metric;
    const target=alternative?.test.id || (ownMetric ? result.test.id : null);
    return target ? `<p><button type="button" class="benchmark-link" data-benchmark="${esc(target)}" data-model="${esc(row.name)}" data-metric="${esc(alternative ? metric : ownMetric)}">View available benchmark</button></p>` : '<p>No matched published accuracy result.</p>';
  }
  function renderUnscored(result,data) {return renderRows(result,data,true);}

  return {build, costSortValue, renderUnscored, summarize, available, selectSize, renderSizeCells, selectPrice, priceInfo, renderPriceDetails, renderHead, renderRows, evidenceLabel, escape:esc, sourceLink:link};
});
