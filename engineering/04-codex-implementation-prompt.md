# Reusable Codex University Implementation Prompt

Replace the bracketed values, attach the completed research pack, and use this prompt for each future university.

```text
Implement [UNIVERSITY] [COURSE/CODE] for [ENTRY CYCLE] in ApplySmart.

Architecture and scope

- Use the existing frozen ApplySmart architecture.
- ApplySmart is an eligibility and interview prediction engine only.
- ApplySmart is an evidence-based interview prediction engine, not just an
  admissions policy viewer.
- Do not redesign schemas, production JSON, research JSON, result cards,
  readiness metadata, decision transparency, evidence confidence, decision
  timeline, interview-band configuration, or regression architecture.
- Do not change the engine.
- Do not change existing universities.
- Implement only the new university.
- Do not add offer prediction. Post-interview information may be retained only
  as clearly labelled, non-core research notes.
- Use historical information as guidance, never as a guaranteed outcome.
- When exact university formulae or weightings are unpublished, use ApplySmart
  predictive modelling only if official eligibility rules, official selection
  methodology, and historical admissions evidence support it. Label every such
  output as an ApplySmart estimate, not an official threshold.

Evidence rules

- Implement only rules supported by the supplied official or attributable FOI
  evidence.
- Separate official university evidence, historical admissions evidence, and
  ApplySmart predictive modelling.
- Preserve entry-cycle and applicant-pool distinctions.
- Record unresolved or conflicting evidence as gaps; do not guess.
- Do not infer hidden weighting as fact, present estimates as official
  thresholds, or guarantee interviews or offers.
- Use manual review or insufficient evidence where the frozen architecture
  requires it.
- If an official rule genuinely cannot be represented, stop before changing
  the architecture. Explain the limitation, identify the minimum extension,
  and wait for explicit approval.

Implementation

Create or update only what is required for this university:

- research JSON;
- production JSON;
- interview-band configuration;
- result-card example;
- regression fixtures;
- dedicated university regression script;
- index entry;
- readiness metadata.

Reuse the existing structures and conventions from the 11 reference
universities. Include the standard decision transparency, evidence confidence,
and exactly five-step decision timeline. Preserve result-card precedence:
not eligible, manual review, and insufficient evidence must override positive
recommendation bands as defined by the existing engine.

Validation

Run:

- JSON validation;
- course schema validation;
- research schema validation;
- interview-band schema validation;
- result-card schema validation;
- dedicated university regression;
- completed result-card regression;
- decision transparency regression;
- evidence confidence regression;
- decision timeline regression;
- full regression matrix;
- completed-profile standardisation drift check;
- the full regression suite.

Do not activate the university unless every required check passes and its
supported scope is production ready.

Output only:

- Files changed
- University implementation summary
- Evidence gaps
- Regression results
- Production readiness status
```
