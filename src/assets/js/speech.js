/* Speech evidence selection and rendering, shared by Eleventy and the browser. */
(function(root, make) {
  const api = make(typeof module === 'object' && module.exports ? require('./ranking.js') : root.BenchmarkRank);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkSpeech = api;
})(globalThis, Rank => {
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const observed = record => record && record.status !== 'assumed' && record.evidence !== 'assumed';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link = (source, label, title='') => source && /^https?:\/\//.test(source.url)
    ? `<a href="${esc(source.url)}" target="_blank" rel="noreferrer"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</a>` : esc(label);
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
    if (selected) return {record:selected, label:(selected.currency === 'USD' ? '$' : selected.currency === 'EUR' ? '€' : selected.currency+' ')
      + selected.amount.toFixed(3).replace(/0+$/,'').replace(/\.$/,'') + '†', source_id:selected.source_id,
      note:[selected.provider,selected.mode,selected.tier,'as of '+selected.as_of,selected.note].join(' · ')};
    const tokens = (data.tokenPricing || []).find(record => record.model === model.id);
    if (tokens) return {label:'Token-priced†',source_id:tokens.source_id,note:'Current service token tariff; see Pricing. No audio-hour workload cost is inferred.'};
    return {label:model.access === 'open' ? 'Self-hosted' : '—', note:model.access === 'open'
      ? 'Compute cost depends on hardware and workload. Open weights do not imply zero processing cost.' : 'No matched hourly rate verified.'};
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

  function build(data, options={}) {
    const test = data.accuracyTests.find(test => test.id === options.test) || data.accuracyTests.find(test => test.id === data.config.default_test);
    const rankMetric = test.metrics.find(metric => metric.id === options.rankMetric) || null;
    const columns = test.metrics.filter(metric => metric.primary || options.extra || test.show_all_metrics || metric === rankMetric);
    const query = (options.query || '').trim().toLowerCase();
    const cutoff = options.cutoff || data.config.snapshot_date;
    const candidates = data.models.filter(model => available(model,cutoff,data.config.snapshot_date)).map(model => {
      const selected = summarize(data,test,model.id);
      const size = selectSize(data, model.id);
      const rankRecord = rankMetric ? selected.scores[rankMetric.id] : selected.summary;
      return {model, id:model.id, name:model.name, ...selected, provenance:rankMetric ? rankRecord : selected.provenance, size, rank:null,
        benchmarkValue:Rank.rankable(rankRecord) ? rankRecord.value : null,
        familyCount:selected.count ? 1 : 0};
    });
    // Benchmark positions use every eligible configuration at this date, before UI filters.
    // Unlike the aggregate reference cohort, these explicitly compare runtime configurations too.
    const cohort = candidates.filter(row => finite(row.benchmarkValue)).sort((a,b) => a.benchmarkValue-b.benchmarkValue);
    cohort.forEach((row,i) => {row.benchmarkRank = i && row.benchmarkValue === cohort[i-1].benchmarkValue ? cohort[i-1].benchmarkRank : i+1;});
    const rows = candidates.filter(row => (options.missing || (rankMetric ? Rank.rankable(row.scores[rankMetric.id]) : Object.values(row.scores).some(Rank.rankable)))
      && (!query || (row.name + ' ' + row.model.organization + ' ' + row.model.hub_id).toLowerCase().includes(query))
      && (!options.access || options.access === 'all' || row.model.access === options.access)
      && (!options.maxParams || (finite(row.size?.parameters_million) && row.size.parameters_million <= Number(options.maxParams)))
      && (!options.maxDownload || (finite(row.size?.download_mb) && row.size.download_mb <= Number(options.maxDownload))));
    const sort = options.sort || 'mean';
    rows.sort((a,b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const value = row => {
        if (sort === 'download') return row.size?.download_mb;
        if (sort === 'params') return row.size?.parameters_million;
        if (sort === 'price') {const price=selectPrice(data,row.id);return price?.currency === 'USD' ? price.amount : null;}
        return row.benchmarkValue;
      };
      const av=value(a),bv=value(b);
      return (finite(av) ? av : Infinity) - (finite(bv) ? bv : Infinity) || a.name.localeCompare(b.name);
    });
    return {test, columns, rows, mode:'protocol',rankMetric,benchmarkCount:cohort.length};
  }

  function renderHead(result) {
    return '<th scope="col">Model</th><th scope="col">Benchmark rank</th><th scope="col" title="Reported model artifact size, not runtime RAM">Download (MB)</th><th scope="col" title="Reported parameter count in millions, not bytes">Parameters (M)</th><th scope="col">'
      + (result.rankMetric ? esc(result.rankMetric.short)+' '+(result.rankMetric.unit === 'oiwer_percent' ? 'OI-WER' : 'WER')+' ↓' : result.test.summary_metric ? esc(result.test.metrics.find(metric => metric.id === result.test.summary_metric).short)+(result.test.metrics.find(metric => metric.id === result.test.summary_metric).unit === 'oiwer_percent' ? ' ↓' : ' WER ↓')
        : result.test.published_mean_metric ? 'Reported mean WER ↓' : 'Fixed '+result.test.mean_metrics.length+' mean WER ↓') + '</th>'
      + result.columns.map(metric => `<th scope="col" title="${esc(metric.label)} · ${metric.unit === 'oiwer_percent' ? 'OI-WER' : 'WER'} %, lower is better">${esc(metric.short)}</th>`).join('')
      + '<th scope="col">Evidence</th>';
  }

  function renderRows(result, data) {
    if (!result.rows.length) return `<tr><td colspan="${result.columns.length + 6}">No models match these filters.</td></tr>`;
    return result.rows.map(row => {
      const source = data.sources[row.provenance?.source_id];
      const infoId = 'speech-evidence-' + result.test.id + '-' + row.id;
      const modelNote = [row.model.configuration, row.model.release_date ? 'Released ' + row.model.release_date : 'Exact release date unverified'].filter(Boolean).join(' · ');
      const meanTitle = result.rankMetric ? result.rankMetric.label+' · matched protocol only, lower is better' : row.mean == null ? 'Every required comparable measurement and matched source is required.'
        : row.meanBasis === 'published' ? 'Exactly as reported by this source. Not an aggregate rank.'
        : 'Arithmetic mean of the '+result.test.mean_metrics.length+' named WER columns, calculated here. Not the current Open ASR default average or an aggregate rank. Extra columns never change this panel.';
      const details = `<div id="${esc(infoId)}" class="rank-note" popover><button type="button" class="rank-note-close" popovertarget="${esc(infoId)}" popovertargetaction="hide" aria-label="Close evidence explanation">×</button>`
        + `<strong>${esc(row.name)} · ${esc(evidenceLabel(row.provenance))}</strong><p>${esc(modelNote)}</p>`
        + (row.provenance ? `<p>Exact source row: ${esc(row.provenance.source_model)}. Measurement operator: ${esc(row.provenance.measurement_operator)}. ${esc(row.provenance.note)}</p>` : '')
        + `<p>${esc(result.test.note)}</p>`
        + (source ? `<p>${link(source, source.title)}. ${esc(source.note)}</p>` : '')
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
      return `<tr><th scope="row">${link(data.sources[row.model.source_id], row.name, modelNote)}</th>`
        + `<td class="index" title="Position within ${esc(result.test.label)} · ${esc(result.rankMetric?.label || 'complete panel')} before display filters; ties share a position. Not an overall index.">${row.benchmarkRank ? '#'+row.benchmarkRank+' / '+result.benchmarkCount : 'No matched score'}</td>`
        + renderSizeCells(row.size, data)
        + `<td class="index" title="${esc(meanTitle)}">${row.benchmarkValue == null ? '—' : row.benchmarkValue.toFixed(2)}</td>${cells}`
        + `<td>${esc(evidenceLabel(row.provenance))}<button type="button" class="rank-marker" popovertarget="${esc(infoId)}" title="${esc(source?.note || modelNote)}" aria-label="Evidence and qualifications for ${esc(row.name)}" aria-describedby="${esc(infoId)}">†</button>${details}</td></tr>`;
    }).join('');
  }

  return {build, summarize, available, selectSize, renderSizeCells, selectPrice, priceInfo, renderHead, renderRows, evidenceLabel, escape:esc, sourceLink:link};
});
