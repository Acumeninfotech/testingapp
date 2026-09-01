#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence
} = require('../assets/js/engine/result-card-presenter');

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

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }
  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

const course = readJson('data/universities/sheffield-a100.json');
const research = readJson('data/research/sheffield-a100-research.json');
const config = readJson('data/interview-band-configs/sheffield-a100.json');
const card = readJson('data/examples/sheffield-a100-result-card.example.json');
const fixture = readJson(
  'data/fixtures/interview-band-classification/sheffield-a100.json'
);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'sheffield-a100');
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(card.course_identity.profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.entry_route, 'standard_entry');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'ucat_ranking');

const gcse = course.stage_1_eligibility.gcse;
assert.strictEqual(gcse.minimum_count, 5);
assert.deepStrictEqual(
  gcse.minimum_count_at_or_above_grade.map((rule) => [
    rule.requirement_id,
    rule.count,
    rule.minimum_grade,
    rule.applies_to_group_ids || [],
    rule.excluded_group_ids || []
  ]),
  [
    [
      'five_gcse_grade_7_minimum',
      5,
      '7/A',
      [],
      ['sheffield_access_to_sheffield_medicine']
    ],
    [
      'access_to_sheffield_medicine_five_gcse_grade_6_minimum',
      5,
      '6/B',
      ['sheffield_access_to_sheffield_medicine'],
      []
    ]
  ]
);
assert.deepStrictEqual(
  gcse.grade_requirements.map((rule) => [rule.subject_id, rule.minimum_grade]),
  [
    ['english_language', '6/B'],
    ['mathematics', '6/B'],
    ['english_language', '4/C'],
    ['mathematics', '4/C']
  ]
);
assert.strictEqual(
  course.contextual_admissions.contextual_eligibility.evaluator_id,
  'sheffield_contextual_medicine_a100'
);
assert.deepStrictEqual(
  course.contextual_admissions.contextual_eligibility.activated_applicant_group_ids,
  [
    'sheffield_contextual_offer',
    'sheffield_access_to_sheffield_medicine',
    'sheffield_bradford_hallam_pathway'
  ]
);
assert.strictEqual(gcse.selection_role, 'eligibility_only');
assert.strictEqual(gcse.scored_after_eligibility, false);

const aLevel = course.stage_1_eligibility.post_16.a_level;
assert.deepStrictEqual(aLevel.standard_offer.grade_profile, ['A', 'A', 'A']);
assert.deepStrictEqual(aLevel.contextual_offer.grade_profile, ['A', 'A', 'B']);
assert.strictEqual(aLevel.science_practical_endorsement_required, true);
assert.deepStrictEqual(aLevel.excluded_subject_names, [
  'General Studies',
  'Critical Thinking'
]);

const admissionsTests = course.stage_1_eligibility.admissions_tests;
assert.strictEqual(admissionsTests.ucat.required, true);
assert.strictEqual(admissionsTests.ucat.minimum_total_score, 1800);
assert.strictEqual(admissionsTests.sjt.used_as_gate, false);
assert.deepStrictEqual(admissionsTests.sjt.accepted_bands, [1, 2, 3, 4]);
assert.deepStrictEqual(admissionsTests.sjt.excluded_bands, []);
assert.strictEqual(admissionsTests.sjt.scoring.used_in_score, false);

assert.strictEqual(config.score_model.scale.max, 2700);
assert.strictEqual(config.score_model.legacy_3600_conversion_used, false);
assert.strictEqual(config.score_model.historical_guidance_only, true);
assert.deepStrictEqual(
  config.guidance_pools.map((pool) => pool.pool_id),
  [
    'access_to_sheffield_medicine',
    'international_a100',
    'home_a100'
  ]
);

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    result.eligibility.status,
    scenario.expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    scenario.expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  assert.strictEqual(
    result.guidance_pool_id ?? null,
    scenario.expected.guidance_pool_id,
    `${scenario.scenario_id}: guidance pool`
  );
  if (scenario.expected.failure) {
    const eligibilityReasons = [
      ...result.eligibility.failures,
      ...(result.eligibility.manual_review_reasons || [])
    ];
    assert.ok(
      eligibilityReasons.includes(scenario.expected.failure),
      `${scenario.scenario_id}: expected failure ${scenario.expected.failure}`
    );
  }
  if (scenario.expected.review_boundary) {
    assert.match(
      result.eligibility.failures.join(' '),
      /qualification_route_explicitly_blocked/,
      `${scenario.scenario_id}: review-only route must not receive a positive band`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function applicantForBoundary(boundary) {
  const international = boundary.pool === 'international';
  return merge(fixture.base_applicant, {
    applicant_identity: {
      applicant_type: international
        ? 'international_standard_school_leaver'
        : 'standard_school_leaver',
      fee_status: international ? 'International' : 'Home',
      domicile: international ? 'International' : 'England',
      english_language_exempt: international
    },
    admissions_tests: {
      ucat: {
        total_score: boundary.ucat_total
      }
    }
  });
}

for (const boundary of fixture.historical_guidance_boundaries) {
  const result = classifyInterviewBand(
    course,
    config,
    applicantForBoundary(boundary)
  );
  assert.strictEqual(
    result.canonical_interview_band,
    boundary.expected_band,
    `${boundary.pool} UCAT ${boundary.ucat_total}`
  );
}

const accessResult = classifyInterviewBand(
  course,
  config,
  merge(fixture.base_applicant, fixture.scenarios.find((scenario) => {
    return scenario.scenario_id === 'verified_access_to_sheffield_medicine_step6';
  }).overrides)
);
assert.strictEqual(accessResult.canonical_interview_band, 'interview_likely');
assert.strictEqual(accessResult.ranking.value, 1800);
assert.strictEqual(
  accessResult.guidance_pool_id,
  'access_to_sheffield_medicine'
);

assert.strictEqual(course.stage_1_eligibility.post_16.scottish.route_implemented, true);
assert.strictEqual(course.stage_1_eligibility.post_16.scottish.contextual_route_implemented, true);
assert.strictEqual(
  course.stage_1_eligibility.post_16.scottish.execution_status,
  'automatic_with_complete_scottish_qualification_data'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.degree.execution_status,
  'manual_review_required_engine_v1_cannot_combine_degree_and_bbb_subject_branch'
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.scottish.higher_offer.grade_profile,
  ['A', 'A', 'A', 'B', 'B']
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.scottish.advanced_higher_offer.grade_profile,
  ['A', 'A']
);
assert.deepStrictEqual(
  course.stage_1_eligibility.post_16.scottish.grade_requirements.map((rule) => [
    rule.requirement_id,
    rule.qualification_level,
    rule.academic_pathway,
    rule.higher_grade_profile,
    rule.advanced_higher_grade_profile
  ]),
  [
    [
      'sheffield_scottish_standard_highers_and_advanced_highers',
      'scottish_highers_and_advanced_highers',
      'standard',
      ['A', 'A', 'A', 'B', 'B'],
      ['A', 'A']
    ],
    [
      'sheffield_scottish_contextual_highers_and_advanced_highers',
      'scottish_highers_and_advanced_highers',
      'contextual',
      ['A', 'A', 'B', 'B', 'B'],
      ['A', 'B']
    ]
  ]
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.degree.minimum_classification,
  '2:1'
);
assert.match(
  course.stage_1_eligibility.post_16.degree.school_qualification_requirement,
  /BBB/
);
assert.strictEqual(course.stage_1_eligibility.resits.allowed, true);
assert.deepStrictEqual(
  course.stage_1_eligibility.resits.conditions,
  [
    'All resits at a qualification level must be taken in one sitting.',
    'Only one resit per GCSE or A-level is accepted.',
    'Only failing qualifications need to be retaken.'
  ]
);
assert.deepStrictEqual(aLevel.epq_alternative_offer, {
  enabled: true,
  pathway_id: 'sheffield_epq_alternative',
  a_level_grades: ['A', 'A', 'B'],
  epq_minimum_grade: 'A',
  required_subject_grade_options: [
    {
      option_id: 'biology_mandatory_science_grade_a',
      required_subject_ids: ['biology'],
      grade_requirements: [
        {
          subject_id: 'biology',
          minimum_grade: 'A'
        }
      ],
      one_of_subject_groups: [
        {
          group_id: 'epq_second_science_with_biology',
          minimum_required: 1,
          subject_ids: ['chemistry', 'mathematics', 'physics', 'psychology', 'human_biology']
        }
      ]
    },
    {
      option_id: 'chemistry_mandatory_science_grade_a',
      required_subject_ids: ['chemistry'],
      grade_requirements: [
        {
          subject_id: 'chemistry',
          minimum_grade: 'A'
        }
      ],
      one_of_subject_groups: [
        {
          group_id: 'epq_second_science_with_chemistry',
          minimum_required: 1,
          subject_ids: ['biology', 'human_biology', 'mathematics', 'physics', 'psychology']
        }
      ]
    }
  ],
  conditions: {
    a_level_resits_allowed: false,
    must_be_taken_alongside_a_levels: true,
    equivalent_grade_combinations_allowed: false
  },
  source_ids: ['sheffield_a100_policy_2027']
});
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(aLevel, 'epq_alternative'),
  false,
  'Sheffield must use the canonical epq_alternative_offer field, not the legacy alias.'
);
assert.strictEqual(
  course.stage_1_eligibility.post_16.ib.contextual_offer.total_points,
  34
);
assert.match(gcse.science_requirement.notes, /Environmental Science/);
assert.strictEqual(
  research.ucat_and_sjt.scale_policy.flat_0_75_conversion_used_for_prediction,
  false
);
assert.deepStrictEqual(
  research.evidence_gaps.map((gap) => gap.gap_id),
  [
    'international_historical_distributions',
    'a101_historical_distributions',
    'international_qualification_table',
    'post_interview_distributions_and_tie_breakers'
  ]
);
for (const implementedRule of [
  'graduate',
  'resit',
  'contextual_ib',
  'environmental_science'
]) {
  assert.ok(
    research.readiness.engine_execution_boundaries.some((boundary) => {
      return boundary.toLowerCase().includes(implementedRule.replace('_', ' '));
    }),
    `${implementedRule}: implementation boundary must remain documented outside evidence gaps`
  );
}
assert.strictEqual(
  research.implementation_mapping.architecture_change_required,
  false
);

assert.strictEqual(card.eligibility.status, 'eligible');
assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.prediction.guidance_pool_id, 'home_a100');
assert.strictEqual(card.evidence_confidence.level, 'Medium');
assert.deepStrictEqual(card.evidence_confidence, buildEvidenceConfidence(card));
assert.deepStrictEqual(card.decision_timeline, buildDecisionTimeline(card));
assert.deepStrictEqual(
  card.decision_transparency,
  buildDecisionTransparency(card)
);
assert.match(
  card.decision_timeline[2].summary,
  /academic eligibility.*UCAT minimum.*ranking.*by UCAT/i
);
assert.match(
  JSON.stringify(card.decision_transparency),
  /"factor_id":"ucat".*"role":"ranking".*ranking most eligible applicants by UCAT/s
);
assert.strictEqual(hasNestedKey(card, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(card, 'offer_probability'), false);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry);
assert.strictEqual(indexEntry.selection_model, 'ucat_ranking');
assert.strictEqual(
  indexEntry.interview_band_config_file,
  'interview-band-configs/sheffield-a100.json'
);
assert.strictEqual(indexEntry.activation_ready, true);

for (const [field, expected] of Object.entries({
  eligibility_ready: true,
  interview_prediction_ready: true,
  interview_band_config_ready: true,
  metadata_activation_ready: true,
  result_card_ready: true,
  contextual_logic: true,
  international_prediction: true
})) {
  assert.strictEqual(course.engine_notes[field], expected, `production ${field}`);
  assert.strictEqual(indexEntry[field], expected, `index ${field}`);
}

for (const field of [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required',
  'eligibility_ready',
  'interview_prediction_ready',
  'prediction_confidence',
  'result_card_ready',
  'offer_prediction_scope'
]) {
  assert.deepStrictEqual(research.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(card.readiness[field], course.engine_notes[field]);
  assert.deepStrictEqual(indexEntry[field], course.engine_notes[field]);
}

console.log('Sheffield A100 readiness regression: PASS');
console.log(`Scenario fixtures checked: ${fixture.scenarios.length}`);
console.log(`Historical guidance boundaries checked: ${fixture.historical_guidance_boundaries.length}`);
console.log('Scale isolation, SJT handling, review boundaries and activation metadata: PASS');
