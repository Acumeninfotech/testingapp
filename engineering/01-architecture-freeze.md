# ApplySmart Architecture Freeze

## Status

ApplySmart architecture is frozen. The first 11 completed universities are the reference implementation for all future university work.

ApplySmart is an eligibility and interview prediction engine only. Offer prediction is out of scope. Post-interview information may be retained as optional research notes, but it must not affect production readiness or appear as a core product capability.

## Frozen production baseline

Future work is university implementation only. Every new university must fit the existing production architecture and reuse its established contracts.

Do not redesign:

- schemas;
- production JSON;
- research JSON;
- result cards;
- readiness metadata;
- decision transparency;
- evidence confidence;
- decision timeline;
- regression architecture.

The existing engine, templates, schemas, completed university profiles, result-card behavior, and regression framework define the production baseline.

## Change control

Do not modify an existing university except to:

- fix a verified bug;
- correct official admissions evidence;
- improve user-facing wording without changing behavior; or
- maintain compatibility with the frozen architecture.

If a university genuinely cannot be represented by the current architecture:

1. Stop before changing the architecture.
2. Explain precisely why the existing model is insufficient.
3. Identify the smallest extension that would represent the official rule.
4. Describe the compatibility and regression impact.
5. Obtain explicit approval before implementation.

Any engine or architectural change requires explicit approval. Lack of evidence is recorded as a gap; it is never a reason to guess or silently redesign the engine.
