# Exact Datalab benchmark-page coverage — 2026-10-23

Audited the owner's linked [benchmark page](https://www.datalab.to/benchmarks), its interactive Tables / Multi-column / olmOCR controls, every linked scoreboard, and the attached overall screenshot. The dedicated Overall board duplicates the landing board; it is not counted twice.

**33 displayed observations:** Overall10, Tables10, Multi-column10, olmOCR3. Before this fix, four values were captured in matching cohorts (balanced overall91.6 and the three olmOCR scores). **29 displayed observations were missing.** This change adds30 source observations: a complete ten-system panel for each of Overall, Tables and Multi-column, including balanced91.6 for a coherent source cohort. That repeated balanced number is not claimed as a new independent run. The existing three olmOCR observations are not duplicated.

The row-by-row source labels, exact scores, repository model/test IDs and disposition are in `data/ocr/datalab-scoreboard-audit-20261023.json`; regressions verify every row.

## Identity and protocol rules

- Accurate93.5 / table-tag95.2 / multi-column94.2 are explicitly the current **October20** service. This is a dated Datalab mode snapshot, not silently renamed Chandra2.5. Its underlying model identity is not established. Older accurate92.7 and repository92.9 observations remain separate and unchanged.
- Other rows are the October8 published runs. Snapshot dates do not establish model release dates, so new registry release dates remain unknown.
- Generic Reducto, LlamaParse, Mistral, Extend and Azure rows are source-run service identities rather than guessed canonical model generations. The initial public [adapter commit](https://github.com/datalab-to/omni_parse_bench/tree/dee9f966044cab7bbba931e2668ba8f29b89af5d) documents defaults (r-1; agentic_plus/latest; mistral-ocr-4-1; parse_performance; Content Understanding prebuilt-layout), but is not an immutable receipt of October8 run overrides. No canonical-generation accuracy, price or latency is inherited.
- Azure's published adapter is **Content Understanding**, not Document Intelligence. Exact named GPT-5.6 Sol and Claude Sonnet5.5 use their existing identities; Gemini3.8 Flash is newly recorded as the exact named model in this vendor comparison.
- All new panels remain secondary and in the same OmniParse family. No rank policy changes, cross-protocol aggregate, or extra votes from correlated tag slices. Gemini and Claude participated in creating/verifying some tests; this conflict is disclosed in every source panel.
- The tag scores are means of text/table/layout family pass rates on selected tests. The table-tag score is not the same metric as the overall report's tables-family column.
- The source's footer says October8 while its accurate rows say October20. Both are retained explicitly; the later repo revision is not substituted for the website.
- Current Datalab Convert prices were checked directly: accurate$10 and balanced$4 per1,000pages. These are current US base service tariffs, not the historical benchmark invoice; add-ons, EU uplift and discounts are excluded. Hosted GPU speed is not invented.

## Already present olmOCR panel

[olmOCR scoreboard](https://www.datalab.to/benchmarks/olmocr-bench): Chandra2.5 86.9, open ChandraOCR2 85.8, LightOnOCR-3-4B Datalab reproduction85.4. These are the existing `chandra-2-5-olm-no-hf` own-postprocessing observations, not full-set olmOCR; headers/footers excluded. No overwrite or additional family vote.
