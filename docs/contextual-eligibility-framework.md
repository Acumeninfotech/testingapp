# Contextual Eligibility Framework

## Current Contextual Architecture

Applicant facts are normalised in `assets/js/engine/applicant-profile-normaliser.js`.
The redesigned `contextual_profile` is canonicalised there into postcode measures,
financial support, school/education facts, personal circumstances, access
programmes and partner-school evidence.

Eligibility decisions are still driven by applicant groups in
`assets/js/engine/eligibility-evaluator.js`:

- `deriveApplicantGroupIds()` derives fee, domicile, qualification-route,
  graduate, resit and legacy contextual-flag groups.
- `contextualFlagApplicantGroupIds()` turns confirmed
  `applicant_identity.contextual_flags` entries into raw group ids.
- `applyCourseSpecificDerivedApplicantGroups()` contains the current
  university-specific contextual group derivation for Birmingham, Lancaster and
  Aston. Aston is the only course currently using the shared framework result
  to activate a contextual group.
- `groupRuleApplies()` applies `all_group_ids` / `applies_to_group_ids`,
  `any_group_ids` and `excluded_group_ids` to route, GCSE, UCAT and selection
  rules.
- A-level, IB and other route selection then use the resolved applicant groups.
- The result-card presenter reports contextual/widening participation from
  applicant groups and selected academic pathways; it does not evaluate the new
  `contextual_profile` independently.

## New Profile Flow

The new `contextual_profile` currently flows through normalisation only. It
stores factual evidence such as POLAR4, IMD, TUNDRA, FSM, UCAT bursary,
disability, care experience, refugee/asylum status, access programmes and
partner-school relationships.

Those facts do not by themselves add `contextual` or
`widening_participation` applicant groups. A redesigned profile only affects
contextual eligibility when a course-specific policy evaluator interprets that
evidence. For Aston A100, the Aston Ready evaluator can activate `contextual`;
other universities are unchanged.

## Shared Framework

`assets/js/engine/contextual-eligibility-framework.js` introduces a reusable
contextual layer:

- `collectContextualEvidence(applicant)` returns canonical factual evidence and
  preserves legacy declarations as evidence.
- `evaluateContextualEligibility(course, applicant, options)` returns a stable
  contextual eligibility result.
- Unsupported courses return `status: "not_evaluated"` with
  `reason: "unsupported_contextual_policy"`.
- Future university evaluators can be supplied by evaluator id and can use
  shared criterion helpers for `all_of`, `any_of`, exclusions and missing
  required evidence.

The shared framework is exported from `eligibility-evaluator.js`. Course
evaluators are registered in `assets/js/engine/contextual-eligibility-evaluators.js`;
the first production evaluator is Aston Ready for `aston-a100`.

## Aston Ready A100

`assets/js/engine/aston-contextual-eligibility.js` implements the Aston Medicine
A100 evaluator behind `evaluator_id: "aston_ready_medicine_a100"` in
`data/universities/aston-a100.json`.

The evaluator uses shared evidence collection and only appends the `contextual`
applicant group when Aston Ready is confirmed. It does not duplicate the AAB
academic offer; the existing `contextual_school_leaver_a_level` route continues
to check AAB overall, Chemistry A, Biology A and the remaining A-level rules.

Aston Ready base exclusions are evaluated separately from qualifying criteria:
home-fee status, independent-school attendance, graduate status and final-year
undergraduate status. State grammar-school evidence is not treated as
independent-school attendance.

Fully evaluable Aston criteria from the current profile are UCAT bursary,
declared disability, care experience/care-leaver status, refugee status and
POLAR4 Q1/Q2. FSM is only accepted when the profile contains the exact
end-of-KS4-within-six-years evidence. Aston Pathways is only accepted when an
exact Aston Pathways programme record confirms completion in Year 12 or Year 13.
Aston STEM Trust schools are only accepted on exact school-id or exact
normalised school-name matches.

Aston's standard A-level route remains first in the existing route order and no
longer excludes contextual applicants. This preserves standard-route precedence:
an A*AA applicant with confirmed Aston Ready evidence is still recorded against
the standard A-level pathway, while an Aston Ready applicant missing the standard
offer can use the existing contextual AAB route.

## Compatibility Rules

Existing saved profiles may still contain `applicant_identity.contextual`,
`applicant_identity.widening_participation` and legacy contextual checkboxes.
The normaliser preserves legacy values and maps confirmed legacy flags into the
factual `contextual_profile` where possible.

Legacy self-declarations are not converted into university contextual
eligibility. They are exposed by the framework as `legacy_declarations` so a
future university evaluator can decide whether the evidence is sufficient,
missing, excluded or unsupported under that university policy.

## Future Migration Point

University-specific contextual decisions should occur in dedicated contextual
evaluators called by `evaluateContextualEligibility()`. Only those evaluators
should decide whether contextual eligibility is met and which contextual
applicant groups or academic pathways may be activated for that course.
