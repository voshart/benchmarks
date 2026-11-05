# SVG tracer evidence

`results.json` supplies `/svg/` and `/svg/data.json`. `evidence/` contains aggregate measurements, provenance and a renderer diagnostic. These records combine local runs from 4 November 2026 and published source checks through 5 November 2026, not a live execution harness or independent certification.

## Protocols

- `fonts-full-20261104`: all 4,821 SVG-Fonts test inputs, 256 px white-background resvg input, original framing. Matched 1024 px output/reference geometry renders, errors converted to native pixels. DINOv2-base FP32 scores matched 256 px resvg images; all last-layer tokens are averaged, cosine mapped to `(cosine + 1) / 2`.
- `fonts-pilot-20261104`: 256 cases selected by the lowest SHA256 values of `monotrace-external-first-pass-v1:` plus source filename. This subset is contained within the full run. VTracer was run only on this font subset.
- `polyfit-binary-20261104`: all 116 original monochrome raster inputs, native sizes and matched resvg output rendering. No original vector masters; the PolyFit algorithm itself was not executed.
- `svg-fonts-published-2025`: the pinned StarVector authors' SVG-Bench table. Author-reported StarVector results and competitor-reported baselines. Exact evaluated count and original baseline invocations remain unverified. This group does not rank locally executed Monotrace against the published systems.
- `mmsvg-icon-omnisvg2025` and `mmsvg-illustration-omnisvg2025`: OmniSVG (NeurIPS 2025), Table 2 image-to-SVG columns. Each paper-defined subset has 150 synthetic GPT-4o raster inputs. DINOv2 cosine, SSIM, LPIPS, MSE and rounded average Qwen2.5-VL token lengths are retained. The Hub card corroborates the table; the exact paper-era evaluation files and renderer settings were not reproduced. The paper's 4B/8B configurations do not inherit later OmniSVG releases.
- `layertracer-vectorization-2025`: LayerTracer (ICCV 2025), Table 2 and Section 4.1's 50-image selection. Retains MSE, average path counts, layer-wise metadata and reported time in Details. Exact case list, source proportions, scoring normalization and inference timing environment are unverified. The text generation comparison and separate nine-frame ablation are excluded.

`evidence/published-tables-2025.json` records the transcribed source cells, table locations, attribution and primary URLs for these imports. Publisher self-reports and competitor reports are explicit per row. No model was executed for this import; source verification is not independent reproduction. Mean paths, median geometric segments and tokenizer lengths have separate metric keys. Published DINOv2 cosine is also separate from the local font scorer's rescaled DINO metric. Do not average or rank across these protocols; only the explicitly defined same-source SVG-Bench panel has a derived mean. Source-specific published time costs are preserved as attributed context, not a cross-study speed ranking.

## Ranking and presentation

The default is `svg-bench`: a fixed panel of the five datasets in the pinned StarVector Models table. Mean DINO is calculated at render time as the equal arithmetic mean of Stack, Fonts, Icons, Emoji and Diagrams. Every component must be present from the same source. An incomplete method retains its available scores in a separate expandable table, with no mean or numeric rank. This is a descriptive method-level summary of the paper's dataset-specific configurations, not one universal checkpoint or an author-published aggregate.

The current speech landing page is the implementation reference: fixed complete panel, ordinary competition ranks (1, 1, 3 for ties), and positions computed on the full cohort before search or display sorting. SVG reuses those rules. OCR's regularized Bradley–Terry rating connects exact comparable identities across sources and controls repeated family/configuration votes. SVG does not currently have verified cross-study engine equivalences or enough connected matched local evidence to justify copying that rating. No cross-paper identity is silently merged, and the overlapping font pilot cannot create another overall vote.

Each individual protocol ranks its declared quality metric. Complexity, runtime and failure diagnostics never supply a quality rank or panel mean. Sorting by segments, paths or tokens changes display order while preserving the quality positions. Input dataset token statistics are not output complexity, and a token, path and line/curve segment remain distinct units. Missing values sort last in both directions; measured zero is preserved. Full source precision determines rank; rounding is display-only.

The interface keeps rank, tracer and numeric cells visible. Configuration, evidence/operator, alternate metrics and caveats stay behind the row's keyboard-accessible information control or the benchmark disclosure. Shared pure rendering/calculation is used by Eleventy and the browser; the static fallback includes every protocol and incomplete result.

`evidence/starvector-models-2025.csv` preserves all cells in the pinned Models table, including unavailable diagram scores for Im2Vec and GPT-4-V. `starvector-provenance.json` records the revision and import policies. The original font observation is unchanged; four further dataset protocols complete the panel. Published input token statistics stay as dataset metadata. No output complexity is invented for these rows.

## Differences from our runs

The page's short comparison disclosure derives source values from the observations: Potrace font DINO 0.9884188461788361 on our 4,821 images versus 0.967 reported by StarVector; VTracer 0.9864294109866023 on our 256-image pilot versus 0.964. It preserves both sources and the pilot/full distinction. Renderer, scoring size, input treatment and baseline versions differ or remain unverified; a 64-image diagnostic did not resolve the gap. These are reproduction differences, not measurements under the same verified protocol. Local scores do not enter the published panel. Monotrace has no complete five-dataset score and is ranked only within its matched local runs.

## Local configurations and attribution

Daniel Voshart develops Monotrace. Local observations were executed for this project by its maintainer and are not independent evaluations. Monotrace uses a fixed native quality profile, source revision `456eebfee1bec816e67ea9d775177af872d09859`, source ID `448c2ac7f2654543`. Potrace is the original C 1.16 CLI at defaults, with 50% threshold PBM input and no dithering or SVG Tools harness. VTracer uses Python 0.6.15, binary mode, other defaults; its internal SVG header says 0.6.12.

The font test parquet is pinned by repository revision and SHA256 in `evidence/provenance.json`; renderer and DINO weight hash are recorded there. Private kernel code, tuning profile, font artwork and per-image output archives are not included. The downloads are aggregate evidence, not the complete per-case archive. There are no measured API throughput, SLA or price claims.

## Failure and metric policy

Font-run geometry means include every image. Empty output against visible reference receives a 256 px boundary penalty; blank against blank is zero. All four completely white references remain in the full test. Monotrace has two explicit trace errors plus two completed empty outputs against visible reference; Potrace has one completed empty output against visible reference. The separately labeled conditional mean uses the same 4,813 paired successful nonempty cases and excludes those failures and empty images. It must not replace the all-case mean.

Monotrace leads on full-run DINO and median boundary error. Potrace leads on the all-case mean after empty-output penalties, and on the PolyFit raster IoU/boundary comparison. Sampled topology mismatches are not exact vector-topology certification. Segment counts describe complexity and do not prove reconstruction quality. DINO is not a percentage accuracy or a guarantee of good curves.

## Adding evidence

Keep exact configuration identities in `models`, metric definitions in `metrics`, and operator/attribution/primary URLs in `sources`. Each `runs` entry names a dataset source, result source, sample count (or `null`), primary quality metric, visible columns and one row per model/configuration. `overview` defines a fixed same-source panel by component run, metric and display column; it contains no stored mean observations. Metric roles distinguish quality, complexity, diagnostics and time. `differences` references both observations rather than copying display numbers. Row `values` are finite nonnegative numbers or `null`; unknown metrics are rejected. Conditional cohort size and exclusions must be explicit.

Reuse a group only when dataset, preprocessing, scorer, resolution and execution conditions match. Different versions or paper protocols get new groups. Do not fill unavailable scores with zero, import source code from private repositories, or declare a direct win across different groups. Open a primary source before changing any observation. Run `npm run format` and `npm run build`, then verify `/svg/`, its filters/details and data downloads on the deployed commit.
