# ApplySmart result-card UX audit

> **Superseded.** This document reflects Phase 1B wording ("Needs adviser
> review", "Good chance based on historical data", etc.), which predates the
> canonical public-label audit. The approved canonical wording is now:
> `very_strong_interview_potential` → Very Strong Choice,
> `interview_likely` → Strong Choice, `realistic` → Realistic Choice,
> `ambitious` → Ambitious Choice, `high_risk` → High Risk. See
> `assets/js/engine/result-card-presenter.js`'s `CANONICAL_BAND_LABELS` and
> `frontend/src/lib/resultPresenter.ts` for the current source of truth. The
> wording table and regression counts below are historical and must not be
> used to validate current output.

## Status

Phase 1B precedence and wording checks pass across the 165 completed university-profile combinations.

## Precedence

1. **Entry requirements not met** overrides every interview recommendation.
2. **Needs adviser review** overrides strong, good, ambitious and less-competitive bands.
3. **Evidence not yet available** overrides recommendation bands when verified guidance cannot be produced.
4. Historical recommendation bands are shown only after eligibility and evidence checks pass.

## User-facing wording

| Internal state | Primary result-card wording |
|---|---|
| `not_eligible` | You do not currently meet the published entry requirements |
| `manual_review` | Needs adviser review |
| `insufficient_evidence` | Evidence not yet available |
| `interview_likely` | Strong choice based on historical data |
| `realistic` | Good chance based on historical data |
| `ambitious` | Possible, but ambitious |
| `high_risk` | Less competitive based on historical data |

Internal band keys, configured-rule terminology and engine-flow wording are not used as the primary result-card explanation. Historical comparisons state that they are guidance, not current cut-offs or interview guarantees.

Disabled offer prediction is retained as an internal capability state and is not displayed as a negative applicant outcome.

## Regression result

- Historical recommendation: 70
- Entry requirements not met: 92
- Needs adviser review: 2
- Evidence not yet available: 1
- Total: 165
