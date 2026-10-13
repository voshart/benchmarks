# OCR source data

`tests/` defines exact comparable test variants. `results/*.jsonl` contains one `model` / `source_id` / `metrics` record per observation. `sources.json` records provenance and URLs. `pricing.jsonl` keeps page-cost measurements separately.

An example record:

```json
{"model":"chandra-2-open","metrics":{"public":79.7,"private":82.4},"source_id":"mdp-official"}
```

Do not confuse source `kind` with benchmark difficulty. Valid source kinds currently include `official`, `third_party`, `community`, `vendor`, `vendor_comparison`, `author_reported`, `vendor_internal`, and `mixed`. A source can be credible and still be excluded from the aggregate because it is too small or overlapping.

October 2026 additions: Xiaomi-OCR-0 (author-reported OmniDoc v1.6 / Wild / Real5), PolyOCR-2.7B (author-reported **MDP public**, private unavailable), OpenOCR (20-page third-party Mistral OCR 4.1 and Datalab Convert accurate comparison), and Datalab Chandra 2.1 vendor-internal multilingual/complex-table measurements.
