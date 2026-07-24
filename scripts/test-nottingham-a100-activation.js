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
const index = readJson('data', 'index.json');
const config = readJson('data', 'interview-band-configs', 'nottingham-a100.json');
const card = readJson('data', 'examples', 'nottingham-a100-result-card.example.json');
const research = readJson('data', 'research', 'nottingham-a100-research.json');
const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

function buildApplicant() {
  const context = card.applicant_context;

  return {
    qualification_route: context.qualification_route,
    application_year: context.admissions_tests.ucat.test_year,
    entry_year: card.course_identity.entry_year,
    has_gcse_or_equivalent_results: true,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      widening_participation: false,
      age_on_1_september: context.age_on_1_september,
      resit: {
        has_resits: false
      }
    },
    gcse_profile: {
      subjects: Object.fromEntries(
        context.academic_profile.gcse.subjects.map((subject) => [
          subject.subject_id,
          subject.grade
        ])
      )
    },
    a_level_profile: {
      subjects: context.academic_profile.a_level.predicted_grades.map((subject) => ({
        subject_id: subject.subject_id,
        predicted_grade: subject.grade,
        practical_endorsement: subject.practical_endorsement
      })),
      completed_in_one_sitting:
        context.academic_profile.a_level.completed_in_one_sitting,
      study_period_years: context.academic_profile.a_level.study_period_years
    },
    admissions_tests: {
      ucat: {
        ...context.admissions_tests.ucat
      }
    }
  };
}

assert.strictEqual(
  course.profile_status,
  'active_for_scoped_eligibility_guidance_only_interview_positioning_and_result_card'
);
assert.strictEqual(course.engine_notes.eligibility_ready, true);
assert.strictEqual(course.engine_notes.interview_prediction_ready, true);
assert.strictEqual(course.engine_notes.result_card_ready, true);
assert.strictEqual(course.engine_notes.metadata_activation_ready, true);
assert.strictEqual(course.engine_notes.metadata_activation_enabled, true);
assert.strictEqual(course.engine_notes.deterministic_prediction_enabled, false);
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(
  course.engine_notes.no_gcse_50_point_interview_banding_enabled,
  false
);
assert.deepStrictEqual(course.engine_notes.activation_blockers, []);
assert.strictEqual(course.engine_notes.regression_and_acceptance_tests_passed, true);

const indexEntry = index.universities.find((entry) => entry.id === 'nottingham-a100');
assert.ok(indexEntry, 'Nottingham A100 must be visible in data/index.json.');
assert.strictEqual(indexEntry.eligibility_ready, true);
assert.strictEqual(indexEntry.interview_prediction_ready, true);
assert.strictEqual(
  indexEntry.interview_prediction_mode,
  'guidance_only_historical_positioning'
);
assert.strictEqual(indexEntry.deterministic_prediction_enabled, false);
assert.strictEqual(indexEntry.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(indexEntry.result_card_ready, true);
assert.strictEqual(indexEntry.metadata_activation_enabled, true);
assert.strictEqual(indexEntry.no_gcse_50_point_interview_banding_enabled, false);
assert.strictEqual(
  indexEntry.interview_band_config_file,
  'interview-band-configs/nottingham-a100.json'
);

assert.strictEqual(config.score_model.scale.max, 82);
assert.strictEqual(config.score_model.historical_positioning.source_type, 'FOI');
assert.strictEqual(config.score_model.historical_positioning.guidance_only, true);
assert.strictEqual(
  config.score_model.historical_positioning.non_executable_admissions_logic,
  true
);
assert.strictEqual(config.score_model.historical_positioning.fixed_cutoff, false);
assert.ok(config.guidance_pools.every((pool) => pool.band_rules.length === 0));
assert.strictEqual(config.eligibility.excluded_score_scales[0].max, 50);
assert.strictEqual(config.eligibility.sjt_band_4.banding_permitted, false);
assert.deepStrictEqual(
  config.score_model.historical_positioning.groups.home_standard.historical_cycles,
  research.foi_historical_interview_guidance.values.map((cycle) => ({
    entry_year: cycle.entry_year,
    min: cycle.home_standard.minimum,
    max: cycle.home_standard.maximum
  }))
);

const standard = evaluateNottinghamA100(course, buildApplicant(), {
  interviewBandConfig: config
});
assert.strictEqual(standard.eligibility.status, 'eligible');
assert.strictEqual(standard.official_score.value, 66);
assert.strictEqual(standard.official_score.max, 82);
assert.strictEqual(
  standard.interview_band_guidance.guidance_label,
  'guidance-only: historically competitive range'
);
assert.strictEqual(
  standard.interview_band_guidance.safeguards.admissions_decision_effect,
  false
);
assert.strictEqual(standard.interview_prediction.deterministic, false);
assert.strictEqual(standard.offer_prediction, undefined);

const band4Applicant = buildApplicant();
band4Applicant.admissions_tests.ucat.sjt_band = 4;
const band4 = evaluateNottinghamA100(course, band4Applicant, {
  interviewBandConfig: config
});
assert.strictEqual(band4.eligibility.status, 'not_eligible');
assert.strictEqual(band4.interview_band_guidance.status, 'excluded_before_guidance');
assert.strictEqual(band4.interview_band_guidance.guidance_label, null);

const noGcse = classifyNottinghamA100InterviewGuidance(config, {
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
});
assert.strictEqual(noGcse.status, 'not_applicable_no_gcse_scale');
assert.strictEqual(noGcse.guidance_label, null);
assert.strictEqual(noGcse.historical_comparison_performed, false);

assert.match(
  readme,
  /^\| University of Nottingham \| `nottingham-a100` \| Ready \| Ready \| Low \| Ready \|$/m
);
assert.match(readme, /Completed result-card regression status: 32\/32 passing/);

console.log('Nottingham A100 activation acceptance: PASS');
