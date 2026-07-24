# ApplySmart Engineering Playbook

This playbook is the controlling workflow for future university implementations.

## Current baseline

- 11 completed universities
- ApplySmart Engine v1.0
- Eligibility and interview prediction only
- Architecture frozen
- Offer prediction out of scope

The first 11 completed universities, current schemas, templates, shared engine, result-card behavior, readiness metadata, and regression suite form the reference implementation.

## Master workflow

### Step 1: Complete university research

The research team completes the [University Onboarding Standard](02-university-onboarding-standard.md) and [Research Team Checklist](03-research-team-checklist.md). Every finding is tied to an entry cycle, applicant pool, and acceptable source.

### Step 2: Review evidence gaps

Review the evidence pack before implementation. Separate official university evidence from historical admissions evidence and any proposed ApplySmart predictive modelling under the [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md). Resolve conflicts where possible, and identify unsupported routes, manual-review requirements, missing interview evidence, and any prediction scope that cannot be safely labelled.

### Step 3: Implement within the frozen architecture

Codex uses the [Reusable Codex University Implementation Prompt](04-codex-implementation-prompt.md) and changes only the new university's artifacts. The implementation reuses all existing structures for production data, research, interview bands, result cards, transparency, confidence, timeline, readiness, and regression.

### Step 4: Run regression and validation

Run every check in the [Regression Standard](05-regression-standard.md), including JSON and schema validation, the dedicated university regression, cross-university result-card protections, the full regression matrix, the standardisation drift check, and the complete regression suite.

### Step 5: Run the production readiness audit

Audit the new university against the [Production Readiness Standard](06-production-readiness-standard.md) and [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md). Reconcile research, production, index, result-card, prediction-labelling, and regression metadata before assigning the status.

### Step 6: Activate only when production ready

Add or enable the production index activation only when every applicable readiness requirement passes. A failing required check, missing core interview evidence, or unresolved material inconsistency blocks activation.

### Step 7: Record missing evidence

Record missing, ambiguous, or conflicting evidence as an explicit gap. Do not guess, extrapolate between applicant pools, infer hidden weighting as fact, or convert historical observations into guaranteed future outcomes.

### Step 8: Obtain approval for architecture changes

If the university cannot be represented faithfully, stop. Explain why, propose the minimum extension and its compatibility impact, and wait for explicit approval before changing any engine or architecture contract.

## Governing standards

- [Architecture Freeze](01-architecture-freeze.md)
- [University Onboarding Standard](02-university-onboarding-standard.md)
- [Research Team Checklist](03-research-team-checklist.md)
- [Reusable Codex University Implementation Prompt](04-codex-implementation-prompt.md)
- [Regression Standard](05-regression-standard.md)
- [Production Readiness Standard](06-production-readiness-standard.md)
- [Decision Transparency Standard](07-decision-transparency-standard.md)
- [Evidence Confidence Standard](08-evidence-confidence-standard.md)
- [Decision Timeline Standard](09-decision-timeline-standard.md)
- [Evidence-Based Interview Prediction Standard](11-evidence-based-interview-prediction-standard.md)

Where official evidence conflicts with a proposed implementation, evidence controls the university rule but does not automatically authorize an architectural change. The architecture-freeze approval process still applies.
