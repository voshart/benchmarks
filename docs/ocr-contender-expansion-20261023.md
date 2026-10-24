# OCR contender and coverage expansion

Source check: 2026-10-23. The existing October 22 comparison cutoff, ranking policy, protocol priorities, column order, and default **2+ primary benchmark families** filter are preserved. Source verification is not independent benchmark reproduction.

## Scope and result

This pass searched for omitted contenders and missing results on existing models, then checked exact generations, benchmark versions, operators, and pipeline configurations. It includes weaker results as well as favorable ones. All published numeric precision is retained in the data; the matrix remains compact and the existing popovers contain components and qualifications.

The OCR registry grows from **205 to 209 identities**, observations from **551 to 613**, and the default view from **64 to 75 models**. Twelve identities become visible under the existing filter, while the mixed generic Nanonets entry is replaced by its evidenced identities. Three additional ParseBench-only candidates remain available through search and All registered models.

The main addition is **OXR-1.0**. Its author reports full olmOCR results, a 1,651-page OmniDoc comparison, and DocParsingBench. OXR's rank is provisional: SoMark reports its own model and also maintains DocParsingBench, exact evaluation revisions are incomplete, and its first weights release date remains unverified.

| OXR observation | Published headline | Scope and qualification |
|---|---:|---|
| olmOCR | 87.84 | olmocr 0.4.27; 1,403 pages, 8,413 rules, all eight categories including headers/footers |
| OmniDoc | 97.18 | 1,651 pages; comparison explicitly references v1.6_full; exact OXR scorer/data hashes unpublished |
| DocParsing | 0.8775929604964118 | Maintainer-native ratio; author's three rounds score 1,342 pages after 58 exclusions; peer exclusion sets unverified |

The [pinned author document](https://github.com/SoMarkAI/OXR/blob/62fbca8ef6c7c63b75b799fc8081f3eb6e667553/docs/benchmark.md) separates the full accuracy tests from a frozen 100-page speed workload. OXR's **0.990373 pages/s** on one RTX PRO 6000 is retained as hardware-specific context, with two repetitions of the same 100 pages. It is not converted to H100 speed or an inferred deployment price. Its [public model](https://huggingface.co/SoMarkAI/OXR-1.0) uses a custom OXR Open Source License, not plain Apache-2.0; the free testing API is not treated as a production tariff.

## Added evidence

| Protocol | New observations | What was filled |
|---|---:|---|
| OmniDoc v1.6 full | 14 | OXR, WeVisDoc 2B/4B, six explicit WeVisDoc competitor reruns, Infinity-Parser2 Flash/Pro, MonkeyOCRv2 S/B, exact MinerU-2605 |
| DocParsing | 17 | Current maintainer table; historical observations retained |
| ParseBench published panel | 25 | Existing-model gaps and three clearly identified single-family contenders |
| olmOCR | 3 | OXR plus Infinity-Parser2 Flash/Pro author results and reported uncertainty |
| PureDoc | 2 | WeVisDoc own-author alternatives with complete three-track components |
| OmniDoc v1.5 / IDP | 1 | Exact hosted Nanonets OCR2+ observation |
| **Total** | **62** | Separate source observations, not 62 new models or families |

### WeVisDoc and competitors

[WeVisDoc v1, Tables 2–3](https://arxiv.org/html/2609.20423v1) reports 1,651-page OmniDoc v1.6 and 1,475 source pages across three PureDoc tracks. Its own results average three inference runs. The starred competitor rows are explicit WeVisDoc-team reruns; unstarred quoted baselines are not imported again.

The missing OmniDoc overall scores are WeVisDoc-2B **95.06**, WeVisDoc-4B **95.38**, FD-RL **91.21**, dots.mocr **92.57**, Nanonets-OCR2-3B **83.20**, OCRFlux-3B **83.31**, olmOCR-2-7B **85.51**, and DeepSeek-OCR **86.31**. Each row retains all five published component metrics. The ambiguous UniRec row is not assigned to the distinct OpenDoc pipeline.

WeVisDoc's author PureDoc Avg3 values (**73.86 / 75.54**) remain separate from the maintainer's **73.69 / 75.57**. The existing preference for the maintainer source is retained; disagreements are not averaged. The published overall is not reconstructed from rounded components.

The upstream ParseBench results are also included: WeVisDoc-2B **38.93**, WeVisDoc-4B **36.15**, and their low chart and zero visual-grounding results. Strong OmniDoc/PureDoc performance is not used to fill those weaknesses. This naturally lowers their aggregate indices compared with a one-family view.

### Infinity, MonkeyOCR, and exact MinerU generation

[Infinity-Parser2 v1, Table 2](https://arxiv.org/html/2607.07836v1) supplies OmniDoc v1.6 **91.98 / 93.95** and olmOCR **86.0 ± 0.8 / 87.6 ± 0.8** for Flash/Pro. The paper names standard olmOCR and gives no reduced subset; exact scored-page counts are unpublished. Its v1.5/v1.0 component tables and separately sourced ParseBench values are not pooled into these observations. The [pinned official release documentation](https://github.com/infly-ai/INF-MLLM/blob/011866e93026290ba39f05b796c92d58dd0ce40c/README.md) establishes May 11 availability for both models.

[MonkeyOCRv2 Table 7 and Section 4.6](https://arxiv.org/html/2607.11562v1) supply S-Parsing **90.90** and B-Parsing **91.57**. These are whole-document pipelines with predicted layout and reading order; no ground-truth crops are substituted. The [July 14 release commit](https://github.com/Yuliang-Liu/MonkeyOCRv2/blob/e05067cd37ac6fba472784f348a113d217da4443/README.md) contains both exact model links. The July 13 paper date is not used as a weights release date.

The [MinerU2.5-Pro-2605 card](https://huggingface.co/opendatalab/MinerU2.5-Pro-2605-1.2B) explicitly gives **95.72** on v1.6_full and a May 21 release announcement. This belongs to the exact 2605 identity. Generic Pro **95.75** and 2604 **95.69** are not transferred to it; the registry's download hash does not prove the benchmark ran that same checkpoint.

### DocParsing snapshot and historical conflicts

The [current embedded leaderboard](https://github.com/SoMarkAI/DocParsingBench/blob/90bf1fbccc6d9967a9f9981bd5589eb5a8d9d6cd/assets/leaderboard.html) was generated October 5 and contains 17 systems. All four metrics are transcribed at native precision. The [historical nine-row publication](https://github.com/SoMarkAI/DocParsingBench/blob/63d80f96a89e2f2514daac703238d6f12a2873e9/README.md) remains separately pinned.

Scorer/configuration blobs match across the two revisions. New preparation adapters do not prove each executed run's configuration. Original operators, weight hashes, exact page manifests, and per-run preparation manifests remain incomplete. OXR is explicitly author-reported; other current rows retain the existing community execution qualification, while the source identifies the benchmark-maintainer publication.

Chandra and GLM now have both old and new observations. The unchanged source-selection priority and stable order retain **0.7906 / 0.7348** as the selected historical values; new **0.8220 / 0.8034** observations remain available as alternatives. No recency or best-score preference was introduced.

The evaluator defaults to skipping chemical-structure pages using ground-truth content. That supports a model-independent exclusion mechanism, but does not prove every published run used OXR's exact 58 excluded IDs. The CLI can also omit missing prediction files. This uncertainty is visible in OXR's result details.

### ParseBench completeness and single-family contenders

All additions use the existing [9af4102 published CSV](https://github.com/run-llama/ParseBench/blob/9af4102e26b51f234ab5f037e19fec05c0696ec6/leaderboard.csv), with exact source model labels, HF identifiers, all five category scores, and measured zeros. The original row execution operator and scorer/checkpoint revisions remain unverified. This is not quality measured in the NVIDIA timing experiment; visual grounding is not renamed as reproduced EPR.

The TeleOCR and dots.mocr HF namespace changes are supported by official redirects. Hunyuan's official card explicitly identifies its root model as 1.5 and archives 1.0 under `v1.0/`; that agrees with the pinned CSV's 1.5 label.

The three strongest newly registered ParseBench-only candidates are [Rakedoc nano](https://huggingface.co/cloudraker/rakedoc-nano) **77.23**, [Aeddix Alpine OCR v0.1 with the KDL pipeline](https://huggingface.co/aeddix-labs/aeddix-alpine-ocr) **76.77**, and [Florin parser nano v2](https://huggingface.co/florin-inc/florin-parser-nano) **76.69**. Their exact configuration notes and limitations stay in the popovers. No second benchmark family was verified, so they are accessible through search or All registered models and do not appear under the default two-primary-family filter. Florin's later v3 **77.50** is not substituted for the pinned older run; Aeddix's own page-server **75.15** is not mixed with its KDL-pipeline result.

## Identity repairs

Five original observations move to supported identities; no original metric value is discarded or copied to two rows.

| Original observation | Correct identity | Evidence |
|---|---|---|
| Nanonets-OCR2 / PureDoc 58.36 | Open Nanonets-OCR2-3B | [Pinned README row](https://github.com/zhihengli-casia/PureDocBench/blob/fdae62435871eb7ba058a804574ad1a9d2fd6cf1/README.md#L78) links the 3B card; matching inference configuration names 3B |
| Nanonets-OCR2 / olmOCR 82.0 | Hosted Nanonets OCR2+ | [Exact IDP model page](https://benchmarking.nanonets.com/models/nanonets-ocr2-plus) |
| Nanonets-OCR2 / IDP 73.8 | Hosted Nanonets OCR2+ | Same exact model page; official family announcement separates Plus from 3B |
| Gemini 3 Pro / official OmniDoc 92.91 | Gemini 3 Pro preview | [Same-revision named runner](https://github.com/opendatalab/OmniDocBench/blob/f133a71e9e91c3621c7ce8994200a7b394a06eb3/tools/model_infer/gemini3_pro_img2md.py) actively requests `gemini-3-pro-preview` |
| PaddleOCR-1.5 / historical DocParsing 0.8535 | PaddleOCR-VL-1.5 | [Historical runner](https://github.com/SoMarkAI/DocParsingBench/blob/63d80f96a89e2f2514daac703238d6f12a2873e9/scripts/paddle.py) explicitly identifies VL 1.5 |

The generic Nanonets-OCR2 registry entry is retired after all three live observations are resolved. Historical archives remain intact. The other generic Gemini results are not moved: their own sources must establish an endpoint identity. Gemini's mapping remains explicitly provisional because a named runner is not an immutable execution manifest.

Nanonets OCR2+'s v1.5 headline **89.5** and components are retained as printed. The standard three-component calculation would be approximately **87.93**; that source inconsistency is disclosed, not silently repaired.

The old dots.ocr-1.5 DocParsing identity is not merged despite an official product rebrand: the historical runner is unversioned and has no manifest tying that run to the later weights. Current explicit dots.mocr rows are added independently.

## Boundaries and verification

No ranking formula, family priority, eligibility flag, coverage rule, benchmark ordering, CSS, JavaScript, or HTML is changed. Prices remain in USD. Missing benchmark values remain missing. New score and model explanations use the existing popovers.

Maintainer audits found all 35 current official OmniDoc v1.6_full headline rows, all 58 main PureDoc rows, and the current MDP/Wild/olmOCR headline tables already represented before this expansion. The additions therefore come from verified omitted sources or resolved model identities rather than duplicating those tables. NaviDC's PureDoc entry is already represented by TeleOCR's documented rename.

Sarvam's unverified OmniDoc subset is not promoted to full v1.6. PolyOCR's different model sizes/pipelines are not pooled. Ki-OCR's Real5 label is not linked to an unrelated recovered-composite pipeline without an identity bridge. Qwen3.8 thinking/non-thinking rows remain deferred pending distinct configuration handling. Older MonkeyOCR v1.5 and LightOnOCR v1.0/no-header details are documented research leads, not transferred into the current full protocols.

The preservation check compares every original observation against the Git baseline, allowing only the five documented identity moves: **all 551 observations and all 2,821 original metric values survive unchanged**. Existing regression snapshots are updated only for added coverage, changed percentile cohorts, and newly verified release dates. Local validation, all 22 test files, the Eleventy build, and `git diff --check` pass. Preview and production checks are recorded in the pull request.
