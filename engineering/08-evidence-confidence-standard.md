# Evidence Confidence Standard

Evidence confidence describes how reliable and complete the evidence is for the displayed ApplySmart assessment. It is not the applicant's chance of receiving an interview.

When ApplySmart predictive modelling is used, confidence still follows this standard. The modelled estimate must not create a new confidence label or be presented as an official university threshold.

## Allowed levels

Use only:

- `High`
- `Medium`
- `Limited`

Do not use percentages, numeric confidence scores, or additional labels.

## Meaning of levels

### High

The relevant applicant route is supported by clear, current official rules and strong official or attributable historical evidence. The implemented model is reproducible and material ambiguity is absent for the displayed assessment.

### Medium

Official rules support the route, but historical evidence is less complete, older, guidance-only, or contains documented limitations that do not prevent a responsible assessment.

### Limited

Material evidence is missing, ambiguous, route-specific support is unavailable, or a required judgement cannot be completed automatically. Manual review and insufficient evidence always produce `Limited`.

## Assignment rules

- Confidence follows the evidence supporting this assessment, not applicant strength.
- A strong applicant does not automatically mean `High`.
- A high-risk applicant does not automatically mean `Limited`.
- Manual review equals `Limited`.
- Insufficient evidence equals `Limited`.
- Unsupported contextual or international evidence for the applicant's route limits confidence.
- The summary and reasons must explain the evidence basis in plain language.
- The summary and reasons must distinguish official university evidence, historical admissions evidence, and ApplySmart predictive modelling where relevant.
- Evidence confidence must not imply an interview or post-interview outcome.

The result card and its decision-transparency section must show the same evidence-confidence object. Use the existing shared builder; do not calculate a parallel confidence value.

## Verification

Every new university must pass:

```sh
node scripts/test-evidence-confidence.js
node scripts/test-completed-result-cards-regression.js
```

Dedicated regression must cover the confidence level for supported routes, manual review, insufficient evidence, and any route-specific evidence gap.
