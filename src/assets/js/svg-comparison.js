(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SVGComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const views = (data) => [...(data.overview ? [data.overview] : []), ...data.runs];
  const metric = (data, run, key) => ({
    ...data.metrics[key],
    precision: run.precisions?.[key] ?? data.metrics[key].precision
  });
  function format(value, definition) {
    if (!finite(value)) return '—';
    const text = value.toFixed(definition.precision);
    return (definition.trim ? String(Number(text)) : text) + (definition.unit || '');
  }
  function observation(data, ref) {
    const run = data.runs.find((run) => run.id === ref.run_id);
    const row = run?.rows.find((row) => row.model === ref.model);
    return { run, row, value: row?.values[ref.metric] };
  }
  function materialize(data, id) {
    const definition = views(data).find((run) => run.id === id);
    if (!definition) throw new Error('Unknown SVG protocol: ' + id);
    if (!definition.components) return definition;
    const components = definition.components.map((component) => ({
      ...component,
      run: data.runs.find((run) => run.id === component.run_id)
    }));
    const models = [
      ...new Set(components.flatMap((component) => component.run.rows.map((row) => row.model)))
    ];
    const rows = models.map((model) => {
      const values = {};
      for (const component of components) {
        const row = component.run.rows.find((row) => row.model === model);
        values[component.column] = row?.values[component.metric] ?? null;
      }
      const scores = definition.components.map((component) => values[component.column]);
      values[definition.primary] = scores.every(finite)
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;
      const sourceRow = components
        .flatMap((component) => component.run.rows)
        .find((row) => row.model === model);
      return {
        model,
        values,
        attribution: sourceRow.attribution,
        note: 'Calculated fixed-panel mean; the component scores are published observations. Every named dataset is required.'
      };
    });
    return { ...definition, rows };
  }
  function select(data, id, query = '', key = 'rank', direction) {
    const run = materialize(data, id);
    key = ['rank', 'name', ...run.columns].includes(key) ? key : 'rank';
    direction =
      direction || (key === 'rank' || key === 'name' ? 'asc' : data.metrics[key].direction);
    const compareName = (a, b) =>
      data.models[a.model].name.localeCompare(data.models[b.model].name) ||
      a.model.localeCompare(b.model);
    const all = run.rows.map((row) => ({ ...row, rank: null }));
    const cohort = all
      .filter((row) => finite(row.values[run.primary]))
      .sort(
        (a, b) =>
          (a.values[run.primary] - b.values[run.primary]) *
            (data.metrics[run.primary].direction === 'asc' ? 1 : -1) || compareName(a, b)
      );
    cohort.forEach((row, i) => {
      row.rank =
        i && row.values[run.primary] === cohort[i - 1].values[run.primary]
          ? cohort[i - 1].rank
          : i + 1;
    });
    const q = query.trim().toLowerCase();
    const rows = all.filter((row) =>
      [data.models[row.model].name, data.models[row.model].version, row.note]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
    rows.sort((a, b) => {
      if (key === 'name') return compareName(a, b) * (direction === 'asc' ? 1 : -1);
      const x = key === 'rank' ? a.rank : a.values[key],
        y = key === 'rank' ? b.rank : b.values[key];
      if (finite(x) !== finite(y)) return finite(x) ? -1 : 1;
      return (finite(x) ? (x - y) * (direction === 'asc' ? 1 : -1) : 0) || compareName(a, b);
    });
    return {
      run,
      rows,
      rankedRows: rows.filter((row) => row.rank !== null),
      unrankedRows: rows.filter((row) => row.rank === null),
      cohortCount: cohort.length,
      key,
      direction
    };
  }
  function renderHead(result, data) {
    return ['rank', 'name', ...result.run.columns]
      .map((key) => {
        const active = key === result.key;
        const label =
          key === 'rank'
            ? 'Rank'
            : key === 'name'
              ? 'Tracer'
              : data.metrics[key].short || data.metrics[key].label;
        const title =
          key === 'rank'
            ? 'Quality position on the complete comparison group before search. Ties share a rank. Complexity sorting does not change this position.'
            : key === 'name'
              ? 'Sort by tracer name; configuration and sources in ⓘ'
              : data.metrics[key].description;
        return `<th scope="col" aria-sort="${active ? (result.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" data-svg-sort="${key}" title="${escape(title)}">${escape(label)}${active ? (result.direction === 'asc' ? ' ▴' : ' ▾') : ''}</button></th>`;
      })
      .join('');
  }
  function renderRows(result, data, unranked = false) {
    const rows = unranked ? result.unrankedRows : result.rankedRows;
    if (!rows.length)
      return `<tr><td colspan="${result.run.columns.length + 2}" class="svg-empty">No tracers match this search.</td></tr>`;
    return rows
      .map((row) => {
        const model = data.models[row.model],
          id = `svg-${result.run.id}-${row.model}`;
        const values = result.run.columns
          .map((key) => `<td>${format(row.values[key], metric(data, result.run, key))}</td>`)
          .join('');
        const details = Object.entries(row.values)
          .filter(([key, value]) => data.metrics[key] && finite(value))
          .map(
            ([key, value]) =>
              `<dt>${escape(data.metrics[key].label)}</dt><dd>${format(value, metric(data, result.run, key))}</dd>`
          )
          .join('');
        const missing = result.run.components
          ?.filter((component) => !finite(row.values[component.column]))
          .map((component) => data.metrics[component.column].label.replace(' ↑', ''))
          .join(', ');
        const rankNote =
          row.rank === null
            ? `Unranked: ${missing ? 'missing ' + missing : 'no matched primary score'}. Missing results are not failures.`
            : `Rank ${row.rank} of ${result.cohortCount} by ${data.metrics[result.run.primary].label}. Computed before search; size, speed and complexity do not affect quality rank.`;
        const conditional = row.conditional
          ? `<p>Conditional mean boundary: ${row.conditional.mean_boundary.toFixed(5)} px on ${row.conditional.count.toLocaleString('en-US')} cases where both engines returned nonempty outlines for visible reference. Errors and empty outputs are excluded from this conditional value.</p>`
          : '';
        const popover = `<div id="${id}" popover class="rank-note svg-detail"><button class="rank-note-close" type="button" popovertarget="${id}" popovertargetaction="hide" aria-label="Close details">×</button><h3>${escape(model.name)}</h3><p>${escape(model.version)}</p><p>${escape(rankNote)}</p><p>${escape(model.note)}</p><p>${escape(row.note)}</p><dl>${details}</dl>${conditional}<p>${escape(row.attribution || 'maintainer-run')} · ${escape(data.sources[result.run.source_id].operator)}. <a href="${escape(data.sources[result.run.source_id].url)}" target="_blank" rel="noreferrer">Source ↗</a></p></div>`;
        return `<tr data-model="${escape(row.model)}"><td class="svg-rank" title="${escape(rankNote)}">${row.rank ?? '—'}</td><th scope="row"><span title="${escape(model.version)}">${escape(model.name)}</span><button class="rank-marker svg-info" type="button" popovertarget="${id}" aria-label="Details for ${escape(model.name)}">ⓘ</button>${popover}</th>${values}</tr>`;
      })
      .join('');
  }
  function renderDifferences(data) {
    const rows = (data.differences || [])
      .map((difference) => {
        const local = observation(data, difference.local),
          published = observation(data, difference.published);
        const cell = (item, ref) =>
          `<a href="${escape(data.sources[item.run.source_id].url)}">${format(item.value, metric(data, item.run, ref.metric))}</a>`;
        return `<tr><th scope="row">${escape(difference.label)}<small>${escape(difference.scope)}</small></th><td>${cell(local, difference.local)}</td><td>${cell(published, difference.published)}</td></tr>`;
      })
      .join('');
    return `<table class="svg-difference-table"><caption>SVG-Fonts · DINO scores</caption><thead><tr><th scope="col">Tracer</th><th scope="col">Our run</th><th scope="col">StarVector table</th></tr></thead><tbody>${rows}</tbody></table><p>The scores differ, but the pipelines are not matched: renderer, scoring size, inputs and baseline versions differ or remain unverified. A 64-image diagnostic did not resolve the gap. These values are kept separate.</p><p>Monotrace has no result in the published five-dataset panel. Its local scores cannot establish a matched win over StarVector or AutoTrace.</p>`;
  }
  return { views, materialize, select, format, renderHead, renderRows, renderDifferences };
});
