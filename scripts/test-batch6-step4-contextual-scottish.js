#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  evaluateContextualEligibility,
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  predict
} = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides = {}) {
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

function course(id) {
  return readJson(`data/universities/${id}.json`);
}

function config(id) {
  return readJson(`data/interview-band-configs/${id}.json`);
}

function fixture(id) {
  return readJson(`data/fixtures/interview-band-classification/${id}.json`).base_applicant;
}

function gradeSubjects(entries) {
  return entries.map(([subjectId, grade]) => ({
    subject_id: subjectId,
    grade,
    predicted_grade: grade,
    achieved_grade: grade,
    school_year: 's5',
    sitting_id: 's5'
  }));
}

function advancedGradeSubjects(entries) {
  return entries.map(([subjectId, grade]) => ({
    subject_id: subjectId,
    grade,
    predicted_grade: grade,
    achieved_grade: grade,
    school_year: 's6',
    sitting_id: 's6'
  }));
}

function aLevelApplicant(id, domicile = 'England', overrides = {}) {
  return merge(fixture(id), {
    qualification_route: 'a_level',
    applicant_identity: {
      fee_status: 'Home',
      domicile,
      applicant_type: 'standard_school_leaver',
      graduate: false,
      contextual: false,
      widening_participation: false,
      contextual_flags: {}
    },
    contextual_profile: {},
    ...overrides
  });
}

function scottishApplicant(id, domicile, highers, advancedHighers = [], overrides = {}) {
  const applicant = merge(fixture(id), {
    qualification_route: 'scottish',
    applicant_identity: {
      fee_status: 'Home',
      domicile,
      applicant_type: 'standard_school_leaver',
      graduate: false,
      contextual: false,
      widening_participation: false,
      contextual_flags: {}
    },
    contextual_profile: {},
    scottish_profile: {
      national_5_subjects: [],
      higher_subjects: highers,
      advanced_higher_subjects: advancedHighers
    },
    ...overrides
  });
  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  return applicant;
}

function assertEligibility(id, applicant, expectedStatus, expectedRoute, expectedPathway = null) {
  const result = evaluateCourseEligibility(course(id), applicant);
  assert.strictEqual(result.status, expectedStatus, `${id}: ${JSON.stringify(result)}`);
  assert.strictEqual(result.qualification_route, expectedRoute, `${id}: qualification route`);
  if (expectedPathway) {
    assert.strictEqual(result.academic_pathway_id, expectedPathway, `${id}: academic pathway`);
  }
  return result;
}

function assertClassifierRoute(id, applicant, expectedStatus, expectedRoute) {
  const result = classifyInterviewBand(course(id), config(id), applicant);
  assert.strictEqual(result.eligibility.status, expectedStatus, `${id}: classifier eligibility`);
  assert.strictEqual(result.eligibility.qualification_route, expectedRoute, `${id}: classifier route`);
  return result;
}

function assertScottishAccepted(id, applicant, expectedPathway) {
  const direct = assertEligibility(id, applicant, 'eligible', 'scottish', expectedPathway);
  const classified = assertClassifierRoute(id, applicant, 'eligible', 'scottish');
  assert.ok(
    !direct.failures.includes('a_level_requirements_not_met'),
    `${id}: Scottish route must not be treated as A-level failure.`
  );
  assert.strictEqual(classified.eligibility.academic_pathway_id, expectedPathway);
}

function assertScottishRejected(id, applicant) {
  const result = assertEligibility(id, applicant, 'not_eligible', 'scottish');
  assert.ok(result.failures.includes('scottish_post_16_requirements_not_met'));
  assert.ok(!result.failures.includes('a_level_requirements_not_met'));
}

const exeterHighers = gradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A'],
  ['mathematics', 'A'],
  ['english', 'A'],
  ['history', 'A']
]);
const exeterAdvanced = advancedGradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A'],
  ['mathematics', 'A']
]);
const lancashireHighers = gradeSubjects([
  ['chemistry', 'A'],
  ['biology', 'A'],
  ['mathematics', 'A'],
  ['english', 'A'],
  ['history', 'B']
]);
const lancashireAdvanced = advancedGradeSubjects([
  ['chemistry', 'A'],
  ['biology', 'A'],
  ['mathematics', 'A']
]);
const lancashireMixedHighers = gradeSubjects([
  ['biology', 'A']
]);
const lancashireMixedAdvanced = advancedGradeSubjects([
  ['chemistry', 'A'],
  ['mathematics', 'A']
]);
const nottinghamHighers = gradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A'],
  ['mathematics', 'A'],
  ['english_language', 'A'],
  ['history', 'B']
]);
const nottinghamAdvanced = advancedGradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A']
]);
const leedsHighers = gradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A'],
  ['mathematics', 'A'],
  ['english', 'A'],
  ['history', 'B']
]);
const leedsAdvanced = advancedGradeSubjects([
  ['biology', 'A'],
  ['chemistry', 'A']
]);
const leedsContextualHighers = gradeSubjects([
  ['biology', 'B'],
  ['chemistry', 'B'],
  ['mathematics', 'A'],
  ['english', 'A'],
  ['history', 'B']
]);
const leedsContextualAdvanced = advancedGradeSubjects([
  ['biology', 'B'],
  ['chemistry', 'B']
]);

for (const id of ['exeter-a100', 'lancashire-a100', 'nottingham-a100', 'leeds-a100']) {
  const routes = config(id).eligibility.qualification_routes;
  assert.ok(routes.supported.includes('scottish'), `${id}: Scottish supported`);
  assert.ok(!(routes.manual_review || []).includes('scottish'), `${id}: Scottish not manual review`);
  assert.ok(!(routes.explicitly_blocked || []).includes('scottish'), `${id}: Scottish not blocked`);
  assert.deepStrictEqual(config(id).eligibility.use_course_eligibility_for_qualification_routes, ['scottish']);
}

assert.strictEqual(course('brunel-university-of-london-a100').stage_1_eligibility.post_16.scottish.route_implemented, false);
assert.ok(config('brunel-university-of-london-a100').eligibility.qualification_routes.manual_review.includes('scottish'));
assert.ok(!config('brunel-university-of-london-a100').eligibility.qualification_routes.explicitly_blocked.includes('scottish'));

assertEligibility('exeter-a100', aLevelApplicant('exeter-a100', 'England'), 'eligible', 'a_level');
assertEligibility('exeter-a100', aLevelApplicant('exeter-a100', 'Scotland'), 'eligible', 'a_level');
assertScottishAccepted(
  'exeter-a100',
  scottishApplicant('exeter-a100', 'England', exeterHighers),
  'exeter_scottish_highers_aaaaa'
);
assertScottishAccepted(
  'exeter-a100',
  scottishApplicant('exeter-a100', 'Scotland', exeterHighers),
  'exeter_scottish_highers_aaaaa'
);
assertScottishAccepted(
  'exeter-a100',
  scottishApplicant('exeter-a100', 'England', [], exeterAdvanced),
  'exeter_scottish_advanced_highers_aaa'
);
assertScottishRejected(
  'exeter-a100',
  scottishApplicant('exeter-a100', 'England', merge(exeterHighers, { 1: { grade: 'B', predicted_grade: 'B' } }))
);

assertScottishAccepted(
  'lancashire-a100',
  scottishApplicant('lancashire-a100', 'England', lancashireHighers),
  'lancashire_scottish_highers_aaaab'
);
assertScottishAccepted(
  'lancashire-a100',
  scottishApplicant('lancashire-a100', 'Scotland', [], lancashireAdvanced),
  'lancashire_scottish_advanced_highers_aaa'
);
assertScottishAccepted(
  'lancashire-a100',
  scottishApplicant('lancashire-a100', 'England', lancashireMixedHighers, lancashireMixedAdvanced),
  'lancashire_scottish_mixed_aa_ah_plus_a_higher'
);
assertScottishRejected(
  'lancashire-a100',
  scottishApplicant('lancashire-a100', 'England', lancashireHighers.filter((subject) => subject.subject_id !== 'chemistry'))
);

assertScottishAccepted(
  'nottingham-a100',
  scottishApplicant('nottingham-a100', 'England', nottinghamHighers, nottinghamAdvanced),
  'nottingham_scottish_highers_aaaab_plus_advanced_highers_aa_biology_chemistry'
);
{
  const result = assertEligibility(
    'nottingham-a100',
    scottishApplicant('nottingham-a100', 'England', nottinghamHighers),
    'manual_review',
    'scottish'
  );
  assert.ok(result.manual_review_reasons.includes('nottingham_scottish_advanced_highers_required'));
  assert.strictEqual(
    assertClassifierRoute(
      'nottingham-a100',
      scottishApplicant('nottingham-a100', 'England', nottinghamHighers),
      'manual_review',
      'scottish'
    ).canonical_interview_band,
    'insufficient_evidence'
  );
}
assertScottishRejected(
  'nottingham-a100',
  scottishApplicant('nottingham-a100', 'Scotland', [], nottinghamAdvanced)
);
assertScottishRejected(
  'nottingham-a100',
  scottishApplicant('nottingham-a100', 'England', nottinghamHighers.filter((subject) => subject.subject_id !== 'english_language'))
);

assertScottishAccepted(
  'leeds-a100',
  scottishApplicant('leeds-a100', 'England', leedsHighers),
  'leeds_scottish_standard_highers_aaaab'
);
assertScottishAccepted(
  'leeds-a100',
  scottishApplicant('leeds-a100', 'Scotland', [], leedsAdvanced),
  'leeds_scottish_standard_advanced_highers_aa_biology_chemistry'
);
assertScottishRejected(
  'leeds-a100',
  scottishApplicant('leeds-a100', 'England', leedsContextualHighers)
);

{
  const applicant = aLevelApplicant('exeter-a100', 'England', {
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  });
  const contextual = evaluateContextualEligibility(course('exeter-a100'), applicant);
  assert.strictEqual(contextual.status, 'contextual');
  assertEligibility('exeter-a100', applicant, 'eligible', 'a_level', 'exeter_contextual_aab');
  assert.strictEqual(
    config('exeter-a100').score_model.components.some((component) => component.component_id === 'wp_contextual_uplift'),
    true
  );
}

{
  const applicant = aLevelApplicant('exeter-a100', 'England', {
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_flags: {
        wp2: true
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  });
  const contextual = evaluateContextualEligibility(course('exeter-a100'), applicant);
  assert.strictEqual(contextual.status, 'not_contextual');
  assertEligibility('exeter-a100', applicant, 'not_eligible', 'a_level');
}

{
  const applicant = aLevelApplicant('exeter-a100', 'England', {
    contextual_profile: {
      home_area_region: {
        polar4_quintile: 'q1'
      }
    }
  });
  const contextual = evaluateContextualEligibility(course('exeter-a100'), applicant);
  assert.strictEqual(contextual.status, 'information_needed');
  assert.strictEqual(contextual.manual_review_reason, 'exeter_contextual_evidence_needs_review');
}

{
  const applicant = aLevelApplicant('leeds-a100', 'England', {
    contextual_profile: {
      access_programmes: {
        other_programmes: [
          { programme_id: 'access_to_leeds', status: 'completed' }
        ]
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'B', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  });
  const contextual = evaluateContextualEligibility(course('leeds-a100'), applicant);
  assert.strictEqual(contextual.status, 'contextual');
  assert.ok(contextual.activated_applicant_group_ids.includes('access_to_leeds_confirmed'));
  assertEligibility('leeds-a100', applicant, 'eligible', 'a_level', 'leeds_access_to_leeds_abb');
}

{
  const applicant = aLevelApplicant('leeds-a100', 'England', {
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_flags: {
        access_to_leeds: true
      }
    },
    contextual_evidence: {
      access_to_leeds: {
        verified: true
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'B', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  });
  assert.strictEqual(evaluateContextualEligibility(course('leeds-a100'), applicant).status, 'not_contextual');
  assertEligibility('leeds-a100', applicant, 'not_eligible', 'a_level');
}

{
  const applicant = aLevelApplicant('leeds-a100', 'England', {
    contextual_profile: {
      access_programmes: {
        other_programmes: [
          { programme_id: 'access_to_leeds', status: 'participating' }
        ]
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'B', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'B' }
      ]
    }
  });
  assert.strictEqual(evaluateContextualEligibility(course('leeds-a100'), applicant).status, 'information_needed');
  const result = assertEligibility('leeds-a100', applicant, 'manual_review', 'a_level');
  assert.ok(result.manual_review_reasons.includes('leeds_access_to_leeds_evidence_needs_review'));
}

{
  const applicant = scottishApplicant('leeds-a100', 'England', leedsContextualHighers, [], {
    contextual_profile: {
      access_programmes: {
        other_programmes: [
          { programme_id: 'access_to_leeds', status: 'completed' }
        ]
      }
    }
  });
  assertScottishAccepted('leeds-a100', applicant, 'leeds_scottish_access_to_leeds_highers_aabbb');
}

{
  const applicant = scottishApplicant('leeds-a100', 'Scotland', [], leedsContextualAdvanced, {
    contextual_profile: {
      access_programmes: {
        other_programmes: [
          { programme_id: 'access_to_leeds', status: 'completed' }
        ]
      }
    }
  });
  assertScottishAccepted('leeds-a100', applicant, 'leeds_scottish_access_to_leeds_advanced_highers_bb');
}

{
  const id = 'brunel-university-of-london-a100';
  assertEligibility(id, aLevelApplicant(id, 'Scotland'), 'eligible', 'a_level');
  const applicant = scottishApplicant(id, 'England', gradeSubjects([
    ['biology', 'A'],
    ['chemistry', 'A'],
    ['mathematics', 'A']
  ]));
  const direct = assertEligibility(id, applicant, 'manual_review', 'scottish');
  assert.ok(direct.manual_review_reasons.includes('brunel_scottish_level_structure_requires_manual_review'));
  const classified = assertClassifierRoute(id, applicant, 'manual_review', 'scottish');
  assert.ok(!classified.eligibility.failures.includes('qualification_route_explicitly_blocked:scottish'));
  const [prediction] = predict({ universityIds: [id], studentProfile: applicant });
  assert.strictEqual(prediction.result_card.recommendation_display_state, 'manual_review');
  assert.doesNotMatch(JSON.stringify(prediction.result_card), /a_level_requirements_not_met/);
}

{
  const [prediction] = predict({
    universityIds: ['exeter-a100'],
    studentProfile: scottishApplicant('exeter-a100', 'England', exeterHighers)
  });
  assert.ok(
    prediction.result_card.academic_requirement_checks.some((check) => {
      return check.qualification_type === 'scottish' &&
        check.requirement_type === 'scottish_post_16_requirements' &&
        check.status === 'met';
    }),
    'Result Card should render Scottish academic checks from structured eligibility.'
  );
  assert.doesNotMatch(JSON.stringify(prediction.result_card), /EPQ|epq/);
}

for (const domicile of ['England', 'Scotland']) {
  const [prediction] = predict({
    universityIds: ['leeds-a100'],
    studentProfile: scottishApplicant('leeds-a100', domicile, leedsHighers, [], {
      admissions_tests: {
        ucat: {
          taken: true,
          test_year: 2026,
          total_score: 2400,
          score_scale: 2700,
          sjt_band: 2,
          subtests: {
            verbal_reasoning: 800,
            decision_making: 800,
            quantitative_reasoning: 800
          }
        }
      }
    })
  });
  assert.strictEqual(prediction.result_card.primary_user_facing_recommendation, 'Prediction Unavailable');
  assert.strictEqual(prediction.result_card.academic_pathway_id, 'leeds_scottish_standard_highers_aaaab');
  assert.strictEqual(prediction.result_card.decision_transparency.insufficient_evidence_reason_code, 'university_methodology_gap');
  assert.doesNotMatch(JSON.stringify(prediction.result_card), /best eight GCSEs|zero GCSEs/);
}

for (const domicile of ['England', 'Scotland']) {
  const [prediction] = predict({
    universityIds: ['nottingham-a100'],
    studentProfile: scottishApplicant('nottingham-a100', domicile, nottinghamHighers, nottinghamAdvanced, {
      admissions_tests: {
        ucat: {
          taken: true,
          test_year: 2026,
          total_score: 2400,
          score_scale: 2700,
          sjt_band: 2,
          subtests: {
            verbal_reasoning: 800,
            decision_making: 800,
            quantitative_reasoning: 800
          }
        }
      }
    })
  });
  assert.strictEqual(prediction.result_card.primary_user_facing_recommendation, 'Prediction Unavailable');
  assert.strictEqual(
    prediction.result_card.academic_pathway_id,
    'nottingham_scottish_highers_aaaab_plus_advanced_highers_aa_biology_chemistry'
  );
  assert.strictEqual(prediction.result_card.decision_transparency.insufficient_evidence_reason_code, 'university_methodology_gap');
  assert.doesNotMatch(JSON.stringify(prediction.result_card), /additional applicant information|A-level fallback/);
}

console.log('Batch 6 Step 4 contextual + Scottish regression: PASS');
