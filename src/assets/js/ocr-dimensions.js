/* Component-only comparisons. Never modifies the overall OCR or speech graph. */
(function (root, make) {
  const api =
    typeof module === 'object' && module.exports
      ? make(require('./ranking.js'), require('./pairwise-ranking.js'))
      : make(root.BenchmarkRank, root.BenchmarkPairwise);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OCRDimensions = api;
})(globalThis, (Rank, Pairwise) => {
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const observed = (row) =>
    row && finite(row.value) && row.evidence !== 'assumed' && row.status !== 'assumed';
  const records = (data) => data.rawRecords ?? data.records ?? [];

  function validatePolicy(data, policy) {
    if (policy?.version !== 1 || !policy.views) throw Error('Invalid dimension policy');
    const tests = new Map(data.tests.map((test) => [test.id, test]));
    for (const [name, view] of Object.entries(policy.views)) {
      if (!/^[a-z-]+$/.test(name) || !['rating', 'diagnostic'].includes(view.mode))
        throw Error(`Invalid dimension: ${name}`);
      if (view.mode === 'rating' && (!Number.isInteger(view.min_families) || view.min_families < 2))
        throw Error(`Dimension ${name} requires at least two comparison families`);
      if (!Array.isArray(view.panels) || !view.panels.length)
        throw Error(`Dimension ${name} has no panels`);
      const ids = new Set();
      for (const panel of view.panels) {
        if (
          !/^[a-z0-9-]+$/.test(panel.id) ||
          ids.has(panel.id) ||
          ['model', 'rank', 'families'].includes(panel.id)
        )
          throw Error(`Duplicate or invalid dimension panel: ${panel.id}`);
        ids.add(panel.id);
        if (!tests.has(panel.benchmark)) throw Error(`Unknown protocol: ${panel.benchmark}`);
        if (
          !Array.isArray(panel.keys) ||
          !panel.keys.length ||
          panel.keys.some((key) => !/^[a-z0-9_]+$/.test(key)) ||
          new Set(panel.keys).size !== panel.keys.length ||
          !['percent', 'ratio'].includes(panel.unit) ||
          !['higher', 'lower'].includes(panel.direction) ||
          (panel.rating != null && typeof panel.rating !== 'boolean')
        )
          throw Error(`Invalid component mapping: ${panel.id}`);
        if (panel.rating && view.mode !== 'rating')
          throw Error(`Diagnostic panel cannot contribute a rating: ${panel.id}`);
        if (panel.priority != null && !Number.isFinite(panel.priority))
          throw Error(`Invalid component priority: ${panel.id}`);
      }
    }
    return true;
  }

  function project(data, policy, dimension) {
    validatePolicy(data, policy);
    const view = policy.views[dimension];
    if (!view) throw Error(`Unknown dimension: ${dimension}`);
    const byProtocol = new Map();
    for (const record of records(data)) {
      if (!byProtocol.has(record.benchmark)) byProtocol.set(record.benchmark, []);
      byProtocol.get(record.benchmark).push(record);
    }
    const resultsByKey = {};
    const tests = view.panels.map((panel, index) => {
      const parent = data.tests.find((test) => test.id === panel.benchmark);
      const test = {
        id: panel.id,
        label: `${parent.label} · ${panel.label}`,
        short: panel.short,
        family: parent.family,
        source: parent.source,
        primary_metric: 'component',
        unit: panel.unit,
        direction: panel.direction,
        core: false,
        aggregate_eligible: view.mode === 'rating' && panel.rating === true,
        aggregate_priority: panel.priority ?? index,
        aggregate_caveat: panel.note,
        parent,
        panel
      };
      for (const record of byProtocol.get(panel.benchmark) || []) {
        const keys = panel.keys.filter((key) => finite(record.metrics?.[key]));
        if (!keys.length) continue; // No substitution of headline scores, zeros or other tasks.
        const key = keys[0],
          value = record.metrics[key];
        const conflict = keys.some((alias) => record.metrics[alias] !== value);
        const componentId = record.component_source_id;
        const sourceId = componentId || record.source_id;
        const source = data.sources[sourceId];
        const unclassifiedComponent =
          !componentId &&
          record.component_source_url &&
          record.component_source_url !== record.source_url &&
          record.component_source_url !== source?.url;
        const evidence =
          record.component_evidence ||
          (unclassifiedComponent
            ? 'research'
            : componentId && componentId !== record.source_id
              ? source?.kind || 'research'
              : record.evidence || source?.kind || 'imported');
        const reasons = [...(record.provisional_reasons || [])];
        if (conflict) reasons.push('Conflicting metric aliases; context only, excluded from rating.');
        if (unclassifiedComponent)
          reasons.push('Component URL has no separately classified execution provenance.');
        const observation = {
          ...record,
          benchmark: panel.id,
          parent_benchmark: panel.benchmark,
          component_key: key,
          value,
          evidence,
          source_id: sourceId,
          source_url: record.component_source_url || (componentId ? source?.url : record.source_url),
          comparable:
            record.comparable !== false &&
            !conflict &&
            !!source &&
            data.sources[parent.source]?.kind !== 'vendor_internal' &&
            source.kind !== 'vendor_internal' &&
            source.kind !== 'assumed',
          provisional_reasons: reasons
        };
        (resultsByKey[record.model + '|' + panel.id] ??= []).push(observation);
      }
      return test;
    });
    return { config: data.config, sources: data.sources, tests, resultsByKey, view, dimension };
  }

  function sortRows(rows, key, direction) {
    const value = (row) =>
      key === 'model'
        ? row.name
        : key === 'rank'
          ? row.rank
          : key === 'families'
            ? row.count
            : row.scores[key]?.value;
    return [...rows].sort((a, b) => {
      const x = value(a),
        y = value(b);
      if (x == null || y == null)
        return x == null && y == null ? a.name.localeCompare(b.name) : x == null ? 1 : -1;
      const delta = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return (direction === 'asc' ? delta : -delta) || a.name.localeCompare(b.name);
    });
  }

  function defaultDirection(key, result) {
    return key === 'model' || result.columns.find((test) => test.id === key)?.direction === 'lower'
      ? 'asc'
      : 'desc';
  }

  function build(data, policy, dimension, options = {}) {
    const projected = project(data, policy, dimension),
      view = projected.view;
    const cutoff = options.cutoff || data.config.snapshot_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !Number.isFinite(Date.parse(cutoff)))
      throw Error('Invalid model release cutoff');
    const models = Rank.latestByLine(
      data.models.filter((model) =>
        model.release_date ? model.release_date <= cutoff : cutoff >= data.config.snapshot_date
      )
    );
    // Fit before UI filtering. Sparse configurations can connect the graph, but do not get
    // a displayed table rating unless their own comparison-family coverage meets the policy.
    const pairwise =
      view.mode === 'rating'
        ? Pairwise.build(projected, models, Rank.choose, Rank.qualification)
        : null;
    const cohort = models
      .map((model) => {
        const scores = Object.fromEntries(
          projected.tests.map((test) => [test.id, Rank.choose(projected, model.id, test.id)])
        );
        if (!Object.values(scores).some(observed)) return null;
        const result = pairwise?.rows.get(model.id);
        const count = result
          ? result.count
          : new Set(projected.tests.filter((test) => observed(scores[test.id])).map((t) => t.family))
              .size;
        let rank = result?.rank ?? null;
        let explanation = result?.rankExplanation || 'Separate reported metrics; no combined rating.';
        if (view.mode === 'rating') {
          if (count < view.min_families) {
            rank = null;
            explanation =
              `Insufficient table coverage: ${count} comparison families; ` +
              `${view.min_families} required. Reported components remain visible.\n${explanation}`;
          }
          explanation =
            'Experimental table-performance rating, not overall OCR accuracy. ' +
            'Only explicitly mapped table components enter this graph. ' +
            'Family coverage does not establish independent datasets or statistical confidence.\n' +
            explanation;
        }
        return {
          ...result,
          id: model.id,
          name: model.name,
          access: model.access,
          scores,
          count,
          rank,
          rankStatus: rank === null ? 'unranked' : 'provisional',
          rankExplanation: explanation,
          rankContributions: result?.rankContributions || []
        };
      })
      .filter(Boolean);
    const query = String(options.query || '').trim().toLowerCase();
    const minimum = Math.max(0, Number(options.min) || 0);
    const filtered = cohort.filter(
      (row) =>
        row.count >= minimum &&
        (options.access == null || options.access === 'all' || row.access === options.access) &&
        (!query || (row.name + ' ' + row.id).toLowerCase().includes(query))
    );
    const defaultKey = view.mode === 'rating' ? 'rank' : 'model';
    const allowed = new Set([
      'model',
      'families',
      ...(view.mode === 'rating' ? ['rank'] : []),
      ...projected.tests.map((test) => test.id)
    ]);
    const sortKey = allowed.has(options.sortKey) ? options.sortKey : defaultKey;
    const sortDirection = ['asc', 'desc'].includes(options.sortDirection)
      ? options.sortDirection
      : defaultDirection(sortKey, { columns: projected.tests });
    return {
      ...projected,
      columns: projected.tests,
      rows: sortRows(filtered, sortKey, sortDirection),
      cutoff,
      sortKey,
      sortDirection,
      cohortCount: cohort.length,
      ratedCount: cohort.filter((row) => row.rank !== null).length,
      familyCount: pairwise?.familyCount ?? new Set(projected.tests.map((t) => t.family)).size
    };
  }
  return { validatePolicy, project, build, sortRows, defaultDirection };
});
