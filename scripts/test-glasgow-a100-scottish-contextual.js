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

function subject(subjectId, grade, schoolYear, extra = {}) {
  return {
    subject_id: subjectId,
    predicted_grade: grade,
    school_year: schoolYear,
    sitting_id: schoolYear,
    first_attempt: true,
    ...extra
  };
}

function contextualProfile(overrides = {}) {
  return merge({
    home_area_region: {
      simd_quintile: 'unknown'
    },
    personal_circumstances: {},
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: ''
      },
      other_programmes: [],
      other_programme_name: ''
    }
  }, overrides);
}

function reach(status) {
  return {
    participation_status: 'yes',
    other_programmes: [
      {
        programme_id: 'glasgow_reach',
        programme_name: 'University of Glasgow Reach',
        status
      }
    ]
  };
}

function applicant(overrides = {}) {
  return merge({
    profile_id: 'glasgow_scottish_test_applicant',
    qualification_route: 'scottish',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'Scotland',
      contextual_flags: {},
      resit: {
        has_resits: false
      }
    },
    scottish_profile: {
      completed_in_one_sitting: true,
      national_5_subjects: [
        { subject_id: 'english_language', grade: 'B' }
      ],
      higher_subjects: [
        subject('chemistry', 'A', 's5'),
        subject('biology', 'A', 's5'),
        subject('mathematics', 'A', 's5'),
        subject('physics', 'A', 's5'),
        subject('history', 'B', 's5')
      ],
      advanced_higher_subjects: [
        subject('chemistry', 'B', 's6'),
        subject('biology', 'B', 's6')
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2000,
        score_scale: 2700,
        sjt_band: 4,
        subtests: {
          verbal_reasoning: 670,
          decision_making: 665,
          quantitative_reasoning: 665,
          abstract_reasoning: 0
        }
      }
    },
    contextual_profile: contextualProfile()
  }, overrides);
}

function aLevelApplicant(overrides = {}) {
  return merge({
    profile_id: 'glasgow_ruk_result_card_applicant',
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'RUK',
      domicile: 'England',
      contextual_flags: {},
      resit: {
        has_resits: false
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A' },
        { subject_id: 'biology', predicted_grade: 'A' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ],
      completed_in_one_sitting: true
    },
    gcse_profile: {
      subjects: {
        english_language: '6',
        biology: '6'
      }
    },
    admissions_tests: {
      ucat: {
        total_score: 2000,
        score_scale: 2700,
        sjt_band: 4,
        subtests: {
          verbal_reasoning: 2000,
          decision_making: 0,
          quantitative_reasoning: 0,
          abstract_reasoning: 0
        }
      }
    },
    contextual_profile: contextualProfile()
  }, overrides);
}

function scotlandHomeALevelApplicant(overrides = {}) {
  return aLevelApplicant(merge({
    profile_id: 'glasgow_scotland_home_a_level_test_applicant',
    applicant_identity: {
      fee_status: 'Home',
      domicile: 'Scotland'
    }
  }, overrides));
}

function resultCardFor(profile) {
  return predict({
    universityIds: ['glasgow-a100'],
    studentProfile: profile
  })[0].result_card;
}

function requirementLabels(card) {
  return card.academic_requirement_checks.map((entry) => entry.label);
}

function decisionPathCheck(card, label) {
  return card.decision_transparency.decision_path
    .flatMap((stage) => stage.checks || [])
    .find((entry) => entry.label === label);
}

const course = readJson('data/universities/glasgow-a100.json');
const config = readJson('data/interview-band-configs/glasgow-a100.json');
const GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON =
  'Successful completion of Reach is required to confirm the Glasgow adjusted/contextual route.';
const GLASGOW_SCOTLAND_HOME_UCAT_PREDICTION_CAVEAT =
  'This prediction band is ApplySmart-derived guidance, not a Glasgow-published current 2027 cutoff; it does not guarantee an interview.';
const GLASGOW_RUK_UCAT_PREDICTION_CAVEAT =
  'This prediction band is ApplySmart-derived guidance informed by Glasgow historical RUK evidence; it is not a Glasgow-published current 2027 cutoff and does not guarantee an interview.';

assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.evaluator_id,
  'glasgow_contextual_medicine_a100'
);
assert.strictEqual(course.stage_1_eligibility.post_16.scottish.route_implemented, true);
assert.strictEqual(course.stage_1_eligibility.post_16.scottish.contextual_route_implemented, true);
assert.deepStrictEqual(
  course.stage_1_eligibility.national_5.grade_requirements.map((rule) => rule.requirement_id),
  ['national_5_english_minimum']
);

const standardApplicant = applicant();
const standardEligibility = evaluateCourseEligibility(course, standardApplicant);
assert.strictEqual(standardEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(standardEligibility.status, 'eligible');
assert.ok(!standardEligibility.applicant_group_ids.includes('contextual'));
assert.strictEqual(standardEligibility.academic_pathway, 'standard');
assert.strictEqual(standardEligibility.academic_pathway_id, 'glasgow_scottish_standard');

const standardClassification = classifyInterviewBand(course, config, standardApplicant);
assert.strictEqual(standardClassification.guidance_pool_id, 'scotland_home_school_leaver');
assert.strictEqual(standardClassification.canonical_interview_band, 'interview_likely');
assert.strictEqual(standardClassification.eligibility.status, 'eligible');
const standardCard = resultCardFor(standardApplicant);
assert.strictEqual(standardCard.prediction.result_band, 'interview_likely');
assert.strictEqual(
  standardCard.primary_user_facing_recommendation,
  'Strong choice for your application'
);
assert.deepStrictEqual(
  requirementLabels(standardCard),
  ['National 5 English at grade B', 'Scottish standard route']
);
assert.strictEqual(
  decisionPathCheck(standardCard, 'Applicant pool').summary,
  'Home, Scotland-domiciled applicants'
);
assert.strictEqual(standardCard.contextual_status, null);
assert.strictEqual(standardCard.contextual_confirmation, null);
assert.strictEqual(standardCard.alternative_academic_offer, null);
assert.strictEqual(
  standardCard.factor_usage.find((entry) => entry.factor_id === 'sjt').detail,
  'SJT is not used for interview selection.'
);
assert.match(
  standardCard.primary_explanation,
  /^Based on ApplySmart's assessment,/
);
assert.strictEqual(standardCard.decision_transparency.ucat_comparison.comparison_type, 'historical_range');
assert.strictEqual(standardCard.decision_transparency.ucat_comparison.benchmark_min, 1900);
assert.strictEqual(standardCard.decision_transparency.ucat_comparison.benchmark_max, 1974);
assert.strictEqual(
  standardCard.decision_transparency.ucat_comparison.benchmark_label,
  'ApplySmart prediction band'
);
assert.strictEqual(
  standardCard.decision_transparency.ucat_comparison.caveat,
  GLASGOW_SCOTLAND_HOME_UCAT_PREDICTION_CAVEAT
);
assert.strictEqual(
  standardCard.decision_transparency.ucat_comparison.evidence_status,
  'applysmart_derived'
);
assert.strictEqual(
  standardCard.decision_transparency.selection_metric.comparison_label,
  'ApplySmart prediction band'
);
assert.strictEqual(
  standardCard.decision_transparency.selection_metric.comparison_label_type,
  'applysmart_advisory_guide'
);
assert.strictEqual(
  standardCard.decision_transparency.selection_metric.difference_word,
  'prediction band'
);
assert.match(
  standardCard.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance')?.summary || '',
  /ApplySmart-derived guidance, not a Glasgow-published current 2027 cutoff; it does not guarantee an interview/i
);
assert.ok(
  ![
    standardCard.decision_transparency.ucat_comparison.benchmark_label,
    standardCard.decision_transparency.ucat_comparison.caveat,
    standardCard.decision_transparency.selection_metric.comparison_label,
    standardCard.decision_transparency.decision_path.find((stage) => stage.stage === 'Historical guidance')?.summary
  ].join(' ').match(/historical (?:glasgow|interview) range|glasgow historical cutoff|official glasgow range/i)
);

const veryStrongClassification = classifyInterviewBand(
  course,
  config,
  applicant({
    admissions_tests: {
      ucat: {
        total_score: 2060,
        score_scale: 2700,
        sjt_band: 4
      }
    }
  })
);
assert.strictEqual(veryStrongClassification.guidance_pool_id, 'scotland_home_school_leaver');
assert.strictEqual(
  veryStrongClassification.canonical_interview_band,
  'very_strong_interview_potential'
);
const veryStrongCard = resultCardFor(
  applicant({
    admissions_tests: {
      ucat: {
        total_score: 2060,
        score_scale: 2700,
        sjt_band: 4,
        subtests: {
          verbal_reasoning: 2060,
          decision_making: 0,
          quantitative_reasoning: 0,
          abstract_reasoning: 0
        }
      }
    }
  })
);
assert.strictEqual(
  veryStrongCard.primary_user_facing_recommendation,
  'Very strong choice for your application'
);
assert.strictEqual(veryStrongCard.internal_recommendation, 'Very Strong Choice');

const adjustedApplicant = applicant({
  scottish_profile: {
    advanced_higher_subjects: [
      subject('chemistry', 'B', 's6'),
      subject('biology', 'C', 's6')
    ],
    higher_subjects: [
      subject('chemistry', 'A', 's5'),
      subject('biology', 'A', 's5'),
      subject('mathematics', 'A', 's5'),
      subject('physics', 'B', 's5'),
      subject('history', 'B', 's5')
    ]
  },
  contextual_profile: contextualProfile({
    home_area_region: {
      simd_quintile: 'q1'
    },
    access_programmes: reach('completed')
  })
});
const adjustedContextual = evaluateContextualEligibility(course, adjustedApplicant);
assert.strictEqual(adjustedContextual.status, 'contextual');
assert.strictEqual(adjustedContextual.matched_contextual_pathway, 'simd_decile_1_to_4');
const adjustedEligibility = evaluateCourseEligibility(course, adjustedApplicant);
assert.strictEqual(adjustedEligibility.status, 'eligible');
assert.strictEqual(adjustedEligibility.academic_pathway, 'contextual');
assert.strictEqual(adjustedEligibility.academic_pathway_id, 'glasgow_scottish_adjusted');
const adjustedCard = resultCardFor(adjustedApplicant);
assert.deepStrictEqual(
  requirementLabels(adjustedCard),
  ['National 5 English at grade B', 'Scottish adjusted/contextual route']
);
assert.strictEqual(adjustedCard.contextual_status, 'confirmed');
assert.deepStrictEqual(adjustedCard.contextual_confirmation, {
  collapsed_label: 'Glasgow adjusted Scottish route confirmed',
  expanded_heading: 'Glasgow adjusted Scottish route confirmed',
  consideration_label: 'Adjusted Scottish route:',
  expanded_body:
    "ApplySmart applied Glasgow's adjusted/contextual Scottish academic route because Glasgow contextual eligibility and successful completion of Reach were confirmed. Reach completion alone does not make an applicant contextual."
});
assert.deepStrictEqual(adjustedCard.alternative_academic_offer, {
  type: 'contextual',
  standard_offer: 'AAAAB Scottish Highers + BB Advanced Highers',
  alternative_offer: 'AAABB or AAAAC Scottish Highers + BC Advanced Highers',
  pathway_id: 'glasgow_scottish_adjusted',
  conditions: [
    'Adjusted Scottish route requires confirmed Glasgow contextual eligibility and successful completion of Reach.',
    'The C grade in the AAAAC Higher option cannot be Chemistry.'
  ]
});
assert.match(
  adjustedCard.primary_explanation,
  /Standard offer AAAAB Scottish Highers \+ BB Advanced Highers; applied contextual offer AAABB or AAAAC Scottish Highers \+ BC Advanced Highers\./
);
assert.strictEqual(
  decisionPathCheck(adjustedCard, 'Applicant pool').summary,
  'Home, Scotland-domiciled applicants (contextual/widening participation)'
);

const reachOnly = applicant({
  scottish_profile: adjustedApplicant.scottish_profile,
  contextual_profile: contextualProfile({
    access_programmes: reach('completed')
  })
});
const reachOnlyEligibility = evaluateCourseEligibility(course, reachOnly);
assert.strictEqual(reachOnlyEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(reachOnlyEligibility.status, 'not_eligible');
assert.ok(reachOnlyEligibility.failures.includes('scottish_post_16_requirements_not_met'));
const reachOnlyCard = resultCardFor(reachOnly);
assert.strictEqual(reachOnlyCard.contextual_status, null);
assert.strictEqual(reachOnlyCard.contextual_confirmation, null);
assert.strictEqual(reachOnlyCard.alternative_academic_offer, null);

const rawFlagsOnly = applicant({
  applicant_group_ids: ['contextual', 'widening_participation'],
  applicant_identity: {
    contextual_flags: {
      care_experienced: true,
      simd20: true
    }
  },
  scottish_profile: adjustedApplicant.scottish_profile,
  contextual_profile: contextualProfile({
    access_programmes: reach('completed')
  })
});
const rawFlagsEligibility = evaluateCourseEligibility(course, rawFlagsOnly);
assert.strictEqual(rawFlagsEligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(rawFlagsEligibility.status, 'not_eligible');
assert.ok(!rawFlagsEligibility.applicant_group_ids.includes('contextual'));
assert.ok(!rawFlagsEligibility.applicant_group_ids.includes('widening_participation'));
assert.ok(!rawFlagsEligibility.applicant_group_ids.includes('care_experienced'));
const rawFlagsOnlyCard = resultCardFor(rawFlagsOnly);
assert.strictEqual(rawFlagsOnlyCard.contextual_status, null);
assert.strictEqual(rawFlagsOnlyCard.contextual_confirmation, null);
assert.strictEqual(rawFlagsOnlyCard.alternative_academic_offer, null);

const reachIncomplete = applicant({
  scottish_profile: adjustedApplicant.scottish_profile,
  contextual_profile: contextualProfile({
    home_area_region: {
      simd_quintile: 'q2'
    },
    access_programmes: reach('participating')
  })
});
const reachIncompleteEligibility = evaluateCourseEligibility(course, reachIncomplete);
assert.strictEqual(reachIncompleteEligibility.contextual_eligibility.status, 'information_needed');
assert.strictEqual(reachIncompleteEligibility.status, 'manual_review');
assert.ok(reachIncompleteEligibility.manual_review_reasons.includes('glasgow_reach_completion_required'));
assert.ok(!reachIncompleteEligibility.failures.includes('scottish_post_16_requirements_not_met'));
const reachIncompleteCard = resultCardFor(reachIncomplete);
assert.strictEqual(reachIncompleteCard.recommendation_display_state, 'manual_review');
assert.strictEqual(reachIncompleteCard.primary_user_facing_recommendation, 'More information is required');
assert.strictEqual(
  reachIncompleteCard.primary_explanation,
  GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
);
assert.strictEqual(
  reachIncompleteCard.information_needed_reason,
  GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
);
assert.strictEqual(
  reachIncompleteCard.decision_transparency.information_needed_reason,
  GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
);
assert.strictEqual(
  reachIncompleteCard.decision_transparency.manual_review_reason,
  GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
);
assert.strictEqual(
  reachIncompleteCard.decision_transparency.manual_review_reason_code,
  'glasgow_reach_completion_required'
);
assert.strictEqual(
  reachIncompleteCard.decision_transparency.compact_status.label,
  GLASGOW_REACH_COMPLETION_INFORMATION_NEEDED_REASON
);
assert.notStrictEqual(
  reachIncompleteCard.decision_transparency.compact_status.label,
  'ApplySmart needs more information to assess the academic requirements.'
);
assert.strictEqual(reachIncompleteCard.contextual_status, null);
assert.strictEqual(reachIncompleteCard.alternative_academic_offer, null);

const chemistryC = applicant({
  scottish_profile: {
    advanced_higher_subjects: [
      subject('chemistry', 'B', 's6'),
      subject('biology', 'C', 's6')
    ],
    higher_subjects: [
      subject('chemistry', 'C', 's5'),
      subject('biology', 'A', 's5'),
      subject('mathematics', 'A', 's5'),
      subject('physics', 'A', 's5'),
      subject('history', 'A', 's5')
    ]
  },
  contextual_profile: adjustedApplicant.contextual_profile
});
const chemistryCEligibility = evaluateCourseEligibility(course, chemistryC);
assert.strictEqual(chemistryCEligibility.contextual_eligibility.status, 'contextual');
assert.strictEqual(chemistryCEligibility.status, 'not_eligible');
assert.ok(chemistryCEligibility.failures.includes('scottish_post_16_requirements_not_met'));

const s4Highers = applicant({
  scottish_profile: {
    higher_subjects: [
      subject('chemistry', 'A', 's4'),
      subject('biology', 'A', 's4'),
      subject('mathematics', 'A', 's4'),
      subject('physics', 'A', 's4'),
      subject('history', 'B', 's4')
    ]
  }
});
assert.strictEqual(evaluateCourseEligibility(course, s4Highers).status, 'not_eligible');

const applicationsMaths = applicant({
  scottish_profile: {
    higher_subjects: [
      subject('chemistry', 'A', 's5'),
      subject('biology', 'A', 's5'),
      subject('applications_of_mathematics', 'A', 's5'),
      subject('english', 'A', 's5'),
      subject('history', 'B', 's5')
    ]
  }
});
assert.strictEqual(evaluateCourseEligibility(course, applicationsMaths).status, 'not_eligible');

const national5OnlyResit = applicant({
  applicant_identity: {
    resit: {
      has_resits: true,
      subjects_resat: [
        {
          subject_id: 'english_language',
          qualification_level: 'national_5'
        }
      ]
    }
  }
});
assert.strictEqual(evaluateCourseEligibility(course, national5OnlyResit).status, 'eligible');

const scotlandHomeALevel = scotlandHomeALevelApplicant();
const scotlandHomeALevelEligibility = evaluateCourseEligibility(course, scotlandHomeALevel);
assert.strictEqual(scotlandHomeALevelEligibility.status, 'eligible');
assert.strictEqual(scotlandHomeALevelEligibility.qualification_route, 'a_level');
assert.ok(scotlandHomeALevelEligibility.applicant_group_ids.includes('home_fee'));
assert.ok(scotlandHomeALevelEligibility.applicant_group_ids.includes('scotland_domiciled'));
assert.ok(scotlandHomeALevelEligibility.applicant_group_ids.includes('school_leaver'));
assert.ok(!scotlandHomeALevelEligibility.applicant_group_ids.includes('rest_of_uk'));
assert.strictEqual(scotlandHomeALevelEligibility.academic_pathway, 'standard');
assert.strictEqual(
  scotlandHomeALevelEligibility.academic_pathway_id,
  'a_level_scotland_home_standard_offer'
);
assert.ok(!scotlandHomeALevelEligibility.failures.includes('a_level_route_not_supported_for_applicant_groups'));
const scotlandHomeALevelClassification = classifyInterviewBand(course, config, scotlandHomeALevel);
assert.strictEqual(scotlandHomeALevelClassification.guidance_pool_id, 'scotland_home_school_leaver');
assert.strictEqual(scotlandHomeALevelClassification.eligibility.status, 'eligible');
const scotlandHomeALevelCard = resultCardFor(scotlandHomeALevel);
assert.strictEqual(
  decisionPathCheck(scotlandHomeALevelCard, 'Applicant pool').summary,
  'Home, Scotland-domiciled applicants'
);
assert.strictEqual(scotlandHomeALevelCard.academic_pathway, 'standard');
assert.strictEqual(scotlandHomeALevelCard.contextual_status, null);
assert.strictEqual(scotlandHomeALevelCard.contextual_confirmation, null);
assert.strictEqual(scotlandHomeALevelCard.alternative_academic_offer, null);
assert.ok(requirementLabels(scotlandHomeALevelCard).includes('A-level grades'));
assert.ok(!requirementLabels(scotlandHomeALevelCard).includes('Scottish adjusted/contextual route'));

const scotlandHomeALevelMissingChemistry = scotlandHomeALevelApplicant({
  a_level_profile: {
    subjects: [
      { subject_id: 'biology', predicted_grade: 'A' },
      { subject_id: 'physics', predicted_grade: 'A' },
      { subject_id: 'mathematics', predicted_grade: 'A' }
    ],
    completed_in_one_sitting: true
  }
});
const scotlandHomeALevelMissingChemistryEligibility =
  evaluateCourseEligibility(course, scotlandHomeALevelMissingChemistry);
assert.strictEqual(scotlandHomeALevelMissingChemistryEligibility.status, 'not_eligible');
assert.strictEqual(
  scotlandHomeALevelMissingChemistryEligibility.academic_pathway_id,
  'a_level_scotland_home_standard_offer'
);
assert.ok(scotlandHomeALevelMissingChemistryEligibility.failures.includes('a_level_requirements_not_met'));
assert.ok(
  !scotlandHomeALevelMissingChemistryEligibility.failures
    .includes('a_level_route_not_supported_for_applicant_groups')
);

const scotlandHomeALevelReachWp = scotlandHomeALevelApplicant({
  contextual_profile: contextualProfile({
    home_area_region: {
      simd_quintile: 'q1'
    },
    access_programmes: reach('completed')
  })
});
const scotlandHomeALevelReachWpContextual =
  evaluateContextualEligibility(course, scotlandHomeALevelReachWp);
assert.strictEqual(scotlandHomeALevelReachWpContextual.status, 'not_contextual');
assert.strictEqual(
  scotlandHomeALevelReachWpContextual.policy_decision,
  'outside_scottish_qualification_route_scope'
);
const scotlandHomeALevelReachWpEligibility =
  evaluateCourseEligibility(course, scotlandHomeALevelReachWp);
assert.strictEqual(scotlandHomeALevelReachWpEligibility.status, 'eligible');
assert.strictEqual(scotlandHomeALevelReachWpEligibility.academic_pathway, 'standard');
assert.strictEqual(
  scotlandHomeALevelReachWpEligibility.academic_pathway_id,
  'a_level_scotland_home_standard_offer'
);
assert.ok(!scotlandHomeALevelReachWpEligibility.applicant_group_ids.includes('contextual'));
assert.ok(!scotlandHomeALevelReachWpEligibility.applicant_group_ids.includes('widening_participation'));
assert.ok(!scotlandHomeALevelReachWpEligibility.manual_review_reasons.includes('glasgow_reach_completion_required'));
const scotlandHomeALevelReachWpClassification =
  classifyInterviewBand(course, config, scotlandHomeALevelReachWp);
assert.strictEqual(scotlandHomeALevelReachWpClassification.guidance_pool_id, 'scotland_home_school_leaver');
const scotlandHomeALevelReachWpCard = resultCardFor(scotlandHomeALevelReachWp);
assert.strictEqual(scotlandHomeALevelReachWpCard.academic_pathway, 'standard');
assert.strictEqual(scotlandHomeALevelReachWpCard.contextual_status, null);
assert.strictEqual(scotlandHomeALevelReachWpCard.contextual_confirmation, null);
assert.strictEqual(scotlandHomeALevelReachWpCard.alternative_academic_offer, null);
assert.ok(!requirementLabels(scotlandHomeALevelReachWpCard).includes('Scottish adjusted/contextual route'));

const rukStandard = aLevelApplicant();
const rukStandardClassification = classifyInterviewBand(course, config, rukStandard);
assert.strictEqual(rukStandardClassification.guidance_pool_id, 'home_rest_of_uk_school_leaver');
assert.strictEqual(rukStandardClassification.eligibility.academic_pathway_id, 'a_level_uk_standard_offer');
const rukStandardCard = resultCardFor(rukStandard);
assert.strictEqual(
  decisionPathCheck(rukStandardCard, 'Applicant pool').summary,
  'Rest of UK / ROI applicants'
);
assert.strictEqual(rukStandardCard.academic_pathway, 'standard');
assert.strictEqual(rukStandardCard.contextual_status, null);
assert.strictEqual(rukStandardCard.contextual_confirmation, null);
assert.strictEqual(rukStandardCard.alternative_academic_offer, null);
assert.strictEqual(rukStandardCard.decision_transparency.ucat_comparison.comparison_type, 'historical_range');
assert.strictEqual(
  rukStandardCard.decision_transparency.ucat_comparison.benchmark_label,
  'ApplySmart prediction band'
);
assert.strictEqual(
  rukStandardCard.decision_transparency.ucat_comparison.caveat,
  GLASGOW_RUK_UCAT_PREDICTION_CAVEAT
);
assert.strictEqual(
  rukStandardCard.decision_transparency.ucat_comparison.evidence_status,
  'applysmart_derived'
);
assert.strictEqual(
  rukStandardCard.decision_transparency.selection_metric.comparison_label,
  'ApplySmart prediction band'
);
assert.strictEqual(
  rukStandardCard.decision_transparency.selection_metric.comparison_label_type,
  'applysmart_advisory_guide'
);
assert.strictEqual(
  rukStandardCard.decision_transparency.selection_metric.difference_word,
  'prediction band'
);
assert.ok(
  rukStandardCard.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Historical guidance')
    .summary.includes('ApplySmart-derived guidance informed by Glasgow historical RUK evidence')
);
assert.ok(!requirementLabels(rukStandardCard).includes('Scottish adjusted/contextual route'));

console.log(
  'Glasgow A100 Scottish/contextual implementation regression: PASS ' +
  '(standard SQA, adjusted Reach+WP, raw-flag denial, Reach information-needed, SQA timing/resit safeguards, Scotland/Home A-level route and UCAT pool)'
);
