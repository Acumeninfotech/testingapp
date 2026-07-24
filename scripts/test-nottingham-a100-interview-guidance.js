#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateNottinghamA100
} = require('../assets/js/engine/nottingham-a100-consumer');
const {
  classifyNottinghamA100InterviewGuidance
} = require('../assets/js/engine/nottingham-a100-interview-guidance');

const rootDir = path.resolve(__dirname, '..');
const readJson = (...parts) => JSON.parse(
  fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
);
const course = readJson('data', 'universities', 'nottingham-a100.json');
const config = readJson('data', 'interview-band-configs', 'nottingham-a100.json');
const research = readJson('data', 'research', 'nottingham-a100-research.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseApplicant() {
  return {
    qualification_route: 'a_level',
    application_year: 2026,
    entry_year: 2027,
    has_gcse_or_equivalent_results: true,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      widening_participation: false,
      date_of_birth: '2008-06-01',
      resit: {
        has_resits: false
      }
    },
    gcse_profile: {
      subjects: {
        biology: '9',
        chemistry: '9',
        mathematics: '7',
        english_language: '8',
        physics: '9',
        history: '8',
        geography: '7',
        french: '6'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'A', practical_endorsement: null }
      ],
      completed_in_one_sitting: true,
      study_period_years: 2
    },
    admissions_tests: {
      ucat: {
        taken: true,
        test_year: 2026,
        sjt_band: 2,
        subtests: {
          verbal_reasoning: 750,
          quantitative_reasoning: 650,
          decision_making: 850
        }
      }
    }
  };
}

function evaluate(applicant) {
  return evaluateNottinghamA100(course, applicant, {
    interviewBandConfig: config
  });
}

assert.strictEqual(config.score_model.scale.max, 82);
assert.strictEqual(
  config.score_model.historical_positioning.source_type,
  'FOI'
);
assert.strictEqual(
  config.score_model.historical_positioning.non_executable_admissions_logic,
  true
);
assert.strictEqual(
  config.score_model.historical_positioning.fixed_cutoff,
  false
);
assert.ok(config.guidance_pools.every((pool) => pool.band_rules.length === 0));

const researchGuidance = research.foi_historical_interview_guidance;
for (const groupId of [
  'home_standard',
  'contextual_or_widening_participation',
  'international'
]) {
  const expectedCycles = researchGuidance.values.map((cycle) => ({
    entry_year: cycle.entry_year,
    min: cycle[groupId].minimum,
    max: cycle[groupId].maximum
  }));
  const expectedTypical = {
    min: researchGuidance.cross_cycle_typical_range_shown_in_evidence[groupId].minimum,
    max: researchGuidance.cross_cycle_typical_range_shown_in_evidence[groupId].maximum
  };
  const configuredGroup =
    config.score_model.historical_positioning.groups[groupId];

  assert.deepStrictEqual(configuredGroup.historical_cycles, expectedCycles);
  assert.deepStrictEqual(configuredGroup.typical_range, expectedTypical);
}

const below = evaluate(baseApplicant());
assert.strictEqual(below.official_score.value, 61);
assert.strictEqual(
  below.interview_band_guidance.guidance_label,
  'guidance-only: below the supplied historical guidance'
);
assert.strictEqual(
  below.interview_band_guidance.safeguards.admissions_decision_effect,
  false
);

const withinApplicant = clone(baseApplicant());
withinApplicant.gcse_profile.subjects.mathematics = '9';
withinApplicant.gcse_profile.subjects.english_language = '9';
withinApplicant.gcse_profile.subjects.geography = '9';
const within = evaluate(withinApplicant);
assert.strictEqual(within.official_score.value, 66);
assert.strictEqual(
  within.interview_band_guidance.guidance_label,
  'guidance-only: historically competitive range'
);

const aboveApplicant = clone(baseApplicant());
Object.keys(aboveApplicant.gcse_profile.subjects).forEach((subjectId) => {
  aboveApplicant.gcse_profile.subjects[subjectId] = '9';
});
aboveApplicant.admissions_tests.ucat.sjt_band = 1;
aboveApplicant.admissions_tests.ucat.subtests = {
  verbal_reasoning: 850,
  quantitative_reasoning: 850,
  decision_making: 850
};
const above = evaluate(aboveApplicant);
assert.strictEqual(above.official_score.value, 82);
assert.strictEqual(
  above.interview_band_guidance.guidance_label,
  'guidance-only: above the supplied historical range'
);

const contextualApplicant = clone(baseApplicant());
contextualApplicant.applicant_identity.contextual = true;
contextualApplicant.applicant_identity.contextual_status_confirmed = true;
const contextual = evaluate(contextualApplicant);
assert.strictEqual(
  contextual.interview_band_guidance.guidance_group,
  'contextual_or_widening_participation'
);
assert.strictEqual(
  contextual.interview_band_guidance.guidance_label,
  'guidance-only: historically competitive range'
);

const band4Applicant = clone(baseApplicant());
band4Applicant.admissions_tests.ucat.sjt_band = 4;
const band4 = evaluate(band4Applicant);
assert.strictEqual(
  band4.interview_band_guidance.status,
  'excluded_before_guidance'
);
assert.strictEqual(band4.interview_band_guidance.guidance_label, null);
assert.strictEqual(
  band4.interview_band_guidance.historical_comparison_performed,
  false
);

const noGcseEvaluation = {
  eligibility: {
    status: 'eligible',
    applicant_group_ids: ['home_fee']
  },
  official_score: {
    status: 'calculated',
    value: 38,
    max: 50,
    components: {
      sjt: {
        excludes_from_interview: false
      }
    }
  },
  contextual_policy: {
    status: 'not_applicable'
  }
};
const noGcse = classifyNottinghamA100InterviewGuidance(
  config,
  noGcseEvaluation
);
assert.strictEqual(noGcse.status, 'not_applicable_no_gcse_scale');
assert.strictEqual(noGcse.guidance_label, null);
assert.strictEqual(noGcse.historical_comparison_performed, false);

const guidanceOutput = JSON.stringify(within.interview_band_guidance);
assert.strictEqual(guidanceOutput.includes('"probability"'), false);
assert.strictEqual(guidanceOutput.includes('"outcome"'), false);
assert.strictEqual(guidanceOutput.includes('interview_likely'), false);
assert.strictEqual(guidanceOutput.includes('"guaranteed"'), false);

assert.strictEqual(course.engine_notes.metadata_activation_enabled, true);
assert.strictEqual(course.engine_notes.result_card_ready, true);
assert.strictEqual(course.engine_notes.interview_prediction_ready, true);
assert.strictEqual(course.engine_notes.deterministic_prediction_enabled, false);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(
  course.engine_notes.no_gcse_50_point_interview_banding_enabled,
  false
);
assert.strictEqual(course.engine_notes.offer_prediction_ready, undefined);
assert.strictEqual(
  course.engine_notes.interview_band_configuration_present,
  true
);
assert.strictEqual(course.engine_notes.ready_for_result_card_example, true);
assert.strictEqual(course.engine_notes.result_card_example_complete, true);

console.log('Nottingham A100 guidance-only interview-band tests: PASS');
