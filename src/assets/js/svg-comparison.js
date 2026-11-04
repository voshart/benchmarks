(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SVGComparison = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function format(value, metric) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return value.toFixed(metric.precision) + (metric.unit || '');
  }
  function select(data, id, query = '', key, direction) {
    const run = data.runs.find((r) => r.id === id);
    if (!run) throw new Error('Unknown SVG protocol: ' + id);
    key = key === 'name' || run.columns.includes(key) ? key : run.primary;
    direction = direction || (key === 'name' ? 'asc' : data.metrics[key].direction);
    const q = query.trim().toLowerCase();
    const rows = run.rows.filter((r) =>
      [data.models[r.model].name, data.models[r.model].version, r.note]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
    rows.sort((a, b) => {
      const nameA = data.models[a.model].name,
        nameB = data.models[b.model].name;
      if (key === 'name') return nameA.localeCompare(nameB) * (direction === 'asc' ? 1 : -1);
      const x = a.values[key],
        y = b.values[key];
      const missingX = typeof x !== 'number' || !Number.isFinite(x),
        missingY = typeof y !== 'number' || !Number.isFinite(y);
      if (missingX !== missingY) return missingX ? 1 : -1;
      return !missingX && x !== y
        ? (x - y) * (direction === 'asc' ? 1 : -1)
        : nameA.localeCompare(nameB);
    });
    return { run, rows, key, direction };
  }
  function renderHead(result, data) {
    return ['name', ...result.run.columns]
      .map((key) => {
        const active = key === result.key;
        const label = key === 'name' ? 'Tracer / configuration' : data.metrics[key].label;
        return `<th scope="col" aria-sort="${active ? (result.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" data-svg-sort="${key}" title="${escape(key === 'name' ? 'Sort by tracer name' : data.metrics[key].description)}">${escape(label)}${active ? (result.direction === 'asc' ? ' ▴' : ' ▾') : ''}</button></th>`;
      })
      .join('');
  }
  function renderRows(result, data) {
    if (!result.rows.length)
      return `<tr><td colspan="${result.run.columns.length + 1}" class="svg-empty">No tracers match this search.</td></tr>`;
    return result.rows
      .map((row) => {
        const model = data.models[row.model],
          id = `svg-${result.run.id}-${row.model}`;
        const values = result.run.columns
          .map((key) => `<td>${format(row.values[key], data.metrics[key])}</td>`)
          .join('');
        const details = Object.entries(row.values)
          .filter(([key, value]) => data.metrics[key] && value !== null)
          .map(
            ([key, value]) =>
              `<dt>${escape(data.metrics[key].label)}</dt><dd>${format(value, data.metrics[key])}</dd>`
          )
          .join('');
        const conditional = row.conditional
          ? `<p>Conditional mean boundary: ${row.conditional.mean_boundary.toFixed(5)} px on ${row.conditional.count.toLocaleString('en-US')} cases where both engines returned nonempty outlines for visible reference. Errors and empty outputs are excluded from this conditional value.</p>`
          : '';
        return `<tr><th scope="row"><span>${escape(model.name)}</span><small class="svg-version">${escape(model.version)}</small><button class="benchmark-link" type="button" popovertarget="${id}" aria-label="Details for ${escape(model.name)}">Details</button><div id="${id}" popover class="rank-note svg-detail"><button class="rank-note-close" type="button" popovertarget="${id}" popovertargetaction="hide" aria-label="Close details">×</button><h3>${escape(model.name)}</h3><p>${escape(model.version)}</p><p>${escape(model.note)}</p><p>${escape(row.note)}</p><dl>${details}</dl>${conditional}<p>Execution: ${escape(data.sources[result.run.source_id].operator)}. <a href="${escape(data.sources[result.run.source_id].url)}" target="_blank" rel="noreferrer">Source record ↗</a></p></div></th>${values}</tr>`;
      })
      .join('');
  }
  return { select, format, renderHead, renderRows };
});
