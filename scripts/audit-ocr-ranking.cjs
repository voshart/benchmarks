// Reproducible diagnostics of published comparisons, not independent OCR validation.
const { loadOCR } = require('../lib/load.cjs');
const Rank = require('../lib/ranking.cjs');
const Pair = require('../src/assets/js/pairwise-ranking.js');
const data = loadOCR();
const graph = (d) => Pair.graph(d, Rank.latestByLine(d.models), Rank.choose);
const full = graph(data);
const hash = (s) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
const key = (e) =>
  [full.nodes[e.a], full.nodes[e.b]]
    .map((m) => m.ranking_identity || m.id)
    .sort()
    .join('|');
function subset(edges) {
  const adjacent = full.nodes.map(() => []);
  for (const e of edges) {
    adjacent[e.a].push(e);
    adjacent[e.b].push(e);
  }
  return { ...full, edges, adjacent };
}
const validation = [];
for (const prior of [0.25, 0.5, 1]) {
  let correct = 0,
    count = 0,
    brier = 0,
    baselineCorrect = 0;
  for (let fold = 0; fold < 5; fold++) {
    // Hold out the identity pair across every family to avoid repeated-pair leakage.
    const train = subset(full.edges.filter((e) => hash(key(e)) % 5 !== fold));
    const fit = Pair.fit(train, prior);
    const rate = train.adjacent.map((edges, i) => {
      const total = edges.reduce((s, e) => s + e.weight, 0);
      return (
        edges.reduce((s, e) => s + e.weight * (e.a === i ? e.outcome : 1 - e.outcome), 0) /
        (total || 1)
      );
    });
    const component = new Map();
    for (let i = 0; i < train.nodes.length; i++)
      if (!component.has(i) && train.adjacent[i].length) {
        const queue = [i];
        component.set(i, i);
        for (let p = 0; p < queue.length; p++)
          for (const e of train.adjacent[queue[p]]) {
            const other = e.a === queue[p] ? e.b : e.a;
            if (!component.has(other)) {
              component.set(other, i);
              queue.push(other);
            }
          }
      }
    for (const e of full.edges.filter((e) => hash(key(e)) % 5 === fold && e.outcome !== 0.5)) {
      if (!component.has(e.a) || component.get(e.a) !== component.get(e.b)) continue;
      const p = Pair.sigmoid(fit.strengths[e.a] - fit.strengths[e.b]);
      correct += p > 0.5 === (e.outcome === 1) ? 1 : 0;
      baselineCorrect += rate[e.a] > rate[e.b] === (e.outcome === 1) ? 1 : 0;
      brier += (p - e.outcome) ** 2;
      count++;
    }
  }
  validation.push({
    prior,
    heldOutComparisons: count,
    directionalAccuracy: correct / count,
    weightedWinRateBaseline: baselineCorrect / count,
    brier: brier / count
  });
}
const baseline = Rank.build(data).rows.filter((r) => r.rank !== null);
const baselineOrder = new Map(baseline.map((r, i) => [r.id, i + 1]));
const top = new Set(baseline.slice(0, 10).map((r) => r.id));
const compare = (d, omitted) => {
  const rows = Rank.build(d).rows.filter((r) => r.rank !== null);
  const order = new Map(rows.map((r, i) => [r.id, i + 1]));
  return {
    omitted,
    top10Retained: rows.slice(0, 10).filter((r) => top.has(r.id)).length,
    top20LargestMove: Math.max(
      ...baseline
        .slice(0, 20)
        .filter((r) => order.has(r.id))
        .map((r) => Math.abs(order.get(r.id) - baselineOrder.get(r.id)))
    ),
    lostRatings: baseline.filter((r) => !order.has(r.id)).map((r) => r.id)
  };
};
const familySensitivity = [...new Set(full.edges.map((e) => e.family))].sort().map((family) => {
  const d = structuredClone(data);
  d.tests = d.tests.filter((t) => t.family !== family);
  return compare(d, family);
});
const sourceSensitivity = [
  ...new Set(full.edges.flatMap((e) => e.observations.map((o) => o.source_id)))
]
  .sort()
  .map((source) => {
    const d = structuredClone(data);
    for (const key of Object.keys(d.resultsByKey))
      d.resultsByKey[key] = d.resultsByKey[key].filter((o) => o.source_id !== source);
    return compare(d, source);
  });
console.log(
  JSON.stringify(
    {
      policy: data.config.rank_policy_version,
      prior: data.config.pairwise_prior,
      rankedModels: baseline.length,
      comparisons: full.edges.length,
      components: full.components.map((c) => c.length),
      validation,
      familySensitivity,
      sourceSensitivity,
      chandra: baseline
        .filter((r) => ['chandra-2-5-api', 'datalab-accurate-20261020'].includes(r.id))
        .map((r) => ({
          id: r.id,
          position: baselineOrder.get(r.id),
          rating: r.rank,
          families: r.count,
          opponents: r.opponentCount
        }))
    },
    null,
    2
  )
);
