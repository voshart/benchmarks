# OCR source data

`tests/` defines exact comparable test variants. `results/*.jsonl` contains one `model` / `source_id` / `metrics` record per observation. `sources.json` records provenance and URLs. `pricing.jsonl` keeps page-cost measurements separately.

An example record:

```json
{"model":"chandra-2-open","metrics":{"public":79.7,"private":82.4},"source_id":"mdp-official"}
```

Do not confuse source `kind` with benchmark difficulty. Valid source kinds currently include `official`, `third_party`, `community`, `vendor`, `vendor_comparison`, `author_reported`, `vendor_internal`, and `mixed`. A source can be credible and still be excluded from the aggregate because it is too small or overlapping.

October 2026 additions: Xiaomi-OCR-0 (author-reported OmniDoc v1.6 / Wild / Real5), PolyOCR-2.7B (author-reported **MDP public**, private unavailable), OpenOCR (20-page third-party Mistral OCR 4.1 and Datalab Convert accurate comparison), and Datalab Chandra 2.1 vendor-internal multilingual/complex-table measurements.

October 13 expansion adds separate PolyOCR-9B parsing configurations, an explicit secondary OmniDoc v1.5 IDP variant, and additional small-sample OpenOCR results. Primary score versions are never replaced by the older IDP dataset.

`pricing.jsonl` records `unit: usd_per_1000_pages`, provider/mode, verification status and date. Preserve imported observations as `unverified_import`; add newly verified observations with direct source IDs. Use `comparison_default: false` for alternate batch/annotation modes and for current-service rates that do not pin a benchmarked historical generation.

`pricing-tokens.jsonl` uses `unit: usd_per_million_tokens` and distinct input/cached-input/output fields. It must not contain `usd_per_1000_pages`. A vendor token tariff is not a workload measurement. Self-hosting has no numeric page rate unless a defined hardware/workload measurement establishes one.

Ranking policy v2 accepts comparable observed public-benchmark scores across operators, then records provisional reasons for both own and reference-cohort evidence. Assumptions and vendor-internal tests are never eligible. Two mature core families allow a provisional number; three remove only the coverage reason. Family maturity and exclusion of correlated/task-only variants are unchanged.

The Real5 maintainer publication (October 12) and Xiaomi author report disagree: 92.73 versus 95.24. Keep both records and their configurations/operator caveats; prefer the maintainer publication without claiming an independently reproduced execution. Additional recognition and VQA variants use `primary: false` and `core: false`.
