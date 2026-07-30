#!/usr/bin/env node

const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/app');
const { loadIndex, isProductionReady, INDEX_PATH } = require('../src/universities');
const {
  classifyInterviewBand,
  deriveApplicantGroupIds: deriveClassifierApplicantGroupIds
} = require('../../assets/js/engine/interview-band-classifier');
const {
  deriveApplicantGroupIds: deriveEligibilityApplicantGroupIds
} = require('../../assets/js/engine/eligibility-evaluator');

const path = require('path');
const rootDir = path.resolve(__dirname, '..', '..');
const strongApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '01_strong_standard_applicant.json'));
const topTierApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '16_top_tier_applicant.json'));
const graduateApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '15_graduate_applicant.json'));
const internationalApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '12_international_standard_applicant.json'));
const scottishHomeApplicant = require(path.join(rootDir, 'data', 'regression-profiles', '13_scottish_home_applicant.json'));
const exeterFixture = require(path.join(rootDir, 'data', 'fixtures', 'interview-band-classification', 'exeter-a100.json'));
const kmmsFixture = require(path.join(rootDir, 'data', 'fixtures', 'interview-band-classification', 'kent-and-medway-a100.json'));
const keeleCourse = require(path.join(rootDir, 'data', 'universities', 'keele-a100.json'));
const keeleConfig = require(path.join(rootDir, 'data', 'interview-band-configs', 'keele-a100.json'));

const FORBIDDEN_APPLICANT_FACING_PATTERNS = [
  /activation-ready/i,
  /production scope/i,
  /documented evidence gap/i,
  /automation gap/i,
  /known unknown/i,
  /blocking_missing_fields/i,
  /engine_notes/i,
  /source_traceability/i,
  /consumer\./i,
  /stage_1_eligibility\./i,
  /stage_2_interview_selection\./i,
  /offer_selection\./i,
  /\bschema\b/i,
  /\bmetadata\b/i
];
const FORBIDDEN_CONFIDENCE_AND_REVIEW_PATTERNS = [
  /Low prediction confidence/i,
  /Confidence:\s*(Low|Medium|High|Limited)/i,
  /Low-confidence prediction/i,
  /Prediction reliability:\s*(Low|Medium|High|Limited)/i,
  /Manual review required/i
];
const NEUTRAL_HISTORICAL_LIMITATION =
  /Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview\./i;

function collectApplicantFacingCardText(card) {
  const text = [
    card.primary_user_facing_recommendation,
    card.primary_explanation,
    card.historical_guidance_caveat,
    card.evidence_confidence?.level,
    card.evidence_confidence?.summary
  ];
  const transparency = card.decision_transparency || {};

  for (const stage of transparency.decision_path || []) {
    text.push(stage.stage, stage.status, stage.summary);
    for (const check of stage.checks || []) {
      text.push(check.label, check.status, check.summary);
    }
  }

  const breakdown = transparency.score_breakdown;
  if (breakdown) {
    text.push(breakdown.name, breakdown.status, breakdown.explanation, breakdown.reason);
    for (const check of breakdown.checks || []) {
      text.push(check.label, check.status, check.summary);
    }
  }

  text.push(
    transparency.manual_review_reason,
    transparency.insufficient_evidence_reason
  );

  return text.filter(Boolean).join('\n');
}

function assertNoApplicantFacingDiagnostics(result) {
  const card = result.result_card;
  const publicWarnings = card.decision_transparency?.warnings || [];
  assert.deepStrictEqual(
    publicWarnings,
    [],
    `${result.universityId} must not expose raw internal warnings as public decision_transparency.warnings`
  );

  const applicantFacingText = collectApplicantFacingCardText(card);
  for (const pattern of FORBIDDEN_APPLICANT_FACING_PATTERNS) {
    assert.doesNotMatch(
      applicantFacingText,
      pattern,
      `${result.universityId} applicant-facing result-card text leaked internal wording matching ${pattern}: ${applicantFacingText}`
    );
  }

  if (card.recommendation_display_state === 'standard') {
    for (const pattern of FORBIDDEN_CONFIDENCE_AND_REVIEW_PATTERNS) {
      assert.doesNotMatch(
        applicantFacingText,
        pattern,
        `${result.universityId} standard result-card text leaked confidence/manual-review wording matching ${pattern}: ${applicantFacingText}`
      );
    }
  }
}

// Universities whose stage_1_eligibility.gcse.minimum_count (or
// minimum_count_at_or_above_grade.count) is 6 or higher — before the wizard
// collected more than 5 GCSEs, any real applicant with more GCSEs than
// entered would auto-fail these purely on missing data, regardless of
// strength (see data/universities/*.json and the GCSE intake fix).
const GCSE_COUNT_SENSITIVE_UNIVERSITY_IDS = [
  'aston-a100',
  'cardiff-a100',
  'hull-york-a100',
  'lancaster-a100',
  'liverpool-a100',
  'manchester-a100',
  'nottingham-a100',
  'queen-mary-a100'
];
const SCOTTISH_MEDICAL_SCHOOL_IDS = [
  'aberdeen-a100',
  'dundee-a100',
  'edinburgh-a100',
  'glasgow-a100'
];

function requestJson(server, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(responseBody) });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function listenLocalhost(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.on('listening', () => resolve(server));
    server.on('error', reject);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (Array.isArray(overrides) || overrides === null || typeof overrides !== 'object') {
    return clone(overrides);
  }

  const result = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

function routingProfile({ feeStatus, domicile }) {
  return merge(topTierApplicant, {
    profile_id: `routing_${feeStatus}_${domicile}`,
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: feeStatus,
      domicile,
      contextual: false,
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    course_target: {
      discipline: 'medicine',
      ucas_code: 'A100',
      course_route: 'standard',
      entry_route: 'standard_medicine_a100'
    },
    application_year: 2027
  });
}

function loadCourseAndConfig(id) {
  return {
    course: require(path.join(rootDir, 'data', 'universities', `${id}.json`)),
    config: require(path.join(rootDir, 'data', 'interview-band-configs', `${id}.json`))
  };
}

async function main() {
  const app = createApp();
  const server = await listenLocalhost(app);

  try {
    // Pick readiness-bundle-ready universities directly from data/index.json —
    // no hardcoded ids. Includes the two special-cased consumers (Nottingham,
    // Hull York) plus a generic one (Keele), if present in the ready set.
    const readyEntries = loadIndex(INDEX_PATH).universities.filter(isProductionReady);
    assert.ok(readyEntries.length > 0, 'expected at least one readiness-bundle-ready university fixture');

    const genericEntry = readyEntries.find(
      (u) => u.id !== 'nottingham-a100' && u.id !== 'hull-york-a100'
    );
    assert.ok(genericEntry, 'expected at least one generic (non-special-cased) ready university');

    const response = await requestJson(server, 'POST', '/api/predict', {
      universityIds: [genericEntry.id],
      studentProfile: strongApplicant
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.json.results.length, 1);
    assert.strictEqual(response.json.results[0].universityId, genericEntry.id);
    assert.ok(response.json.results[0].result_card);
    assert.ok(
      typeof response.json.results[0].result_card.primary_user_facing_recommendation === 'string'
    );
    console.log(`PASS: POST /api/predict returns a result card for ${genericEntry.id}`);

    for (const specialId of ['nottingham-a100', 'hull-york-a100']) {
      const isReady = readyEntries.some((u) => u.id === specialId);
      if (!isReady) continue;
      const specialResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: [specialId],
        studentProfile: strongApplicant
      });
      assert.strictEqual(specialResponse.status, 200);
      assert.ok(specialResponse.json.results[0].result_card.recommendation_display_state);
      console.log(`PASS: POST /api/predict handles special-cased consumer ${specialId}`);
    }

    // Multiple universityIds in one request.
    const multiIds = readyEntries.slice(0, Math.min(3, readyEntries.length)).map((u) => u.id);
    const multiResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: multiIds,
      studentProfile: strongApplicant
    });
    assert.strictEqual(multiResponse.status, 200);
    assert.strictEqual(multiResponse.json.results.length, multiIds.length);
    console.log('PASS: POST /api/predict handles multiple universityIds in one request');

    const buckinghamEntry = readyEntries.find((u) => u.id === 'buckingham-71a8');
    assert.ok(buckinghamEntry, 'expected buckingham-71a8 to be ready in eligibility-only mode');

    // Real wizard applicants never set course_target.ucas_code to '71A8' - the
    // whole wizard session is fixed to the shared A100 workflow value (see
    // frontend/src/wizard/profileTypes.ts createEmptyProfile()). Buckingham
    // must accept that literal 'A100' value via its scoped equivalence
    // mapping rather than requiring callers to know its real UCAS code.
    const noUcatApplicant = JSON.parse(JSON.stringify(strongApplicant));
    assert.strictEqual(
      noUcatApplicant.course_target.ucas_code,
      'A100',
      'this fixture must exercise the real A100 workflow value, not a manually corrected 71A8 override'
    );
    delete noUcatApplicant.admissions_tests.ucat;
    const buckinghamResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: ['buckingham-71a8'],
      studentProfile: noUcatApplicant
    });
    assert.strictEqual(buckinghamResponse.status, 200);
    const buckinghamCard = buckinghamResponse.json.results[0].result_card;
    assert.notStrictEqual(
      buckinghamCard.recommendation_display_state,
      'not_eligible',
      'expected no course_target_mismatch rejection for the A100-to-Buckingham-71A8 equivalence'
    );
    assert.strictEqual(buckinghamCard.prediction.result_band, 'eligible_to_apply');
    assert.strictEqual(buckinghamCard.prediction.prediction_type, 'eligibility_only');
    assert.strictEqual(buckinghamCard.prediction.interview_prediction.available, false);
    assert.strictEqual(buckinghamCard.primary_user_facing_recommendation, 'Entry requirements met');
    assert.ok(
      !['Very Strong Choice', 'Strong Choice', 'Realistic Choice', 'High Risk'].includes(
        buckinghamCard.primary_user_facing_recommendation
      ),
      'Buckingham must never surface an interview-strength band label'
    );
    assert.ok(
      buckinghamCard.fee_information,
      'expected the Fees section to remain present for Buckingham'
    );
    console.log('PASS: POST /api/predict resolves buckingham-71a8 under the real A100 wizard workflow: no course mismatch, Entry requirements met, no UCAT, no interview-strength label, Fees present');

    // A genuinely incompatible course must still fail - the equivalence is
    // scoped to Buckingham only and must not weaken course matching globally.
    const wrongCourseApplicant = JSON.parse(JSON.stringify(strongApplicant));
    wrongCourseApplicant.course_target = {
      ...wrongCourseApplicant.course_target,
      ucas_code: 'B900'
    };
    const wrongCourseResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: [genericEntry.id],
      studentProfile: wrongCourseApplicant
    });
    assert.strictEqual(wrongCourseResponse.status, 200);
    const wrongCourseCard = wrongCourseResponse.json.results[0].result_card;
    assert.strictEqual(
      wrongCourseCard.recommendation_display_state,
      'not_eligible',
      `expected ${genericEntry.id} to still reject an incompatible course code (course matching must not be weakened globally)`
    );
    const wrongCourseChecks = (wrongCourseCard.decision_transparency?.decision_path || [])
      .flatMap((stage) => stage.checks || []);
    assert.ok(
      wrongCourseChecks.some((check) => /does not match this university/i.test(check.summary || '')),
      'expected the course-mismatch explanation to still be surfaced for a genuinely incompatible course'
    );
    console.log(`PASS: POST /api/predict still rejects a genuinely incompatible course for ${genericEntry.id}`);

    const mixedNoUcatResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: [genericEntry.id, 'buckingham-71a8'],
      studentProfile: noUcatApplicant
    });
    assert.strictEqual(mixedNoUcatResponse.status, 400);
    console.log('PASS: POST /api/predict still requires UCAT when any selected ready university requires UCAT');

    // Reject any university that is not readiness-bundle ready (inactive/seed).
    const fullIndex = loadIndex(INDEX_PATH);
    const notReadyEntry = fullIndex.universities.find((u) => !isProductionReady(u));
    assert.ok(notReadyEntry, 'expected at least one non-ready fixture to make this test meaningful');

    const rejectedResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: [notReadyEntry.id],
      studentProfile: strongApplicant
    });
    assert.strictEqual(rejectedResponse.status, 400);
    console.log(`PASS: POST /api/predict rejects non-ready university ${notReadyEntry.id}`);

    // Reject an unknown universityId.
    const unknownResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: ['does-not-exist-a100'],
      studentProfile: strongApplicant
    });
    assert.strictEqual(unknownResponse.status, 400);
    console.log('PASS: POST /api/predict rejects an unknown universityId');

    // Reject a malformed studentProfile (UCAT subtests not summing to total).
    const malformedProfile = JSON.parse(JSON.stringify(strongApplicant));
    malformedProfile.admissions_tests.ucat.total_score = 999999;
    const malformedResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: [genericEntry.id],
      studentProfile: malformedProfile
    });
    assert.strictEqual(malformedResponse.status, 400);
    console.log('PASS: POST /api/predict rejects a malformed studentProfile');

    // Reject a missing universityIds array.
    const missingIdsResponse = await requestJson(server, 'POST', '/api/predict', {
      studentProfile: strongApplicant
    });
    assert.strictEqual(missingIdsResponse.status, 400);
    console.log('PASS: POST /api/predict rejects a request with no universityIds');

    // A top-tier applicant (A*A*A, 9 GCSEs at grade 8-9, UCAT 2420/2700, SJT
    // Band 1) must not be rejected purely because a university requires more
    // GCSEs than a minimal profile would supply — this is the release-
    // readiness regression the GCSE-intake fix (best-8/9 capture) targets.
    const readyGcseSensitiveIds = GCSE_COUNT_SENSITIVE_UNIVERSITY_IDS.filter((id) =>
      readyEntries.some((u) => u.id === id)
    );
    assert.ok(readyGcseSensitiveIds.length > 0, 'expected at least one GCSE-count-sensitive university to be ready');

    const topTierResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyGcseSensitiveIds,
      studentProfile: topTierApplicant
    });
    assert.strictEqual(topTierResponse.status, 200);
    for (const result of topTierResponse.json.results) {
      const card = result.result_card;
      assert.notStrictEqual(
        card.recommendation_display_state,
        'not_eligible',
        `${result.universityId} incorrectly shows not_eligible for the top-tier applicant`
      );
      const eligibilityChecks =
        card.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Eligibility')?.checks || [];
      const gcseCountFailure = eligibilityChecks.find(
        (c) => c.status === 'Not met' && /gcse/i.test(c.summary) && /count|number/i.test(c.summary)
      );
      assert.strictEqual(
        gcseCountFailure,
        undefined,
        `${result.universityId} incorrectly rejected the top-tier applicant on GCSE count: ${JSON.stringify(gcseCountFailure)}`
      );
    }
    console.log(
      `PASS: top-tier applicant is not rejected on GCSE count by any of [${readyGcseSensitiveIds.join(', ')}]`
    );

    if (readyEntries.some((u) => u.id === 'aston-a100')) {
      const astonHomeResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['aston-a100'],
        studentProfile: topTierApplicant
      });
      assert.strictEqual(astonHomeResponse.status, 200);
      const astonHomeCard = astonHomeResponse.json.results[0].result_card;
      const astonHomeSelectionStage = astonHomeCard.decision_transparency?.decision_path?.find(
        (stage) => stage.stage === 'Selection model'
      );
      assert.strictEqual(
        astonHomeCard.selection_approach_display,
        'Home applicants are assessed using a selection score combining GCSE performance and UCAT.'
      );
      assert.strictEqual(
        astonHomeSelectionStage?.summary,
        'Home applicants are assessed using a selection score combining GCSE performance and UCAT.'
      );
      assert.ok(
        astonHomeCard.decision_transparency?.score_breakdown,
        'Aston Home route should still show the calculated selection score.'
      );

      const astonInternationalApplicant = JSON.parse(JSON.stringify(topTierApplicant));
      astonInternationalApplicant.applicant_identity.fee_status = 'international_fee';
      astonInternationalApplicant.applicant_identity.domicile = 'international';
      astonInternationalApplicant.applicant_identity.contextual = false;
      const astonInternationalResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['aston-a100'],
        studentProfile: astonInternationalApplicant
      });
      assert.strictEqual(astonInternationalResponse.status, 200);
      const astonInternationalCard = astonInternationalResponse.json.results[0].result_card;
      const astonInternationalSelectionStage = astonInternationalCard.decision_transparency?.decision_path?.find(
        (stage) => stage.stage === 'Selection model'
      );
      assert.strictEqual(
        astonInternationalCard.selection_approach_display,
        'International applicants who meet the academic requirements are ranked using their UCAT score.'
      );
      assert.strictEqual(
        astonInternationalSelectionStage?.summary,
        'International applicants who meet the academic requirements are ranked using their UCAT score.'
      );
      assert.strictEqual(
        astonInternationalCard.decision_transparency?.score_breakdown ?? null,
        null,
        'Aston International route must not show the Home/WP combined selection score.'
      );
      assert.ok(
        astonInternationalCard.decision_transparency?.ucat_comparison,
        'Aston International route should still show UCAT ranking evidence.'
      );
      console.log('PASS: Aston route-specific selection_approach_display follows the engine-resolved applicant pool');
    }

    // Score-breakdown regression: universities whose interview-band config
    // defines a real component_sum score model (or a bespoke consumer that
    // computes one, e.g. Nottingham/Hull York) must show a score_breakdown
    // with the applicant's real calculated value once eligible/standard.
    // Universities using ranking_metric only (no combined score) must never
    // show a score_breakdown, and must instead show ranking-only evidence.
    const SCORING_MODEL_UNIVERSITY_IDS = [
      'aston-a100',
      'cardiff-a100',
      'leicester-a100',
      'birmingham-a100',
      'dundee-a100',
      'edinburgh-a100',
      'exeter-a100',
      'nottingham-a100'
    ];
    // Aberdeen's guidance_pools all rank by raw UCAT total
    // (score_model.pool_specific_output: true) rather than the whole-
    // university component_sum formula, which its own evidence documents
    // as verified for a separate ranking pool, not as a combined score
    // applicable to every applicant pool (see accuracy-audit RC-2).
    const RANKING_ONLY_UNIVERSITY_IDS = [
      'keele-a100',
      'lancaster-a100',
      'queen-mary-a100',
      'glasgow-a100',
      'liverpool-a100',
      'manchester-a100',
      'sheffield-a100',
      'st-andrews-a100',
      'aberdeen-a100'
    ];

    const readyScoringIds = SCORING_MODEL_UNIVERSITY_IDS.filter((id) => readyEntries.some((u) => u.id === id));
    assert.ok(readyScoringIds.length > 0, 'expected at least one scoring-model university to be ready');
    const scoringResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyScoringIds,
      studentProfile: topTierApplicant
    });
    assert.strictEqual(scoringResponse.status, 200);
    let scoringModelBreakdownsSeen = 0;
    for (const result of scoringResponse.json.results) {
      const card = result.result_card;
      if (card.recommendation_display_state !== 'standard') continue; // e.g. manual_review for HYMS age check
      const breakdown = card.decision_transparency?.score_breakdown;
      assert.ok(
        breakdown && Number.isFinite(breakdown.value),
        `${result.universityId} expected a calculated score_breakdown for a top-tier standard result, got: ${JSON.stringify(breakdown)}`
      );
      assert.ok(Number.isFinite(breakdown.max), `${result.universityId} expected score_breakdown.max to be numeric`);
      assert.ok(breakdown.checks.length > 0, `${result.universityId} expected score_breakdown.checks to be non-empty`);
      scoringModelBreakdownsSeen += 1;
    }
    assert.ok(scoringModelBreakdownsSeen > 0, 'expected at least one scoring-model university to reach a standard result and show a score_breakdown');
    console.log(`PASS: score_breakdown renders the real calculated score for scoring-model universities [${readyScoringIds.join(', ')}]`);

    if (readyEntries.some((u) => u.id === 'hull-york-a100')) {
      const hymsApplicant = JSON.parse(JSON.stringify(topTierApplicant));
      hymsApplicant.applicant_identity.date_of_birth = '2008-09-01';
      const hymsResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['hull-york-a100'],
        studentProfile: hymsApplicant
      });
      assert.strictEqual(hymsResponse.status, 200);
      const hymsCard = hymsResponse.json.results[0].result_card;
      assert.strictEqual(hymsCard.recommendation_display_state, 'standard');
      const applicantFacingText = collectApplicantFacingCardText(hymsCard);
      assert.match(
        applicantFacingText,
        /Based on ApplySmart's assessment, your academic profile appears competitive for this applicant group/i
      );
      assert.match(
        applicantFacingText,
        /ApplySmart uses published HYMS admissions information and historical evidence to guide interview competitiveness alongside HYMS's published admissions policy/i
      );
      assert.strictEqual(
        hymsCard.decision_transparency.score_breakdown.explanation,
        "ApplySmart uses published HYMS admissions information and historical evidence to guide interview competitiveness alongside HYMS's published admissions policy. This is not a guarantee of interview."
      );
      assert.match(
        applicantFacingText,
        /Contextual points\nNot applied\nNot applied based on the information provided/i
      );
      assert.doesNotMatch(
        hymsCard.decision_transparency.score_breakdown.explanation,
        /Contextual points/i,
        'HYMS score note should not repeat contextual-point information already shown in the dedicated row'
      );
      for (const pattern of [
        /Freedom of Information/i,
        /\bFOI\b/i,
        /formally declined/i,
        /exact points formula/i,
        /The maximum is (100|85)/i,
        /qualifies for contextual consideration/i,
        /up to 15 contextual points/i
      ]) {
        assert.doesNotMatch(
          applicantFacingText,
          pattern,
          `HYMS applicant-facing text should not expose internal modelling limitations matching ${pattern}: ${applicantFacingText}`
        );
      }
      assert.strictEqual(
        hymsCard.decision_transparency.score_breakdown.value,
        84.98,
        'HYMS content-only copy change must not alter the calculated score'
      );
      console.log('PASS: Hull York standard result uses applicant-facing ApplySmart analysis wording without internal modelling-limit disclosures');
    }

    if (readyEntries.some((u) => u.id === 'exeter-a100')) {
      const categoryScenarioIds = [
        'exeter_predicted_non_contextual_category_maximum',
        'exeter_predicted_contextual_category_maximum',
        'exeter_achieved_non_contextual_category_maximum',
        'exeter_achieved_contextual_category_maximum'
      ];

      for (const scenarioId of categoryScenarioIds) {
        const scenario = exeterFixture.scenarios.find((entry) => entry.scenario_id === scenarioId);
        assert.ok(scenario, `missing Exeter fixture ${scenarioId}`);
        const applicant = merge(exeterFixture.base_applicant, scenario.overrides);
        const exeterResponse = await requestJson(server, 'POST', '/api/predict', {
          universityIds: ['exeter-a100'],
          studentProfile: applicant
        });
        assert.strictEqual(exeterResponse.status, 200);
        const result = exeterResponse.json.results[0];
        const breakdown = result.result_card.decision_transparency?.score_breakdown;
        assert.ok(breakdown, `${scenarioId}: expected Exeter score_breakdown`);
        assert.strictEqual(breakdown.name, 'Exeter Score', `${scenarioId}: score label`);
        assert.strictEqual(breakdown.value, scenario.expected.score, `${scenarioId}: score value`);
        assert.strictEqual(breakdown.max, scenario.expected.applicable_max_score, `${scenarioId}: denominator`);
        assert.strictEqual(
          breakdown.applicable_max_score,
          scenario.expected.applicable_max_score,
          `${scenarioId}: applicable_max_score`
        );
        assert.strictEqual(
          breakdown.selection_score_max,
          scenario.expected.applicable_max_score,
          `${scenarioId}: selection_score_max`
        );
      }
      console.log('PASS: Exeter API returns category-specific applicable_max_score denominators for all four applicant categories');
    }

    const readyRankingIds = RANKING_ONLY_UNIVERSITY_IDS.filter((id) => readyEntries.some((u) => u.id === id));
    assert.ok(readyRankingIds.length > 0, 'expected at least one ranking-only university to be ready');
    const rankingResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyRankingIds,
      studentProfile: topTierApplicant
    });
    assert.strictEqual(rankingResponse.status, 200);
    let rankingEvidenceSeen = 0;
    for (const result of rankingResponse.json.results) {
      const card = result.result_card;
      if (card.recommendation_display_state !== 'standard') continue;
      const breakdown = card.decision_transparency?.score_breakdown;
      assert.strictEqual(
        breakdown ?? null,
        null,
        `${result.universityId} is a ranking-only university and must not show a calculated score_breakdown, got: ${JSON.stringify(breakdown)}`
      );
      const selectionChecks =
        card.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Selection model')?.checks || [];
      const comparison = card.decision_transparency?.ucat_comparison;
      if (card.prediction?.ranking_metric === 'ucat_total') {
        assert.ok(comparison, `${result.universityId} expected structured UCAT comparison data.`);
        assert.strictEqual(comparison.applicant_ucat, topTierApplicant.admissions_tests.ucat.total_score);
        assert.ok(
          selectionChecks.some((c) => c.label === 'UCAT' && /UCAT:|UCAT ranking/i.test(c.summary)),
          `${result.universityId} expected interpreted UCAT evidence in Selection model checks, got: ${JSON.stringify(selectionChecks)}`
        );
        assert.ok(
          selectionChecks.some((c) => c.label === 'SJT requirement' && /Band|SJT/i.test(c.summary)),
          `${result.universityId} expected interpreted SJT evidence in Selection model checks, got: ${JSON.stringify(selectionChecks)}`
        );
      }
      assert.ok(
        selectionChecks.some((c) => /ranking\/cut-off based/i.test(c.status) || /rank/i.test(c.summary) || /UCAT:|GAMSAT/i.test(c.summary)),
        `${result.universityId} expected ranking-only evidence in the Selection model checks, got: ${JSON.stringify(selectionChecks)}`
      );
      rankingEvidenceSeen += 1;
    }
    assert.ok(rankingEvidenceSeen > 0, 'expected at least one ranking-only university to reach a standard result and show ranking evidence');
    console.log(`PASS: ranking-only evidence (no invented score) renders for ranking-metric universities [${readyRankingIds.join(', ')}]`);

    // Selection-summary wording is metadata-driven. If no metadata sentence is
    // supplied, the presenter uses one generic fallback instead of a
    // university-id wording map.
    const explanationCoverageResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: ['leicester-a100', 'queen-mary-a100'].filter((id) => readyEntries.some((u) => u.id === id)),
      studentProfile: topTierApplicant
    });
    assert.strictEqual(explanationCoverageResponse.status, 200);
    for (const result of explanationCoverageResponse.json.results) {
      const selectionStage = result.result_card.decision_transparency?.decision_path?.find(
        (stage) => stage.stage === 'Selection model'
      );
      assert.ok(
        selectionStage?.summary,
        `${result.universityId} expected a selection summary`
      );
      assert.doesNotMatch(selectionStage.summary, /Leicester|Queen Mary's/i);
    }
    console.log('PASS: selection-model summaries are metadata-driven or use the generic fallback without university-id wording');

    if (readyEntries.some((u) => u.id === 'birmingham-a100')) {
      const metadataResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['birmingham-a100'],
        studentProfile: topTierApplicant
      });
      assert.strictEqual(metadataResponse.status, 200);
      const card = metadataResponse.json.results[0].result_card;
      const metadataSelectionApproach =
        "Applicants are assessed using the university's published selection score, which combines GCSE performance and UCAT.";
      const metadataSelectionStage = card.decision_transparency?.decision_path?.find(
        (stage) => stage.stage === 'Selection model'
      );
      const metadataSelectionCheck = metadataSelectionStage?.checks?.find(
        (check) => check.label === 'Selection approach'
      );
      assert.strictEqual(card.selection_approach_display, metadataSelectionApproach);
      assert.strictEqual(card.decision_transparency?.selection_approach_display, metadataSelectionApproach);
      assert.strictEqual(metadataSelectionStage?.summary, metadataSelectionApproach);
      if (metadataSelectionCheck) {
        assert.strictEqual(metadataSelectionCheck.summary, metadataSelectionApproach);
      }
      assert.ok(
        !/Birmingham combines scored GCSEs/i.test(metadataSelectionStage?.summary || ''),
        `expected metadata wording instead of presenter fallback, got: ${metadataSelectionStage?.summary}`
      );
      console.log('PASS: prediction API propagates university metadata selection_approach_display into result cards');
    }

    // Birmingham's UKWPMED guaranteed-interview override is computed by the
    // classifier (classification.interview_outcome === 'guaranteed_interview')
    // but was previously dropped before reaching the result card. A verified
    // UKWPMED completer must see a guaranteed-interview explanation, not the
    // generic insufficient_evidence message.
    if (readyEntries.some((u) => u.id === 'birmingham-a100')) {
      const ukwpmedProfile = JSON.parse(JSON.stringify(topTierApplicant));
      ukwpmedProfile.qualification_route = 'ukwpmed';
      ukwpmedProfile.ukwpmed = {
        programme: 'Routes to the Professions: Medicine — Birmingham',
        successfully_completed: true,
        declared_in_ucas_extra_activities: true
      };
      const ukwpmedResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['birmingham-a100'],
        studentProfile: ukwpmedProfile
      });
      assert.strictEqual(ukwpmedResponse.status, 200);
      const ukwpmedCard = ukwpmedResponse.json.results[0].result_card;
      assert.strictEqual(ukwpmedCard.interview_outcome, 'guaranteed_interview');
      assert.strictEqual(ukwpmedCard.recommendation_display_state, 'standard');
      assert.ok(
        /guaranteed/i.test(ukwpmedCard.primary_explanation || ''),
        `expected a guaranteed-interview explanation, got: ${ukwpmedCard.primary_explanation}`
      );
      console.log('PASS: Birmingham UKWPMED-verified applicant shows the guaranteed-interview outcome, not generic insufficient_evidence');
    }

    // Birmingham selection-score threshold text previously interpolated raw
    // floating-point differences (e.g. "1.2640000000000002 points above ...
    // 7.236"). For a Home/RUK, non-contextual, 10 GCSEs all grade 9, UCAT
    // 2550, SJT Band 1 applicant: GCSE 4.5/4.5, UCAT decile 10 -> 4/4,
    // contextual 0/1.5, total 8.5, historical home_standard threshold 7.236,
    // margin +1.264. Approved change: home_standard scores >= 7.236 now
    // classify as the canonical 'interview_likely' band ('Strong Interview
    // Potential'), not 'realistic'. The score math and 7.236 boundary value
    // are unchanged; only the band/label above the threshold changed.
    if (readyEntries.some((u) => u.id === 'birmingham-a100')) {
      const birminghamProfile = JSON.parse(JSON.stringify(strongApplicant));
      birminghamProfile.applicant_identity.contextual = false;
      birminghamProfile.gcse_profile = {
        subjects: {
          english_language: '9', english_literature: '9', mathematics: '9',
          biology: '9', chemistry: '9', physics: '9', combined_science: null
        },
        additional_subjects: [
          { subject_id: 'history', grade: '9' },
          { subject_id: 'computer_science', grade: '9' },
          { subject_id: 'french', grade: '9' },
          { subject_id: 'geography', grade: '9' }
        ],
        total_gcse_count: 10,
        top_8_gcse_grades: ['9','9','9','9','9','9','9','9'],
        top_9_gcse_grades: ['9','9','9','9','9','9','9','9','9']
      };
      birminghamProfile.admissions_tests.ucat = {
        total_score: 2550,
        score_scale: 2700,
        subtests: { verbal_reasoning: 850, decision_making: 850, quantitative_reasoning: 850 },
        sjt_band: 1
      };

      const birminghamResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['birmingham-a100'],
        studentProfile: birminghamProfile
      });
      assert.strictEqual(birminghamResponse.status, 200);
      const birminghamCard = birminghamResponse.json.results[0].result_card;
      assert.strictEqual(birminghamCard.recommendation_display_state, 'standard');
      assert.strictEqual(
        birminghamCard.prediction?.result_band,
        'interview_likely',
        'expected a selection score of 8.5 (>= the approved 7.236 home_standard threshold) to resolve to the canonical interview_likely band, not a fallback/default band'
      );
      assert.strictEqual(
        birminghamCard.primary_user_facing_recommendation,
        'Strong choice for your application',
        'expected the canonical interview_likely headline, not Birmingham-configured "Strong Interview Potential" wording (removed - the approved public wording is Strong Choice)'
      );
      assert.strictEqual(
        birminghamCard.internal_recommendation,
        'Strong Choice',
        'expected the canonical CANONICAL_BAND_LABELS.interview_likely short label'
      );
      assert.strictEqual(
        birminghamCard.primary_explanation,
        "Based on ApplySmart's assessment, your academic profile and UCAT appear competitive for this applicant group.",
        'expected the explanation to use the standardized recommendation framework wording'
      );
      const birminghamHistoricalStage = (birminghamCard.decision_transparency?.decision_path || [])
        .find((stage) => stage.stage === 'Historical guidance');
      assert.ok(
        /Your selection score is 1\.26 points above the historical score guide of 7\.24/i.test(
          birminghamHistoricalStage?.summary || ''
        ),
        `expected the historical summary to retain the rendered score comparison detail, got: ${birminghamHistoricalStage?.summary}`
      );
      assert.strictEqual(
        birminghamCard.historical_guidance_caveat,
        'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
        'expected the historical-guidance-only caveat to remain present for the Strong Choice band'
      );

      const selectionChecks = (birminghamCard.decision_transparency?.decision_path || [])
        .flatMap((stage) => stage.checks || []);
      const gcseCheck = selectionChecks.find((c) => c.label === 'GCSE score');
      const ucatCheck = selectionChecks.find((c) => c.label === 'UCAT score');
      const contextualCheck = selectionChecks.find((c) => c.label === 'Contextual uplift');
      const thresholdCheck = selectionChecks.find((c) => c.label === 'Selection score guide');
      const scoreBreakdown = birminghamCard.decision_transparency?.score_breakdown;

      assert.strictEqual(scoreBreakdown?.value, 8.5, 'expected Birmingham score_breakdown.value to be 8.5');
      assert.strictEqual(scoreBreakdown?.max, 10, 'expected Birmingham score_breakdown.max to be 10');
      assert.strictEqual(gcseCheck?.summary, '4.5 out of 4.5.', 'expected Birmingham GCSE component to be 4.5/4.5');
      assert.strictEqual(ucatCheck?.summary, '4 out of 4.', 'expected UCAT 2550 to map to decile 10 -> 4/4 points');
      assert.strictEqual(contextualCheck?.summary, '0 out of 1.5.', 'expected 0/1.5 contextual uplift for a non-contextual applicant');
      assert.strictEqual(
        thresholdCheck?.summary,
        'Your selection score is 1.26 points above the historical score guide of 7.24 for this applicant pool.',
        'expected cleanly rounded floating-point-free selection-score guide text'
      );
      assert.ok(
        !/\d+\.\d{3,}/.test(thresholdCheck?.summary || ''),
        `expected no raw floating-point precision in the selection-score guide text, got: ${thresholdCheck?.summary}`
      );
      console.log('PASS: Birmingham home_standard score 8.5 (>= 7.236) resolves to the canonical Strong Choice (interview_likely) wording, with unchanged scoring, eligibility and threshold value');

      // The static Birmingham example card is documentation, not live-code-
      // generating, but it has previously drifted from real engine output.
      // Pin it to the same runtime wording so it can't silently drift again.
      const birminghamExample = require(
        path.join(rootDir, 'data', 'examples', 'birmingham-a100-result-card.example.json')
      );
      assert.strictEqual(
        birminghamExample.display.headline,
        birminghamCard.primary_user_facing_recommendation,
        'expected the static Birmingham example headline to match real runtime primary_user_facing_recommendation'
      );
      assert.strictEqual(
        birminghamExample.interview_guidance.result_band,
        birminghamCard.prediction?.result_band,
        'expected the static Birmingham example result_band to match the real runtime band'
      );
      assert.ok(
        !/\d+\.\d{3,}/.test(birminghamExample.display.secondary_explanation || ''),
        `expected no raw floating-point precision in the static example's secondary_explanation, got: ${birminghamExample.display.secondary_explanation}`
      );
      console.log('PASS: static Birmingham example card headline/band/wording match real runtime output');

      const missingEnglishLiteratureProfile = JSON.parse(JSON.stringify(birminghamProfile));
      delete missingEnglishLiteratureProfile.gcse_profile.subjects.english_literature;
      const missingEnglishLiteratureResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['birmingham-a100'],
        studentProfile: missingEnglishLiteratureProfile
      });
      assert.strictEqual(missingEnglishLiteratureResponse.status, 200);
      const missingEnglishLiteratureCard = missingEnglishLiteratureResponse.json.results[0].result_card;
      assert.strictEqual(missingEnglishLiteratureCard.recommendation_display_state, 'insufficient_evidence');
      assert.strictEqual(missingEnglishLiteratureCard.primary_user_facing_recommendation, 'More information is required');
      assert.strictEqual(missingEnglishLiteratureCard.prediction?.result_band, 'insufficient_evidence');
      assert.strictEqual(missingEnglishLiteratureCard.prediction?.available, false);
      assert.strictEqual(missingEnglishLiteratureCard.prediction?.interview_prediction?.available, false);
      assert.strictEqual(
        missingEnglishLiteratureCard.decision_transparency?.insufficient_evidence_reason_code,
        'missing_birmingham_english_literature_grade'
      );
      assert.strictEqual(
        missingEnglishLiteratureCard.decision_transparency?.score_breakdown,
        null,
        'missing English Literature must not produce a substituted or partial Birmingham score'
      );
      assert.match(
        missingEnglishLiteratureCard.decision_transparency?.insufficient_evidence_reason || '',
        /Birmingham includes English Literature in its seven-subject GCSE selection score/i
      );
      assert.doesNotMatch(
        collectApplicantFacingCardText(missingEnglishLiteratureCard),
        /Verified historical interview information is not available|verified historical interview data for this applicant group is currently limited|not enough verified historical interview information/i,
        'missing English Literature must not be explained as missing historical interview information'
      );
      const missingLitEligibility = missingEnglishLiteratureCard.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Eligibility');
      assert.strictEqual(missingLitEligibility?.status, 'Met', 'missing English Literature must not fail Birmingham entry eligibility');
      console.log('PASS: Birmingham missing English Literature is applicant information needed, not a historical-data gap or manual review');

      const edinburghFiveGcseProfile = JSON.parse(JSON.stringify(topTierApplicant));
      edinburghFiveGcseProfile.gcse_profile.subjects = {
        english_language: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '9',
        combined_science: null
      };
      edinburghFiveGcseProfile.gcse_profile.additional_subjects = [];
      edinburghFiveGcseProfile.gcse_profile.total_gcse_count = 5;
      edinburghFiveGcseProfile.gcse_profile.top_9_gcse_grades = ['9', '9', '9', '9', '9'];
      const edinburghFiveGcseResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['edinburgh-a100'],
        studentProfile: edinburghFiveGcseProfile
      });
      assert.strictEqual(edinburghFiveGcseResponse.status, 200);
      const edinburghFiveGcseCard = edinburghFiveGcseResponse.json.results[0].result_card;
      assert.strictEqual(edinburghFiveGcseCard.recommendation_display_state, 'insufficient_evidence');
      assert.strictEqual(edinburghFiveGcseCard.primary_user_facing_recommendation, 'More information is required');
      assert.strictEqual(edinburghFiveGcseCard.prediction?.result_band, 'insufficient_evidence');
      assert.strictEqual(
        edinburghFiveGcseCard.decision_transparency?.insufficient_evidence_reason_code,
        'edinburgh_five_gcse_historical_evidence_gap'
      );
      assert.match(
        edinburghFiveGcseCard.primary_explanation || '',
        /ApplySmart needs additional applicant information before it can provide a complete recommendation/i
      );
      assert.match(
        edinburghFiveGcseCard.decision_transparency?.insufficient_evidence_reason || '',
        /meet Edinburgh's published academic entry requirements/i
      );
      assert.match(
        edinburghFiveGcseCard.decision_transparency?.insufficient_evidence_reason || '',
        /cannot provide an interview competitiveness assessment/i
      );
      assert.match(
        edinburghFiveGcseCard.decision_transparency?.insufficient_evidence_reason || '',
        /verified historical admissions evidence is currently insufficient for applicants presenting 5 GCSEs/i
      );
      assert.match(
        edinburghFiveGcseCard.decision_transparency?.insufficient_evidence_reason || '',
        /not a rejection and does not mean you are ineligible/i
      );
      assert.doesNotMatch(
        collectApplicantFacingCardText(edinburghFiveGcseCard),
        /Evidence not yet available/i
      );
      const edinburghFiveGcseEligibility = edinburghFiveGcseCard.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Eligibility');
      assert.strictEqual(edinburghFiveGcseEligibility?.status, 'Met');
      console.log('PASS: Edinburgh 5-GCSE insufficient-evidence wording says eligibility is met and prediction is unavailable due to historical evidence');

      const missingAdditionalGcseProfile = JSON.parse(JSON.stringify(birminghamProfile));
      delete missingAdditionalGcseProfile.gcse_profile.subjects.physics;
      missingAdditionalGcseProfile.gcse_profile.additional_subjects = [
        { subject_id: 'history', grade: '9' }
      ];
      missingAdditionalGcseProfile.gcse_profile.total_gcse_count = 6;
      missingAdditionalGcseProfile.gcse_profile.top_9_gcse_grades = ['9','9','9','9','9','9'];
      const missingAdditionalGcseResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['birmingham-a100'],
        studentProfile: missingAdditionalGcseProfile
      });
      assert.strictEqual(missingAdditionalGcseResponse.status, 200);
      const missingAdditionalGcseCard = missingAdditionalGcseResponse.json.results[0].result_card;
      assert.strictEqual(missingAdditionalGcseCard.recommendation_display_state, 'insufficient_evidence');
      assert.strictEqual(
        missingAdditionalGcseCard.decision_transparency?.insufficient_evidence_reason_code,
        'missing_birmingham_additional_gcse_scoring_grades'
      );
      assert.strictEqual(
        missingAdditionalGcseCard.decision_transparency?.score_breakdown,
        null,
        'missing free-choice GCSE scoring inputs must not produce a partial Birmingham score'
      );
      assert.match(
        missingAdditionalGcseCard.decision_transparency?.insufficient_evidence_reason || '',
        /Fewer than two additional GCSE grades were provided/i
      );
      assert.doesNotMatch(
        collectApplicantFacingCardText(missingAdditionalGcseCard),
        /Verified historical interview information is not available|verified historical interview data for this applicant group is currently limited|not enough verified historical interview information/i
      );
      console.log('PASS: Birmingham missing additional GCSE scoring inputs use applicant-input reason messaging without score substitution');
    }

    // Capability-gap reason code: an eligible applicant whose route matches
    // no guidance_pool (Leicester's Graduate route, Keele's Home route -
    // neither has an executable score for this pool) must be labelled
    // 'university_methodology_gap', not left with only the generic
    // insufficient_evidence text with no machine-readable reason.
    if (readyEntries.some((u) => u.id === 'leicester-a100')) {
      const leicesterGradResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['leicester-a100'],
        studentProfile: graduateApplicant
      });
      assert.strictEqual(leicesterGradResponse.status, 200);
      const leicesterCard = leicesterGradResponse.json.results[0].result_card;
      assert.strictEqual(leicesterCard.recommendation_display_state, 'insufficient_evidence');
      assert.strictEqual(
        leicesterCard.decision_transparency?.insufficient_evidence_reason_code,
        'university_methodology_gap'
      );
      console.log('PASS: Leicester Graduate applicant is labelled university_methodology_gap, not a generic evidence gap');
    }

    if (readyEntries.some((u) => u.id === 'keele-a100')) {
      const classifyKeele = (applicant) => classifyInterviewBand(keeleCourse, keeleConfig, applicant);
      const assertSelectionRouteIsInternal = (card) => {
        assert.ok(!Object.prototype.hasOwnProperty.call(card, 'selection_route_id'));
        assert.ok(!Object.prototype.hasOwnProperty.call(card.decision_transparency || {}, 'selection_route_id'));
      };
      const keeleHomeResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: topTierApplicant
      });
      assert.strictEqual(keeleHomeResponse.status, 200);
      const keeleCard = keeleHomeResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(topTierApplicant).selection_route_id,
        'keele_home_a100_shortlisting_score'
      );
      assertSelectionRouteIsInternal(keeleCard);
      assert.strictEqual(
        keeleCard.selection_approach_display,
        "Home applicants are shortlisted using Keele's 25-point score, combining a UCAT, SJT and bonus-point component with Keele's personal-statement score."
      );
      assert.strictEqual(keeleCard.recommendation_display_state, 'insufficient_evidence');
      assert.strictEqual(
        keeleCard.decision_transparency?.insufficient_evidence_reason_code,
        'university_methodology_gap'
      );

      const keeleContextualApplicant = merge(topTierApplicant, {
        applicant_identity: {
          contextual: true,
          widening_participation: true,
          contextual_flags: {
            free_school_meals: true
          }
        }
      });
      const keeleContextualResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: keeleContextualApplicant
      });
      assert.strictEqual(keeleContextualResponse.status, 200);
      const keeleContextualCard = keeleContextualResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(keeleContextualApplicant).selection_route_id,
        'keele_home_contextual_shortlisting_score'
      );
      assertSelectionRouteIsInternal(keeleContextualCard);
      assert.strictEqual(
        keeleContextualCard.selection_approach_display,
        "Contextual Home applicants are shortlisted using Keele's 25-point score, including the published contextual point adjustment where verified."
      );
      assert.notStrictEqual(
        keeleContextualCard.selection_approach_display,
        'Verified Home Steps2Medicine or UKWPMED applicants receive a guaranteed interview after meeting Keele\'s minimum GCSE, UCAT and SJT requirements.'
      );

      const keeleInternationalApplicant = merge(topTierApplicant, {
        applicant_identity: {
          fee_status: 'International',
          domicile: 'International',
          contextual: false,
          widening_participation: false,
          english_language_exempt: true
        }
      });
      const keeleInternationalResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: keeleInternationalApplicant
      });
      assert.strictEqual(keeleInternationalResponse.status, 200);
      const keeleInternationalCard = keeleInternationalResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(keeleInternationalApplicant).selection_route_id,
        'keele_international_ucat_ranked'
      );
      assertSelectionRouteIsInternal(keeleInternationalCard);
      assert.strictEqual(
        keeleInternationalCard.selection_approach_display,
        'International applicants who meet the academic, UCAT and SJT requirements are ranked by UCAT total.'
      );
      assert.ok(
        keeleInternationalCard.decision_transparency?.ucat_comparison,
        'Keele International route should still use UCAT ranking evidence.'
      );

      const keeleVerifiedProgrammeApplicant = merge(keeleContextualApplicant, {
        widening_participation_programme: {
          programme: 'steps2medicine_or_ukwpmed',
          verified: true,
          home_fee_status: true
        }
      });
      const keeleVerifiedProgrammeResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: keeleVerifiedProgrammeApplicant
      });
      assert.strictEqual(keeleVerifiedProgrammeResponse.status, 200);
      const keeleVerifiedProgrammeCard = keeleVerifiedProgrammeResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(keeleVerifiedProgrammeApplicant).selection_route_id,
        'keele_steps2medicine_ukwpmed_guaranteed_interview'
      );
      assertSelectionRouteIsInternal(keeleVerifiedProgrammeCard);
      assert.strictEqual(
        keeleVerifiedProgrammeCard.interview_outcome,
        'guaranteed_interview'
      );
      assert.strictEqual(
        keeleVerifiedProgrammeCard.selection_approach_display,
        "Verified Home Steps2Medicine or UKWPMED applicants receive a guaranteed interview after meeting Keele's minimum GCSE, UCAT and SJT requirements."
      );

      const keeleUnverifiedProgrammeApplicant = merge(keeleContextualApplicant, {
        widening_participation_programme: {
          programme: 'steps2medicine_or_ukwpmed',
          verified: false,
          home_fee_status: true
        }
      });
      const keeleUnverifiedProgrammeResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: keeleUnverifiedProgrammeApplicant
      });
      assert.strictEqual(keeleUnverifiedProgrammeResponse.status, 200);
      const keeleUnverifiedProgrammeCard = keeleUnverifiedProgrammeResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(keeleUnverifiedProgrammeApplicant).selection_route_id,
        'keele_home_contextual_shortlisting_score'
      );
      assertSelectionRouteIsInternal(keeleUnverifiedProgrammeCard);
      assert.notStrictEqual(
        keeleUnverifiedProgrammeCard.interview_outcome,
        'guaranteed_interview'
      );
      assert.strictEqual(
        keeleUnverifiedProgrammeCard.selection_approach_display,
        "Contextual Home applicants are shortlisted using Keele's 25-point score, including the published contextual point adjustment where verified."
      );

      const keeleNonContextualUnverifiedProgrammeApplicant = merge(topTierApplicant, {
        widening_participation_programme: {
          programme: 'steps2medicine_or_ukwpmed',
          verified: false,
          home_fee_status: true
        }
      });
      const keeleNonContextualUnverifiedProgrammeResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['keele-a100'],
        studentProfile: keeleNonContextualUnverifiedProgrammeApplicant
      });
      assert.strictEqual(keeleNonContextualUnverifiedProgrammeResponse.status, 200);
      const keeleNonContextualUnverifiedProgrammeCard =
        keeleNonContextualUnverifiedProgrammeResponse.json.results[0].result_card;
      assert.strictEqual(
        classifyKeele(keeleNonContextualUnverifiedProgrammeApplicant).selection_route_id,
        'keele_home_a100_shortlisting_score'
      );
      assertSelectionRouteIsInternal(keeleNonContextualUnverifiedProgrammeCard);
      assert.notStrictEqual(
        keeleNonContextualUnverifiedProgrammeCard.interview_outcome,
        'guaranteed_interview'
      );
      assert.strictEqual(
        keeleNonContextualUnverifiedProgrammeCard.selection_approach_display,
        "Home applicants are shortlisted using Keele's 25-point score, combining a UCAT, SJT and bonus-point component with Keele's personal-statement score."
      );
      console.log('PASS: Keele selection_route_id remains internal while resolving route-specific selection_approach_display without changing route outcomes');
    }

    if (readyEntries.some((u) => u.id === 'kent-and-medway-a100')) {
      const kmmsApplicant = merge(kmmsFixture.base_applicant, {
        admissions_tests: {
          ucat: {
            total_score: 2550,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 850,
              decision_making: 850,
              quantitative_reasoning: 850
            }
          }
        }
      });
      const kmmsResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['kent-and-medway-a100'],
        studentProfile: kmmsApplicant
      });
      assert.strictEqual(kmmsResponse.status, 200);
      const kmmsCard = kmmsResponse.json.results[0].result_card;
      assert.strictEqual(kmmsCard.recommendation_display_state, 'standard');
      assert.strictEqual(
        kmmsCard.primary_user_facing_recommendation,
        'Strong choice for your application',
        'official-prediction-unavailable cards must use the standard recommendation headline, not an alternate "Interview Potential" wording family'
      );
      assert.match(kmmsCard.primary_explanation, /UCAT score appears competitive for this applicant group/i);
      assert.doesNotMatch(kmmsCard.primary_explanation, /ApplySmart advisory|current-scale|benchmark model/i);
      assert.match(kmmsCard.trust_statement, /does not alter university requirements/i);
      assert.strictEqual(kmmsCard.prediction?.prediction_status, 'prediction_unavailable');
      assert.strictEqual(kmmsCard.prediction?.official_prediction?.available, false);
      assert.strictEqual(kmmsCard.prediction?.applysmart_advisory_guidance?.available, true);
      assert.match(kmmsCard.prediction?.applysmart_advisory_guidance?.trust_statement, /available admissions evidence/i);
      assert.strictEqual(kmmsCard.prediction?.result_band, 'interview_likely');
      assert.strictEqual(kmmsCard.decision_transparency?.manual_review_reason, null);
      assert.strictEqual(kmmsCard.fee_information, null);
      assert.doesNotMatch(collectApplicantFacingCardText(kmmsCard), /Some required applicant information is missing/i);

      const eligibilityStage = kmmsCard.decision_transparency?.decision_path?.find(
        (stage) => stage.stage === 'Eligibility'
      );
      assert.strictEqual(eligibilityStage?.status, 'Met');
      const historical = kmmsCard.decision_transparency?.ucat_comparison;
      assert.strictEqual(historical?.applicant_ucat, 2550);
      assert.strictEqual(historical?.benchmark_min, 1855);
      assert.strictEqual(historical?.benchmark_max, 1864);
      assert.strictEqual(historical?.position, 'above');

      const kmmsMissingInput = merge(kmmsFixture.base_applicant, {
        qualification_route: 'international_qualification',
        applicant_identity: {
          fee_status: 'international',
          domicile: 'international',
          applicant_type: 'school_leaver'
        },
        international_qualification: {
          name: 'Unverified overseas qualification',
          equivalence_status: 'pending',
          verified_by_institution: false,
          requirements_met: null
        },
        english_language_profile: {
          test: 'ielts_academic',
          overall: 7.5,
          reading: 7,
          writing: 7,
          listening: 7,
          speaking: 7
        },
        admissions_tests: {
          ucat: {
            total_score: 2550,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 850,
              decision_making: 850,
              quantitative_reasoning: 850
            }
          }
        }
      });
      const kmmsMissingResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['kent-and-medway-a100'],
        studentProfile: kmmsMissingInput
      });
      assert.strictEqual(kmmsMissingResponse.status, 200);
      const kmmsMissingCard = kmmsMissingResponse.json.results[0].result_card;
      assert.strictEqual(kmmsMissingCard.recommendation_display_state, 'manual_review');
      assert.match(
        kmmsMissingCard.decision_transparency?.manual_review_reason || '',
        /qualification route needs manual review|equivalence/i
      );
      console.log('PASS: KMMS separates eligibility/manual review from official prediction availability');
    }

    // RC-1 regression: the applicant-pool label shown on the card must be
    // the engine's own resolved applicant group for THIS applicant, not a
    // static per-university guess. A Home applicant must never show as
    // International (or vice versa) - this was the exact bug reported for
    // Manchester. Checked across Home/RUK, International and Scottish-Home
    // profiles against every ready university.
    function applicantPoolSummary(card) {
      return card.decision_transparency?.decision_path
        ?.find((stage) => stage.stage === 'Selection model')
        ?.checks?.find((c) => c.label === 'Applicant pool')?.summary;
    }

    const poolProfiles = [
      { label: 'Home/RUK', profile: topTierApplicant, mustInclude: /\bHome\b/, mustExclude: /International/ },
      { label: 'International', profile: internationalApplicant, mustInclude: /International/, mustExclude: /\bHome\b/ },
      { label: 'Scottish-Home', profile: scottishHomeApplicant, mustInclude: /\bHome\b/, mustExclude: /International/ }
    ];
    const allReadyIds = readyEntries.map((u) => u.id);
    const readyScottishIds = SCOTTISH_MEDICAL_SCHOOL_IDS.filter((id) => allReadyIds.includes(id));
    assert.deepStrictEqual(
      readyScottishIds,
      SCOTTISH_MEDICAL_SCHOOL_IDS,
      'expected all four Scottish medical schools to be readiness-bundle ready for routing regression coverage'
    );

    const rukScotlandProfile = routingProfile({
      feeStatus: 'rest_of_uk_roi_fee_rate',
      domicile: 'scotland'
    });
    const rukEnglandProfile = routingProfile({
      feeStatus: 'rest_of_uk_roi_fee_rate',
      domicile: 'england'
    });
    const scottishHomeProfileForRouting = routingProfile({
      feeStatus: 'home_fee',
      domicile: 'scotland'
    });
    const internationalScotlandProfile = routingProfile({
      feeStatus: 'international_fee',
      domicile: 'scotland'
    });

    for (const deriveGroups of [deriveClassifierApplicantGroupIds, deriveEligibilityApplicantGroupIds]) {
      const groups = new Set(deriveGroups(rukScotlandProfile));
      assert.ok(groups.has('rest_of_uk'), 'RUK/ROI fee + Scotland domicile must include rest_of_uk');
      assert.ok(groups.has('home_fee'), 'RUK/ROI fee + Scotland domicile must include home_fee');
      assert.ok(groups.has('scotland_domiciled'), 'RUK/ROI fee + Scotland domicile must preserve scotland_domiciled');
      assert.ok(groups.has('school_leaver'), 'RUK/ROI fee + Scotland domicile must include school_leaver where applicable');
    }

    const rukScotlandResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyScottishIds,
      studentProfile: rukScotlandProfile
    });
    assert.strictEqual(rukScotlandResponse.status, 200);

    const rukEnglandResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyScottishIds,
      studentProfile: rukEnglandProfile
    });
    assert.strictEqual(rukEnglandResponse.status, 200);

    const scottishHomeResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyScottishIds,
      studentProfile: scottishHomeProfileForRouting
    });
    assert.strictEqual(scottishHomeResponse.status, 200);

    const internationalScotlandResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: readyScottishIds,
      studentProfile: internationalScotlandProfile
    });
    assert.strictEqual(internationalScotlandResponse.status, 200);

    for (const id of readyScottishIds) {
      const { course, config } = loadCourseAndConfig(id);
      const rukScotlandClassification = classifyInterviewBand(course, config, rukScotlandProfile);
      const rukEnglandClassification = classifyInterviewBand(course, config, rukEnglandProfile);
      const scottishHomeClassification = classifyInterviewBand(course, config, scottishHomeProfileForRouting);
      const internationalScotlandClassification = classifyInterviewBand(course, config, internationalScotlandProfile);
      const rukScotlandCard = rukScotlandResponse.json.results.find((result) => result.universityId === id).result_card;
      const rukEnglandCard = rukEnglandResponse.json.results.find((result) => result.universityId === id).result_card;
      const scottishHomeCard = scottishHomeResponse.json.results.find((result) => result.universityId === id).result_card;
      const internationalScotlandCard = internationalScotlandResponse.json.results.find((result) => result.universityId === id).result_card;

      assert.deepStrictEqual(
        rukScotlandClassification.guidance_pool_id,
        'home_rest_of_uk_school_leaver',
        `${id} must route RUK/ROI fee + Scotland domicile into the existing RUK guidance pool`
      );
      assert.strictEqual(
        rukScotlandClassification.guidance_pool_id,
        rukEnglandClassification.guidance_pool_id,
        `${id} RUK/ROI Scotland and RUK/ROI England should use the same guidance pool`
      );
      assert.strictEqual(
        rukScotlandClassification.canonical_interview_band,
        rukEnglandClassification.canonical_interview_band,
        `${id} RUK/ROI Scotland and RUK/ROI England should produce the same band for the same academic profile`
      );
      assert.strictEqual(
        rukScotlandClassification.ranking?.value,
        rukEnglandClassification.ranking?.value,
        `${id} RUK/ROI routing fix must not alter the calculated ranking value`
      );
      assert.strictEqual(rukScotlandCard.prediction.available, true, `${id} RUK/ROI Scotland prediction should be available`);
      assert.strictEqual(rukScotlandCard.recommendation_display_state, 'standard');
      assert.notStrictEqual(rukScotlandCard.prediction.result_band, 'insufficient_evidence');
      assert.strictEqual(
        rukScotlandCard.decision_transparency?.insufficient_evidence_reason_code ?? null,
        null,
        `${id} RUK/ROI Scotland must not be classified as university_methodology_gap`
      );
      assert.match(
        applicantPoolSummary(rukScotlandCard),
        /Rest of UK \/ ROI applicants/,
        `${id} RUK/ROI Scotland applicant-pool wording must reflect the selected RUK/ROI fee route`
      );

      assert.strictEqual(
        rukEnglandCard.prediction.result_band,
        rukEnglandClassification.canonical_interview_band,
        `${id} RUK/ROI England existing prediction behaviour should remain aligned with classifier output`
      );

      assert.ok(
        !scottishHomeClassification.applicant_group_ids.includes('rest_of_uk'),
        `${id} Scottish/Home fee + Scotland domicile must not inherit rest_of_uk`
      );
      assert.strictEqual(
        scottishHomeClassification.guidance_pool_id,
        null,
        `${id} Scottish/Home fee + Scotland domicile must not inherit the RUK guidance pool`
      );
      assert.strictEqual(scottishHomeCard.prediction.available, false);
      assert.strictEqual(scottishHomeCard.prediction.result_band, 'insufficient_evidence');

      assert.strictEqual(
        internationalScotlandClassification.guidance_pool_id,
        'international',
        `${id} International fee + Scotland domicile must keep the international pool`
      );
      assert.strictEqual(internationalScotlandCard.prediction.available, true);
      assert.match(applicantPoolSummary(internationalScotlandCard), /International/);
    }
    console.log('PASS: Scottish-school routing respects explicit RUK/ROI fee status, preserves unsupported Scottish/Home, and leaves international routing unchanged');

    const bandContractResponse = await requestJson(server, 'POST', '/api/predict', {
      universityIds: allReadyIds,
      studentProfile: topTierApplicant
    });
    assert.strictEqual(bandContractResponse.status, 200);
    assert.strictEqual(bandContractResponse.json.results.length, allReadyIds.length);
    for (const result of bandContractResponse.json.results) {
      assertNoApplicantFacingDiagnostics(result);
      const card = result.result_card;
      assert.ok(
        card.prediction && typeof card.prediction.result_band === 'string',
        `${result.universityId} result_card must include prediction.result_band`
      );
      assert.ok(
        !(
          card.recommendation_display_state === 'standard' &&
          card.prediction.result_band === 'insufficient_evidence'
        ),
        `${result.universityId} standard result must not carry an insufficient_evidence result_band`
      );
      if (card.recommendation_display_state === 'standard') {
        const historicalStage = card.decision_transparency?.decision_path?.find(
          (stage) => stage.stage === 'Historical guidance'
        );
        const historicalText = JSON.stringify(historicalStage || {});
        if (result.universityId === 'king-s-college-london-a100') {
          assert.match(
            historicalText,
            /historically competitive range for interview consideration|historical interview benchmark/i,
            'King’s College London A100 must show parent-friendly historical benchmark context'
          );
          assert.match(
            card.trust_statement || '',
            /not a guarantee of interview/i,
            'King’s College London A100 must state that the prediction is not a guarantee'
          );
        } else {
          assert.match(
            historicalText,
            NEUTRAL_HISTORICAL_LIMITATION,
            `${result.universityId} standard result must show the neutral historical-guidance limitation`
          );
        }
      }
    }
    console.log('PASS: every readiness-bundle-ready /api/predict result card includes prediction.result_band, neutral historical limitations and no applicant-facing internal confidence/manual-review diagnostics');

    for (const { label, profile, mustInclude, mustExclude } of poolProfiles) {
      const poolResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: allReadyIds,
        studentProfile: profile
      });
      assert.strictEqual(poolResponse.status, 200);
      for (const result of poolResponse.json.results) {
        const pool = applicantPoolSummary(result.result_card);
        if (!pool) continue; // guaranteed-interview cards use a fixed pool label, not derived from group ids
        assert.ok(
          mustInclude.test(pool),
          `${result.universityId} (${label} profile) expected applicant pool to mention "${mustInclude}", got: "${pool}"`
        );
        assert.ok(
          !mustExclude.test(pool),
          `${result.universityId} (${label} profile) applicant pool wrongly mentions "${mustExclude}": "${pool}"`
        );
      }
      console.log(`PASS: applicant pool label is correct (no Home/International mismatch) for the ${label} profile across all ready universities`);
    }

    // RC-2 regression: Aberdeen Home applicants must never see
    // a fabricated combined score computed from a formula its own source
    // data documents as verified for International only. It must show
    // ranking-only evidence (real UCAT total, no invented "Selection score").
    const fabricatedScoreCheckIds = ['aberdeen-a100'].filter((id) => allReadyIds.includes(id));
    if (fabricatedScoreCheckIds.length > 0) {
      const homeScoreResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: fabricatedScoreCheckIds,
        studentProfile: topTierApplicant
      });
      assert.strictEqual(homeScoreResponse.status, 200);
      for (const result of homeScoreResponse.json.results) {
        const breakdown = result.result_card.decision_transparency?.score_breakdown;
        assert.strictEqual(
          breakdown ?? null,
          null,
          `${result.universityId} must not show a combined score for a Home applicant (formula is verified International-only), got: ${JSON.stringify(breakdown)}`
        );
      }
      console.log(`PASS: no fabricated combined score for Home applicants at [${fabricatedScoreCheckIds.join(', ')}]`);
    }

    // RC-3 / Queen Mary regression: a historical cycle entry whose scale
    // resolves to 3600 must never render a UCAT figure next to the
    // applicant's current 2700-scale score. Queen Mary's cycles are all
    // score_scale: 3600, so its "Historical admissions data" checks must
    // never include a UCAT interview threshold figure, even though
    // applications/interviews/offers/places (non-scale figures) should
    // still render.
    if (allReadyIds.includes('queen-mary-a100')) {
      const qmResponse = await requestJson(server, 'POST', '/api/predict', {
        universityIds: ['queen-mary-a100'],
        studentProfile: topTierApplicant
      });
      assert.strictEqual(qmResponse.status, 200);
      const qmCard = qmResponse.json.results[0].result_card;
      const historicalChecks =
        qmCard.decision_transparency?.decision_path?.find((stage) => stage.stage === 'Historical guidance')?.checks || [];
      const historicalEntries = historicalChecks.filter((c) => c.status === 'Historical');
      assert.ok(historicalEntries.length > 0, 'expected Queen Mary historical admissions data to render (applications/interviews/offers/places), not be silently dropped');
      for (const entry of historicalEntries) {
        assert.ok(
          !/UCAT interview threshold/i.test(entry.summary),
          `Queen Mary historical entry must not show a legacy 3600-scale UCAT threshold as a current figure: "${entry.summary}"`
        );
      }
      console.log('PASS: Queen Mary historical admissions data renders without leaking legacy 3600-scale UCAT thresholds');
    }

    console.log('\nAll predict API smoke tests passed.');
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
