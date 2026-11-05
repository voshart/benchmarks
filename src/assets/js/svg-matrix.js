/* One SVG evidence matrix. Normalize only within exact protocols, as in speech. */
(function (root, make) {
  const api =
    typeof module === 'object' && module.exports
      ? make(require('./ranking.js'), require('./svg-comparison.js'))
      : make(root.BenchmarkRank, root.SVGComparison);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SVGMatrix = api;
})(globalThis, (Rank, Comparison) => {
  const finite = Number.isFinite;
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const definition = (data, run, metric) => ({
    ...data.metrics[metric],
    precision: run.precisions?.[metric] ?? data.metrics[metric].precision
  });
  const valueText = (data, run, row, metric) =>
    Comparison.format(row.values[metric], definition(data, run, metric));
  function build(data, options = {}) {
    const mode = data.matrix.modes.some((m) => m.id === options.mode)
      ? options.mode
      : data.matrix.default_mode;
    const columns = data.matrix.columns.filter((c) => mode === 'all' || c.colour === mode);
    const families = new Set(columns.map((c) => c.id));
    const protocols = data.runs
      .filter((r) => families.has(r.family))
      .slice()
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    const panels = protocols.map((run) => {
      const cohort = run.rows
        .filter((row) => finite(row.values[run.primary]))
        .map((row) => ({ model: { id: row.model }, obs: { value: row.values[run.primary] } }));
      return {
        run,
        cohort,
        ranks:
          cohort.length >= 2
            ? Rank.pctRanks(
                cohort,
                { direction: data.metrics[run.primary].direction === 'asc' ? 'lower' : 'higher' },
                true
              )
            : new Map()
      };
    });
    const all = Object.entries(data.models)
      .map(([id, model]) => {
        const scores = {},
          contributions = [];
        const observations = panels.flatMap((panel) => {
          const row = panel.run.rows.find((row) => row.model === id);
          return row
            ? [
                {
                  run: panel.run,
                  row,
                  percentile: panel.ranks.get(id) ?? null,
                  cohort: panel.cohort.length
                }
              ]
            : [];
        });
        for (const column of columns) {
          // Protocol priority is declared in data; never select the best score.
          scores[column.id] =
            observations.find(
              (o) => o.run.family === column.id && finite(o.row.values[o.run.primary])
            ) || null;
          if (scores[column.id]?.percentile != null) contributions.push(scores[column.id]);
        }
        const index =
          contributions.length >= data.matrix.minimum_families
            ? contributions.reduce((sum, o) => sum + o.percentile, 0) / contributions.length
            : null;
        const complexity = {};
        for (const metric of data.matrix.complexity_metrics)
          complexity[metric] = observations.find((o) => finite(o.row.values[metric])) || null;
        return {
          id,
          model,
          scores,
          observations,
          contributions,
          index,
          count: contributions.length,
          complexity
        };
      })
      .filter((row) => row.observations.length);
    const cohort = all
      .filter((row) => finite(row.index))
      .sort((a, b) => b.index - a.index || a.id.localeCompare(b.id));
    cohort.forEach((row, i) => {
      row.position = i && row.index === cohort[i - 1].index ? cohort[i - 1].position : i + 1;
    });
    const key = [
      'index',
      'name',
      'count',
      ...columns.map((c) => c.id),
      ...data.matrix.complexity_metrics
    ].includes(options.key)
      ? options.key
      : 'index';
    const direction =
      options.direction ||
      (key === 'name' ||
      data.matrix.complexity_metrics.includes(key) ||
      data.metrics[columns.find((c) => c.id === key)?.metric]?.direction === 'asc'
        ? 'asc'
        : 'desc');
    const query = (options.query || '').trim().toLowerCase();
    const rows = all.filter((row) =>
      [row.model.name, row.model.version, row.model.configuration_label, row.model.note]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
    const sortValue = (row) =>
      ['index', 'count'].includes(key)
        ? row[key]
        : row.complexity[key]
          ? row.complexity[key].row.values[key]
          : row.scores[key]?.row.values[row.scores[key].run.primary];
    rows.sort((a, b) => {
      if (key === 'name')
        return (
          a.model.name.localeCompare(b.model.name) * (direction === 'asc' ? 1 : -1) ||
          a.id.localeCompare(b.id)
        );
      const x = sortValue(a),
        y = sortValue(b);
      if (finite(x) !== finite(y)) return finite(x) ? -1 : 1;
      return (
        (finite(x) ? (x - y) * (direction === 'asc' ? 1 : -1) : 0) ||
        a.model.name.localeCompare(b.model.name) ||
        a.id.localeCompare(b.id)
      );
    });
    return {
      mode,
      columns,
      rows,
      cohortCount: cohort.length,
      key,
      direction,
      showComplexity: options.complexity === true
    };
  }
  function rankNote(row, data) {
    const counts = `${row.count} dataset ${row.count === 1 ? 'family' : 'families'}`;
    return finite(row.index)
      ? `Relative index ${row.index.toFixed(1)} / 100 · position ${row.position}. Mean finite-cohort percentile across ${counts}; one vote per family. An estimate from different comparison cohorts, not accuracy or a matched win over every listed tracer. ${row.count < data.matrix.full_coverage_families ? 'Limited coverage. ' : ''}Published versions and execution conditions may differ; exact configurations remain separate. Complexity does not affect this index.`
      : 'Unranked: no matched quality comparison. Missing scores are not failures.';
  }
  function sourceDetails(item, data) {
    const { run, row } = item;
    const metrics = Object.entries(row.values)
      .filter(([, value]) => finite(value))
      .map(
        ([metric]) =>
          `<dt>${esc(data.metrics[metric].label)}</dt><dd>${esc(valueText(data, run, row, metric))}</dd>`
      )
      .join('');
    const conditional = row.conditional
      ? `<p>Conditional mean boundary: ${row.conditional.mean_boundary.toFixed(5)} px on ${row.conditional.count.toLocaleString('en-US')} paired nonempty cases. Errors and empty outputs are excluded.</p>`
      : '';
    const source = data.sources[run.source_id];
    return `<section><h4>${esc(run.label)}</h4><p>${esc(data.models[row.model].version)}</p><p>${esc(run.summary)}. ${esc(row.attribution || 'maintainer-run')} · ${esc(source.operator)}.</p><dl>${metrics}</dl>${conditional}<p>${esc(row.note)}</p><p>${esc(run.method)}</p><p>${esc(run.caveat)}</p><p>${esc(run.sample_count_note || (run.sample_count == null ? 'Exact evaluated count unverified.' : ''))}</p><p><a href="${esc(source.url)}" target="_blank" rel="noreferrer">Result source ↗</a> · <a href="${esc(data.sources[run.dataset_source].url)}" target="_blank" rel="noreferrer">Dataset source ↗</a></p></section>`;
  }
  function popover(id, label, body) {
    return `<button class="rank-marker svg-info" type="button" popovertarget="${id}" aria-label="${esc(label)}">ⓘ</button><div id="${id}" popover class="rank-note svg-detail"><button class="rank-note-close" type="button" popovertarget="${id}" popovertargetaction="hide" aria-label="Close details">×</button>${body}</div>`;
  }
  function renderHead(result, data) {
    const columns = [
      { id: 'name', label: 'Tracer' },
      {
        id: 'index',
        label: 'Index ↑',
        description:
          'Relative within-test percentile index, not accuracy. Configuration and coverage qualifications in ⓘ.'
      },
      { id: 'count', label: 'Tests', description: 'Dataset families contributing to the index.' },
      ...result.columns.map((c) => ({
        ...c,
        label: c.label + (data.metrics[c.metric].direction === 'asc' ? ' ↓' : ' ↑'),
        description:
          'Exact protocol, metric, source and alternate observations in ⓘ. Raw values from different protocols are not directly comparable.'
      })),
      ...(result.showComplexity
        ? data.matrix.complexity_metrics.map((id) => ({
            id,
            label: data.metrics[id].short || data.metrics[id].label,
            description:
              data.metrics[id].description + ' Source dataset in ⓘ; units remain separate.'
          }))
        : [])
    ];
    return columns
      .map(
        (c) =>
          `<th scope="col" aria-sort="${c.id === result.key ? (result.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" data-svg-sort="${c.id}" title="${esc(c.description || 'Sort by tracer name')}">${esc(c.label)}${c.id === result.key ? (result.direction === 'asc' ? ' ▴' : ' ▾') : ''}</button></th>`
      )
      .join('');
  }
  function renderRows(result, data) {
    if (!result.rows.length)
      return `<tr><td colspan="${3 + result.columns.length + (result.showComplexity ? data.matrix.complexity_metrics.length : 0)}" class="svg-empty">${result.mode === 'gradient' ? 'No gradient-specific results have been reported. The colour datasets mix flat artwork and gradients.' : 'No tracers match this filter.'}</td></tr>`;
    return result.rows
      .map((row) => {
        const id = 'svg-config-' + row.id;
        const allDetails = row.observations.map((o) => sourceDetails(o, data)).join('');
        const title = `<h3>${esc(row.model.name)}</h3><p>${esc(row.model.version)}</p><p>${esc(row.model.note)}</p><p>${esc(rankNote(row, data))}</p>`;
        const contributionDetails = row.contributions
          .map(
            (o) =>
              `<li>${esc(o.run.label)}: ${o.percentile.toFixed(1)} percentile (${o.cohort} configurations; ${esc(o.row.attribution || 'maintainer-run')}).</li>`
          )
          .join('');
        const index = finite(row.index) ? row.index.toFixed(1) : '—';
        const cells = result.columns
          .map((column) => {
            const item = row.scores[column.id];
            if (!item) return '<td>—</td>';
            const value = valueText(data, item.run, item.row, item.run.primary);
            const alternatives = row.observations.filter((o) => o.run.family === column.id);
            const note =
              alternatives.length > 1
                ? '<p>Multiple protocols are available. The first result follows declared protocol priority; all observations are retained below.</p>'
                : '';
            return `<td class="score" style="--shade:${item.percentile == null ? 0 : ((30 * item.percentile) / 100).toFixed(1)}%">${esc(value)}${popover(id + '-' + column.id, `${row.model.name}: ${column.label} score and source`, `<h3>${esc(row.model.name)} · ${esc(column.label)}</h3>${note}${alternatives.map((o) => sourceDetails(o, data)).join('')}`)}</td>`;
          })
          .join('');
        const complexity = result.showComplexity
          ? data.matrix.complexity_metrics
              .map((metric) => {
                const item = row.complexity[metric];
                return item
                  ? `<td>${esc(valueText(data, item.run, item.row, metric))}${popover(id + '-' + metric, `${row.model.name}: ${data.metrics[metric].label}`, `<h3>${esc(data.metrics[metric].label)}</h3><p>One attributed measurement from ${esc(item.run.label)}; not an average across datasets.</p>${sourceDetails(item, data)}`)}</td>`
                  : '<td>—</td>';
              })
              .join('')
          : '';
        return `<tr data-model="${esc(row.id)}"><th scope="row">${esc(row.model.name)}${popover(id, `Details for ${row.model.name}, ${row.model.configuration_label}`, title + allDetails)}<small class="svg-version">${esc(row.model.configuration_label)}</small></th><td class="index">${index}${popover(id + '-index', `Index details for ${row.model.name}`, `<h3>${esc(row.model.name)} · relative index</h3><p>${esc(rankNote(row, data))}</p><ul>${contributionDetails}</ul>`)}</td><td>${row.count}</td>${cells}${complexity}</tr>`;
      })
      .join('');
  }
  return { build, renderHead, renderRows };
});
