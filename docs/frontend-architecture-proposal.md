# ApplySmart Frontend — Architecture Proposal (for review)

Status: **DRAFT — awaiting sign-off before implementation.**
Scope: user-facing web frontend only. No changes to `data/`, `engineering/`, or `assets/js/engine/*` business logic.

---

## 1. Grounding: what the backend actually gives us

- **87 course profiles** live in `data/universities/*.json`, indexed by `data/index.json`. Only **17** currently carry the full readiness flag bundle (`activation_ready: true`, `eligibility_ready: true`, `interview_prediction_ready: true`, `result_card_ready: true`, `interview_band_config_ready: true`). The other ~70 are catalogue/seed entries with none of those flags — these must never be shown to users.
- **No API layer exists.** The engine (`assets/js/engine/*.js`) is CommonJS Node code — `evaluateCourseEligibility()`, `classifyInterviewBand()`, `presentResultCard()` — callable only from Node, not a browser. A thin API service is a required new component, not optional.
- **Engine output is already a fully-designed result-card JSON** (`data/schemas/result-card.schema.json`, real examples in `data/examples/*.example.json`). The frontend's job is to *render* this shape, not invent its own result model.
- **Required input is not uniform across universities** — it's the union of everything any active course's `stage_1_eligibility`/`stage_2_interview_selection` sections read, which in practice equals `data/templates/student-profile-template.json` plus several extra keys the engine actually consumes (`applicant_group_ids`, `international_qualification`, `btec_profile`, `access_to_medicine_profile`, `ukwpmed`, `deferred_entry_profile`, `repeat_application`, `english_language_profile`).
- **Architecture is frozen** (`engineering/01-architecture-freeze.md`) — the frontend must treat `data/` + engine as a read-only contract and adapt to it, never fork logic into the client.

This proposal is built strictly on those constraints.

---

## 2. High-level architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐        ┌─────────────────────┐
│   Frontend (React + Vite)   │  HTTP  │   API layer (new, thin)       │  fn    │  Engine (unchanged) │
│   Wizard · Results · Cards  │ ─────► │   Node/Express or serverless  │ ─────► │  assets/js/engine/*  │
│                              │ ◄───── │   - GET /universities         │ ◄───── │  data/*.json         │
└─────────────────────────────┘  JSON  │   - POST /predict              │        └─────────────────────┘
                                        └──────────────────────────────┘
```

**Why an API layer instead of bundling the engine into the browser:** the engine reads dozens of JSON files off disk by relative path (`data/universities/*.json`, `data/interview-band-configs/*.json`, `data/ucat-deciles.json`, etc.) and is written as CommonJS. Re-implementing that file resolution in-browser (webpack JSON imports of 87+ files, keeping them in sync) duplicates the one thing we're required not to duplicate: which data is "current." A server process that requires the existing modules unmodified is the only way to guarantee the frontend and engine never drift. This also naturally enforces the production-ready filter server-side, so an inactive university can never leak into a client bundle.

**API surface (minimal, engine-shaped, not bespoke):**
- `GET /api/universities` → filtered, derived-from-`index.json` list of the 17 production-ready courses (id, name, course, campus, country, fee statuses, confidence, manual-review flag). Filter logic = one predicate (all four readiness flags true), computed at request time so newly-activated universities appear automatically with zero frontend deploys.
- `GET /api/universities/:id/requirements` → derived field-requirement descriptor for one course (see §5) — used to drive which wizard steps/fields are shown/required for that course, without hardcoding per-university branches in the frontend.
- `POST /api/predict` → body: `{ universityIds: string[], studentProfile }` → runs `evaluateCourseEligibility` + `classifyInterviewBand` + `presentResultCard` per requested university, returns an array of result-card objects (the existing schema, untouched) plus per-university echo of readiness/confidence.
- `GET /api/schema/student-profile` → serves the canonical field list (see §5) so the frontend's form model has one source of truth instead of a hand-maintained duplicate.

No new business rules are computed here — this layer is transport + filtering + fan-out, nothing else.

---

## 3. Frontend tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | React + TypeScript, Vite | Fast dev server, wide accessibility/component ecosystem, easy static hosting |
| Routing | React Router | Wizard steps as routes (deep-linkable, back-button-safe) |
| Forms/validation | React Hook Form + Zod | Schema-driven validation matches the backend's JSON-Schema-driven philosophy; Zod schema can be generated from the same field-requirement descriptor the API serves |
| Styling | Tailwind CSS + Radix UI primitives (unstyled, accessible) | Accessibility (focus management, ARIA) comes largely free from Radix; Tailwind keeps responsive/mobile-first work fast |
| State | React Query (server cache: universities, requirements) + local wizard state (Context or Zustand) | Clean separation between server-derived data and in-progress form state |
| Testing | Vitest + React Testing Library (unit/component), Playwright (E2E regression against the API layer) | Matches Node-based tooling already used in `scripts/` |

---

## 4. Route structure

```
/                          Landing — value prop, "Start your assessment" CTA
/assessment                Wizard shell (nested step routes, guarded: can't jump ahead of completed steps)
  /assessment/identity          Step 1: fee status, domicile, applicant type, contextual/WP flags
  /assessment/route             Step 2: qualification route selector (A-level / IB / Scottish / BTEC / Access / Graduate / International)
  /assessment/academic           Step 3: GCSE + route-specific academic subjects (dynamic per Step 2 choice)
  /assessment/tests              Step 4: UCAT / SJT / GAMSAT (shown only if relevant to any selected university)
  /assessment/supplementary       Step 5: English language evidence, resits, deferred entry, graduate degree detail — shown only if applicable
  /assessment/universities       Step 6: choose which production-ready universities to evaluate against (multi-select, searchable, all sourced from GET /api/universities)
  /assessment/review              Step 7: summary + edit-any-step affordance before submit
/results/:submissionId      Results — one card per selected university, filterable/sortable
/results/:submissionId/:universityId   Deep-dive detail view for a single result card
/about, /privacy            Static informational pages
```

Wizard steps are **field-driven, not university-driven** — there is no `/assessment/leicester` or per-university step. A step is shown only if at least one selected/eligible-in-scope university's requirement descriptor asks for that data (see §5), which is how new universities activate without adding routes.

---

## 5. Deriving required fields dynamically (no hardcoded per-university logic)

The proposal avoids "if university === X show field Y" by introducing one small derived artifact, computed by the API layer purely from existing schema/data — **no new business rules, just aggregation**:

```
GET /api/schema/student-profile  →  FieldRequirementDescriptor[]
```

Each entry:
```json
{
  "fieldPath": "admissions_tests.ucat.subtests.decision_making",
  "section": "admissions_tests",
  "requiredByUniversityIds": ["leicester-a100", "qmul-a100", "aston-a100", "..."],
  "conditionallyRelevant": true
}
```

This is built by a small (documented, reviewable) script that walks all 17 active `data/universities/*.json` files' `stage_1_eligibility` / `stage_2_interview_selection.calculation.score_components` blocks plus `data/templates/student-profile-template.json`, and records which declarative field references (`required_subject_ids`, `admissions_tests.ucat.*`, `english_language`, component `type`s like `ucat_range_lookup` → implies UCAT subtests, `gcse_mandatory_then_best` → implies specific GCSE subjects) are actually referenced anywhere. It is **generated from data, not maintained by hand** — re-running it after a new university activates is how the union grows automatically. This script is the only new piece of "logic," and it only inspects/aggregates field *names*, never evaluates admissions rules.

The wizard then:
1. On entering `/assessment/universities` (or as soon as the student picks candidate universities, which can happen early via a lightweight "which are you interested in?" pre-step), fetches the descriptor set for the selected universities' union.
2. Shows/hides/mark-required wizard fields based on that union (e.g. Scottish Highers fields only appear if the student is UK-domiciled and picks the Scottish route; UCAT subtests only appear because ≥1 selected university's config references `ucat_range_lookup`/`ucat_national_decile_lookup`).
3. Falls back to the **maximal field set** (full union across all 17 active universities) if the student chooses "show me everything I might be eligible for" / hasn't yet narrowed universities — since capturing the superset up front is explicitly the ask ("union of all required admissions fields").

This gives one wizard that scales as more universities activate (the union just grows) without structural UI changes, and keeps all admissions-relevant logic (what counts as "required") sourced from `data/`, never duplicated in frontend code.

---

## 6. Student profile field matrix (proposed wizard coverage)

Derived from `data/templates/student-profile-template.json` + the engine's actually-consumed keys (per Explore agent's findings, cross-checked against `eligibility-evaluator.js`/`interview-band-classifier.js` field reads) + the Leicester/QMUL mapping docs' concrete requirements.

| Wizard step | Field group | Fields | Always shown? |
|---|---|---|---|
| Identity | Applicant identity | fee_status, domicile, applicant_type (school-leaver/graduate/mature), contextual flag + sub-flags (SIMD20/40, POLAR quintile, IMD quintile, free school meals, first-gen HE, care-experienced, refugee/asylum seeker, UCAT bursary, school contextual indicator) | Yes (fee status/domicile always; contextual sub-flags shown if `contextual: true`) |
| Route | Course target | discipline, UCAS code, course_route, entry_route (standard/gateway/graduate) | Yes |
| Route | Qualification route selector | one of: A-level / IB / Scottish / BTEC / Access to HE / Graduate-entry / International qualification | Yes |
| Academic | GCSE profile | subject grades: English Language, English Literature, Mathematics, Biology, Chemistry, Physics, Combined Science; additional subjects; top-8/top-9 grade lists | Yes (near-universal requirement) |
| Academic | A-level profile | per-subject predicted + achieved grade, sitting status, practical endorsement pass/fail, subject flags (chem/bio/maths/physics) | If route = A-level |
| Academic | Scottish qualifications | National 5s, Highers, Advanced Highers | If route = Scottish |
| Academic | IB profile | total points, HL subjects, SL subjects | If route = IB |
| Academic | BTEC profile | grades, unit breakdown (per `btec_profile`) | If route = BTEC |
| Academic | Access to HE profile | per `access_to_medicine_profile` | If route = Access |
| Academic | Graduate profile | degree classification, degree subject, science-degree flag, chemistry-requirement evidence | If applicant_type = graduate or route = graduate-entry |
| Academic | International qualification | per `international_qualification` | If domicile = international / non-UK quals |
| Tests | UCAT | total score, score scale (2700), 3 subtests (verbal/decision/quantitative reasoning), SJT band | If any selected university's config references UCAT |
| Tests | GAMSAT | overall score, section scores | If any selected university's config references GAMSAT (graduate routes) |
| Supplementary | English language evidence | test name (IELTS/other), overall + 4 component scores | If domicile = international or route = international qualification |
| Supplementary | Resits | has_resits, exceptional circumstances evidence, subjects resat | Always asked, low friction |
| Supplementary | Deferred entry / repeat application | flags per `deferred_entry_profile`, `repeat_application` | Always asked, low friction |
| Supplementary | UK widening participation (UKWPMed) etc. | per `ukwpmed` | If contextual = true and relevant route |
| Universities | Selection | multi-select from `GET /api/universities` (production-ready only) | Yes |

All fields map 1:1 to keys already defined in `data/templates/student-profile-template.json` or read by the engine — nothing here is invented; it's a UI organization of the existing contract.

---

## 7. Component hierarchy

```
<App>
 ├─ <AppShell>                          layout, nav, skip-links, theme
 │   ├─ <LandingPage>
 │   └─ <AssessmentWizard>
 │       ├─ <WizardProgress>            step indicator, ARIA live region for step changes
 │       ├─ <WizardStepRouter>          renders active step by route
 │       │   ├─ <IdentityStep>
 │       │   ├─ <RouteSelectionStep>
 │       │   ├─ <AcademicStep>          composes sub-forms conditionally:
 │       │   │   ├─ <GcseSubjectGrid>
 │       │   │   ├─ <ALevelSubjectList>
 │       │   │   ├─ <ScottishQualsForm>
 │       │   │   ├─ <IbProfileForm>
 │       │   │   ├─ <BtecProfileForm>
 │       │   │   ├─ <AccessToHeForm>
 │       │   │   ├─ <GraduateProfileForm>
 │       │   │   └─ <InternationalQualificationForm>
 │       │   ├─ <AdmissionsTestsStep>   <UcatForm>, <GamsatForm>
 │       │   ├─ <SupplementaryStep>     <EnglishLanguageForm>, <ResitForm>, <DeferredEntryForm>
 │       │   ├─ <UniversitySelectionStep>
 │       │   │   └─ <UniversityPicker>  search/filter over GET /api/universities
 │       │   └─ <ReviewStep>            read-only summary, per-section "Edit" links
 │       └─ <WizardNav>                 Back/Next, disabled until step valid
 │
 ├─ <ResultsPage>
 │   ├─ <ResultsSummaryBar>             counts: interview_likely / realistic / ambitious / high_risk / manual_review
 │   ├─ <UniversityResultCard>  × N     one per submitted university
 │   │   ├─ <ConfidenceBadge>           high/medium/low, evidence-basis tooltip
 │   │   ├─ <BandIndicator>             canonical_interview_band, color+icon coded
 │   │   ├─ <ExplanationPanel>          primary_explanation, historical_guidance_caveat
 │   │   ├─ <ManualReviewNotice>        shown iff manual_review_required
 │   │   └─ <DecisionTimeline>          renders decision_timeline steps
 │   └─ <ResultCardDetailView>          full decision_transparency + evidence breakdown, routed at /results/:id/:universityId
 │
 ├─ <SharedUI>                          Button, Select, Combobox, RadioGroup, Stepper, Toast, Skeletons, ErrorBoundary
 └─ <ErrorStates>                       <ApiErrorPanel>, <ValidationSummary>, <NoUniversitiesEligibleState>
```

Key design point: **`<UniversityResultCard>` and `<UniversityPicker>` are the only two components that render per-university data**, and both are driven entirely by API responses (no per-university component variants, no switch-on-id anywhere in the tree). Adding university #18 requires zero frontend code changes — it appears in the picker and produces a result card automatically once its readiness flags flip true in `data/index.json`.

---

## 8. Results presentation (mapping to engine output)

Each `<UniversityResultCard>` renders directly from one result-card JSON object, field-for-field:

- **Headline / recommendation** ← `display.headline`, `display.primary_user_facing_recommendation`, `display.recommendation_display_state`
- **Band** ← `prediction.result_band` (`interview_likely | realistic | ambitious | high_risk | not_eligible | insufficient_evidence`), with a fixed color/icon mapping (never a per-university mapping)
- **Confidence** ← `confidence`, `evidence_confidence` (evidence-basis tooltip explaining *why* confidence is high/medium/low — required per `engineering/08-evidence-confidence-standard.md`)
- **Manual review flag** ← `eligibility.status === 'manual_review'` or `readiness.manual_review_required` → renders a distinct, non-dismissible notice, never silently folded into a pass/fail badge
- **Explanation** ← `display.primary_explanation`, `display.historical_guidance_caveat`, `decision_transparency.key_reasons`
- **Timeline** ← `decision_timeline` (fixed 5-step structure per spec)
- **Eligibility detail** ← `eligibility.stage_1_checks`, `eligibility.blocking_reasons`, `eligibility.warnings`

No result field is computed or reinterpreted client-side — the frontend is a presentation layer over `docs/result-card-ux-mapping.md`, which already defines this mapping; the proposal is to implement that spec rather than re-derive it.

---

## 9. Validation, loading, error handling

- **Validation**: Zod schemas generated from the `FieldRequirementDescriptor` (§5) — required-ness, grade format, numeric ranges (UCAT 300–3600 total, subtests 300–900, SJT band 1–4) validated client-side before submit; server re-validates (never trust client) and returns structured 422s the wizard maps back to the offending step/field.
- **Loading states**: skeleton screens for `<UniversityPicker>` (server list) and `<ResultsPage>` (prediction fan-out, which may take a moment across many universities) — results stream in / render progressively per university rather than blocking on the slowest one.
- **Error handling**: `<ApiErrorPanel>` for transport failures with retry; per-university partial failure (one university's engine call throws) must not blank the whole results page — that card shows an isolated error state while others render normally.
- **Empty states**: "no production-ready universities match your criteria yet" (rare, but must be handled since the whole point is dynamic scaling as universities activate).

---

## 10. Testing / regression strategy

- **Unit**: Vitest for form validation logic, field-requirement-union derivation, band→color/icon mapping.
- **Component**: React Testing Library for each wizard step (conditional field show/hide logic) and `<UniversityResultCard>` rendered against each of the 17 real `data/examples/*.example.json` fixtures — this directly reuses existing backend fixtures as frontend regression fixtures, so a schema change to result-cards fails frontend tests immediately.
- **Contract test**: a CI check that re-derives the `FieldRequirementDescriptor` set from current `data/` and diffs it against the frontend's last-known Zod schema — fails the build if backend data drifted from what the frontend expects, catching silent contract breaks early.
- **E2E** (Playwright): full wizard-to-results flow against a running API layer + the real 17 active universities, plus the 15 existing regression applicant profiles (`data/regression-profiles/`) run end-to-end through the UI to confirm rendered bands match `data/regression-results/`.
- **Accessibility**: axe-core automated checks per step + manual keyboard-only and screen-reader pass on the wizard and results cards before ship.

---

## 11. Open questions for you before implementation starts

1. **API layer hosting**: standalone Node/Express service, or serverless functions (Vercel/Netlify/AWS Lambda) wrapping the engine? Affects deployment story.
2. **Auth/persistence**: is this anonymous/stateless (submit → get results, no accounts), or do we need saved profiles / result history per user?
3. **"Show me everything" vs progressive narrowing**: should the wizard ask "which universities are you interested in" early (narrows fields fast, more clicks) or run the maximal field union always and let students multi-select at the end (fewer decisions, longer form)?
4. **Confidence-language tone**: `prediction_confidence: "low"` appears on several ready universities — do you want a plain-language framing pass reviewed against `engineering/07-decision-transparency-standard.md` before these strings hit real students, or is `display.primary_explanation` already final?

Once these are resolved, next step would be scaffolding the Vite/React project, the API layer, and the field-requirement-descriptor generator script — happy to start with whichever slice you want first (e.g. API layer + one wizard step + one result card end-to-end, as a walking skeleton).
