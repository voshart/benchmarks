# Speech-to-text evidence

The expanded `/stt/` index contains 172 model configurations, 975 accuracy source rows in 11 protocols, 464 hardware/runtime throughput observations, nine response-latency measurements, nine hourly tariffs and two token-rate configurations. It indexes published evidence; no transcription model was executed locally.

The page mirrors OCR's matrix, family coverage, source qualifications, release replay and filters. English, Long-form, Multilingual, Noise & accent, Small models, New research, Secondary, Local speed, Latency and Pricing expose the underlying observations. The default requires two primary families. Small models shows configurations with a reported download ≤1,000 MB or ≤1B parameters, including models without enough coverage for an index.

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
- `pricing.jsonl`: currency per audio hour, original tariff unit, mode, provider, tier, date and direct source. Minute-to-hour normalization is exactly ×60.
- `pricing-tokens.jsonl`: USD per million input audio, input text and output text tokens. No assumed audio-hour cost.
- `research-expansion-2026-10-19.json`: current scope, counts, evidence gaps and caveats. `research-2026-10-19.json` preserves the earlier, narrower research snapshot.

All model IDs match the shared `data/models/registry.json` with `topics: ["stt"]`. OCR excludes those identities from its catalog and reference cohorts. The exact Qwen `-hf` checkpoint, upstream model, hosted API and quantized runtime conversion are separate generations/configurations; missing evidence is not copied between them.

## Core evidence and index

The selected core families use disjoint speech corpora:

| Family | Selected measurement | Additional detail that does not add votes |
| --- | --- | --- |
| English short-form | Fixed seven-column WER mean from the pinned October 17 CSV | Noise, Monsoon, cleaned/older variants, author launch comparisons and LibriSpeech-only runtime checks |
| CORAAL | Published `coraal_avg` across the entire CORAAL corpus | Long-form Earnings21/22 and TED-LIUM; the full long-form `Average` is not another score |
| Multilingual | Fixed French/German/Spanish/Italian/Portuguese FLEURS WER mean | Dutch/Armenian details, MCV/MLS panels, Hindi Monsoon and quantized English FLEURS variants |

Every named mean component must be present, comparable and observed. The English panel requires one matched source; the FLEURS panel explicitly names each component's pinned language source. Missing languages cannot be filled from another corpus, an alternative protocol or an average over fewer languages. Extra columns leave the fixed means unchanged. Means are computed in JavaScript and never written into observed data. Reported launch/paper means remain exactly as published.

Index is the unweighted mean of within-family percentile ranks, with midranks for ties. A mature family requires six scored configurations from three organizations. Runtime alternatives for the same weights identity cannot multiply a reference cohort. One selected variant per family contributes. Two mature families permit a provisional number; three remove only the coverage qualification; one remains unranked. The default display requires two primary families, independently of the reference cohorts.

Author, competitor, community, secondary and unclear-operator evidence qualifies the affected index and every dependent comparison cohort. Conflicting observations retain source preference and explicit reasons; they are never averaged. Undated availability qualifies current indices and is excluded at historical cutoffs. The accessible ◊ popover lists the actual reasons and every contributing language/component source. Assumed, incompatible and private/vendor-internal values cannot create coverage, maturity or rank. Search/access/size filters do not recalculate reference cohorts.

The speech adaptation does not change OCR's thresholds, family eligibility, data or ranking behavior. The shared percentile functions are reused; speech defines its corpus selection and extra cohort qualifications separately.

## Exact sources and protocol limits

The [English CSV](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard-results/blob/e85ed601d17ab0e008721a19fc9cba36b4ee9c9c/english_short_latest.csv) supplies all 64 published rows. Its changing `avg` column is not silently treated as the original seven-set panel. Cleaned AMI/GigaSpeech and Artificial Analysis Earnings22/VoxPopuli labels remain explicit. OtterAI public results are contributor-reported per the maintainer version log; publication and execution attribution remain separate.

The [long-form CSV](https://huggingface.co/datasets/hf-audio/leaderboard_longform/blob/4f164c2c904b630d9777323b5d2e7f1f549d0143/longform_latest.csv) supplies 27 rows. CORAAL alone is selected for aggregate use, preventing the English panel's Earnings22 speech from being counted again. Missing CORAAL stays null. Negative throughput sentinels are not imported.

Eight [Open ASR language tables](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard/blob/main/init.py) retain separate pinned revisions in `sources.json`. The prepared corpus uses `nithinraok/asr-leaderboard-datasets` configurations such as `fleurs_fr`. Armenian is hosted separately and its exact configuration remains unknown. Hindi uses public `VoiceArena/Monsoon_hi_test` lattice references and the `voi-oiwer` orthographic-variant scorer: its source column is called `Monsoon WER`, but the measurement is labelled OI-WER. No private Hindi average is inferred.

The [Fermion launch table](https://www.fermionresearch.com/research/phonon-2/) remains a separate English protocol. Phonon-2 AMI 9.37 and LS clean 1.72 there differ from maintainer 9.32 and 1.73. Phonon-2/Phonon-1 are author runs, Redux is a Fermion competitor run and daggered rows are quoted leaderboard values. The [Moonshine v2 paper](https://arxiv.org/html/2602.12241v1) retains its eight-set author evaluation and reported means; it is not substituted into the cleaned seven-set protocol. Neither paper publication nor a copied model card is an independent run.

The [transcribe.cpp catalog](https://github.com/handy-computer/transcribe.cpp/tree/9f102d1ab18d01c0e21f9b3465531360c888251d/catalog) supplies 58 explicitly separate GGUF Q8_0 configurations, including small Whisper/Moonshine and Phonon-2. It retains CI95, utterance/error counts, batch size, upstream commit, engine SHA and measurement provenance. Some cells are `legacy-published` and omit run dates or engine revisions. The original Phonon-2 package is 164 MB; its Q8_0 artifact is 739,508,608 bytes (739.508608 decimal MB). These are different deployments, not conflicting sizes for the same artifact. Q4_K_M results are not copied into Q8_0 rows.

Private FFASR documentation was inspected; its public config exposed no scored rows. No missing FFASR scores or core vote were invented. Runtime speed on single JFK/dots clips and the private 20-dictation Mac workload remain ancillary. Source verification is not independent reproduction.

## Size, timing, pricing and history

Download/artifact bytes, model parameters, installed package size and runtime RAM are distinct. Hub stored-tensor totals can differ from author architecture totals; source observations remain separate. No peak RAM or hardware cost is inferred.

The 464 throughput observations keep hardware, backend, engine revision and exact sample/workload. Wall-time and compute-only RTFx remain distinct; model load is excluded from warm inference and shown separately when reported. H100 batch 128 is not a Mac single-stream comparison. Nine Moonshine paper observations measure end-of-utterance response latency on a MacBook M3 with an unspecified statistic; they do not establish p50/p95 or TTFT.

Official rates come from [Deepgram](https://deepgram.com/pricing), [AssemblyAI](https://www.assemblyai.com/pricing), [Gladia](https://www.gladia.io/pricing), [Mistral](https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02) and [Soniox](https://soniox.com/pricing). Gladia stays in EUR; no FX conversion is assumed. Deepgram current streaming promotions are separate from standard pre-recorded modes and Growth tiers. Soniox hourly equivalents are workload-dependent estimates, so only actual audio/text token tariffs are stored. Hosted Mistral Transcribe 2602 is distinct from open Voxtral Realtime 4B and has no borrowed accuracy score. Prices describe current services, not guaranteed historical benchmark endpoints.

Release replay uses explicit availability statements, not paper dates, result dates, or Hub creation timestamps. Unknown dates stay null and current-only; conversions do not inherit their upstream model's release date. Current prices retain their own pricing date in historical model views. Availability coverage remains incomplete.

Remaining gaps include matched diarization and silence/hallucination tests, streaming latency distributions and peak RAM. Local reruns should pin model/data/scorer revisions and preserve raw predictions, uncertainty, timing boundaries and workload costs.

Run `npm run validate`, `npm test` and `npm run build`. Never edit `_site/` directly.
