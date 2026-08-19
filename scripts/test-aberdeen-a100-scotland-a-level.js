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
  predict
} = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function scotlandAlevelStandardApplicant() {
  const applicant = clone(
    readJson('data/fixtures/interview-band-classification/shared-standard-school-leaver.json')
      .applicant
  );

  applicant.profile_id = 'aberdeen_scotland_a_level_standard_regression';
  applicant.qualification_route = 'a_level';
  applicant.applicant_identity.fee_status = 'Home';
  applicant.applicant_identity.domicile = 'Scotland';
  applicant.applicant_identity.contextual = false;
  applicant.applicant_identity.contextual_status_confirmed = true;
  applicant.applicant_identity.contextual_flags = {
    plus_flag: false,
    flag: false,
    simd20: false,
    simd40: false,
    care_experienced: false,
    refugee: false,
    asylum_seeker: false,
    ucat_bursary: false,
    school_contextual_indicator: false,
    free_school_meals: false,
    first_generation_higher_education: false
  };
  applicant.admissions_tests.ucat.total_score = 2100;
  applicant.admissions_tests.ucat.subtests = {
    verbal_reasoning: 700,
    decision_making: 700,
    quantitative_reasoning: 700
  };

  return applicant;
}

const course = readJson('data/universities/aberdeen-a100.json');
const config = readJson('data/interview-band-configs/aberdeen-a100.json');
const applicant = scotlandAlevelStandardApplicant();

const eligibility = evaluateCourseEligibility(course, applicant);
assert.strictEqual(eligibility.status, 'eligible');
assert.strictEqual(eligibility.academic_pathway, 'standard');
assert.ok(eligibility.applicant_group_ids.includes('home_fee'));
assert.ok(eligibility.applicant_group_ids.includes('scotland_domiciled'));
assert.ok(!eligibility.applicant_group_ids.includes('contextual'));
assert.ok(!eligibility.applicant_group_ids.includes('widening_participation'));

const classification = classifyInterviewBand(course, config, applicant);
assert.strictEqual(classification.eligibility.status, 'eligible');
assert.strictEqual(classification.guidance_pool_id, 'home_scotland_school_leaver');
assert.strictEqual(classification.ranking.value, 2100);
assert.strictEqual(classification.band_metric.metric, 'ucat_total');
assert.strictEqual(classification.canonical_interview_band, 'interview_likely');

const card = predict({
  universityIds: ['aberdeen-a100'],
  studentProfile: applicant
})[0].result_card;
const cardText = JSON.stringify(card);

assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.prediction.available, true);
assert.strictEqual(card.recommendation_display_state, 'standard');
assert.strictEqual(card.prediction.ranking_metric, 'ucat_total');
assert.match(cardText, /A-level grades/);
assert.match(cardText, /UCAT/);
assert.match(cardText, /Home, Scotland-domiciled applicants/);
assert.ok(!/Prediction Unavailable/.test(cardText));

console.log(
  'Aberdeen A100 Scotland A-level regression: PASS ' +
  '(Home Scotland standard A-level applicant maps to Scottish UCAT guidance pool)'
);
