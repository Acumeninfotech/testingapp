# Historical Normalised Prediction Methodology v1.0

Status: approved  
Approved: 2026-06-29

## Purpose

ApplySmart may use transparently normalised historical admissions statistics to
produce low-confidence interview guidance when official evidence exists on a
legacy UCAT scale and official current-scale evidence is unavailable.

## Governing principles

1. Official historical admissions statistics remain unchanged and are stored
   as official evidence.
2. Derived UCAT values are stored separately with the evidence classification
   `derived_for_prediction`.
3. Derived values must never be represented as official university statistics.
4. A course interview-band configuration may use the derived values only when:
   - official current-scale evidence is unavailable;
   - the normalisation method and course calibration are documented;
   - prediction confidence is initially `low`; and
   - outputs are described as guidance, not cut-offs or probabilities.
5. Future official current-scale evidence may replace or refine the derived
   guidance without an engine change.

## Evidence separation

The official source value, source scale, entry cycle and applicant cohort must
remain available in research evidence. A derived record must identify:

- the official dataset from which it was derived;
- the target score scale;
- the conversion formula and rounding rule;
- `official: false`; and
- `evidence_status: "derived_for_prediction"`.

Derived values belong in research and prediction methodology data. They must
not overwrite official history in a production university profile.

## Band configuration safeguards

Every configuration using this methodology must:

- cite both the official historical source and this methodology;
- document its course-specific boundary calibration;
- use only cohorts represented by the evidence;
- avoid claiming that reported cohorts prove the University's ranking-pool
  structure;
- exclude routes requiring unsupported adjustments or eligibility logic;
- keep post-interview outcomes outside product output; and
- explain that annual applicant competition and policy changes can make the
  historical guidance differ from the current cycle.

## St Andrews A100 v1 calibration

St Andrews publishes five cycles of historical interviewed UCAT statistics by
Home, Rest of UK and Overseas fee cohort on the legacy 3600 scale. The research
profile preserves those official values and separately stores 2700-scale
values calculated as:

```text
derived UCAT = official historical UCAT × 0.75
```

Values are rounded to the nearest whole number.

The initial configuration is restricted to non-contextual standard A-level
school leavers in the Scottish/Home and Rest of UK cohorts. For each cohort:

- `interview_likely` begins at the median of the five annual mean interviewed
  derived UCAT values;
- `realistic` begins at the highest of the five annual lowest interviewed
  derived UCAT values;
- `ambitious` begins at the lowest of the five annual lowest interviewed
  derived UCAT values; and
- `high_risk` is below that historical minimum.

These boundaries are ApplySmart operational guidance. They are not St Andrews
cut-offs, probabilities, current-cycle rank boundaries, or evidence that the
University operates separate fee-status ranking pools.

The initial St Andrews configuration excludes contextual and widening
participation applicants because the official 10% UCAT ranking uplift is not
currently executable. It also excludes graduate and international routes from
the approved restricted scope.
