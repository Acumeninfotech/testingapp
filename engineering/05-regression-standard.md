# Regression Standard

Regression protects the frozen ApplySmart architecture and existing admissions behavior. A new university must add focused coverage without weakening, rewriting, or bypassing existing assertions.

## Required checks

Every new university must pass:

- JSON validation;
- course schema validation;
- research schema validation;
- interview-band schema validation;
- result-card schema validation;
- its dedicated university regression;
- completed result-card regression;
- decision transparency regression;
- evidence confidence regression;
- decision timeline regression;
- the full regression matrix;
- the standardisation drift check;
- the full regression suite.

Production activation is not allowed unless all required checks pass.

## Fixture coverage

Dedicated regression fixtures must cover every supported applicant pool and the significant boundaries of its rules, including:

- eligible and not-eligible outcomes;
- manual-review and insufficient-evidence outcomes;
- academic and admissions-test gates;
- values immediately below, at, and above applicable boundaries;
- contextual and international differences where supported;
- missing or ambiguous applicant evidence;
- historical-guidance band boundaries;
- result-card precedence;
- student-facing historical-guidance caveats;
- official university evidence, historical admissions evidence, and ApplySmart predictive modelling distinctions where a modelled estimate is used;
- modelled-estimate disclaimers required by the [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md);
- readiness and activation behavior.

Fixtures must reflect official rules and must label ApplySmart estimates as estimates. Never change an expected outcome merely to make a failing test pass; first determine whether the implementation, fixture, source interpretation, or evidence/modelling label is wrong.

## Repository validation commands

Use the current repository scripts and schemas. At minimum:

```sh
node scripts/validate-json.js
node scripts/validate-applicant-groups.js
node scripts/validate-subject-catalog.js
node scripts/validate-completed-profile-standardisation.js
node scripts/standardise-completed-profiles.js
node scripts/test-completed-result-cards-regression.js
node scripts/test-decision-transparency.js
node scripts/test-evidence-confidence.js
node scripts/test-decision-timeline.js
node scripts/run-regression-profiles.js
```

Run the new dedicated regression directly, then run every `scripts/test-*.js` script. Validate the new production, research, interview-band, and result-card JSON against their existing schemas using the repository's established schema-validation command.

## Failure policy

On failure:

1. Do not activate the university.
2. Identify whether the failure is evidence, mapping, implementation, fixture, or architecture related.
3. Fix only the new university when the issue is local.
4. Preserve existing admissions behavior.
5. If resolution requires an engine or contract change, stop and request explicit approval under the architecture-freeze process.

Record the commands run, pass counts, warnings, and unresolved failures in the implementation report.
