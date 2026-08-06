#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateNottinghamA100
} = require('../assets/js/engine/nottingham-a100-consumer');

const rootDir = path.resolve(__dirname, '..');
const course = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'data', 'universities', 'nottingham-a100.json'),
    'utf8'
  )
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseApplicant() {
  return {
    profile_id: 'nottingham_consumer_acceptance_applicant',
    qualification_route: 'a_level',
    application_year: 2027,
    entry_year: 2027,
    has_gcse_or_equivalent_results: true,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      widening_participation: false,
      date_of_birth: '2008-06-01',
      resit: {
        has_resits: false
      }
    },
    gcse_profile: {
      subjects: {
        biology: '9',
        chemistry: '9',
        mathematics: '7',
        english_language: '8',
        physics: '9',
        history: '8',
        geography: '7',
        french: '6'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'A', practical_endorsement: null }
      ],
      completed_in_one_sitting: true,
      study_period_years: 2
    },
    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        sjt_band: 2,
        subtests: {
          verbal_reasoning: 750,
          quantitative_reasoning: 650,
          decision_making: 850
        }
      }
    }
  };
}

function hasKey(value, key) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return true;
  }
  return Object.values(value).some((entry) => hasKey(entry, key));
}

const standard = evaluateNottinghamA100(course, baseApplicant());
assert.strictEqual(standard.eligibility.status, 'eligible');
assert.strictEqual(standard.official_score.components.gcse.value, 23);
assert.strictEqual(standard.official_score.components.gcse.max, 32);
assert.strictEqual(standard.official_score.components.ucat_cognitive.value, 32);
assert.strictEqual(standard.official_score.components.ucat_cognitive.max, 40);
assert.strictEqual(standard.official_score.components.sjt.value, 6);
assert.strictEqual(standard.official_score.value, 61);
assert.strictEqual(standard.official_score.max, 82);
assert.strictEqual(standard.interview_prediction.deterministic, false);
assert.strictEqual(hasKey(standard.interview_prediction, 'outcome'), false);
assert.strictEqual(hasKey(standard.interview_prediction, 'probability'), false);
assert.strictEqual(standard.offer_prediction, undefined);
assert.strictEqual(hasKey(standard, 'interview_likelihood'), false);

const failedPracticalApplicant = clone(baseApplicant());
failedPracticalApplicant.a_level_profile.subjects =
  failedPracticalApplicant.a_level_profile.subjects.map((subject) => ({
    ...subject,
    practical_endorsement:
      subject.subject_id === 'chemistry' ? 'fail' : 'pass'
  }));
const failedPractical = evaluateNottinghamA100(
  course,
  failedPracticalApplicant
);
assert.strictEqual(failedPractical.eligibility.status, 'not_eligible');
assert.ok(
  failedPractical.eligibility.checks.some((check) => {
    return check.check_id === 'a_level_AAA_biology_chemistry' &&
      check.practical_endorsements_met === false &&
      check.unconfirmed_practical_endorsement_subject_ids.includes('chemistry');
  })
);

const band4Applicant = clone(baseApplicant());
band4Applicant.admissions_tests.ucat.sjt_band = 4;
const band4 = evaluateNottinghamA100(course, band4Applicant);
assert.strictEqual(band4.eligibility.status, 'not_eligible');
assert.ok(band4.eligibility.failures.includes('sjt_band_4_excludes_interview'));
assert.strictEqual(band4.official_score.components.sjt.value, 0);
assert.strictEqual(band4.official_score.components.sjt.excludes_from_interview, true);
assert.strictEqual(band4.official_score.status, 'calculated_but_excluded_before_ranking');

const contextualApplicant = clone(baseApplicant());
contextualApplicant.applicant_identity.contextual = true;
contextualApplicant.applicant_identity.contextual_status_confirmed = true;
const contextual = evaluateNottinghamA100(course, contextualApplicant);
assert.strictEqual(contextual.contextual_policy.applicable, false);
assert.strictEqual(contextual.contextual_policy.status, 'not_applicable');
assert.strictEqual(contextual.contextual_policy.ranking_bonus_points, 0);
assert.strictEqual(contextual.contextual_policy.effect_stage, 'offer_stage_only');
assert.deepStrictEqual(
  contextual.contextual_policy.offers.map((offer) => offer.offer_grade_profile),
  ['AAB', 'ABB', 'AAB']
);
assert.strictEqual(contextual.official_score.value, standard.official_score.value);

const unverifiedContextualApplicant = clone(baseApplicant());
unverifiedContextualApplicant.applicant_identity.contextual = true;
const unverifiedContextual = evaluateNottinghamA100(course, unverifiedContextualApplicant);
assert.strictEqual(unverifiedContextual.contextual_policy.applicable, false);
assert.strictEqual(
  unverifiedContextual.contextual_policy.status,
  'not_applicable'
);

const ibApplicant = clone(baseApplicant());
ibApplicant.qualification_route = 'international_baccalaureate';
delete ibApplicant.a_level_profile;
ibApplicant.ib_profile = {
  total_points: 34,
  higher_level_subjects: [
    { subject_id: 'biology', grade: 6 },
    { subject_id: 'chemistry', grade: 6 },
    { subject_id: 'history', grade: 6 }
  ]
};
const ib = evaluateNottinghamA100(course, ibApplicant);
assert.strictEqual(ib.eligibility.status, 'eligible');

const btecApplicant = clone(baseApplicant());
btecApplicant.qualification_route = 'btec';
delete btecApplicant.a_level_profile;
btecApplicant.btec_profile = {
  qualification: 'BTEC National'
};
const btec = evaluateNottinghamA100(course, btecApplicant);
assert.strictEqual(btec.eligibility.status, 'not_eligible');
assert.ok(btec.eligibility.failures.includes('qualification_route_not_accepted:btec'));

const unsupportedRoute = clone(baseApplicant());
unsupportedRoute.qualification_route = 'scottish';
delete unsupportedRoute.a_level_profile;
const scottish = evaluateNottinghamA100(course, unsupportedRoute);
assert.strictEqual(scottish.eligibility.status, 'manual_review');
assert.ok(
  scottish.eligibility.manual_review_reasons.includes(
    'qualification_route_is_confirmed_research_gap'
  )
);

const noGcseGraduate = clone(baseApplicant());
noGcseGraduate.qualification_route = 'graduate';
noGcseGraduate.applicant_identity.applicant_type = 'graduate';
noGcseGraduate.applicant_identity.graduate = true;
noGcseGraduate.has_gcse_or_equivalent_results = false;
noGcseGraduate.english_language_equivalence_verified = true;
delete noGcseGraduate.gcse_profile;
delete noGcseGraduate.a_level_profile;
noGcseGraduate.graduate_profile = {
  is_graduate: true,
  degree_classification: '2_1',
  sufficient_biology_content: true,
  mathematics_equivalence_verified: true,
  completed_in_natural_length: true
};
const graduate = evaluateNottinghamA100(course, noGcseGraduate);
assert.strictEqual(graduate.eligibility.status, 'eligible');
assert.strictEqual(graduate.official_score.components.gcse.value, null);
assert.strictEqual(graduate.official_score.value, 38);
assert.strictEqual(graduate.official_score.max, 50);

const internationalApplicant = clone(baseApplicant());
internationalApplicant.applicant_identity.fee_status = 'International';
internationalApplicant.gcse_profile.subjects.english_language = '5';
internationalApplicant.english_language_profile = {
  test: 'IELTS Academic',
  overall: 7.5,
  scores: {
    reading: 7,
    writing: 7,
    listening: 7,
    speaking: 7
  },
  valid_at_course_start: true
};
const international = evaluateNottinghamA100(course, internationalApplicant);
assert.strictEqual(international.eligibility.status, 'eligible');
assert.ok(
  international.eligibility.checks.some((check) => {
    return check.check_id === 'english_language_requirement' && check.status === 'pass';
  })
);

const missingAgeApplicant = clone(baseApplicant());
delete missingAgeApplicant.applicant_identity.date_of_birth;
const missingAge = evaluateNottinghamA100(course, missingAgeApplicant);
assert.strictEqual(missingAge.eligibility.status, 'eligible');
assert.ok(
  missingAge.eligibility.checks.some((check) => {
    return check.check_id === 'minimum_age_requirement' &&
      check.status === 'not_assessed_non_blocking';
  })
);

const belowMinimumAgeApplicant = clone(baseApplicant());
belowMinimumAgeApplicant.applicant_identity.date_of_birth = '2011-09-02';
const belowMinimumAge = evaluateNottinghamA100(course, belowMinimumAgeApplicant);
assert.strictEqual(belowMinimumAge.eligibility.status, 'not_eligible');
assert.ok(
  belowMinimumAge.eligibility.failures.includes('minimum_age_requirement_not_met')
);

const age17BandApplicant = clone(baseApplicant());
age17BandApplicant.applicant_identity.age_at_course_start_band = 'age_17';
delete age17BandApplicant.applicant_identity.date_of_birth;
const age17Band = evaluateNottinghamA100(course, age17BandApplicant);
assert.strictEqual(age17Band.eligibility.status, 'eligible');

const under17BandApplicant = clone(baseApplicant());
under17BandApplicant.applicant_identity.age_at_course_start_band = 'under_17';
under17BandApplicant.applicant_identity.date_of_birth = '2000-01-01';
const under17Band = evaluateNottinghamA100(course, under17BandApplicant);
assert.strictEqual(under17Band.eligibility.status, 'not_eligible');
assert.ok(
  under17Band.eligibility.failures.includes('minimum_age_requirement_not_met')
);

assert.strictEqual(standard.interview_guidance.status, 'guidance_only_non_executable');
assert.strictEqual(standard.interview_guidance.source_type, 'FOI');
assert.strictEqual(
  standard.interview_guidance.suitable_for_interview_band_guidance_only,
  true
);
assert.ok(
  standard.interview_guidance.messages.some((message) => {
    return message.includes('does not publish a fixed interview threshold');
  })
);
assert.ok(
  standard.interview_guidance.messages.some((message) => {
    return message.includes('non-deterministic');
  })
);
assert.strictEqual(standard.safeguards.historical_guidance_executable, false);
assert.strictEqual(standard.safeguards.metadata_activation_enabled, false);
assert.strictEqual(standard.safeguards.result_card_ready, false);
assert.strictEqual(standard.safeguards.interview_band_configuration_present, true);
assert.ok(standard.eligibility.source_ids.length > 0);
assert.ok(standard.official_score.source_ids.length > 0);
assert.ok(standard.contextual_policy.source_ids.length > 0);
assert.ok(standard.interview_guidance.source_ids.length > 0);

console.log('Nottingham A100 evaluator/consumer acceptance tests: PASS');
