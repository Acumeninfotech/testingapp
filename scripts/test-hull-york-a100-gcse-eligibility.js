#!/usr/bin/env node

// Regression test for a data bug fixed in data/universities/hull-york-a100.json:
// stage_1_eligibility.gcse.grade_requirements previously contained a
// count-style rule ({ count: 6, minimum_grade: '4/C' }) with no subject_id.
// evaluateGcseRules treats every grade_requirements entry as single-subject,
// so subjectId resolved to '' and the check always failed — making Hull
// York unconditionally not_eligible for every applicant regardless of GCSE
// count or strength. The fix moves that rule into
// minimum_count_at_or_above_grade, matching how Aston/Keele/QMUL express the
// same kind of rule. This test proves the fix without asserting anything
// about admissions logic itself.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateCourseEligibility } = require('../assets/js/engine/eligibility-evaluator');

const rootDir = path.resolve(__dirname, '..');
const course = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'universities', 'hull-york-a100.json'), 'utf8')
);

function baseApplicant(overrides = {}) {
  return {
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'england',
      contextual: false,
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    course_target: { discipline: 'medicine', ucas_code: 'A100', course_route: 'standard', entry_route: 'standard_medicine_a100' },
    application_year: 2027,
    gcse_profile: {
      subjects: {
        english_language: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '8',
        combined_science: null
      },
      additional_subjects: [
        { subject_id: 'history', grade: '8' },
        { subject_id: 'geography', grade: '7' }
      ],
      total_gcse_count: 7,
      top_9_gcse_grades: ['9', '9', '9', '9', '8', '8', '7']
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: null }
      ],
      sitting_status: 'first_sitting'
    },
    admissions_tests: {
      ucat: {
        taken: true,
        total_score: 2420,
        score_scale: 2700,
        subtests: { verbal_reasoning: 810, decision_making: 800, quantitative_reasoning: 810 },
        sjt_band: 1,
        test_year: 2026
      },
      gamsat: { taken: false, overall_score: null, section_scores: [null, null, null] }
    },
    ...overrides
  };
}

// A strong applicant with 7 GCSEs (well above the published minimum of 6)
// must not fail on the malformed grade_requirements rule.
const strong = evaluateCourseEligibility(course, baseApplicant());
assert.notStrictEqual(
  strong.status,
  'not_eligible',
  `expected the strong applicant to not be unconditionally not_eligible; got failures: ${JSON.stringify(strong.failures)}`
);
assert.ok(
  !strong.failures.some((f) => f.startsWith('gcse_requirement_not_met:')),
  `expected no gcse_requirement_not_met failure with an empty subject_id; got: ${JSON.stringify(strong.failures)}`
);
console.log('PASS: a strong applicant with 7 GCSEs is not unconditionally not_eligible at Hull York');

// An applicant genuinely short on GCSEs (only 5, below the published
// minimum of 6) should still correctly fail the GCSE count check — the fix
// must not make the rule permissive, only correctly attributed.
const weak = baseApplicant({
  gcse_profile: {
    subjects: {
      english_language: '6',
      mathematics: '6',
      biology: '6',
      chemistry: '6',
      physics: '6',
      combined_science: null
    },
    additional_subjects: [],
    total_gcse_count: 5,
    top_9_gcse_grades: ['6', '6', '6', '6', '6']
  }
});
const weakResult = evaluateCourseEligibility(course, weak);
assert.strictEqual(weakResult.status, 'not_eligible');
assert.ok(
  weakResult.failures.some((f) => f.includes('gcse') && f.includes('count')),
  `expected a genuine GCSE-count failure for a 5-GCSE applicant; got: ${JSON.stringify(weakResult.failures)}`
);
console.log('PASS: an applicant genuinely short on GCSEs still correctly fails the minimum-count check');

console.log('\nAll Hull York GCSE eligibility regression tests passed.');
