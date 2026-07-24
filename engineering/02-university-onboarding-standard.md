# University Onboarding Standard

This is the official research and mapping standard for adding a university to ApplySmart. Complete every section for the relevant entry cycle before implementation. Record a section as not applicable or unresolved when appropriate; do not infer missing rules.

## 1. Course identity

Record the university, medical school, course title, UCAS code, qualification, entry year, course length, campus where relevant, and the stable ApplySmart profile ID. Resolve naming differences between official sources before implementation.

## 2. Applicant pools

Identify every separately ranked or assessed pool, including Home, international, contextual or widening-participation, graduate, resit, foundation or guaranteed-interview routes. Define how applicants enter each pool and whether pools overlap.

## 3. Minimum academic requirements

Capture universal academic gates, accepted qualification routes, subject constraints, timing rules, achieved-versus-predicted grade rules, and circumstances that require manual review.

## 4. GCSE requirements

Record minimum grades, mandatory subjects, scoring subjects, subject-count rules, equivalencies, resit treatment, and whether GCSEs are eligibility gates, scored inputs, or both.

## 5. A-Level requirements

Record the grade offer, mandatory and excluded subjects, combinations, practical endorsement requirements, resit rules, predicted-grade rules, and contextual variations.

## 6. Scottish requirements

Record Highers and Advanced Highers, required subjects, grade combinations, sitting requirements, and route-specific differences. Mark the route unsupported if official executable evidence is unavailable.

## 7. IB requirements

Record total points, Higher Level points and grades, required subjects, Standard Level requirements, resit rules, and contextual variations.

## 8. International qualifications

List each supported qualification and country-specific equivalence using official university evidence. Separate fee-status policy from qualification eligibility. Unsupported or ambiguous qualifications must return an evidence gap or manual review rather than an inferred decision.

## 9. UCAT/SJT rules

Record the accepted UCAT cycle, cognitive-total treatment, SJT treatment, exclusions, minimum gates, ranking method, decile use, exemptions, and separate rules by applicant pool. Do not convert historical figures into a guaranteed future threshold.

## 10. Historical UCAT and interview data

Collect cycle-labelled official or FOI evidence for interview cutoffs, score distributions, ranking ranges, and interview invitations. Distinguish official university evidence from historical admissions evidence and label all historical comparisons as guidance, not a guarantee.

## 11. Academic scoring model

Document every component, scale, weighting, cap, tie-break, order of operations, and pool variation. Supply a worked example that can be reproduced from the evidence. If the model is not fully executable, identify the exact manual-review boundary.

## 12. Interview selection model

Define the sequence from eligibility to shortlist: hard gates, scoring, ranking, overrides, quotas, tie-breaks, historical comparison, ApplySmart predictive modelling where allowed, and the point at which an interview recommendation can be produced. Map each step to an existing engine capability and the [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md).

## 13. Interview format

Record the current published format, such as MMI or panel, delivery mode, station or domain information, and relevant cycle. Interview format is user guidance unless it directly affects pre-interview selection.

## 14. Application statistics

Collect cycle- and pool-specific numbers for applications, interviews, offers, and places where available. Preserve denominators and definitions. Do not combine incompatible cycles or applicant pools.

## 15. Contextual/WP policy

Record eligibility criteria, required evidence, adjusted academic or UCAT rules, guaranteed-interview routes, scoring changes, and geographic or programme restrictions. Separate executable logic from criteria that require university verification.

## 16. International applicant policy

Record qualification eligibility, English-language requirements, fee-status or overseas pool treatment, UCAT rules, quotas where officially stated, historical interview evidence, and any manual checks. Do not reuse Home guidance for international applicants without evidence.

## 17. Special policies

Capture resits, graduates, prior degrees, transfers, extenuating circumstances, age rules, work experience, fitness-to-practise requirements, admissions tests other than UCAT, and any special route or exclusion.

## 18. Source evidence required

For every executable rule, retain:

- the official source title and URL;
- publisher or issuing body;
- publication or retrieval date;
- entry cycle;
- applicant pool;
- exact rule supported;
- evidence type and confidence;
- archived or local reference where permitted.

Use official university, UCAS, UCAT, government, or attributable FOI material. Record conflicts, superseded documents, and unresolved gaps explicitly. Optional offer-selection or post-interview information may be stored only as research notes; it is not production readiness evidence.

## 19. ApplySmart engine mapping

Map the research into the existing:

- production JSON structure;
- research JSON structure;
- applicant groups and subject IDs;
- eligibility stages and manual-review states;
- interview-band configuration and guidance pools;
- result-card structure;
- decision transparency;
- evidence confidence;
- five-step decision timeline;
- readiness metadata;
- regression fixtures and dedicated regression script;
- index activation entry.

Do not add a new field or behavior merely because the source uses different terminology. If the existing architecture cannot faithfully express an official rule, follow the approval process in [01-architecture-freeze.md](01-architecture-freeze.md).

## 20. Production readiness checklist

Before activation, confirm:

- [ ] Course identity and supported applicant pools are unambiguous.
- [ ] Eligibility rules are executable for the declared scope.
- [ ] Interview prediction uses a documented selection model.
- [ ] Official university evidence, historical admissions evidence, and ApplySmart predictive modelling are separated and labelled.
- [ ] Historical guidance is cycle-labelled and never presented as a guarantee.
- [ ] International logic is implemented or explicitly disabled where applicable.
- [ ] Contextual logic is implemented or explicitly disabled where applicable.
- [ ] Result-card precedence and student-facing wording conform to the baseline.
- [ ] Decision transparency, evidence confidence, and decision timeline conform to the baseline.
- [ ] Interview research evidence is sufficient for the supported prediction scope.
- [ ] Readiness metadata accurately represents supported, disabled, and manual-review paths.
- [ ] All evidence gaps are recorded and no missing rule has been guessed.
- [ ] Dedicated and full regression checks pass.
- [ ] JSON, schema, and standardisation checks pass.
- [ ] The index activates the university only after all required checks pass.

Offer prediction is not part of this checklist and must not be used to block or award production readiness.
