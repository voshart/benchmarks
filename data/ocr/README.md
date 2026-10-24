# OCR data and methodology

This is the current OCR schema and ranking policy (v3). Common provenance rules live in [AGENTS.md](../../AGENTS.md); the [maintenance guide](../../docs/maintenance.md) gives the update workflow. Speech uses its own policy.

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
| `primary` | Defaults to true. Selects headline columns and normal coverage membership. Use false for a secondary protocol. |
| `coverage` | Optional boolean override for the display coverage count. Defaults to `primary !== false`; does not change ranking eligibility. |
| `core` | Canonical whole-document panel for its family. |
| `aggregate_eligible` | Explicitly reviewed non-core whole-document variant that can contribute under v3. |
| `aggregate_priority` | Lower wins within a model/family. Defaults to 0 for core panels, 1000 otherwise; ties use protocol ID. Never select the best percentile. |
| `aggregate_caveat` | Explanation attached to any index using this qualified panel. |
| `matrix_extra` | Includes an additional protocol column in the default matrix without making it primary or increasing coverage. |
| `matrix_order` | Orders additional protocols within a family cell; does not affect ranking. |

`config.views` maps each specialized view to an explicit `tests` list, or `primary: false` for secondary protocols. Optional `filter: "scored"` requires a matching score; `"author_reported"` requires author evidence. Omitted filters use the normal coverage minimum. `column_family_order` controls display only. `other_column` defines the non-sortable catch-all column with `catch_all: true`. Neither display membership nor filters changes reference cohorts.

## Ranking policy v3

1. Select a finite observed primary metric by evidence preference: official benchmark publication, independent third party, community, model author, vendor/competitor, mixed/research, imported, secondary. Preserve alternatives and disclose disagreement. Publication and execution attribution remain distinct.
2. Include only core or explicitly `aggregate_eligible` panels. Exclude assumptions, vendor-internal corpora and observations marked incomparable. Each exact panel needs at least two distinct `ranking_identity` values (falling back to model ID). Historical cohorts use verified release dates and the latest eligible generation per lineage; undated releases are current-only.
3. Compute finite-cohort midrank percentiles within each exact panel: `100 × (N − average rank + 0.5) / N`. Respect metric direction; tied values share a percentile. Small panels cannot assign an automatic 100.
4. For each model/family, use the first available eligible panel by fixed canonical-first priority. Average one percentile per family with equal weights. One family permits a provisional index; three remove only the limited-coverage qualification. These thresholds are recorded in `config.json`.
5. Qualify indices for small cohorts, non-core protocol variants, own or reference-cohort source qualifications, conflicts and unknown/unreleased availability. Propagate cohort qualifications to every dependent index. Keep accessible ◊ explanations and exact source links. This is not a population estimate or an independent reproduction claim.

Legacy `min_models`/`min_organizations` fields remain in inherited definitions for the shared legacy maturity helper; OCR v3 does not use the old six-model/three-organization eligibility threshold. The default two-family display filter is separate from rank eligibility. Reset restores it; search can expose all registered models.

## Speed and pricing

Main local speeds use low-confidence ranges on the declared H100 reference profile. The profile stores hardware, precision, workload, batching, fit assumptions and limitations. Unsupported/hosted/oversized configurations stay explicit; no quantization, offloading or sharding is implied. Original observations and alternate scenarios remain in Details. Parameter count and stored tensor bytes do not establish speed or peak runtime memory.

Local cost inverts the reference speed range using the editable illustrative complete-setup hourly rate at full utilization. API page tariffs, token-budget scenarios and contextual current-service rates retain their distinct meanings. Ranges sort by geometric midpoint; missing values stay last. Token budgets affect API cost only.

Page records use `unit: "usd_per_1000_pages"`; token records use `unit: "usd_per_million_tokens"`. Keep provider, tier/mode, source, as-of/verification dates, basis and version scope. Use `comparison_default: false` for alternatives that should not replace the selected configuration. Preserve imports as `unverified_import`. Original currencies and dated conversion provenance remain in the data. Never infer a measured page cost from an API token tariff.
