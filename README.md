# ApplySmart Website

Static website project scaffold using HTML, CSS, and JavaScript.

## Structure

- `index.html` — homepage template
- `assets/css/styles.css` — main stylesheet
- `assets/js/main.js` — interactive behavior
- `assets/images/` — asset folder for icons and photos
- `data/` — ApplySmart admissions dataset
- `data/applicant-groups.json` — controlled dictionary of reusable applicant characteristics
- `data/subject-catalog.json` — controlled dictionary of reusable subject identifiers
- `data/ucat-conversions.json` — shared historical UCAT `/3600` to current `/2700` advisory conversion reference
- `data/schemas/` — JSON Schema contracts for shared dataset files
- `scripts/` — lightweight validation scripts

## Start

Open `index.html` in a browser to view the landing page.

## Engineering Playbook

The [ApplySmart Engineering Playbook](engineering/10-engineering-playbook.md) freezes the architecture, research handoff, evidence-based interview prediction, implementation, regression, and production-readiness standards. All future university implementations must follow the standards in the [`engineering/`](engineering/) folder.

Current production readiness status is saved in [Audit/CURRENT_PRODUCTION_READINESS_STATUS.md](Audit/CURRENT_PRODUCTION_READINESS_STATUS.md). Future audits must separate production candidates, seed-only catalogue entries, and non-blocking improvements.

## ApplySmart A100 Readiness Dashboard

ApplySmart is an evidence-based eligibility and interview-prediction engine. Final-offer
prediction is outside the product scope. Post-interview evidence may be retained
as research context, but it is not a production-readiness capability and is not
shown on result cards.

- Shared dictionaries are in place for applicant groups and subjects.
- `data/templates/course-template.json` is the canonical course profile blueprint.
- `data/schemas/course.schema.json` is the canonical course profile schema.

| University | Profile ID | Eligibility | Interview prediction | Confidence | Result card |
| ---------- | ---------- | ----------- | -------------------- | ---------- | ----------- |
| Anglia Ruskin University | `anglia-ruskin-a100` | Ready | Ready | Medium | Ready |
| Aston University | `aston-a100` | Ready | Ready | Low | Ready |
| Brunel University of London | `brunel-university-of-london-a100` | Ready | Ready | Low | Ready |
| Cardiff University | `cardiff-a100` | Ready | Ready | High | Ready |
| Edge Hill University | `edge-hill-a100` | Ready | Ready | Low | Ready |
| Hull York Medical School | `hull-york-a100` | Ready | Ready | Low | Ready |
| Keele University | `keele-a100` | Ready | Ready | Low | Ready |
| Lancaster University | `lancaster-a100` | Ready | Ready | Medium | Ready |
| Newcastle University | `newcastle-a100` | Ready | Ready | Medium | Ready |
| Queen Mary University of London | `queen-mary-a100` | Ready | Ready | Medium | Ready |
| University of Aberdeen | `aberdeen-a100` | Ready | Ready | Medium | Ready |
| University of Birmingham | `birmingham-a100` | Ready | Ready | Medium | Ready |
| University of Bristol | `bristol-a100` | Ready | Ready | Medium | Ready |
| University of Buckingham | `buckingham-71a8` | Ready | Eligibility-only | Low | Ready |
| University of Cambridge | `cambridge-a100` | Ready | Ready | Medium | Ready |
| University of Dundee | `dundee-a100` | Ready | Ready | Medium | Ready |
| University of East Anglia | `east-anglia-a100` | Ready | Ready | Low | Ready |
| University of Edinburgh | `edinburgh-a100` | Ready | Ready | High | Ready |
| University of Exeter | `exeter-a100` | Ready | Ready | Medium | Ready |
| University of Glasgow | `glasgow-a100` | Ready | Ready | Medium | Ready |
| University of Lancashire | `lancashire-a100` | Ready | Eligibility-only | Low | Ready |
| University of Leeds | `leeds-a100` | Ready | Ready | Medium | Ready |
| University of Leicester | `leicester-a100` | Ready | Ready | Medium | Ready |
| University of Lincoln | `lincoln-a100` | Ready | Ready | Low | Ready |
| Liverpool | `liverpool-a100` | Ready | Ready | Medium | Ready |
| University of Manchester | `manchester-a100` | Ready | Ready | Medium | Ready |
| University of Nottingham | `nottingham-a100` | Ready | Ready | Low | Ready |
| University of Oxford | `oxford-a100` | Ready | Ready | Medium | Ready |
| University of Plymouth | `plymouth-a100` | Ready | Ready | Low | Ready |
| University of Sheffield | `sheffield-a100` | Ready | Ready | Medium | Ready |
| University of Southampton | `southampton-a100` | Ready | Ready | Medium | Ready |
| University of St Andrews | `st-andrews-a100` | Ready | Ready | Low | Ready |
| University of Sunderland | `sunderland-a100` | Ready | Ready | Low | Ready |

<!-- Legacy readiness assertion alias: | Liverpool | Ready | -->

- Completed production profiles: 33.
- Eligibility-ready profiles: 33.
- Interview-prediction-ready profiles: 31, with 2 eligibility-only production profiles.
- Completed result cards: 33.
- A live annual interview cutoff is not required when official eligibility rules, official interview-selection methodology, and sufficient historical admissions evidence support clearly labelled confidence bands or ApplySmart predictive estimates.
- Interview outputs use: `interview_likely`, `realistic`, `ambitious`, `high_risk`, `not_eligible`, or `insufficient_evidence`.
- Cardiff and Edinburgh contain official/FOI-verifiable selection formulae.
- Aston uses an official/FOI-verified GCSE + UCAT /36 combined pre-interview formula with three separate ranking pools (Home non-WP, Home WP, International UCAT-only); confidence is Limited as bands are conservative historical guidance and source document URLs are pending.
- Birmingham uses its official application-score formula for Home standard and contextual applicants, a separate UKWPMED guaranteed-interview override, and UCAT-ranking guidance for International and Graduate pools. The shared engine derives UCAT decile from the applicant's score, preferring university-specific data and otherwise using the global UCAT decile dataset. International non-academic review remains manual.
- Hull York uses a dedicated consumer so its official eligibility rules remain separate from a Limited-confidence ApplySmart estimate mode. HYMS publishes the 35-point GCSE, 35-point UCAT-decile, 15-point SJT and up-to-15-point contextual framework but not the exact tariffs. Every numerical HYMS score is labelled “Estimated HYMS selection score”, carries the mandatory unofficial third-party disclosure, and excludes contextual points for International, Graduate and prior-university applicants.
- Liverpool uses official route gates and four ranking pools. Its only numeric interview-band boundaries are the FOI-verified E2025 Home (1935), Contextual (1733) and International (2108) cutoffs; Graduate GAMSAT returns insufficient evidence after the official section gate.
- Lancaster uses academic and SJT gates followed by UCAT-only ranking in separate Home standard, verified Home contextual/WP and International pools. Published 2026-entry `/2700` thresholds are historical guidance only; legacy `/3600` values are not converted, and no unsupported strong-choice boundary is created.
- Aberdeen and Dundee use official rules and historical evidence with clearly labelled research/FOI models; their confidence remains Medium.
- Anglia Ruskin uses academic pass/fail gates, SJT Band 4 rejection, and adjusted UCAT ranking. WAMS (5%) may stack with one regional percentage uplift: Essex (5%) takes precedence over East of England (2.5%). No flat regional point values are used. Care-experienced/Care Leaver and Free School Meals guaranteed interviews apply only when academic and SJT conditions are met. International applicants are not eligible, and final MMI-only offers remain outside ApplySmart scope.
- St Andrews is complete for non-contextual Scottish/Home and Rest of UK A-level school-leavers only; non-executable hurdles require manual confirmation and its historical-normalised UCAT guidance remains Limited confidence.
- Manchester A100 is ApplySmart's internal standard-undergraduate portfolio identity for Manchester's MBChB course, whose official UCAS code remains A106 in source evidence and notes. Home standard, verified contextual/WP and International historical UCAT guidance is active at Medium confidence, with SJT Band 3/4 rejection and the MAP guaranteed-interview override applied before banding.
- Leicester A100 uses its official GCSE `/48` + UCAT `/48` (`/96` total) pre-interview formula for predicted and achieved A-level/IB applicants, reproducing Leicester's own published worked example exactly. SJT Band 4 is an automatic rejection, and the unpublished bottom-two-decile UCAT exclusion is approximated via the shared UCAT decile dataset. Home and Overseas applicants are ranked in separate pools using 2026-entry combined-score guidance thresholds, labelled Limited historical-trend confidence because only one year of directly comparable `/96`-scale data exists. Graduate and Access to Medicine eligibility gates are executable; their official numeric-ranking formulas and the achieved-route auto-interview and contextual/WP guaranteed-interview overrides (AL Med, ROP, Sutton Trust, restricted 2027 UKWPMED) are documented but remain manual-review boundaries because the shared generic engine does not support their exact combined-formula or override shapes.
- Nottingham A100 uses its official GCSE `/32` + UCAT cognitive `/40` + SJT `/10` formula. Eligible `/82` applicants receive Limited-confidence, guidance-only positioning against FOI historical ranges; no fixed threshold or deterministic outcome is claimed. SJT Band 4 excludes interview consideration, and applicants on the no-GCSE `/50` route are not banded.
- Queen Mary A100 uses official eligibility gates, official published selection methodology and official 2023-2025 historical admissions statistics. Supported Home and Overseas school-leaver applicants receive Medium-confidence ApplySmart historical-normalised estimates only; exact UCAT/Tariff weighting is not inferred as fact, contextual and graduate routes remain manual-review boundaries, and no estimate is presented as an official QMUL threshold.
- Sheffield A100 uses a sequential academic gate, a native-scale 1800/2700 UCAT minimum and separate Home and International UCAT guidance. GCSEs and post-16 grades are not scored after eligibility, SJT Bands 3–4 are not rejected at shortlisting, and verified Access to Sheffield Medicine/pathway applicants use threshold-only interview-likely guidance instead of ordinary UCAT ranking. Legacy `/3600` values are never converted into executable thresholds.
- A101 Graduate Entry remains reference-only and non-executable for A106. No executable A101 logic is implemented within A106. A101 UCAT thresholds, places and admissions rules are stored only as reference data.
- Edinburgh Assessment Day final-score evidence is retained as an optional research utility and does not contribute to production readiness.
- Completed result-card regression script: `scripts/test-completed-result-cards-regression.js`.
- Completed result-card regression covers all 32 completed production profiles.
- Completed result-card regression status: 32/32 passing.
- Course schema validation status: completed production profiles passing; older non-production seed profiles remain outside the completed-profile schema gate.
- Existing repo-wide migration warnings remain non-blocking.

## Generic Interview Band Engine

- `assets/js/engine/interview-band-classifier.js` applies shared academic/test hard filters and returns one canonical interview band.
- University thresholds, scoring components, pool selection and band margins live in `data/interview-band-configs/`.
- Future historical UCAT `/3600` evidence must opt into the shared conversion reference in `data/ucat-conversions.json`; native `/2700` UCAT rules bypass conversion.
- `data/schemas/interview-band-classification.schema.json` validates the data contract.
- `scripts/test-generic-interview-band-classifier.js` runs the shared arbitrary-profile fixture across the completed profiles covered by the generic classifier regression.
- See `docs/interview-band-classification-engine.md` for the extension contract.
- See `docs/historical-ucat-conversion.md` for the shared historical UCAT conversion contract.

## Applicant Groups

`data/applicant-groups.json` defines permitted applicant group IDs, categories, names, and meanings only. Applicant groups are not mutually exclusive; an applicant may be `england_domiciled`, `home_fee`, `contextual`, and `graduate_applicant` at the same time.

University JSON files define how those groups affect thresholds, quotas, ranking pools, and selection rules. New university rules should reference applicant groups with ID arrays such as `applicant_group_ids`, `applies_to_group_ids`, `required_group_ids`, or `excluded_group_ids`.

Existing university files still contain legacy `applicant_group` objects. Migrate them gradually when each course profile is reviewed; do not manually rewrite all profiles without validating the admissions rule being represented.

Run the applicant group validator with:

```sh
node scripts/validate-applicant-groups.js
```

## Subject Catalog

`data/subject-catalog.json` defines permitted subject IDs, display names, aliases, and categories only. Aliases are for input normalisation, so user-entered values such as `Maths`, `Math`, or `Bio` can map to canonical IDs such as `mathematics` or `biology`.

University-specific subject rules stay inside university course JSON files. For example, a course rule may require `chemistry`, or require one of `biology`, `physics`, or `mathematics`; those requirements should reference subject IDs from the catalog rather than free-text subject names.

Existing university files still contain legacy fields such as `required_subjects`, `mandatory_subjects`, and `accepted_subjects`. Migrate these gradually when each course profile is reviewed, replacing free-text subject names with ID-based fields such as `required_subject_ids`, `mandatory_subject_ids`, `accepted_subject_ids`, or `one_of_subject_ids`.

Run the subject catalog validator with:

```sh
node scripts/validate-subject-catalog.js
```
