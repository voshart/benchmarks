/* Descriptive diagnostics, not independent validation or confidence intervals. */
const { loadOCR } = require('../lib/load.cjs');
const policy = require('../data/ocr/dimensions.json');
const Dimensions = require('../src/assets/js/ocr-dimensions.js');
const Rank = require('../src/assets/js/ranking.js');
const Pairwise = require('../src/assets/js/pairwise-ranking.js');
const data = loadOCR();
const summary = {};
for (const dimension of Object.keys(policy.views)) {
  const result = Dimensions.build(data, policy, dimension);
  const panels = result.columns.map((test) => ({
    panel: test.id,
    ratingEligible: test.aggregate_eligible,
    reported: result.rows.filter((row) => row.scores[test.id]).length,
    comparable: result.rows.filter((row) =>
      Rank.choose(result, row.id, test.id, false, true)
    ).length
  }));
  summary[dimension] = {
    models: result.cohortCount,
    rated: result.ratedCount,
    panels
  };
  if (result.view.mode !== 'rating') continue;
  const models = Rank.latestByLine(
    data.models.filter((model) => !model.release_date || model.release_date <= result.cutoff)
  );
  const graph = Pairwise.graph(result, models, Rank.choose);
  summary[dimension].connectedGroups = graph.components.map(
    (component) => new Set(component.map((i) => graph.nodes[i].ranking_identity || graph.nodes[i].id)).size
  );
  summary[dimension].leaveOneFamilyOut = [];
  const baseline = new Map(result.rows.map((row) => [row.id, row.rank]));
  for (const family of new Set(graph.edges.map((edge) => edge.family))) {
    const altered = structuredClone(policy);
    const tests = new Map(data.tests.map((test) => [test.id, test]));
    for (const panel of altered.views.tables.panels)
      if (tests.get(panel.benchmark).family === family) panel.rating = false;
    const reduced = Dimensions.build(data, altered, 'tables');
    const shifts = reduced.rows
      .filter((row) => row.rank !== null && baseline.get(row.id) != null)
      .map((row) => Math.abs(row.rank - baseline.get(row.id)));
    summary[dimension].leaveOneFamilyOut.push({
      removed: family,
      retainedRatings: reduced.ratedCount,
      commonRatings: shifts.length,
      meanAbsoluteShift: shifts.length ? shifts.reduce((a, b) => a + b, 0) / shifts.length : null,
      maxAbsoluteShift: shifts.length ? Math.max(...shifts) : null
    });
  }
}
console.log(JSON.stringify(summary, null, 2));
