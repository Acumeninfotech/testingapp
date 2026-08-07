#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
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
  for (const [key, value] of Object.entries(overrides || {})) {
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

function includesFailure(result, expected) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.includes(expected);
}

function includesFailurePrefix(result, expectedPrefix) {
  const failures = [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
  return failures.some((failure) => String(failure).startsWith(expectedPrefix));
}

function component(result) {
  return result.ranking?.components?.oxford_composite || {};
}

function makeResultCard(course, config, applicant, classification) {
  return presentResultCard({
    eligibilityStatus: classification.eligibility.status,
    interviewBand: classification.canonical_interview_band,
    manualReviewRequired: classification.manual_review_required === true,
    manualReviewReason: humanManualReviewReason(classification.eligibility.manual_review_reasons),
    insufficientEvidenceReasonCode: insufficientEvidenceReasonCodeFromWarnings(classification.warnings, {
      eligibilityStatus: classification.eligibility.status,
      guidancePoolId: classification.guidance_pool_id ?? null
    }),
    transparencyContext: {
      course_identity: {
        profile_id: course.profile_id
      },
      applicant_context: applicant,
      applicant_group_ids: classification.applicant_group_ids || [],
      readiness: course.engine_notes,
      eligibility_checks: classification.eligibility.checks || [],
      eligibility_failures: classification.eligibility.failures || [],
      stage_1_eligibility: course.stage_1_eligibility || null,
      historical_admissions: course.historical_admissions || null,
      ranking: classification.ranking || null,
      band_metric: classification.band_metric || null,
      guidance_pool: classification.guidance_pool || null,
      score_model: config.score_model,
      guidance_pool_id: classification.guidance_pool_id || null,
      warnings: classification.warnings || []
    }
  });
}

const course = readJson('data/universities/oxford-a100.json');
const research = readJson('data/research/oxford-a100-research.json');
const config = readJson('data/interview-band-configs/oxford-a100.json');
const fixture = readJson('data/fixtures/interview-band-classification/oxford-a100.json');
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, 'oxford-a100');
assert.strictEqual(course.course.ucas_code, 'A100');
assert.strictEqual(course.course.is_graduate_entry, false);
assert.strictEqual(research.course_profile_id, course.profile_id);
assert.strictEqual(config.course_profile_id, course.profile_id);
assert.strictEqual(fixture.course_profile_id, course.profile_id);
assert.strictEqual(course.stage_2_interview_selection.primary_model, 'academic_plus_ucat_weighting');
assert.strictEqual(config.score_model.components[0].type, 'gcse_ucat_weighted_composite');
assert.strictEqual(hasNestedKey(course, 'offer_prediction'), false);
assert.strictEqual(hasNestedKey(config, 'offer_prediction'), false);
assert.match(
  config.evidence.summary,
  /does not publish the exact contextualised GCSE algorithm/
);
assert.match(
  config.score_model.presentation.selection_summary,
  /does not publish a single UCAT cut-off/
);

const indexEntry = index.universities.find((entry) => entry.id === course.profile_id);
assert.ok(indexEntry, 'Oxford A100 must exist in data/index.json.');
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(indexEntry.interview_band_config_file, 'interview-band-configs/oxford-a100.json');
assert.strictEqual(indexEntry.result_card_example_file, 'examples/oxford-a100-result-card.example.json');

for (const scenario of fixture.scenarios) {
  const applicant = merge(fixture.base_applicant, scenario.overrides);
  const result = classifyInterviewBand(course, config, applicant);
  const expected = scenario.expected;
  const oxfordComponent = component(result);

  assert.strictEqual(
    result.eligibility.status,
    expected.eligibility_status,
    `${scenario.scenario_id}: eligibility`
  );
  assert.strictEqual(
    result.canonical_interview_band,
    expected.interview_band,
    `${scenario.scenario_id}: interview band`
  );
  if (expected.guidance_pool_id) {
    assert.strictEqual(
      result.guidance_pool_id,
      expected.guidance_pool_id,
      `${scenario.scenario_id}: guidance pool`
    );
  }
  if (Number.isFinite(expected.score)) {
    assert.strictEqual(result.ranking?.value, expected.score, `${scenario.scenario_id}: score`);
  }
  if (Number.isFinite(expected.ucat_score)) {
    assert.strictEqual(
      oxfordComponent.components?.ucat?.value,
      expected.ucat_score,
      `${scenario.scenario_id}: UCAT component`
    );
  }
  if (Number.isFinite(expected.gcse_score)) {
    assert.strictEqual(
      oxfordComponent.components?.gcse?.value,
      expected.gcse_score,
      `${scenario.scenario_id}: GCSE component`
    );
  }
  if (expected.route) {
    assert.strictEqual(oxfordComponent.route, expected.route, `${scenario.scenario_id}: route`);
  }
  if (Number.isFinite(expected.missing_school_context_penalty)) {
    assert.strictEqual(
      oxfordComponent.components?.gcse?.missing_school_context_penalty,
      expected.missing_school_context_penalty,
      `${scenario.scenario_id}: missing school context penalty`
    );
  }
  if (expected.failure) {
    assert.ok(includesFailure(result, expected.failure), `${scenario.scenario_id}: failure ${expected.failure}`);
  }
  if (expected.failure_prefix) {
    assert.ok(
      includesFailurePrefix(result, expected.failure_prefix),
      `${scenario.scenario_id}: failure prefix ${expected.failure_prefix}`
    );
  }
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

const sjtResults = [1, 2, 3, 4].map((sjtBand) => {
  const applicant = merge(fixture.base_applicant, {
    admissions_tests: {
      ucat: {
        total_score: 2420,
        sjt_band: sjtBand
      }
    }
  });
  return classifyInterviewBand(course, config, applicant);
});
assert.deepStrictEqual(
  sjtResults.map((result) => result.canonical_interview_band),
  ['interview_likely', 'interview_likely', 'interview_likely', 'interview_likely'],
  'SJT bands 1-4 must not alter Oxford pre-interview ranking.'
);
assert.deepStrictEqual(
  sjtResults.map((result) => result.ranking.value),
  [94.81, 94.81, 94.81, 94.81],
  'SJT bands 1-4 must not alter the Oxford composite score.'
);

const nonContextualOxfordApplicant = merge(fixture.base_applicant, {
  applicant_identity: {
    contextual: false,
    contextual_flags: {}
  },
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'unknown',
      imd_quintile: 'unknown',
      tundra_quintile: 'unknown',
      simd_quintile: 'unknown'
    },
    financial_support: {},
    school_education: {},
    personal_circumstances: {},
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: '',
        not_sure_programme: false
      },
      other_programmes: [],
      other_programme_name: ''
    },
    partner_schools: {
      status: 'no',
      relationships: []
    }
  }
});

const contextualEvidenceOxfordApplicant = merge(nonContextualOxfordApplicant, {
  applicant_identity: {
    contextual: true,
    contextual_flags: {
      care_experienced: true,
      free_school_meals: true,
      refugee_or_asylum_seeker: true
    }
  },
  contextual_profile: {
    home_area_region: {
      polar4_quintile: 'q1',
      imd_quintile: 'q1',
      tundra_quintile: 'q1',
      simd_quintile: 'q1'
    },
    financial_support: {
      free_school_meals: 'yes',
      ucat_bursary_recipient: 'yes'
    },
    school_education: {
      first_in_family_at_university: 'yes',
      state_non_fee_paying_school: 'yes'
    },
    personal_circumstances: {
      care_experienced: 'yes',
      refugee: 'yes'
    },
    access_programmes: {
      participation_status: 'yes',
      ukwpmed: {
        status: 'yes',
        programme_id: 'kplus',
        programme_status: 'completed',
        provider_university_id: 'kings_college_london',
        completion_year: 2025,
        not_sure_programme: false
      },
      other_programmes: [],
      other_programme_name: ''
    },
    partner_schools: {
      status: 'yes',
      relationships: [
        {
          university_id: 'oxford',
          school_name: 'Example School',
          status: 'yes'
        }
      ]
    }
  }
});

const nonContextualOxfordResult = classifyInterviewBand(course, config, nonContextualOxfordApplicant);
const contextualEvidenceOxfordResult = classifyInterviewBand(course, config, contextualEvidenceOxfordApplicant);

assert.strictEqual(
  contextualEvidenceOxfordResult.eligibility.status,
  nonContextualOxfordResult.eligibility.status,
  'Oxford contextual profile evidence must not change eligibility status.'
);
assert.strictEqual(
  contextualEvidenceOxfordResult.canonical_interview_band,
  nonContextualOxfordResult.canonical_interview_band,
  'Oxford contextual profile evidence must not change interview band.'
);
assert.strictEqual(
  contextualEvidenceOxfordResult.ranking?.value,
  nonContextualOxfordResult.ranking?.value,
  'Oxford contextual profile evidence must not change ranking score.'
);
assert.strictEqual(
  contextualEvidenceOxfordResult.guidance_pool_id,
  nonContextualOxfordResult.guidance_pool_id,
  'Oxford contextual profile evidence must not change applicant pool selection.'
);

const cardApplicant = merge(fixture.base_applicant, {
  admissions_tests: {
    ucat: {
      total_score: 2420,
      sjt_band: 2
    }
  }
});
const cardResult = classifyInterviewBand(course, config, cardApplicant);
const card = makeResultCard(course, config, cardApplicant, cardResult);
const cardText = JSON.stringify(card);

assert.strictEqual(card.prediction.result_band, cardResult.canonical_interview_band);
assert.strictEqual(card.prediction.offer_prediction_status, undefined);
assert.ok(cardText.includes('Oxford does not publish a single UCAT cut-off'));
assert.ok(cardText.includes('modelled guidance'));
assert.ok(cardText.includes('contextualised GCSE'));
assert.ok(cardText.includes('not a current cut-off'));
assert.ok(!/offer probability|chance of offer|guaranteed interview/i.test(cardText));
assert.ok(!/official Oxford cut-off (is|of|:)/i.test(cardText));
assert.ok(
  card.decision_transparency.score_breakdown ||
    card.decision_transparency.decision_path.some((stage) => {
      return JSON.stringify(stage).includes('selection score');
    }),
  'Result card must include transparent scoring or decision path details.'
);

const distribution = course.historical_admissions.ucat_distribution_2025.bands;
const totals = distribution.reduce((acc, row) => {
  acc.not_interviewed += row.not_interviewed;
  acc.interviewed_no_place += row.interviewed_no_place;
  acc.place += row.place;
  return acc;
}, { not_interviewed: 0, interviewed_no_place: 0, place: 0 });
assert.deepStrictEqual(totals, {
  not_interviewed: 601,
  interviewed_no_place: 250,
  place: 175
});
assert.strictEqual(
  totals.not_interviewed + totals.interviewed_no_place + totals.place,
  course.historical_admissions.ucat_distribution_2025.totals_verified.total
);

console.log('Oxford A100 readiness regression passed.');
