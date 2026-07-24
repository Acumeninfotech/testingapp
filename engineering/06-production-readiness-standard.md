# Production Readiness Standard

Production readiness measures whether ApplySmart can safely provide eligibility and interview guidance for a university's declared applicant scope. It does not imply that every possible qualification or applicant route is supported.

## Required readiness dimensions

A university is production ready only when the applicable dimensions below are ready:

- eligibility;
- interview prediction;
- historical guidance;
- evidence-based prediction labelling, where ApplySmart modelling is used;
- international logic, if applicable;
- contextual logic, if applicable;
- result card;
- decision transparency;
- evidence confidence;
- decision timeline;
- regression;
- interview research evidence.

The supported scope, disabled routes, evidence gaps, manual-review boundaries, and any ApplySmart predictive modelling must be explicit and consistent across research metadata, production metadata, the index, result cards, and regression reporting.

Offer prediction is out of scope and must not be used as a readiness criterion. Optional post-interview research does not raise or lower production readiness.

## Allowed statuses

Use only these user-facing audit statuses:

| Status | Meaning |
| --- | --- |
| Production Ready | All applicable requirements pass for the declared supported scope. |
| Needs Review | Logic exists, but a material route, evidence conflict, manual decision, or validation concern needs review before unrestricted use. |
| Missing Research | Required official or attributable FOI evidence is absent for an intended production capability. |
| Disabled Feature | The capability or applicant route is intentionally unavailable and the product handles that state safely. |
| Out of Scope | The capability is not part of ApplySmart's eligibility and interview-prediction product scope. |

Do not use `Disabled Feature` to conceal missing evidence for a capability claimed as supported. Do not use `Out of Scope` for applicable eligibility or interview-selection work merely because research is difficult.

## Readiness assessment

For each university:

1. Declare the supported applicant scope.
2. Assess every applicable readiness dimension against current evidence and implemented behavior.
3. Confirm metadata agrees across all artifacts.
4. Confirm result cards safely represent not eligible, manual review, and insufficient evidence.
5. Confirm historical guidance is clearly labelled and not guaranteed.
6. Confirm any ApplySmart predictive estimate distinguishes official university evidence from historical admissions evidence and modelling.
7. Run all validation and regression checks.
8. Record genuine evidence gaps without guessing.
9. Activate only when the overall status is `Production Ready`.

A supported manual-review route may be intentional, but the reason and boundary must be explicit. A university must not receive `Production Ready` if required validation fails, if insufficient interview evidence prevents the declared core prediction from being supported, or if a modelled prediction cannot be safely labelled under the [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md).
