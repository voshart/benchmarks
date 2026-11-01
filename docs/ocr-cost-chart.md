# OCR cost chart and supplemental deployment evidence

The chart below the OCR matrix is a presentation of the existing table, not another ranking.
`OCRComparison.enrich` supplies identical deployment costs to the static build and browser.
`ocr-cost-chart.js` consumes only the already-filtered rows; it never recomputes quality ratings.

## Interpretation

The horizontal axis is USD per 1,000 pages on a logarithmic scale. The vertical axis is the
existing estimated OCR rating on a fixed 0–100 scale, not accuracy. Organization colors are stable
across filters. Missing ratings, non-finite/non-positive costs and contextual current-service
prices are omitted and counted. A hosted configuration never inherits another checkpoint's rating
or an unsupported hypothetical local price.

The dotted Pareto frontier minimizes central cost and maximizes rating. Exact coordinate ties
share the frontier; a cheaper point with the same rating dominates the more expensive point.
Planning ranges use the same geometric midpoints as the table. The frontier does not account for
statistical uncertainty and is not evidence of robust dominance when ranges overlap. The shaded
upper-left region uses the plotted cohort's median cost and median rating, not fixed quality
thresholds. Chart-only cost-basis, label and range controls do not change table filters or ratings.

The chart updates with release cutoff, search, access, coverage, specialized views and cost
assumptions. Pricing view hides it with the matrix. Historical cohorts still use the dated cost
evidence already selected by the table; they do not reconstruct historical tariffs.

SVG points support native hover descriptions, keyboard focus and click/tap inspection. A complete
HTML data table exposes costs, basis and source qualifications. The build renders a static chart
without JavaScript; interactive updates share the same renderer. Narrow screens scroll the chart
within its panel, not the page. Light/dark themes use the existing design tokens.

## Supplemental throughput records

`data/ocr/throughput-supplement.jsonl` is an append-only companion to `throughput.jsonl`. The loader
combines both into the existing `throughput` array, subject to the same ID/source validation,
selection rules and Details rendering. It does not bypass validation or create quality votes.
Existing observations stay intact; add distinct IDs and preserve each measurement cohort.

The November 1 OCRia additions use the already registered primary sources. The technical report's
Table 21 gives 2.17 and 7.83 pages/s on one B200 at concurrency 1 and 8, separately from Table 20's
2.16 and 7.42. OpenDocRouter reports 9.3 seconds/page p90 and 2.2 seconds/page median for its versioned
recipe. All three new records are author-reported, non-default and ineligible for compute costing.
No B200-to-H100 conversion or new accuracy observation is introduced. Additional architecture and
training-corpus context is retained in `research-ocria-20261101.json`, not counted as benchmark data.

Sources: the OCRia technical report, Appendix E.1/Table 21 and Sections 1–3, and OpenDocRouter's
Models/Speed table. Exact URLs, verification dates, operator and caveats are recorded with the data.
The unverified hosted ParseBench category numbers are deliberately not imported.

## Checks

Run `npm run format` and `npm run build`. Chart tests cover missing/zero values, dominance and ties,
filters, ranges, single-point logarithmic axes, escaping, static output and unchanged inputs.
Source-scoped OCRia tests retain both B200 cohorts and keep hosted latency separate from throughput.
