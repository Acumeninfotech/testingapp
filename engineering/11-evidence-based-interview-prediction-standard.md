# Evidence-Based Interview Prediction Standard

## 1. Purpose

This standard defines how ApplySmart may produce interview predictions using official university evidence, historical admissions data, and clearly labelled ApplySmart predictive modelling when the exact university ranking formula is unpublished.

This is a platform-wide standard. It applies to every university profile and must not be treated as a university-specific exception.

ApplySmart is an evidence-based interview prediction engine, not just an admissions policy viewer. The product may estimate interview competitiveness where evidence supports a responsible prediction, but it must keep official university evidence, historical admissions evidence, and ApplySmart modelling distinct.

## 2. Core Principle

ApplySmart may predict interview competitiveness only from an auditable evidence chain. The evidence chain must show:

- which eligibility and selection rules are official university evidence;
- which observations are historical admissions evidence;
- which conclusions are ApplySmart predictive modelling;
- the confidence level assigned to the displayed assessment;
- the disclaimer shown to the applicant.

A prediction can be production ready even when the university does not publish the exact ranking formula or weighting, provided the allowed modelling conditions in this standard are met.

## 3. Evidence Hierarchy

ApplySmart must classify evidence into the following hierarchy.

### 1. Official University Evidence

Official university evidence includes current or attributable university, UCAS, UCAT, government, or university-confirmed FOI material that states eligibility rules, admissions-test treatment, interview-selection methodology, applicant-pool distinctions, guaranteed-interview routes, exclusions, quotas, or selection stages.

Official evidence controls executable university policy. ApplySmart must not invent, weaken, or replace official rules.

### 2. Historical Admissions Evidence

Historical admissions evidence includes cycle-labelled interview cutoffs, score ranges, invitation counts, applicant statistics, FOI responses, published admissions reports, and other retrospective data from acceptable sources.

Historical evidence is guidance. It may support a prediction, confidence level, or competitiveness band, but it must not be presented as a current official threshold unless the university explicitly publishes it as current policy.

### 3. ApplySmart Predictive Modelling

ApplySmart predictive modelling is the labelled estimate ApplySmart derives from official selection methodology plus historical admissions evidence when exact university formulae, tariffs, cutoffs, or weightings are unpublished.

ApplySmart modelling may describe likely historical competitiveness, relative positioning, or recommendation bands. It must not be described as the university's official formula, official score, official threshold, or guaranteed outcome.

## 4. Allowed Prediction Inputs

Interview predictions may use only inputs supported by the evidence pack and existing ApplySmart architecture, including:

- official eligibility gates;
- official applicant-pool rules;
- official admissions-test rules, including UCAT, SJT, GAMSAT, BMAT legacy evidence, or other accepted tests;
- official interview-selection methodology, such as scoring, ranking, sequential gates, contextual adjustment, or threshold-first selection;
- official or FOI-verifiable guaranteed-interview routes;
- cycle-labelled historical interview cutoffs, ranges, distributions, or invitation data;
- applicant statistics where denominators and pools are clear;
- ApplySmart-normalised historical guidance where the methodology is documented and labelled;
- evidence-confidence metadata and result-card decision transparency.

Do not use unsupported internet commentary, applicant anecdotes, synthetic thresholds, inferred hidden weights, or post-interview offer data as production interview-prediction inputs.

## 5. When ApplySmart Modelling Is Allowed

ApplySmart may estimate interview competitiveness when all of the following are true:

- eligibility rules are official;
- interview selection methodology is official;
- historical admissions data exists;
- the exact formula, tariff, cutoff, or weighting is unpublished;
- predictions are clearly labelled as ApplySmart estimates;
- the estimate can be explained from the evidence without inventing university policy;
- the result card distinguishes official evidence from ApplySmart modelling;
- the confidence level reflects evidence completeness and ambiguity.

If an official selection methodology is absent, historical data alone is not sufficient for an interview prediction. If historical evidence is absent, official methodology alone may support a selection-model explanation but not a historical competitiveness estimate.

## 6. Confidence Framework

Every prediction must use the shared evidence-confidence levels defined in [08-evidence-confidence-standard.md](08-evidence-confidence-standard.md):

- `High`
- `Medium`
- `Limited`

Confidence describes the reliability and completeness of the evidence supporting the displayed assessment. It is not the applicant's chance of interview.

ApplySmart modelling usually reduces confidence unless the official methodology and historical evidence are strong enough to make the estimate reproducible and low ambiguity. Manual review, missing route-specific evidence, or unsupported applicant pools must return `Limited`.

## 7. Required Result-Card Wording

Every prediction must include:

- evidence basis;
- confidence level;
- official evidence versus ApplySmart modelling distinction;
- clear disclaimer.

Required wording, or wording with the same meaning, must appear for modelled interview estimates:

> Based on the university's published selection methodology and historical admissions data, ApplySmart estimates that this profile would have been historically competitive for interview. This is an ApplySmart predictive estimate, not an official university threshold or guarantee of interview.

Result cards must avoid deterministic language. Historical competitiveness may be described as guidance, estimate, positioning, or comparison, but not as an entitlement or guaranteed invitation.

## 8. Production Readiness Impact

A university may be production ready for interview prediction when:

- official eligibility rules are executable for the declared supported scope;
- official interview-selection methodology is known;
- sufficient historical admissions evidence supports labelled guidance;
- ApplySmart modelling, if used, is explicitly documented and disclosed;
- result-card wording meets this standard;
- evidence confidence and decision transparency are consistent across artifacts;
- regression confirms supported, manual-review, insufficient-evidence, and not-eligible paths.

The absence of an exact unpublished formula does not automatically block production readiness. The absence of official selection methodology, historical evidence, or safe disclosure does block production readiness for the affected prediction scope.

## 9. Prohibited Behaviour

ApplySmart must never:

- invent university policy;
- present estimates as official thresholds;
- guarantee interviews;
- guarantee offers;
- infer hidden weighting as fact;
- convert historical observations into future requirements;
- mix applicant pools without evidence;
- reuse Home guidance for International, contextual, graduate, or other routes without route-specific support;
- imply evidence confidence is applicant probability;
- use offer-stage or post-interview evidence to support pre-interview prediction.

## 10. Relationship to Frozen Engine v1.0

This standard operates inside the frozen ApplySmart Engine v1.0 architecture. It does not authorize schema redesign, engine changes, new result-card precedence, or university-specific exceptions.

Future universities must use the existing production JSON, research JSON, interview-band configuration, evidence confidence, decision transparency, decision timeline, readiness metadata, and regression contracts unless an approved architecture change is obtained under [01-architecture-freeze.md](01-architecture-freeze.md).

ApplySmart modelling is a permitted prediction layer only when it is represented through existing architecture and labelled in user-facing output. It must not bypass official eligibility rules, manual-review boundaries, insufficient-evidence states, or result-card precedence.

## 11. Audit Requirements

Every university implementation or readiness audit must verify:

- official eligibility evidence is cited and mapped;
- official interview-selection methodology is cited and mapped;
- historical admissions evidence is cycle-labelled and pool-specific;
- all modelled estimates are labelled as ApplySmart predictive estimates;
- result cards distinguish official evidence from ApplySmart modelling;
- confidence level follows the shared evidence-confidence standard;
- disclaimers are visible for historical or modelled predictions;
- unsupported routes return manual review, insufficient evidence, disabled feature, or out-of-scope states instead of guessed predictions;
- dedicated regression asserts the prediction wording and confidence for representative supported routes;
- production readiness notes identify whether the interview prediction uses official formulae, historical guidance, ApplySmart modelling, or a combination.

Audit findings must be recorded as evidence gaps when any required part of the evidence chain is missing, ambiguous, or not route-specific.
