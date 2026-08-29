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

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8')
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const course = readJson(
  'data/universities/bristol-a100.json'
);

const config = readJson(
  'data/interview-band-configs/bristol-a100.json'
);

const fixture = readJson(
  'data/fixtures/interview-band-classification/bristol-a100.json'
);

function baseIdentity(domicile) {
  return {
    ...(fixture.base_applicant.applicant_identity || {}),
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile,
    graduate: false,
    contextual: false,
    widening_participation: false,
    contextual_status_confirmed: true,
    contextual_flags: {}
  };
}

function national5(
  englishGrade = 'A',
  mathsGrade = 'A'
) {
  return [
    {
      subject_id: 'english_language',
      grade: englishGrade
    },
    {
      subject_id: 'mathematics',
      grade: mathsGrade
    }
  ];
}

function highers(
  grades = ['A', 'A', 'A', 'A', 'B']
) {
  const subjects = [
    'biology',
    'chemistry',
    'physics',
    'mathematics',
    'english'
  ];

  return subjects.map((subjectId, index) => ({
    subject_id: subjectId,
    grade: grades[index],
    achieved_grade: grades[index]
  }));
}

function advancedHighers(
  subjects = ['chemistry', 'biology'],
  grades = ['A', 'A']
) {
  return subjects.map((subjectId, index) => ({
    subject_id: subjectId,
    grade: grades[index],
    achieved_grade: grades[index]
  }));
}

function scottishApplicant(
  domicile = 'England',
  overrides = {}
) {
  const applicant = clone(fixture.base_applicant);

  applicant.qualification_route = 'scottish';
  applicant.applicant_identity = baseIdentity(domicile);

  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  delete applicant.ib_profile;

  applicant.scottish_profile = {
    national_5_subjects: national5(),
    higher_subjects: highers(),
    advanced_higher_subjects: advancedHighers()
  };

  applicant.contextual_profile = {};

  applicant.admissions_tests =
    applicant.admissions_tests || {};

  applicant.admissions_tests.ucat = {
    ...(applicant.admissions_tests.ucat || {}),
    total_score: 2300,
    score_scale: 2700,
    sjt_band: 2,
    test_year: 2026
  };

  function merge(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    }
  }

  merge(applicant, overrides);

  return applicant;
}

function aLevelApplicant(domicile) {
  const applicant = clone(fixture.base_applicant);

  applicant.qualification_route = 'a_level';

  applicant.applicant_identity = {
    ...applicant.applicant_identity,
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile,
    graduate: false
  };

  return applicant;
}

function classify(applicant) {
  return classifyInterviewBand(
    course,
    config,
    applicant
  );
}

function assertScottishEligible(
  applicant,
  label
) {
  const direct =
    evaluateCourseEligibility(course, applicant);

  const classification = classify(applicant);

  assert.strictEqual(
    direct.qualification_route,
    'scottish',
    `${label}: direct route`
  );

  assert.strictEqual(
    direct.status,
    'eligible',
    `${label}: ${JSON.stringify(direct)}`
  );

  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `${label}: ${JSON.stringify(
      classification.eligibility
    )}`
  );

  assert.strictEqual(
    classification.eligibility.qualification_route,
    'scottish',
    `${label}: classifier route`
  );

  assert.strictEqual(
    classification.guidance_pool_id,
    'home_a100',
    `${label}: Home guidance pool`
  );

  assert.strictEqual(
    classification.eligibility.academic_pathway,
    'standard',
    `${label}: standard Scottish pathway`
  );

  assert.strictEqual(
    classification.eligibility.academic_pathway_id,
    'bristol_scottish_standard_highers_and_advanced_highers',
    `${label}: pathway id`
  );

  return classification;
}

function assertScottishFail(
  applicant,
  expectedFailure,
  label
) {
  const direct =
    evaluateCourseEligibility(course, applicant);

  const classification = classify(applicant);

  assert.strictEqual(
    direct.status,
    'not_eligible',
    `${label}: ${JSON.stringify(direct)}`
  );

  assert.strictEqual(
    classification.eligibility.status,
    'not_eligible',
    `${label}: ${JSON.stringify(
      classification.eligibility
    )}`
  );

  assert.ok(
    direct.failures.includes(expectedFailure),
    `${label}: expected ${expectedFailure}; ` +
      `received ${direct.failures.join(', ')}`
  );

  assert.ok(
    !direct.failures.includes(
      'qualification_route_explicitly_blocked:scottish'
    ),
    `${label}: Scottish must fail through academic eligibility`
  );

  return classification;
}

console.log(
  '===== BRISTOL A100 SCOTTISH PRODUCTION ROUTING ====='
);

/*
 * Configuration.
 */

assert.strictEqual(
  course.profile_id,
  'bristol-a100'
);

assert.ok(
  config.eligibility.qualification_routes.supported
    .includes('scottish')
);

assert.ok(
  !config.eligibility.qualification_routes.manual_review
    .includes('scottish')
);

assert.deepStrictEqual(
  config.eligibility
    .use_course_eligibility_for_qualification_routes,
  ['scottish']
);

const scottish =
  course.stage_1_eligibility.post_16.scottish;

assert.strictEqual(
  scottish.route_implemented,
  true
);

assert.strictEqual(
  scottish.contextual_route_implemented,
  false
);

assert.strictEqual(
  scottish.grade_requirements.length,
  1
);

assert.strictEqual(
  scottish.grade_requirements[0].qualification_level,
  'scottish_highers_and_advanced_highers'
);

/*
 * Four domicile / qualification combinations.
 */

{
  const result = classify(
    aLevelApplicant('England')
  );

  assert.strictEqual(
    result.eligibility.qualification_route,
    'a_level'
  );

  assert.strictEqual(
    result.guidance_pool_id,
    'home_a100'
  );

  assert.ok(
    !result.applicant_group_ids
      .includes('scotland_domiciled')
  );
}

{
  const result = classify(
    aLevelApplicant('Scotland')
  );

  assert.strictEqual(
    result.eligibility.qualification_route,
    'a_level'
  );

  assert.strictEqual(
    result.guidance_pool_id,
    'home_a100'
  );

  assert.ok(
    result.applicant_group_ids
      .includes('scotland_domiciled')
  );
}

{
  const result = assertScottishEligible(
    scottishApplicant('England'),
    'England domicile + Scottish qualifications'
  );

  assert.ok(
    !result.applicant_group_ids
      .includes('scotland_domiciled')
  );
}

{
  const result = assertScottishEligible(
    scottishApplicant('Scotland'),
    'Scotland domicile + Scottish qualifications'
  );

  assert.ok(
    result.applicant_group_ids
      .includes('scotland_domiciled')
  );
}

/*
 * Published Scottish post-16 thresholds.
 */

assertScottishFail(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        higher_subjects:
          highers(['A', 'A', 'A', 'B', 'B'])
      }
    }
  ),
  'scottish_post_16_requirements_not_met',
  'Highers below AAAAB'
);

assertScottishFail(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        advanced_higher_subjects:
          advancedHighers(
            ['chemistry', 'biology'],
            ['A', 'B']
          )
      }
    }
  ),
  'scottish_post_16_requirements_not_met',
  'Advanced Highers below AA'
);

assertScottishFail(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        advanced_higher_subjects:
          advancedHighers(
            ['biology', 'physics'],
            ['A', 'A']
          )
      }
    }
  ),
  'scottish_post_16_requirements_not_met',
  'Advanced Highers missing Chemistry'
);

assertScottishEligible(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        advanced_higher_subjects:
          advancedHighers(
            ['chemistry', 'biology']
          )
      }
    }
  ),
  'Chemistry plus Biology at Advanced Higher'
);

assertScottishEligible(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        advanced_higher_subjects:
          advancedHighers(
            ['chemistry', 'physics']
          )
      }
    }
  ),
  'Chemistry plus Physics at Advanced Higher'
);

assertScottishEligible(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        advanced_higher_subjects:
          advancedHighers(
            ['chemistry', 'mathematics']
          )
      }
    }
  ),
  'Chemistry plus Mathematics at Advanced Higher'
);

/*
 * Published National 5 thresholds.
 */

assertScottishFail(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        national_5_subjects:
          national5('D', 'A')
      }
    }
  ),
  'national_5_requirements_not_met',
  'National 5 English below C'
);

assertScottishFail(
  scottishApplicant(
    'England',
    {
      scottish_profile: {
        national_5_subjects:
          national5('A', 'B')
      }
    }
  ),
  'national_5_requirements_not_met',
  'National 5 Mathematics below A'
);

/*
 * No unsupported Scottish contextual reduction.
 */

{
  const applicant = scottishApplicant(
    'Scotland',
    {
      applicant_identity: {
        contextual: true,
        widening_participation: true
      },
      contextual_profile: {
        partner_schools: {
          status: 'yes',
          relationships: [
            {
              university_id: 'bristol_a100',
              school_identifier_type:
                'apply_centre_code',
              school_identifier: '10003',
              school_name:
                'Ysgol Uwchradd Caergybi',
              status: 'yes'
            }
          ]
        }
      },
      scottish_profile: {
        higher_subjects:
          highers(['A', 'A', 'A', 'B', 'B'])
      }
    }
  );

  const contextualClassification =
    classify(applicant);

  assert.strictEqual(
    contextualClassification.eligibility.status,
    'not_eligible',
    'Contextual evidence must not create an unpublished Scottish grade reduction.'
  );

  assert.ok(
    contextualClassification.eligibility.failures
      .includes(
        'scottish_post_16_requirements_not_met'
      )
  );
}

/*
 * Result Card regression for the executable Scottish route.
 *
 * Scottish qualifications use Bristol's published standard SQA
 * requirements. They must not inherit the A-level/IB contextual
 * academic reduction or the retired Scottish manual-review state.
 */

{
  const applicant = scottishApplicant('Scotland');
  const classification = classify(applicant);

  const card = presentResultCard({
    eligibilityStatus:
      classification.eligibility.status,
    interviewBand:
      classification.canonical_interview_band,
    manualReviewRequired:
      classification.manual_review_required === true,
    insufficientEvidenceReasonCode:
      classification.insufficient_evidence_reason_code ||
      null,
    missingInformation:
      classification.missing_information || null,
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id,
        university_name:
          course.institution?.name,
        course_name:
          course.course?.name,
        ucas_code:
          course.course?.ucas_code
      },
      applicant_context: applicant,
      applicant_group_ids:
        classification.applicant_group_ids || [],
      readiness:
        course.engine_notes,
      eligibility:
        classification.eligibility,
      eligibility_checks:
        classification.eligibility.checks || [],
      eligibility_failures:
        classification.eligibility.failures || [],
      academic_pathway:
        classification.eligibility
          .academic_pathway || null,
      academic_pathway_id:
        classification.eligibility
          .academic_pathway_id ?? null,
      stage_1_eligibility:
        course.stage_1_eligibility || null,
      stage_2_interview_selection:
        course.stage_2_interview_selection || null,
      contextual_admissions:
        course.contextual_admissions || null,
      historical_admissions:
        course.historical_admissions || null,
      selection_approach_display:
        course.selection_approach_display || null,
      ranking:
        classification.ranking || null,
      band_metric:
        classification.band_metric || null,
      guidance_pool:
        classification.guidance_pool || null,
      guidance_pool_id:
        classification.guidance_pool_id || null,
      score_model:
        config.score_model,
      warnings:
        classification.warnings || []
    }
  });

  assert.strictEqual(
    classification.eligibility.status,
    'eligible'
  );

  assert.strictEqual(
    classification.eligibility.qualification_route,
    'scottish'
  );

  assert.strictEqual(
    classification.eligibility.academic_pathway,
    'standard'
  );

  assert.strictEqual(
    classification.eligibility.academic_pathway_id,
    'bristol_scottish_standard_highers_and_advanced_highers'
  );

  assert.strictEqual(
    classification.guidance_pool_id,
    'home_a100'
  );

  assert.notStrictEqual(
    classification.canonical_interview_band,
    'insufficient_evidence'
  );

  const cardText = JSON.stringify(card);

  const forbiddenText = [
    'You meet the published Bristol contextual offer of ABB',
    'You meet the contextual academic requirements',
    'Bristol contextual offer: You meet',
    'Scottish qualification combinations require manual review',
    'Scottish prerequisites'
  ];

  for (const phrase of forbiddenText) {
    assert.ok(
      !cardText.includes(phrase),
      `Scottish Result Card contains forbidden text: ${phrase}`
    );
  }

  assert.strictEqual(
    card.decision_transparency
      ?.manual_review_reason ?? null,
    null
  );

  assert.strictEqual(
    card.decision_transparency
      ?.missing_information ?? null,
    null
  );

  console.log(
    'PASS: Bristol Scottish Result Card uses the executable standard route without contextual ABB or manual-review leakage.'
  );
}

console.log(
  'PASS: Bristol Scottish qualification routing is executable and domicile-independent.'
);
