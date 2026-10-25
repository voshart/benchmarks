# OCR rating v4 rollout audit — October 25, 2026

Evidence baseline: `f9618fa6d2a0e36dc0817452a64b8fb2bb5c9e24`. Measurements, model
identities and protocol eligibility were retained. Policy 4 changes aggregation and display
coverage. Run `node scripts/audit-ocr-ranking.cjs` to repeat these diagnostics.

## Held-out comparisons

Five deterministic folds hold out each identity pair across every family together. Predictions
are evaluated only when both endpoints remain connected in training. Weights retain the full
comparison topology. Published panel comparisons are correlated and selectively reported; this
is an internal consistency diagnostic, not independent OCR validation or a confidence interval.

| Prior | Directional agreement | Brier score (lower is better) |
| --- | --- | --- |
| 0.25 | 81.51% | 0.1512 |
| 0.5 | 80.49% | 0.1715 |
| 1.0 | 79.10% | 0.1932 |

There were 6,597 evaluated non-tied comparisons. A weighted win-rate baseline scored 81.54%
directional agreement. Bradley–Terry is not claimed to beat that baseline; it provides a coherent
joint fit through shared opponents with regularization and explicit connectivity. The default
prior is 0.25, selected from this declared grid for the strongest held-out results, not for any
named model's placement. These estimates are not an unbiased test of that hyperparameter choice.

## Sensitivity and coverage

The rollout graph has 6,603 family/pair comparisons and one connected component of 162 rated
configurations. Removing a family retains 7–10 of the original top ten; removing one source also
retains 7–10. Removing the LightOn report moves an original top-20 model by up to 45 places.
Narrow evidence can therefore produce substantial ordering changes. The UI labels every rating
as an estimate and retains source/coverage explanations in the existing popover.

Both Chandra 2.5 identities are visible by default. The release evaluation has one comparison
family and two distinct opponents; the October 20 accurate service snapshot has one family and
nine opponents. Their scores are not pooled. Singleton results and disconnected groups cannot
establish global placement. No quality contribution is inferred from speed, cost or parameter
count.

## Implementation checks

Behavioral tests cover ties, metric direction, sparse/undefeated models, shared-opponent chains,
fixed protocol priority, repeated panels, configuration clones, excluded observations, valid
source alternatives, disconnected groups, filters, historical model availability and identical
browser/Node results. Existing source-evidence tests remain in place. The complete build gate
passes 174 tests, validates OCR and speech data, and renders both sites.
