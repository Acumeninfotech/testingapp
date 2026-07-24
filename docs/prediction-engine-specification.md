# ApplySmart Prediction Engine Specification

Version: 0.2.0  
Status: implemented capability contract for completed A100 profiles

## Purpose

The ApplySmart prediction engine is an evidence-based interview prediction engine. It evaluates a student profile against:

- an official university course JSON file from `data/universities/`
- an optional research JSON file from `data/research/`
- a student profile supplied by the app

The engine exposes two production capabilities:

- `eligibility_ready`: minimum eligibility can be evaluated for the supported route.
- `interview_prediction_ready`: interview guidance can be produced from official eligibility rules and official interview-selection methodology plus sufficient historical admissions evidence or official/FOI formula evidence.

Offer prediction is outside the ApplySmart product scope. Post-interview
evidence may be retained as research context or used by an explicitly invoked
research utility, but it does not contribute to production readiness and must
not appear on normal result cards.

Historical data and ApplySmart predictive estimates must never be displayed as official university policy.
A live annual cutoff is not required for interview guidance. Its absence lowers certainty and must be disclosed, but does not by itself disable `interview_prediction_ready`.

The engine must distinguish official university evidence, historical admissions evidence, and ApplySmart predictive modelling as defined in `engineering/11-evidence-based-interview-prediction-standard.md`.

Every completed course profile exposes:

```json
{
  "eligibility_ready": true,
  "interview_prediction_ready": true,
  "offer_prediction_scope": "out_of_scope",
  "prediction_confidence": "High"
}
```

## Inputs

### Course Profile

The course profile stores official university rules only.

Required engine sections:

- `course`
- `applies_to_group_ids`
- `stage_1_eligibility`
- `stage_2_interview_selection`
- `contextual_admissions`
- `historical_admissions`
- `sources`
- `engine_notes`

### Research Profile

The research profile stores non-rule prediction data and model-supporting evidence:

- `official_formula_status`
- `official_formula_prediction`
- `predictor_model`
- `historical_ucat_data`
- `historical_admissions_stats`
- `estimated_historical_prediction`
- `readiness`

The research profile may support ApplySmart predictive modelling when official eligibility rules and official interview-selection methodology are available but the exact formula, tariff, cutoff, or weighting is unpublished.
Edinburgh Assessment Day final-score support is an example of optional research
utility rather than a product-readiness feature.

### Student Profile

Minimum student profile fields:

```json
{
  "applicant_group_ids": [],
  "qualification_route": "a_level | scottish | ib | graduate | other",
  "subjects": [],
  "grades": [],
  "ucat": {
    "cognitive_total": null,
    "sjt_band": null,
    "test_year": null
  },
  "contextual_flags": [],
  "academic_history": {
    "resits": null,
    "recent_academic_study": null,
    "degree_classification": null,
    "degree_subject_area": null
  }
}
```

All subject matching must use `subject_id` values from `data/subject-catalog.json`. Applicant groups must use IDs from `data/applicant-groups.json`.

## Output Contract

The engine should return:

```json
{
  "eligibility_result": {},
  "academic_score": {},
  "ucat_score": {},
  "pre_interview_score": {},
  "classification": {},
  "confidence": {},
  "missing_data": [],
  "evidence": []
}
```

Every calculated field must include:

- `available`
- `value`
- `status`
- `evidence_level`
- `source_ids`
- `notes`

Allowed status values:

- `eligible`
- `not_eligible`
- `warning`
- `risk_flag`
- `unknown`
- `not_calculable`
- `context_only`

## 1. Eligibility Result

Eligibility is the first gate. It uses official course JSON only.

### Process

1. Identify applicable applicant groups from the student profile.
2. Select qualification route: A-level, Scottish, IB, graduate, Access, or other.
3. Check required subjects using `subject_id`.
4. Check grade profiles.
5. Check admissions tests:
   - UCAT required?
   - SJT gate?
   - Other tests?
6. Check sitting, resit, recent-study, degree, and English language rules where represented.
7. Apply contextual adjustments only when structured in the course profile.

### Output

```json
{
  "available": true,
  "status": "eligible | not_eligible | warning | unknown",
  "blocking_reasons": [],
  "warnings": [],
  "matched_rules": [],
  "source_ids": []
}
```

### Decision Rules

- If a required subject is missing: `not_eligible`.
- If a required grade is below minimum: `not_eligible`.
- If UCAT is required and missing: `not_eligible`.
- If a rule is represented but student data is missing: `unknown` or `warning`.
- If the route is not fully modelled: `unknown`, not `eligible`.

## 2. Academic Score

Academic score may come from two places:

- official course profile formula, if official/FOI verified
- research profile predictor model, if labelled as ApplySmart modelling or predictor estimate

### Rule

The engine may calculate an academic score only when a usable scoring model exists.

If the score is estimated, the output must say `evidence_level: predictor_estimate` and `usable_for: historical_prediction_engine_only`, and the result card must label the output as an ApplySmart estimate rather than an official university score.

### Output

```json
{
  "available": false,
  "value": null,
  "max": null,
  "scaled_value": null,
  "scaled_max": null,
  "evidence_level": null,
  "usable_for": [],
  "missing_data": [],
  "source_ids": []
}
```

### Dundee Example

For Dundee Standard Entry:

- academic max: `60`
- GCSE / National 5 max: `30`
- A-level / Higher max: `30`
- detailed point tables: missing

Result:

```json
{
  "available": false,
  "status": "not_calculable",
  "max": 60,
  "evidence_level": "predictor_estimate",
  "missing_data": [
    "RUK GCSE scoring table",
    "RUK A-level scoring table",
    "Scottish National 5 scoring table",
    "Scottish Higher scoring table"
  ],
  "usable_for": ["historical_prediction_engine_only"]
}
```

### Aberdeen Example

Aberdeen has research notes for a raw academic score out of `81`, scaled to `30`, but the source is not official/FOI verified.

Formula:

```text
academic_scaled_score = (raw_academic_score / 81) * 30
```

Result:

```json
{
  "available": false,
  "status": "not_calculable",
  "evidence_level": "needs_source_verification",
  "usable_for": [],
  "missing_data": [
    "official or FOI verification for raw academic score table"
  ]
}
```

## 3. UCAT Score

UCAT scoring must respect the course or research model.

### Official UCAT Score

Official UCAT scoring is available only if the university publishes or FOI-verifies the conversion method.

### Research UCAT Score

Research UCAT scoring may be used for context only if labelled as ApplySmart modelling, predictor, or estimated.

### Dundee Standard Entry Example

Research model:

- scoring basis: national cohort decile rank
- max cognitive score: `2700`
- subtest count: `3`
- no fixed cutoff
- SJT not used pre-interview

Decile points:

| Decile | Points |
| --- | ---: |
| 10 | 40 |
| 9 | 36 |
| 8 | 32 |
| 7 | 28 |
| 6 | 24 |
| 5 | 20 |
| 4 | 16 |
| 3 | 12 |
| 2 | 8 |
| 1 | 4 |

If a student has UCAT decile 8:

```json
{
  "available": true,
  "value": 32,
  "max": 40,
  "evidence_level": "predictor_estimate",
  "usable_for": ["historical_prediction_engine_only"],
  "notes": "Not an official Dundee-published scoring formula."
}
```

### Aberdeen Example

Aberdeen research stores:

- raw UCAT max: `60`
- example `2050 = 45 / 60`
- scaled formula: `(raw_ucat_score / 60) * 20`

But the full UCAT mapping is missing.

Result:

```json
{
  "available": false,
  "status": "not_calculable",
  "missing_data": [
    "full UCAT half-decile / percentile mapping table"
  ]
}
```

## 4. Pre-Interview Score

Pre-interview score combines academic and UCAT scores only when both components are calculable.

### Dundee Standard Entry

Formula:

```text
pre_interview_score = academic_score_out_of_60 + ucat_decile_score_out_of_40
maximum_score = 100
```

Availability:

- UCAT component can be calculated if UCAT decile is known.
- Academic component cannot be calculated until detailed point tables exist.
- Therefore total pre-interview score is not calculable yet.

Output:

```json
{
  "available": false,
  "status": "not_calculable",
  "max": 100,
  "partial_components": {
    "ucat_score": "available_if_decile_known",
    "academic_score": "missing_point_tables"
  },
  "evidence_level": "mixed_foi_derived_and_predictor_estimate"
}
```

### Aberdeen

Official process:

```text
pre_interview_score = academic component + UCAT component
academic weighting = 30%
UCAT weighting = 20%
```

But exact academic and UCAT conversions are missing.

Output:

```json
{
  "available": false,
  "status": "not_calculable",
  "known_weighting": {
    "academic": 30,
    "ucat": 20
  },
  "missing_data": [
    "academic scoring formula",
    "UCAT conversion formula"
  ]
}
```

## 5. Interview Guidance Classification

The classification is not an official university prediction. It is an ApplySmart guidance band.

Allowed values:

- `interview_likely`
- `realistic`
- `ambitious`
- `high_risk`
- `not_eligible`

### Classification Inputs

The engine may use:

- eligibility result
- official formula score, if available
- research / historical model, if available
- historical UCAT benchmarks
- missing-data risk
- confidence level

### General Rules

- If `eligibility_result.status = not_eligible`: classification is `not_eligible`.
- A band may be emitted only when `interview_prediction_ready = true`.
- Historical guidance must be labelled as guidance, not as a probability or current-cycle cutoff.
- ApplySmart predictive modelling must be labelled as an ApplySmart estimate, not an official university threshold.
- Missing live annual thresholds reduce confidence but do not automatically block a band.

### Suggested Benchmark Logic

For a benchmark object:

```json
{
  "minimum_competitive": 1850,
  "strong": 2000,
  "very_strong": 2150
}
```

UCAT-only guidance:

- materially below `minimum_competitive`: `high_risk`
- below `minimum_competitive`: `ambitious`
- at or above `minimum_competitive`: `realistic`
- at or above `strong`: `interview_likely`
- at or above `very_strong`: `interview_likely`

But if academic score is missing, the result must include a warning:

```text
Classification is based on UCAT benchmark context only. Academic score is not yet calculable.
```

### Dundee Example

For a Scottish Standard Entry applicant with UCAT `2050`:

- Scottish benchmark:
  - minimum competitive: `1850`
  - strong: `2000`
  - very strong: `2150`
- UCAT-only band: `realistic`
- Academic component: not calculable
- Official formula: unavailable

Output:

```json
{
  "classification": "realistic",
  "classification_type": "historical_context_only",
  "warnings": [
    "Academic score is not calculable because point tables are missing.",
    "This is not an official Dundee prediction."
  ]
}
```

## 6. Confidence Level

Confidence is calculated separately from classification and uses the shared evidence-confidence labels from `engineering/08-evidence-confidence-standard.md`.

Allowed values:

- `High`
- `Medium`
- `Limited`

### Confidence Inputs

The engine should consider:

- source quality
- formula completeness
- whether data is official, FOI-derived, historical, ApplySmart-modelled, or missing
- student profile completeness
- whether the result is eligibility-only, official formula prediction, historical context, or an ApplySmart predictive estimate

### Confidence Rules

Eligibility confidence:

- `High`: official Stage 1 rules are represented and student profile is complete.
- `Medium`: official rules are represented but some route details are partial.
- `Limited`: route rules are incomplete, unsupported, legacy, or require manual review.

Official formula confidence:

- `High`: all scoring formulas official/FOI verified.
- `Medium`: formula mostly verified with minor missing edge cases.
- `Limited`: key scoring formulas are missing or cannot support an official formula prediction.

Prediction confidence:

- `High`: official/FOI formula or ranking evidence is complete enough for the capability and strongly sourced.
- `Medium`: official selection methodology is known and historical/FOI guidance is useful, but live boundaries or parts of the model are unpublished.
- `Limited`: the capability is available only with sparse or weakly calibrated supporting evidence, or route-specific evidence is incomplete.

### Dundee Confidence

```json
{
  "overall": "Medium",
  "eligibility": "High",
  "official_formula_prediction": "Limited",
  "historical_prediction": "Medium",
  "reason": "Eligibility is official-source backed. Research model and benchmarks exist, but official formula and academic point tables are incomplete."
}
```

### Aberdeen Confidence

```json
{
  "overall": "Medium",
  "eligibility": "High",
  "official_formula_prediction": "Limited",
  "historical_prediction": "Medium",
  "reason": "Eligibility and official weighting are source-backed, but exact formulas and validated historical bands are missing."
}
```

## Engine Safety Rules

The engine must not:

- infer missing academic point tables
- treat ApplySmart or predictor estimates as official policy
- treat historical UCAT data as official current cutoffs
- present historical guidance as a guaranteed interview or probability percentage
- infer hidden weighting as fact
- guarantee interviews or offers
- calculate pre-interview scores when a required component is missing
- show an interview band without showing its basis and confidence

The engine must:

- return partial results where possible
- label every score by evidence level
- expose missing data reasons
- preserve source IDs
- separate official university evidence, historical admissions evidence, and ApplySmart predictive modelling

## Readiness Logic

### Eligibility Ready

True when:

- Stage 1 official rules exist for the applicant route.
- UCAT requirement is represented.
- Essential subjects are represented.
- Minimum grades are represented.

### Interview Prediction Ready

True only when:

- the official eligibility and relevant admissions-test gates are represented
- official interview-selection methodology is known
- sufficient official/FOI formula evidence or historical admissions evidence exists
- exact unpublished formulae, tariffs, cutoffs, or weightings are handled only as labelled ApplySmart estimates
- the result can be labelled with its evidence basis, confidence, and disclaimer

A live annual cutoff is not required.

### Offer Prediction Scope

Always `out_of_scope`. Post-interview evidence is research context and is not a
production-readiness input. An explicitly invoked research utility may use a
supplied post-interview score, but normal engine and result-card outputs remain
limited to eligibility and interview prediction.

### Result Card Ready

True when:

- eligibility guidance can be displayed
- missing prediction reasons can be displayed
- historical or ApplySmart-modelled context can be displayed safely
- official evidence, historical evidence, and ApplySmart modelling can be distinguished
- all evidence source IDs are available

## Worked Example Summary

### Dundee A100

- Eligibility ready: yes
- Interview prediction ready: yes
- Prediction confidence: Medium
- Result card ready: yes

Available calculations:

- UCAT decile score can be calculated from predictor-estimated decile points if UCAT decile is known.
- Academic score cannot yet be calculated because detailed point tables are missing.
- Pre-interview score cannot yet be fully calculated.
- Interview guidance may be shown with a Medium-confidence historical/ApplySmart-modelled label.

### Aberdeen A100

- Eligibility ready: yes
- Interview prediction ready: yes
- Prediction confidence: Medium
- Result card ready: yes

Available calculations:

- Official weighting is known: academic 30%, UCAT 20%, interview 50%.
- Exact academic formula is not verified.
- FOI UCAT conversion and official applicant-group historical data are available.
- Interview guidance is available, but exact live ranking and offer decisions remain unpublished.
