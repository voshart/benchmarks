/* Shared pure ranking engine: CommonJS + browser global. */
(function(root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkRank = api;
})(globalThis, () => {
  const valid = value => typeof value === 'number' && Number.isFinite(value);
  const releases = (models, date, latest) => models.filter(m => m.release_date ? m.release_date <= date : date >= latest);
  const observed = observation => observation && valid(observation.value) && observation.evidence !== 'assumed' && observation.status !== 'assumed';
  const rankable = observation => observed(observation) && observation.evidence !== 'vendor_internal' && observation.comparable !== false;
  const evidenceOrder = {official:0, third_party:1, community:2, author_reported:3, vendor_comparison:4, vendor:4, mixed:5, research:5, imported:6, secondary:7, vendor_internal:8};

  function choose(data, model, test) {
    return (data.resultsByKey[model + '|' + test] || []).filter(observed).slice()
      .sort((a, b) => (evidenceOrder[a.evidence] ?? 6) - (evidenceOrder[b.evidence] ?? 6))[0] || null;
  }

  function latestByLine(rows) {
    const kept = [], lines = new Map();
    for (const item of rows) {
      const model = item.model || item;
      if (!model.lineage) {kept.push(item); continue;}
      const old = lines.get(model.lineage);
      if (!old || (model.release_date || '') > ((old.model || old).release_date || '')) lines.set(model.lineage, item);
    }
    return kept.concat([...lines.values()]);
  }

  function scored(data, cutoff, test) {
    if (data.sources[test.source]?.kind === 'vendor_internal') return [];
    return latestByLine(releases(data.models, cutoff, data.config.snapshot_date)
      .map(model => ({model, obs:choose(data, model.id, test.id)})).filter(row => rankable(row.obs)));
  }

  function maturity(rows, test) {
    const organizations = new Set(rows.map(row => row.model.organization).filter(Boolean));
    return {n:rows.length, orgs:organizations.size,
      active:rows.length >= (test.min_models || 6) && organizations.size >= (test.min_organizations || 3)};
  }

  function pctRanks(rows, test) {
    const ordered = [...rows].sort((a,b) => test.direction === 'lower' ? a.obs.value-b.obs.value : b.obs.value-a.obs.value);
    const result = new Map(), n = ordered.length;
    for (let i=0; i<n;) {
      let j=i+1;
      while (j<n && ordered[j].obs.value === ordered[i].obs.value) j++;
      const middle = ((i+1)+j)/2;
      for (let k=i; k<j; k++) result.set(ordered[k].model.id, n <= 1 ? 100 : 100*(n-middle)/(n-1));
      i=j;
    }
    return result;
  }

  function qualification(observation) {
    if (!observation) return null;
    return ({author_reported:'author-reported', vendor_comparison:'competitor/vendor comparison', vendor:'vendor-operated',
      mixed:'mixed or incompletely attributed', imported:'imported and unverified', secondary:'secondary-source',
      research:'execution operator not established', community:'community execution operator not established'})[observation.evidence]
      || (!['official','third_party'].includes(observation.evidence) ? 'execution operator not established' : null);
  }

  function build(data, cutoff=data.config.snapshot_date, opts={}) {
    const minimum = Number(opts.min ?? data.config.default_families), view = opts.view || 'all';
    const access = opts.access || 'all', query = (opts.query || '').trim().toLowerCase();
    const models = latestByLine(releases(data.models, cutoff, data.config.snapshot_date));
    const core = data.tests.filter(test => test.core);
    // Select one mature variant for each family, globally, before applying UI filters.
    const candidates = core.map(test => {
      const cohort = scored(data, cutoff, test), state = maturity(cohort, test);
      return {test, cohort, ...state, ranks:state.active ? pctRanks(cohort, test) : new Map()};
    }).filter(item => item.active).sort((a,b) => (a.test.rank_priority || 0)-(b.test.rank_priority || 0) || a.test.id.localeCompare(b.test.id));
    const byFamily = new Map();
    for (const item of candidates) if (!byFamily.has(item.test.family)) byFamily.set(item.test.family, item);
    const eligible = [...byFamily.values()];
    const groups = {structure:['omnidoc-v16','puredoc','docparsing'], robust:['wild','real5','drdoc'],
      multilingual:['mdp-private','mdp-public','more'], production:['ndi','idp'],
      recognition:['pubtabnet-xiaomi','unimer-test-xiaomi','chronicles-mature-xiaomi'], understanding:['ocr-vqa-xiaomi'],
      new:['omnidoc-v16','wild','real5','mdp-public','pubtabnet-xiaomi','unimer-test-xiaomi','chronicles-mature-xiaomi','ocr-vqa-xiaomi']};
    const ids = groups[view];
    const show = data.tests.filter(test => view === 'secondary' ? !data.primaryTests.some(p => p.id === test.id)
      : view === 'all' ? data.primaryTests.some(p => p.id === test.id) : ids ? ids.includes(test.id) : test.family === view);
    const fullMinimum = data.config.min_core_for_rank;
    const provisionalMinimum = data.config.min_core_for_provisional ?? 2;
    const rows = models.map(model => {
      const scores = Object.fromEntries(data.tests.map(test => [test.id,choose(data,model.id,test.id)]));
      const count = new Set((data.coverageTests || data.primaryTests).filter(test => observed(scores[test.id])).map(test => test.family)).size;
      const contributions = eligible.filter(item => item.ranks.has(model.id)).map(item => ({
        benchmark:item.test.id, label:item.test.label, family:item.test.family, percentile:item.ranks.get(model.id),
        observation:scores[item.test.id], cohort:item.cohort
      }));
      const reasons = [];
      const rank = contributions.length >= provisionalMinimum
        ? contributions.reduce((total,item) => total+item.percentile,0)/contributions.length : null;
      if (rank !== null) {
        if (contributions.length < fullMinimum) reasons.push(`Limited coverage: ${contributions.length} mature core families; ${fullMinimum} required for full coverage.`);
        const own = new Map(), cohort = new Map();
        for (const item of contributions) {
          const type = qualification(item.observation);
          if (type) (own.get(type) || (own.set(type,[]),own.get(type))).push(item.label);
          for (const row of item.cohort) {
            const cohortType = qualification(row.obs);
            if (cohortType) (cohort.get(cohortType) || (cohort.set(cohortType,new Set()),cohort.get(cohortType))).add(item.label);
          }
        }
        for (const [type,labels] of own) reasons.push(`Contributing evidence is ${type}: ${labels.join(', ')}.`);
        for (const [type,labels] of cohort) reasons.push(`Comparison cohorts include ${type} results: ${[...labels].join(', ')}.`);
        for (const item of contributions) {
          const alternatives = (data.resultsByKey[model.id+'|'+item.benchmark] || []).filter(observed);
          if (alternatives.some(obs => obs.value !== item.observation.value)) reasons.push(`Published observations disagree on ${item.label}; the preferred source is used and alternatives are preserved.`);
          if (item.observation.provisional_reasons) reasons.push(...item.observation.provisional_reasons);
        }
        if (model.release_date == null) reasons.push('Model release date is unknown or weights are unreleased; included only in the latest view.');
      }
      const rankStatus = rank === null ? 'unranked' : reasons.length ? 'provisional' : 'supported';
      const rankExplanation = rank === null
        ? `No aggregate index: ${contributions.length} mature core families with comparable measured results; at least ${provisionalMinimum} required. Assumed scores, internal tests and overlapping secondary variants are excluded.`
        : [`Mean percentile across ${contributions.length} mature core families: ${contributions.map(item=>item.label).join(', ')}.`, ...reasons].join('\n');
      return {id:model.id, name:model.name, access:model.access, release_date:model.release_date, count, coreCount:contributions.length,
        rank, rankStatus, provisionalReasons:reasons, rankExplanation,
        rankContributions:contributions.map(({cohort,...item}) => item), price:data.pricingByModel[model.id]?.usd_per_1000_pages ?? null, scores};
    }).filter(row => (view==='new' ? show.some(test => (data.resultsByKey[row.id+'|'+test.id] || []).some(obs=>obs.evidence==='author_reported'))
      : ['recognition','understanding','secondary'].includes(view) ? show.some(test=>observed(row.scores[test.id])) : row.count>=minimum)
      && (!query || row.name.toLowerCase().includes(query)) && (access==='all' || row.access===access));
    rows.sort((a,b) => (b.rank ?? -1)-(a.rank ?? -1) || b.coreCount-a.coreCount || b.count-a.count || a.name.localeCompare(b.name));
    const ranges = Object.fromEntries(show.map(test => {
      const values = rows.map(row=>row.scores[test.id]?.value).filter(valid);
      return [test.id,values.length ? [Math.min(...values),Math.max(...values)] : [null,null]];
    }));
    return {rows,columns:show,ranges,matureCount:eligible.length,coreTotal:new Set(core.map(test=>test.family)).size};
  }
  return {build,scored,maturity,pctRanks,choose,latestByLine,rankable,qualification};
});
