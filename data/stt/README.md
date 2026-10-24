# Speech-to-text evidence

This is the current speech schema and `speech-distinct-corpora-v1` ranking policy. Common evidence rules live in [AGENTS.md](../../AGENTS.md); the [maintenance guide](../../docs/maintenance.md) gives the update workflow. Run `npm run summary` for current counts. The index contains published evidence; no transcription model is executed by this repository.

The current page opens on English accuracy: the complete fixed seven-set WER panel, sorted by unrounded error with shared ranks for ties. One selector exposes complete protocols and individual datasets/languages. Models without a complete matched score appear in a separate expandable list, not as zero or last-place numeric ranks. Search, access, artifact-size and parameter filters, verified-release replay and deployment scenarios operate in the browser; initial English rows are rendered statically. Aggregate matrix calculations remain available in the shared adapter and tests, but do not order this landing table.

## Files and identity

- `config.json`: views, fixed panels, dates and the explicit `speech-distinct-corpora-v1` index policy.
- `tests/*.json`: one protocol or timing workload, exact dataset/split/column labels, metric unit, corpus family and aggregate eligibility. Unspecified revisions remain null.
- `results/<protocol>.jsonl`: one published model row per source. Different language source files can supply different explicitly named components in a fixed panel. Raw observations never contain a dashboard-derived mean or rank.
- `sources.json`: direct source links, pinned revisions where available, checked dates, quotes, publication operator, execution operator and caveats. A maintainer publication does not establish who executed a run.
- `evidence/*.csv`: complete opened/pinned English, long-form and language tables for audit.
- `evidence/handy-q8-catalog.json`: opened catalog entries at commit `9f102d1ab18d01c0e21f9b3465531360c888251d`, retaining original accuracy, uncertainty, quantization and timing fields. Only explicitly matched Q8_0 English cells and timing configurations enter observations.
- `sizes.jsonl`: sourced artifact/download sizes or parameter counts, never estimated RAM or bytes derived from parameter count.
- `throughput.jsonl`: hardware, backend, workload/sample, batch size, wall/compute timing, loading boundary and engine revision where published.
- `latency.jsonl`: end-of-utterance response latency, with the source's unspecified statistic retained. These are not p50/p95 or TTFT measurements.
- `pricing.jsonl`: source-currency amounts per audio hour, original tariff unit, mode, provider, tier, date and direct source. Minute-to-hour normalization is exactly ×60. The loader converts non-USD tariffs for display and sorting, retaining `original_currency`, `original_amount`, `published_currency`, the untouched published amount/unit and dated `fx` provenance. The downloadable JSON also exposes unmodified `rawPricing` records.
- `pricing-access.json`: dated product/access context, including structured native-currency subscription prices where a benchmark-version match is unverified. Conversion changes the display currency without making these contexts selectable model tariffs.
- `pricing-tokens.jsonl`: USD per million input audio, input text and output text tokens. No assumed audio-hour cost.
- `research-expansion-2026-10-19.json`: current scope, counts, evidence gaps and caveats. `research-2026-10-19.json` preserves the earlier, narrower research snapshot.

All model IDs match the shared `data/models/registry.json` with `topics: ["stt"]`. OCR excludes those identities from its catalog and reference cohorts. The exact Qwen `-hf` checkpoint, upstream model, hosted API and quantized runtime conversion are separate generations/configurations; missing evidence is not copied between them.

## Aggregate adapter: core evidence and index

The selected core families use disjoint speech corpora:

| Family | Selected measurement | Additional detail that does not add votes |
| --- | --- | --- |
| English short-form | Fixed seven-column WER mean from the pinned October 17 CSV | Noise, Monsoon, cleaned/older variants, author launch comparisons and LibriSpeech-only runtime checks |
| CORAAL | Published `coraal_avg` across the entire CORAAL corpus | Long-form Earnings21/22 and TED-LIUM; the full long-form `Average` is not another score |
| Multilingual | Fixed French/German/Spanish/Italian/Portuguese FLEURS WER mean | Dutch/Armenian details, MCV/MLS panels, Hindi Monsoon and quantized English FLEURS variants |

Every named mean component must be present, comparable and observed. The English panel requires one matched source; the FLEURS panel explicitly names each component's pinned language source. Missing languages cannot be filled from another corpus, an alternative protocol or an average over fewer languages. Extra columns leave the fixed means unchanged. Means are computed in JavaScript and never written into observed data. Reported launch/paper means remain exactly as published.

Index is the unweighted mean of within-family percentile ranks, with midranks for ties. A mature family requires six scored configurations from three organizations. Runtime alternatives for the same weights identity cannot multiply a reference cohort. One selected variant per family contributes. Two mature families permit a provisional number; three remove only the coverage qualification; one remains unranked. The aggregate matrix adapter defaults to two primary families, independently of the reference cohorts. The current page instead ranks the selected protocol or dataset and does not require aggregate coverage.

Author, competitor, community, secondary and unclear-operator evidence qualifies the affected index and every dependent comparison cohort. Conflicting observations retain source preference and explicit reasons; they are never averaged. Undated availability qualifies current indices and is excluded at historical cutoffs. The accessible ◊ popover lists the actual reasons and every contributing language/component source. Assumed, incompatible and private/vendor-internal values cannot create coverage, maturity or rank. Search/access/size filters do not recalculate reference cohorts.

Speech and OCR have distinct thresholds and eligibility policies; follow the [current OCR methodology](../ocr/README.md) for OCR changes. The shared percentile functions are reused; speech defines its corpus selection and extra cohort qualifications separately.

## Exact sources and protocol limits

The [English CSV](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard-results/blob/e85ed601d17ab0e008721a19fc9cba36b4ee9c9c/english_short_latest.csv) supplies all 64 published rows. Its changing `avg` column is not silently treated as the original seven-set panel. Cleaned AMI/GigaSpeech and Artificial Analysis Earnings22/VoxPopuli labels remain explicit. OtterAI public results are contributor-reported per the maintainer version log; publication and execution attribution remain separate.

The [long-form CSV](https://huggingface.co/datasets/hf-audio/leaderboard_longform/blob/4f164c2c904b630d9777323b5d2e7f1f549d0143/longform_latest.csv) supplies 27 rows. CORAAL alone is selected for aggregate use, preventing the English panel's Earnings22 speech from being counted again. Missing CORAAL stays null. Negative throughput sentinels are not imported.

Eight [Open ASR language tables](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard/blob/main/init.py) retain separate pinned revisions in `sources.json`. The prepared corpus uses `nithinraok/asr-leaderboard-datasets` configurations such as `fleurs_fr`. Armenian is hosted separately and its exact configuration remains unknown. Hindi uses public `VoiceArena/Monsoon_hi_test` lattice references and the `voi-oiwer` orthographic-variant scorer: its source column is called `Monsoon WER`, but the measurement is labelled OI-WER. No private Hindi average is inferred.

The [Fermion launch table](https://www.fermionresearch.com/research/phonon-2/) remains a separate English protocol. Phonon-2 AMI 9.37 and LS clean 1.72 there differ from maintainer 9.32 and 1.73. Phonon-2/Phonon-1 are author runs, Redux is a Fermion competitor run and daggered rows are quoted leaderboard values. The [Moonshine v2 paper](https://arxiv.org/html/2602.12241v1) retains its eight-set author evaluation and reported means; it is not substituted into the cleaned seven-set protocol. Neither paper publication nor a copied model card is an independent run.

The [transcribe.cpp catalog](https://github.com/handy-computer/transcribe.cpp/tree/9f102d1ab18d01c0e21f9b3465531360c888251d/catalog) supplies 58 explicitly separate GGUF Q8_0 configurations, including small Whisper/Moonshine and Phonon-2. It retains CI95, utterance/error counts, batch size, upstream commit, engine SHA and measurement provenance. Some cells are `legacy-published` and omit run dates or engine revisions. The original Phonon-2 package is 164 MB; its Q8_0 artifact is 739,508,608 bytes (739.508608 decimal MB). These are different deployments, not conflicting sizes for the same artifact. Q4_K_M results are not copied into Q8_0 rows.

Private FFASR documentation was inspected; its public config exposed no scored rows. No missing FFASR scores or core vote were invented. Runtime speed on single JFK/dots clips and the private 20-dictation Mac workload remain ancillary. Source verification is not independent reproduction.

## Size, timing, pricing and history

Download/artifact bytes, model parameters, installed package size and runtime RAM are distinct. Hub stored-tensor totals can differ from author architecture totals; source observations remain separate. No peak RAM or hardware cost is inferred.

Throughput observations keep hardware, backend, engine revision and exact sample/workload. Wall-time and compute-only RTFx remain distinct; model load is excluded from warm inference and shown separately when reported. H100 batch 128 is not a Mac single-stream comparison. Moonshine paper observations measure end-of-utterance response latency on a MacBook M3 with an unspecified statistic; they do not establish p50/p95 or TTFT.

Official rates come from [Deepgram](https://deepgram.com/pricing), [AssemblyAI](https://www.assemblyai.com/pricing), [Gladia](https://www.gladia.io/pricing), [Mistral](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) and [Soniox](https://soniox.com/pricing). Every displayed price and numeric price sort uses USD. The [ECB reference rate](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) dated 2026-10-23 is EUR 1 = USD 1.1193: Gladia's EUR 0.16/hour async and EUR 0.68/hour real-time source tariffs display as approximately $0.1791 and $0.7611 per audio hour. Sorting retains the full conversion precision. Source tariffs, original amounts, tariff dates and the linked FX date remain in Details and data; payment-provider rates and fees may differ.

Reson8 plan charges, full-quota equivalents and overage amounts also display as approximate USD in Details. They remain `subscription_version_unverified` context and do not enter numeric model-price sorting. Conversion does not establish the missing benchmark-version mapping. Deepgram current streaming promotions remain separate from standard pre-recorded modes and Growth tiers. Soniox token tariffs remain separate from workload-dependent vendor hourly estimates. Hosted Mistral Transcribe 2602 is distinct from open Voxtral Realtime 4B and has no borrowed accuracy score. Prices describe current services, not guaranteed historical benchmark endpoints.

Release replay uses explicit availability statements, not paper dates, result dates, or Hub creation timestamps. Unknown dates stay null and current-only; conversions do not inherit their upstream model's release date. Current prices retain their own pricing date and the same recorded FX snapshot in historical model views; historical exchange rates are not reconstructed. Availability coverage remains incomplete.

Remaining gaps include matched diarization and silence/hallucination tests, streaming latency distributions and peak RAM. Local reruns should pin model/data/scorer revisions and preserve raw predictions, uncertainty, timing boundaries and workload costs.

Run `npm run format` and `npm run build`; the build checks formatting, validates both topics and runs all tests. Never edit `_site/` directly.

## Minimal observation and new protocols

```json
{"model":"existing-exact-stt-model-id","source_id":"verified-publication-id","metrics":{"wer":5.49},"evidence":"author_reported","status":"observed","verified_on":"2026-10-24","measurement_operator":"Model authors","source_model":"Exact published model label"}
```

These IDs and the value are illustrative. The `metrics` keys must be declared by the exact protocol (or its published mean field); retain nulls, uncertainty and source-native values. WER can exceed 100 because insertions count as errors. `evidence` and `status` are explicit; the source record requires a direct HTTPS URL, verification date, publication operator, measurement operator and a short supporting quote.

Definitions in `tests/<id>.json` require a matching filename ID and source. Accuracy definitions use `task: "transcription"`, `direction: "lower"`, metric objects with exact dataset/split/source-column metadata, and a fixed `mean_metrics` list (or a declared summary/published mean). Timing definitions use `task: "throughput"` or `"latency"` and `core: false`; they have no accuracy result file.

Add accuracy protocols to `config.accuracy_tests` and any appropriate matrix/small/secondary lists. New core membership requires explicit review of overlapping corpora and complete fixed panels; it is not an automatic consequence of adding observations. Accuracy, timing and deployment metadata cannot supply each other's missing values.
