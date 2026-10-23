# Datalab competitor-table audit — 2026-10-23

## Included: six observations, two existing/new secondary protocols

- **Chandra 2.5 release:** add Chandra 2 open (raw 85.1 / own 85.8 / PP3 86.2) and LightOnOCR-3-4B (85.0 / 85.4 / 86.0) to the existing no-headers/footers cohort. The hosted Chandra 2.5 row was already present. Datalab executed these comparisons; its LightOn reproduction is not LightOn's own 86.3 result. Harness: olmocr 0.4.27, benchmark revision `54a96a6`. [Release source](https://www.datalab.to/blog/chandra-2-5).
- **Marker 2 PDF pipeline:** add the four source-labelled configurations that can be attached contextually to existing IDs: Chandra 2 hosted, Marker 2 balanced, unversioned MinerU pipeline, and unversioned Docling GPU pipeline. This does not establish exact checkpoint/package versions for generic catalog identities. Overall uses the official olmOCR checker over 1,403 PDFs and eight category macro-averages. Digital-only excludes the two old-scan categories. Native PDF text-layer access and selective OCR differ from a fixed page-image-only workload. All four observations stay secondary; existing core observations are not replaced. [Release source](https://www.datalab.to/blog/marker-2).

## Surya identity and duplicate ledger

Official sources identify **Surya OCR 2**, released May 27, 2026, not Surya 2.5. No official 2.5 identity was established by the checked Datalab blog, Hugging Face organization or model card. Do not manufacture a version alias. [Release](https://www.datalab.to/blog/surya-2); [pinned model card](https://huggingface.co/datalab-to/surya-ocr-2/blob/3b3d4cdf88d6928b0acdc75181b13206ea67c4a3/README.md).

The eight-row card table explicitly takes competitor scores from the olmOCR-bench dataset card. It is not evidence that Datalab independently reran every competitor. Six headline values already occur in the repository: Infinity-Parser2-Pro 87.6, Chandra 2 open 85.9, dots.mocr 83.9, Surya 2 83.3, Chandra 1 open 83.1 and GOT OCR 48.3. Surya's own default-preset, 8,413-test category breakdown can enrich its existing evidence, not create another family vote. LightOnOCR-2-1B 83.2 is explicitly noncomparable context. Anchored olmOCR 77.4 needs an exact anchored-generation mapping before ingestion.

## Excluded or deferred

- Marker fast and fast/no-OCR need distinct configuration identities; do not attach their 66.6 and 43.6 scores to balanced Marker 2. Liteparse no-OCR also needs its own identity. Gemini Flash 3.5 in the Marker table is not Gemini 3 Flash and not the speech-transcription model.
- Chandra 2.5's OmniParse comparison names Gemini 3.8 Flash, Reducto and LlamaParse without sufficient exact endpoint/mode mapping in the release table. Preserve the ledger rather than assign an arbitrary Reducto r-1 or LlamaParse agentic variant. Gemini contributed to creating/verifying some benchmark tests. This release cohort is distinct from later OmniParse revisions.
- Datalab's [overall benchmark page](https://www.datalab.to/benchmark/overall) displays scores such as 1798/1638 without an established percent-accuracy contract, corpus or pinned generations. Excluded from numeric ingestion pending protocol clarification.
- Native throughput remains source-specific: Marker GPU rows use one B200 with an unspecified host; no-OCR rows are CPU-only. No B200-to-H100 estimates or reciprocal-latency claims are introduced by this audit.
- Surya's internal 91-language benchmark is not a core public full-document benchmark.

## Reproducibility and limits

[Marker harness pinned at `6d40b01930dd45f4fc3b014f2ede8fb0d8cb6b81`](https://github.com/datalab-to/marker/blob/6d40b01930dd45f4fc3b014f2ede8fb0d8cb6b81/benchmarks/README.md) documents native competitor parallelism, PDF conversion and output normalization. This current source pin is **not proof of the original July release's exact run commit**; competitor package versions remain unpinned. Its normalization includes HTML sub/sup conversion, markdown/math unescaping and image-alt-text removal. No models or evaluation code were executed. Source verification is not independent benchmark reproduction.

## Other comparison sources included in the same pass

- LightOnOCR-3 release: six missing ParseBench and five missing French-document competitor rows, plus six full eight-category olmOCR breakdowns. A comparison publisher is not automatically the measurement operator: rows explicitly state when rerun versus quotation is unspecified. Existing contradictory observations remain intact.
- Pinned LightOn reproduction CSV (`36755d461be079737860a5f03ae0c803501269e9`): OvisOCR2 full-set 70.5, **not** its headers-excluded 78.1. Other conflicting CSV/blog alternatives are retained in research receipts rather than silently replacing headline observations.
- Jina OCR paper Table 7: twelve previously missing A100 speed observations; Table 6 adds the missing HunyuanOCR1.5 OmniDocBench v1.6 result as a **secondary quotation**, not a Jina rerun. Surya's already-ingested speed is deduplicated.
- NVIDIA pinned matched-timing manifest: nine additional single-H100 speed observations, retaining native pipelines, source-specific concurrency32–128 and prepared-page timing exclusions. Existing Parse2 speed is deduplicated. Original observations are in Details; existing normalized ranges do not change.
- ParseBench upstream CSV pinned `9af4102e26b51f234ab5f037e19fec05c0696ec6`: ten exact-model published quality rows in a separate secondary panel, verified against the original CSV. These are **not** quality measured in NVIDIA's matched speed run. The `layout` metric denotes visual grounding, not a different reproduced EPR metric.
- Three newly identified public checkpoints: Infinity-Parser2-Flash, KDL Frontier Parser nano, and **MinerU2.5-Pro-2605-1.2B**, kept separate from older MinerU Pro. Exact weight revisions are sourced; first-public release dates remain unknown. Their H100 ranges use the existing low-confidence 0.4–2× native-H100 workload envelope, rounded outward; not confidence intervals. Compute cost uses the same editable hourly assumption and inverted bounds. No API tariff is inferred from these measurements.

This bounded pass adds **36 quality observations, 21 raw speed observations and three exact checkpoint identities**. The three new H100 scenarios do not alter quality ranks or substitute for source measurements. No new price/weight-size claims were supported by these panels. Additional quoted duplicate scores, ambiguous hosted modes and non-OCR text-layer configurations are documented above rather than guessed into existing identities.
