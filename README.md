# Voshart Benchmarks

Small data-driven benchmark pages. Eleventy generates static HTML; a dependency-free JavaScript module progressively enhances sorting, filters, and release-date replay. Designed to publish at `bench.voshart.com/ocr/` via Cloudflare Pages.

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

The historical slider uses *model release dates* to choose eligible generations, ignoring the publication date of test results. Undated releases are excluded from historical cutoffs but available in the current view. Core Rank is the mean of within-benchmark percentile ranks, with midranks for ties, once a family contains six scored models across three organizations. Four primary benchmark families are required by default **only for display**; three mature core families permit an index. Limited, correlated, private vendor-only and small-sample tests are available but excluded from aggregate Rank.

## Evidence rules

The dashboard is an index of third-party and author-reported research, not a single reproducible test harness. Do not silently merge OmniDoc v1.5, v1.6 English subset and v1.6 full. Do not equate NDI's MDP component with official MDP *private*. Never infer PolyOCR's private score from its public score. A hosted product and open weights are different deployments; an optional policy floor must be marked as an assumption, not written into observations.

## Adding another benchmark

Create a `data/<topic>/config.json`, tests, sources, observations, and a page using the shared CSS/table UI. Extract shared sorting/ranking functions into `lib` or `src/assets/js` rather than copying monolithic HTML. Do not assume that OCR ranking methodology applies to other domains.

## Deploy

Keep `bench.voshart.com` as the canonical site, with `/ocr/` as the OCR route. Link `ocr.voshart.com` with a redirect if desired. A GitHub push triggers Cloudflare Pages. Run `npm run build` and review the deployment preview before merging a PR.

### Cloudflare Pages setup

Connect this repository through Cloudflare Pages Git integration. Use `main` as the production branch, `None` as the framework preset, `npm run build` as the build command, and `_site` (singular) as the output directory. Leave the root directory blank: `package.json` lives at the repository root. Enable automatic production deployments and preview deployments for update branches. Add `bench.voshart.com` under the project's custom domains after the first successful deployment.

Commit source files and `package-lock.json`; Cloudflare builds the site from GitHub. Uploading a ZIP to a local workspace does not put its files into the repository. Generated `_site/` files and `node_modules/` must stay out of Git.

### Routine LLM updates

Ask the contributor to follow `AGENTS.md`, verify primary sources, update the data files, run validation/tests/build, and open a pull request with exact source links and caveats. Review the Cloudflare preview and merge the pull request into `main` to trigger production deployment. GitHub Actions validates the change; Cloudflare Pages performs the deployment separately.

Example request:

> Update the OCR benchmark with verified results for [model/version or source URLs]. Follow AGENTS.md, preserve source provenance and missing values, and list any unverified claims. Run npm run validate, npm test, and npm run build, then open a PR with source links and the expected leaderboard effect.

## Verified expansion — October 13, 2026

The initial scaffold is deployed through Cloudflare Pages at https://benchmarks-15s.pages.dev/ocr/. The custom domain remains a separate configuration step; deployment from `main` is confirmed. This update contains 164 model records, 336 scored observations, 16 test variants, 54 page-price observations (including 23 preserved/unverified imports), 19 official token-rate observations, and 49 source records.

- `New research` exposes Xiaomi-OCR-0, PolyOCR-2.7B and the distinct PolyOCR-9B direct/pipeline configurations. It labels insufficient aggregate evidence as **Unranked**. The default four-family filter and aggregate eligibility rules are unchanged.
- Xiaomi's public model card establishes the weights release as September 30, 2026. Its OmniDoc/Wild component scores now retain text, formulas, tables and reading order. PolyOCR weights remain unreleased; the report date is not a weights release date.
- PolyOCR-9B's direct and layout-guided OmniDoc v1.6 results are distinct observations/model configurations. They are not assigned to the specialized 2.7B MDP model or treated as independent evaluations. The redundant public-only PolyOCR record was removed from the private-results file; no private score was created.
- Thirteen IDP model pages supply additional IDP Core v1.0 task breakdowns and a separate OmniDoc v1.5 operator comparison. The v1.5 variant stays secondary, outside aggregate rank and primary coverage. Five additional OpenOCR observations retain reported uncertainty and remain secondary.

Pricing retains mode, provider, source, verification date and basis. Official page tariffs, credit-derived vendor rates, benchmark workload estimates and USD-per-million-token rates have separate meanings. Pricing links lead to the original rate card or operator model page. **Service** prices describe current hosted products without promising a pinned historical model generation. **Self-hosted** means a deployment-specific compute cost, not zero. Imported prices remain in a collapsible table and carry a qualification marker when selected for the matrix.

`data/ocr/pricing-tokens.jsonl` stores official API input, cached-input and output tariffs separately. No page cost is inferred from those token rates. Gemini 3.1 Pro Preview has separate prompt-length bands; its prices are not attached to Gemini 3 Pro. Discounts, annotations and service modes are separate page-price observations. The handoff's $0.40 Mistral batch claim was not verified: the official pricing table places that value under cached input, while Batch Processing documentation specifies 50% off. The verified batch observation is therefore $2/1,000 pages from the $4 standard rate; the old claim is retained with an unverified flag. `comparison_default: false` keeps an alternative rate from silently replacing the matrix's selected configuration.

Validation now checks raw observations before display filtering, model/source references, metric ranges, dates, duplicate pricing configurations and pricing units. The preview watches `data/` and `lib/`; the history slider takes its range from page configuration rather than fixed JavaScript dates.

### Remaining evidence gaps

The inherited registry and benchmark records have not undergone a complete source audit. The old NDI URL now redirects to a product page, so its inherited score/cost observations remain unverified imports. Model release dates marked `legacy_import` remain candidates for verification. The inherited Chandra API display-floor policy can still contribute assumed values to aggregate rank; that policy was left intact so this evidence/pricing update does not silently alter existing ranks. All 16 current default model ranks were checked against the prior build and remain unchanged.

Reverify rate cards before making purchasing decisions. Numeric prices describe the identified configurations and source dates, excluding unlisted taxes, license charges, hardware, regional surcharges or add-ons.
