# Declared before running (2026-11-05)
Hypothesis (post hoc, from the 256-case Fonts pilot sweep): published StarVector-table Potrace/VTracer
scores were produced with tracer inputs near 96-128 px, not 256 px.
Test: full pinned test splits (Fonts 4,821; Icons 2,682), input sizes 96 and 128 only, no other sizes,
engines potrace (defaults) and vtracer (binary defaults); monotrace supplementary. Same references, resvg
scoring, DINOv2-base. Nothing is tuned afterwards.
Published targets (star-vector README): Fonts Potrace 0.967 / VTracer 0.964; Icons Potrace 0.972 / VTracer 0.940.
Reading rule: "consistent" only if a declared size lands within ~2 SE (full-split SE expected ~0.0005 Fonts,
~0.001 Icons) of the published value for BOTH corpora; otherwise report as not explained. Report all four numbers.
