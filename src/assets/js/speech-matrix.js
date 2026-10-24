/* Speech corpus summaries use the shared percentile policy, with their own
   disjoint-corpus eligibility and source/availability qualifications. */
(function (root, make) {
  const api =
    typeof module === 'object' && module.exports
      ? make(require('./speech.js'), require('./ranking.js'), require('./rank-ui.js'))
      : make(root.BenchmarkSpeech, root.BenchmarkRank, root.BenchmarkRankUI);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkSpeechMatrix = api;
})(globalThis, (Speech, Rank, RankUI) => {
  const esc = Speech.escape,
    link = Speech.sourceLink;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);

  function rankingData(data, cutoff = data.config.snapshot_date) {
    const resultsByKey = {};
    for (const model of data.models)
      for (const test of data.accuracyTests) {
        const selected = Speech.summarize(data, test, model.id);
        if (selected.summary) resultsByKey[model.id + '|' + test.id] = [selected.summary];
      }
    const result = {
      ...data,
      resultsByKey,
      primaryTests: data.accuracyTests.filter((test) => test.primary),
      tests: data.accuracyTests,
      pricingByModel: {}
    };
    // These qualifications apply before display filters, to every dependent
    // percentile. A filtered view must not erase reference-cohort uncertainty.
    for (const test of data.accuracyTests.filter((test) => test.core)) {
      const cohort = Rank.scored(result, cutoff, test);
      const qualifications = [];
      if (
        cohort.some((row) => row.model.release_date == null || row.model.access === 'unreleased')
      ) {
        qualifications.push(
          `Comparison cohort for ${test.label} contains models with undated availability; these are included only in the current view.`
        );
      }
      if (
        cohort.some((row) =>
          row.obs.provisional_reasons?.some((reason) => reason.includes('disagree'))
        )
      ) {
        qualifications.push(
          `Comparison cohort for ${test.label} includes conflicting observations; preferred measurements are selected and alternatives retained.`
        );
      }
      for (const rows of Object.values(resultsByKey))
        for (const observation of rows) {
          if (observation.benchmark === test.id)
            observation.provisional_reasons = [
              ...(observation.provisional_reasons || []),
              ...qualifications
            ];
        }
    }
    return result;
  }

  function build(data, options = {}) {
    const cutoff = options.cutoff || data.config.snapshot_date;
    const prepared = rankingData(data, cutoff);
    const ranked = Rank.build(prepared, cutoff, { min: 0 });
    const byId = new Map(ranked.rows.map((row) => [row.id, row]));
    const view = options.view || 'matrix';
    const ids =
      view === 'small' || view === 'new'
        ? data.config.small_tests
        : view === 'secondary'
          ? data.config.secondary_tests
          : data.config.matrix_tests;
    const columns = ids.map((id) => data.accuracyTests.find((test) => test.id === id));
    const query = (options.query || '').trim().toLowerCase();
    const minimum = Number(options.min ?? data.config.default_families);
    const rows = data.models
      .filter((model) => Speech.available(model, cutoff, data.config.snapshot_date))
      .map((model) => {
        const existing = byId.get(model.id);
        const scores = Object.fromEntries(
          data.accuracyTests.map((test) => [
            test.id,
            prepared.resultsByKey[model.id + '|' + test.id]?.[0] || null
          ])
        );
        const count = new Set(
          prepared.primaryTests
            .filter((test) => Rank.rankable(scores[test.id]))
            .map((test) => test.family)
        ).size;
        const fallback = {
          id: model.id,
          name: model.name,
          rank: null,
          rankStatus: 'unranked',
          coreCount: 0,
          rankContributions: [],
          provisionalReasons: [],
          rankExplanation:
            'No aggregate index: this runtime variant is not the selected reference configuration for its weights identity. Its measurements remain available in protocol views.'
        };
        return {
          ...(existing || fallback),
          model,
          scores,
          count,
          size: Speech.selectSize(data, model.id),
          priceInfo: Speech.priceInfo(data, model)
        };
      })
      .filter((row) => {
        const shown = columns.some(
          (test) =>
            Rank.rankable(row.scores[test.id]) ||
            Object.values(Speech.summarize(data, test, row.id).scores).some(Rank.rankable)
        );
        if (view === 'small') {
          if (
            !shown ||
            !(
              (row.size?.download_mb != null && row.size.download_mb <= 1000) ||
              (row.size?.parameters_million != null && row.size.parameters_million <= 1000)
            )
          )
            return false;
        } else if (view === 'new') {
          if (
            !shown ||
            !data.rawRecords.some(
              (record) =>
                record.model === row.id &&
                ['author_reported', 'vendor_comparison'].includes(record.evidence)
            )
          )
            return false;
        } else if (view === 'secondary') {
          if (!shown) return false;
        } else if (row.count < minimum) return false;
        return (
          (!query ||
            (row.name + ' ' + row.model.organization + ' ' + row.model.hub_id)
              .toLowerCase()
              .includes(query)) &&
          (!options.access || options.access === 'all' || row.model.access === options.access) &&
          (!options.maxDownload ||
            (finite(row.size?.download_mb) &&
              row.size.download_mb <= Number(options.maxDownload))) &&
          (!options.maxParams ||
            (finite(row.size?.parameters_million) &&
              row.size.parameters_million <= Number(options.maxParams)))
        );
      });
    const sort = options.sort || (view === 'small' ? 'wer:' + data.config.default_test : 'score');
    const sortTest = sort.startsWith('wer:')
      ? data.accuracyTests.find((test) => test.id === sort.slice(4))
      : null;
    rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sortTest)
        return (
          (a.scores[sortTest.id]?.value ?? Infinity) - (b.scores[sortTest.id]?.value ?? Infinity) ||
          a.name.localeCompare(b.name)
        );
      if (sort === 'score')
        return (
          (b.rank ?? -1) - (a.rank ?? -1) ||
          b.coreCount - a.coreCount ||
          b.count - a.count ||
          a.name.localeCompare(b.name)
        );
      const value = (row) =>
        sort === 'download'
          ? row.size?.download_mb
          : sort === 'params'
            ? row.size?.parameters_million
            : sort === 'price' && row.priceInfo.record?.currency === 'USD'
              ? row.priceInfo.record.amount
              : null;
      return (
        (finite(value(a)) ? value(a) : Infinity) - (finite(value(b)) ? value(b) : Infinity) ||
        a.name.localeCompare(b.name)
      );
    });
    const ranges = Object.fromEntries(
      columns.map((test) => {
        const values = ranked.rows.map((row) => row.scores[test.id]?.value).filter(finite);
        return [test.id, values.length ? [Math.min(...values), Math.max(...values)] : [null, null]];
      })
    );
    return {
      mode: 'matrix',
      view,
      rows,
      columns,
      ranges,
      matureCount: ranked.matureCount,
      coreTotal: ranked.coreTotal,
      cutoff,
      sortTest
    };
  }

  function renderHead(result) {
    return (
      '<th scope="col">Model / configuration</th><th scope="col">Rank index</th>' +
      result.columns
        .map(
          (test) =>
            `<th scope="col" title="${esc(test.note)}">${esc(test.short || test.label)} ↓</th>`
        )
        .join('') +
      '<th scope="col" title="Reported model artifact size, not runtime RAM">Download (MB)</th><th scope="col" title="Reported parameter count in millions, not bytes">Parameters (M)</th><th scope="col">API USD / audio hour</th>'
    );
  }

  function renderRows(result, data) {
    if (!result.rows.length)
      return `<tr><td colspan="${result.columns.length + 5}">No models match this view and its filters. Choose All registered or another evidence view.</td></tr>`;
    return result.rows
      .map((row) => {
        const modelNote = [
          row.model.organization,
          row.model.configuration,
          row.model.release_date
            ? 'Released ' + row.model.release_date
            : 'Exact availability date unverified'
        ]
          .filter(Boolean)
          .join(' · ');
        // Expose every contributing component source, including all five language
        // files, without treating those components as additional rank votes.
        const rankRow = {
          ...row,
          rankContributions: (row.rankContributions || []).flatMap((item) =>
            item.observation.components?.length
              ? item.observation.components.map((component) => ({
                  ...item,
                  label: item.label + ' · ' + component.label,
                  observation: component
                }))
              : [item]
          )
        };
        const benchmarkTest =
          data.accuracyTests.find((test) => row.scores[test.id]) ||
          data.accuracyTests.find((test) =>
            Object.values(Speech.summarize(data, test, row.id).scores).some(Rank.rankable)
          );
        const benchmarkMetric =
          benchmarkTest && !row.scores[benchmarkTest.id]
            ? Object.values(Speech.summarize(data, benchmarkTest, row.id).scores).find(
                Rank.rankable
              )?.metric
            : '';
        const benchmarkButton = benchmarkTest
          ? `<button type="button" class="benchmark-link" data-benchmark="${esc(benchmarkTest.id)}" data-model="${esc(row.name)}" data-metric="${esc(benchmarkMetric)}">View benchmark rank</button>`
          : '';
        const index =
          row.rank == null
            ? `<span title="${esc(row.rankExplanation)}">No overall index</span>${benchmarkButton}`
            : RankUI.renderRank(rankRow, data.sources);
        const cells = result.columns
          .map((test) => {
            const observation = row.scores[test.id];
            if (!observation) {
              const partial = Object.values(Speech.summarize(data, test, row.id).scores).filter(
                Rank.rankable
              );
              return partial.length
                ? `<td class="score"><button type="button" class="benchmark-link" data-benchmark="${esc(test.id)}" data-model="${esc(row.name)}" data-metric="${esc(partial[0].metric)}">Partial: ${partial.length} metrics</button></td>`
                : '<td class="score" title="No matched published result in this protocol; not zero or proof of nonparticipation">—</td>';
            }
            const range = result.ranges[test.id],
              shade =
                !range || range[0] == null
                  ? 0
                  : range[0] === range[1]
                    ? 15
                    : (30 * (range[1] - observation.value)) / (range[1] - range[0]);
            const tooltip = [
              test.label,
              observation.derived ? 'Fixed-panel mean calculated here' : 'Published WER',
              'Execution operator: ' + observation.measurement_operator,
              observation.note,
              observation.components
                ?.map(
                  (component) =>
                    component.label +
                    ': ' +
                    component.value +
                    '% (' +
                    data.sources[component.source_id]?.title +
                    ')'
                )
                .join('; '),
              ...(observation.provisional_reasons || [])
            ]
              .filter(Boolean)
              .join(' · ');
            return `<td class="score" style="--shade:${Math.max(0, Math.min(30, shade)).toFixed(1)}%">${link(data.sources[observation.source_id], observation.value.toFixed(2), tooltip)}${Rank.qualification(observation) ? '<sup title="Qualified evidence; see source and rank explanation">†</sup>' : ''}</td>`;
          })
          .join('');
        const priceContext = (data.pricingContexts || []).find((record) => record.model === row.id);
        const priceId = 'speech-price-' + row.id;
        const priceDetails =
          row.priceInfo.record?.fx || priceContext?.fx
            ? `<button type="button" class="rank-marker" popovertarget="${esc(priceId)}" title="USD prices and source tariffs" aria-label="Price details for ${esc(row.name)}">ⓘ</button><div id="${esc(priceId)}" class="rank-note" popover="auto" role="dialog" aria-labelledby="${esc(priceId)}-title"><button type="button" class="rank-note-close" popovertarget="${esc(priceId)}" popovertargetaction="hide" aria-label="Close price details" autofocus>×</button><strong id="${esc(priceId)}-title">${esc(row.name)} · USD prices</strong>${Speech.renderPriceDetails(row.id, data)}</div>`
            : '';
        return (
          `<tr><th scope="row">${link(data.sources[row.model.source_id], row.name, modelNote)}</th><td class="index">${index}<small class="rank-coverage" title="${esc((row.rankContributions || []).map((item) => item.label).join(', ') || 'No contributing core families')}">${row.coreCount}/${result.coreTotal} families</small></td>${cells}` +
          Speech.renderSizeCells(row.size, data) +
          `<td class="price" title="${esc(row.priceInfo.note)}">${row.priceInfo.source_id ? link(data.sources[row.priceInfo.source_id], row.priceInfo.label) : esc(row.priceInfo.label)}${priceDetails}</td></tr>`
        );
      })
      .join('');
  }

  function timingRows(data, options = {}) {
    return data.throughput
      .filter(
        (record) =>
          record.status !== 'assumed' &&
          record.evidence !== 'assumed' &&
          (!options.test || record.test_id === options.test) &&
          (!options.hardware || record.hardware === options.hardware) &&
          (!options.sample || record.sample === options.sample) &&
          (!options.query ||
            data.models
              .find((model) => model.id === record.model)
              ?.name.toLowerCase()
              .includes(options.query.toLowerCase()))
      )
      .slice()
      .sort((a, b) => b.rtfx - a.rtfx);
  }

  function renderTiming(rows, data) {
    const names = new Map(data.models.map((model) => [model.id, model.name]));
    const tests = new Map(data.tests.map((test) => [test.id, test]));
    if (!rows.length)
      return '<tr><td colspan="7">No throughput measurements match this workload and hardware.</td></tr>';
    return rows
      .map(
        (record) =>
          `<tr><th scope="row">${esc(names.get(record.model))}</th><td>${record.rtfx.toFixed(2)}</td>` +
          `<td>${esc(record.hardware || 'Unspecified')}<br><small>${esc(record.runtime)}</small></td><td>${record.batch_size ?? '—'}</td>` +
          `<td>${esc(record.sample || tests.get(record.test_id)?.label)}${record.audio_seconds ? ' · ' + record.audio_seconds + 's' : ''}</td>` +
          `<td>${record.load_ms == null ? '—' : record.load_ms.toFixed(1) + ' ms'}</td>` +
          `<td class="pricing-note">${link(data.sources[record.source_id], 'Source ↗', [record.measurement_operator, record.note, tests.get(record.test_id)?.note, 'Engine: ' + (record.engine_sha || 'unspecified')].filter(Boolean).join(' · '))}<br><small>${esc(record.measured_on || 'Run date unspecified')}</small></td></tr>`
      )
      .join('');
  }

  return { build, rankingData, renderHead, renderRows, timingRows, renderTiming };
});
