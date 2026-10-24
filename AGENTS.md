# Instructions for LLM contributors

## Read and choose the edit path

This is a small static evidence index. Read [the maintenance guide](docs/maintenance.md), then the relevant topic's current schema and methodology: [OCR](data/ocr/README.md) or [speech](data/stt/README.md). Those topic documents and their validated configuration describe the active policies. `docs/archive/` contains historical records, not current instructions.

Most updates belong in `data/`. Follow the file map instead of changing rendering code to accommodate one model. Benchmark identity, eligibility, coverage and display membership belong in definitions/configuration. Keep topic-specific methodology separate; OCR and speech have different ranking requirements.

## Evidence invariants

1. Open the primary source before adding a claim. Record the exact model/configuration, dataset version or split, metric, source URL and measurement operator. Publication by a maintainer does not establish independent execution. Keep source quotes short and exact.
2. Preserve one observation per model/protocol/source. Retain conflicting sources and their caveats; never replace them with an average. Select sources by the documented priority, not by the best score.
3. Match every model, protocol and source ID. Hosted services, exact checkpoints, pipeline variants and quantized conversions stay separate unless equivalence is verified. Preserve unknown release dates as `null`; paper dates and repository creation dates do not establish model availability.
4. Missing values are `null` or absent, never zero. Preserve genuine measured zeros. Never infer a private score from a public score or borrow an open checkpoint's result for a hosted generation.
5. Assumptions, floors and extrapolations stay explicitly assumed and cannot enter observed source selection, accuracy coverage, reference cohorts or quality ranks. Preserve author, vendor/competitor, community, independent and maintainer attribution. Private internal corpora and incompatible tasks do not create quality votes.
6. Keep pricing units, currencies, service modes, tiers, verification dates and direct sources. Token tariffs, page rates, audio-hour rates and workload estimates have different meanings. Preserve original currencies and dated FX provenance. Self-hosting is not a zero cost.
7. Preserve confidence explanations and propagate cohort qualifications. Source verification is not independent reproduction. Apply the same policy to every model; never introduce a model-specific ranking exception.

## Implementation and checks

- Preserve the requested default views, filters, compact numeric cells, keyboard-accessible details and missing-values-last sorting. Changes to these behaviors need a task that requests them.
- Use plain JavaScript, semantic templates, system fonts and the existing shared CSS. Prefer a direct function or data field over a new framework. Keep calculations pure and reusable by Eleventy and the browser.
- Use the checked-in formatter: `npm run format`. `npm run build` then checks formatting, validates both topics, runs all tests and builds the site. Resolve failures before shipping. Run narrower commands only to diagnose a failure.
- Test algorithms with small fixtures and imports against their pinned sources. Do not freeze growing global catalog totals, exact current aggregate ranks or incidental source formatting. Preserve meaningful evidence-completeness checks.
- Never edit generated `_site/` or commit `node_modules/`. Do not edit historical audits to make current tests pass. Do not change measurements during a structural refactor.

## Publish requested work

The owner authorizes contributors to commit, merge into `main` and publish requested updates without separate merge or deployment confirmation. Direct commits are welcome for small changes. If using a PR, merge after required checks pass; do not leave completed work awaiting another approval. A push to `main` triggers Cloudflare Pages.

Describe the resulting behavior, validation and any unresolved evidence gaps. For data changes include source links, split/version caveats, pricing assumptions and expected ranking impact. Verify the deployed commit and live pages after publishing.
