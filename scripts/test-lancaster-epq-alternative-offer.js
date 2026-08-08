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
  humanManualReviewReason,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
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

const course = readJson('data/universities/lancaster-a100.json');
const config = readJson('data/interview-band-configs/lancaster-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/lancaster-a100.json');
const southamptonCourse = readJson('data/universities/southampton-a100.json');
const southamptonConfig = readJson('data/interview-band-configs/southampton-a100.json');
const southamptonFixture = readJson('data/fixtures/interview-band-classification/southampton-a100.json');

function applicantWith({ grades, epq = undefined, contextual = false }) {
  const subjects = [
    ['biology', grades[0]],
    ['chemistry', grades[1]],
    ['mathematics', grades[2]]
  ].map(([subjectId, predictedGrade], index) => ({
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    sitting_status: 'first_sitting',
    ...(index < 2 ? { practical_endorsement: 'pass' } : {})
  }));
  const aLevelProfile = {
    subjects,
    sitting_status: 'first_sitting'
  };
  if (epq !== undefined) {
    aLevelProfile.epq = epq;
  }
  return merge(fixture.base_applicant, {
    applicant_identity: contextual
      ? {
          contextual: false,
          widening_participation: false,
          contextual_status_confirmed: false,
          contextual_flags: {
            care_experienced: false,
            refugee_or_asylum_seeker: false,
            refugee: false,
            free_school_meals: false,
            first_generation_higher_education: false,
            school_contextual_indicator: false,
            ucat_bursary: false
          }
        }
      : {},
    contextual_profile: contextual
      ? {
          personal_circumstances: {
            care_experienced: 'yes'
          }
        }
      : {},
    a_level_profile: aLevelProfile,
    admissions_tests: {
      ucat: {
        total_score: 2020,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 670,
          decision_making: 675,
          quantitative_reasoning: 675
        },
        sjt_band: 2,
        test_year: 2026
      }
    }
  });
}

function assertAcademicScenario({
  label,
  applicant,
  expectedStatus,
  expectedPathway,
  expectedPathwayId,
  expectedBand,
  expectedFailure,
  expectedManualReviewReason
}) {
  const eligibility = evaluateCourseEligibility(course, applicant);
  const classification = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(eligibility.status, expectedStatus, `${label}: generic eligibility status`);
  assert.strictEqual(
    classification.eligibility.status,
    expectedStatus,
    `${label}: classifier eligibility status`
  );
  assert.strictEqual(
    eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: generic academic pathway`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: classifier academic pathway`
  );
  assert.strictEqual(
    eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: generic academic pathway id`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: classifier academic pathway id`
  );
  assert.strictEqual(
    classification.canonical_interview_band,
    expectedBand,
    `${label}: classifier band`
  );

  if (expectedFailure) {
    assert.ok(eligibility.failures.includes(expectedFailure), `${label}: generic failure`);
    assert.ok(classification.eligibility.failures.includes(expectedFailure), `${label}: classifier failure`);
  }
  if (expectedManualReviewReason) {
    assert.ok(
      eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: generic manual-review reason`
    );
    assert.ok(
      classification.eligibility.manual_review_reasons.includes(expectedManualReviewReason),
      `${label}: classifier manual-review reason`
    );
  } else {
    assert.deepStrictEqual(eligibility.manual_review_reasons, [], `${label}: no generic manual review`);
    assert.deepStrictEqual(
      classification.eligibility.manual_review_reasons,
      [],
      `${label}: no classifier manual review`
    );
  }
}

function publicCardFor(courseProfile, interviewConfig, applicant) {
  const classification = classifyInterviewBand(courseProfile, interviewConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: courseProfile.profile_id },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: courseProfile.engine_notes,
      eligibility: classification.eligibility,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id ?? null,
      stage_1_eligibility: courseProfile.stage_1_eligibility || null,
      stage_2_interview_selection: courseProfile.stage_2_interview_selection || null,
      contextual_admissions: courseProfile.contextual_admissions || null,
      historical_admissions: courseProfile.historical_admissions || null,
      selection_approach_display: courseProfile.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      guidance_pool_id: classification.guidance_pool_id || null,
      score_model: interviewConfig.score_model,
      warnings: classification.warnings || []
    }
  });
}

function publicAcademicChecksFor(applicant) {
  return publicCardFor(course, config, applicant).academic_requirement_checks || [];
}

function publicKey(check) {
  return `${check.qualification_type}:${check.label}`;
}

function assertNoDuplicatePublicAcademicLabels(checks, label) {
  const keys = checks.map(publicKey);
  assert.strictEqual(
    new Set(keys).size,
    keys.length,
    `${label}: duplicate public academic labels ${JSON.stringify(checks)}`
  );
}

function publicPost16Checks(checks) {
  return checks.filter((check) => check.qualification_type === 'a_level');
}

const EPQ_PATHWAY_ID = 'lancaster_epq_alternative';
const EPQ_GRADE_REASON = `${EPQ_PATHWAY_ID}_epq_grade_required`;
const STANDARD_PATHWAY_ID = 'lancaster_standard_offer';
const CONTEXTUAL_PATHWAY_ID = 'lancaster_contextual_offer';
const CONTEXTUAL_EPQ_PATHWAY_ID = 'lancaster_contextual_epq_alternative';

assert.deepStrictEqual(course.stage_1_eligibility.post_16.a_level.epq_alternative_offer, {
  enabled: true,
  pathway_id: EPQ_PATHWAY_ID,
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'B'
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(
    course.stage_1_eligibility.post_16.a_level,
    'epq_alternative'
  ),
  false,
  'Lancaster must use the canonical epq_alternative_offer field, not the legacy alias.'
);

function assertLancasterAlevelPathwayScenario({
  label,
  applicant,
  expectedStatus,
  expectedPathway,
  expectedPathwayId,
  expectedRequirementType,
  expectedRowLabel = 'A-level grades',
  expectedPublicAlevelStatus,
  expectedRowRequired,
  expectedRowActual,
  expectedAlternativeType,
  expectedAlternativeOffer
}) {
  const eligibility = evaluateCourseEligibility(course, applicant);
  const classification = classifyInterviewBand(course, config, applicant);
  const card = publicCardFor(course, config, applicant);
  const aLevelRows = publicPost16Checks(card.academic_requirement_checks || []);

  assert.strictEqual(eligibility.status, expectedStatus, `${label}: generic eligibility status`);
  assert.strictEqual(
    classification.eligibility.status,
    expectedStatus,
    `${label}: classifier eligibility status`
  );
  assert.strictEqual(eligibility.academic_pathway ?? null, expectedPathway, `${label}: generic pathway`);
  assert.strictEqual(
    classification.eligibility.academic_pathway ?? null,
    expectedPathway,
    `${label}: classifier pathway`
  );
  assert.strictEqual(
    card.academic_pathway ?? null,
    expectedPathway,
    `${label}: public card pathway`
  );
  assert.strictEqual(
    eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: generic pathway id`
  );
  assert.strictEqual(
    classification.eligibility.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: classifier pathway id`
  );
  assert.strictEqual(
    card.academic_pathway_id ?? null,
    expectedPathwayId,
    `${label}: public card pathway id`
  );
  assert.deepStrictEqual(
    aLevelRows.map((check) => [
      check.label,
      check.status,
      check.requirement_type,
      check.required_value,
      check.applicant_value
    ]),
    [[
      expectedRowLabel,
      expectedPublicAlevelStatus,
      expectedRequirementType,
      expectedRowRequired,
      expectedRowActual
    ]],
    `${label}: public A-level row should use active pathway ${JSON.stringify(aLevelRows)}`
  );
  assert.strictEqual(
    card.alternative_academic_offer?.type ?? null,
    expectedAlternativeType,
    `${label}: alternative offer type`
  );
  assert.strictEqual(
    card.alternative_academic_offer?.alternative_offer ?? null,
    expectedAlternativeOffer,
    `${label}: alternative offer grade`
  );
}

[
  {
    label: 'non-contextual no EPQ AAA',
    applicant: applicantWith({ grades: ['A', 'A', 'A'] }),
    expectedStatus: 'eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedPublicAlevelStatus: 'met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'AAA',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'non-contextual no EPQ AAB',
    applicant: applicantWith({ grades: ['A', 'A', 'B'] }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'AAB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'non-contextual EPQ B AAB',
    applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'B' } }),
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedRequirementType: 'a_level_epq_alternative',
    expectedRowLabel: 'A-levels + EPQ',
    expectedPublicAlevelStatus: 'met',
    expectedRowRequired: 'AAB',
    expectedRowActual: 'AAB',
    expectedAlternativeType: 'epq',
    expectedAlternativeOffer: 'AAB + EPQ Grade B'
  },
  {
    label: 'non-contextual EPQ C AAB',
    applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'C' } }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'AAB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'contextual no EPQ AAB',
    applicant: applicantWith({ grades: ['A', 'A', 'B'], contextual: true }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedRowLabel: 'A-level grades',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'AAB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'contextual two-or-more WP indicators no EPQ AAB',
    applicant: merge(applicantWith({ grades: ['A', 'A', 'B'], contextual: true }), {
      contextual_profile: {
        financial_support: {
          free_school_meals: 'yes'
        },
        school_education: {
          low_progression_to_higher_education_school: 'yes'
        }
      }
    }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedRowLabel: 'A-level grades',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'AAB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'contextual no EPQ ABB',
    applicant: applicantWith({ grades: ['A', 'B', 'B'], contextual: true }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedRowLabel: 'A-level grades',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'ABB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'contextual EPQ B AAB',
    applicant: applicantWith({ grades: ['A', 'A', 'B'], contextual: true, epq: { status: 'predicted', grade: 'B' } }),
    expectedStatus: 'eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedRequirementType: 'a_level_epq_alternative',
    expectedRowLabel: 'A-levels + EPQ',
    expectedPublicAlevelStatus: 'met',
    expectedRowRequired: 'AAB',
    expectedRowActual: 'AAB',
    expectedAlternativeType: 'epq',
    expectedAlternativeOffer: 'AAB + EPQ Grade B'
  },
  {
    label: 'contextual EPQ B ABB',
    applicant: applicantWith({ grades: ['A', 'B', 'B'], contextual: true, epq: { status: 'predicted', grade: 'B' } }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedRequirementType: 'a_level_epq_alternative',
    expectedRowLabel: 'A-levels + EPQ',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAB',
    expectedRowActual: 'ABB',
    expectedAlternativeType: 'epq',
    expectedAlternativeOffer: 'AAB + EPQ Grade B'
  },
  {
    label: 'contextual EPQ C ABB',
    applicant: applicantWith({ grades: ['A', 'B', 'B'], contextual: true, epq: { status: 'predicted', grade: 'C' } }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'standard',
    expectedPathwayId: STANDARD_PATHWAY_ID,
    expectedRequirementType: 'a_level_standard_offer',
    expectedRowLabel: 'A-level grades',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAA',
    expectedRowActual: 'ABB',
    expectedAlternativeType: null,
    expectedAlternativeOffer: null
  },
  {
    label: 'contextual EPQ B below AAB',
    applicant: applicantWith({ grades: ['B', 'B', 'B'], contextual: true, epq: { status: 'predicted', grade: 'B' } }),
    expectedStatus: 'not_eligible',
    expectedPathway: 'epq_alternative',
    expectedPathwayId: EPQ_PATHWAY_ID,
    expectedRequirementType: 'a_level_epq_alternative',
    expectedRowLabel: 'A-levels + EPQ',
    expectedPublicAlevelStatus: 'not_met',
    expectedRowRequired: 'AAB',
    expectedRowActual: 'BBB',
    expectedAlternativeType: 'epq',
    expectedAlternativeOffer: 'AAB + EPQ Grade B'
  }
].forEach(assertLancasterAlevelPathwayScenario);

{
  const card = publicCardFor(course, config, applicantWith({ grades: ['A', 'A', 'A'] }));
  assert.strictEqual(card.academic_pathway, 'standard', 'AAA no EPQ presentation: active pathway is standard');
  assert.strictEqual(
    card.alternative_academic_offer ?? null,
    null,
    `AAA no EPQ should not expose applicant-specific EPQ alternative-used presentation: ${JSON.stringify(card.alternative_academic_offer)}`
  );
}

{
  const card = publicCardFor(
    course,
    config,
    applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'B' } })
  );
  assert.strictEqual(
    card.academic_pathway,
    'epq_alternative',
    'AAB + EPQ B presentation: active pathway is EPQ alternative'
  );
  assert.deepStrictEqual(
    card.alternative_academic_offer,
    {
      type: 'epq',
      standard_offer: 'AAA',
      alternative_offer: 'AAB + EPQ Grade B',
      epq_minimum_grade: 'B',
      pathway_id: EPQ_PATHWAY_ID,
      conditions: []
    },
    'AAB + EPQ B should expose the applicant-specific EPQ alternative-used presentation'
  );
}

{
  const card = publicCardFor(
    course,
    config,
    applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'not_taken', grade: null } })
  );
  assert.strictEqual(
    card.recommendation_display_state,
    'not_eligible',
    'AAB without EPQ presentation: academic result unchanged'
  );
  assert.strictEqual(
    card.academic_pathway,
    'standard',
    'AAB without EPQ presentation: active pathway remains standard'
  );
  assert.strictEqual(
    card.alternative_academic_offer ?? null,
    null,
    'AAB without EPQ should not expose EPQ alternative-used presentation'
  );
}

assertAcademicScenario({
  label: 'AAA no EPQ',
  applicant: applicantWith({ grades: ['A', 'A', 'A'] }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_PATHWAY_ID,
  expectedBand: 'very_strong_interview_potential'
});

{
  const checks = publicAcademicChecksFor(applicantWith({ grades: ['A', 'A', 'A'] }));
  assertNoDuplicatePublicAcademicLabels(checks, 'AAA no EPQ');
  assert.strictEqual(
    checks.filter((check) => check.label === 'GCSEs').length,
    1,
    `AAA no EPQ should expose one GCSE public check: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.filter((check) => check.label === 'A-level grades').length,
    1,
    `AAA no EPQ should expose one A-level-grade public check: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.some((check) => check.requirement_type === 'a_level_subject_combination'),
    false,
    `AAA no EPQ should not expose a second met A-level subject-combination badge: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.some((check) => /EPQ/i.test(check.label)),
    false,
    `AAA no EPQ should not expose EPQ public checks: ${JSON.stringify(checks)}`
  );
  assert.ok(
    checks.every((check) => check.status === 'met'),
    `AAA no EPQ public academic checks should all be met: ${JSON.stringify(checks)}`
  );
  assert.deepStrictEqual(
    publicPost16Checks(checks).map((check) => [check.label, check.status]),
    [['A-level grades', 'met']],
    `AAA no EPQ should expose exactly one final post-16 pathway row: ${JSON.stringify(checks)}`
  );
}

assertAcademicScenario({
  label: 'AAA EPQ planning',
  applicant: applicantWith({ grades: ['A', 'A', 'A'], epq: { status: 'planning', grade: null } }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: 'lancaster_standard_offer',
  expectedBand: 'very_strong_interview_potential'
});

{
  const checks = publicAcademicChecksFor(
    applicantWith({ grades: ['A', 'A', 'A'], epq: { status: 'planning', grade: null } })
  );
  assert.deepStrictEqual(
    publicPost16Checks(checks).map((check) => [check.label, check.status]),
    [['A-level grades', 'met']],
    `AAA + EPQ planning should still expose only the standard pathway row: ${JSON.stringify(checks)}`
  );
}

{
  const checks = publicAcademicChecksFor(
    applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'achieved', grade: 'B' } })
  );
  assertNoDuplicatePublicAcademicLabels(checks, 'AAB achieved EPQ B');
  assert.ok(
    checks.some((check) =>
      check.label === 'A-levels + EPQ' &&
      check.status === 'met' &&
      check.requirement_type === 'a_level_epq_alternative' &&
      check.required_value === 'AAB' &&
      check.applicant_value === 'AAB'
    ),
    `AAB + EPQ B should expose the active EPQ A-level pathway check: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.some((check) => check.requirement_type === 'a_level_subject_combination'),
    false,
    `AAB + EPQ B should not expose a second met A-level subject-combination badge: ${JSON.stringify(checks)}`
  );
  assert.deepStrictEqual(
    publicPost16Checks(checks).map((check) => [check.label, check.status, check.requirement_type]),
    [['A-levels + EPQ', 'met', 'a_level_epq_alternative']],
    `AAB + EPQ B should expose exactly one final post-16 pathway row: ${JSON.stringify(checks)}`
  );
}

{
  const apiResult = predict({
    universityIds: ['lancaster-a100'],
    studentProfile: applicantWith({
      grades: ['A', 'A', 'B'],
      epq: { status: 'achieved', grade: 'B' }
    })
  })[0];
  const checks = apiResult.result_card.academic_requirement_checks || [];
  assert.ok(
    checks.some((check) =>
      check.label === 'A-levels + EPQ' &&
      check.requirement_type === 'a_level_epq_alternative' &&
      check.status === 'met'
    ),
    `API payload for AAB + EPQ B should expose positive EPQ pathway: ${JSON.stringify(checks)}`
  );
}

assertAcademicScenario({
  label: 'AAB predicted EPQ B',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'B' } }),
  expectedStatus: 'eligible',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedBand: 'very_strong_interview_potential'
});

{
  const checks = publicAcademicChecksFor(
    applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'C' } })
  );
  assert.deepStrictEqual(
    publicPost16Checks(checks).map((check) => [
      check.label,
      check.status,
      check.requirement_type,
      check.required_value,
      check.applicant_value
    ]),
    [['A-level grades', 'not_met', 'a_level_standard_offer', 'AAA', 'AAB']],
    `AAB + EPQ C should fall back to the standard failed post-16 row: ${JSON.stringify(checks)}`
  );
}

assertAcademicScenario({
  label: 'AAB achieved EPQ B',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'achieved', grade: 'B' } }),
  expectedStatus: 'eligible',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedBand: 'very_strong_interview_potential'
});

{
  const card = publicCardFor(
    course,
    config,
    applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'planning', grade: null } })
  );
  const checks = card.academic_requirement_checks || [];
  assert.ok(
    checks.some((check) =>
      check.label === 'A-level grades' &&
      check.requirement_type === 'a_level_standard_offer' &&
      check.status === 'not_met'
    ),
    `AAB + EPQ planning should not activate the EPQ pathway: ${JSON.stringify(checks)}`
  );
  assert.deepStrictEqual(
    publicPost16Checks(checks).map((check) => [check.label, check.status, check.requirement_type]),
    [['A-level grades', 'not_met', 'a_level_standard_offer']],
    `AAB + EPQ planning should expose exactly one final post-16 pathway row: ${JSON.stringify(checks)}`
  );
}

assertAcademicScenario({
  label: 'AAB EPQ A',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'A' } }),
  expectedStatus: 'eligible',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedBand: 'very_strong_interview_potential'
});

assertAcademicScenario({
  label: 'AAB EPQ C',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: 'C' } }),
  expectedStatus: 'not_eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_PATHWAY_ID,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});

assertAcademicScenario({
  label: 'AAB EPQ planning',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'planning', grade: null } }),
  expectedStatus: 'not_eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_PATHWAY_ID,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});

assertAcademicScenario({
  label: 'AAB predicted EPQ missing grade',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'predicted', grade: null } }),
  expectedStatus: 'not_eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_PATHWAY_ID,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});

assertAcademicScenario({
  label: 'AAB EPQ not taken',
  applicant: applicantWith({ grades: ['A', 'A', 'B'], epq: { status: 'not_taken', grade: null } }),
  expectedStatus: 'not_eligible',
  expectedPathway: 'standard',
  expectedPathwayId: STANDARD_PATHWAY_ID,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});

assertAcademicScenario({
  label: 'ABB EPQ A*',
  applicant: applicantWith({ grades: ['A', 'B', 'B'], epq: { status: 'achieved', grade: 'A*' } }),
  expectedStatus: 'not_eligible',
  expectedPathway: 'epq_alternative',
  expectedPathwayId: EPQ_PATHWAY_ID,
  expectedBand: 'not_eligible',
  expectedFailure: 'a_level_requirements_not_met'
});

assertAcademicScenario({
  label: 'legacy AAA applicant without EPQ object',
  applicant: applicantWith({ grades: ['A', 'A', 'A'] }),
  expectedStatus: 'eligible',
  expectedPathway: 'standard',
  expectedPathwayId: 'lancaster_standard_offer',
  expectedBand: 'very_strong_interview_potential'
});

{
  const applicant = applicantWith({ grades: ['A', 'A', 'A'] });
  const courseWithoutEpq = clone(course);
  delete courseWithoutEpq.stage_1_eligibility.post_16.a_level.epq_alternative_offer;
  const current = classifyInterviewBand(course, config, applicant);
  const baseline = classifyInterviewBand(courseWithoutEpq, config, applicant);
  assert.strictEqual(current.eligibility.status, baseline.eligibility.status);
  assert.strictEqual(current.canonical_interview_band, baseline.canonical_interview_band);
  assert.strictEqual(current.guidance_pool_id, baseline.guidance_pool_id);
}

{
  const checks = publicCardFor(
    southamptonCourse,
    southamptonConfig,
    southamptonFixture.base_applicant
  ).academic_requirement_checks || [];
  assertNoDuplicatePublicAcademicLabels(checks, 'Southampton control');
  assert.ok(
    checks.some((check) =>
      check.qualification_type === 'gcse' &&
      check.label === 'GCSEs' &&
      check.status === 'met'
    ),
    `Southampton control should keep its generic GCSE academic check: ${JSON.stringify(checks)}`
  );
  assert.ok(
    checks.some((check) =>
      check.qualification_type === 'a_level' &&
      check.label === 'A-level grades' &&
      check.status === 'met'
    ),
    `Southampton control should keep its generic A-level academic check: ${JSON.stringify(checks)}`
  );
  assert.strictEqual(
    checks.some((check) => /EPQ/i.test(check.label)),
    false,
    `Southampton control should not gain EPQ public checks: ${JSON.stringify(checks)}`
  );
}

console.log('Lancaster EPQ alternative offer activation: PASS');
