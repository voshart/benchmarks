/* Deployment evidence never enters the OCR quality cohorts or rank calculation. */
(function (root, make) {
  const api =
    typeof module === 'object' && module.exports
      ? make(require('./rank-ui.js'), require('./ranking.js'), require('./ocr-deployment.js'))
      : make(root.BenchmarkRankUI, root.BenchmarkRank, root.OCRDeployment);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCRComparison = api;
})(globalThis, (RankUI, Rank, Deployment) => {
  const { defaults, assumptions, deployment, midpoint, validReference } = Deployment;
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fmt = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const rangeFmt = (v) => Number(v.toPrecision(2)).toString();
  const money = (v) => '$' + (v < 0.01 ? v.toFixed(4) : v.toFixed(2));
  const link = (data, id, label) =>
    data.sources[id]
      ? `<a href="${esc(data.sources[id].url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
      : esc(label);

  const observationLink = (data, observation, label) =>
    /^https?:\/\//.test(observation.source_url || '')
      ? `<a href="${esc(observation.source_url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
      : link(data, observation.source_id, label);
  const scoreFmt = (value, unit) => String(Number(value.toFixed(unit === 'percent' ? 1 : 4)));

  function enrich(result, data, options = {}) {
    return {
      ...result,
      rows: result.rows.map((r) => ({
        ...r,
        deployment: deployment(
          data,
          data.models.find((m) => m.id === r.id),
          options
        )
      }))
    };
  }
  function value(row, key) {
    if (key === 'model') return row.name;
    if (key === 'rank') return row.rank;
    if (key === 'speed') {
      const d = row.deployment;
      if (d?.referenceMode) return validReference(d.reference) ? midpoint(d.reference) : null;
      return d?.speed?.pages_per_second ?? (d?.estimate ? midpoint(d.estimate) : null);
    }
    if (key === 'price') return row.deployment?.cost?.value ?? null;
    return row.scores[key]?.value ?? null;
  }
  function sortRows(rows, key = 'rank', direction = 'desc') {
    return rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => {
        const x = value(a.row, key),
          y = value(b.row, key);
        if (x == null || y == null) return x == null && y == null ? a.i - b.i : x == null ? 1 : -1;
        const delta = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return (direction === 'asc' ? delta : -delta) || a.i - b.i;
      })
      .map((x) => x.row);
  }
  function defaultDirection(key, result) {
    return key === 'model' ||
      key === 'price' ||
      result.columns.find((t) => t.id === key)?.direction === 'lower'
      ? 'asc'
      : 'desc';
  }
  function renderHead(result, options = {}) {
    const key = options.sortKey || 'rank',
      dir = options.sortDirection || 'desc';
    return [
      { id: 'model', short: 'Model', label: 'Model name' },
      {
        id: 'rank',
        short: 'Rank index',
        label: 'Quality only; speed and cost never affect this index'
      },
      {
        id: 'speed',
        short: 'pages/s',
        label:
          'H100 reference estimate where available; otherwise measured/reported throughput on the stated hardware. Different hardware measurements are not directly comparable. See Details'
      },
      {
        id: 'price',
        short: '$/1k pages',
        label: 'API tariffs, benchmark estimates, or explicitly assumed token/local costs'
      },
      ...result.columns
    ]
      .map((t) => {
        if (t.catch_all === true)
          return `<th scope="col" title="Mixed protocols have no shared sortable score; open a result's details for its exact protocol.">${esc(t.short)}</th>`;
        return `<th scope="col" aria-sort="${t.id === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="column-sort" data-ocr-sort="${esc(t.id)}" title="${esc(t.label)}${t.primary_metric ? ' · ' + (t.direction === 'lower' ? 'Lower' : 'Higher') + ' is better. Sorts the named primary protocol only; additional protocols below do not change the sort value.' : ''}">${esc(t.short)} ${t.id === key ? (dir === 'asc' ? '↑' : '↓') : '↕'}</button></th>`;
      })
      .join('');
  }
  const metricNames = {
    avg3: 'Average of 3 splits',
    clean: 'Clean',
    digital: 'Digital',
    real: 'Real',
    public: 'Public',
    private: 'Private',
    photo: 'Photo',
    non_latin: 'Non-Latin',
    arxiv: 'arXiv',
    base: 'Base',
    headers_footers: 'Headers / footers',
    long_tiny_text: 'Long / tiny text',
    multi_column: 'Multi-column',
    old_scans: 'Old scans',
    old_scans_math: 'Old scans + math',
    text_edit: 'Text edit distance',
    reading_order_edit: 'Reading-order edit distance',
    read_order_edit: 'Reading-order edit distance',
    order_edit: 'Reading-order edit distance',
    formula_cdm: 'Formula CDM',
    table_teds: 'Table TEDS',
    table_teds_s: 'Table TEDS-S',
    table_teds_structure: 'Table structure TEDS',
    teds_content: 'Content TEDS',
    teds_structure: 'Structure TEDS',
    cer: 'CER',
    wer: 'WER',
    ci95: '95% CI ±',
    reported_uncertainty: 'Reported uncertainty ±',
    kie: 'KIE',
    ocr: 'OCR',
    vqa: 'VQA',
    pp3: 'PP3',
    own_postprocessing: 'Own postprocessing'
  };
  const metricLabel = (test, key) =>
    test.metric_labels?.[key] ||
    metricNames[key] ||
    key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const metricDirection = (test, key) =>
    test.metric_directions?.[key] === 'lower'
      ? ' ↓'
      : test.metric_directions?.[key] === 'higher'
        ? ' ↑'
        : '';
  const metricUnit = (test, key) =>
    test.metric_units?.[key] === 'percent'
      ? '%'
      : test.metric_units?.[key] === 'ratio'
        ? ' ratio'
        : '';
  function metricTables(observation, test, data) {
    return (test.metric_tables || [])
      .map((table) => {
        const rows = table.rows.filter((row) =>
          row.metric_keys.some((key) => finite(observation.metrics?.[key]))
        );
        if (!rows.length) return '';
        const headings = table.columns
          .map((column) => {
            const direction =
                column.direction === 'lower' ? ' ↓' : column.direction === 'higher' ? ' ↑' : '',
              unit = column.unit === 'percent' ? '%' : column.unit === 'ratio' ? 'ratio' : '';
            return `<th scope="col">${esc(column.label + direction + (unit ? ' (' + unit + ')' : ''))}</th>`;
          })
          .join('');
        const body = rows
          .map(
            (row) =>
              `<tr><th scope="row">${esc(row.label)}</th>${row.metric_keys
                .map((key, index) => {
                  const value = observation.metrics?.[key];
                  return `<td data-metric="${esc(key)}">${finite(value) ? esc(scoreFmt(value, table.columns[index].unit)) : '—'}</td>`;
                })
                .join('')}</tr>`
          )
          .join('');
        const source =
          table.source_url || table.source_id
            ? observationLink(
                data,
                { source_url: table.source_url, source_id: table.source_id },
                'Source ↗'
              )
            : '';
        return `<details class="score-metric-group"><summary>${esc(table.label)} (${rows.length})</summary><div class="score-metric-table-scroll" role="region" aria-label="${esc(table.label)}" tabindex="0"><table class="score-metric-table" aria-label="${esc(table.label)}"><thead><tr><th scope="col">${esc(table.row_header || 'Category')}</th>${headings}</tr></thead><tbody>${body}</tbody></table></div>${source || table.note ? `<p class="score-metric-source">${source}${source && table.note ? ' · ' : ''}${esc(table.note || '')}</p>` : ''}</details>`;
      })
      .join('');
  }
  function metricBreakdown(observation, test, data) {
    const groupedKeys = new Set(
      (test.metric_tables || []).flatMap((table) => table.rows.flatMap((row) => row.metric_keys))
    );
    const metrics = Object.entries(observation.metrics || {}).filter(
        ([key, value]) => key !== test.primary_metric && !groupedKeys.has(key) && finite(value)
      ),
      tables = metricTables(observation, test, data);
    if (!metrics.length && !tables) return '';
    const items = metrics
      .map(
        ([key, value]) =>
          `<dt>${esc(metricLabel(test, key) + metricDirection(test, key))}</dt><dd data-metric="${esc(key)}">${esc(scoreFmt(value, test.metric_units?.[key]))}${esc(metricUnit(test, key))}</dd>`
      )
      .join('');
    const componentSource = observation.component_source_url
      ? `<small class="score-context">${observationLink(data, { source_url: observation.component_source_url, source_id: observation.component_source_id || observation.source_id }, 'Breakdown source ↗')}</small>`
      : observation.component_source_id && observation.component_source_id !== observation.source_id
        ? `<small class="score-context">${link(data, observation.component_source_id, 'Breakdown source ↗')}</small>`
        : '';
    return `${metrics.length ? `<dl class="score-metrics">${items}</dl>` : ''}${componentSource}${tables}`;
  }
  const evidenceLabel = (observation) =>
    ({
      official: 'benchmark publication',
      third_party: 'third-party report',
      community: 'community report',
      author_reported: 'author-reported',
      vendor_comparison: 'vendor comparison',
      vendor: 'vendor-operated',
      mixed: 'mixed evidence',
      imported: 'imported',
      secondary: 'secondary report',
      research: 'reported; operator unverified',
      vendor_internal: 'vendor-internal'
    })[observation.evidence] || 'reported';
  function visibleContext(observation, test) {
    const operator = observation.measurement_operator || observation.operator;
    const provenance = [evidenceLabel(observation), operator && 'Operator: ' + operator]
      .filter(Boolean)
      .join(' · ');
    const context =
      observation.visible_context ||
      [
        observation.dataset_scope || test.scope,
        observation.evaluation_method,
        observation.run_date && 'Run ' + observation.run_date
      ]
        .filter(Boolean)
        .join(' · ');
    return `<small class="score-context">${esc(provenance)}</small>${observation.comparable === false ? '<small class="score-context">Context only · not comparable for ranking</small>' : ''}${context ? `<small class="score-context">${esc(context)}</small>` : ''}`;
  }
  function speedNote(r) {
    return [
      r.hardware,
      r.pipeline,
      r.input_type && 'input: ' + r.input_type,
      r.configuration && 'configuration: ' + r.configuration,
      r.dataset,
      r.batch && 'batch: ' + r.batch,
      r.concurrency != null && 'concurrency: ' + r.concurrency,
      r.precision,
      r.note,
      'as of ' + r.as_of
    ]
      .filter(Boolean)
      .join(' · ');
  }
  function details(row, data) {
    const d = row.deployment;
    let content = `<p>${esc(row.modelNote || row.name)}</p>`;
    if (row.rank == null)
      content += `<p><strong>No comparable overall index.</strong> ${esc(row.rankExplanation)} Reported benchmark results, when available, remain listed below.</p>`;
    const reported = data.tests.filter((t) => row.scores[t.id]?.value != null);
    if (reported.length)
      content +=
        '<p><strong>Reported benchmark results</strong> · Separate protocols, not a combined score.</p><ul>' +
        reported
          .flatMap((t) => {
            const selected = row.scores[t.id],
              alternatives = (data.resultsByKey?.[row.id + '|' + t.id] || []).filter(
                (o) =>
                  finite(o.value) &&
                  o.status !== 'assumed' &&
                  o.evidence !== 'assumed' &&
                  (o.source_id !== selected.source_id || o.value !== selected.value)
              );
            return [selected, ...alternatives].map(
              (o, index) =>
                `<li><strong>${esc(t.label)}: ${esc(scoreFmt(o.value, t.unit))}</strong>${index ? ' · alternate source' : ''} · ${esc(o.evidence || 'reported')}. ${esc(o.configuration || '')} ${esc(o.note || data.sources[o.source_id]?.note || '')} ${observationLink(data, o, 'Source ↗')}${metricBreakdown(o, t, data)}${visibleContext(o, t)}</li>`
            );
          })
          .join('') +
        '</ul>';
    else content += '<p>No benchmark results recorded for this model.</p>';
    content += `<p><strong>Cost:</strong> ${esc(d.cost.label)} /1,000 pages · ${esc(d.cost.kind)}. ${esc(d.cost.note)} ${d.cost.source_id ? link(data, d.cost.source_id, 'Source ↗') : ''}${d.cost.fx ? ` · <a href="${esc(d.cost.fx.source_url)}" target="_blank" rel="noreferrer">Exchange rate ↗</a>` : ''}</p>`;
    if (d.referenceMode) {
      const p = data.ocrReference.profile,
        e = d.reference;
      content += `<p><strong>Common reference: ${esc(p.label)}</strong>. ${esc(p.hardware)}. ${esc(p.host)}</p><p>${esc(p.precision)} ${esc(p.workload)} ${esc(p.batch)}</p>`;
      if (e?.status === 'estimated')
        content += `<p><strong>Low-confidence H100 estimate:</strong> ≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))} pages/s. NOT a measurement or statistical confidence interval. ${esc(e.basis)}</p>`;
      if (e?.hypothetical)
        content += `<p><strong>Hypothetical H100 equivalent:</strong> conditional engineering estimate, not a measurement of the hosted API or a claim that its weights can be downloaded. ${esc(e.fit)}</p><p><strong>Hypothetical local compute:</strong> ${esc(d.referenceCost?.label || '—')} /1,000 pages at the selected setup-hour rate. This is separate from the hosted price shown in the table.</p>`;
      content += `<p><strong>Fit:</strong> ${esc(e?.fit || 'No verified local reference scenario for this hosted or unresolved configuration.')} ${esc(p.fit_note)}</p><p>${esc(p.method)} ${esc(p.sorting)} Quality scores are unchanged and were not remeasured at this resolution, precision or batch. ${(e?.source_ids || []).map((id) => link(data, id, 'Evidence ↗')).join(' · ')}</p>`;
      if (d.publishedCost && d.publishedCost !== d.cost)
        content += `<p><strong>Published/alternate price context:</strong> ${esc(d.publishedCost.label)} · ${esc(d.publishedCost.kind)}. ${esc(d.publishedCost.note)} ${link(data, d.publishedCost.source_id, 'Source ↗')}</p>`;
    }
    if (d.records.length)
      content +=
        '<p><strong>Speed observations:</strong> measured/reported, not normalized across setups. A matching model name does not establish the same quality-evaluation configuration.</p><ul>' +
        d.records
          .map(
            (r) =>
              `<li>${esc(r.unit === 'pages_per_second' ? fmt(r.pages_per_second) + ' pages/s' : r.display_value || 'Context only')} · ${esc(speedNote(r))} · ${esc(r.evidence)}. ${r.comparison_default === false ? 'Context only; not used in the sortable speed/cost. ' : ''}${link(data, r.source_id, 'Source ↗')}</li>`
          )
          .join('') +
        '</ul>';
    else
      content +=
        '<p>No sourced full-page speed measurement for this model; parameter count is not a speed estimate.</p>';
    if (d.estimate) {
      const e = d.estimate;
      content += `<p><strong>Low-confidence modeled speed:</strong> ≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))} pages/s. This is an educated planning range, NOT a measurement, guarantee or statistical confidence interval. ${d.referenceMode ? 'Original hardware scenario only; the common H100 scenario is used in the table. ' : d.speed ? 'A reported measurement takes priority in the table. ' : ''}</p><p>${esc([e.hardware, e.pipeline, e.precision, 'batch: ' + e.batch, 'workload: ' + e.workload].join(' · '))}</p><p><strong>Basis:</strong> ${esc(e.basis)}</p><p>${esc(e.limitations)} Quality was not re-evaluated under this speed scenario. Sorting uses the geometric midpoint only; overlapping ranges do not establish a faster model. As of ${esc(e.as_of)}. ${e.source_ids.map((id) => link(data, id, 'Evidence ↗')).join(' · ')}</p>`;
    }
    const id = 'ocr-details-' + row.id;
    return `<button type="button" class="ocr-details-button" popovertarget="${esc(id)}" aria-label="Benchmark, speed and cost details for ${esc(row.name)}" title="Model details"><span aria-hidden="true">ⓘ</span></button><div id="${esc(id)}" class="rank-note ocr-details" popover><button type="button" class="rank-note-close" popovertarget="${esc(id)}" popovertargetaction="hide" aria-label="Close model details">×</button><strong>${esc(row.name)} · results and deployment details</strong>${content}</div>`;
  }
  function cellObservation(row, test, data, columns) {
    if (row.scores[test.id]?.value != null)
      return { observation: row.scores[test.id], test, variant: false };
    // Specialized views name exact protocols; never borrow another split or component.
    if (!columns.some((t) => t.catch_all === true)) return null;
    const shownFamilies = new Set(columns.map((t) => t.family));
    const candidates = data.tests.filter(
      (t) =>
        row.scores[t.id]?.value != null &&
        (test.catch_all === true ? !shownFamilies.has(t.family) : t.family === test.family)
    );
    candidates.sort((a, b) => (a.matrix_order ?? 100) - (b.matrix_order ?? 100));
    const chosen = candidates[0];
    return chosen ? { observation: row.scores[chosen.id], test: chosen, variant: true } : null;
  }
  // The default matrix groups every published protocol into a family column.
  // A headline protocol still supplies the sort value; displaying variants never changes it.
  function cellObservations(row, test, data, columns) {
    if (!columns.some((t) => t.catch_all === true)) {
      const cell = cellObservation(row, test, data, columns);
      return cell ? [cell] : [];
    }
    const shownFamilies = new Set(columns.map((t) => t.family)),
      shownIds = new Set(columns.map((t) => t.id));
    return data.tests
      .filter(
        (t) =>
          row.scores[t.id]?.value != null &&
          (t.id === test.id ||
            (test.catch_all === true
              ? !shownFamilies.has(t.family)
              : t.family === test.family && !shownIds.has(t.id)))
      )
      .sort(
        (a, b) =>
          Number(a.id !== test.id) - Number(b.id !== test.id) ||
          (a.matrix_order ?? 100) - (b.matrix_order ?? 100) ||
          a.id.localeCompare(b.id)
      )
      .map((t) => ({ observation: row.scores[t.id], test: t, variant: t.id !== test.id }));
  }
  function resultDetails(row, test, observation, column, data) {
    const id =
      'ocr-result-' +
      [row.id, column.id, test.id].map((value) => value.replace(/[^a-zA-Z0-9_-]/g, '-')).join('--');
    const title = id + '-title',
      unit = test.unit === 'percent' ? '%' : test.unit === 'ratio' ? ' ratio' : '';
    const paragraphs = [
      observation.configuration && ['Setup', observation.configuration],
      (observation.dataset_scope || observation.dataset_version) && [
        'Dataset',
        observation.dataset_scope || observation.dataset_version
      ],
      observation.evaluation_method && ['Method', observation.evaluation_method],
      observation.run_date && ['Run date', observation.run_date],
      observation.verified_on && ['Source checked', observation.verified_on]
    ].filter(Boolean);
    const notes = [observation.note || data.sources[observation.source_id]?.note, test.note].filter(
      (note, index, all) => note && all.indexOf(note) === index
    );
    const content = `<h3 id="${esc(title)}">${esc(row.name)} · ${esc(test.label)}</h3><p class="result-headline"><strong>${esc(metricLabel(test, test.primary_metric))}: ${esc(scoreFmt(observation.value, test.unit) + unit)}</strong> · ${observationLink(data, observation, 'Source ↗')}</p>${metricBreakdown(observation, test, data)}${visibleContext(observation, test)}${paragraphs.map(([label, value]) => `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>`).join('')}${notes.map((note) => `<p>${esc(note)}</p>`).join('')}<p class="result-display-note">Component ↑/↓ labels indicate direction; values retain their published scales. Component values rounded for display; source data retains full precision.</p>`;
    return {
      button: `<button type="button" class="ocr-result-details-button" popovertarget="${esc(id)}" aria-controls="${esc(id)}" aria-haspopup="dialog" aria-label="Details for ${esc(row.name)} · ${esc(test.label)}" title="${esc(test.label)} · benchmark details"><span aria-hidden="true">ⓘ</span></button>`,
      popover: `<section id="${esc(id)}" class="rank-note ocr-result-details" popover="auto" role="dialog" aria-labelledby="${esc(title)}"><button type="button" class="rank-note-close" popovertarget="${esc(id)}" popovertargetaction="hide" aria-label="Close benchmark details" autofocus>×</button>${content}</section>`
    };
  }
  function renderScores(row, column, data, result) {
    const cells = cellObservations(row, column, data, result.columns),
      primary = cells.find((cell) => !cell.variant),
      v = primary?.observation.value,
      range = result.ranges[column.id];
    const shade =
      v == null || !range
        ? 0
        : range[0] === range[1]
          ? 30
          : Math.max(
              0,
              Math.min(
                1,
                column.direction === 'lower'
                  ? (range[1] - v) / (range[1] - range[0])
                  : (v - range[0]) / (range[1] - range[0])
              )
            ) * 30;
    const content = cells
      .map(({ observation: o, test: t, variant }) => {
        const detail = resultDetails(row, t, o, column, data),
          label =
            t.label +
            ': ' +
            scoreFmt(o.value, t.unit) +
            (t.unit === 'percent' ? '%' : t.unit === 'ratio' ? ' ratio' : '');
        return `<div class="ocr-result" data-protocol="${esc(t.id)}" data-sort-primary="${!variant}"><div class="ocr-score-line"><span class="score-value" role="group" aria-label="${esc(label)}" title="${esc(t.label)} · ${esc(RankUI.scoreTooltip(o, data, row.id, t.id))}">${observationLink(data, o, scoreFmt(o.value, t.unit))}${o && Rank.qualification(o) ? '<sup>*</sup>' : ''}${t.unit === 'percent' ? '<span class="score-unit">%</span>' : ''}${o.comparable === false ? '<sup class="score-context-mark" role="img" aria-label="Context-only result; excluded from ranking" title="Context-only result; excluded from ranking">‡</sup>' : ''}</span>${detail.button}</div>${detail.popover}</div>`;
      })
      .join('');
    return `<td class="score" data-protocol="${esc(primary?.test.id || cells[0]?.test.id || column.id)}" style="--shade:${shade.toFixed(1)}%">${content || '—'}</td>`;
  }
  function compactPriceLabel(cost) {
    const label = String(cost.label || '').replace(/^Service\s+/, '');
    return finite(cost.value) || /^(?:≈)?\$\d[\d.,]*(?:–\$?\d[\d.,]*)?[†‡*]?$/.test(label)
      ? label
      : '—';
  }
  function renderRows(result, data, options = {}) {
    const enriched = enrich(result, data, options);
    return sortRows(enriched.rows, options.sortKey || 'rank', options.sortDirection || 'desc')
      .map((r) => {
        const d = r.deployment,
          s = d.speed,
          e = d.estimate,
          c = d.cost,
          ref = d.reference;
        const referenceLabel = validReference(ref)
          ? ref.hypothetical
            ? 'Hypothetical H100 equivalent; not hosted API speed'
            : ref.path === 'cpu'
              ? 'Estimated CPU path on reference setup'
              : 'Estimated H100 reference speed'
          : ref?.status === 'too-large'
            ? '>80GB'
            : ref?.status === 'tight-fit'
              ? 'Fit uncertain'
              : ref?.status === 'cpu-only'
                ? 'CPU only'
                : ref?.status === 'hosted' || r.access === 'closed'
                  ? 'Hosted'
                  : 'No reference GPU estimate';
        const reported =
          d.records
            .filter(
              (x) =>
                x.unit === 'pages_per_second' &&
                finite(x.pages_per_second) &&
                x.pages_per_second > 0
            )
            .sort((a, b) => (a.selection_priority ?? 100) - (b.selection_priority ?? 100))[0] ||
          null;
        const speedContext =
          d.referenceMode && validReference(ref)
            ? [referenceLabel, ref?.basis || ref?.fit].filter(Boolean).join(' · ')
            : reported
              ? ['Reported hardware measurement; not H100-normalized', speedNote(reported)].join(
                  ' · '
                )
              : s
                ? speedNote(s)
                : e
                  ? 'Low-confidence modeled range; ' + e.hardware
                  : 'No comparable full-page measurement';
        const speedCell =
          d.referenceMode && validReference(ref)
            ? `<button type="button" class="ocr-estimate-link" popovertarget="ocr-details-${esc(r.id)}" aria-label="H100 reference estimate and assumptions for ${esc(r.name)}">≈${esc(rangeFmt(ref.low))}–${esc(rangeFmt(ref.high))}</button>`
            : reported
              ? `<button type="button" class="ocr-estimate-link" popovertarget="ocr-details-${esc(r.id)}" aria-label="Reported ${esc(fmt(reported.pages_per_second))} pages per second on ${esc(reported.hardware)} for ${esc(r.name)}">${esc(fmt(reported.pages_per_second))}†</button>`
              : s
                ? link(data, s.source_id, fmt(s.pages_per_second) + '†')
                : e
                  ? `<button type="button" class="ocr-estimate-link" popovertarget="ocr-details-${esc(r.id)}" aria-label="Low-confidence modeled speed and assumptions for ${esc(r.name)}">≈${esc(rangeFmt(e.low))}–${esc(rangeFmt(e.high))}</button>`
                  : '—';
        const priceLabel = compactPriceLabel(c),
          priceCell = priceLabel === '—' ? '—' : link(data, c.source_id, priceLabel);
        return (
          `<tr data-model="${esc(r.id)}"><th scope="row" title="${esc(r.modelNote || r.name)}">${link(data, r.modelSourceId, r.name)}${details(r, data)}</th><td class="index">${r.rank == null ? `<span role="img" aria-label="Unranked: no comparable overall index. See Details.">—</span>` : RankUI.renderRank(r, data.sources)}</td><td class="ocr-speed" title="${esc(speedContext)}">${speedCell}</td><td class="price" title="${esc(c.kind + ' · ' + c.note)}">${priceCell}</td>` +
          result.columns.map((t) => renderScores(r, t, data, result)).join('') +
          '</tr>'
        );
      })
      .join('');
  }
  return {
    cellObservation,
    cellObservations,
    defaults,
    assumptions,
    deployment,
    enrich,
    sortRows,
    defaultDirection,
    renderHead,
    renderRows
  };
});
