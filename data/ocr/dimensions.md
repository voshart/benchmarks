# OCR component views

The component views are additive. They do not change overall OCR ranking policy v4,
speech rankings, source measurements, pricing or speed estimates.

- `/ocr/tables/`: experimental table-performance rating and native component scores.
- `/ocr/layout/`: reading order, visual grounding and multi-column diagnostics; no aggregate.
- `/ocr/fields/`: benchmark-specific KIE and extraction components; no aggregate.

## Explicit mappings, not inferred dimensions

`dimensions.json` is the reviewed allowlist. Each panel names one exact benchmark,
ordered source-key aliases, native unit and direction. This is not a search for keys
that happen to contain “table” or “extract”. Whole-document totals never fill missing
components. No scores, missing values, confidence intervals or unreported evaluations
are inferred.

Projection starts from `rawRecords`, not the headline-only `resultsByKey`. A legitimate
component can therefore be displayed even when a source does not report an overall.
For each component, the usual evidence priority is applied only to observations that
actually contain it. Alternative observations remain available in the source popover.
Author/vendor attribution, source dates, configuration, execution caveats and genuine
zeros are preserved. Missing values remain missing and sort last in either direction.

Aliases are explicitly reviewed names for the same component and scale, not license
to convert units. If one observation supplies conflicting aliases, its first named
value stays visible as context but cannot supply a ranking comparison. Separately
identified component sources retain their own classification. An unclassified
component URL does not inherit an official headline's provenance.

## Experimental table rating

The table graph is separate from the overall OCR graph. It uses the existing
family-budgeted, regularized Bradley–Terry engine and its fixed prior, not averages of
incompatible native scores. A comparison is only between exact configurations with
observations for the same mapped component protocol. The source is selected by the
existing priority, not by the highest score. Context-only preferred displays cannot
suppress comparable alternative observations.

The initial rating allowlist contains the full OmniDoc v1.6 table TEDS, PureDoc
real-degradation table TEDS, DocParsing table component, the pinned published
ParseBench table component, full olmOCR table-category tests, IDP's table component,
MORE's table component and Wild-OmniDoc's table component. Labels retain the distinction
between similarity metrics and rule/category pass rates.

TEDS-S is a structure-only diagnostic, not another OmniDoc vote. PureDoc clean and
digital-degradation tracks remain separate diagnostic columns; only the explicitly
selected real-degradation track contributes to the initial table rating. No track is
selected by whichever produces the best result. OmniParse's table-tag overall is
excluded because it still combines text, table and layout checks. Table-only crops,
layout-assisted protocols and loosely specified subsets are not silently admitted.

Each model identity has a capped family comparison budget. Repeated panels and
configuration copies cannot multiply its influence. Only the largest connected group
can have a global table placement. In addition, a displayed rating requires at least
two distinct contributing comparison families for that exact model configuration.
Single-family models may connect comparisons but remain unranked; their observed
components remain visible. The two-family gate is an editorial minimum, not a
statistical confidence guarantee. All displayed ratings are experimental estimates,
not accuracy percentages or confidence percentages.

Release-cohort selection happens before scoring. Old checkpoints do not replace a
newer generation merely because the old one has more measurements. Undated models
appear only in the latest cohort. Search, access, coverage and sorting are applied
only after fitting, so they cannot change the reference graph or a retained rating.

## Layout and field extraction

Reading-order edit distance, visual grounding, and multi-column-category tests are
not interchangeable measurements. The layout view retains their individual units,
directions and exact protocol/source labels. It does not calculate a layout rating.

IDP KIE and NDI extraction remain separate vendor-operated protocols with different
tasks and cohorts. Neither is relabeled as universal field-level F1. There is no
cross-protocol field rating, and no claim that these components establish production
invoice/form extraction accuracy. More exact-model overlap and task/scorer verification
would be required before proposing a combined field dimension.

## Limitations and maintenance

Benchmark families may share data, evaluation conventions or copied baselines. Family
coverage is not proof of independence. Selective reporting, incomplete component
coverage, source execution differences, unknown pipeline versions and unreported
uncertainty remain limitations. Small score differences encode observed ordering,
not statistically established wins. Source verification is not independent reproduction.

Update mappings deliberately; never add a broad name-based metric matcher. New
component protocols should start diagnostic-only until task, unit, direction and
comparability are reviewed. Keep source records and observations unchanged in a
presentation/ranking refactor.

The pure engine and markup are shared by Eleventy and the browser. All three pages
render useful static snapshots; failed data loading retains those snapshots with
interactive filters disabled. Source popovers use the same keyboard-accessible native
mechanism as the overall leaderboard.

Run `npm run format`, `npm run build`, `node scripts/audit-ocr-ranking.cjs` and
`node scripts/audit-ocr-dimensions.cjs`. The component audit reports actual current
coverage, graph components and leave-one-family-out rating sensitivity. These are
consistency diagnostics, not held-out document evaluations or confidence intervals.
Tests cover projection, source selection, zero/missing values, source conflicts,
identity copies, duplicate family panels, disconnected groups, release history,
filter invariance, browser/static parity and preservation of the overall ranking.
