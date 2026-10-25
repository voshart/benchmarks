/* OCR v4: deterministic, family-balanced Bradley–Terry estimates. */
(function (root, make) {
  const api = make();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchmarkPairwise = api;
})(globalThis, () => {
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const identity = (model) => model.ranking_identity || model.id;
  const pairKey = (a, b) => JSON.stringify([a, b].sort());

  function graph(data, models, choose) {
    const nodes = [...models].sort((a, b) => a.id.localeCompare(b.id));
    const panels = data.tests
      .filter(
        (t) =>
          (t.core || t.aggregate_eligible) && data.sources[t.source]?.kind !== 'vendor_internal'
      )
      .slice()
      .sort(
        (a, b) =>
          (a.aggregate_priority ?? (a.core ? 0 : 1000)) -
            (b.aggregate_priority ?? (b.core ? 0 : 1000)) || a.id.localeCompare(b.id)
      );
    const families = new Map();
    for (const test of panels) {
      const cohort = nodes
        .map((model, i) => ({ model, i, obs: choose(data, model.id, test.id, false, true) }))
        .filter((row) => row.obs);
      if (new Set(cohort.map((row) => identity(row.model))).size < 2) continue;
      const pairs = families.get(test.family) || new Map();
      families.set(test.family, pairs);
      for (let i = 0; i < cohort.length; i++)
        for (let j = i + 1; j < cohort.length; j++) {
          const a = cohort[i],
            b = cohort[j];
          if (identity(a.model) === identity(b.model)) continue;
          const key = pairKey(a.model.id, b.model.id);
          if (pairs.has(key)) continue; // First shared protocol, never the best result.
          const difference = (a.obs.value - b.obs.value) * (test.direction === 'lower' ? -1 : 1);
          pairs.set(key, {
            a: a.i,
            b: b.i,
            outcome: difference === 0 ? 0.5 : difference > 0 ? 1 : 0,
            family: test.family,
            test,
            observations: [a.obs, b.obs],
            cohortSize: cohort.length
          });
        }
    }
    const edges = [];
    for (const pairs of families.values()) {
      const opponents = new Map(),
        groups = new Map();
      for (const edge of pairs.values()) {
        const a = identity(nodes[edge.a]),
          b = identity(nodes[edge.b]);
        for (const [x, y] of [
          [a, b],
          [b, a]
        ]) {
          if (!opponents.has(x)) opponents.set(x, new Set());
          opponents.get(x).add(y);
        }
        const key = pairKey(a, b);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
      }
      for (const group of groups.values())
        for (const edge of group) {
          const a = identity(nodes[edge.a]),
            b = identity(nodes[edge.b]);
          // Each identity allocates one family budget across its opponents. Average
          // both allocations, then share that budget across configuration variants.
          // Total family weight grows linearly with identities, never quadratically.
          edge.weight =
            (1 / opponents.get(a).size + 1 / opponents.get(b).size) / (2 * group.length);
          edges.push(edge);
        }
    }
    const adjacent = nodes.map(() => []);
    for (const edge of edges) {
      adjacent[edge.a].push(edge);
      adjacent[edge.b].push(edge);
    }
    const seen = new Set(),
      components = [];
    for (let i = 0; i < nodes.length; i++) {
      if (seen.has(i) || !adjacent[i].length) continue;
      const members = [i];
      seen.add(i);
      for (let p = 0; p < members.length; p++)
        for (const e of adjacent[members[p]]) {
          const other = e.a === members[p] ? e.b : e.a;
          if (!seen.has(other)) {
            seen.add(other);
            members.push(other);
          }
        }
      components.push(members);
    }
    components.sort(
      (a, b) =>
        new Set(b.map((i) => identity(nodes[i]))).size -
          new Set(a.map((i) => identity(nodes[i]))).size ||
        nodes[a[0]].id.localeCompare(nodes[b[0]].id)
    );
    const identityCounts = new Map();
    for (const i of seen)
      identityCounts.set(identity(nodes[i]), (identityCounts.get(identity(nodes[i])) || 0) + 1);
    return {
      nodes,
      edges,
      adjacent,
      components,
      priorShares: nodes.map((m) => 1 / (identityCounts.get(identity(m)) || 1))
    };
  }

  // Convex penalized logistic objective; no synthetic results are added to the evidence.
  function fit(graph, prior = 0.25) {
    if (!(Number.isFinite(prior) && prior > 0)) throw Error('Pairwise prior must be positive');
    const strengths = graph.nodes.map(() => 0);
    let residual = Infinity,
      iterations = 0;
    for (; iterations < 1000; iterations++) {
      for (let i = 0; i < strengths.length; i++) {
        if (!graph.adjacent[i].length) continue;
        const penalty = prior * graph.priorShares[i];
        let gradient = penalty * strengths[i],
          curvature = penalty;
        for (const e of graph.adjacent[i]) {
          const other = e.a === i ? e.b : e.a;
          const target = e.a === i ? e.outcome : 1 - e.outcome;
          const p = sigmoid(strengths[i] - strengths[other]);
          gradient += e.weight * (p - target);
          curvature += e.weight * p * (1 - p);
        }
        const loss = (value) =>
          graph.adjacent[i].reduce(
            (sum, e) => {
              const other = e.a === i ? e.b : e.a;
              const target = e.a === i ? e.outcome : 1 - e.outcome;
              const d = value - strengths[other];
              return (
                sum + e.weight * (Math.max(d, 0) + Math.log1p(Math.exp(-Math.abs(d))) - target * d)
              );
            },
            (penalty * value * value) / 2
          );
        let step = gradient / curvature;
        const before = loss(strengths[i]);
        while (Math.abs(step) > 1e-12 && loss(strengths[i] - step) > before + 1e-14) step /= 2;
        strengths[i] -= step;
      }
      residual = 0;
      for (let i = 0; i < strengths.length; i++) {
        let gradient = prior * graph.priorShares[i] * strengths[i];
        for (const e of graph.adjacent[i]) {
          const other = e.a === i ? e.b : e.a;
          gradient +=
            e.weight *
            (sigmoid(strengths[i] - strengths[other]) - (e.a === i ? e.outcome : 1 - e.outcome));
        }
        residual = Math.max(residual, Math.abs(gradient));
      }
      if (residual < 1e-9) break;
    }
    if (residual >= 1e-7) throw Error('Pairwise rating did not converge');
    return { strengths, residual, iterations: iterations + 1 };
  }

  function build(data, models, choose, qualification) {
    const g = graph(data, models, choose),
      solution = fit(g, data.config.pairwise_prior ?? 0.25);
    const main = new Set(g.components[0] || []),
      rows = new Map();
    const componentSources = new Map();
    for (const e of g.edges)
      if (main.has(e.a))
        for (const obs of e.observations) {
          const label = qualification(obs);
          if (label) componentSources.set(label, true);
        }
    for (let i = 0; i < g.nodes.length; i++) {
      const model = g.nodes[i],
        edges = g.adjacent[i];
      const families = new Set(edges.map((e) => e.family));
      const opponents = new Set(edges.map((e) => identity(g.nodes[e.a === i ? e.b : e.a])));
      const contributions = new Map();
      for (const e of edges)
        if (!contributions.has(e.test.id))
          contributions.set(e.test.id, {
            benchmark: e.test.id,
            label: e.test.label,
            family: e.family,
            observation: e.observations[e.a === i ? 0 : 1],
            cohortSize: e.cohortSize,
            variant: !e.test.core,
            panelCaveat: e.test.aggregate_caveat || null
          });
      const reasons = [];
      if (families.size < 3)
        reasons.push(
          `Limited coverage: ${families.size} comparison ${families.size === 1 ? 'family' : 'families'}.`
        );
      if (opponents.size < 5)
        reasons.push(`Sparse comparison: ${opponents.size} distinct opponent identities.`);
      for (const item of contributions.values()) {
        const label = qualification(item.observation);
        if (label) reasons.push(`${item.label}: ${label}.`);
        if (item.variant)
          reasons.push(
            `Qualified protocol variant: ${item.label}; compared only within this exact panel.`
          );
        if (item.panelCaveat) reasons.push(item.panelCaveat);
        if (item.observation.provisional_reasons)
          reasons.push(...item.observation.provisional_reasons);
        const alternatives = data.resultsByKey[model.id + '|' + item.benchmark] || [];
        if (
          alternatives.some(
            (o) =>
              Number.isFinite(o.value) &&
              o.value !== item.observation.value &&
              o.evidence !== 'assumed' &&
              o.status !== 'assumed'
          )
        )
          reasons.push(
            `Published observations disagree on ${item.label}; source priority selects the comparison result.`
          );
      }
      if (!model.release_date)
        reasons.push('Release date unknown; included only in the latest model cohort.');
      if (main.has(i) && componentSources.size)
        reasons.push(
          `Connected comparison evidence includes ${[...componentSources.keys()].sort().join(', ')} results.`
        );
      const rank = main.has(i) ? 100 * sigmoid(solution.strengths[i]) : null;
      const explanation =
        rank === null
          ? edges.length
            ? 'This comparison group is disconnected from the main model cohort; its relative position cannot be estimated. Its benchmark scores remain visible.'
            : 'No usable comparison against another model identity on an eligible exact protocol. Reported scores remain visible.'
          : `Best-effort Bradley–Terry rating from ${families.size} comparison ${families.size === 1 ? 'family' : 'families'} and ${opponents.size} distinct opponents. Shared opponents connect models across panels.\nThe 0–100 rating is a relative estimate, not accuracy or a confidence percentage. Sparse evidence is pulled toward the midpoint.\n${reasons.join('\n')}`;
      rows.set(model.id, {
        rank,
        rankMethod: 'pairwise',
        rankStatus: rank === null ? 'unranked' : 'provisional',
        count: families.size,
        coreCount: families.size,
        opponentCount: opponents.size,
        rankContributions: [...contributions.values()],
        provisionalReasons: reasons,
        rankExplanation: explanation
      });
    }
    return {
      rows,
      familyCount: new Set(g.edges.filter((e) => main.has(e.a)).map((e) => e.family)).size
    };
  }
  return { graph, fit, build, sigmoid };
});
