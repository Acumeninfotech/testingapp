#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { classifyInterviewBand } = require('../assets/js/engine/interview-band-classifier');
const { evaluateCourseEligibility } = require('../assets/js/engine/eligibility-evaluator');
const { predict } = require('../server/src/predict');

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

const course = readJson('data/universities/leicester-a100.json');
const config = readJson('data/interview-band-configs/leicester-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/leicester-a100.json');

function ucatSubtests(total = 2200) {
  if (total === 2200) {
    return { verbal_reasoning: 700, decision_making: 750, quantitative_reasoning: 750 };
  }
  if (total === 1780) {
    return { verbal_reasoning: 590, decision_making: 590, quantitative_reasoning: 600 };
  }
  if (total === 1770) {
    return { verbal_reasoning: 590, decision_making: 590, quantitative_reasoning: 590 };
  }
  return { verbal_reasoning: 700, decision_making: 700, quantitative_reasoning: 700 };
}

function predictedSubjects(grades) {
  return [
    { subject_id: 'chemistry', predicted_grade: grades[0], sitting_status: 'first_sitting' },
    { subject_id: 'biology', predicted_grade: grades[1], sitting_status: 'first_sitting' },
    { subject_id: 'mathematics', predicted_grade: grades[2], sitting_status: 'first_sitting' }
  ];
}

function achievedSubjects(grades) {
  return [
    { subject_id: 'chemistry', achieved_grade: grades[0], sitting_status: 'first_sitting' },
    { subject_id: 'biology', achieved_grade: grades[1], sitting_status: 'first_sitting' },
    { subject_id: 'mathematics', achieved_grade: grades[2], sitting_status: 'first_sitting' }
  ];
}

function baseApplicant(overrides = {}) {
  return merge(fixture.base_applicant, merge({
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: ucatSubtests(2200),
        sjt_band: 2,
        test_year: 2026
      }
    }
  }, overrides));
}

function classify(overrides = {}) {
  return classifyInterviewBand(course, config, baseApplicant(overrides));
}

function eligibility(overrides = {}) {
  return evaluateCourseEligibility(course, baseApplicant(overrides));
}

function predictLeicester(overrides = {}) {
  return predict({
    universityIds: ['leicester-a100'],
    studentProfile: baseApplicant(overrides)
  })[0];
}

function programmeRecord(programmeId, status = 'completed') {
  return [{ programme_id: programmeId, status }];
}

function structuredAccessLeicester(programmeStatus = 'completed', provider = 'leicester-a100', completionYear = 2026) {
  return {
    status: 'yes',
    programme_id: 'leicester_accessleicester_medicine',
    programme_status: programmeStatus,
    provider_university_id: provider,
    completion_year: completionYear
  };
}

function assertNoLeicesterContextual(result, message) {
  assert.ok(!result.applicant_group_ids.includes('leicester_contextual_access_leicester_medicine'), message);
  assert.ok(!result.applicant_group_ids.includes('leicester_contextual_realising_opportunities'), message);
  assert.ok(!result.applicant_group_ids.includes('leicester_contextual_imd_plus_indicator'), message);
}

assert.strictEqual(course.profile_id, 'leicester-a100');
assert.strictEqual(course.contextual_admissions.evaluator_id, 'leicester_contextual_medicine_a100');
assert.strictEqual(config.course_profile_id, 'leicester-a100');
assert.strictEqual(config.eligibility.map_override.apply_ucat_guidance_band, false);

// Standard and EPQ routes remain available
const standard = classify();
assert.strictEqual(standard.eligibility.status, 'eligible');
assert.strictEqual(standard.eligibility.academic_pathway_id, 'a_level_standard_offer');
const epqRoute = classify({
  a_level_profile: {
    subjects: predictedSubjects(['A', 'A', 'A']),
    epq: { status: 'predicted', grade: 'B', taken_alongside_a_levels: true }
  }
});
assert.strictEqual(epqRoute.eligibility.status, 'eligible');
assert.strictEqual(epqRoute.eligibility.academic_pathway_id, 'leicester_epq_alternative');

// Access Leicester: Medicine contextual route
const accessAbb = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessAbb.eligibility.status, 'eligible');
assert.strictEqual(accessAbb.eligibility.contextual_eligibility.status, 'contextual');
assert.strictEqual(accessAbb.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_access_leicester_medicine_contextual');
assert.strictEqual(accessAbb.eligibility.academic_pathway_id, 'leicester_access_leicester_medicine_contextual_offer');
assert.strictEqual(accessAbb.interview_outcome, 'guaranteed_interview');

const accessAchievedAaa = classify({
  a_level_profile: { subjects: achievedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessAchievedAaa.eligibility.status, 'eligible');
assert.strictEqual(accessAchievedAaa.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_access_leicester_medicine_contextual');
assert.strictEqual(accessAchievedAaa.interview_outcome, 'guaranteed_interview');

const accessBelowAbb = classify({
  a_level_profile: { subjects: predictedSubjects(['B', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessBelowAbb.eligibility.status, 'not_eligible');
const accessBelowAbbEligibility = eligibility({
  a_level_profile: { subjects: predictedSubjects(['B', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessBelowAbbEligibility.contextual_eligibility.status, 'not_contextual');

const accessGcseFail = classify({
  gcse_profile: {
    subjects: {
      english_language: '5',
      mathematics: '9',
      chemistry: '9',
      biology: '9',
      physics: '9',
      business_studies: '8',
      religious_studies: '6',
      french: '5'
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessGcseFail.eligibility.status, 'not_eligible');

const accessUcatThresholdBoundary = classify({
  admissions_tests: {
    ucat: {
      total_score: 1780,
      score_scale: 2700,
      subtests: ucatSubtests(1780),
      sjt_band: 2,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
const accessUcatThresholdBoundaryEligibility = eligibility({
  admissions_tests: {
    ucat: {
      total_score: 1780,
      score_scale: 2700,
      subtests: ucatSubtests(1780),
      sjt_band: 2,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessUcatThresholdBoundaryEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(accessUcatThresholdBoundary.eligibility.academic_pathway_id, 'a_level_standard_offer');

const accessSjtBand4 = classify({
  admissions_tests: {
    ucat: {
      total_score: 2200,
      score_scale: 2700,
      subtests: ucatSubtests(2200),
      sjt_band: 4,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(accessSjtBand4.eligibility.status, 'not_eligible');

const accessNotSelected = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) }
});
assertNoLeicesterContextual(
  accessNotSelected,
  'Access Leicester route must not activate when the programme is not selected.'
);

// Realising Opportunities contextual route
const ropAaaPredicted = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('realising_opportunities', 'completed')
    }
  }
});
assert.strictEqual(ropAaaPredicted.eligibility.status, 'eligible');
assert.strictEqual(ropAaaPredicted.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_realising_opportunities_contextual');
assert.strictEqual(ropAaaPredicted.eligibility.academic_pathway_id, 'leicester_realising_opportunities_contextual_offer');
assert.strictEqual(ropAaaPredicted.interview_outcome, 'guaranteed_interview');

const ropAaaAchieved = classify({
  a_level_profile: { subjects: achievedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('realising_opportunities', 'completed')
    }
  }
});
assert.strictEqual(ropAaaAchieved.eligibility.status, 'eligible');
assert.strictEqual(ropAaaAchieved.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_realising_opportunities_contextual');

const ropAbbPredicted = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('realising_opportunities', 'completed')
    }
  }
});
assert.strictEqual(ropAbbPredicted.eligibility.status, 'not_eligible');
const ropAbbPredictedEligibility = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('realising_opportunities', 'completed')
    }
  }
});
assert.strictEqual(ropAbbPredictedEligibility.contextual_eligibility.status, 'not_contextual');

// IMD route
const imdOnly = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' }
  }
});
const imdOnlyEligibility = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' }
  }
});
assert.strictEqual(imdOnlyEligibility.contextual_eligibility.status, 'not_contextual');

function assertImdIndicatorRoute(indicatorPatch) {
  const result = classify({
    a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
    contextual_profile: {
      home_area_region: { imd_quintile: 'q1' },
      ...indicatorPatch
    }
  });
  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(result.eligibility.contextual_eligibility.status, 'contextual');
  assert.strictEqual(result.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_imd_plus_indicator_contextual');
  assert.strictEqual(result.eligibility.academic_pathway_id, 'leicester_imd_plus_indicator_contextual_offer');
}

assertImdIndicatorRoute({
  financial_support: { ucat_bursary_recipient: 'yes' }
});
assertImdIndicatorRoute({
  financial_support: { ema_or_16_19_bursary: 'yes' }
});
assertImdIndicatorRoute({
  financial_support: { free_school_meals: 'yes' }
});
const imdFsmScoredRoute = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { free_school_meals: 'yes' }
  }
});
const imdFsmPrediction = predictLeicester({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { free_school_meals: 'yes' }
  }
});
assert.strictEqual(imdFsmScoredRoute.guidance_pool_id, 'leicester_home_predicted_a_level_or_equivalent');
assert.strictEqual(imdFsmScoredRoute.ranking.status, 'calculated');
assert.strictEqual(imdFsmScoredRoute.ranking.max, 96);
assert.ok(Number.isFinite(imdFsmScoredRoute.ranking.components.gcse_score.value));
assert.ok(Number.isFinite(imdFsmScoredRoute.ranking.components.ucat_score.value));
assert.notStrictEqual(imdFsmScoredRoute.interview_outcome, 'guaranteed_interview');
assert.strictEqual(imdFsmPrediction.result_card.prediction.available, true);
assert.strictEqual(imdFsmPrediction.result_card.prediction.guidance_pool_id, 'leicester_home_predicted_a_level_or_equivalent');
assert.strictEqual(imdFsmPrediction.result_card.interview_outcome, null);
assert.strictEqual(
  imdFsmPrediction.result_card.contextual_confirmation.collapsed_label,
  'Contextual eligibility confirmed'
);
assert.strictEqual(
  imdFsmPrediction.result_card.contextual_confirmation.expanded_body,
  'Applicants with two or more contextual markers may be prioritised over applicants with the same score who have fewer or no contextual markers. This does not guarantee an interview.'
);
assertImdIndicatorRoute({
  personal_circumstances: { care_over_three_months: 'yes' }
});

// Broader care declarations do not satisfy Leicester's precise duration rule.
const imdGenericCareOnly = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    personal_circumstances: { care_experienced: 'yes', care_leaver: 'yes', care_over_three_months: 'no' }
  }
});
assert.strictEqual(imdGenericCareOnly.contextual_eligibility.status, 'not_contextual');
assert.ok(!imdGenericCareOnly.contextual_eligibility.activated_applicant_group_ids.includes('leicester_contextual_imd_plus_indicator'));

// AccessLeicester is read from the structured UKWPMED record and provider is verified.
const structuredAccess = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: { access_programmes: { ukwpmed: structuredAccessLeicester() } }
});
assert.strictEqual(structuredAccess.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_access_leicester_medicine_contextual');
assert.strictEqual(structuredAccess.interview_outcome, 'guaranteed_interview');

const wrongAccessProvider = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: { access_programmes: { ukwpmed: structuredAccessLeicester('completed', 'other-university') } }
});
assert.strictEqual(wrongAccessProvider.contextual_eligibility.status, 'not_contextual');

// Exact Sutton Trust Pathways to Medicine completion qualifies; generic Sutton options do not.
const suttonTrust = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: { access_programmes: { other_programmes: programmeRecord('sutton_trust_pathways_to_medicine') } }
});
assert.strictEqual(suttonTrust.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_sutton_trust_pathways_to_medicine_contextual');
assert.strictEqual(suttonTrust.interview_outcome, 'guaranteed_interview');

const genericSutton = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: { access_programmes: { other_programmes: programmeRecord('sutton_trust_online') } }
});
assert.strictEqual(genericSutton.contextual_eligibility.status, 'not_contextual');

// Restricted UKWPMED 2027 requires the precise cycle, first-gap-year and achieved-grade evidence.
const restrictedUkwpmed = classify({
  application_year: 2027,
  applicant_identity: { first_gap_year: true },
  a_level_profile: { subjects: achievedSubjects(['A', 'B', 'B']), sitting_status: 'first_sitting' },
  contextual_profile: { access_programmes: { ukwpmed: structuredAccessLeicester('completed', 'leicester-a100', 2026) } }
});
assert.strictEqual(restrictedUkwpmed.eligibility.contextual_eligibility.matched_contextual_pathway, 'leicester_ukwpmed_restricted_2027');
assert.strictEqual(restrictedUkwpmed.interview_outcome, 'guaranteed_interview');

const restrictedWrongCompletionYear = eligibility({
  application_year: 2027,
  applicant_identity: { first_gap_year: true },
  a_level_profile: { subjects: achievedSubjects(['A', 'B', 'B']), sitting_status: 'first_sitting' },
  contextual_profile: { access_programmes: { ukwpmed: structuredAccessLeicester('completed', 'leicester-a100', 2024) } }
});
assert.strictEqual(restrictedWrongCompletionYear.contextual_eligibility.status, 'not_contextual');

const restrictedMissingFirstGapYear = eligibility({
  application_year: 2027,
  a_level_profile: { subjects: achievedSubjects(['A', 'B', 'B']), sitting_status: 'first_sitting' },
  contextual_profile: { access_programmes: { ukwpmed: structuredAccessLeicester('completed', 'leicester-a100', 2026) } }
});
assert.strictEqual(restrictedMissingFirstGapYear.contextual_eligibility.status, 'not_contextual');

// One science cannot satisfy both halves of Leicester's two-subject rule.
const oneAcceptedSubject = eligibility({
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A' },
      { subject_id: 'history', predicted_grade: 'A' },
      { subject_id: 'geography', predicted_grade: 'A' }
    ]
  },
  contextual_profile: { access_programmes: { other_programmes: programmeRecord('realising_opportunities') } }
});
assert.strictEqual(oneAcceptedSubject.contextual_eligibility.status, 'not_contextual');

const imdQ2Indicator = classify({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q2' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  }
});
const imdQ2IndicatorEligibility = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q2' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  }
});
assert.strictEqual(imdQ2IndicatorEligibility.contextual_eligibility.status, 'not_contextual');

const indicatorWithoutImd = eligibility({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    financial_support: { free_school_meals: 'yes' }
  }
});
assert.strictEqual(indicatorWithoutImd.contextual_eligibility.status, 'not_contextual');
const indicatorWithoutImdPrediction = predictLeicester({
  a_level_profile: { subjects: predictedSubjects(['A', 'A', 'A']) },
  contextual_profile: {
    financial_support: { free_school_meals: 'yes' }
  }
});
assert.strictEqual(indicatorWithoutImdPrediction.result_card.contextual_confirmation, null);

const imdUcatBelowThreshold = classify({
  admissions_tests: {
    ucat: {
      total_score: 1770,
      score_scale: 2700,
      subtests: ucatSubtests(1770),
      sjt_band: 2,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  }
});
const imdUcatBelowThresholdEligibility = eligibility({
  admissions_tests: {
    ucat: {
      total_score: 1770,
      score_scale: 2700,
      subtests: ucatSubtests(1770),
      sjt_band: 2,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  }
});
assert.strictEqual(imdUcatBelowThresholdEligibility.contextual_eligibility.status, 'not_contextual');

const imdSjt4 = classify({
  admissions_tests: {
    ucat: {
      total_score: 2200,
      score_scale: 2700,
      subtests: ucatSubtests(2200),
      sjt_band: 4,
      test_year: 2026
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { free_school_meals: 'yes' }
  }
});
assert.strictEqual(imdSjt4.eligibility.status, 'not_eligible');

const imdGcseFail = classify({
  gcse_profile: {
    subjects: {
      english_language: '5',
      mathematics: '9',
      chemistry: '9',
      biology: '9',
      physics: '9'
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    home_area_region: { imd_quintile: 'q1' },
    financial_support: { free_school_meals: 'yes' }
  }
});
assert.strictEqual(imdGcseFail.eligibility.status, 'not_eligible');

// Generic contextual declarations must not activate Leicester routes
const genericContextualOnly = classify({
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_flags: {
      free_school_meals: true
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) }
});
const genericContextualOnlyEligibility = eligibility({
  applicant_identity: {
    contextual: true,
    widening_participation: true,
    contextual_flags: {
      free_school_meals: true
    }
  },
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) }
});
assert.notStrictEqual(genericContextualOnlyEligibility.contextual_eligibility.status, 'contextual');

// Result card transparency for contextual route
const contextualPrediction = predictLeicester({
  a_level_profile: { subjects: predictedSubjects(['A', 'B', 'B']) },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: programmeRecord('leicester_accessleicester_medicine', 'completed')
    }
  }
});
assert.strictEqual(contextualPrediction.result_card.contextual_status, 'confirmed');

console.log('Leicester A100 contextual routes and result-card regression checks: PASS');
