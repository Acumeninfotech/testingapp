# Decision Transparency Standard

Decision transparency explains, in student-facing language, how ApplySmart reached the displayed eligibility and interview recommendation. Every result card must use the existing shared structure and precedence rules.

## Required content

Every result card must include `decision_path` and explain:

- eligibility;
- the selection model;
- historical guidance;
- any ApplySmart predictive modelling used for the recommendation;
- the recommendation;
- key reasons;
- evidence used;
- the manual-review reason, where applicable;
- the insufficient-evidence reason, where applicable.

The decision path must preserve the established order:

1. Eligibility
2. Selection model
3. Historical guidance
4. Recommendation

Each explanation must identify what happened, which applicant pool and rules were used where relevant, and why the final display state follows. Evidence descriptions must use the approved student-facing evidence categories already supported by the result-card architecture.

## Precedence and safety

- Not eligible overrides every interview recommendation.
- Manual review overrides positive or negative recommendation bands.
- Insufficient evidence overrides recommendation bands.
- Historical information is guidance only and must explicitly state that it is not a guarantee.
- ApplySmart predictive estimates must be identified as ApplySmart estimates, not official university thresholds or guarantees.
- Disabled or out-of-scope capabilities must not appear as negative applicant outcomes.

When a higher-priority state applies, later path stages must say that the recommendation was not applied or cannot be produced. Do not leave contradictory positive wording elsewhere on the card.

## Wording standard

Use concise language a prospective student can understand. Explain university-specific scoring or ranking in plain terms, without exposing internal implementation details.

The following words are forbidden in student-facing decision transparency:

- regression;
- fixture;
- schema;
- JSON;
- config;
- classifier;
- matrix;
- baseline.

Do not make deterministic claims from historical observations, imply an offer prediction, infer hidden weighting as fact, present ApplySmart estimates as official university policy, or present evidence confidence as the applicant's chance.

## Verification

The result-card example must match the shared decision-transparency builder and pass:

```sh
node scripts/test-decision-transparency.js
node scripts/test-completed-result-cards-regression.js
```

Any university-specific explanation must be asserted in its dedicated regression.
