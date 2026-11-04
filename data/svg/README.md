# SVG tracer evidence

`results.json` supplies `/svg/` and `/svg/data.json`. `evidence/` contains aggregate measurements, provenance and a renderer diagnostic. These records are a snapshot from 4 November 2026, not a live execution harness or an independent certification.

## Protocols

- `fonts-full-20261104`: all 4,821 SVG-Fonts test inputs, 256 px white-background resvg input, original framing. Matched 1024 px output/reference geometry renders, errors converted to native pixels. DINOv2-base FP32 scores matched 256 px resvg images; all last-layer tokens are averaged, cosine mapped to `(cosine + 1) / 2`.
- `fonts-pilot-20261104`: 256 cases selected by the lowest SHA256 values of `monotrace-external-first-pass-v1:` plus source filename. This subset is contained within the full run. VTracer was run only on this font subset.
- `polyfit-binary-20261104`: all 116 original monochrome raster inputs, native sizes and matched resvg output rendering. No original vector masters; the PolyFit algorithm itself was not executed.
- `svg-fonts-published-2025`: the pinned StarVector authors' SVG-Bench table. Author-reported StarVector results and competitor-reported baselines. Exact evaluated count and original baseline invocations remain unverified. This group does not rank locally executed Monotrace against the published systems.
- `mmsvg-icon-omnisvg2025` and `mmsvg-illustration-omnisvg2025`: OmniSVG (NeurIPS 2025), Table 2 image-to-SVG columns. Each paper-defined subset has 150 synthetic GPT-4o raster inputs. DINOv2 cosine, SSIM, LPIPS, MSE and rounded average Qwen2.5-VL token lengths are retained. The Hub card corroborates the table; the exact paper-era evaluation files and renderer settings were not reproduced. The paper's 4B/8B configurations do not inherit later OmniSVG releases.
- `layertracer-vectorization-2025`: LayerTracer (ICCV 2025), Table 2 and Section 4.1's 50-image selection. Retains MSE, average path counts, layer-wise metadata and reported time in Details. Exact case list, source proportions, scoring normalization and inference timing environment are unverified. The text generation comparison and separate nine-frame ablation are excluded.

`evidence/published-tables-2025.json` records the transcribed source cells, table locations, attribution and primary URLs for these imports. Publisher self-reports and competitor reports are explicit per row. No model was executed for this import; source verification is not independent reproduction. Mean paths, median geometric segments and tokenizer lengths have separate metric keys. Published DINOv2 cosine is also separate from the local font scorer's rescaled DINO metric. Do not average or rank across these protocols. Source-specific published time costs are preserved as attributed context, not a cross-study speed ranking.

No overall rank combines these groups. Default ordering follows the group's declared primary metric; each numeric header sorts raw values with missing values last in both directions. Zero is a valid observation, never a missing-value marker.

## Local configurations and attribution

Daniel Voshart develops Monotrace. Local observations were executed for this project by its maintainer and are not independent evaluations. Monotrace uses a fixed native quality profile, source revision `456eebfee1bec816e67ea9d775177af872d09859`, source ID `448c2ac7f2654543`. Potrace is the original C 1.16 CLI at defaults, with 50% threshold PBM input and no dithering or SVG Tools harness. VTracer uses Python 0.6.15, binary mode, other defaults; its internal SVG header says 0.6.12.

The font test parquet is pinned by repository revision and SHA256 in `evidence/provenance.json`; renderer and DINO weight hash are recorded there. Private kernel code, tuning profile, font artwork and per-image output archives are not included. The downloads are aggregate evidence, not the complete per-case archive. There are no measured API throughput, SLA or price claims.

## Failure and metric policy

Font-run geometry means include every image. Empty output against visible reference receives a 256 px boundary penalty; blank against blank is zero. All four completely white references remain in the full test. Monotrace has two explicit trace errors plus two completed empty outputs against visible reference; Potrace has one completed empty output against visible reference. The separately labeled conditional mean uses the same 4,813 paired successful nonempty cases and excludes those failures and empty images. It must not replace the all-case mean.

Monotrace leads on full-run DINO and median boundary error. Potrace leads on the all-case mean after empty-output penalties, and on the PolyFit raster IoU/boundary comparison. Sampled topology mismatches are not exact vector-topology certification. Segment counts describe complexity and do not prove reconstruction quality. DINO is not a percentage accuracy or a guarantee of good curves.

## Adding evidence

Keep exact configuration identities in `models`, metric definitions in `metrics`, and operator/attribution/primary URLs in `sources`. Each `runs` entry names a dataset source, result source, sample count (or `null`), primary metric, visible columns and one row per model/configuration. Row `values` are finite nonnegative numbers or `null`; unknown metrics are rejected. Conditional cohort size and exclusions must be explicit.

Reuse a group only when dataset, preprocessing, scorer, resolution and execution conditions match. Different versions or paper protocols get new groups. Do not fill unavailable scores with zero, import source code from private repositories, or declare a direct win across different groups. Open a primary source before changing any observation. Run `npm run format` and `npm run build`, then verify `/svg/`, its filters/details and data downloads on the deployed commit.
