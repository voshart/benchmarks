# OCR data and methodology

This is the current OCR schema and ranking policy (v4). Common provenance rules live in [AGENTS.md](../../AGENTS.md); the [maintenance guide](../../docs/maintenance.md) gives the update workflow. Speech uses its own policy.

## Files and records

| File | Meaning |
| --- | --- |
| `../models/registry.json` | Exact model/configuration identity, developer, access, verified release and lineage |
| `config.json` | Active policy/version, thresholds, dates, specialized views and editorial column order |
| `tests/<id>.json` | Exact benchmark protocol, split, primary metric, unit/direction, family and eligibility |
| `results/<id>.jsonl` | One observation per model/protocol/source; the filename matches its definition |
| `sources.json` | Source URLs, publication/execution attribution and caveats |
| `pricing.jsonl`, `pricing-tokens.jsonl` | Distinct page and token tariffs, configuration and verification |
| `throughput.jsonl` | Measured/reported speed with its original hardware, pipeline and workload |
| `reference-throughput.json`, `throughput-estimates.jsonl` | Explicitly assumed planning scenarios; never accuracy evidence |
| Research/audit JSON and `archive/` | Supporting evidence and historical research; not additional independent measurements |

For an observation in `results/omnidoc-v16.jsonl`:

```json
{"model":"existing-exact-model-id","metrics":{"overall":91.14},"source_id":"verified-publication-id","evidence":"author_reported"}
```

IDs in this example are placeholders. Add real matching model/source records and verify the protocol before appending it. Preserve secondary metrics, uncertainty, source-native precision and configuration/operator notes. `evidence` defaults to the source kind for inherited records; provide it explicitly for new measurements. Allowed classes are `official`, `third_party`, `community`, `author_reported`, `vendor_comparison`, `vendor`, `mixed`, `research`, `imported`, `secondary`, `vendor_internal` and `assumed`. `vendor_price` is a source kind for tariffs, not an accuracy evidence class.

Do not merge OmniDoc versions or full/English subsets, MDP public/private splits, layout-assisted runs or recognition/VQA components. A result without the named primary metric remains available as raw evidence but cannot supply that protocol's headline score. Missing is null/absent; genuine observed zeros remain zero.

## Benchmark metadata

Definitions require `id`, `short`, `label`, `source`, `family`, `primary_metric`, `unit` (`percent` or `ratio`) and `direction` (`higher` or `lower`). `source` must exist. Metric labels, units, directions and optional grouped tables describe component displays.

| Field | Behavior |
| --- | --- |
| `primary` | Defaults to true. Selects headline columns. Use false for a secondary protocol. |
| `coverage` | Legacy primary-coverage metadata; v4 coverage counts families with usable comparisons, matching the rating. |
| `core` | Canonical whole-document panel for its family. |
| `aggregate_eligible` | Explicitly reviewed non-core whole-document variant that can contribute under v4. |
| `aggregate_priority` | Lower wins for each model pair within a family. Defaults to 0 for core panels, 1000 otherwise; ties use protocol ID. Never select the best percentile. |
| `aggregate_caveat` | Explanation attached to any index using this qualified panel. |
| `matrix_extra` | Includes an additional protocol column in the default matrix without making it primary or increasing coverage. |
| `matrix_order` | Orders additional protocols within a family cell; does not affect ranking. |

`config.views` maps each specialized view to an explicit `tests` list, or `primary: false` for secondary protocols. Optional `filter: "scored"` requires a matching score; `"author_reported"` requires author evidence. Omitted filters use the normal coverage minimum. `column_family_order` controls display only. `other_column` defines the non-sortable catch-all column with `catch_all: true`. Neither display membership nor filters changes reference cohorts.

## Ranking policy v4

The default view shows all current registered models, ordered by a best-effort Bradley–Terry rating.
The compact 0–100 number is `100 × logistic(strength)`, not measured accuracy, a percentile, or a
confidence percentage. Missing results are never losses. Models without usable comparisons remain
visible with an em dash. The optional coverage filter counts distinct families that actually
supply comparisons, including eligible secondary protocols. It does not change reference models.

1. Select the latest verified available generation per lineage for the chosen model-release cutoff.
   Undated entries appear only in the latest cohort. This is a release-cohort view, not an as-of
   reconstruction of which evidence had been published at that date.
2. Admit only core or explicitly `aggregate_eligible` whole-document panels. Reject assumed,
   vendor-internal and incomparable observations. Select a usable observation by the existing
   evidence priority, not its score; retain all alternatives for display. A context-only preferred
   display observation cannot suppress a comparable alternative for ranking.
3. For every pair of exact model configurations, select the first eligible protocol both share in
   each family, ordered by canonical-first `aggregate_priority`, then protocol ID. Compare only
   within that exact protocol. Higher scores win (reverse for lower-is-better); exact ties count
   as half a win. No benchmark-margin significance or independent trial count is inferred.
4. Each distinct `ranking_identity` (fallback: model ID) allocates one comparison budget per family,
   divided equally over its distinct opponent identities. For an identity pair with degrees
   `d_a`, `d_b`, weight is `(1/d_a + 1/d_b)/2`. Divide that weight among configuration-pair edges
   belonging to those identities. Do not compare configurations of the same identity against one
   another. Repeated panels cannot multiply a pair's family vote; total family weight grows
   linearly with participating identities instead of the number of possible pairs. This is
   equal family budgeting per identity, not equal total weight for differently sized families.
5. Fit the weighted Bradley–Terry logistic model jointly. Minimize weighted binary cross-entropy
   plus `pairwise_prior / 2 × sum(strength_i² / active_configuration_count_for_identity_i)`.
   The fixed default prior is 0.25. The common zero-centered prior limits sparse and undefeated
   extremes; configuration copies share its budget. It is a modeling assumption, not invented
   benchmark evidence. Deterministic coordinate Newton updates with line search must converge;
   the renderer never substitutes unconverged ratings.
6. Publish global ratings only for the largest connected comparison component, measured by
   distinct identities, with lexical tie-breaking. Other components keep their results and an
   explanation that global placement is unknown. A prior cannot calibrate disconnected groups.
7. Mark all ratings as estimates. The existing popover explains family/opponent coverage,
   source qualifications, non-core protocols, conflicts and unknown release dates. Qualifications
   from the connected reference evidence also propagate. Speed, cost and UI filters never enter
   the fit. Multiple exact panels may support a model's family through different opponents,
   but its family count is still one.

The model assumes a transferable overall OCR capability. Specialization, selective reporting,
benchmark overlap, source execution differences and unreported uncertainty can violate that
assumption. Tiny score differences are only observed ordering, not statistically established wins.
Author reports remain eligible with attribution; no arbitrary publisher-based score discount is
applied. Source classification still selects among alternative observations.

The implementation is `src/assets/js/pairwise-ranking.js`, shared by Eleventy and the browser.
The shared legacy percentile helpers remain available to speech and historical fixture tests;
OCR config explicitly selects policy 4. Run `node scripts/audit-ocr-ranking.cjs` for deterministic
five-fold held-out identity-pair predictions, prior-strength sensitivity, and leave-one-family /
leave-one-source diagnostics. All comparisons of an identity pair are held out together; only
pairs still connected in training are evaluated. These diagnostics assess consistency of the
published evidence, not independent OCR accuracy or calibrated confidence intervals. The graph
weights retain full-data topology during held-out prediction, while outcomes are withheld.

References: [Bradley–Terry computation](https://jmlr.org/papers/v24/22-1086.html) and
[incomplete comparison designs](https://proceedings.mlr.press/v162/bong22a.html).

## Speed and pricing

Main local speeds use low-confidence ranges on the declared H100 reference profile. The profile stores hardware, precision, workload, batching, fit assumptions and limitations. Unsupported/hosted/oversized configurations stay explicit; no quantization, offloading or sharding is implied. Original observations and alternate scenarios remain in Details. Parameter count and stored tensor bytes do not establish speed or peak runtime memory.

Local cost inverts the reference speed range using the editable illustrative complete-setup hourly rate at full utilization. API page tariffs, token-budget scenarios and contextual current-service rates retain their distinct meanings. Ranges sort by geometric midpoint; missing values stay last. Token budgets affect API cost only.

Page records use `unit: "usd_per_1000_pages"`; token records use `unit: "usd_per_million_tokens"`. Keep provider, tier/mode, source, as-of/verification dates, basis and version scope. Use `comparison_default: false` for alternatives that should not replace the selected configuration. Preserve imports as `unverified_import`. Original currencies and dated conversion provenance remain in the data. Never infer a measured page cost from an API token tariff.

Hosted models may have explicitly `hypothetical: true` H100 reference ranges when a conditional engineering estimate is useful. Record architecture uncertainty, fit conditions and peer anchors in `basis`/`fit`. Such ranges are not API throughput or evidence of downloadable weights. Their hypothetical local `referenceCost` stays in Details and never replaces the hosted price in the matrix.
