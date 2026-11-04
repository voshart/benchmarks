# Voshart Benchmarks

Static, data-driven [OCR](https://bench.voshart.com/ocr/), [speech-to-text](https://bench.voshart.com/stt/) and [SVG tracer](https://bench.voshart.com/svg/) evidence indexes. Eleventy renders the initial pages; dependency-free browser JavaScript provides sorting, filtering and release replay. The site indexes published research and tariffs, plus attributed maintainer-run tracer measurements. It is not a shared model execution harness.

## Start here

- Contributors and LLM maintainers: read [AGENTS.md](AGENTS.md).
- Update workflow and file map: [Maintenance](docs/maintenance.md).
- Current schemas, eligibility and ranking: [OCR](data/ocr/README.md), [speech](data/stt/README.md) and [SVG tracers](data/svg/README.md).
- Historical update narratives: [archived maintenance notes](docs/archive/maintenance-before-2026-10-24.md). Other source audits remain in `docs/` and `data/`.

## Local use

Requires a patched Node release (see `.nvmrc`); CI uses the same pin. Install the locked dependencies once:

```bash
npm ci
npm start
```

`npm start` serves a local preview and watches source, `data/` and `lib/`. Before shipping:

```bash
npm run format
npm run build
```

`build` checks formatting, validates all topics, runs all tests and generates `_site/`. The individual `format:check`, `validate` and `test` commands remain available when diagnosing a failure. `npm run summary` prints current dataset counts; do not copy changing totals into documentation or tests.

## Structure

| Path                                  | Purpose                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `data/models/registry.json`           | Shared exact model/configuration identities                                                |
| `data/ocr/`, `data/stt/`, `data/svg/` | Topic configuration, benchmark definitions, observations, provenance and research evidence |
| `lib/`                                | File loading, validation, currency and published tariff normalization                      |
| `src/assets/js/`                      | Pure comparison/ranking modules shared by the build and browser, plus browser controllers  |
| `src/ocr/`, `src/stt/`, `src/svg/`    | Page templates and downloadable data endpoints                                             |
| `src/assets/css/`                     | Shared presentation                                                                        |
| `tests/`                              | Behavioral tests and checks against pinned source evidence                                 |
| `scripts/`                            | Validation and current dataset inventory                                                   |

SVG uses a self-contained `data/svg/results.json` schema and aggregate evidence under `data/svg/evidence/`; it does not contribute to OCR or speech rankings. A normal score addition edits data only. Benchmark definitions live in `data/<topic>/tests/`; executable tests live in the root `tests/`. See the maintenance guide before introducing a new protocol or changing eligibility.

## Deployment

Cloudflare Pages uses Git integration with production branch `main`, framework preset `None`, build command `npm run build`, output directory `_site` and a blank root directory. The canonical hostname is `bench.voshart.com`; routes are `/ocr/`, `/stt/` and `/svg/`. Pull requests can use preview deployments.

Publishing follows the standing authorization in [AGENTS.md](AGENTS.md). A push to `main` triggers production deployment. Verify the newest commit and the live pages; retrying an older deployment rebuilds that older source. Keep generated `_site/` and `node_modules/` out of Git.
