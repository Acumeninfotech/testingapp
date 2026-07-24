# Result-card UX recommendation mapping

## Purpose

This document defines presentation-only wording for ApplySmart result cards. It does not change eligibility, interview scoring, recommendation bands or university production rules.

Regression reports and debugging output must retain the original technical values. The result card derives a separate `primary_user_facing_recommendation` for display.

## Display precedence

Apply these states in order:

1. **Manual review**
2. **Insufficient evidence**
3. **Standard recommendation**

Manual review has priority because the two current manual-review outcomes are also tracked as insufficient-evidence outcomes.

| Technical outcome | Primary user-facing recommendation | Treatment of internal recommendation |
|---|---|---|
| Eligibility status is `Manual review` | **Needs adviser review** | Retain `Consider stronger alternatives` internally; do not show it as the primary recommendation |
| Evidence status is `insufficient_evidence`, unless manual review applies | **Evidence not yet available** | Retain `Consider stronger alternatives` internally; do not show it as the primary recommendation |
| Neither override applies | Use the existing standard user-facing recommendation | No override |

## UX mapping

```text
if eligibility_status is manual_review:
    primary_user_facing_recommendation = "Needs adviser review"
    recommendation_display_state = "manual_review"
else if evidence_status is insufficient_evidence:
    primary_user_facing_recommendation = "Evidence not yet available"
    recommendation_display_state = "insufficient_evidence"
else:
    primary_user_facing_recommendation = existing user-facing recommendation
    recommendation_display_state = "standard"
```

This is display selection, not a new admissions decision.

## Result-card shape

The user-facing and technical values must be kept separate:

```json
{
  "display": {
    "primary_user_facing_recommendation": "Needs adviser review",
    "recommendation_display_state": "manual_review"
  },
  "internal_technical_status": {
    "eligibility_status": "Manual review",
    "interview_recommendation": "Consider stronger alternatives",
    "evidence_status": "insufficient_evidence",
    "debug_only": true
  }
}
```

`internal_technical_status` remains available to debugging tools and regression reports. It must not supply the primary result-card recommendation when a display override applies.

## Manual-review card

Primary recommendation:

> **Needs adviser review**

Supporting copy:

> We need more information to confirm this result. Check the items listed below before relying on an interview recommendation.

Do not show **Consider stronger alternatives** as the primary recommendation. Do not imply that an adviser is already reviewing the case or promise a response time.

## Insufficient-evidence card

Primary recommendation:

> **Evidence not yet available**

Supporting copy:

> ApplySmart does not yet have enough verified historical data for this applicant group to estimate interview chances. This is a data gap, not a negative assessment of the application.

Do not show **Consider stronger alternatives** as the primary recommendation. Make clear when the evidence gap belongs to ApplySmart rather than to information omitted by the applicant.

## Examples

The executable JSON-shaped examples are in `data/examples/result-card-ux-mapping.example.json`. They use existing regression outcomes:

- Birmingham contextual applicant — **Needs adviser review**
- Nottingham graduate applicant — **Needs adviser review**
- Manchester international applicant — **Evidence not yet available**

The original eligibility, recommendation and evidence statuses remain in each example under `internal_technical_status`.
