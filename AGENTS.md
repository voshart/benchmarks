# Instructions for LLM contributors

**Preserve evidence provenance.** Editing this repository is primarily a data task. Prefer small changes to `data/`; do not modify visual code unless asked.

1. Before adding a score, open the linked source. Quote the exact model generation, dataset version or split, metric, and measurement operator (benchmark maintainer / independent / competitor / author / vendor internal).
2. Add one observation per source in the correct `data/ocr/results/<benchmark-id>.jsonl`. Never overwrite an official value with a cross-version rerun. For conflicting observations, keep both and document provenance; do not average them.
3. All observation `model` values must match `data/models/registry.json`; test IDs and source IDs must exist. Verify release date rather than guessing one from paper publication. Preserve unknown dates as null.
4. Missing is `null` or absent—not zero. Never fill a private score using a public score. Inferences, floors or extrapolations need explicit `assumed` status and must not appear in observed source data.
5. Keep author-reported Xiaomi, PolyOCR and vendor-internal Chandra 2.1 studies distinct from independent/official benchmark data. OpenOCR uses a 20-page corpus; do not merge it into olmOCR full-set scores.
6. Pricing must keep **per 1000 pages** distinct from **USD per million input/output tokens**. Rates should include provider, tier/configuration, as-of date and direct pricing source. For NDI, identify benchmark-estimated rather than vendor price.
7. The default UI requires 4+ families. Rank requires 3 mature core families. Benchmark maturity is at least 6 scored models from 3 organizations. This is a project rule; don't change it during a score update.
8. Keep CSS in the CSS file, data operations and historical ranking in JS, semantic controls in HTML. Use system fonts and one Voshart-inspired accent color. Do not reintroduce boxes-within-boxes or marketing prose into matrix cells.
9. Run `npm run validate`, `npm test`, and `npm run build` before submitting. The build will fail when validation/tests fail. Document any unverified claim in the PR rather than representing it as fact.
10. Never edit `_site/`, which is generated.

When creating a PR, summarize new scores, exact source links, split/version caveats, pricing assumptions, and expected leaderboard effect.
