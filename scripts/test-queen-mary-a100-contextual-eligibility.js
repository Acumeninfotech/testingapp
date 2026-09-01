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

const course = readJson('data/universities/queen-mary-a100.json');
const config = readJson('data/interview-band-configs/queen-mary-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/queen-mary-a100.json');

function validGcseProfile() {
  return {
    subjects: {
      english_language: '7',
      mathematics: '7',
      biology: '7',
      chemistry: '7',
      physics: '6',
      history: '6'
    },
    additional_subjects: [],
    total_gcse_count: 6
  };
}

function aLevelSubjects(grades) {
  return [
    { subject_id: 'biology', predicted_grade: grades[0] },
    { subject_id: 'chemistry', predicted_grade: grades[1] },
    { subject_id: 'mathematics', predicted_grade: grades[2] }
  ];
}

function baseApplicant(overrides = {}) {
  return merge(merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      widening_participation: false,
      contextual_status_confirmed: false,
      contextual_flags: {},
      graduate: false,
      resit: {
        has_resits: false
      }
    },
    qualification_route: 'a_level',
    gcse_profile: validGcseProfile(),
    a_level_profile: {
      subjects: aLevelSubjects(['A*', 'A', 'A']),
      sitting_status: 'first_sitting'
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        sjt_band: 2,
        test_year: 2026
      }
    },
    contextual_profile: {
      home_area_region: {},
      financial_support: {},
      personal_circumstances: {},
      access_programmes: {
        participation_status: 'no',
        other_programmes: []
      }
    }
  }), overrides);
}

function ordinaryContextualAssessment() {
  return {
    contextual_evidence: {
      external_assessments: [
        {
          provider_university_id: 'queen_mary_a100',
          assessment_id: 'queen_mary_contextual_eligibility',
          result: 'contextual',
          verification_status: 'verified'
        }
      ]
    }
  };
}

function careLeaverContextual() {
  return {
    contextual_profile: {
      personal_circumstances: {
        care_leaver: 'yes'
      }
    }
  };
}

function accessProgramme(programmeId, status, verificationStatus = 'confirmed') {
  return {
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          {
            programme_id: programmeId,
            status,
            verification_status: verificationStatus
          }
        ]
      }
    }
  };
}

function assertEligibility(applicant, status, message) {
  const result = evaluateCourseEligibility(course, applicant);
  assert.strictEqual(
    result.status,
    status,
    `${message}: ${JSON.stringify(result)}`
  );
  return result;
}

{
  const result = assertEligibility(baseApplicant(), 'eligible', 'standard A*AA non-contextual');
  assert.strictEqual(result.contextual_eligibility.status, 'not_contextual');
  assert.strictEqual(result.academic_pathway, 'standard');
}

{
  const applicant = baseApplicant({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'A'])
    }
  });
  const result = assertEligibility(applicant, 'not_eligible', 'AAA non-contextual');
  assert.ok(result.failures.includes('a_level_requirements_not_met'));
}

{
  const applicant = baseApplicant(merge({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'A'])
    }
  }, ordinaryContextualAssessment()));
  const result = assertEligibility(applicant, 'eligible', 'AAA ordinary contextual');
  assert.strictEqual(result.contextual_eligibility.status, 'contextual');
  assert.strictEqual(result.contextual_eligibility.matched_contextual_pathway, 'queen_mary_contextual_aaa');
  assert.strictEqual(result.academic_pathway_id, 'queen_mary_contextual_aaa');

  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.guidance_pool_id, 'qmul_home_standard_school_leaver_guidance');
  assert.strictEqual(classification.interview_outcome || null, null);
}

{
  const applicant = baseApplicant(merge({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'B'])
    }
  }, careLeaverContextual()));
  const result = assertEligibility(applicant, 'eligible', 'AAB confirmed care leaver');
  assert.strictEqual(result.contextual_eligibility.matched_contextual_pathway, 'queen_mary_care_leaver_aab');
  assert.strictEqual(result.academic_pathway_id, 'queen_mary_care_leaver_aab');
}

{
  const applicant = baseApplicant({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'B'])
    },
    contextual_profile: {
      personal_circumstances: {
        care_experienced: 'yes'
      }
    }
  });
  const result = assertEligibility(applicant, 'not_eligible', 'AAB ordinary care-experienced contextual only');
  assert.strictEqual(result.contextual_eligibility.matched_contextual_pathway, 'queen_mary_contextual_aaa');
  assert.ok(!result.failures.includes('minimum_ucat_total_not_met'));
}

{
  const applicant = baseApplicant(merge({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'A'])
    }
  }, accessProgramme('bridge_the_gap', 'completed')));
  const result = assertEligibility(applicant, 'eligible', 'completed Bridge the Gap');
  assert.strictEqual(
    result.contextual_eligibility.matched_contextual_pathway,
    'queen_mary_access_programme_guaranteed_interview'
  );
  assert.strictEqual(result.academic_pathway_id, 'queen_mary_contextual_aaa');

  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(
    classification.source_interview_band_id,
    'queen_mary_access_programme_guaranteed_interview'
  );
}

for (const [programmeId, status] of [
  ['bridge_the_gap', 'participating'],
  ['realising_opportunities', 'offered']
]) {
  const applicant = baseApplicant(merge({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'A'])
    }
  }, accessProgramme(programmeId, status)));
  const contextual = evaluateContextualEligibility(course, applicant);
  assert.strictEqual(contextual.status, 'information_needed', `${programmeId} ${status}`);
  assert.strictEqual(
    contextual.manual_review_reason,
    'queen_mary_access_programme_completion_confirmation_required'
  );
  const classification = classifyInterviewBand(course, config, applicant);
  assert.notStrictEqual(classification.interview_outcome, 'guaranteed_interview');
}

for (const override of [
  {
    admissions_tests: {
      ucat: {
        total_score: 1810
      }
    }
  },
  {
    admissions_tests: {
      ucat: {
        sjt_band: 4
      }
    }
  }
]) {
  const applicant = baseApplicant(merge({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'A'])
    }
  }, merge(accessProgramme('bridge_the_gap', 'completed'), override)));
  const classification = classifyInterviewBand(course, config, applicant);
  assert.strictEqual(classification.canonical_interview_band, 'not_eligible');
  assert.notStrictEqual(classification.interview_outcome, 'guaranteed_interview');
}

{
  const applicant = baseApplicant({
    a_level_profile: {
      subjects: aLevelSubjects(['A', 'A', 'B'])
    },
    applicant_identity: {
      contextual: true,
      widening_participation: true,
      contextual_flags: {
        care_experienced: true
      }
    }
  });
  const result = assertEligibility(applicant, 'not_eligible', 'legacy contextual fields only');
  assert.strictEqual(result.contextual_eligibility.status, 'not_contextual');
  assert.deepStrictEqual(result.contextual_eligibility.activated_applicant_group_ids, []);
}

console.log('Queen Mary A100 contextual eligibility regression: PASS');
