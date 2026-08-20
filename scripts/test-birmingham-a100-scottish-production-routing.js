#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const {
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');

const readJson = (relativePath) =>
  JSON.parse(
    fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  );

const course = readJson('data/universities/birmingham-a100.json');
const config = readJson('data/interview-band-configs/birmingham-a100.json');
const SCOTTISH_RANKING_REASON = 'birmingham_scottish_gcse_scoring_conversion_unavailable';

function validApplicant(domicile = 'england') {
  return {
    applicant_identity: {
      domicile,
      fee_status: 'home',
      applicant_type: 'school_leaver',
      resit: {
        has_resits: false
      }
    },

    qualification_route: 'scottish',

    scottish_profile: {
      higher_subjects: [
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' },
        { subject_id: 'english_language', achieved_grade: 'A' },
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'physics', achieved_grade: 'A' }
      ],

      advanced_higher_subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' }
      ]
    },

    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        total_score: 2200,
        score_scale: 2700,
        sjt_band: 2
      }
    },

    graduate_profile: {
      is_graduate: false
    }
  };
}

function academicStatus(applicant) {
  return evaluateCourseEligibility(course, applicant);
}

function removeHigher(applicant, subjectId) {
  applicant.scottish_profile.higher_subjects =
    applicant.scottish_profile.higher_subjects.filter(
      (subject) => subject.subject_id !== subjectId
    );
}

function removeAdvancedHigher(applicant, subjectId) {
  applicant.scottish_profile.advanced_higher_subjects =
    applicant.scottish_profile.advanced_higher_subjects.filter(
      (subject) => subject.subject_id !== subjectId
    );
}

function expectEligible(name, applicant) {
  const eligibility = academicStatus(applicant);
  const classification = classifyInterviewBand(course, config, applicant);
  const card = presentBirminghamCard(classification, applicant);
  const cardText = JSON.stringify(card);

  assert.strictEqual(
    eligibility.status,
    'eligible',
    `${name}: expected academic eligibility`
  );

  assert.strictEqual(
    eligibility.qualification_route,
    'scottish',
    `${name}: expected Scottish qualification route`
  );

  assert.strictEqual(
    eligibility.academic_pathway_id,
    'birmingham_scottish_highers_and_advanced_highers',
    `${name}: unexpected academic pathway`
  );

  assert.strictEqual(
    classification.eligibility?.status,
    'eligible',
    `${name}: classifier must preserve academic eligibility`
  );

  assert.strictEqual(
    classification.guidance_pool_id,
    'home_standard',
    `${name}: expected Birmingham Home standard pool`
  );

  assert.strictEqual(
    classification.ranking?.status,
    'unavailable',
    `${name}: Scottish-only profile must not receive invented GCSE score`
  );

  assert.strictEqual(
    classification.ranking?.reason,
    SCOTTISH_RANKING_REASON,
    `${name}: expected dedicated Scottish scoring-unavailable reason`
  );

  assert.strictEqual(
    classification.insufficient_evidence_reason_code,
    SCOTTISH_RANKING_REASON,
    `${name}: Result Card reason code must not reuse GCSE missing-input reasons`
  );

  assert.strictEqual(
    classification.canonical_interview_band,
    'insufficient_evidence',
    `${name}: expected insufficient evidence for GCSE-based ranking`
  );

  assert.ok(
    !classification.ranking?.missing_scoring_inputs,
    `${name}: Scottish route must not request missing GCSE scoring inputs`
  );

  assert.strictEqual(
    classification.missing_information ?? null,
    null,
    `${name}: Scottish route must not be treated as missing applicant GCSE information`
  );

  assert.strictEqual(
    classification.ranking?.value,
    null,
    `${name}: Scottish route must not receive a Birmingham GCSE selection score`
  );

  assert.deepStrictEqual(
    classification.ranking?.components,
    {},
    `${name}: Scottish route must not invent GCSE or UCAT score components`
  );

  assert.strictEqual(
    card.prediction?.result_band,
    'insufficient_evidence',
    `${name}: Result Card band should remain insufficient evidence`
  );

  assert.strictEqual(
    card.decision_transparency?.insufficient_evidence_reason_code,
    SCOTTISH_RANKING_REASON,
    `${name}: Result Card should carry the Scottish scoring-unavailable reason`
  );

  assert.match(
    card.decision_transparency?.insufficient_evidence_reason || '',
    /meet Birmingham's published Scottish academic requirements/i,
    `${name}: Result Card must acknowledge Scottish academic requirements are met`
  );

  assert.match(
    card.decision_transparency?.insufficient_evidence_reason || '',
    /does not have a verified National 5-to-GCSE scoring conversion/i,
    `${name}: Result Card must explain the conversion evidence gap`
  );

  assert.ok(
    !/No English Language grade was provided/i.test(cardText),
    `${name}: Result Card must not imply omitted GCSE English Language`
  );

  assert.ok(
    !/missing_birmingham_english_language_grade/i.test(cardText),
    `${name}: Result Card must not carry the GCSE English Language missing reason`
  );

  assert.strictEqual(
    card.decision_transparency?.score_breakdown ?? null,
    null,
    `${name}: Result Card must not show an invented Birmingham selection score`
  );

  assert.notStrictEqual(
    card.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'not_used',
    `${name}: UCAT must not be presented as unused`
  );

  assert.strictEqual(
    card.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'ranking',
    `${name}: UCAT should be presented as used in Birmingham Home selection`
  );

  console.log(`PASS ${name}`);
}

function presentBirminghamCard(classification, applicant) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id,
        university_name: course.university.name,
        course_name: course.course.name,
        ucas_code: course.course.ucas_code
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id || null,
      eligibility: classification.eligibility,
      stage_1_eligibility: course.stage_1_eligibility,
      stage_2_interview_selection: course.stage_2_interview_selection,
      historical_admissions: course.historical_admissions,
      selection_approach_display: course.selection_approach_display?.default || null,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      matched_band_rule: classification.matched_band_rule,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

function expectNotEligible(name, mutate) {
  const applicant = validApplicant('england');

  mutate(applicant);

  const eligibility = academicStatus(applicant);

  assert.strictEqual(
    eligibility.status,
    'not_eligible',
    `${name}: expected not eligible`
  );

  console.log(`PASS ${name}`);
}

console.log(
  'Birmingham A100 Scottish production-path routing regression'
);

expectEligible(
  'england_domicile_valid_scottish_qualifications',
  validApplicant('england')
);

expectEligible(
  'scotland_domicile_valid_scottish_qualifications',
  validApplicant('scotland')
);

expectNotEligible(
  'fewer_than_five_highers',
  (applicant) => removeHigher(applicant, 'physics')
);

expectNotEligible(
  'missing_higher_chemistry',
  (applicant) => removeHigher(applicant, 'chemistry')
);

expectNotEligible(
  'missing_higher_mathematics',
  (applicant) => removeHigher(applicant, 'mathematics')
);

expectNotEligible(
  'missing_higher_english_language',
  (applicant) => removeHigher(applicant, 'english_language')
);

expectNotEligible(
  'missing_higher_biology_and_physics',
  (applicant) => {
    removeHigher(applicant, 'biology');
    removeHigher(applicant, 'physics');

    applicant.scottish_profile.higher_subjects.push(
      { subject_id: 'history', achieved_grade: 'A' },
      { subject_id: 'geography', achieved_grade: 'A' }
    );
  }
);

expectNotEligible(
  'fewer_than_two_advanced_highers',
  (applicant) => removeAdvancedHigher(applicant, 'biology')
);

expectNotEligible(
  'missing_advanced_higher_chemistry',
  (applicant) => {
    removeAdvancedHigher(applicant, 'chemistry');

    applicant.scottish_profile.advanced_higher_subjects.push(
      { subject_id: 'physics', predicted_grade: 'A' }
    );
  }
);

expectNotEligible(
  'higher_grade_below_aaaaa',
  (applicant) => {
    applicant.scottish_profile.higher_subjects[4].achieved_grade = 'B';
  }
);

expectNotEligible(
  'advanced_higher_grade_below_aa',
  (applicant) => {
    applicant.scottish_profile.advanced_higher_subjects[1].predicted_grade = 'B';
  }
);

console.log(
  '\nPASS Birmingham A100 Scottish production-path regression'
);
