# OXR comparison backfill — source audit, 24 October 2026

The user supplied [SoMark's OXR post](https://x.com/somarkai/status/2112575002348503268) and both chart images. The matching [pinned official benchmark document](https://github.com/SoMarkAI/OXR/blob/62fbca8ef6c7c63b75b799fc8081f3eb6e667553/docs/benchmark.md) supplies exact numbers, component tables and timing methodology. The post is a discovery source; accuracy provenance is traced to original publications wherever available.

## Changes

- **20 peer speed observations added**, plus native decode speed and numeric wall time for the existing OXR observation. All **63 timing values across 21 models** are retained at published precision and visible in existing model-detail popovers.
- **12 accuracy observations added**: five full olmOCR source observations, four no-header/footer observations, one Falcon English-subset observation, one original MinerU modified-scoring observation, and one Xiaomi precision-preserving quotation.
- **One existing MinerU observation migrated**, retaining its 75.2 value and original source while correcting its protocol, source-specific model identity and execution attribution.
- **Two distinct identities registered**: LightOnOCR-1B (exact 1025 checkpoint in details) and GLM-OCR (API). No dates were added to display titles. LightOnOCR 2's public weights and Apache-2.0 access are now recorded.
- The source's **57 accuracy headlines and 300 numeric component cells** were audited; already complete OmniDoc and DocParsing rows were not duplicated. Four existing olmOCR entries gained **32 missing component values** from their original sources.

## Matched speed comparison

Every row uses one NVIDIA RTX PRO 6000 Blackwell 96 GB, a 24-CPU quota and 96 GiB RAM with no swap. The [pinned workload manifest](https://github.com/SoMarkAI/OXR/blob/62fbca8ef6c7c63b75b799fc8081f3eb6e667553/docs/frozen-100-pages.json) contains 100 unique filenames from OmniDocBench. These are the same 100 pages across models, separate from the full accuracy evaluations; the dataset revision is unpinned.

| Source model | Pages/s | Seconds / 100 pages | Native decode tokens/s |
|---|---:|---:|---:|
| OXR-1.0 | 0.990373 | 100.972 | 557.77 |
| OvisOCR2 | 0.741960 | 134.778 | 498.23 |
| PaddleOCR-VL-1.6 | 0.690952 | 144.728 | 516.39 |
| DeepSeek-OCR-2 | 0.620544 | 161.149 | 400.18 |
| LightOnOCR-2-1B | 0.582376 | 171.710 | 408.27 |
| HunyuanOCR | 0.570617 | 175.249 | 473.50 |
| ABot-OCR | 0.460113 | 217.338 | 244.32 |
| MinerU2.5-Pro | 0.392674 | 254.664 | 475.96 |
| FireRed-OCR | 0.332920 | 300.373 | 244.51 |
| GLM-OCR | 0.324711 | 307.966 | 333.33 |
| Qianfan-OCR | 0.264628 | 377.889 | 26.91 |
| jina-ocr-v1 | 0.173598 | 576.044 | 225.73 |
| Surya-OCR-2 | 0.146384 | 683.136 | 240.51 |
| TeleOCR | 0.135909 | 735.789 | 352.66 |
| Infinity-Parser-7B | 0.134736 | 742.192 | 89.98 |
| dots.mocr | 0.126064 | 793.250 | 235.71 |
| Chandra-OCR-2 | 0.064192 | 1557.821 | 134.25 |
| OpenDoc-0.1B | 0.027713 | 3608.370 | 189.58 |
| Youtu-Parsing | 0.023726 | 4214.749 | 109.40 |
| Logics-Parsing-v2 | 0.019561 | 5112.234 | 32.73 |
| Infinity-Parser2-Pro | 0.015530 | 6439.086 | 10.13 |

The three metrics remain distinct. End-to-end pages/s includes reading order; 100-page wall time is not request latency. Serial recognition decode excludes the first token, prefill and model reading order, and uses tokenizer-specific native tokens. No conversion between native tokens/s and pages/s is made.

Only OXR states two rounds of the same 100 pages: 100.972 seconds is the mean, and throughput is 200 attempts / 201.944 seconds. Its vLLM 0.25.1 runtime is not assigned to peers. Peer repetitions, backend versions, checkpoint hashes, timed precision, batch/concurrency and exact timing dates remain unspecified. New dates identify source verification, not a measured run date.

SoMark operates this comparison: OXR is author-reported and the 20 peers are competitor measurements. Generic MinerU2.5-Pro is not assigned to the exact 2605 checkpoint. The local Chandra-OCR-2 measurement belongs to open Chandra 2, and Hunyuan's unversioned source label is preserved.

Eight entries receive their first recorded throughput measurement: **HunyuanOCR, ABot-OCR, FireRed-OCR, Qianfan-OCR, TeleOCR, OpenDoc-0.1B, Youtu-Parsing and Logics-Parsing-v2**.

All 21 observations remain context-only (`comparison_default: false`, `cost_eligible: false`). The sortable H100 reference estimates, selected costs and quality indices are unaffected by speed additions. Exact values are included in visible notes because the existing introductory speed label rounds to two decimals.

## Accuracy scope and original evidence

| Source label | Headline | Stored protocol / identity | Primary receipt |
|---|---:|---|---|
| Qianfan-OCR | 79.8 | Full eight-category olmOCR | [Qianfan paper, Table 3](https://arxiv.org/html/2603.13398v1#S6.SS1) |
| LightOnOCR-2-1B | 83.2 | Seven-category mean, H/F excluded | [Pinned evaluation file](https://huggingface.co/lightonai/LightOnOCR-2-1B/blob/be7c41313c30e940fe5571de59e5fabc779e00c8/.eval_results/olmocrbench.yaml), [original paper](https://arxiv.org/html/2601.14251v1#S5.SS1) |
| LightOnOCR-1B-1025 | 76.1 | Separate LightOn 1B identity, H/F excluded | [Pinned evaluation file](https://huggingface.co/lightonai/LightOnOCR-1B-1025/blob/7e3e7b0cb83e237e7d237af5a583a002ea632547/.eval_results/olmocrbench.yaml) |
| GLM-OCR | 75.2 | Hosted Z.ai API identity, H/F excluded | [Pinned evaluation file explicitly naming the API](https://huggingface.co/zai-org/GLM-OCR/blob/2e85a62840ccac27daa451df36c736c4636b8628/.eval_results/olmocrbench.yaml) |
| DeepSeek-OCR-2 | 76.3 ± 0.9 | Competitor rerun, H/F excluded | [Original reporter's post](https://x.com/staghado/status/2016161372938117205), [original chart](https://pbs.twimg.com/media/G_rVlzsXsAEpc57.jpg) |
| FalconOCR | 80.3 | English-only subset, all eight categories | [Original paper, Sections 6.5–6.6 / Table 10](https://arxiv.org/html/2603.27365v1#S6.SS5) |
| MinerU2.5-2509-1.2B | 75.2 | Separate CDM-ExpRate variant under MinerU2.5 | [Original paper, Table 8 / Section 5.1.1](https://arxiv.org/html/2509.22186v1) |

The asterisks in the OXR graphic do not mean one uniform exclusion. LightOn 1/2 and GLM omit the H/F category from the aggregate; Falcon excludes non-English documents. DeepSeek 2's original reporter also excludes H/F even though OXR does not star that row.

The new no-H/F panel contains four distinct identities and uses the existing policy for a separate qualified whole-document protocol. H/F values, where published, are explicitly diagnostic and excluded from its overall. LightOn 1's pinned YAML/OXR Base value is 99.6 while the paper prints 99.5; that discrepancy is visible and no blended vector is constructed. DeepSeek 2's original image supplies Base 99.6, absent from the partial OXR transcription; its H/F value remains missing. GLM's 75.2 is not transferred to downloaded weights or substituted for the existing full-set 68.4 observation.

Falcon's paper uses PP-DocLayoutV3 plus recognition and does not pin the run to a later Falcon 1.5 generation. Its retained page count is unknown. The new English and CDM panels currently each contain only one model identity, so they produce no percentile under the unchanged two-distinct-identity gate.

### Four missing component vectors

The [pinned AllenAI maintainer table](https://github.com/allenai/olmocr/blob/f7cfe4c22098b154c76b6ec950d1c0a464eecf8d/olmocr/bench/README.md) provides Chandra OCR 0.1.0 **83.1**, Infinity-Parser 7B **82.5** and DeepSeek-OCR **75.7** with all eight components. Its footnote explicitly distinguishes the first two author reports from the third, reproduced in-house. Published uncertainty is retained; Infinity's unknown uncertainty stays unknown.

The [original dots.ocr card](https://huggingface.co/rednote-hilab/dots.ocr/blob/c0111ce6bc07803dbc267932ffef0ae3a51dc951/README.md) supplies **79.1 ± 1.0** and all eight components. Removing header/footer cells from the predicted output is preprocessing; its H/F benchmark category is still included at **94.1**.

Each vector is a separate original-source observation. Existing headlines are preserved; components are not grafted onto a different source's row.

### MinerU correction

The old `mineru-2-5-4` / `olm-mixed` record said “AllenAI reproduced.” The actual pinned table marks **MinerU 2.5.4*** as an author report, as does [AllenAI's original paper, Table 3](https://arxiv.org/html/2510.19817v1). Its complete vector matches the original MinerU Table 8, which explicitly replaces arXiv Math and Old Scans Math evaluation with CDM ExpRate.

Only that source record moves from standard olmOCR to the CDM-ExpRate variant. Its original source ID, numeric value, prior model ID and printed model label are retained. The original MinerU paper supplies a second observation with the complete vector; they are two publications of one author result, not two independent executions.

The identity bridge is source-specific: [OmniDoc's pinned MinerU2.5 model entry](https://github.com/opendatalab/OmniDocBench/blob/f133a71e9e91c3621c7ce8994200a7b394a06eb3/README.md#L1960-L1962) and the original paper both link to `opendatalab/MinerU2.5-2509-1.2B`. No global equivalence between all software 2.5.4 runs and all 2509-weight runs is asserted.

### Existing headline coverage and precision

All 23 OmniDoc and all 17 DocParsing headline rows were already retained. The DocParsing native-precision ratios remain intact; chart percentages are not added as different measurements. Historical Chandra and GLM source alternatives remain available under the existing source-selection rules.

Xiaomi's quoted text edit **0.0313** and reading-order edit **0.1221** are retained in one separate, secondary-source vector. Existing author-paper values **0.031 / 0.122** remain selected and unchanged. The additional decimals are compatible with rounding; they do not establish a new independent run.

## Validation and leaderboard effect

- The dataset now contains **211 OCR identities, 625 quality observations and 163 speed observations**. The default **2+ primary-family** view still contains **75 models**, and its top five are unchanged.
- The preservation audit retains **all 613 previous observations and all 3,175 previous metric values**, allowing only the documented MinerU source-record migration. All **142 unrelated throughput lines** are byte-for-byte unchanged.
- The ranking formula, family priority rules, default filter, matrix ordering and UI implementation are unchanged. Newly available eligible evidence changes some indices naturally. No-header/footer results are normalized only within their own protocol; a model still receives at most one contribution per family.
- Every existing selected deployment speed, H100 reference and price remains unchanged. Prices remain USD; no new tariff is inferred from timing.
- Validation, all **22 test files**, and the Eleventy build pass. Focused regression coverage checks protocol separation, hosted/open identity boundaries, singleton behavior, timing visibility and the independence of quality/H100/cost calculations from the new RTX measurements.
- Preview and production verification are recorded in the pull request.
