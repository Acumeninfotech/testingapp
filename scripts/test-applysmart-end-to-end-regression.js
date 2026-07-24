#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateNottinghamA100
} = require('../assets/js/engine/nottingham-a100-consumer');
const {
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');
const {
  normaliseApplicantProfile
} = require('../assets/js/engine/applicant-profile-normaliser');

const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'data', 'examples');
const universitiesDir = path.join(rootDir, 'data', 'universities');
const configsDir = path.join(rootDir, 'data', 'interview-band-configs');

const RECOMMENDATION_BY_BAND = {
  very_strong_interview_potential: 'Very Strong Choice',
  interview_likely: 'Strong choice',
  realistic: 'Good chance – recommend applying',
  ambitious: 'Possible but ambitious',
  high_risk: 'Consider stronger alternatives',
  eligible_to_apply: 'Eligible to Apply',
  insufficient_evidence: 'Consider stronger alternatives',
  not_eligible: 'Consider stronger alternatives'
};

const HISTORICAL_ASSESSMENT_BY_BAND = {
  very_strong_interview_potential: 'Well above historical interview range',
  interview_likely: 'Above historical interview range',
  realistic: 'Within historical interview range',
  ambitious: 'Slightly below historical interview range',
  high_risk: 'Well below historical interview range'
};

const EXPECTED_RESULTS = {
  'aberdeen-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'anglia-ruskin-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'aston-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'birmingham-a100': {
    eligibility: 'Eligible',
    production_band: 'high_risk',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: 'Well below historical interview range'
  },
  'bristol-a100': {
    eligibility: 'Eligible',
    production_band: 'high_risk',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: 'Well below historical interview range'
  },
  'brunel-university-of-london-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'cambridge-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'cardiff-a100': {
    eligibility: 'Eligible',
    production_band: 'high_risk',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: 'Well below historical interview range'
  },
  'dundee-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'edinburgh-a100': {
    eligibility: 'Eligible',
    production_band: 'realistic',
    recommendation: 'Good chance – recommend applying',
    historical_assessment: 'Within historical interview range'
  },
  'east-anglia-a100': {
    eligibility: 'Eligible',
    production_band: 'realistic',
    recommendation: 'Good chance – recommend applying',
    historical_assessment: 'Within historical interview range'
  },
  'edge-hill-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'exeter-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'glasgow-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'hull-york-a100': {
    eligibility: 'Eligible',
    production_band: 'ambitious',
    recommendation: 'Possible but ambitious',
    historical_assessment: 'Slightly below historical interview range'
  },
  'imperial-college-london-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'keele-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'kent-and-medway-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong Interview Potential',
    historical_assessment: 'Above historical interview range'
  },
  'king-s-college-london-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'lancashire-a100': {
    eligibility: 'Eligible',
    production_band: 'eligible_to_apply',
    recommendation: 'Eligible to Apply',
    historical_assessment: null
  },
  'lancaster-a100': {
    eligibility: 'Eligible',
    production_band: 'very_strong_interview_potential',
    recommendation: 'Very Strong Choice',
    historical_assessment: 'Well above historical interview range'
  },
  'leeds-a100': {
    eligibility: 'Eligible',
    production_band: 'realistic',
    recommendation: 'Realistic Choice',
    historical_assessment: 'Within historical interview range'
  },
  'leicester-a100': {
    eligibility: 'Eligible',
    production_band: 'ambitious',
    recommendation: 'Possible but ambitious',
    historical_assessment: 'Slightly below historical interview range'
  },
  'lincoln-a100': {
    eligibility: 'Eligible',
    production_band: 'high_risk',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: 'Well below historical interview range'
  },
  'liverpool-a100': {
    eligibility: 'Eligible',
    production_band: 'very_strong_interview_potential',
    recommendation: 'Very Strong Choice',
    historical_assessment: 'Well above historical interview range'
  },
  'manchester-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'newcastle-a100': {
    eligibility: 'Eligible',
    production_band: 'realistic',
    recommendation: 'Good chance – recommend applying',
    historical_assessment: 'Within historical interview range'
  },
  'nottingham-a100': {
    eligibility: 'Eligible',
    production_band: 'ambitious',
    recommendation: 'Possible but ambitious',
    historical_assessment: 'Slightly below historical interview range'
  },
  'oxford-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'plymouth-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'queen-mary-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'queen-s-belfast-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  },
  'sheffield-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'southampton-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'st-andrews-a100': {
    eligibility: 'Eligible',
    production_band: 'interview_likely',
    recommendation: 'Strong choice',
    historical_assessment: 'Above historical interview range'
  },
  'sunderland-a100': {
    eligibility: 'Eligible',
    production_band: 'realistic',
    recommendation: 'Good chance – recommend applying',
    historical_assessment: 'Within historical interview range'
  },
  'ucl-a100': {
    eligibility: 'Not Eligible',
    production_band: 'not_eligible',
    recommendation: 'Consider stronger alternatives',
    historical_assessment: null
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getProfileId(card) {
  return (
    card.course_identity?.profile_id ||
    card.engine_notes?.generated_from_profile_id ||
    card.profile_id ||
    null
  );
}

function isCompletedCard(card) {
  const readiness = card.readiness || {};
  const notes = card.engine_notes || {};
  const prediction = card.prediction || {};

  if (card.production_state?.profile_active === false) {
    return false;
  }

  return Boolean(
    readiness.result_card_ready ||
    readiness.eligibility_ready ||
    readiness.interview_prediction_ready ||
    readiness.research_foi_pre_interview_score_ready ||
    notes.result_card_ready ||
    notes.interview_prediction_ready ||
    prediction.available === true ||
    card.eligibility?.status
  );
}

function loadApplicant() {
  const template = readJson(
    path.join(rootDir, 'data', 'templates', 'student-profile-template.json')
  );
  const applicant = template.sample_profiles.find((profile) => {
    return profile.profile_id === 'test_case_9_aaa_all_7s_ucat_2200_ruk';
  });

  assert.ok(applicant, 'The submitted applicant fixture must exist.');

  assert.deepStrictEqual(applicant.course_target, {
    discipline: 'medicine',
    ucas_code: 'A100',
    course_route: 'standard',
    entry_route: 'standard_medicine_a100'
  });
  assert.deepStrictEqual(applicant.applicant_identity, {
    applicant_type: 'ruk',
    fee_status: 'rest_of_uk_roi_fee_rate',
    domicile: 'england',
    contextual: false,
    contextual_flags: {
      plus_flag: false,
      flag: false,
      simd20: false,
      simd40: false,
      polar_quintile: null,
      imd_quintile: null,
      care_experienced: false,
      refugee: false,
      asylum_seeker: false,
      ucat_bursary: false,
      school_contextual_indicator: false,
      free_school_meals: false,
      first_generation_higher_education: false
    },
    graduate: false,
    resit: {
      has_resits: false,
      exceptional_circumstances_evidence: false,
      subjects_resat: []
    }
  });
  assert.deepStrictEqual(applicant.gcse_profile.subjects, {
    english_language: '7',
    english_literature: '7',
    mathematics: '7',
    biology: '7',
    chemistry: '7',
    physics: '7',
    combined_science: null
  });
  assert.deepStrictEqual(applicant.gcse_profile.additional_subjects, [
    { subject_id: 'history', grade: '7' },
    { subject_id: 'geography', grade: '7' },
    { subject_id: 'french', grade: '7' },
    { subject_id: 'computer_science', grade: '7' }
  ]);
  assert.strictEqual(applicant.gcse_profile.total_gcse_count, 10);
  assert.deepStrictEqual(
    applicant.gcse_profile.top_8_gcse_grades,
    ['7', '7', '7', '7', '7', '7', '7', '7']
  );
  assert.strictEqual(applicant.a_level_profile.science_practical_endorsement, 'pass');
  assert.deepStrictEqual(
    applicant.a_level_profile.subjects.map((subject) => {
      return [
        subject.subject_id,
        subject.predicted_grade,
        subject.sitting_status,
        Object.prototype.hasOwnProperty.call(subject, 'practical_endorsement')
      ];
    }),
    [
      ['biology', 'A', 'first_sitting', false],
      ['chemistry', 'A', 'first_sitting', false],
      ['mathematics', 'A', 'first_sitting', false]
    ]
  );
  assert.deepStrictEqual(applicant.admissions_tests.ucat, {
    total_score: 2200,
    score_scale: 2700,
    subtests: {
      verbal_reasoning: 730,
      decision_making: 730,
      quantitative_reasoning: 740
    },
    sjt_band: 2
  });
  assert.strictEqual(applicant.graduate_profile.is_graduate, false);

  const normalised = normaliseApplicantProfile(applicant);
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(
      normalised.a_level_profile,
      'science_practical_endorsement'
    ),
    false
  );
  assert.deepStrictEqual(
    normalised.a_level_profile.subjects.map((subject) => {
      return [subject.subject_id, subject.practical_endorsement];
    }),
    [
      ['biology', 'pass'],
      ['chemistry', 'pass'],
      ['mathematics', null]
    ],
    'The single submitted science practical answer must be expanded before evaluation.'
  );

  return applicant;
}

function discoverCompletedCards() {
  return fs.readdirSync(examplesDir)
    .filter((fileName) => /-a\d{3}-result-card\.example\.json$/.test(fileName))
    .map((fileName) => readJson(path.join(examplesDir, fileName)))
    .filter(isCompletedCard)
    .map(getProfileId)
    .sort();
}

function evaluateGenericCourse(profileId, applicant) {
  const course = readJson(path.join(universitiesDir, `${profileId}.json`));
  const config = readJson(path.join(configsDir, `${profileId}.json`));
  const classification = classifyInterviewBand(course, config, applicant);
  const band = classification.canonical_interview_band;
  const presentation = config.score_model?.presentation || {};
  const suppressScoreDetails = presentation.hide_selection_score_details === true ||
    presentation.hide_score_breakdown === true;

  return {
    profile_id: profileId,
    university: course.university.name,
    eligibility:
      classification.eligibility.status === 'eligible' ? 'Eligible' : 'Not Eligible',
    production_band: band,
    recommendation: suppressScoreDetails
      ? presentation.band_recommendations?.[band] || RECOMMENDATION_BY_BAND[band]
      : RECOMMENDATION_BY_BAND[band],
    reason: suppressScoreDetails
      ? presentation.band_explanations?.[band] || presentation.selection_summary || classification.explanation
      : classification.explanation,
    historical_assessment: HISTORICAL_ASSESSMENT_BY_BAND[band] || null
  };
}

function evaluateNottingham(applicant) {
  const profileId = 'nottingham-a100';
  const course = readJson(path.join(universitiesDir, `${profileId}.json`));
  const config = readJson(path.join(configsDir, `${profileId}.json`));
  const evaluation = evaluateNottinghamA100(course, applicant, {
    interviewBandConfig: config
  });
  const comparison = evaluation.interview_band_guidance.historical_comparison;
  const band = {
    above: 'interview_likely',
    within: 'realistic',
    below: 'ambitious'
  }[comparison] || 'insufficient_evidence';

  return {
    profile_id: profileId,
    university: course.university.name,
    eligibility:
      evaluation.eligibility.status === 'eligible' ? 'Eligible' : 'Not Eligible',
    production_band: band,
    recommendation: RECOMMENDATION_BY_BAND[band],
    reason:
      `${evaluation.eligibility.message} Official score ${evaluation.official_score.value}/82; ` +
      `${evaluation.interview_band_guidance.guidance_label} ` +
      `(${evaluation.interview_band_guidance.historical_typical_range.min}–` +
      `${evaluation.interview_band_guidance.historical_typical_range.max}).`,
    historical_assessment: HISTORICAL_ASSESSMENT_BY_BAND[band] || null
  };
}

function evaluateHullYork(applicantInput) {
  const profileId = 'hull-york-a100';
  const course = readJson(path.join(universitiesDir, `${profileId}.json`));
  const config = readJson(path.join(configsDir, `${profileId}.json`));
  const applicant = JSON.parse(JSON.stringify(applicantInput));
  applicant.applicant_identity.age_on_1_october = 18;
  const evaluation = evaluateHullYorkA100(course, config, applicant);
  const band = evaluation.canonical_interview_band;

  return {
    profile_id: profileId,
    university: course.university.name,
    eligibility:
      evaluation.eligibility.status === 'eligible' ? 'Eligible' : 'Not Eligible',
    production_band: band,
    recommendation: RECOMMENDATION_BY_BAND[band],
    reason: evaluation.explanation,
    historical_assessment: HISTORICAL_ASSESSMENT_BY_BAND[band] || null
  };
}

function summarize(results) {
  const count = (label) => {
    return results.filter((result) => result.recommendation === label).length;
  };

  return {
    total_universities_analysed: results.length,
    eligible: results.filter((result) => result.eligibility === 'Eligible').length,
    not_eligible: results.filter((result) => result.eligibility === 'Not Eligible').length,
    very_strong_choices: count('Very Strong Choice'),
    strong_choices: count('Strong choice'),
    eligible_to_apply: count('Eligible to Apply'),
    good_chance_recommend_applying: count('Good chance – recommend applying'),
    possible_but_ambitious: count('Possible but ambitious'),
    realistic_choice: count('Realistic Choice'),
    consider_stronger_alternatives: count('Consider stronger alternatives')
  };
}

function printResults(results, totals) {
  for (const result of results) {
    console.log(result.university);
    console.log('');
    console.log('Eligibility:');
    console.log(result.eligibility);
    console.log('');
    console.log('Interview Recommendation:');
    console.log(result.recommendation);
    console.log('');
    console.log('Reason');
    console.log(result.reason);
    console.log('');
    console.log('Historical Assessment');
    console.log(
      result.historical_assessment ||
      'Not assessed by production rules because eligibility or required ranking evidence is unavailable.'
    );
    console.log('');
  }

  console.log(`Total universities analysed: ${totals.total_universities_analysed}`);
  console.log(`Eligible: ${totals.eligible}`);
  console.log(`Not eligible: ${totals.not_eligible}`);
  console.log(`Very Strong Choice: ${totals.very_strong_choices}`);
  console.log(`Strong choice: ${totals.strong_choices}`);
  console.log(`Eligible to Apply: ${totals.eligible_to_apply}`);
  console.log(`Good chance – recommend applying: ${totals.good_chance_recommend_applying}`);
  console.log(`Possible but ambitious: ${totals.possible_but_ambitious}`);
  console.log(`Realistic Choice: ${totals.realistic_choice}`);
  console.log(`Consider stronger alternatives: ${totals.consider_stronger_alternatives}`);
}

const applicant = loadApplicant();
const completedProfileIds = discoverCompletedCards();

assert.deepStrictEqual(
  completedProfileIds,
  Object.keys(EXPECTED_RESULTS).sort(),
  'Every completed university must be covered exactly once by the regression snapshot.'
);

const results = completedProfileIds.map((profileId) => {
  if (profileId === 'nottingham-a100') {
    return evaluateNottingham(applicant);
  }
  if (profileId === 'hull-york-a100') {
    return evaluateHullYork(applicant);
  }
  return evaluateGenericCourse(profileId, applicant);
});

for (const result of results) {
  assert.deepStrictEqual(
    {
      eligibility: result.eligibility,
      production_band: result.production_band,
      recommendation: result.recommendation,
      historical_assessment: result.historical_assessment
    },
    EXPECTED_RESULTS[result.profile_id],
    `${result.profile_id} result changed.`
  );
  assert.ok(result.reason, `${result.profile_id} must include a production reason.`);
}

const totals = summarize(results);
assert.deepStrictEqual(totals, {
  total_universities_analysed: 37,
  eligible: 26,
  not_eligible: 11,
  very_strong_choices: 2,
  strong_choices: 10,
  eligible_to_apply: 1,
  good_chance_recommend_applying: 4,
  possible_but_ambitious: 3,
  realistic_choice: 1,
  consider_stronger_alternatives: 15
});

printResults(results, totals);
