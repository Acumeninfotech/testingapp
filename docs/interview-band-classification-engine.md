# Interview Band Classification Engine

`assets/js/engine/interview-band-classifier.js` converts applicant evidence into one canonical interview outcome:

- `not_eligible`
- `interview_likely`
- `realistic`
- `ambitious`
- `high_risk`
- `insufficient_evidence`

The engine contains no university identifiers or university-specific thresholds. Course eligibility remains in `data/universities/*.json`; reusable scoring operations, applicant-pool guidance and exact band margins are selected by data in `data/interview-band-configs/*.json`.

Where a configuration normalises official legacy-scale historical UCAT data,
it must follow
[`historical-normalised-prediction-methodology-v1.0.md`](historical-normalised-prediction-methodology-v1.0.md).
Normalised values remain prediction methodology, not official university
statistics, cut-offs or probabilities.

Historical UCAT evidence published on the previous `/3600` cognitive-total
scale must use the shared reference in `data/ucat-conversions.json` and the
shared conversion utility. The conversion is explicit opt-in through
`score_scale: "historical_3600"` and
`conversion_reference: "applysmart-standard-ucat-historical-conversion"`.
Native current `/2700` rules continue to use `value`, `min` and `max`, and
bypass conversion.

## Evaluation order

1. Derive canonical applicant groups from the applicant profile.
2. Apply academic, required-test and SJT hard filters.
3. Calculate the configured component score or ranking metric.
4. Select the most specific matching applicant guidance pool.
5. Apply its ordered numeric band rules.
6. Return evidence, confidence and an explanation with the canonical interview band.

An academically eligible applicant returns `insufficient_evidence` when no configuration, calculable score, matching guidance pool or band rule is available.

## Adding a course

Add or complete the university course JSON, then add a config conforming to `data/schemas/interview-band-classification.schema.json`. Register its path as `interview_band_config_file` in `data/index.json`.

No engine change is needed when existing component types and band operators describe the course. Add engine code only when the university genuinely uses a new selection model that cannot be represented by the existing reusable component types.

## Validation

```sh
node scripts/validate-json.js
npx --yes ajv-cli validate --spec=draft2020 \
  -s data/schemas/interview-band-classification.schema.json \
  -d "data/interview-band-configs/*.json" --strict=false
node scripts/test-generic-interview-band-classifier.js
node scripts/test-completed-result-cards-regression.js
```
