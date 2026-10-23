# Voshart Benchmarks

Small data-driven benchmark pages for [OCR](https://bench.voshart.com/ocr/) and speech-to-text (`/stt/`). Eleventy generates static HTML; dependency-free JavaScript progressively enhances sorting, filters and release-date replay. Designed to publish at `bench.voshart.com` via Cloudflare Pages.

## Local use

Requires Node 20+.

```bash
npm ci
npm run validate
npm test
npm run build
npm start
```

Cloudflare Pages: build command `npm run build`, output directory `_site`, production branch `main`. Pull requests can use Cloudflare preview deployments. Do not commit `_site/` or `node_modules/`.

## Editing data

- `data/models/registry.json`: model identity, developer, model access, release date and lineage. Only exact verified versions should share an identity.
- `data/ocr/tests/*.json`: one benchmark *variant* per file, including whether it is eligible for aggregate rank.
- `data/ocr/results/*.jsonl`: one observation per JSON line. Keep metric precision and `source_id`.
- `data/ocr/pricing.jsonl`: a published or observed **USD per 1,000 pages** observation and its basis; token input/output prices are a different unit and must not be silently converted.
- `data/ocr/sources.json`: published source URLs with provenance and caveats.
- `data/ocr/archive/`: inherited research snapshot, **not** additional independent measurements.

The importer preserves older public, third-party and vendor-run observations as separate source records. The new 2026-10 records mark Xiaomi and PolyOCR results `author_reported`, Datalab 2.1 `vendor_internal`, and OpenOCR as `third_party`. Authors' 96.83 OmniDoc and 87.0 MDP public results are not mistaken for official leaderboard or private measurements.

The historical slider uses *model release dates* to choose eligible generations, ignoring the publication date of test results. Undated releases are excluded from historical cutoffs but available in the current view. Core Rank is the mean of within-benchmark percentile ranks, with midranks for ties, once a family contains six scored models across three organizations. Two primary benchmark families are required by default **only for display**. Two mature core families permit a provisional index; three remove only the limited-coverage qualification. Limited, correlated, private vendor-only and small-sample tests are available but excluded from aggregate Rank.

## Evidence rules

The dashboard is an index of third-party and author-reported research, not a single reproducible test harness. Do not silently merge OmniDoc v1.5, v1.6 English subset and v1.6 full. Do not equate NDI's MDP component with official MDP *private*. Never infer PolyOCR's private score from its public score. A hosted product and open weights are different deployments; assumed floors must stay outside source selection, coverage, maturity and ranking.

## OCR speed and cost

The matrix's **H100 pages/s** column now shows37 low-confidence planning ranges on one declared reference: **1×H100 SXM80GB +16x86 vCPUs +64GB host RAM**. It is not a controlled benchmark, weakest-card claim, or guarantee every model fits. All80 registry-open models were audited; two additional verified public checkpoints are included. Five native checkpoints exceed80GB before runtime memory; two35B models are borderline; a hosted Qwen alias, unresolved configurations and CPU-only exceptions remain explicit. Tensor storage bytes are not peakVRAM. No silent quantization, CPU offload, sharding or active-MoE-parameter shortcut is used.

`data/ocr/reference-throughput.json` separates assumptions from measured evidence. The typical-page scenario is roughly2048px long edge and1000–3000 total output tokens across all calls (or comparable text-only output), warm queued throughput with memory-fitting batching up to16page requests. Different crop pipelines/output tasks remain different work. BF16/FP16 is assumed for supported GPU generative paths; classical/CPU paths retain native precision. Indra uses4host vCPUs and gets no imagined GPU acceleration; its reference cost includes the allocated GPU even when unused. Scores were not re-evaluated under these speed settings.

NativeH100 results receive a broad workload/runtime allowance, not a fictitious exact common-page rate. Paired Typhoon/olmOCR/NVIDIA observations support class-specific A100→H100 assumptions; generated lengths, batching and CPU work prevent a universal multiplier. H20/consumer gaps use explicit broad pipeline-family scenarios, not FLOPS normalization. Neither the transfer bands nor their page-workload allowances are fitted confidence intervals; dense/long pages, image resolution and integration paths can put performance outside them. Sources, method and fit evidence are recorded in `reference-calibration-2026-10-22.json` and `reference-fit-audit-2026-10-22.json`.

Original82observations in `throughput.jsonl` and18earlier hardware scenarios in `throughput-estimates.jsonl` remain in row Details, including conflicting hardware/configurations; they no longer populate the main speed column. Quality source selection, coverage and all rank values are unchanged. Missing values stay last in either sort direction. Ranges sort by geometric midpoint only; overlap does not establish a winner.

All local reference costs use the same editable, explicitly illustrative **$1 per complete H100 setup-hour** at100% utilization. Cost endpoints are `rate ×1000 /(high_speed ×3600)` through `rate ×1000 /(low_speed ×3600)`. They exclude idle/loading, storage, licenses and rental minimums and are not hardware market quotes.76 models have numeric API/context/scenario costs. Actual hosted API tariffs and token scenarios remain distinct; APIs do not inherit local GPU speed. Published alternative prices remain in Details rather than overriding reference compute cost for local models.

API token budgets default to1000billable input +1000output tokens/page, capped at200000within listed tariff bands. They affect API costs only, not the fixed local speed-workload scenario. Input includes image tokens and output includes billed reasoning. Historical release views retain source-dated deployment evidence.

## Speech-to-text

The `/stt/` page contains **172 model configurations, 975 accuracy source rows across 11 protocols, 464 throughput measurements, nine latency observations, nine hourly tariffs and two token-rate configurations**. Its Matrix, English, Long-form, Multilingual, Noise & accent, Small models, New research, Secondary, Local speed, Latency and Pricing views share OCR's styling and core evidence policy. Search, access/coverage/download/parameter filters and verified-release replay work in the browser; the default matrix is rendered statically. Speech identities use `topics: ["stt"]` and stay outside OCR cohorts.

Sources include the [64-row English CSV](https://huggingface.co/datasets/hf-audio/open-asr-leaderboard-results/blob/e85ed601d17ab0e008721a19fc9cba36b4ee9c9c/english_short_latest.csv), [27-row long-form CSV](https://huggingface.co/datasets/hf-audio/leaderboard_longform/blob/4f164c2c904b630d9777323b5d2e7f1f549d0143/longform_latest.csv), eight pinned language tables, the [transcribe.cpp runtime catalog](https://github.com/handy-computer/transcribe.cpp/tree/9f102d1ab18d01c0e21f9b3465531360c888251d/catalog), [Moonshine v2 paper](https://arxiv.org/html/2602.12241v1) and [Fermion launch report](https://www.fermionresearch.com/research/phonon-2/). Original/open/hosted/quantized generations remain separate. Phonon-2's 164 MB original package is distinct from its 739,508,608-byte GGUF Q8_0 conversion; neither inherits the other's measurements. Source rows retain CI95, sample count, batch size, engine revision and execution attribution where reported.

Speech ranking explicitly selects three disjoint core families: the fixed seven-set English panel, CORAAL alone from long-form, and five-language FLEURS. Other long-form corpora, MCV/MLS, extra languages, author versions, GGUF variants and tiny speed checks add no extra votes. Maturity stays six configurations across three organizations; two families permit a provisional index and three remove only the coverage qualification. Unknown execution operators, conflicting observations and undated model availability qualify own and dependent cohort indices, with accessible ◊ explanations. A lone family stays unranked, including original Phonon-2, which is discoverable in Small models/New research. OCR data and ranking behavior are unchanged.

Prices retain currency, provider, tier, service mode and date. Gladia stays in EUR; no exchange rate is assumed. Soniox's actual audio/text token tariffs remain separate from estimated hourly equivalents. Hosted Mistral Transcribe 2602 does not borrow the open Realtime 4B result. Historical views use verified model availability; most conversion dates remain unknown and current-only. Hindi Monsoon retains lattice-reference OI-WER rather than standard WER. [Speech data documentation](data/stt/README.md) gives the schema, source revisions, qualifications and remaining gaps. No transcription model was executed locally. Validation, tests and build cover both topics.

## Adding another benchmark

Create a `data/<topic>/config.json`, tests, sources, observations, and a page using the shared CSS/table UI. Extract shared sorting/ranking functions into `lib` or `src/assets/js` rather than copying monolithic HTML. Do not assume that OCR ranking methodology applies to other domains.

## Deploy

This site isn't precious. The owner authorizes contributors to commit, merge into `main`, and publish requested site updates without asking for separate merge or deployment confirmation. Direct commits to `main` are welcome for small changes; when using a PR, merge it once the required checks pass. Do not leave completed work waiting in an unmerged PR for another approval.

Keep the evidence provenance and ranking rules in `AGENTS.md`, and run `npm run validate`, `npm test`, and `npm run build` before publishing. Ship promptly and verify the live result.

Keep `bench.voshart.com` as the canonical site, with `/ocr/` as the OCR route. Link `ocr.voshart.com` with a redirect if desired. A GitHub push to `main` triggers the Cloudflare Pages production deployment.

### Cloudflare Pages setup

Connect this repository through Cloudflare Pages Git integration. Use `main` as the production branch, `None` as the framework preset, `npm run build` as the build command, and `_site` (singular) as the output directory. Leave the root directory blank: `package.json` lives at the repository root. Enable automatic production deployments and preview deployments for update branches. Add `bench.voshart.com` under the project's custom domains after the first successful deployment. Enter only the hostname, without `/ocr/`; the OCR page is served at `https://bench.voshart.com/ocr/`.

Commit source files and `package-lock.json`; Cloudflare builds the site from GitHub. Uploading a ZIP to a local workspace does not put its files into the repository. Generated `_site/` files and `node_modules/` must stay out of Git.

### Routine LLM updates

Contributors should follow `AGENTS.md`, verify primary sources, update the data files, run validation/tests/build, and publish to `main` without another confirmation. If using a PR, include exact source links and caveats, check the Cloudflare preview, and merge it to trigger production deployment. GitHub Actions validates the change; Cloudflare Pages performs the deployment separately. Verify the production site after deployment.

Example request:

> Update the OCR benchmark with verified results for [model/version or source URLs]. Follow AGENTS.md, preserve source provenance and missing values, and list any unverified claims. Run npm run validate, npm test, and npm run build, then publish to main and verify the live site. If using a PR, include source links and the expected leaderboard effect, then merge it without asking for another confirmation.

## Verified expansion — October 13, 2026

Production is live at https://bench.voshart.com/ocr/ and https://benchmarks-15s.pages.dev/ocr/. PR #2 was merged into `main` and the expanded dataset was verified on both production addresses on October 15, 2026. This update contains 177 model records, 381 scored observations, 30 test variants, 62 page-price observations (including 23 preserved/unverified imports), 19 official token-rate observations, and 68 source records.

- `New research` exposes Xiaomi-OCR-0, PolyOCR-2.7B and the distinct PolyOCR-9B direct/pipeline configurations. It labels one-family evidence **Unranked** and shows qualified multi-family indices with a **◊** marker. The default filter is now two primary families, under the explicit provisional policy below.
- Xiaomi's public model card establishes the weights release as September 30, 2026. Its OmniDoc/Wild component scores now retain text, formulas, tables and reading order. PolyOCR weights remain unreleased; the report date is not a weights release date.
- PolyOCR-9B's direct and layout-guided OmniDoc v1.6 results are distinct observations/model configurations. They are not assigned to the specialized 2.7B MDP model or treated as independent evaluations. The redundant public-only PolyOCR record was removed from the private-results file; no private score was created.
- Thirteen IDP model pages supply additional IDP Core v1.0 task breakdowns and a separate OmniDoc v1.5 operator comparison. The v1.5 variant stays secondary, outside aggregate rank and primary coverage. Five additional OpenOCR observations retain reported uncertainty and remain secondary.

Pricing retains mode, provider, source, verification date and basis. Official page tariffs, credit-derived vendor rates, benchmark workload estimates and USD-per-million-token rates have separate meanings. Pricing links lead to the original rate card or operator model page. **Service** prices describe current hosted products without promising a pinned historical model generation. **Self-hosted** means a deployment-specific compute cost, not zero. Imported prices remain in a collapsible table and carry a qualification marker when selected for the matrix.

`data/ocr/pricing-tokens.jsonl` stores official API input, cached-input and output tariffs separately. No page cost is inferred from those token rates. Gemini 3.1 Pro Preview has separate prompt-length bands; its prices are not attached to Gemini 3 Pro. Discounts, annotations and service modes are separate page-price observations. The handoff's $0.40 Mistral batch claim was not verified: the official pricing table places that value under cached input, while Batch Processing documentation specifies 50% off. The verified batch observation is therefore $2/1,000 pages from the $4 standard rate; the old claim is retained with an unverified flag. `comparison_default: false` keeps an alternative rate from silently replacing the matrix's selected configuration.

Validation now checks raw observations before display filtering, model/source references, metric ranges, dates, duplicate pricing configurations and pricing units. The preview watches `data/` and `lib/`; the history slider takes its range from page configuration rather than fixed JavaScript dates.

### Remaining evidence gaps

The inherited registry and benchmark records have not undergone a complete source audit. The old NDI URL now redirects to a product page, so its inherited score/cost observations remain unverified imports. Model release dates marked `legacy_import` remain candidates for verification. The former Chandra API floor substitution has been removed. Its actual hosted records remain distinct from open weights, so it has no aggregate index with only one measured core family. Adding qualified observations changes percentile cohorts and therefore some existing rank values; this is an explicit methodology update.

Reverify rate cards before making purchasing decisions. Numeric prices describe the identified configurations and source dates, excluding unlisted taxes, license charges, hardware, regional surcharges or add-ons.

## Provisional ranking policy

Eligible measurements must match the model/configuration, dataset variant and metric. Official, independent, community, author-reported and vendor/competitor measurements on comparable standardized tests can all enter the same percentile calculation. The operator determines qualifications, not a model-specific exception. Assumed values, vendor-internal corpora and explicitly incomparable measurements never enter coverage, maturity or rank.

A mature family has six scored models across three organizations. Only one chosen mature variant per family contributes. A rank is the unweighted mean of its family percentiles, with midranks for ties. Two mature core families permit a numeric provisional index; three remove its coverage qualification. One family is unranked. Smaller display coverage does not change the reference cohorts. Real5, alternate OmniDoc versions, small samples and task-only recognition/VQA tests retain their existing secondary/non-core roles.

A rank remains provisional when its own evidence or reference cohort includes author, vendor/competitor, mixed, imported, secondary or unclear-operator measurements; when contributing observations disagree; or when model availability is unknown/unreleased. A qualified reference result affects everyone whose percentile depends on it. **◊** reveals the model's actual reasons and contributing sources on hover or click; the button and popover work with keyboard navigation. The confidence qualification is not a statistical confidence interval or a claim of independent reproduction.

Source preference is official benchmark publication → independent third party → community → model authors → vendor/competitor → mixed/unknown/imported/secondary. Conflicts remain separate; no averages replace observations. A published maintainer table can take precedence while its execution operator and pipeline remain unspecified.

### Grounded Xiaomi search — October 13

The Real5 maintainers added Xiaomi on October 12 and publish **92.73** overall, versus **95.24** in the author report. Both observations remain in `real5.jsonl`; the maintainer result is selected and the alternative is visible in the cell's source tooltip. This publication does not prove an independently reproduced run or identify the exact pipeline. Source: https://huggingface.co/datasets/PaddlePaddle/Real5-OmniDocBench#1-overall .

The paper also supplies PubTabNet, UniMER-Test, Chronicles mature-script and five-task OCR-VQA evidence, now exposed in Recognition/Understanding and New research. These are secondary task-specific measurements and do not manufacture a third full-page parsing family. The stored Chronicles result stays on its original 0–1 scale. Source: https://arxiv.org/html/2609.36136 . The checked official OmniDoc, PureDoc and MDP pages did not contain a matching Xiaomi entry; absence in those pages is not proof no evaluation exists elsewhere. Search scope and limitations are recorded in `data/ocr/research-xiaomi-2026-10-13.json`.


### Missing-model expansion — October 13

Added Jina-OCR-v1; LightOnOCR-3-0.8B/1B/4B; NVIDIA Nemotron Parse 2.0; Hiro-MOSS-OCR-0.3B; Docling pipeline; Granite-Docling-258M; SmolDocling-256M-preview; Amazon Textract; Google Document AI Enterprise OCR; Mathpix OCR API; and Tesseract. `All registered` in the coverage selector exposes entries with no matched scores. Model names link to their official source; tooltips retain configuration and evidence gaps. Generic pipelines/services/engines are explicitly unversioned until a benchmark pins their configuration.

Jina has two author-reported core measurements (OmniDoc v1.6 91.14 and olmOCR 83.4), so it receives a provisional index. LightOn's 0.8B/1B/4B olmOCR scores (85.5/84.5/86.3) supply one core family; ParseBench and fr-bench results remain secondary. The source documents author postprocessing and per-size resolution settings. MOSS's 93.63/94.46 OmniDoc v1.5/v1.6 results use **ground-truth layout labels** and have separate non-core variants. NVIDIA's ParseBench, IndicVision, MOSCAR and OmniDoc notes-subset measurements retain their original 0–1 scales, including lower-is-better notes text edit distance. LightOn and NVIDIA ParseBench runs stay separate because protocol identity is not established. Granite/Smol FinTabNet 150dpi table recognition and the official historical Mathpix v1.0 formula subset stay task-only. No card's vaguely specified full-page OCR evaluation is silently assigned to a core family.

Jina's release date uses the explicit September 14 public release announcement; September 1 Hub repository creation is not used as weights availability. SmolDocling's exact release remains null. Current OCR-only Amazon/Google rates and Mathpix document/async page rates include exact tiers and mode. Image or stroke prices are not converted to page prices; activation fees and regional/configuration caveats remain explicit. Research scope is recorded in `data/ocr/research-missing-models-2026-10-13.json`.

### Diagnosing old Cloudflare retries

A log that clones `b81489e` describes the original scaffold commit, which had no root `package.json`. `main` subsequently deployed successfully at `2c5101a`; root-directory changes cannot add files to an old commit. Retrying an old deployment rebuilds its old source. In the existing Pages project's Deployments tab, use the newest successful production deployment or create a deployment from the latest `main`. Confirm the SHA in the new clone log. Pull-request previews are distinct from production: merging the reviewed PR into `main` triggers the next production build when automatic production deployments are enabled.

Small-model expansion (2026-10-23): seven additional H100 scenarios cover Jina, Surya OCR2, Nemotron Parse2, matching triple-pass Nemotron3.5, and PP-OCRv5 server/mobile plus v4 mobile. Paddle pipelines are text-only; their component scores never enter full-document ranking. Native observations, concurrency differences, output limits and omitted setup work stay in Details. New Nemotron3.5 first-public release date remains unknown, so it is latest-view-only. Select All registered to see models without two primary benchmark families.

### Top-five details and visible benchmark columns — October 23

Expanded the current leading five OCR entries with **112 numeric details**: GLM-5.3-Flash's PureDoc/Real5 components, Gemini 3 Pro preview and Kimi K3's public MDP language breakdowns, and Sarvam Vision 2.1's olmOCR categories plus separately labeled OmniDoc/Indic reports. Chandra 2.5 (accurate), formerly labeled Datalab accurate, includes verified corpus sizes and scope for all three OmniParse panels. The current [Datalab Convert page](https://www.datalab.to/platform/processors/convert) confirms the product name and matching 93.5 overall result. Its October 20 run date stays in metadata; the exact backend revision remains unpinned, and earlier Chandra release-evaluation results stay separate. The [source audit](docs/ocr-top-five-details-20261023.md) records exact source links, model/split limits and a published Real5 inconsistency.

The default matrix shows every selected protocol's headline score in its benchmark-family column. Numeric cells contain values, qualification symbols and inline info controls, without repeated protocol or status words. Public/private splits and additional tag slices each retain a visible score. Per-result info controls open popovers containing component tables, full protocol names, source links, dates and scope notes; the popovers use the browser's top layer so table columns cannot clip them. Model names wrap, source-native precision is preserved with readable display rounding, and both table scrollbars remain reachable in a bounded viewport. The model info control retains full notes, deployment caveats and alternate observations. Unknown speed/cost values use an em dash. Sorting still uses each named primary protocol. Ranking math, all existing numeric indices, prices and throughput assumptions are unchanged; the two new Sarvam protocols do not contribute to ranking.
