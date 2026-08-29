#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

const course = readJson('data/universities/bristol-a100.json');
const research = readJson('data/research/bristol-a100-research.json');
const config = readJson('data/interview-band-configs/bristol-a100.json');
const card = readJson('data/examples/bristol-a100-result-card.example.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/bristol-a100.json'
);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'bristol-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, null);
assert.deepStrictEqual(
  gcse.grade_requirements
    .filter((rule) => rule.qualification_level === 'gcse_or_igcse')
    .map((rule) => [rule.subject_id, rule.minimum_grade]),
  [
    ['english_language', '4/C'],
    ['mathematics', '7/A']
  ]
);
assert.strictEqual(gcse.selection_role, 'eligibility_only');
assert.strictEqual(gcse.scored_after_eligibility, false);
assert.match(gcse.science_requirement.notes, /no GCSE science requirement/i);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A', 'A', 'A']);
assert.deepStrictEqual(aLevel.contextual_offer.grade_profile, ['A', 'B', 'B']);
assert.strictEqual(aLevel.science_practical_endorsement_required, true);
assert.strictEqual(aLevel.predicted_grades_scored, false);
assert.strictEqual(aLevel.achieved_grades_scored, false);
assert.deepStrictEqual(aLevel.excluded_subject_names, [
  'General Studies',
  'Critical Thinking'
]);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, null);
assert.strictEqual(admissionsTests.ucat.weight_percent, 100);
assert.strictEqual(admissionsTests.sjt.used_as_gate, false);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3, 4]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, []);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(config.score_model.metric, 'ucat_total');
assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  [
    'international_a100',
    'home_a100'
  ]
);
assert.strictEqual(config.eligibility.map_override.apply_ucat_guidance_band, false);
assert.strictEqual(
  config.eligibility.map_override.applicant_evidence_path,
  'widening_participation.bristol_guaranteed_interview'
);
assert.deepStrictEqual(
  config.eligibility.map_override.match.all_group_ids,
  ['home_fee', 'bristol_wp_guaranteed_interview_verified']
);
assert.strictEqual(
  config.eligibility.international_qualification.unverified_outcome,
  'manual_review'
);
assert.strictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'home_a100')
    .historical_cutoff.evidence_classification,
  'official_published_threshold'
);
assert.strictEqual(
  config.guidance_pools.find((pool) => pool.pool_id === 'international_a100')
    .historical_cutoff.evidence_classification,
  'official_published_threshold'
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    scenario.expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  if (Object.hasOwn(scenario.expected, 'interview_outcome')) {
    assert.strictEqual(
      result.interview_outcome ?? null,
      scenario.expected.interview_outcome,
      `${scenario.scenario_id}: interview outcome`
    );
  }
  if (scenario.expected.failure) {
    const combinedFailures = [
      ...result.eligibility.failures,
      ...(result.eligibility.manual_review_reasons || [])
    ];
    assert.ok(
      combinedFailures.includes(scenario.expected.failure),
      `${scenario.scenario_id}: expected failure ${scenario.expected.failure}`
    );
  }
  if (scenario.expected.review_boundary) {
    assert.ok(
      result.eligibility.manual_review_reasons.length > 0,
      `${scenario.scenario_id}: review-only route must not receive ordinary positive guidance`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'international';
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international
    },
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
      }
    }
  });
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const result = classifyInterviewBand(
    course,
    config,
    applicantForBoundary(boundary)
  );
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.pool} UCAT ${boundary.ucat_total}`
  );
}

const contextualApplicant = merge(
  fixture.base_applicant,
  fixture.scenarios.find((scenario) => {
    return scenario.scenario_id === 'standard_contextual_same_home_ucat_threshold';
  }).overrides
);
const contextualResult = classifyInterviewBand(
  course,
  config,
  contextualApplicant
);
assert.strictEqual(contextualResult.guidance_pool_id, 'home_a100');
assert.strictEqual(contextualResult.canonical_interview_band, 'high_risk');
const contextualEligibility = evaluateContextualEligibility(course, contextualApplicant);
assert.strictEqual(contextualEligibility.status, 'contextual');
assert.strictEqual(
  contextualEligibility.qualifying_criteria.find((criterion) => {
    return criterion.criterion_id === 'aspiring_state_school_or_college';
  }).status,
  'matched'
);
assert.strictEqual(
  contextualEligibility.contextual_evidence.bristol_aspiring_state_school.verification_status,
  'matched_confirmed'
);
assert.strictEqual(
  contextualEligibility.contextual_evidence.bristol_aspiring_state_school.application_cycle_year,
  2027
);
assert.strictEqual(
  contextualEligibility.contextual_evidence.bristol_aspiring_state_school.match_method,
  'apply_centre_code'
);

const awaitingAspiringSchoolEligibility = evaluateContextualEligibility(
  course,
  merge(fixture.base_applicant, {
    application_year: 2027,
    contextual_profile: {
      partner_schools: {
        status: 'yes',
        relationships: [
          {
            university_id: 'bristol_a100',
            school_identifier_type: 'apply_centre_code',
            school_identifier: '10125',
            school_name: 'Westhill Academy',
            status: 'yes'
          }
        ]
      }
    }
  })
);
assert.strictEqual(
  awaitingAspiringSchoolEligibility.contextual_evidence.bristol_aspiring_state_school.verification_status,
  'matched_awaiting_confirmation'
);
assert.ok(
  awaitingAspiringSchoolEligibility.missing_information.some((entry) => {
    return entry.reason === 'bristol_aspiring_state_school_awaiting_confirmation';
  })
);
assert.notStrictEqual(awaitingAspiringSchoolEligibility.status, 'contextual');
assert.ok(
  !awaitingAspiringSchoolEligibility.qualifying_criteria.some((criterion) => {
    return criterion.criterion_id === 'aspiring_state_school_or_college' && criterion.status === 'matched';
  })
);

const bsBaSchoolAreaOnlyEligibility = evaluateContextualEligibility(
  course,
  merge(fixture.base_applicant, {
    application_year: 2027,
    contextual_profile: {
      home_area_region: {
        school_area: 'bristol_bs_ba_state_school'
      }
    }
  })
);
assert.strictEqual(bsBaSchoolAreaOnlyEligibility.status, 'information_needed');
assert.strictEqual(
  bsBaSchoolAreaOnlyEligibility.contextual_evidence.bristol_aspiring_state_school.verification_status,
  'school_identifier_or_name_required'
);
assert.ok(
  bsBaSchoolAreaOnlyEligibility.missing_information.some((entry) => {
    return entry.reason === 'bristol_aspiring_state_school_identifier_or_name_required';
  })
);

const wpResult = classifyInterviewBand(
  course,
  config,
  merge(
    fixture.base_applicant,
    fixture.scenarios.find((scenario) => {
      return scenario.scenario_id === 'verified_bristol_wp_programme_guaranteed_interview';
    }).overrides
  )
);
assert.strictEqual(wpResult.guidance_pool_id, null);
assert.strictEqual(wpResult.canonical_interview_band, null);
assert.strictEqual(wpResult.interview_outcome, 'guaranteed_interview');
assert.strictEqual(wpResult.ranking, null);
assert.doesNotMatch(JSON.stringify(wpResult), /threshold of 0|above the previous interview threshold of 0/i);
const wpCard = presentResultCard({
  eligibilityStatus: wpResult.eligibility.status,
  interviewBand: wpResult.canonical_interview_band,
  transparencyContext: {
    interview_outcome: wpResult.interview_outcome,
    guaranteed_interview_explanation: wpResult.guaranteed_interview_explanation,
    applicant_group_ids: wpResult.applicant_group_ids,
    eligibility_failures: wpResult.eligibility.failures,
    eligibility_checks: wpResult.eligibility.checks,
    score_model: config.score_model
  }
});
assert.strictEqual(
  wpCard.primary_user_facing_recommendation,
  'Interview guaranteed under the published criteria'
);
assert.match(
  wpCard.primary_explanation,
  /verified University of Bristol widening-participation guaranteed-interview programme route/i
);
assert.doesNotMatch(JSON.stringify(wpCard), /Strong choice based on your UCAT|threshold of 0/i);

const unverifiedWpResult = classifyInterviewBand(
  course,
  config,
  merge(
    fixture.base_applicant,
    fixture.scenarios.find((scenario) => {
      return scenario.scenario_id === 'self_declared_unverified_wp_programme_remains_home_guidance';
    }).overrides
  )
);
assert.strictEqual(unverifiedWpResult.guidance_pool_id, 'home_a100');
assert.strictEqual(unverifiedWpResult.interview_outcome, undefined);
assert.strictEqual(unverifiedWpResult.canonical_interview_band, 'high_risk');

assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.execution_status,
  'implemented_shared_scottish_eligibility'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.route_implemented,
  true
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.contextual_route_implemented,
  false
);
assert.deepStrictEqual(
  config.eligibility.qualification_routes.supported,
  [
    'a_level',
    'international_baccalaureate',
    'international_qualification',
    'scottish'
  ]
);
assert.ok(
  !config.eligibility.qualification_routes.manual_review.includes('scottish')
);
assert.deepStrictEqual(
  config.eligibility.use_course_eligibility_for_qualification_routes,
  ['scottish']
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.scottish.higher_offer.grade_profile,
  ['A', 'A', 'A', 'A', 'B']
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.scottish.advanced_higher_offer.grade_profile,
  ['A', 'A']
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.grade_requirements.length,
  1
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.grade_requirements[0].qualification_level,
  'scottish_highers_and_advanced_highers'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.grade_requirements[0].academic_pathway,
  'standard'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.degree.execution_status,
  'manual_review_required_engine_v1_cannot_combine_degree_and_bbb_subject_branch'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.degree.minimum_classification,
  '2:1'
);
assert.match(
  course.stage_1_eligibility.post_16.degree.school_qualification_requirement,
  /BBB/
);
assert.strictEqual(course.stage_1_eligibility.resits.allowed, true);
assert.strictEqual(
  research.ucat_and_sjt.contextual_threshold,
  'same_as_home'
);
assert.strictEqual(
  research.selection_model.sjt_shortlisting_role,
  'none'
);
assert.deepStrictEqual(
  research.evidence_gaps.map((gap) => gap.gap_id),
  [
    'future_ucat_thresholds',
    'post_interview_score_distribution',
    'country_specific_international_equivalences',
    'reserve_list_statistics'
  ]
);
assert.strictEqual(
  research.implementation_mapping.architecture_change_required,
  false
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.result_band, 'realistic');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(
  card.decision_transparency,
  buildDecisionTransparency(card)
);
assert.match(
  card.decision_timeline[2].summary,
  /academic eligibility.*ranks eligible applicants by UCAT/i
);
assert.match(
  JSON.stringify(card.decision_transparency),
  /historical admissions data provides a benchmark only.*not a current cut-off or a guarantee of interview/i
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(
  indexEntry.interview_band_config_file,
  'interview-band-configs/bristol-a100.json'
);
assert.strictEqual(indexEntry.activation_ready, true);

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: true,
  international_prediction: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `production ${field}`);
  assert.strictEqual(indexEntry[field], expected, `index ${field}`);
}

for (const field of [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required',
  'eligibility_ready',
  'interview_prediction_ready',
  'prediction_confidence',
  'result_card_ready',
  'offer_prediction_scope'
]) {
  assert.deepStrictEqual(research.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(card.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(indexEntry[field], course.engine_notes[field]);
}

console.log('Bristol A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('UCAT-only selection, SJT exclusion, contextual threshold and WP handling: PASS');
