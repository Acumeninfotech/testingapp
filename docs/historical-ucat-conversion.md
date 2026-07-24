# Historical UCAT Conversion

ApplySmart stores the shared historical UCAT conversion reference in:

```text
data/ucat-conversions.json
```

That file is the single source of truth for the supported historical `/3600` to current `/2700` conversion. Future university implementations must use the shared reference and `assets/js/engine/ucat-conversion-service.js`; they must not add university-specific formulae, copied conversion tables, frontend-only conversions, or local threshold rewrites.

## Formula

The approved ApplySmart proportional conversion is:

```text
converted_score = historical_score * 0.75
```

Equivalent:

```text
converted_score = historical_score / 3600 * 2700
```

The approved factor is `0.75`. The approved rounding policy is `nearest_integer`, implemented with `Math.round`.

Supported scales:

- Source: `historical_3600`, historical four-subtest UCAT cognitive total, valid range `1200-3600`.
- Target: `current_2700`, current three-subtest UCAT cognitive total, output range `900-2700`.

This is ApplySmart advisory guidance. It is not an official UCAT conversion, not an official university conversion, and not an official current university threshold.

## Runtime Use

The conversion is explicitly opt-in. A future interview-band rule must declare:

- `score_scale: "historical_3600"`
- `conversion_reference: "applysmart-standard-ucat-historical-conversion"`
- official historical boundary fields such as `historical_score`, or `minimum_historical_score` and `maximum_historical_score`
- `evidence_status: "official_historical_evidence"`

Native `/2700` rules either omit `score_scale` or use `score_scale: "current_2700"` and continue to use `value`, `min`, and `max`. Native rules bypass conversion completely.

The applicant UCAT score remains on the current `/2700` scale. ApplySmart converts only historical evidence boundaries, compares the applicant's current score with the converted boundary, and keeps both the original official historical value and the ApplySmart-derived equivalent available for transparency.

## Stored Derived Values

Historical rules may store derived values for readability:

- `derived_score_2700`
- `minimum_derived_score_2700`
- `maximum_derived_score_2700`
- `derived_score_status: "applysmart_derived"`

Stored derived values never override the calculated result. Validation fails if a stored derived value does not match the shared utility.

## Validation

`validateHistoricalUcatBandRules` rejects malformed future historical conversion rules, including missing or unknown conversion references, invalid scales, missing or non-numeric historical scores, out-of-range scores, mixed historical and native fields, incorrect stored derived values, inverted ranges, converted overlaps, and rounding ambiguity.

If adjacent official historical ranges convert to the same `/2700` boundary because of rounding, validation reports an ambiguity. The future configuration must resolve that explicitly rather than silently creating overlapping bands.

Use this conversion only for official historical UCAT evidence published on the previous `/3600` cognitive-total scale. Do not use it for current `/2700` thresholds, UCAT deciles, SJT, eligibility gates, applicant score conversion, result-card copy changes, or offer prediction.
