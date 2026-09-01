#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const {
  predict
} = require('../server/src/predict');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const course = readJson('data/universities/plymouth-a100.json');
const config = readJson('data/interview-band-configs/plymouth-a100.json');

const shared = readJson(
  'data/fixtures/interview-band-classification/shared-standard-school-leaver.json'
).applicant;

function baseApplicant() {
  const applicant = clone(shared);

  applicant.profile_id = 'plymouth_a100_contextual_production_routing';

  applicant.applicant_identity.contextual = false;
  applicant.applicant_identity.contextual_status_confirmed = true;
  applicant.applicant_identity.fee_status = 'Home';
  applicant.applicant_identity.domicile = 'England';
  applicant.applicant_identity.graduate = false;

  applicant.applicant_identity.contextual_flags = {};

  applicant.qualification_route = 'a_level';

  applicant.admissions_tests.ucat = {
    total_score: 2200,
    score_scale: 2700,
    subtests: {
      verbal_reasoning: 740,
      decision_making: 730,
      quantitative_reasoning: 730
    },
    sjt_band: 2
  };

  applicant.contextual_profile = {
    home_area_region: {
      postcode: '',
      polar4_quintile: 'q5',
      imd_quintile: 'q5',
      tundra_quintile: 'q5',
      simd_quintile: '',
      home_region: null,
      specific_home_area: null,
      school_area: null,
      regional_flags: {}
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
  };

  return applicant;
}

function setGrades(applicant, grades) {
  applicant.a_level_profile = {
    subjects: [
      {
        subject_id: 'biology',
        predicted_grade: grades[0],
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'chemistry',
        predicted_grade: grades[1],
        sitting_status: 'first_sitting',
        practical_endorsement: 'pass'
      },
      {
        subject_id: 'mathematics',
        predicted_grade: grades[2],
        sitting_status: 'first_sitting'
      }
    ]
  };

  delete applicant.scottish_profile;

  return applicant;
}

function makeFivePointContextual(applicant) {
  /*
   * Use Step 6 evidence only.
   * Do NOT set applicant_identity.contextual or legacy contextual_flags.
   *
   * We use confirmed Plymouth contextual markers until the evaluator
   * reaches the official 5-point threshold.
   */
  applicant.contextual_profile.home_area_region.specific_home_area =
    'plymouth_widening_access_region';

  applicant.contextual_profile.financial_support
    .free_school_meals_at_level3_completion = 'yes';

  applicant.contextual_profile.personal_circumstances
    .care_experienced = 'yes';

  return applicant;
}

function makeUkwpmed(applicant) {
  applicant.contextual_profile.access_programmes.participation_status = 'yes';

  applicant.contextual_profile.access_programmes.ukwpmed = {
    status: 'yes',
    programme_id: 'plymouth_peninsula_pathways',
    programme_status: 'completed',
    provider_university_id: 'plymouth-a100',
    completion_year: 2026,
    not_sure_programme: false,
    significant_engagement: 'yes'
  };

  return applicant;
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function card(applicant) {
  const [result] = predict({
    universityIds: ['plymouth-a100'],
    studentProfile: applicant
  });

  return result.result_card;
}

function show(id, applicant) {
  const result = classify(applicant);
  const resultCard = card(applicant);

  console.log(`\n===== ${id} =====`);

  console.dir({
    eligibility: result.eligibility.status,
    academic_pathway_id: result.eligibility.academic_pathway_id,
    applicant_group_ids: result.applicant_group_ids,
    canonical_interview_band: result.canonical_interview_band,
    card_state: resultCard.recommendation_display_state,
    card_prediction: resultCard.prediction?.result_band,
    contextual_status: resultCard.contextual_status,
    contextual_confirmation: resultCard.contextual_confirmation,
    alternative_academic_offer: resultCard.alternative_academic_offer
  }, {
    depth: null
  });

  return {
    result,
    resultCard
  };
}

function expectEligible(id, applicant, pathway) {
  const { result, resultCard } = show(id, applicant);

  assert.strictEqual(result.eligibility.status, 'eligible');
  assert.strictEqual(
    result.eligibility.academic_pathway_id,
    pathway
  );

  assert.notStrictEqual(
    resultCard.recommendation_display_state,
    'not_eligible'
  );

  return result;
}

function expectNotEligible(id, applicant) {
  const { result, resultCard } = show(id, applicant);

  assert.strictEqual(
    result.eligibility.status,
    'not_eligible'
  );

  assert.strictEqual(
    resultCard.recommendation_display_state,
    'not_eligible'
  );

  return result;
}


/* ============================================================
 * 1. STANDARD A*AA
 * ============================================================ */

{
  const applicant = setGrades(
    baseApplicant(),
    ['A*', 'A', 'A']
  );

  const result = expectEligible(
    'STANDARD A*AA',
    applicant,
    'plymouth_standard_a_level_a_star_aa'
  );

  assert.ok(!result.applicant_group_ids.includes('contextual'));
  assert.ok(!result.applicant_group_ids.includes('plymouth_ukwpmed'));
}


/* ============================================================
 * 2. STANDARD AAB MUST FAIL
 * ============================================================ */

{
  const applicant = setGrades(
    baseApplicant(),
    ['A', 'A', 'B']
  );

  const result = expectNotEligible(
    'STANDARD AAB',
    applicant
  );

  assert.ok(!result.applicant_group_ids.includes('contextual'));
  assert.ok(!result.applicant_group_ids.includes('plymouth_ukwpmed'));
}


/* ============================================================
 * 3. FIVE-POINT CONTEXTUAL AAB
 * ============================================================ */

{
  const applicant = makeFivePointContextual(
    setGrades(baseApplicant(), ['A', 'A', 'B'])
  );

  const result = expectEligible(
    '5 POINT CONTEXTUAL AAB',
    applicant,
    'plymouth_contextual_home_aab'
  );

  assert.ok(result.applicant_group_ids.includes('contextual'));
  assert.ok(
    result.applicant_group_ids.includes('widening_participation')
  );

  assert.ok(
    !result.applicant_group_ids.includes('plymouth_ukwpmed')
  );
}


/* ============================================================
 * 4. CRITICAL NEGATIVE:
 *    FIVE-POINT CONTEXTUAL ABB MUST NOT GET UKWPMED
 * ============================================================ */

{
  const applicant = makeFivePointContextual(
    setGrades(baseApplicant(), ['A', 'B', 'B'])
  );

  const result = expectNotEligible(
    '5 POINT CONTEXTUAL ABB',
    applicant
  );

  assert.ok(result.applicant_group_ids.includes('contextual'));

  assert.ok(
    !result.applicant_group_ids.includes('plymouth_ukwpmed')
  );
}


/* ============================================================
 * 5. UKWPMED ABB
 * ============================================================ */

{
  const applicant = makeUkwpmed(
    setGrades(baseApplicant(), ['A', 'B', 'B'])
  );

  const result = expectEligible(
    'UKWPMED ABB',
    applicant,
    'plymouth_ukwpmed_abb'
  );

  assert.ok(result.applicant_group_ids.includes('contextual'));
  assert.ok(
    result.applicant_group_ids.includes('widening_participation')
  );
  assert.ok(
    result.applicant_group_ids.includes('plymouth_ukwpmed')
  );
}


/* ============================================================
 * 6. UKWPMED BELOW ABB
 * ============================================================ */

{
  const applicant = makeUkwpmed(
    setGrades(baseApplicant(), ['B', 'B', 'B'])
  );

  const result = expectNotEligible(
    'UKWPMED BBB',
    applicant
  );

  assert.ok(
    result.applicant_group_ids.includes('plymouth_ukwpmed')
  );
}


/* ============================================================
 * 7. LEGACY FLAGS MUST NOT ACTIVATE CONTEXTUAL ROUTES
 * ============================================================ */

{
  const applicant = setGrades(
    baseApplicant(),
    ['A', 'B', 'B']
  );

  applicant.applicant_identity.contextual = true;

  applicant.applicant_identity.contextual_flags = {
    ukwpmed: true,
    free_school_meals: true,
    care_experienced: true
  };

  const result = expectNotEligible(
    'LEGACY FLAGS ONLY ABB',
    applicant
  );

  assert.ok(!result.applicant_group_ids.includes('contextual'));
  assert.ok(
    !result.applicant_group_ids.includes('plymouth_ukwpmed')
  );
}

console.log(
  '\nPASS: Plymouth A100 contextual production routing regression'
);
