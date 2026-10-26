/* Shared static/browser markup for the explicitly mapped OCR component views. */
(function (root, make) {
  const api = make(
    typeof module === 'object' && module.exports ? require('./rank-ui.js') : root.BenchmarkRankUI
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCRDimensionsView = api;
})(globalThis, (RankUI) => {
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const sourceLink = (observation, sources) => {
    const source = sources[observation.source_id],
      url = observation.source_url || source?.url;
    const label = source?.title || observation.source_id || 'Source not recorded';
    return /^https?:\/\//.test(url || '')
      ? `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`
      : escape(label);
  };
  const popover = (id, label, body, marker = 'ⓘ') =>
    `<button type="button" class="rank-marker" popovertarget="${id}" aria-label="${escape(label)}">${marker}</button><div id="${id}" class="rank-note" popover><button type="button" class="rank-note-close" popovertarget="${id}" popovertargetaction="hide" aria-label="Close details">×</button>${body}</div>`;
  const identity = (row, test) => 'dimension-' + encodeURIComponent(row.id + ':' + test.id);
  const observed = (row) =>
    typeof row.value === 'number' &&
    Number.isFinite(row.value) &&
    row.evidence !== 'assumed' &&
    row.status !== 'assumed';

  function renderHead(result) {
    const columns = [
      { id: 'model', short: 'Model', label: 'Model name' },
      ...(result.view.mode === 'rating'
        ? [
            {
              id: 'rank',
              short: 'Table rating',
              label: 'Experimental relative rating; not accuracy'
            }
          ]
        : []),
      {
        id: 'families',
        short: 'Families',
        label: result.view.mode === 'rating' ? 'Eligible comparison families' : 'Reported families'
      },
      ...result.columns
    ];
    return columns
      .map((column) => {
        const active = column.id === result.sortKey;
        const state = active
          ? result.sortDirection === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none';
        const unit = column.unit === 'percent' ? ' (%)' : column.unit === 'ratio' ? ' (ratio)' : '';
        const better = column.direction === 'lower' ? ' · lower is better' : ' · higher is better';
        const title = column.label + (column.unit ? better : '');
        const arrow = active ? (result.sortDirection === 'asc' ? '↑' : '↓') : '↕';
        return `<th scope="col" aria-sort="${state}"><button type="button" class="column-sort" data-dimension-sort="${escape(column.id)}" title="${escape(title)}">${escape(column.short + unit)} ${arrow}</button></th>`;
      })
      .join('');
  }

  function renderObservation(observation, test, sources, alternate) {
    const source = sources[observation.source_id];
    const details = [
      observation.comparable === false && 'Context only; excluded from rating.',
      observation.measurement_operator && 'Operator: ' + observation.measurement_operator,
      observation.configuration,
      observation.dataset_scope || observation.dataset_version || test.parent.scope,
      observation.run_date && 'Run: ' + observation.run_date,
      observation.verified_on && 'Source checked: ' + observation.verified_on,
      observation.note,
      source?.note,
      ...(observation.provisional_reasons || [])
    ].filter(Boolean);
    return `<li><strong>${alternate ? 'Alternative: ' : ''}${escape(observation.value)}${test.unit === 'percent' ? '%' : ' ratio'}</strong> · ${escape(observation.evidence || 'unclassified')}<br>${sourceLink(observation, sources)}<p>Recorded metric: <code>${escape(observation.component_key)}</code>.</p>${[...new Set(details)].map((note) => `<p>${escape(note)}</p>`).join('')}</li>`;
  }

  function renderCell(row, test, result) {
    const observation = row.scores[test.id];
    if (!observation) return '<td><span aria-label="No reported component">—</span></td>';
    const alternatives = (result.resultsByKey[row.id + '|' + test.id] || []).filter(
      (other) => other !== observation && observed(other)
    );
    const context = observation.comparable === false ? '‡' : '';
    const qualified = !['official', 'third_party'].includes(observation.evidence) ? '*' : '';
    const value = String(Number(observation.value.toFixed(test.unit === 'percent' ? 1 : 4)));
    const heading = `${row.name} · ${test.label}`;
    const body =
      `<strong>${escape(heading)}</strong><p>${test.direction === 'lower' ? 'Lower' : 'Higher'} is better. ${test.aggregate_eligible ? 'Eligible table-rating component.' : 'Diagnostic only; no rating vote.'}</p>` +
      (test.panel.note ? `<p>${escape(test.panel.note)}</p>` : '') +
      `<ul>${[observation, ...alternatives].map((item, i) => renderObservation(item, test, result.sources, i > 0)).join('')}</ul>`;
    return `<td>${escape(value)}${context || qualified}${popover(identity(row, test), 'Source details: ' + heading, body)}</td>`;
  }

  function renderRating(row, sources) {
    // The shared popover reads source IDs; preserve component-specific URL overrides too.
    const contributionSources = {};
    const rankContributions = row.rankContributions.map((item, index) => {
      const sourceId = 'component-contribution-' + index;
      contributionSources[sourceId] = {
        url: item.observation.source_url || sources[item.observation.source_id]?.url
      };
      return { ...item, observation: { ...item.observation, source_id: sourceId } };
    });
    return RankUI.renderRank({ ...row, rankContributions }, contributionSources);
  }

  function renderRows(result) {
    if (!result.rows.length) {
      const span = result.columns.length + (result.view.mode === 'rating' ? 3 : 2);
      return `<tr><td colspan="${span}">No reported components match these filters.</td></tr>`;
    }
    return result.rows
      .map((row) => {
        let rating = '';
        if (result.view.mode === 'rating') {
          const html =
            row.rank === null
              ? '—' +
                popover(
                  identity(row, { id: 'rating' }),
                  'Why ' + row.name + ' has no table rating',
                  `<strong>No table rating</strong><p>${escape(row.rankExplanation).replace(/\n/g, '<br>')}</p>`
                )
              : renderRating(row, result.sources);
          rating = `<td>${html}</td>`;
        }
        return `<tr><th scope="row">${escape(row.name)}</th>${rating}<td>${row.count}</td>${result.columns.map((test) => renderCell(row, test, result)).join('')}</tr>`;
      })
      .join('');
  }

  function status(result) {
    return (
      `${result.rows.length} shown / ${result.cohortCount} models with reported components` +
      (result.view.mode === 'rating'
        ? ` · ${result.ratedCount} eligible table ratings in the unfiltered cohort`
        : ' · benchmark-specific comparisons; no combined rating')
    );
  }
  return { escape, renderHead, renderRows, status };
});
