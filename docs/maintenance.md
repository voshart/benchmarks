# Maintenance

Read [AGENTS.md](../AGENTS.md) for common evidence rules. Current topic policies are [OCR](../data/ocr/README.md) and [speech](../data/stt/README.md). This guide describes how to make changes; historical research notes are evidence, not operational instructions.

## Update an existing score

1. Open the primary publication and identify the exact model, protocol/split, metric, operator and published value. Preserve its original precision.
2. Add a source to `data/<topic>/sources.json` if the publication is new. Preserve pinned revisions, verification date, provenance and unresolved limitations.
3. Add a model to `data/models/registry.json` only if that exact configuration is new. Speech models require `topics: ["stt"]`; OCR models use `topics: ["ocr"]` or the inherited absent-topic convention. Verify release availability separately from the result date.
4. Append one observation to `data/<topic>/results/<protocol-id>.jsonl`. Reuse the exact existing protocol only when the dataset, split, metric and execution conditions are comparable. Preserve alternate sources. See the topic examples.
5. Run `npm run format` and `npm run build`. Review source selection and any changed comparison cohorts; new eligible measurements can legitimately change existing percentiles. Publish following AGENTS.md.

Most score updates touch an observation file and, when needed, a source and model record. No renderer or test-count adjustment should be needed.

## Add a protocol

Use a descriptive stable ID. Create `data/<topic>/tests/<id>.json` and the matching `results/<id>.jsonl`. The definition's `id` must match its filename. JSONL contains one object per line; an empty result file is valid while a protocol has no observations. An orphan result file or missing expected result file fails loading.

Start with the closest compatible definition, then check every field against the topic schema. Declare the exact primary metric, its unit/direction, family and source. Make new protocols secondary and ineligible until comparability is established. Do not inherit eligibility merely because a result appears in a published table.

For OCR, `primary`, `coverage` and `matrix_extra` belong in the definition. Specialized view membership and editorial family order belong in `data/ocr/config.json`. A normal new protocol needs no JavaScript changes. Speech selection lists live in `data/stt/config.json`; aggregate panels require deliberate review of corpus overlap and completeness.

## Change another kind of evidence

| Change                                    | Edit                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Model identity, access, release, lineage  | `data/models/registry.json` and the relevant source record                                                     |
| Page/hour tariff                          | Topic `pricing.jsonl`; preserve the published currency/unit and configuration                                  |
| Token tariff                              | Topic `pricing-tokens.jsonl`; never invent page/hour usage                                                     |
| Measured speed                            | Topic `throughput.jsonl`, plus the exact workload definition when required                                     |
| Assumed OCR speed/cost                    | `data/ocr/reference-throughput.json` or `throughput-estimates.jsonl`; preserve measured evidence separately    |
| Speech artifact size or response latency  | `data/stt/sizes.jsonl` or `latency.jsonl`                                                                      |
| OCR display membership, coverage or order | Benchmark definitions and `data/ocr/config.json`                                                               |
| Ranking formula                           | Shared `ranking.js`, topic adaptation, relevant config, topic methodology and fixture tests in the same change |
| Presentation                              | Topic template, shared CSS or the relevant rendering module                                                    |

The OCR deployment module selects speed/cost evidence independently of quality ranking. The OCR comparison module renders it; `bench.js` handles browser events. Speech similarly separates deployment estimates, protocol comparisons, matrix aggregation and page events. Keep these boundaries when adding behavior.

## Validate and review

`npm ci` installs locked build tools. `npm run format` formats source, tests, templates and current docs. Evidence files under `data/` and historical archives are excluded to preserve source layout and compact JSONL; keep their existing conventions. `npm run build` is the complete required gate. `npm run summary` derives current totals from the loaders.

For behavioral changes, prefer small fixtures that exercise missing values, ties, source conflicts, assumptions, history and filters. For a source import, check the imported records against the exact pinned table or audit ledger, scoped to that source. Avoid global totals and exact current aggregate ranks: adding valid evidence should not break an unrelated test. Browser-controller tests should assert events and output rather than the source's whitespace or quote style.

For a structural refactor, compare rankings, selected sources, deployment calculations and rendered rows before and after across current/historical views. Check the local pages with JavaScript enabled and disabled when templates or browser dependencies change. Keep evidence values untouched. CI runs the same build gate on pushes and pull requests.

The [README](../README.md#deployment) records Cloudflare settings. Verify the newest commit's CI and production deployment. Confirm `/ocr/` and `/stt/`, their data endpoints, default rows, filters and source/details controls.
