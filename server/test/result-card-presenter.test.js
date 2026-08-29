#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildAlternativeAcademicOffer,
  presentResultCard
} = require('../../assets/js/engine/result-card-presenter');
const { evaluateCourseEligibility } = require('../../assets/js/engine/eligibility-evaluator');
const { classifyInterviewBand } = require('../../assets/js/engine/interview-band-classifier');
const cambridgeCourse = require('../../data/universities/cambridge-a100.json');
const astonCourse = require('../../data/universities/aston-a100.json');
const birminghamCourse = require('../../data/universities/birmingham-a100.json');
const astonConfig = require('../../data/interview-band-configs/aston-a100.json');
const birminghamConfig = require('../../data/interview-band-configs/birmingham-a100.json');
const cambridgeConfig = require('../../data/interview-band-configs/cambridge-a100.json');
const cambridgeFixture = require('../../data/fixtures/interview-band-classification/cambridge-a100.json');
const hullYorkCourse = require('../../data/universities/hull-york-a100.json');
const imperialCourse = require('../../data/universities/imperial-college-london-a100.json');
const keeleCourse = require('../../data/universities/keele-a100.json');
const lancasterCourse = require('../../data/universities/lancaster-a100.json');
const leicesterCourse = require('../../data/universities/leicester-a100.json');
const manchesterCourse = require('../../data/universities/manchester-a100.json');
const plymouthCourse = require('../../data/universities/plymouth-a100.json');
const queensBelfastCourse = require('../../data/universities/queen-s-belfast-a100.json');
const sheffieldCourse = require('../../data/universities/sheffield-a100.json');
const sunderlandCourse = require('../../data/universities/sunderland-a100.json');
const dundeeCourse = require('../../data/universities/dundee-a100.json');
const dundeeConfig = require('../../data/interview-band-configs/dundee-a100.json');
const topTierApplicant = require('../../data/regression-profiles/16_top_tier_applicant.json');

function present(overrides = {}) {
  return presentResultCard({
    eligibilityStatus: 'eligible',
    interviewBand: 'interview_likely',
    transparencyContext: {
      course_identity: { profile_id: 'presenter-test-a100' },
      prediction: {},
      ...overrides.transparencyContext
    },
    ...overrides
  });
}

function scoreCard({ score, threshold, max = 36, comparisonGuidance = undefined }) {
  return present({
    transparencyContext: {
      ranking: { value: score },
      score_model: { type: 'component_sum' },
      guidance_pool: {
        metric: 'selection_score',
        historical_cutoff: { value: threshold },
        comparison_guidance: comparisonGuidance
      },
      estimated_selection_score: {
        value: score,
        max,
        name: 'Selection score'
      }
    }
  });
}

function scoreOnlyCard({ score, max }) {
  return present({
    transparencyContext: {
      ranking: { value: score },
      score_model: { type: 'component_sum' },
      guidance_pool: { metric: 'selection_score' },
      estimated_selection_score: {
        value: score,
        max,
        name: 'Selection score'
      }
    }
  });
}

function ucatHistoricalAdmissionsCard() {
  return present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700 }
        }
      },
      applicant_group_ids: ['home_fee'],
      score_model: {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: {
        metric: 'ucat_total',
        comparison_guidance: {
          comparison_type: 'historical_range',
          label: 'Structured historical UCAT guide'
        },
        band_rules: [
          { band: 'realistic', operator: 'between_inclusive', min: 1680, max: 1995 }
        ]
      },
      historical_admissions: {
        cycles: [
          {
            entry_year: 2025,
            fee_status: 'Home',
            metric: 'lowest_interviewed',
            converted_score_2700: 1680,
            score_scale: 2700
          },
          {
            entry_year: 2025,
            fee_status: 'Home',
            metric: 'average_interviewed',
            converted_score_2700: 1995,
            score_scale: 2700
          }
        ]
      }
    }
  });
}

function ucatComparisonCard({ ucat, guidancePool, scoreModel = undefined }) {
  return present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: ucat, score_scale: 2700 }
        }
      },
      score_model: scoreModel || {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: guidancePool
    }
  });
}

function assertCompactStatus(card, expected) {
  assert.deepStrictEqual(card.decision_transparency?.compact_status, expected);
}

function publicAcademicChecks(card) {
  return card.academic_requirement_checks.map((check) => ({
    qualification_type: check.qualification_type,
    requirement_type: check.requirement_type,
    label: check.label,
    status: check.status
  }));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function alternativeOfferFor(course) {
  return buildAlternativeAcademicOffer(course.stage_1_eligibility);
}

function presentDundeeClassification(classification, applicant) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    transparencyContext: {
      course_identity: {
        profile_id: 'dundee-a100',
        university_name: 'University of Dundee',
        course_name: 'MBChB Medicine (A100)',
        ucas_code: 'A100'
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      academic_pathway: classification.eligibility.academic_pathway || null,
      academic_pathway_id: classification.eligibility.academic_pathway_id || null,
      eligibility: classification.eligibility,
      stage_1_eligibility: dundeeCourse.stage_1_eligibility,
      historical_admissions: dundeeCourse.historical_admissions,
      selection_approach_display: dundeeCourse.selection_approach_display,
      ranking: classification.ranking,
      band_metric: classification.band_metric,
      guidance_pool: classification.guidance_pool,
      matched_band_rule: classification.matched_band_rule,
      score_model: dundeeConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      warnings: classification.warnings || []
    }
  });
}

function dundeeMirrorScottishApplicant() {
  return {
    profile_id: 'dundee_england_home_scottish_standard_result_card',
    qualification_route: 'scottish',
    application_year: 2027,
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'england',
      contextual: false,
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    contextual_profile: {
      home_area_region: { simd_quintile: 'q5' },
      financial_support: { free_school_meals: 'no' },
      personal_circumstances: {
        care_experienced: 'no',
        care_over_three_months: 'no',
        refugee: 'no',
        uk_refugee_status_granted: 'no'
      },
      access_programmes: { participation_status: 'no' }
    },
    scottish_profile: {
      national_5_subjects: [
        { subject_id: 'english', grade: 'A' },
        { subject_id: 'mathematics', grade: 'A' },
        { subject_id: 'biology', grade: 'A' },
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'physics', grade: 'A' }
      ],
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'english', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true }
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
        { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 730,
          decision_making: 730,
          quantitative_reasoning: 740
        },
        sjt_band: 2
      }
    },
    graduate_profile: { is_graduate: false }
  };
}

function dundeeMirrorAlevelApplicant() {
  const applicant = clone(topTierApplicant);
  applicant.profile_id = 'dundee_scotland_home_a_level_standard_result_card';
  applicant.qualification_route = 'a_level';
  applicant.applicant_identity = {
    ...applicant.applicant_identity,
    applicant_type: 'school_leaver',
    fee_status: 'home_fee',
    domicile: 'scotland',
    contextual: false,
    contextual_flags: {},
    graduate: false,
    resit: { has_resits: false, subjects_resat: [] }
  };
  applicant.a_level_profile.subjects = [
    ['chemistry', 'A'],
    ['biology', 'A'],
    ['mathematics', 'A']
  ].map(([subjectId, predictedGrade]) => ({
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    achieved_grade: null,
    sitting_status: 'first_sitting',
    practical_endorsement: subjectId === 'mathematics' ? null : 'pass'
  }));
  applicant.admissions_tests.ucat.total_score = 2200;
  return applicant;
}

function resultCardText(card) {
  return [
    card.primary_user_facing_recommendation,
    card.primary_explanation,
    card.trust_statement,
    card.historical_guidance_caveat,
    ...(card.academic_requirement_checks || []).flatMap((check) => [
      check.qualification_type,
      check.requirement_type,
      check.label,
      check.status
    ]),
    ...(card.decision_transparency?.decision_path || []).flatMap((stage) => [
      stage.stage,
      stage.status,
      stage.summary,
      ...(stage.checks || []).flatMap((check) => [check.label, check.status, check.summary])
    ]),
    ...(card.factor_usage || []).flatMap((factor) => [
      factor.factor_id,
      factor.label,
      factor.role,
      factor.detail
    ])
  ].filter(Boolean).join('\n');
}

{
  const cases = [
    {
      name: 'Leicester',
      course: leicesterCourse,
      expected: {
        type: 'epq',
        standard_offer: 'A*AA',
        alternative_offer: 'AAA + EPQ Grade B',
        epq_minimum_grade: 'B',
        pathway_id: 'leicester_epq_alternative',
        conditions: []
      }
    },
    {
      name: 'Lancaster',
      course: lancasterCourse,
      expected: {
        type: 'epq',
        standard_offer: 'AAA',
        alternative_offer: 'AAB + EPQ Grade B',
        epq_minimum_grade: 'B',
        pathway_id: 'lancaster_epq_alternative',
        conditions: []
      }
    },
    {
      name: 'Keele',
      course: keeleCourse,
      expected: {
        type: 'epq',
        standard_offer: 'A*AA',
        alternative_offer: 'AAA + EPQ Grade A',
        epq_minimum_grade: 'A',
        pathway_id: 'keele_epq_alternative',
        conditions: []
      }
    },
    {
      name: "Queen's Belfast",
      course: queensBelfastCourse,
      expected: {
        type: 'epq',
        standard_offer: 'A*AA',
        alternative_offer: 'AAA + EPQ Grade A',
        epq_minimum_grade: 'A',
        pathway_id: 'queens_belfast_epq_alternative',
        conditions: []
      }
    },
    {
      name: 'Sheffield',
      course: sheffieldCourse,
      expected: {
        type: 'epq',
        standard_offer: 'AAA',
        alternative_offer: 'AAB + EPQ Grade A',
        epq_minimum_grade: 'A',
        pathway_id: 'sheffield_epq_alternative',
        conditions: [
          'Grade A required in the applicable mandatory science',
          'EPQ must be taken alongside A-levels',
          'EPQ route unavailable for A-level resits'
        ]
      }
    },
    {
      name: 'HYMS',
      course: hullYorkCourse,
      expected: {
        type: 'epq',
        standard_offer: 'AAA',
        alternative_offer: 'AAB + EPQ Grade A',
        epq_minimum_grade: 'A',
        pathway_id: 'hull_york_epq_alternative',
        conditions: [
          'Biology and Chemistry must both be grade A',
          'A-levels must be taken in one sitting',
          'EPQ route unavailable for A-level resits',
          'Reduced offer applies only when this university is the firm UCAS choice'
        ]
      }
    }
  ];

  for (const scenario of cases) {
    assert.deepStrictEqual(
      alternativeOfferFor(scenario.course),
      scenario.expected,
      `${scenario.name} alternative academic offer summary`
    );
  }
}

{
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(astonCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'contextual_school_leaver_a_level'
    }),
    {
      type: 'contextual',
      standard_offer: 'A*AA',
      alternative_offer: 'AAB',
      standard_offer_label: 'Standard offer',
      alternative_offer_label: 'Contextual offer',
      explanation: "You are eligible for Aston's contextual offer. AA must be in Chemistry and Biology. You must still meet all required subject and GCSE requirements.",
      applicable_offer: 'alternative',
      pathway_id: 'contextual_school_leaver_a_level',
      conditions: []
    },
    'Aston active contextual pathway should preserve the standard vs contextual grade comparison'
  );
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(imperialCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'imperial_contextual_a_level_aaa_biology_chemistry'
    }),
    {
      type: 'contextual',
      standard_offer: 'A*AA',
      alternative_offer: 'AAA',
      pathway_id: 'imperial_contextual_a_level_aaa_biology_chemistry',
      conditions: []
    },
    'Imperial active contextual pathway should preserve the standard vs contextual grade comparison'
  );
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(manchesterCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'manchester_contextual_aab_offer'
    }),
    {
      type: 'contextual',
      standard_offer: 'AAA',
      alternative_offer: 'AAB',
      pathway_id: 'manchester_contextual_aab_offer',
      conditions: []
    },
    'Manchester contextual AAB pathway should expose the standard vs contextual grade comparison'
  );
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(manchesterCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'manchester_refugee_care_abb_offer'
    }),
    {
      type: 'contextual',
      standard_offer: 'AAA',
      alternative_offer: 'ABB',
      pathway_id: 'manchester_refugee_care_abb_offer',
      conditions: []
    },
    'Manchester care/refugee ABB pathway should expose the standard vs contextual grade comparison'
  );

  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(lancasterCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'lancaster_contextual_offer'
    }),
    {
      type: 'contextual',
      standard_offer: 'AAA',
      alternative_offer: 'ABB',
      pathway_id: 'lancaster_contextual_offer',
      conditions: []
    },
    'Lancaster active contextual pathway should expose the ABB contextual offer summary'
  );
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(sunderlandCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'sunderland_contextual_aab'
    }),
    {
      type: 'contextual',
      standard_offer: 'AAA',
      alternative_offer: 'AAB',
      alternative_offer_label: 'Contextual offer',
      explanation: 'Sunderland contextual eligibility is confirmed. The contextual offer is AAB; the standard offer is AAA.',
      applicable_offer: 'Contextual offer: AAB',
      pathway_id: 'sunderland_contextual_aab',
      conditions: []
    },
    'Sunderland AAB contextual pathway should expose the standard vs contextual grade comparison'
  );
  assert.deepStrictEqual(
    buildAlternativeAcademicOffer(sunderlandCourse.stage_1_eligibility, {
      academic_pathway: 'contextual',
      academic_pathway_id: 'sunderland_local_contextual_abb'
    }),
    {
      type: 'contextual',
      standard_offer: 'AAA',
      alternative_offer: 'ABB',
      alternative_offer_label: 'Local contextual offer',
      explanation: 'Sunderland local contextual eligibility is confirmed. The local contextual offer is ABB only if Sunderland is the firm UCAS choice; if Sunderland is the insurance choice, the offer is AAB.',
      applicable_offer: 'Local contextual offer: ABB',
      pathway_id: 'sunderland_local_contextual_abb',
      conditions: ['You must make Sunderland your firm UCAS choice to receive the ABB offer; if Sunderland is your insurance choice, the offer is AAB.']
    },
    'Sunderland local contextual ABB pathway should expose firm-choice structured wording'
  );
  assert.strictEqual(
    buildAlternativeAcademicOffer(lancasterCourse.stage_1_eligibility, {
      academic_pathway: 'contextual_epq_alternative',
      academic_pathway_id: 'lancaster_contextual_epq_alternative'
    }),
    null,
    'Lancaster must not expose an unsupported contextual-plus-EPQ offer summary'
  );

  assert.strictEqual(
    alternativeOfferFor(cambridgeCourse),
    null,
    'non-EPQ universities must not expose an alternative academic offer summary'
  );

  const malformed = clone(leicesterCourse.stage_1_eligibility);
  delete malformed.post_16.a_level.epq_alternative_offer.a_level_grades;
  assert.strictEqual(
    buildAlternativeAcademicOffer(malformed),
    null,
    'malformed EPQ metadata must not crash or expose a partial alternative offer summary'
  );
}

{
  const lancasterStandardCard = present({
    transparencyContext: {
      stage_1_eligibility: lancasterCourse.stage_1_eligibility,
      academic_pathway: 'standard',
      academic_pathway_id: 'lancaster_standard_offer'
    }
  });
  assert.strictEqual(
    lancasterStandardCard.alternative_academic_offer,
    null,
    'Lancaster standard pathway should not expose applicant-specific EPQ alternative-used presentation'
  );

  const lancasterEpqCard = present({
    transparencyContext: {
      stage_1_eligibility: lancasterCourse.stage_1_eligibility,
      academic_pathway: 'epq_alternative',
      academic_pathway_id: 'lancaster_epq_alternative'
    }
  });
  assert.deepStrictEqual(
    lancasterEpqCard.alternative_academic_offer,
    {
      type: 'epq',
      standard_offer: 'AAA',
      alternative_offer: 'AAB + EPQ Grade B',
      epq_minimum_grade: 'B',
      pathway_id: 'lancaster_epq_alternative',
      conditions: []
    },
    'Lancaster active EPQ pathway should expose the EPQ alternative-used presentation'
  );
}

{
  const sheffieldStandardCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'sheffield-a100' },
      stage_1_eligibility: sheffieldCourse.stage_1_eligibility,
      academic_pathway: 'standard',
      academic_pathway_id: 'standard_aaa_biology_route',
      applicant_context: {
        qualification_route: 'a_level'
      }
    }
  });

  assert.deepStrictEqual(
    sheffieldStandardCard.alternative_academic_offer,
    {
      type: 'epq',
      standard_offer: 'AAA',
      alternative_offer: 'AAB + EPQ Grade A',
      epq_minimum_grade: 'A',
      pathway_id: 'sheffield_epq_alternative',
      conditions: [
        'Grade A required in the applicable mandatory science',
        'EPQ must be taken alongside A-levels',
        'EPQ route unavailable for A-level resits'
      ]
    },
    'Sheffield standard A-level pathway should expose the published EPQ alternative as informational presentation'
  );

  const sheffieldScottishCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'sheffield-a100' },
      stage_1_eligibility: sheffieldCourse.stage_1_eligibility,
      academic_pathway: 'standard',
      academic_pathway_id: 'standard_aaa_biology_route',
      applicant_context: {
        qualification_route: 'scottish'
      }
    }
  });

  assert.strictEqual(
    sheffieldScottishCard.alternative_academic_offer,
    null,
    'Sheffield Scottish qualification route should not expose the A-level EPQ alternative'
  );
}

{
  const card = present({
    transparencyContext: {
      course_identity: { profile_id: 'sheffield-a100' },
      stage_1_eligibility: sheffieldCourse.stage_1_eligibility,
      academic_pathway: 'epq_alternative',
      academic_pathway_id: 'sheffield_epq_alternative',
      eligibility_checks: [
        {
          check_id: 'standard_aaa_biology_route',
          status: 'fail',
          pathway_id: 'standard_aaa_biology_route',
          required: 'AAA',
          actual: 'AAB'
        },
        {
          check_id: 'standard_aaa_chemistry_route',
          status: 'fail',
          pathway_id: 'standard_aaa_chemistry_route',
          required: 'AAA',
          actual: 'AAB'
        },
        {
          check_id: 'a_level_standard_offer',
          status: 'fail',
          academic_pathway: 'standard'
        },
        {
          check_id: 'epq_alternative_offer',
          status: 'met',
          academic_pathway: 'epq_alternative',
          pathway_id: 'sheffield_epq_alternative'
        }
      ]
    }
  });

  assert.deepStrictEqual(
    publicAcademicChecks(card),
    [
      {
        qualification_type: 'a_level',
        requirement_type: 'epq_alternative_offer',
        label: 'A-levels + EPQ',
        status: 'met'
      }
    ],
    'Sheffield active EPQ pathway should suppress inactive failed standard-route badges'
  );
}

{
  for (const eligibilityStatus of ['eligible', 'manual_review', 'not_eligible']) {
    const card = present({
      eligibilityStatus,
      interviewBand: eligibilityStatus === 'not_eligible' ? 'not_eligible' : 'realistic',
      manualReviewRequired: eligibilityStatus === 'manual_review',
      manualReviewReason: eligibilityStatus === 'manual_review'
        ? 'A predicted or achieved EPQ grade is required to assess the alternative academic offer.'
        : null,
      transparencyContext: {
        stage_1_eligibility: leicesterCourse.stage_1_eligibility,
        eligibility_checks: [
          {
            check_id: 'epq_alternative_offer',
            qualification_type: 'a_level',
            status: eligibilityStatus === 'eligible'
              ? 'met'
              : eligibilityStatus === 'manual_review'
                ? 'information_needed'
                : 'not_met'
          }
        ],
        eligibility_failures: eligibilityStatus === 'not_eligible'
          ? ['a_level_requirements_not_met']
          : []
      }
    });
    assert.deepStrictEqual(
      card.alternative_academic_offer,
      {
        type: 'epq',
        standard_offer: 'A*AA',
        alternative_offer: 'AAA + EPQ Grade B',
        epq_minimum_grade: 'B',
        pathway_id: 'leicester_epq_alternative',
        conditions: []
      },
      `alternative academic offer summary should render for ${eligibilityStatus} results`
    );
    assert.strictEqual(
      publicAcademicChecks(card).length,
      1,
      `${eligibilityStatus} EPQ summary must not duplicate academic badges`
    );
  }
}

{
  const reasonCode = 'birmingham_scottish_gcse_scoring_conversion_unavailable';
  const card = present({
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: reasonCode,
    transparencyContext: {
      course_identity: { profile_id: 'birmingham-a100' },
      applicant_context: {
        qualification_route: 'scottish',
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 2 }
        }
      },
      applicant_group_ids: ['home_fee', 'school_leaver'],
      stage_1_eligibility: birminghamCourse.stage_1_eligibility,
      stage_2_interview_selection: birminghamCourse.stage_2_interview_selection,
      selection_approach_display: birminghamCourse.selection_approach_display.default,
      score_model: birminghamConfig.score_model,
      guidance_pool_id: 'home_standard',
      guidance_pool: {
        pool_id: 'home_standard',
        metric: 'selection_score'
      },
      ranking: {
        status: 'unavailable',
        basis: 'Birmingham Home application score',
        value: null,
        max: 10,
        components: {},
        reason: reasonCode
      }
    }
  });

  assert.strictEqual(
    card.decision_transparency.insufficient_evidence_reason_code,
    reasonCode,
    'Birmingham Scottish route should use the dedicated scoring-conversion evidence-gap reason'
  );
  assert.match(
    card.decision_transparency.insufficient_evidence_reason,
    /meet Birmingham's published Scottish academic requirements/i
  );
  assert.match(
    card.decision_transparency.insufficient_evidence_reason,
    /verified National 5-to-GCSE scoring conversion/i
  );
  assert.doesNotMatch(
    JSON.stringify(card),
    /No English Language grade was provided|missing_birmingham_english_language_grade/i,
    'Birmingham Scottish route must not render GCSE English Language missing-input copy'
  );
  assert.strictEqual(
    card.decision_transparency.score_breakdown ?? null,
    null,
    'Birmingham Scottish route must not render an invented selection score breakdown'
  );
  assert.strictEqual(
    card.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'ranking',
    'Birmingham Scottish unavailable score should still present UCAT as used in selection'
  );
}

{
  const pathwaysSelectionText = birminghamCourse.selection_approach_display.by_selection_route.pathways_to_birmingham;
  const card = present({
    interviewBand: null,
    transparencyContext: {
      course_identity: { profile_id: 'birmingham-a100' },
      stage_1_eligibility: birminghamCourse.stage_1_eligibility,
      stage_2_interview_selection: birminghamCourse.stage_2_interview_selection,
      selection_approach_display: birminghamCourse.selection_approach_display,
      selection_route_id: 'pathways_to_birmingham',
      interview_outcome: 'guaranteed_interview',
      guaranteed_interview_pool_label: 'Pathways to Birmingham',
      guaranteed_interview_badge_label: 'Guaranteed interview',
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 1 }
        }
      }
    }
  });

  assert.deepStrictEqual(
    card.alternative_academic_offer,
    {
      type: 'routed_offer',
      standard_offer: 'A*AA',
      alternative_offer: 'AAB',
      pathway_id: 'pathways_to_birmingham_a_level',
      conditions: []
    },
    'Pathways route should expose the routed AAB alternative offer even when only selection_route_id is supplied'
  );
  assert.strictEqual(
    card.selection_approach_display,
    pathwaysSelectionText,
    'Pathways guaranteed-interview route should use route-specific selection presentation'
  );
  assert.strictEqual(
    card.decision_transparency.selection_approach_display,
    pathwaysSelectionText,
    'decision transparency should carry the resolved Pathways selection presentation'
  );
  assert.doesNotMatch(
    card.selection_approach_display,
    /published selection score, which combines GCSE performance and UCAT/i,
    'Pathways route should not display the ordinary Birmingham scored-pool summary'
  );
  assert.strictEqual(
    card.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'eligibility',
    'Pathways guaranteed-interview route should present UCAT as a required eligibility condition, not ranking'
  );
  assert.strictEqual(
    card.decision_transparency.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'eligibility',
    'decision transparency should carry the Pathways UCAT eligibility role'
  );

  const ukwpmedSelectionText = birminghamCourse.selection_approach_display.by_selection_route.ukwpmed_guaranteed_interview;
  const ukwpmedCard = present({
    interviewBand: null,
    transparencyContext: {
      course_identity: { profile_id: 'birmingham-a100' },
      stage_1_eligibility: birminghamCourse.stage_1_eligibility,
      stage_2_interview_selection: birminghamCourse.stage_2_interview_selection,
      selection_approach_display: birminghamCourse.selection_approach_display,
      selection_route_id: 'ukwpmed_guaranteed_interview',
      academic_pathway: 'ukwpmed',
      academic_pathway_id: 'ukwpmed_birmingham_appendix_1',
      guidance_pool: {
        pool_id: 'ukwpmed_guaranteed_interview',
        presentation: {
          pool_label: 'UKWPMED',
          guaranteed_interview_headline: 'UKWPMED guaranteed interview',
          guaranteed_interview_explanation: "You meet Birmingham's published UKWPMED guaranteed-interview requirements.",
          guaranteed_interview_notice: 'You meet the published requirements for the UKWPMED guaranteed-interview route.'
        }
      },
      interview_outcome: 'guaranteed_interview',
      guaranteed_interview_badge_label: 'Guaranteed interview',
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 1 }
        }
      }
    }
  });

  assert.deepStrictEqual(
    ukwpmedCard.alternative_academic_offer,
    {
      type: 'routed_offer',
      standard_offer: 'A*AA',
      alternative_offer: 'ABB',
      pathway_id: 'ukwpmed',
      conditions: []
    },
    'UKWPMED guaranteed-interview route should expose the configured ABB routed offer'
  );
  assert.strictEqual(
    ukwpmedCard.selection_approach_display,
    ukwpmedSelectionText,
    'UKWPMED guaranteed-interview route should use route-specific selection presentation'
  );
  assert.doesNotMatch(
    ukwpmedCard.selection_approach_display,
    /published selection score, which combines GCSE performance and UCAT/i,
    'UKWPMED route should not display the ordinary Birmingham scored-pool summary'
  );
  assert.match(
    ukwpmedCard.selection_approach_display,
    /not ranked using Birmingham's standard GCSE\/UCAT selection score/i,
    'UKWPMED selection presentation should explain the ordinary ranking bypass'
  );
  assert.strictEqual(
    ukwpmedCard.primary_user_facing_recommendation,
    'UKWPMED guaranteed interview',
    'UKWPMED guaranteed-interview route should use the configured collapsed-card heading'
  );
  assert.strictEqual(
    ukwpmedCard.primary_explanation,
    "You meet Birmingham's published UKWPMED guaranteed-interview requirements.",
    'UKWPMED guaranteed-interview route should use the configured collapsed-card description'
  );
  assert.strictEqual(
    ukwpmedCard.guaranteed_interview_notice,
    'You meet the published requirements for the UKWPMED guaranteed-interview route.',
    'UKWPMED guaranteed-interview route should use the configured detail notice'
  );
  assert.strictEqual(
    ukwpmedCard.decision_transparency.decision_path
      .find((stage) => stage.stage === 'Selection model')
      ?.checks.find((entry) => entry.label === 'Applicant pool')
      ?.summary,
    'UKWPMED',
    'UKWPMED guaranteed-interview route should use the configured applicant-pool label'
  );
}

{
  const contextualCard = present({
    transparencyContext: {
      eligibility: {
        contextual_eligibility: {
          status: 'contextual'
        }
      }
    }
  });
  assert.strictEqual(
    contextualCard.contextual_status,
    'confirmed',
    'contextual applicants should expose a confirmed contextual status for presentation'
  );
  assert.strictEqual(
    contextualCard.factor_usage.find((entry) => entry.factor_id === 'contextual')?.role,
    'contextual',
    'confirmed contextual applicants should expose contextual as an active selection factor'
  );

  const astonContextualPool = astonConfig.guidance_pools.find((pool) => pool.pool_id === 'home_wp');
  const astonContextualCard = present({
    transparencyContext: {
      course_identity: {
        profile_id: 'aston-a100',
        university_name: 'Aston University'
      },
      eligibility: {
        academic_pathway: 'contextual',
        academic_pathway_id: 'contextual_school_leaver_a_level',
        contextual_eligibility: {
          status: 'contextual'
        }
      },
      academic_pathway: 'contextual',
      academic_pathway_id: 'contextual_school_leaver_a_level',
      stage_1_eligibility: astonCourse.stage_1_eligibility,
      guidance_pool: astonContextualPool,
      score_model: astonConfig.score_model
    }
  });
  assert.deepStrictEqual(
    astonContextualCard.contextual_confirmation,
    {
      collapsed_label: "You meet Aston's contextual admissions criteria.",
      expanded_heading: "You meet Aston's contextual admissions criteria.",
      consideration_label: null,
      expanded_body: "Your application has been assessed using Aston's published contextual admissions criteria."
    },
    'Aston contextual applicants should expose the configured two-line contextual presentation'
  );
  assert.deepStrictEqual(
    astonContextualCard.alternative_academic_offer,
    {
      type: 'contextual',
      standard_offer: 'A*AA',
      alternative_offer: 'AAB',
      standard_offer_label: 'Standard offer',
      alternative_offer_label: 'Contextual offer',
      explanation: "You are eligible for Aston's contextual offer. AA must be in Chemistry and Biology. You must still meet all required subject and GCSE requirements.",
      applicable_offer: 'alternative',
      pathway_id: 'contextual_school_leaver_a_level',
      conditions: []
    },
    'Aston contextual Result Card should use display-only configured standard/contextual offer presentation'
  );
  assert.ok(
    !JSON.stringify(astonContextualCard).includes('Aston Ready'),
    'Aston Ready wording must not appear without programme-specific evidence'
  );

  const lancasterContextualCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'lancaster-a100' },
      eligibility: {
        contextual_eligibility: {
          status: 'contextual'
        }
      }
    }
  });
  assert.deepStrictEqual(
    lancasterContextualCard.contextual_confirmation,
    {
      collapsed_label: 'Contextual eligibility confirmed',
      expanded_heading: 'Contextual eligibility confirmed',
      consideration_label: 'Contextual consideration:',
      expanded_body:
        'Your contextual status may be considered during UCAT interview shortlisting. If successful at interview, you may be considered for a contextual offer of ABB.',
      contextual_offer_grade: 'ABB'
    },
    'confirmed Lancaster contextual applicants should expose the Lancaster contextual presentation notice'
  );

  const standardCard = present({
    transparencyContext: {
      eligibility: {
        contextual_eligibility: {
          status: 'standard'
        }
      },
      contextual_admissions: {
        available: true
      }
    }
  });
  assert.strictEqual(
    standardCard.contextual_status,
    null,
    'standard applicants should not expose a contextual confirmation status'
  );
  assert.strictEqual(
    standardCard.contextual_confirmation,
    null,
    'standard applicants should not expose Lancaster contextual presentation wording'
  );
  assert.strictEqual(
    standardCard.factor_usage.some((entry) => entry.factor_id === 'contextual'),
    false,
    'standard applicants should not expose a contextual selection factor just because contextual admissions are available'
  );

  const unresolvedCard = present({
    eligibilityStatus: 'manual_review',
    interviewBand: 'realistic',
    manualReviewRequired: true,
    transparencyContext: {
      eligibility: {
        contextual_eligibility: {
          status: 'contextual'
        }
      }
    }
  });
  assert.strictEqual(
    unresolvedCard.contextual_status,
    null,
    'manual-review outcomes should not expose a contextual confirmation status'
  );
  assert.strictEqual(
    unresolvedCard.contextual_confirmation,
    null,
    'manual-review outcomes should not expose Lancaster contextual presentation wording'
  );

  const lancasterGuaranteedInterviewCard = present({
    interviewBand: null,
    transparencyContext: {
      course_identity: { profile_id: 'lancaster-a100' },
      interview_outcome: 'guaranteed_interview',
      eligibility: {
        contextual_eligibility: {
          status: 'contextual'
        }
      }
    }
  });
  assert.strictEqual(lancasterGuaranteedInterviewCard.interview_outcome, 'guaranteed_interview');
  assert.strictEqual(
    lancasterGuaranteedInterviewCard.contextual_confirmation,
    null,
    'Lancaster Access to Medicine guaranteed-interview presentation should not gain the contextual ABB notice'
  );

  const sunderlandAabCard = present({
    transparencyContext: {
      course_identity: {
        profile_id: 'sunderland-a100',
        university_name: 'University of Sunderland'
      },
      academic_pathway: 'contextual',
      academic_pathway_id: 'sunderland_contextual_aab',
      stage_1_eligibility: sunderlandCourse.stage_1_eligibility,
      eligibility: {
        status: 'eligible',
        academic_pathway: 'contextual',
        academic_pathway_id: 'sunderland_contextual_aab',
        contextual_eligibility: {
          status: 'contextual',
          matched_contextual_pathway: 'sunderland_contextual_aab',
          matched_contextual_pathway_label: 'Sunderland contextual offer'
        }
      }
    }
  });
  assert.deepStrictEqual(
    sunderlandAabCard.contextual_confirmation,
    {
      collapsed_label: 'Contextual eligibility confirmed',
      expanded_heading: 'Sunderland contextual offer',
      consideration_label: 'Sunderland contextual route:',
      expanded_body: 'Contextual eligibility confirmed. The contextual offer is AAB; the standard offer is AAA.',
      contextual_offer_grade: 'AAB'
    },
    'Sunderland AAB contextual applicants should expose the contextual offer badge'
  );
  assert.match(JSON.stringify(sunderlandAabCard), /Contextual offer: AAB/i);
  assert.match(JSON.stringify(sunderlandAabCard), /standard offer is AAA/i);

  const sunderlandAbbCard = present({
    transparencyContext: {
      course_identity: {
        profile_id: 'sunderland-a100',
        university_name: 'University of Sunderland'
      },
      academic_pathway: 'contextual',
      academic_pathway_id: 'sunderland_local_contextual_abb',
      future_conditions: ['sunderland_local_contextual_abb_firm_choice_required'],
      stage_1_eligibility: sunderlandCourse.stage_1_eligibility,
      eligibility: {
        status: 'eligible',
        academic_pathway: 'contextual',
        academic_pathway_id: 'sunderland_local_contextual_abb',
        future_conditions: ['sunderland_local_contextual_abb_firm_choice_required'],
        contextual_eligibility: {
          status: 'contextual',
          matched_contextual_pathway: 'sunderland_local_contextual_abb',
          matched_contextual_pathway_label: 'Sunderland local contextual offer'
        }
      }
    }
  });
  assert.deepStrictEqual(
    sunderlandAbbCard.contextual_confirmation,
    {
      collapsed_label: 'Local contextual eligibility confirmed',
      expanded_heading: 'Sunderland local contextual offer',
      consideration_label: 'Sunderland local contextual route:',
      expanded_body: 'Local contextual eligibility confirmed. The local contextual offer is ABB only if Sunderland is your firm UCAS choice; if Sunderland is your insurance choice, the offer is AAB.',
      contextual_offer_grade: 'ABB'
    },
    'Sunderland ABB contextual applicants should expose the local contextual badge'
  );
  assert.match(JSON.stringify(sunderlandAbbCard), /Local contextual offer: ABB/i);
  assert.match(JSON.stringify(sunderlandAbbCard), /firm UCAS choice/i);
  assert.match(JSON.stringify(sunderlandAbbCard), /insurance choice, the offer is AAB/i);
}

{
  const standardPathwayId = 'plymouth_standard_a_level_a_star_aa';
  const wideningAccessPathwayId = 'plymouth_contextual_home_aab';
  const ukwpmedPathwayId = 'plymouth_ukwpmed_abb';
  const plymouthContext = {
    course_identity: { profile_id: 'plymouth-a100' },
    stage_1_eligibility: plymouthCourse.stage_1_eligibility
  };

  const standardCard = present({
    transparencyContext: {
      ...plymouthContext,
      academic_pathway: 'standard',
      academic_pathway_id: standardPathwayId,
      eligibility: {
        academic_pathway: 'standard',
        academic_pathway_id: standardPathwayId
      }
    }
  });
  assert.strictEqual(standardCard.contextual_status, null);
  assert.strictEqual(standardCard.contextual_confirmation, null);
  assert.strictEqual(standardCard.alternative_academic_offer, null);

  const wideningAccessCard = present({
    transparencyContext: {
      ...plymouthContext,
      academic_pathway: 'contextual',
      academic_pathway_id: wideningAccessPathwayId,
      eligibility: {
        academic_pathway: 'contextual',
        academic_pathway_id: wideningAccessPathwayId,
        contextual_eligibility: {
          status: 'contextual',
          matched_contextual_pathway: wideningAccessPathwayId,
          matched_contextual_pathway_label: 'Plymouth Widening Access'
        }
      }
    }
  });
  assert.strictEqual(wideningAccessCard.contextual_status, 'confirmed');
  assert.deepStrictEqual(
    wideningAccessCard.contextual_confirmation,
    {
      collapsed_label: 'Contextual eligibility confirmed',
      expanded_heading: 'Plymouth Widening Access',
      consideration_label: 'Plymouth contextual route:',
      expanded_body:
        "ApplySmart has confirmed that you meet Plymouth's widening-access contextual criteria. The AAB contextual academic offer has been applied instead of the standard A*AA offer.",
      contextual_offer_grade: 'AAB'
    }
  );
  assert.deepStrictEqual(
    wideningAccessCard.alternative_academic_offer,
    {
      type: 'contextual',
      standard_offer: 'A*AA',
      alternative_offer: 'AAB',
      pathway_id: wideningAccessPathwayId,
      conditions: []
    }
  );

  const ukwpmedCard = present({
    transparencyContext: {
      ...plymouthContext,
      academic_pathway: 'contextual',
      academic_pathway_id: ukwpmedPathwayId,
      eligibility: {
        academic_pathway: 'contextual',
        academic_pathway_id: ukwpmedPathwayId,
        contextual_eligibility: {
          status: 'contextual',
          matched_contextual_pathway: ukwpmedPathwayId,
          matched_contextual_pathway_label: 'Plymouth UKWPMED'
        }
      }
    }
  });
  assert.strictEqual(ukwpmedCard.contextual_status, 'confirmed');
  assert.strictEqual(
    ukwpmedCard.contextual_confirmation.collapsed_label,
    'UKWPMED route confirmed'
  );
  assert.deepStrictEqual(
    ukwpmedCard.alternative_academic_offer,
    {
      type: 'contextual',
      standard_offer: 'A*AA',
      alternative_offer: 'ABB',
      pathway_id: ukwpmedPathwayId,
      conditions: []
    }
  );

  const legacyUkwpmedFlagCard = present({
    transparencyContext: {
      ...plymouthContext,
      academic_pathway: 'ukwpmed',
      academic_pathway_id: standardPathwayId,
      selection_route_id: 'ukwpmed',
      applicant_group_ids: ['home_fee', 'plymouth_ukwpmed'],
      applicant_context: {
        contextual_profile: {
          access_programmes: {
            other_programmes: [
              { programme_id: 'ukwpmed', status: 'completed' }
            ]
          }
        }
      },
      eligibility: {
        academic_pathway: 'ukwpmed',
        academic_pathway_id: standardPathwayId,
        contextual_eligibility: {
          status: 'contextual'
        }
      }
    }
  });
  assert.strictEqual(
    legacyUkwpmedFlagCard.contextual_confirmation,
    null,
    'Plymouth UKWPMED confirmation must require the evaluated Plymouth UKWPMED pathway'
  );
  assert.strictEqual(
    legacyUkwpmedFlagCard.alternative_academic_offer,
    null,
    'Plymouth UKWPMED ABB offer must require the evaluated Plymouth UKWPMED pathway'
  );
}

function makeCambridgeCard(ucatTotal) {
  const applicant = clone(cambridgeFixture.base_applicant);
  applicant.admissions_tests.ucat = {
    ...applicant.admissions_tests.ucat,
    total_score: ucatTotal,
    score_scale: 2700,
    sjt_band: 2
  };
  const classification = classifyInterviewBand(cambridgeCourse, cambridgeConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: cambridgeCourse.profile_id },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: cambridgeCourse.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility || null,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection || null,
      contextual_admissions: cambridgeCourse.contextual_admissions || null,
      historical_admissions: cambridgeCourse.historical_admissions || null,
      selection_approach_display: cambridgeCourse.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: cambridgeConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

function makeCambridgeSixGcseCard() {
  const applicant = clone(cambridgeFixture.base_applicant);
  applicant.gcse_profile = {
    subjects: {
      english_language: '9',
      mathematics: '9',
      biology: '9',
      chemistry: '9',
      physics: '9',
      history: '9'
    },
    additional_subjects: [],
    total_gcse_count: 6,
    top_9_gcse_grades: ['9', '9', '9', '9', '9', '9']
  };
  const classification = classifyInterviewBand(cambridgeCourse, cambridgeConfig, applicant);
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code || null,
    missingInformation: classification.missing_information || null,
    transparencyContext: {
      course_identity: { profile_id: cambridgeCourse.profile_id },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: cambridgeCourse.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility || null,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection || null,
      contextual_admissions: cambridgeCourse.contextual_admissions || null,
      historical_admissions: cambridgeCourse.historical_admissions || null,
      selection_approach_display: cambridgeCourse.selection_approach_display || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: cambridgeConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      missing_information: classification.missing_information || null,
      warnings: classification.warnings || []
    }
  });
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'interview_likely',
    transparencyContext: {
      course_identity: { profile_id: 'cambridge-a100' },
      selection_approach_display: cambridgeCourse.selection_approach_display?.default,
      stage_1_eligibility: cambridgeCourse.stage_1_eligibility,
      stage_2_interview_selection: cambridgeCourse.stage_2_interview_selection,
      contextual_admissions: cambridgeCourse.contextual_admissions,
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 3 }
        }
      }
    }
  });
  assert.deepStrictEqual(card.factor_usage.map(({ factor_id, label, role, evidence_status }) => ({ factor_id, label, role, evidence_status })), [
    {
      factor_id: 'ucat',
      label: 'UCAT',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'gcse',
      label: 'GCSEs',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'a_level',
      label: 'A-levels',
      role: 'considered',
      evidence_status: 'available'
    },
    {
      factor_id: 'sjt',
      label: 'SJT',
      role: 'not_used',
      evidence_status: 'not_applicable'
    }
  ]);
}

{
  const rankingCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used_as_gate: false
          }
        }
      },
      stage_2_interview_selection: {
        primary_model: 'ucat_ranking',
        ranking_factors: [
          {
            factor_id: 'ucat_cognitive_total',
            role: 'ranking_factor',
            notes: 'UCAT total is used for ranking.'
          }
        ]
      }
    }
  });
  assert.strictEqual(
    rankingCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'ranking'
  );

  const consideredCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used_as_gate: false
          }
        }
      },
      stage_2_interview_selection: {
        primary_model: 'holistic_review',
        ranking_factors: [
          {
            factor_id: 'ucat_cognitive_total',
            role: 'review_factor',
            notes: 'UCAT total is considered alongside academic evidence.'
          }
        ]
      }
    }
  });
  assert.strictEqual(
    consideredCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'considered'
  );

  const notUsedCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: false,
            used: false,
            notes: 'UCAT is not used for interview selection.'
          }
        }
      }
    }
  });
  assert.strictEqual(
    notUsedCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'not_used'
  );

  const eligibilityCard = present({
    transparencyContext: {
      stage_1_eligibility: {
        admissions_tests: {
          ucat: {
            required: true,
            used_as_gate: true,
            notes: 'UCAT is an eligibility gate only.'
          }
        }
      }
    }
  });
  assert.strictEqual(
    eligibilityCard.factor_usage.find((entry) => entry.factor_id === 'ucat')?.role,
    'eligibility'
  );
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible',
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700 }
        }
      },
      score_model: {
        type: 'ranking_metric',
        metric: 'ucat_total',
        scale: { min: 0, max: 2700 }
      },
      guidance_pool: {
        metric: 'ucat_total',
        comparison_guidance: {
          comparison_type: 'historical_range',
          label: 'Structured historical UCAT guide'
        },
        band_rules: [
          { band: 'realistic', operator: 'between_inclusive', min: 1680, max: 1995 }
        ]
      }
    }
  });

  const historicalStage = card.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance');
  assert.strictEqual(historicalStage.status, 'Context only');
  assert.match(historicalStage.summary, /contextual only/i);
  assert.strictEqual(
    historicalStage.checks.find((check) => check.label === 'UCAT comparison')?.status,
    'Context only'
  );
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible'
  });

  const historicalStage = card.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance');
  assert.strictEqual(historicalStage.status, 'Not applied');
  assert.match(historicalStage.summary, /not applied because the entry requirements are not met/i);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
    interviewBand: 'insufficient_evidence'
  });
  assert.strictEqual(
    card.primary_explanation,
    'Please confirm the practical endorsement outcome for your required A-level science subject.'
  );
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'prediction_calibration_unavailable',
    transparencyContext: {
      score_model: {
        presentation: {
          insufficient_evidence_explanation:
            'This applicant pool has historical observations, but public prediction calibration is not approved yet.'
        }
      }
    }
  });
  assert.strictEqual(
    card.primary_explanation,
    'This applicant pool has historical observations, but public prediction calibration is not approved yet.'
  );
  assert.strictEqual(
    card.decision_transparency.insufficient_evidence_reason,
    card.primary_explanation
  );
}

{
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence'
  });
  assert.strictEqual(
    card.primary_explanation,
    'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.'
  );
}

{
  const reason =
    'This university ranks applicants using the best eight GCSEs. Only six GCSEs are available, so the published scoring model cannot be calculated. This is not a rejection.';
  const card = present({
    eligibilityStatus: 'eligible',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'insufficient_gcse_results',
    missingInformation: {
      qualification_type: 'gcse',
      provided_count: 6,
      required_count: 8
    },
    transparencyContext: {
      score_model: {
        type: 'component_sum',
        gcse_profile_completeness: {
          minimum_results_for_competitiveness_assessment: 8
        }
      },
      missing_information: {
        qualification_type: 'gcse',
        provided_count: 6,
        required_count: 8
      }
    }
  });
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.strictEqual(card.primary_explanation, reason);
  assert.strictEqual(card.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.insufficient_evidence_reason, reason);
  assert.match(historicalStage.summary, /Historical admissions data was not compared/i);
  assert.match(historicalStage.summary, /Only six GCSEs are available/i);
  assert.doesNotMatch(
    `${card.primary_explanation} ${historicalStage.summary}`,
    /ApplySmart needs additional applicant information before it can provide a complete recommendation/i
  );
}

{
  const reason =
    'ApplySmart needs a more complete GCSE profile before it can assess your Cambridge interview potential. This is not a rejection.';
  const card = makeCambridgeSixGcseCard();
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.strictEqual(card.recommendation_display_state, 'insufficient_evidence');
  assert.strictEqual(card.primary_explanation, reason);
  assert.strictEqual(card.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.insufficient_evidence_reason, reason);
  assert.match(historicalStage.summary, /Historical admissions data was not compared/i);
  assert.match(historicalStage.summary, /more complete GCSE profile/i);
  assert.doesNotMatch(historicalStage.summary, /best eight GCSEs/i);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check: 'gcse_minimum_count', passed: true },
        { check: 'gcse_science_alternative', passed: true },
        { check: 'a_level_route', passed: true },
        { check: 'a_level_subject_combination', passed: true },
        { check: 'ucat_required', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'gcse', requirement_type: 'gcse_minimum_count', label: 'GCSEs', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_route', label: 'A-level grades', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_subject_combination', label: 'Required A-level subjects', status: 'met' }
  ]);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check_id: 'gcse_english_language_minimum', status: 'pass' },
        { check_id: 'gcse_mathematics_minimum', status: 'pass' },
        { check_id: 'home_standard_a_level', status: 'fail' },
        { check_id: 'a_level_science_practical_endorsement', status: 'pass' }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'gcse', requirement_type: 'gcse_english_language_minimum', label: 'GCSE English Language', status: 'met' },
    { qualification_type: 'gcse', requirement_type: 'gcse_mathematics_minimum', label: 'GCSE Mathematics', status: 'met' },
    { qualification_type: 'a_level', requirement_type: 'home_standard_a_level', label: 'A-level grades', status: 'not_met' },
    { qualification_type: 'a_level', requirement_type: 'a_level_science_practical_endorsement', label: 'Science practical endorsement', status: 'met' }
  ]);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    transparencyContext: {
      eligibility_checks: [
        { check: 'international_baccalaureate_route', passed: false, unknown_subject_ids: ['chemistry'] },
        { check: 'sjt_policy', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'ib', requirement_type: 'international_baccalaureate_route', label: 'IB', status: 'information_needed' }
  ]);
}

{
  const card = present({
    transparencyContext: {
      eligibility_checks: [
        { check: 'national_5_requirements', passed: true },
        { check: 'scottish_post_16_requirements', passed: true },
        { check: 'graduate_degree_route', passed: true },
        { check: 'resit_pathway', passed: true }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'scottish', requirement_type: 'national_5_requirements', label: 'National 5s', status: 'met' },
    { qualification_type: 'scottish', requirement_type: 'scottish_post_16_requirements', label: 'Scottish Highers', status: 'met' },
    { qualification_type: 'graduate', requirement_type: 'graduate_degree_route', label: 'Graduate Entry', status: 'met' }
  ]);
}

{
  const card = present({
    transparencyContext: {
      course_identity: { profile_id: 'dundee-a100' },
      applicant_context: { qualification_route: 'a_level' },
      applicant_group_ids: ['home_fee', 'rest_of_uk', 'school_leaver'],
      guidance_pool: { pool_id: 'home_rest_of_uk_standard_school_leaver' },
      eligibility_checks: [
        { check_id: 'gcse_biology_minimum_for_a_level_applicants', status: 'pass', subject_id: 'biology' },
        { check_id: 'gcse_or_national_5_english_minimum', status: 'pass', subject_id: 'english_language' },
        { check_id: 'a_level_standard_offer', status: 'pass', required: 'AAA', actual: 'AAA' }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(card), [
    { qualification_type: 'a_level', requirement_type: 'a_level_standard_offer', label: 'A-level requirements', status: 'met' },
    { qualification_type: 'gcse', requirement_type: 'gcse_biology_minimum_for_a_level_applicants', label: 'GCSE requirements', status: 'met' }
  ]);
}

{
  const standardCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'dundee-a100' },
      applicant_context: { qualification_route: 'scottish' },
      applicant_group_ids: ['home_fee', 'scotland_domiciled', 'school_leaver'],
      guidance_pool: { pool_id: 'home_scotland_standard_school_leaver' },
      eligibility_checks: [
        { check_id: 'national_5_requirements', status: 'pass' },
        { check_id: 'scottish_post_16_requirements', status: 'pass' }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(standardCard), [
    { qualification_type: 'scottish', requirement_type: 'national_5_requirements', label: 'Dundee National 5 requirements', status: 'met' },
    { qualification_type: 'scottish', requirement_type: 'scottish_post_16_requirements', label: 'Dundee Scottish standard route', status: 'met' }
  ]);

  const wideningAccessCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'dundee-a100' },
      academic_pathway: 'contextual',
      academic_pathway_id: 'dundee_scottish_widening_access',
      applicant_context: { qualification_route: 'scottish' },
      applicant_group_ids: ['home_fee', 'scotland_domiciled', 'school_leaver', 'contextual'],
      guidance_pool: { pool_id: 'home_scotland_contextual_school_leaver' },
      eligibility_checks: [
        { check_id: 'national_5_requirements', status: 'pass' },
        { check_id: 'scottish_post_16_requirements', status: 'pass' }
      ]
    }
  });
  assert.deepStrictEqual(publicAcademicChecks(wideningAccessCard), [
    { qualification_type: 'scottish', requirement_type: 'national_5_requirements', label: 'Dundee National 5 requirements', status: 'met' },
    { qualification_type: 'scottish', requirement_type: 'scottish_post_16_requirements', label: 'Dundee Scottish widening-access route', status: 'met' }
  ]);
}

{
  const cases = [
    {
      name: 'England domicile + Scottish qualifications',
      applicant: dundeeMirrorScottishApplicant(),
      expectedPool: 'home_rest_of_uk_standard_school_leaver',
      expectedPoolText: 'Home/RUK Standard school-leaver applicants',
      expectedAcademicChecks: [
        { qualification_type: 'scottish', requirement_type: 'national_5_requirements', label: 'Dundee National 5 requirements', status: 'met' },
        { qualification_type: 'scottish', requirement_type: 'scottish_post_16_requirements', label: 'Dundee Scottish standard route', status: 'met' }
      ],
      requiredText: [
        /Home\/RUK Standard applicants/i,
        /Dundee Scottish standard route/i,
        /ApplySmart-derived historical RUK UCAT guidance/i,
        /SJT is not used for interview selection/i
      ],
      forbiddenText: [
        /Scotland-domiciled applicants/i,
        /A-level requirements|GCSE requirements/i,
        /Contextual route confirmed|contextual admissions criteria/i,
        /Prediction Unavailable|Not predicted/i
      ]
    },
    {
      name: 'Scotland domicile + A-levels',
      applicant: dundeeMirrorAlevelApplicant(),
      expectedPool: 'home_scotland_standard_school_leaver',
      expectedPoolText: 'Home, Scotland-domiciled Standard school-leaver applicants',
      expectedAcademicChecks: [
        { qualification_type: 'a_level', requirement_type: 'a_level_standard_offer', label: 'A-level requirements', status: 'met' },
        { qualification_type: 'gcse', requirement_type: 'gcse_biology_minimum_for_a_level_applicants', label: 'GCSE requirements', status: 'met' }
      ],
      requiredText: [
        /Home, Scotland-domiciled Standard applicants/i,
        /A-level requirements/i,
        /ApplySmart-derived historical Scotland UCAT guidance/i,
        /SJT is not used for interview selection/i
      ],
      forbiddenText: [
        /Home\/RUK|Rest of UK|\bRUK\b/i,
        /Dundee National 5 requirements|Dundee Scottish standard route|Advanced Higher/i,
        /Contextual route confirmed|contextual admissions criteria/i,
        /Prediction Unavailable|Not predicted/i
      ]
    }
  ];

  for (const testCase of cases) {
    const classification = classifyInterviewBand(
      dundeeCourse,
      dundeeConfig,
      testCase.applicant
    );
    const card = presentDundeeClassification(classification, testCase.applicant);
    const text = resultCardText(card);
    const applicantPoolChecks = card.decision_transparency.decision_path
      .flatMap((stage) => stage.checks || [])
      .filter((check) => check.label === 'Applicant pool');
    const academicKeys = card.academic_requirement_checks.map((check) => {
      return `${check.qualification_type}|${check.requirement_type}|${check.label}|${check.status}`;
    });

    assert.strictEqual(classification.eligibility.status, 'eligible', testCase.name);
    assert.strictEqual(classification.guidance_pool_id, testCase.expectedPool, testCase.name);
    assert.strictEqual(card.prediction.available, true, testCase.name);
    assert.notStrictEqual(card.prediction.result_band, 'insufficient_evidence', testCase.name);
    assert.strictEqual(card.contextual_status, null, testCase.name);
    assert.strictEqual(card.contextual_confirmation, null, testCase.name);
    assert.deepStrictEqual(publicAcademicChecks(card), testCase.expectedAcademicChecks, testCase.name);
    assert.strictEqual(new Set(academicKeys).size, academicKeys.length, testCase.name);
    assert.ok(applicantPoolChecks.length > 0, testCase.name);
    assert.ok(applicantPoolChecks.every((check) => check.summary === testCase.expectedPoolText), testCase.name);
    assert.strictEqual(
      card.factor_usage.find((factor) => factor.factor_id === 'sjt')?.role,
      'not_used',
      testCase.name
    );
    for (const pattern of testCase.requiredText) {
      assert.match(text, pattern, testCase.name);
    }
    for (const pattern of testCase.forbiddenText) {
      assert.doesNotMatch(text, pattern, testCase.name);
    }
  }
}

{
  const card = scoreCard({ score: 35, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
  assert.strictEqual(card.decision_transparency.selection_metric.applicant_value, 35);
  assert.strictEqual(card.decision_transparency.selection_metric.maximum_value, 36);
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'historical score guide',
      value: '33.5',
      difference: '+1.5'
    }
  ]);
  assert.strictEqual(
    card.primary_explanation,
    "Based on ApplySmart's assessment, your selection score appears competitive for this applicant group."
  );
  const historicalStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Historical guidance'
  );
  assert.match(historicalStage.summary, /1\.5 points above/);
  assert.match(historicalStage.summary, /33\.5/);
}

{
  const metadataSelectionApproach =
    'Applicants are assessed using the university metadata sentence.';
  const legacySelectionSummary = 'Legacy generated selection summary should not render.';
  const card = present({
    transparencyContext: {
      selection_approach_display: metadataSelectionApproach,
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: legacySelectionSummary
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  const selectionCheck = selectionStage.checks.find((check) => check.label === 'Selection approach');
  assert.strictEqual(card.selection_approach_display, metadataSelectionApproach);
  assert.strictEqual(card.decision_transparency.selection_approach_display, metadataSelectionApproach);
  assert.strictEqual(selectionStage.summary, metadataSelectionApproach);
  assert.strictEqual(selectionCheck.summary, metadataSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, legacySelectionSummary);
}

{
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, null);
  assert.strictEqual(card.decision_transparency.selection_approach_display, null);
  assert.strictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const defaultSelectionApproach = 'Applicants are assessed using the default metadata sentence.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'unlisted_pool',
      selection_approach_display: {
        default: defaultSelectionApproach,
        by_applicant_pool: {
          international: 'International applicants who meet the academic requirements are ranked using their UCAT score.'
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'unlisted_pool', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, defaultSelectionApproach);
  assert.strictEqual(selectionStage.summary, defaultSelectionApproach);
}

{
  const homeSelectionApproach =
    'Home applicants are assessed using a selection score combining GCSE performance and UCAT.';
  const internationalSelectionApproach =
    'International applicants who meet the academic requirements are ranked using their UCAT score.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'international',
      selection_approach_display: {
        by_applicant_pool: {
          home_non_wp: homeSelectionApproach,
          international: internationalSelectionApproach
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'international', metric: 'ucat_total' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, internationalSelectionApproach);
  assert.strictEqual(selectionStage.summary, internationalSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      guidance_pool_id: 'unknown_pool',
      selection_approach_display: {
        by_applicant_pool: {
          international: 'International applicants who meet the academic requirements are ranked using their UCAT score.'
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'unknown_pool', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, null);
  assert.strictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const routeSelectionApproach = 'Applicants are assessed using the resolved route sentence.';
  const poolSelectionApproach = 'Applicants are assessed using the matched pool sentence.';
  const card = present({
    transparencyContext: {
      selection_route_id: 'route_a',
      guidance_pool_id: 'pool_a',
      selection_approach_display: {
        by_selection_route: {
          route_a: routeSelectionApproach
        },
        by_applicant_pool: {
          pool_a: poolSelectionApproach
        }
      },
      score_model: { type: 'component_sum' },
      guidance_pool: { pool_id: 'pool_a', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.ok(!Object.prototype.hasOwnProperty.call(card, 'selection_route_id'));
  assert.ok(!Object.prototype.hasOwnProperty.call(card.decision_transparency, 'selection_route_id'));
  assert.strictEqual(card.selection_approach_display, routeSelectionApproach);
  assert.strictEqual(selectionStage.summary, routeSelectionApproach);
}

{
  const poolSelectionApproach = 'Applicants are assessed using the matched pool sentence.';
  const fallbackSelectionSummary = 'Fallback presentation selection summary.';
  const card = present({
    transparencyContext: {
      selection_route_id: 'unmatched_route',
      guidance_pool_id: 'pool_a',
      selection_approach_display: {
        by_selection_route: {
          route_b: 'Applicants are assessed using another route sentence.'
        },
        by_applicant_pool: {
          pool_a: poolSelectionApproach
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          selection_summary: fallbackSelectionSummary
        }
      },
      guidance_pool: { pool_id: 'pool_a', metric: 'selection_score' }
    }
  });
  const selectionStage = card.decision_transparency.decision_path.find(
    (stage) => stage.stage === 'Selection model'
  );
  assert.strictEqual(card.selection_approach_display, poolSelectionApproach);
  assert.strictEqual(selectionStage.summary, poolSelectionApproach);
  assert.notStrictEqual(selectionStage.summary, fallbackSelectionSummary);
}

{
  const card = scoreCard({ score: 33.5, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const schemaPath = path.join(__dirname, '../../data/schemas/course.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const structuredMetadataSchema = schema.properties.selection_approach_display.anyOf
    .find((candidate) => candidate.type === 'object');
  const bySelectionRoute =
    structuredMetadataSchema.properties.by_selection_route;
  assert.strictEqual(structuredMetadataSchema.additionalProperties, false);
  assert.deepStrictEqual(bySelectionRoute.additionalProperties, {
    type: 'string',
    minLength: 1
  });
  assert.ok(
    structuredMetadataSchema.anyOf.some((candidate) =>
      candidate.required?.includes('by_selection_route')
    ),
    'course schema must accept structured metadata with by_selection_route and no default'
  );
}

{
  const card = scoreCard({ score: 32, threshold: 33.5 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = scoreCard({
    score: 35,
    threshold: 33.5,
    comparisonGuidance: {
      comparison_type: 'current_guidance',
      label: 'ApplySmart strategic benchmark'
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = scoreOnlyCard({ score: 8.5, max: 10 });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, []);
}

{
  const card = ucatHistoricalAdmissionsCard();
  assert.strictEqual(
    card.decision_transparency.comparison_metrics_title,
    'Historical Interview Data'
  );
  assert.deepStrictEqual(card.decision_transparency.comparison_metrics, [
    {
      label: 'Lowest interviewed UCAT',
      value: '1680',
      difference: '+720'
    },
    {
      label: 'Average interviewed UCAT',
      value: '1995',
      difference: '+405'
    }
  ]);
  const historicalChecks = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance')
    .checks;
  assert(
    historicalChecks.some((check) => /Lowest interviewed UCAT 1680/.test(check.summary))
  );
  assert(
    historicalChecks.every((check) => !/UCAT interview threshold/.test(check.summary))
  );
}

{
  const card = present({
    transparencyContext: {
      applicant_context: {
        admissions_tests: {
          ucat: { total_score: 2500, score_scale: 2700 }
        }
      },
      score_model: { type: 'ranking_metric', metric: 'ucat_total' },
      guidance_pool: { metric: 'ucat_total' }
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  const card = ucatComparisonCard({
    ucat: 2550,
    guidancePool: {
      metric: 'ucat_total',
      band_rules: [
        { band: 'realistic', operator: 'between_inclusive', min: 1855, max: 1864 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(card.primary_explanation, /UCAT score appears competitive for this applicant group/i);
  assert.match(historicalStage.summary, /UCAT: 2550 - above the historical interview range of 1855-1864\./i);
  assert.doesNotMatch(historicalStage.summary, /historical reference range|encouraging historical guidance/i);
}

{
  const card = ucatComparisonCard({
    ucat: 2420,
    guidancePool: {
      metric: 'ucat_total',
      band_rules: [
        { band: 'interview_likely', operator: 'greater_than_or_equal', value: 1935 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(historicalStage.summary, /485 points above the historical interview range of 1935/i);
  assert.doesNotMatch(historicalStage.summary, /previous interview threshold|Historical figures are guidance only/i);
}

{
  const card = ucatComparisonCard({
    ucat: 2420,
    scoreModel: {
      type: 'ranking_metric',
      metric: 'ucat_total',
      scale: { min: 0, max: 2700 },
      current_scale_guidance: {
        home: { value: 2100 }
      }
    },
    guidancePool: {
      metric: 'ucat_total',
      pool_id: 'home_standard',
      comparison_guidance: {
        comparison_type: 'current_guidance',
        label: 'ApplySmart advisory Home competitive benchmark'
      },
      band_rules: [
        { band: 'interview_likely', operator: 'greater_than_or_equal', value: 2100 }
      ]
    }
  });
  const historicalStage = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance');
  assert.match(historicalStage.summary, /320 points above the historical interview range of 2100\/2700/i);
  assert.doesNotMatch(historicalStage.summary, /historical interview benchmark|historical reference range/i);
}

{
  const card = present({
    interviewBand: 'eligible_to_apply',
    transparencyContext: {
      readiness: { assessment_mode: 'eligibility_only' },
      score_model: { assessment_mode: 'eligibility_only' },
      prediction: { result_band: 'eligible_to_apply', prediction_type: 'eligibility_only' }
    }
  });
  assertCompactStatus(card, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });
}

{
  for (const academicPathwayId of [
    'nottingham_contextual_aab_offer',
    'nottingham_enhanced_contextual_abb_offer'
  ]) {
    const card = present({
      transparencyContext: {
        course_identity: { profile_id: 'nottingham-a100' },
        academic_pathway: 'contextual',
        academic_pathway_id: academicPathwayId,
        eligibility: {
          contextual_eligibility: { status: 'contextual' }
        }
      }
    });
    assertCompactStatus(card, {
      label: 'Contextual eligibility confirmed.',
      type: 'academic_status',
      tone: 'positive'
    });
  }

  const sheffieldContextualCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'sheffield-a100' },
      eligibility: {
        contextual_eligibility: { status: 'contextual' }
      }
    }
  });
  assertCompactStatus(sheffieldContextualCard, {
    label: 'Contextual eligibility confirmed.',
    type: 'academic_status',
    tone: 'positive'
  });

  const accessSheffieldCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'sheffield-a100' },
      guidance_pool: {
        presentation: {
          compact_contextual_status:
            'Contextual eligibility confirmed - Access to Sheffield (Medicine).'
        }
      },
      eligibility: {
        contextual_eligibility: { status: 'contextual' }
      }
    }
  });
  assertCompactStatus(accessSheffieldCard, {
    label: 'Contextual eligibility confirmed - Access to Sheffield (Medicine).',
    type: 'academic_status',
    tone: 'positive'
  });

  const nonContextualCard = present({
    transparencyContext: {
      course_identity: { profile_id: 'nottingham-a100' },
      eligibility: {
        contextual_eligibility: { status: 'not_contextual' }
      }
    }
  });
  assertCompactStatus(nonContextualCard, {
    label: 'You meet the academic requirements.',
    type: 'academic_status',
    tone: 'positive'
  });

  const notEligibleContextualCard = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible',
    transparencyContext: {
      course_identity: { profile_id: 'nottingham-a100' },
      eligibility: {
        contextual_eligibility: { status: 'contextual' }
      },
      eligibility_failures: ['a_level_requirements_not_met']
    }
  });
  assertCompactStatus(notEligibleContextualCard, {
    label: 'You do not currently meet the academic requirements.',
    type: 'academic_status',
    tone: 'negative'
  });
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible'
  });
  assertCompactStatus(card, {
    label: 'You do not currently meet the academic requirements.',
    type: 'academic_status',
    tone: 'negative'
  });
}

{
  const card = present({
    eligibilityStatus: 'not_eligible',
    interviewBand: 'not_eligible',
    transparencyContext: {
      course_identity: { profile_id: 'lancaster-a100' },
      eligibility_failures: ['sjt_band_excluded'],
      eligibility: {
        contextual_eligibility: { status: 'contextual' }
      },
      applicant_context: {
        contextual_profile: {
          access_programmes: {
            other_programmes: [
              {
                programme_id: 'lancaster_access_to_medicine',
                status: 'completed'
              }
            ]
          }
        },
        admissions_tests: {
          ucat: { total_score: 2400, score_scale: 2700, sjt_band: 4 }
        }
      }
    }
  });
  assertCompactStatus(card, {
    label: 'You do not currently meet this university’s SJT requirement.',
    type: 'academic_status',
    tone: 'negative'
  });
  assert.match(card.primary_explanation, /SJT band is excluded/i);
  assert.doesNotMatch(card.decision_transparency?.compact_status?.label || '', /academic requirements/i);
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'applicant_evidence_gap'
  });
  assertCompactStatus(card, {
    label: 'ApplySmart needs more information to assess the academic requirements.',
    type: 'academic_status',
    tone: 'warning'
  });
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'university_methodology_gap'
  });
  assertCompactStatus(card, {
    label: 'ApplySmart needs more information to assess the academic requirements.',
    type: 'academic_status',
    tone: 'warning'
  });
}

{
  const card = present({
    eligibilityStatus: 'insufficient_evidence',
    interviewBand: 'insufficient_evidence',
    insufficientEvidenceReasonCode: 'applicant_evidence_gap'
  });
  assert.strictEqual(card.recommendation_display_state, 'insufficient_evidence');
  assert.strictEqual(card.primary_user_facing_recommendation, 'More information is required');
}

{
  const card = makeCambridgeCard(2000);
  assert.strictEqual(card.recommendation_display_state, 'standard');
  assert.strictEqual(card.prediction.result_band, 'high_risk');
  assert.strictEqual(card.risk_explanation.primary_factor, 'ucat');
  assert.strictEqual(card.risk_explanation.reason_code, 'ucat_historical_guidance_range');
  assert.match(card.primary_explanation, /UCAT score falls within ApplySmart's more cautious historical guidance range/i);
  assert.doesNotMatch(card.primary_explanation, /academic profile/i);
  assert.strictEqual(card.decision_transparency.risk_explanation.primary_factor, 'ucat');
  assert.strictEqual(card.decision_transparency.score_breakdown, null);
  assert.strictEqual(card.decision_transparency.selection_metric, null);
  assert.strictEqual(card.decision_transparency.ucat_comparison, null);
  const publicText = JSON.stringify(card);
  assert.doesNotMatch(publicText, /\b0\/5\b/);
  assert.doesNotMatch(publicText, /selection score is 0/i);
}

{
  const card = present({
    interviewBand: 'high_risk',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          academic_profile_score: {
            band: 'high_risk',
            profile_class: 'weak',
            applied_adjustment: -2
          },
          ucat_score: {
            band: 'realistic'
          }
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          hide_score_breakdown: true,
          hide_selection_score_details: true
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  assert.strictEqual(card.risk_explanation.primary_factor, 'academic');
  assert.strictEqual(card.risk_explanation.reason_code, 'academic_historical_guidance_range');
  assert.match(card.primary_explanation, /academic profile falls within ApplySmart's more cautious historical guidance range/i);
  assert.doesNotMatch(card.primary_explanation, /UCAT score/i);
}

{
  const card = present({
    interviewBand: 'high_risk',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          academic_profile_score: {
            band: 'high_risk',
            profile_class: 'weak',
            applied_adjustment: -2
          },
          ucat_score: {
            band: 'high_risk'
          }
        }
      },
      score_model: {
        type: 'component_sum',
        presentation: {
          hide_score_breakdown: true,
          hide_selection_score_details: true
        }
      },
      guidance_pool: { metric: 'selection_score' }
    }
  });
  assert.strictEqual(card.risk_explanation.primary_factor, 'combined_academic_ucat');
  assert.strictEqual(card.risk_explanation.reason_code, 'combined_academic_ucat_historical_guidance_range');
  assert.match(card.primary_explanation, /academic profile and UCAT score fall within ApplySmart's more cautious historical guidance range/i);
}

{
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason: 'Please confirm the practical endorsement outcome for your required A-level science subject.',
    interviewBand: 'insufficient_evidence',
    transparencyContext: {
      ranking: {
        status: 'calculated',
        value: 0,
        max: 10,
        components: {
          ucat_score: {
            band: 'high_risk'
          }
        }
      }
    }
  });
  assert.strictEqual(card.recommendation_display_state, 'manual_review');
  assert.strictEqual(card.primary_explanation, 'Please confirm the practical endorsement outcome for your required A-level science subject.');
  assert.strictEqual(card.risk_explanation, null);
  assert.strictEqual(card.decision_transparency.risk_explanation, null);
}

{
  const reason =
    "Lancaster Access to Medicine completion confirmed. More information is needed to verify Lancaster's widening-participation criteria before the guaranteed-interview route can be confirmed. This is not a rejection.";
  const missingInformation = [
    {
      criterion_id: 'other_lancaster_wp_circumstances',
      label: 'Other Lancaster widening-participation circumstances',
      evidence_path: 'access_programmes',
      reason: 'lancaster_other_wp_circumstances_require_manual_review'
    }
  ];
  const card = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason:
      'ApplySmart needs more Lancaster contextual evidence or manual review to confirm whether Lancaster contextual or widening-participation status can be verified.',
    missingInformation,
    transparencyContext: {
      course_identity: { profile_id: 'lancaster-a100' },
      applicant_context: {
        contextual_profile: {
          access_programmes: {
            other_programmes: [
              {
                programme_id: 'lancaster_access_to_medicine',
                status: 'completed'
              }
            ]
          }
        }
      },
      eligibility: {
        contextual_eligibility: {
          status: 'information_needed',
          missing_information: missingInformation
        }
      },
      missing_information: missingInformation
    }
  });
  assert.strictEqual(card.information_needed_reason, reason);
  assert.strictEqual(card.decision_transparency.information_needed_reason, reason);
  assert.strictEqual(card.primary_explanation, 'ApplySmart needs more Lancaster contextual evidence or manual review to confirm whether Lancaster contextual or widening-participation status can be verified.');

  const ordinaryLancasterReviewCard = present({
    eligibilityStatus: 'manual_review',
    manualReviewRequired: true,
    manualReviewReason:
      'ApplySmart needs more Lancaster contextual evidence or manual review to confirm whether Lancaster contextual or widening-participation status can be verified.',
    missingInformation,
    transparencyContext: {
      course_identity: { profile_id: 'lancaster-a100' },
      applicant_context: {
        contextual_profile: {
          access_programmes: {
            other_programmes: []
          }
        }
      },
      eligibility: {
        contextual_eligibility: {
          status: 'information_needed',
          missing_information: missingInformation
        }
      },
      missing_information: missingInformation
    }
  });
  assert.notStrictEqual(ordinaryLancasterReviewCard.information_needed_reason, reason);
}

{
  const astonScottishContextualApplicant = {
    profile_id: 'aston_result_card_scottish_contextual',
    qualification_route: 'scottish',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual: false,
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] }
    },
    contextual_profile: {
      school_education: { independent_school: 'no' },
      financial_support: { ucat_bursary_recipient: 'yes' }
    },
    gcse_profile: {
      subjects: {
        english_language: '6',
        mathematics: '6',
        biology: '6',
        chemistry: '6',
        physics: '6',
        history: '6'
      }
    },
    scottish_profile: {
      qualification_status: 'achieved',
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' },
        { subject_id: 'mathematics', grade: 'B' },
        { subject_id: 'chemistry', grade: 'B' },
        { subject_id: 'biology', grade: 'B' },
        { subject_id: 'physics', grade: 'B' },
        { subject_id: 'history', grade: 'B' }
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 4
      }
    },
    graduate_profile: { is_graduate: false }
  };
  const eligibility = evaluateCourseEligibility(astonCourse, astonScottishContextualApplicant);
  const card = presentResultCard({
    eligibilityStatus: eligibility.status,
    interviewBand: 'interview_likely',
    transparencyContext: {
      course_identity: {
        profile_id: 'aston-a100',
        university_name: 'Aston University',
        course_name: 'Medicine MBChB',
        ucas_code: 'A100'
      },
      applicant_context: astonScottishContextualApplicant,
      applicant_group_ids: eligibility.applicant_group_ids,
      eligibility_checks: eligibility.checks,
      eligibility_failures: eligibility.failures,
      academic_pathway: eligibility.academic_pathway || null,
      academic_pathway_id: eligibility.academic_pathway_id || null,
      eligibility,
      stage_1_eligibility: astonCourse.stage_1_eligibility,
      selection_approach_display: astonCourse.selection_approach_display
    }
  });
  const academicKeys = card.academic_requirement_checks.map((check) => {
    return `${check.qualification_type}|${check.requirement_type}|${check.label}|${check.status}`;
  });
  const text = resultCardText(card);

  assert.strictEqual(eligibility.status, 'eligible');
  assert.strictEqual(eligibility.qualification_route, 'scottish');
  assert.strictEqual(eligibility.contextual_eligibility.is_contextual, true);
  assert.strictEqual(card.contextual_status, 'confirmed');
  assert.strictEqual(new Set(academicKeys).size, academicKeys.length);
  assert.ok(
    publicAcademicChecks(card).some((check) => {
      return check.qualification_type === 'scottish' &&
        check.requirement_type === 'scottish_post_16_requirements' &&
        check.label === 'Scottish Advanced Highers' &&
        check.status === 'met';
    })
  );
  assert.match(text, /Contextual information is used as part of the university’s contextual review/i);
  assert.doesNotMatch(text, /A-level grades.*Scottish Advanced Highers|Scottish Advanced Highers.*A-level grades/i);
}


{
  const applicant = {
    profile_id: 'aston_scottish_predicted_score_breakdown',
    qualification_route: 'scottish',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    scottish_profile: {
      qualification_status: 'predicted',
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'A' },
        { subject_id: 'mathematics', grade: 'A' },
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'biology', grade: 'A' },
        { subject_id: 'physics', grade: 'B' },
        { subject_id: 'history', grade: 'B' }
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 2
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };

  const classification = classifyInterviewBand(
    astonCourse,
    astonConfig,
    applicant
  );

  const card = presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    transparencyContext: {
      course_identity: {
        profile_id: 'aston-a100',
        university_name: 'Aston University',
        course_name: 'Medicine MBChB',
        ucas_code: 'A100'
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids,
      eligibility_checks: classification.eligibility.checks,
      eligibility_failures: classification.eligibility.failures,
      eligibility: classification.eligibility,
      ranking: classification.ranking,
      score_model: astonConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      guidance_pool: astonConfig.guidance_pools.find(
        (pool) => pool.pool_id === classification.guidance_pool_id
      ),
      stage_1_eligibility: astonCourse.stage_1_eligibility,
      selection_approach_display: astonCourse.selection_approach_display
    }
  });

  const checks = card.decision_transparency.score_breakdown.checks;

  assert.ok(
    checks.some((entry) =>
      entry.label === 'National 5 score' &&
      /20 out of 24/.test(entry.summary)
    ),
    'Predicted Scottish Aston route should expose National 5 score 20/24'
  );

  assert.ok(
    checks.some((entry) =>
      entry.label === 'UCAT score' &&
      /11 out of 12/.test(entry.summary)
    ),
    'Predicted Scottish Aston route should expose UCAT score 11/12'
  );

  assert.ok(
    !checks.some((entry) => /GCSE/i.test(entry.label)),
    'Predicted Scottish Aston Result Card must not label the academic component as GCSE'
  );

  assert.ok(
    !checks.some((entry) => /Advanced Higher score/i.test(entry.label)),
    'Predicted Scottish Aston scoring should not display an achieved Advanced Higher points component'
  );

  assert.strictEqual(
    card.decision_transparency.score_breakdown.value,
    31
  );

  assert.strictEqual(
    card.decision_transparency.score_breakdown.max,
    36
  );
}

{
  const applicant = {
    profile_id: 'aston_scottish_achieved_score_breakdown',
    qualification_route: 'scottish',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
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
        { subject_id: 'chemistry', achieved_grade: 'A' },
        { subject_id: 'biology', achieved_grade: 'A' },
        { subject_id: 'mathematics', achieved_grade: 'A' }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 2
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };

  const classification = classifyInterviewBand(
    astonCourse,
    astonConfig,
    applicant
  );

  const card = presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    transparencyContext: {
      course_identity: {
        profile_id: 'aston-a100',
        university_name: 'Aston University',
        course_name: 'Medicine MBChB',
        ucas_code: 'A100'
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids,
      eligibility_checks: classification.eligibility.checks,
      eligibility_failures: classification.eligibility.failures,
      eligibility: classification.eligibility,
      ranking: classification.ranking,
      score_model: astonConfig.score_model,
      guidance_pool_id: classification.guidance_pool_id,
      guidance_pool: astonConfig.guidance_pools.find(
        (pool) => pool.pool_id === classification.guidance_pool_id
      ),
      stage_1_eligibility: astonCourse.stage_1_eligibility,
      selection_approach_display: astonCourse.selection_approach_display
    }
  });

  const checks = card.decision_transparency.score_breakdown.checks;

  assert.ok(
    checks.some((entry) =>
      entry.label === 'Advanced Higher score' &&
      /12 out of 12/.test(entry.summary)
    ),
    'Achieved Scottish Aston route should expose Advanced Higher score 12/12'
  );

  assert.ok(
    checks.some((entry) =>
      entry.label === 'National 5 score' &&
      /12 out of 12/.test(entry.summary)
    ),
    'Achieved Scottish Aston route should expose National 5 score 12/12'
  );

  assert.ok(
    checks.some((entry) =>
      entry.label === 'UCAT score' &&
      /11 out of 12/.test(entry.summary)
    ),
    'Achieved Scottish Aston route should expose UCAT score 11/12'
  );

  assert.ok(
    !checks.some((entry) => /GCSE/i.test(entry.label)),
    'Achieved Scottish Aston Result Card must not label the academic component as GCSE'
  );

  assert.strictEqual(
    card.decision_transparency.score_breakdown.value,
    35
  );

  assert.strictEqual(
    card.decision_transparency.score_breakdown.max,
    36
  );
}


console.log('PASS: compact_status presenter mappings are generated from structured result data');
