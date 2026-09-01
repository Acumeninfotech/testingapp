#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');
const course = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'data', 'universities', 'aston-a100.json'),
    'utf8'
  )
);

const config = {
  schema_version: '1.0.0',
  course_profile_id: 'aston-a100',
  confidence: 'low',
  evidence: {
    classification: 'official_formula_acceptance_fixture',
    summary: 'Acceptance-only configuration using stored historical guidance, not live cutoffs.',
    source_ids: [
      'aston_official_research_team_2026_2027',
      'aston_foi_pre_interview_2026_2027'
    ]
  },
  eligibility: {},
  score_model: {
    type: 'component_sum',
    basis: 'Official Aston Home and WP pre-interview score',
    pool_specific_output: true,
    scale: {
      min: 0,
      max: 36
    },
    components: [
      {
        component_id: 'gcse_academic_score',
        type: 'gcse_mandatory_then_best',
        subject_count: 6,
        mandatory_subject_ids: [
          'english_language',
          'mathematics'
        ],
        mandatory_subject_alternatives: [
          {
            alternative_id: 'aston_science_route',
            options: [
              {
                subject_ids: [
                  'biology',
                  'chemistry'
                ]
              },
              {
                subject_ids: [
                  'combined_science'
                ],
                subject_credits: {
                  combined_science: 2
                }
              }
            ]
          }
        ],
        ambiguous_grade_values: [
          'A'
        ],
        bands: [
          {
            minimum_grade: '9',
            points: 4
          },
          {
            minimum_grade: '8',
            points: 4
          },
          {
            minimum_grade: '7',
            points: 3
          },
          {
            minimum_grade: '6',
            points: 2
          },
          {
            minimum_grade: '5',
            points: 1
          }
        ],
        max: 24
      },
      {
        component_id: 'ucat_score',
        type: 'ucat_range_lookup',
        ranges: [
          { band: '12_points', min: 2550, max: 2700 },
          { band: '11_points', min: 2350, max: 2549 },
          { band: '10_points', min: 2150, max: 2349 },
          { band: '9_points', min: 1950, max: 2149 },
          { band: '8_points', min: 1800, max: 1949 },
          { band: '7_points', min: 1650, max: 1799 }
        ],
        points_by_band: {
          '12_points': 12,
          '11_points': 11,
          '10_points': 10,
          '9_points': 9,
          '8_points': 8,
          '7_points': 7
        },
        max: 12
      }
    ]
  },
  guidance_pools: [
    {
      pool_id: 'home_wp',
      priority: 20,
      applicant_match: {
        all_group_ids: [
          'home_fee'
        ],
        any_group_ids: [
          'contextual',
          'widening_participation'
        ]
      },
      metric: 'selection_score',
      band_rules: [
        { band: 'realistic', operator: 'greater_than_or_equal', value: 29 }
      ]
    },
    {
      pool_id: 'home_non_wp',
      priority: 10,
      applicant_match: {
        all_group_ids: [
          'home_fee'
        ],
        excluded_group_ids: [
          'contextual',
          'widening_participation'
        ]
      },
      metric: 'selection_score',
      band_rules: [
        { band: 'realistic', operator: 'greater_than_or_equal', value: 32.5 }
      ]
    },
    {
      pool_id: 'international',
      priority: 30,
      applicant_match: {
        all_group_ids: [
          'international_fee'
        ]
      },
      metric: 'ucat_total',
      band_rules: [
        { band: 'realistic', operator: 'greater_than_or_equal', value: 2050 }
      ]
    }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseApplicant() {
  return {
    profile_id: 'aston_selection_acceptance_applicant',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '9',
        history: '9',
        geography: '9'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'A', practical_endorsement: null }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        sjt_band: 4
      }
    }
  };
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertOfferUnavailable(result) {
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'offer_score'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'offer_probability'), false);
}

const tests = [
  {
    id: 'home_non_wp_separate_sciences_scores_out_of_36',
    run() {
      const result = classify(baseApplicant());
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.guidance_pool_id, 'home_non_wp');
      assert.strictEqual(result.ranking.value, 35);
      assert.strictEqual(result.ranking.max, 36);
      assert.deepStrictEqual(result.band_metric, {
        metric: 'selection_score',
        value: 35,
        scale: { min: 0, max: 36 }
      });
      assert.match(result.explanation, /35\/36 selection score/);
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'home_non_wp_double_science_scores_as_two_gcses',
    run() {
      const applicant = baseApplicant();
      applicant.gcse_profile.subjects = {
        english_language: '6',
        mathematics: '6',
        combined_science: '7/7',
        physics: '9',
        history: '8'
      };
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.eligibility.exact_gcse_count, 5);
      assert.strictEqual(result.ranking.components.gcse_academic_score.value, 18);
      assert.strictEqual(
        result.ranking.components.gcse_academic_score.selected_subjects
          .filter((subject) => subject.subject_id === 'combined_science').length,
        2
      );
      assert.strictEqual(result.ranking.value, 29);
      assert.strictEqual(result.ranking.max, 36);
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'wp_uses_separate_wp_pool_and_36_point_metric',
    run() {
      const applicant = baseApplicant();
      applicant.contextual_profile = {
        school_education: {
          state_non_fee_paying_school: 'yes'
        },
        financial_support: {
          ucat_bursary_recipient: 'yes'
        }
      };
      applicant.a_level_profile.subjects = [
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'B', practical_endorsement: null }
      ];
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.guidance_pool_id, 'home_wp');
      assert.strictEqual(result.band_metric.metric, 'selection_score');
      assert.deepStrictEqual(result.band_metric.scale, { min: 0, max: 36 });
      assert.match(result.explanation, /\/36 selection score/);
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'international_reports_raw_ucat_metric_not_home_score',
    run() {
      const applicant = baseApplicant();
      applicant.applicant_identity.fee_status = 'International';
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.guidance_pool_id, 'international');
      assert.deepStrictEqual(result.band_metric, {
        metric: 'ucat_total',
        value: 2400,
        scale: { min: 0, max: 2700 }
      });
      assert.strictEqual(result.ranking.value, 2400);
      assert.strictEqual(result.ranking.max, 2700);
      assert.strictEqual(result.ranking.basis, 'UCAT total ranking');
      assert.match(result.explanation, /2400\/2700 UCAT total/);
      assert.doesNotMatch(result.explanation, /\/36/);
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'ucat_below_1650_has_no_invented_points',
    run() {
      const applicant = baseApplicant();
      applicant.admissions_tests.ucat.total_score = 1649;
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.ranking.status, 'unavailable');
      assert.strictEqual(result.ranking.components.ucat_score.value, null);
      assert.strictEqual(result.ranking.components.ucat_score.estimated_from_gap, false);
      assert.strictEqual(result.canonical_interview_band, 'insufficient_evidence');
      assert.strictEqual(result.band_metric.value, null);
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'legacy_grade_a_requires_insufficient_evidence',
    run() {
      const applicant = baseApplicant();
      applicant.gcse_profile.subjects.english_language = 'A';
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'eligible');
      assert.strictEqual(result.ranking.status, 'unavailable');
      assert.match(
        result.ranking.components.gcse_academic_score.reason,
        /^ambiguous_gcse_grade_points:english_language:A$/
      );
      assert.strictEqual(result.canonical_interview_band, 'insufficient_evidence');
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'a_star_outside_sciences_fails_before_selection',
    run() {
      const applicant = baseApplicant();
      applicant.a_level_profile.subjects = [
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A*', practical_endorsement: null }
      ];
      const result = classify(applicant);
      assert.strictEqual(result.eligibility.status, 'not_eligible');
      assert.ok(result.eligibility.failures.includes('a_level_requirements_not_met'));
      assert.strictEqual(result.ranking, null);
      assert.strictEqual(result.canonical_interview_band, 'not_eligible');
      assertOfferUnavailable(result);
    }
  },
  {
    id: 'offer_prediction_is_never_emitted',
    run() {
      const result = classify(baseApplicant());
      assertOfferUnavailable(result);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(result, 'offer_prediction'), false);
    }
  }
];

let passed = 0;
console.log('Aston A100 selection consumer acceptance tests');
console.log('Config mode: in-memory acceptance fixture; no interview-band config activated.\n');

for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`PASS ${test.id}`);
}

console.log(`\nPASS Aston A100 selection consumer acceptance (${passed}/${tests.length})`);
