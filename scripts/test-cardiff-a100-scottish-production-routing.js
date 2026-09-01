#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateContextualEligibility
} = require('../assets/js/engine/eligibility-evaluator');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

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

const course = readJson('data/universities/cardiff-a100.json');
const config = readJson('data/interview-band-configs/cardiff-a100.json');

const scottishRukApplicant = {
  profile_id: 'cardiff_scottish_ruk_routing_applicant',
  applicant_group_ids: [],
  qualification_route: 'a_level',
  applicant_identity: {
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile: 'Scotland',
    contextual: false,
    contextual_status_confirmed: false,
    contextual_flags: {},
    graduate: false,
    resit: {
      has_resits: false
    }
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A' }
    ],
    sitting_status: 'first_sitting'
  },
  gcse_profile: {
    subjects: {
      english_language: '8',
      mathematics: '8',
      biology: '8',
      chemistry: '8',
      physics: '8'
    },
    additional_subjects: [
      { subject_id: 'history', grade: '8' },
      { subject_id: 'geography', grade: '8' },
      { subject_id: 'computer_science', grade: '8' },
      { subject_id: 'french', grade: '8' }
    ],
    total_gcse_count: 8
  },
  admissions_tests: {
    ucat: {
      taken: true,
      total_score: 2100,
      score_scale: 2700,
      test_year: 2026,
      sjt_band: 2,
      subtests: {
        verbal_reasoning: 700,
        decision_making: 700,
        quantitative_reasoning: 700
      }
    }
  }
};

const standardContextual = evaluateContextualEligibility(course, scottishRukApplicant);
assert.strictEqual(standardContextual.status, 'not_contextual');
assert.strictEqual(standardContextual.is_contextual, false);
const standardClassification = classifyInterviewBand(course, config, scottishRukApplicant);
assert.strictEqual(standardClassification.eligibility.status, 'eligible');
assert.strictEqual(standardClassification.guidance_pool_id, 'home_non_contextual');
assert.ok(!standardClassification.applicant_group_ids.includes('wales_domiciled'));

const confirmedCardiffContextual = merge(scottishRukApplicant, {
  contextual_profile: {
    personal_circumstances: {
      care_experienced: 'yes'
    }
  }
});
const contextual = evaluateContextualEligibility(course, confirmedCardiffContextual);
assert.strictEqual(contextual.status, 'contextual');
assert.strictEqual(contextual.matched_contextual_pathway, 'care_experienced');
const contextualClassification = classifyInterviewBand(course, config, confirmedCardiffContextual);
assert.strictEqual(contextualClassification.eligibility.status, 'eligible');
assert.strictEqual(contextualClassification.guidance_pool_id, 'home_contextual');
assert.ok(contextualClassification.applicant_group_ids.includes('contextual'));

console.log('Cardiff A100 Scottish production routing regression: PASS');
