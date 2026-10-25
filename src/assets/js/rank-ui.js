/* Identical rank markup for static pages and browser refreshes. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkRankUI = api;
})(globalThis, () => {
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const sourceLink = (source, label) =>
    source && /^https?:\/\//.test(source.url)
      ? `<a href="${escape(source.url)}" target="_blank" rel="noreferrer">${escape(label)}</a>`
      : escape(label);

  function renderRank(row, sources = {}) {
    if (row.rank == null) return `<span title="${escape(row.rankExplanation)}">Unranked</span>`;
    const value = row.rank.toFixed(1);
    const label = row.rankMethod === 'pairwise' ? 'estimated rating' : 'provisional rank';
    const accessibleLabel =
      row.rankMethod === 'pairwise'
        ? `Explain ${row.name} estimated rating`
        : `Why ${row.name} has a provisional rank`;
    if (row.rankStatus !== 'provisional')
      return `<span title="${escape(row.rankExplanation)}">${value}</span>`;
    const id = 'rank-note-' + row.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const links = (row.rankContributions || [])
      .map((item) => `<li>${sourceLink(sources[item.observation.source_id], item.label)}</li>`)
      .join('');
    return (
      `${value}<button type="button" class="rank-marker" popovertarget="${id}" title="${escape(row.rankExplanation)}" aria-label="${escape(accessibleLabel)}" aria-describedby="${id}">◊</button>` +
      `<div id="${id}" class="rank-note" popover><button type="button" class="rank-note-close" popovertarget="${id}" popovertargetaction="hide" aria-label="Close rank explanation">×</button>` +
      `<strong>${escape(row.name)} · ${label}</strong><p>${escape(row.rankExplanation).replace(/\n/g, '<br>')}</p>` +
      (links ? `<small>Contributing sources</small><ul>${links}</ul>` : '') +
      '</div>'
    );
  }

  function scoreTooltip(observation, data, model, benchmark) {
    if (!observation) return 'No comparable measured result';
    const source = data.sources[observation.source_id];
    const pieces = [
      source?.title,
      observation.evidence,
      observation.configuration,
      observation.note || source?.note
    ].filter(Boolean);
    const alternatives = (data.resultsByKey[model + '|' + benchmark] || []).filter(
      (other) =>
        other !== observation &&
        other.source_id !== observation.source_id &&
        typeof other.value === 'number'
    );
    if (alternatives.length)
      pieces.push(
        'Other published observations: ' +
          alternatives
            .map(
              (other) =>
                `${other.value} (${other.evidence}; ${data.sources[other.source_id]?.title || other.source_id})`
            )
            .join('; ')
      );
    return pieces.join(' · ');
  }
  return { renderRank, scoreTooltip };
});
