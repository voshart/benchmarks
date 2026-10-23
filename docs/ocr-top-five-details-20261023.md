# Top-five OCR detail and visibility audit — 2026-10-23

The scope is the five leading models in the default OCR matrix at repository commit `b713c8f17e7a98ee1100e2147305f6568a4651ae`. This is the repository's evidence-relative rank index, not an accuracy percentage. Each of these models currently has one contributing benchmark family, so every index remains provisional.

| Model | Rank index before and after | Added numerical detail |
| --- | ---: | --- |
| GLM-5.3-Flash | 99.13793103448276 | 12 PureDoc track components and 25 Real5 scenario/component values |
| Gemini 3 Pro preview | 98.4375 | MDP public Latin/non-Latin means and 17 public language scores |
| Kimi K3 | 95.3125 | MDP public Latin/non-Latin means and 17 public language scores |
| Sarvam Vision 2.1 | 95.28301886792453 | Eight full-set olmOCR components; six values in a separate split-unspecified OmniDoc report; 23 values in a separate Indic recognition report |
| Chandra 2.5 (accurate) | 95 | Verified corpus sizes, scoring method, snapshot date and model-identity limits for its three existing OmniParse panels |

This adds **112 numeric fields**, including two new context observations. Existing numeric observations are preserved. The catalog has 205 registered OCR models, 202 default-view model rows, 550 observations and 50 exact test protocols. Neither the ranking calculation nor any existing model's numeric index or contributing protocols changed.

## GLM-5.3-Flash

PureDoc's [pinned component CSV](https://github.com/zhihengli-casia/PureDocBench/blob/fdae62435871eb7ba058a804574ad1a9d2fd6cf1/results/components.csv) supplies text edit, formula CDM, table TEDS and reading-order edit for each of the clean, digital-degradation and real-degradation tracks. The original clean **83.04**, digital **81.03**, real **74.99** and Avg₃ **79.69** remain unchanged. The [result documentation at the same revision](https://github.com/zhihengli-casia/PureDocBench/blob/fdae62435871eb7ba058a804574ad1a9d2fd6cf1/results/README.md) explains the released summaries and missing historical run hashes. The corpus has 1,475 source pages in three matched tracks, or 4,425 images. Reading-order edit is a separate metric, not another contribution to the headline.

The [pinned Real5 dataset card](https://huggingface.co/datasets/PaddlePaddle/Real5-OmniDocBench/blob/495570bdb69e09e4aaf38eb61c12a4e06bc65fa4/README.md) supplies five scenario overalls and four components per scenario. The source re-creates 1,355 OmniDocBench v1.5 pages in five physical conditions. The existing **90.76** overall is preserved. Text and reading-order edit use 0–1 distances with lower values better; CDM and TEDS retain their 0–100 scale.

Four printed Real5 scenario overalls do not reconstruct from the printed components using the source's stated formula. These are retained as published, with a visible qualification. The following calculations are an audit only; they are **not** stored benchmark results or replacements:

| Scenario | Published overall | Formula applied to printed components |
| --- | ---: | ---: |
| Warping | 89.84 | 84.7567 |
| Screen photography | 90.36 | 89.8200 |
| Illumination | 91.40 | 90.9067 |
| Skew | 90.76 | 86.0200 |

The original execution operator and immutable inference settings are not separately established for these maintainer-published GLM observations. The PureDoc observation includes an explicit provisional reason. Verifying a publication is not a new evaluation run.

## Gemini 3 Pro preview and Kimi K3

The [pinned MDPBench table](https://github.com/Yuliang-Liu/MultimodalOCR/blob/4e363b3f499811b43d792ef0bb33932ef05eca27/MDPBench/README.md) names these exact model labels. Each public observation gains two script-group means and all 17 language scores. The new fields belong only to the **public** split. Existing held-out private scores remain **89.8** for Gemini and **85.6** for Kimi; no private language breakdown is inferred.

The [MDPBench paper](https://arxiv.org/html/2603.28130v1) describes page-level aggregation and the excluded header/footer/page-number/footnote elements. Its 3,400-image benchmark description does not establish each linked result's per-split denominator, so no public/private sample count is invented. The [Kimi evaluation submission by the benchmark maintainer](https://huggingface.co/moonshotai/Kimi-K3/discussions/170) establishes that the MDPBench team evaluated that exact model. Kimi's release date remains unknown in this repository.

Real5's generic `Gemini-3 Pro` label is not sufficient to assign its scores to `Gemini-3-pro-preview`. The repository's MDP example CSV also contains a conflicting Gemini result without a matching protocol receipt. Neither is silently substituted for the authoritative table.

## Sarvam Vision 2.1

The [September 24 release report](https://www.sarvam.ai/blogs/sarvam-vision-2-1) explicitly distinguishes its current official/full olmOCR set from the earlier filtered-English evaluation. All eight category scores are now recorded under the existing **87.3** headline, with Sarvam identified as the operator.

Two additional reports are recorded in separate, nonaggregate protocols:

- **OmniDoc v1.6, split unspecified:** **94.97** overall plus five component values. The report does not resolve full-set versus English-only scope. The observation has `comparable: false` and cannot become the canonical full-set result or contribute to ranking. Its component ratios retain their source-native scales and directions.
- **Indic OCR text-block recognition:** **87.39** reported overall word accuracy plus 22 language scores. The [official dataset](https://huggingface.co/datasets/sarvamai/indic-ocr-bench) has 6,909 test blocks, including 300 English blocks, and a 1,173-block representative split. The release does not establish the headline denominator, whether it includes English, or the treatment of invalid/looping outputs. Those uncertainties remain explicit; the published overall is not recomputed. Recognition-only evidence adds no whole-document family vote.

## Chandra 2.5 (accurate)

The three existing published values remain unchanged:

| Exact panel | Score | Verified scope |
| --- | ---: | --- |
| [Overall](https://www.datalab.to/benchmarks/overall) | 93.5 | 16,288 tests, 2,937 pages, 2,343 documents, 92 languages |
| [Table-tag slice](https://www.datalab.to/benchmarks/tables) | 95.2 | 6,767 tests, 875 documents |
| [Multi-column-tag slice](https://www.datalab.to/benchmarks/multi-column) | 94.2 | 3,517 tests, 635 documents |

The [methodology article](https://www.datalab.to/blog/omni-parse-bench) establishes the document count and family-mean scoring rule. The table-tag result is not the same as the overall table-family component. The article's older October 8 family values are not assigned to the October 20 service snapshot. Gemini and Claude's participation in test creation remains disclosed in the source notes.

The current [Datalab Convert page](https://www.datalab.to/platform/processors/convert) identifies **Chandra 2.5** and reports the matching **93.5** overall and **95.2** table-tag scores for accurate mode. The display name is therefore **Chandra 2.5 (accurate)**. Its October 20 run date remains in observation metadata and popovers; the exact backend revision and run configuration remain unpinned. The earlier `chandra-2-5-api` release-evaluation row stays separate, with its original **92.7** OmniParse result and mode-unspecified olmOCR results. Verifying the shared product generation does not make these runs interchangeable. The service-revision release date remains unknown.

## Compact cells and accessible details

The old renderer selected one result per family column, so a primary result hid its additional protocols and the Other column hid all but one protocol. Numeric breakdowns were absent from the visible cells.

The default matrix renders every selected protocol's headline score once in its existing family column. MDP public and private results and all three Chandra panels each retain a visible score. The Other column includes every applicable protocol. Numeric cells contain values, qualification symbols and compact info controls; repeated protocol names, status words and Details labels are omitted. Headers identify the benchmark and units once. Each score's info control names its exact protocol for assistive technology and opens a popover with the full protocol name, component table, evidence/operator details, source links and scope notes. Native top-layer rendering prevents table overflow from clipping the panels. Explicitly incomparable results carry a qualified-result marker explained in the popover. The inline model info control retains full source notes, deployment caveats and alternate observations with their component breakdowns.

Model names wrap without ellipsis or line clamps; each benchmark result occupies a compact numeric line. Popovers have readable component tables, a close button, and keyboard/outside-click dismissal. Percent-scale values display up to two decimal places and ratios up to four, while stored source precision is preserved. Unknown speed and cost values display as an em dash, with their status retained in model details. Source links prefer pinned observation URLs when available. Snapshot dates are metadata rather than title suffixes, including the source date formerly displayed in the ChatGPT 5.2 name; formal checkpoint version identifiers are preserved. Header sorting still uses the named primary protocol; additional protocol displays do not alter sort values or ranking.

Validation covers source references, data schemas, all recorded default-view protocol headline scores, accessible per-result popovers, component scales, null versus zero, HTML escaping, pinned source links and ranking invariance. The repository's validation, test and build gates are run before publication. Browser checks verify compact rows and that expanded popovers remain readable beyond their table cells. No model inference or independent benchmark reproduction is claimed.
