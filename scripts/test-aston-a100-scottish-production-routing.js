#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const course = readJson('data/universities/aston-a100.json');
const config = readJson('data/interview-band-configs/aston-a100.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validNational5Subjects() {
  return [
    { subject_id: 'english_language', grade: 'B' },
    { subject_id: 'mathematics', grade: 'B' },
    { subject_id: 'chemistry', grade: 'B' },
    { subject_id: 'biology', grade: 'B' },
    { subject_id: 'physics', grade: 'B' },
    { subject_id: 'history', grade: 'B' }
  ];
}

function validAdvancedHigherSubjects() {
  return [
    { subject_id: 'chemistry', grade: 'A' },
    { subject_id: 'biology', grade: 'A' },
    { subject_id: 'mathematics', grade: 'A' }
  ];
}

function scottishApplicant(overrides = {}) {
  const applicant = {
    profile_id: 'aston_scottish_production_path_valid',
    qualification_route: 'scottish',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual: false,
      contextual_status_confirmed: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    contextual_profile: {
      school_education: {
        state_non_fee_paying_school: 'no'
      },
      financial_support: {
        ucat_bursary_recipient: 'no',
        free_school_meals: 'no'
      }
    },
    scottish_profile: {
      national_5_subjects: validNational5Subjects(),
      advanced_higher_subjects: validAdvancedHigherSubjects()
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 800,
          decision_making: 800,
          quantitative_reasoning: 800
        },
        sjt_band: 2
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };

  return merge(applicant, overrides);
}

function merge(base, overrides) {
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

function predictAston(applicant) {
  const [result] = predict({
    universityIds: ['aston-a100'],
    studentProfile: applicant
  });
  return result.result_card;
}

function assertProductionEligible(applicant) {
  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.eligibility.status, 'eligible');
  assert.notStrictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.ok(
    classification.applicant_group_ids.includes('home_fee'),
    'Scotland domicile should remain in the Home applicant pool.'
  );
  assert.ok(
    classification.applicant_group_ids.includes('scotland_domiciled'),
    'Scotland domicile group should be preserved independently of qualification route.'
  );

  const card = predictAston(applicant);
  assert.notStrictEqual(card.recommendation_display_state, 'not_eligible');
  assert.notStrictEqual(card.prediction.result_band, 'not_eligible');
}

function assertProductionNotEligible(applicant, expectedFailure) {
  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.eligibility.status, 'not_eligible');
  assert.strictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.ok(
    classification.eligibility.failures.includes(expectedFailure),
    `Expected ${expectedFailure}; received ${classification.eligibility.failures.join(', ')}.`
  );

  const card = predictAston(applicant);
  assert.strictEqual(card.recommendation_display_state, 'not_eligible');
  assert.strictEqual(card.prediction.result_band, 'not_eligible');
}

const tests = [
  {
    id: 'scotland_domicile_valid_scottish_qualifications_use_course_eligibility',
    run() {
      assert.deepStrictEqual(
        config.eligibility.use_course_eligibility_for_qualification_routes,
        ['scottish']
      );
      assertProductionEligible(scottishApplicant());
    }
  },
  {
    id: 'advanced_higher_aab_not_eligible',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'mathematics', grade: 'B' }
          ]
        }
      });
      assertProductionNotEligible(applicant, 'scottish_post_16_requirements_not_met');
    }
  },
  {
    id: 'missing_advanced_higher_chemistry_not_eligible',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'physics', grade: 'A' }
          ]
        }
      });
      assertProductionNotEligible(applicant, 'scottish_post_16_requirements_not_met');
    }
  },
  {
    id: 'missing_advanced_higher_biology_not_eligible',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          advanced_higher_subjects: [
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'physics', grade: 'A' }
          ]
        }
      });
      assertProductionNotEligible(applicant, 'scottish_post_16_requirements_not_met');
    }
  },
  {
    id: 'fewer_than_six_qualifying_national_5_awards_not_eligible',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          national_5_subjects: validNational5Subjects().slice(0, 5)
        }
      });
      assertProductionNotEligible(applicant, 'national_5_requirements_not_met');
    }
  },
  {
    id: 'invalid_national_5_science_combination_not_eligible',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'B' },
            { subject_id: 'mathematics', grade: 'B' },
            { subject_id: 'chemistry', grade: 'B' },
            { subject_id: 'physics', grade: 'B' },
            { subject_id: 'history', grade: 'B' },
            { subject_id: 'geography', grade: 'B' }
          ]
        }
      });
      assertProductionNotEligible(applicant, 'national_5_requirements_not_met');
    }
  }
  ,
  {
    id: 'predicted_advanced_highers_score_six_national_5s_out_of_24',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          qualification_status: 'predicted',
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'physics', grade: 'A' },
            { subject_id: 'history', grade: 'A' }
          ]
        }
      });

      const result = classifyInterviewBand(course, config, applicant);

      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.value,
        24
      );
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.max,
        24
      );
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.scoring_route,
        'national_5_only'
      );
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.qualification_status,
        'predicted'
      );
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.selected_national_5_subjects.length,
        6
      );

      assert.strictEqual(
        result.ranking.components.gcse_academic_score.applicable,
        false
      );
      assert.strictEqual(
        result.ranking.components.gcse_academic_score.max,
        0
      );

      assert.strictEqual(result.ranking.value, 35);
      assert.strictEqual(result.ranking.max, 36);
    }
  },
  {
    id: 'predicted_advanced_highers_mixed_national_5_profile_scores_20_of_24',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          qualification_status: 'predicted',
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'physics', grade: 'B' },
            { subject_id: 'history', grade: 'B' }
          ]
        }
      });

      const result = classifyInterviewBand(course, config, applicant);

      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.value,
        20
      );
      assert.strictEqual(
        result.ranking.components.scottish_academic_score.national_5_score,
        20
      );
      assert.strictEqual(result.ranking.value, 31);
      assert.strictEqual(result.ranking.max, 36);
    }
  },
  {
    id: 'achieved_advanced_highers_split_score_12_plus_12',
    run() {
      const applicant = scottishApplicant({
        scottish_profile: {
          qualification_status: 'achieved',
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'physics', grade: 'A' },
            { subject_id: 'history', grade: 'A' }
          ],
          advanced_higher_subjects: [
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' }
          ]
        }
      });

      const result = classifyInterviewBand(course, config, applicant);

      assert.strictEqual(result.eligibility.status, 'eligible');

      const academic =
        result.ranking.components.scottish_academic_score;

      assert.strictEqual(academic.value, 24);
      assert.strictEqual(academic.max, 24);
      assert.strictEqual(
        academic.scoring_route,
        'advanced_higher_plus_national_5'
      );
      assert.strictEqual(academic.qualification_status, 'achieved');
      assert.strictEqual(academic.advanced_higher_score, 12);
      assert.strictEqual(academic.advanced_higher_max, 12);
      assert.strictEqual(academic.national_5_score, 12);
      assert.strictEqual(academic.national_5_max, 12);
      assert.strictEqual(
        academic.selected_advanced_higher_subjects.length,
        3
      );
      assert.strictEqual(
        academic.selected_national_5_subjects.length,
        6
      );

      assert.strictEqual(result.ranking.value, 35);
      assert.strictEqual(result.ranking.max, 36);
    }
  },
  {
    id: 'england_domicile_scottish_qualifications_use_scottish_scoring',
    run() {
      const applicant = scottishApplicant({
        applicant_identity: {
          domicile: 'England'
        },
        scottish_profile: {
          qualification_status: 'predicted',
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'A' },
            { subject_id: 'mathematics', grade: 'A' },
            { subject_id: 'chemistry', grade: 'A' },
            { subject_id: 'biology', grade: 'A' },
            { subject_id: 'physics', grade: 'A' },
            { subject_id: 'history', grade: 'A' }
          ]
        }
      });

      const result = classifyInterviewBand(course, config, applicant);

      assert.strictEqual(result.eligibility.status, 'eligible');

      assert.ok(result.applicant_group_ids.includes('england_domiciled'));
      assert.ok(result.applicant_group_ids.includes('rest_of_uk'));
      assert.ok(!result.applicant_group_ids.includes('scotland_domiciled'));

      assert.strictEqual(
        result.ranking.components.scottish_academic_score.value,
        24
      );
      assert.strictEqual(
        result.ranking.components.gcse_academic_score.applicable,
        false
      );

      assert.strictEqual(result.ranking.value, 35);
      assert.strictEqual(result.ranking.max, 36);
    }
  }

];

let passed = 0;

console.log('Aston A100 Scottish production-path routing regression');
console.log('Path: actual interview-band config + classifyInterviewBand + server/src/predict\n');

for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`PASS ${test.id}`);
}

console.log(`\nPASS Aston A100 Scottish production-path routing (${passed}/${tests.length})`);
