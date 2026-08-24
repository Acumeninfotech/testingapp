#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  presentResultCard,
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence
} = require('../assets/js/engine/result-card-presenter');

const rootDir = path.resolve(__dirname, '..');
const profileId = 'king-s-college-london-a100';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function interpolate(score, anchors) {
  const sorted = [...anchors].sort((a, b) => a.score - b.score);
  if (score <= sorted[0].score) {
    return sorted[0].percentile;
  }
  for (let index = 1; index < sorted.length; index += 1) {
    const lower = sorted[index - 1];
    const upper = sorted[index];
    if (score <= upper.score) {
      const position = (score - lower.score) / (upper.score - lower.score);
      return lower.percentile + position * (upper.percentile - lower.percentile);
    }
  }
  return sorted[sorted.length - 1].percentile;
}

const oldAnchors = [
  { score: 1200, percentile: 0 },
  { score: 2140, percentile: 10 },
  { score: 2260, percentile: 20 },
  { score: 2360, percentile: 30 },
  { score: 2440, percentile: 40 },
  { score: 2520, percentile: 50 },
  { score: 2590, percentile: 60 },
  { score: 2680, percentile: 70 },
  { score: 2780, percentile: 80 },
  { score: 2920, percentile: 90 },
  { score: 3600, percentile: 100 }
];

const newAnchors = [
  { score: 900, percentile: 0 },
  { score: 1580, percentile: 10 },
  { score: 1680, percentile: 20 },
  { score: 1760, percentile: 30 },
  { score: 1820, percentile: 40 },
  { score: 1880, percentile: 50 },
  { score: 1950, percentile: 60 },
  { score: 2010, percentile: 70 },
  { score: 2100, percentile: 80 },
  { score: 2220, percentile: 90 },
  { score: 2700, percentile: 100 }
];

function oldScoreToPercentile(score) {
  return round(interpolate(score, oldAnchors), 2);
}

function newScoreToPercentile(score) {
  return round(interpolate(score, newAnchors), 2);
}

function percentileToNewScore(percentile) {
  const anchors = newAnchors.map((anchor) => ({
    score: anchor.percentile,
    percentile: anchor.score
  }));
  return Math.round(interpolate(percentile, anchors));
}

function historicalScoreToDisplay2700(config, score) {
  const row = (config.score_model.kcl_runtime_policy.ucat_scale_conversion?.conversion_table || [])
    .find((entry) => entry.old_3600 === score);
  if (row) {
    return row.percentile_equivalent_2700;
  }
  return percentileToNewScore(oldScoreToPercentile(score));
}

function bandForOldScore(config, route, score) {
  const bands = config.score_model.kcl_runtime_policy.interview_bands.routes[route].bands;
  return bands.find((band) => {
    const min = Number.isFinite(band.old_min) ? band.old_min : -Infinity;
    const max = Number.isFinite(band.old_max) ? band.old_max : Infinity;
    return score >= min && score <= max;
  })?.band || null;
}

function bandForPercentile(config, route, percentile) {
  const bands = config.score_model.kcl_runtime_policy.interview_bands.routes[route].bands;
  const ordered = bands
    .filter((band) => Number.isFinite(band.nat_pct_min))
    .sort((a, b) => b.nat_pct_min - a.nat_pct_min);
  const matched = ordered.find((band) => percentile >= band.nat_pct_min);
  if (matched) {
    return matched.band;
  }
  return bands.find((band) => !Number.isFinite(band.nat_pct_min))?.band || null;
}

function topGradeCounts(gcse = {}) {
  const inclusive = Number(gcse['9'] || 0) +
    Number(gcse['8'] || 0) +
    Number(gcse.legacy_a_star || 0);
  const conservative = Number(gcse['9'] || 0) +
    Number(gcse.legacy_a_star || 0);
  const aAnalogues = Number(gcse['7'] || 0) + Number(gcse.legacy_a || 0);
  return { inclusive, conservative, aAnalogues };
}

function strengthFromTopCount(count) {
  if (!Number.isFinite(count)) {
    return 'not_computable';
  }
  if (count >= 8) {
    return 'very_strong';
  }
  if (count === 7) {
    return 'strong';
  }
  if (count === 6) {
    return 'moderate';
  }
  if (count === 5) {
    return 'limited';
  }
  return 'minimal';
}

function adjustedTopGrades(input) {
  if (!input.gcse) {
    return { top: null, strength: 'not_computable' };
  }
  const counts = topGradeCounts(input.gcse);
  const status = input.school_quintile_source_status || 'unverified';
  const quintile = status === 'verified' ? input.school_quintile : 'unknown';

  if (quintile === 'lowest' || quintile === 'lowest_two') {
    const top = counts.conservative + counts.aAnalogues;
    return {
      top,
      strength: strengthFromTopCount(top),
      effective_quintile: quintile,
      adjustment_applied: true
    };
  }
  if (quintile === 'third') {
    const top = counts.conservative + counts.aAnalogues * 0.5;
    return {
      top,
      strength: strengthFromTopCount(top),
      effective_quintile: quintile,
      adjustment_applied: true
    };
  }
  if (quintile === 'top_two') {
    return {
      top: counts.conservative,
      strength: strengthFromTopCount(counts.conservative),
      effective_quintile: quintile,
      adjustment_applied: false
    };
  }
  return {
    top: null,
    strength: 'not_computable',
    unadjusted_top_grades: counts.conservative,
    adjusted_top_grades: counts.conservative + counts.aAnalogues,
    result_range: [
      strengthFromTopCount(counts.conservative),
      strengthFromTopCount(counts.conservative + counts.aAnalogues)
    ],
    effective_quintile: 'unknown',
    adjustment_applied: false,
    result_class: 'Manual review required'
  };
}

const indexByMinimum = [
  { min: 6, class: 'Very competitive historical profile' },
  { min: 4, class: 'Competitive historical profile' },
  { min: 2.5, class: 'Uncertain / balanced profile' },
  { min: -Infinity, class: 'Higher-risk historical profile' }
];

const componentValues = {
  ucat_band: {
    very_strong: 5,
    strong: 4,
    competitive: 3,
    borderline: 2,
    high_risk: 1,
    very_high_risk: 0
  },
  gcse_strength: {
    very_strong: 2,
    strong: 1,
    moderate: 0,
    limited: -1,
    minimal: -2
  },
  sjt_band: {
    1: 0.5,
    2: 0,
    3: -0.5,
    4: -0.5
  },
  wp_category: {
    none_identified: [0, 0],
    possible: [0.5, 1.5],
    strong: [1, 2],
    unknown: [0, 2]
  }
};

function classForIndex(value) {
  return indexByMinimum.find((row) => value >= row.min).class;
}

function compensationResult(input) {
  if (
    input.gcse_strength === 'not_computable' ||
    input.sjt_band === 4
  ) {
    return { result_class: 'Manual review required' };
  }

  const base = componentValues.ucat_band[input.ucat_band] +
    componentValues.gcse_strength[input.gcse_strength] +
    componentValues.sjt_band[input.sjt_band];
  const wpRange = componentValues.wp_category[input.wp_category];
  const range = [round(base + wpRange[0], 2), round(base + wpRange[1], 2)];
  const classes = range.map(classForIndex);
  return {
    index: range[0] === range[1] ? range[0] : undefined,
    index_range: range[0] === range[1] ? undefined : range,
    class: classes[0] === classes[1] ? classes[0] : undefined,
    class_range: classes[0] === classes[1] ? undefined : classes,
    result_class: input.wp_category === 'unknown' ? 'Manual review required' : undefined,
    ambiguity_disclosed: classes[0] !== classes[1] || range[0] !== range[1]
  };
}

function baseApplicant(overrides = {}) {
  return {
    profile_id: 'kcl-readiness-applicant',
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true
    },
    application_year: 2027,
    gcse_profile: {
      subjects: {
        english_language: '6',
        mathematics: '6'
      },
      additional_subjects: [
        { subject_id: 'biology', grade: '9' },
        { subject_id: 'chemistry', grade: '9' },
        { subject_id: 'physics', grade: '9' },
        { subject_id: 'history', grade: '9' },
        { subject_id: 'geography', grade: '9' },
        { subject_id: 'french', grade: '9' }
      ],
      total_gcse_count: 8
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'biology', predicted_grade: 'A*', practical_endorsement: 'pass' },
        { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A' }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2281,
        score_scale: 2700,
        national_percentile: 91.28,
        sjt_band: 2,
        test_year: 2026
      }
    },
    ...overrides
  };
}

function classifyApplicant(overrides = {}) {
  return classifyInterviewBand(course, config, baseApplicant(overrides));
}

function scottishProfile({
  higherGrades = ['A', 'A', 'B'],
  higherSubjects = ['english', 'history', 'mathematics'],
  higherSittingIds = ['s5', 's5', 's5'],
  completedInOneSitting = true,
  ahBiology = 'A',
  ahChemistry = 'A',
  advancedHigherSubjects = null,
  national5Subjects = []
} = {}) {
  return {
    completed_in_one_sitting: completedInOneSitting,
    higher_subjects: higherSubjects.map((subjectId, index) => ({
      subject_id: subjectId,
      achieved_grade: higherGrades[index],
      sitting_id: higherSittingIds[index]
    })),
    advanced_higher_subjects: advancedHigherSubjects || [
      { subject_id: 'biology', achieved_grade: ahBiology },
      { subject_id: 'chemistry', achieved_grade: ahChemistry }
    ],
    national_5_subjects: national5Subjects
  };
}

function scottishApplicant(overrides = {}) {
  return {
    qualification_route: 'scottish',
    a_level_profile: undefined,
    scottish_profile: scottishProfile(),
    ...overrides
  };
}

function ibApplicant(overrides = {}) {
  return {
    qualification_route: 'international_baccalaureate',
    a_level_profile: undefined,
    ib_profile: {
      total_points: 38,
      higher_level_total_points: 19,
      higher_level_subjects: [
        { subject_id: 'biology', achieved_grade: '6' },
        { subject_id: 'chemistry', achieved_grade: '6' },
        { subject_id: 'mathematics', achieved_grade: '7' }
      ]
    },
    ...overrides
  };
}

function assertEligibilityCheck(classification, checkId, expectedStatus, message) {
  const check = (classification.eligibility.checks || [])
    .find((entry) => entry.check_id === checkId || entry.check === checkId);
  assert.ok(check, `${message}: expected ${checkId} check`);
  assert.strictEqual(check.status || (check.passed ? 'pass' : 'fail'), expectedStatus, message);
}

function assertNoCurrentContextualTreatment(classification, message) {
  const contextual = classification.eligibility.contextual_eligibility;
  if (contextual) {
    assert.notStrictEqual(contextual.status, 'contextual', `${message}: must not be current contextual`);
    assert.strictEqual(contextual.is_contextual, false, `${message}: must not activate contextual treatment`);
  }
  assert.ok(!classification.applicant_group_ids.includes('contextual'), `${message}: generic contextual group must be absent`);
  assert.ok(
    !classification.applicant_group_ids.includes('widening_participation'),
    `${message}: generic WP group must be absent`
  );
}

function assertRecognisedContextual(classification, expectedCriterion, message) {
  const contextual = classification.eligibility.contextual_eligibility;
  assert.strictEqual(contextual.status, 'contextual', `${message}: contextual status`);
  assert.strictEqual(contextual.is_contextual, true, `${message}: is_contextual`);
  assert.ok(
    contextual.qualifying_criteria.some((entry) => entry.criterion_id === expectedCriterion),
    `${message}: expected criterion ${expectedCriterion}`
  );
  assert.ok(
    classification.applicant_group_ids.includes('kcl_contextual_additional_consideration'),
    `${message}: KCL-specific contextual group`
  );
  assert.ok(!classification.applicant_group_ids.includes('contextual'), `${message}: no generic contextual group`);
  assert.ok(!classification.applicant_group_ids.includes('widening_participation'), `${message}: no generic WP group`);
  assert.strictEqual(classification.eligibility.academic_pathway, 'standard', `${message}: academic offer remains standard`);
  assert.ok(!JSON.stringify(classification).includes('contextual_adjusted_selection_ucat_total'));
  assert.ok(!JSON.stringify(classification).includes('guaranteed_interview'));
}

function assertProgrammeEvidenceNeedsReview(classification, expectedCriterion, message) {
  const contextual = classification.eligibility.contextual_eligibility;
  assert.strictEqual(classification.eligibility.status, 'manual_review', `${message}: eligibility status`);
  assert.strictEqual(contextual.status, 'information_needed', `${message}: contextual status`);
  assert.strictEqual(contextual.is_contextual, false, `${message}: is_contextual`);
  assert.ok(
    contextual.missing_information.some((entry) => entry.criterion_id === expectedCriterion),
    `${message}: expected unresolved criterion ${expectedCriterion}`
  );
  assert.ok(
    classification.eligibility.manual_review_reasons.includes('kcl_contextual_evidence_requires_review'),
    `${message}: manual review reason`
  );
  assert.ok(
    !classification.applicant_group_ids.includes('kcl_contextual_additional_consideration'),
    `${message}: no KCL-specific contextual group`
  );
  assert.ok(!classification.applicant_group_ids.includes('contextual'), `${message}: no generic contextual group`);
  assert.ok(!classification.applicant_group_ids.includes('widening_participation'), `${message}: no generic WP group`);
}

const course = readJson(`data/universities/${profileId}.json`);
const research = readJson(`data/research/${profileId}-research.json`);
const config = readJson(`data/interview-band-configs/${profileId}.json`);
const card = readJson(`data/examples/${profileId}-result-card.example.json`);
const fixtureSuite = readJson(`data/fixtures/interview-band-classification/${profileId}.json`);
const index = readJson('data/index.json');

assert.strictEqual(course.profile_id, profileId);
assert.strictEqual(research.course_profile_id, profileId);
assert.strictEqual(config.course_profile_id, profileId);
assert.strictEqual(card.course_identity.profile_id, profileId);
assert.strictEqual(fixtureSuite.fixture_count, 55);
assert.strictEqual(fixtureSuite.fixtures.length, 55);
assert.strictEqual(research.approved_applysmart_json.schema_version, 'applysmart.university_course.v2.4');
assert.strictEqual(config.score_model.metric, 'ucat_national_percentile');
assert.strictEqual(config.score_model.percentile_estimator.official_conversion_formula_exists, false);
assert.strictEqual(config.score_model.percentile_estimator.conversion_role, 'historical_display_only');
assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
assert.strictEqual(card.prediction.output_type, 'ordinal_class');
assert.ok(!JSON.stringify({ course, research, config, card }).includes('offer_probability'));

const byId = new Map(fixtureSuite.fixtures.map((fixture) => [fixture.id, fixture]));
for (const fixture of fixtureSuite.fixtures) {
  assert.ok(fixture.id, 'fixture id required');
  assert.ok(fixture.description, `${fixture.id}: description required`);
  assert.ok(fixture.input, `${fixture.id}: input required`);
  assert.ok(fixture.expected, `${fixture.id}: expected required`);
}

for (const id of ['BND-H-01', 'BND-H-02', 'BND-H-03', 'BND-H-04']) {
  const fixture = byId.get(id);
  const route = 'home';
  const score = fixture.input.ucat_old_3600;
  assert.strictEqual(bandForOldScore(config, route, score), fixture.expected.ucat_band, `${id}: old-score band`);
  if (fixture.expected.new_2700 !== undefined) {
    assert.strictEqual(historicalScoreToDisplay2700(config, score), fixture.expected.new_2700, `${id}: conversion`);
  }
  if (fixture.expected.national_percentile !== undefined) {
    assert.strictEqual(round(oldScoreToPercentile(score), 1), fixture.expected.national_percentile, `${id}: percentile`);
  }
}

for (const id of ['BND-I-01', 'BND-I-02']) {
  const fixture = byId.get(id);
  const route = 'international';
  const score = fixture.input.ucat_old_3600;
  assert.strictEqual(bandForOldScore(config, route, score), fixture.expected.ucat_band, `${id}: old-score band`);
  assert.strictEqual(historicalScoreToDisplay2700(config, score), fixture.expected.new_2700, `${id}: conversion`);
}

const currentScore = byId.get('BND-H-05');
assert.strictEqual(bandForPercentile(config, 'home', newScoreToPercentile(currentScore.input.ucat_new_2700)), 'competitive');
assert.strictEqual(currentScore.expected.converted_score_used, false);
assert.strictEqual(bandForPercentile(config, 'home', byId.get('BND-H-06').input.national_percentile), 'strong');
assert.strictEqual(bandForPercentile(config, 'home', byId.get('BND-H-07').input.national_percentile), 'competitive');

const gcs01Counts = topGradeCounts(byId.get('GCS-01').input.gcse);
assert.strictEqual(gcs01Counts.inclusive, byId.get('GCS-01').expected.inclusive_top_grades);
assert.strictEqual(gcs01Counts.conservative, byId.get('GCS-01').expected.conservative_top_grades);
assert.strictEqual(strengthFromTopCount(gcs01Counts.inclusive), byId.get('GCS-01').expected.gcse_strength);
const gcs02Counts = topGradeCounts(byId.get('GCS-02').input.gcse);
assert.strictEqual(gcs02Counts.inclusive, 8);
assert.strictEqual(gcs02Counts.conservative, 5);
assert.deepStrictEqual(
  [strengthFromTopCount(gcs02Counts.conservative), strengthFromTopCount(gcs02Counts.inclusive)],
  byId.get('GCS-02').expected.gcse_strength_range
);
assert.strictEqual(adjustedTopGrades(byId.get('GCS-03').input).strength, 'strong');
assert.strictEqual(adjustedTopGrades(byId.get('GCS-04').input).strength, 'not_computable');

const sch01 = adjustedTopGrades(byId.get('SCH-01').input);
assert.strictEqual(sch01.top, 8);
assert.strictEqual(sch01.adjustment_applied, true);
const sch02 = adjustedTopGrades(byId.get('SCH-02').input);
assert.strictEqual(sch02.top, 7);
assert.strictEqual(sch02.adjustment_applied, true);
assert.deepStrictEqual(adjustedTopGrades(byId.get('SCH-03').input).result_range, ['limited', 'very_strong']);
assert.strictEqual(byId.get('SCH-04').expected.adjustment_applied, false);

assert.strictEqual(byId.get('SJT-01').expected.eligibility_rejection, false);
assert.strictEqual(byId.get('SJT-01').expected.result_class, 'Manual review required');
assert.strictEqual(byId.get('SJT-02').expected.manual_review, false);
assert.strictEqual(byId.get('WP-01').expected.wp_points, null);
assert.strictEqual(byId.get('INT-01').expected.gcse_ranking_points, 'not_computable');
assert.strictEqual(byId.get('SCR-01').expected.exact_score_returned, false);
assert.strictEqual(historicalScoreToDisplay2700(config, byId.get('CNV-02').input.ucat_old_3600), byId.get('CNV-02').expected.new_2700);
assert.notStrictEqual(byId.get('CNV-02').expected.new_2700, byId.get('CNV-02').expected.must_not_equal);
assert.strictEqual(historicalScoreToDisplay2700(config, byId.get('CNV-03').input.ucat_old_3600), byId.get('CNV-03').expected.new_2700);
assert.strictEqual(byId.get('OFR-01').expected.error, 'offer_prediction_out_of_scope');

for (const id of ['CMP-01', 'CMP-02', 'CMP-03', 'CMP-05', 'CMP-06', 'CMP-07', 'CMP-08', 'CMP-09', 'CMP-10', 'CMP-12']) {
  const fixture = byId.get(id);
  const result = compensationResult(fixture.input);
  for (const [key, expectedValue] of Object.entries(fixture.expected)) {
    if (key === 'assert' || key === 'contains_numeric_probability' || key === 'output_type' || key === 'clamped') {
      continue;
    }
    assert.deepStrictEqual(result[key], expectedValue, `${id}: ${key}`);
  }
}

assert.strictEqual(byId.get('CRD-01').expected.contains_numeric_probability, false);
assert.strictEqual(byId.get('CRD-02').expected.must_not_contain.some((phrase) => {
  return JSON.stringify(card).includes(phrase);
}), false);
assert.ok(byId.get('CRD-03').expected.must_contain.every((phrase) => JSON.stringify(card).includes(phrase)));
assert.strictEqual(byId.get('MOD-01').expected.value, config.score_model.prediction_mode.mode);
assert.strictEqual(config.score_model.readiness.prediction_mode, config.score_model.prediction_mode.mode);

const meta01 = byId.get('META-01');
const knownQuintiles = new Set(meta01.input.known_values);
let sourceStatusViolations = 0;
for (const fixture of fixtureSuite.fixtures) {
  const input = fixture.input || {};
  if (!knownQuintiles.has(input.school_quintile)) {
    continue;
  }
  const result = adjustedTopGrades(input);
  const sourceStatus = input.school_quintile_source_status || 'absent';
  if (sourceStatus === 'verified') {
    if (result.effective_quintile === 'unknown') {
      sourceStatusViolations += 1;
    }
    continue;
  }
  if (
    result.effective_quintile !== 'unknown' ||
    result.adjustment_applied !== false ||
    result.result_class !== 'Manual review required'
  ) {
    sourceStatusViolations += 1;
  }
}
assert.strictEqual(meta01.expected.policy, 'known_quintile_executes_only_with_verified_source_status');
assert.deepStrictEqual(meta01.expected.negative_fixtures_allowed, ['SCH-05']);
assert.strictEqual(sourceStatusViolations, meta01.expected.violations);

for (const route of ['home', 'international']) {
  const bands = config.score_model.kcl_runtime_policy.interview_bands.routes[route].bands;
  for (const band of bands) {
    if (!Number.isFinite(band.nat_pct_min)) {
      continue;
    }
    assert.strictEqual(bandForPercentile(config, route, band.nat_pct_min), band.band, `${route}:${band.band}: lower bound`);
    if (band.nat_pct_min > 0) {
      assert.notStrictEqual(bandForPercentile(config, route, round(band.nat_pct_min - 0.01, 2)), band.band, `${route}:${band.band}: below bound`);
    }
  }
}

const cleanClassification = classifyInterviewBand(course, config, baseApplicant());
assert.strictEqual(cleanClassification.eligibility.status, 'eligible');
assert.strictEqual(cleanClassification.guidance_pool_id, 'kcl_home_historical_percentile_guidance');
assert.strictEqual(cleanClassification.canonical_interview_band, 'interview_likely');

const internationalClassification = classifyInterviewBand(
  course,
  config,
  baseApplicant({
    applicant_identity: {
      applicant_type: 'international_standard_school_leaver',
      fee_status: 'International',
      domicile: 'International',
      english_language_exempt: true
    },
    qualification_route: 'international_qualification',
    international_qualification: {
      equivalence_status: 'verified',
      verified_by_institution: true,
      requirements_met: true
    },
    admissions_tests: {
      ucat: {
        total_score: 2332,
        score_scale: 2700,
        national_percentile: 92.32,
        sjt_band: 2,
        test_year: 2026
      }
    }
  })
);
assert.strictEqual(internationalClassification.eligibility.status, 'eligible');
assert.strictEqual(internationalClassification.guidance_pool_id, 'kcl_international_historical_percentile_guidance');

const graduateClassification = classifyInterviewBand(
  course,
  config,
  baseApplicant({
    applicant_identity: {
      applicant_type: 'graduate_applicant',
      fee_status: 'Home',
      domicile: 'England',
      graduate: true,
      english_language_exempt: true
    },
    graduate_profile: {
      is_graduate: true,
      degree_classification: '2_1'
    }
  })
);
assert.strictEqual(graduateClassification.canonical_interview_band, 'insufficient_evidence');
assert.strictEqual(graduateClassification.manual_review_required, true);

const englandALevel = classifyApplicant();
assert.strictEqual(englandALevel.eligibility.qualification_route, 'a_level');
assert.strictEqual(englandALevel.eligibility.status, 'eligible');
assert.strictEqual(englandALevel.guidance_pool_id, 'kcl_home_historical_percentile_guidance');
assert.ok(englandALevel.applicant_group_ids.includes('home_fee'));
assert.ok(englandALevel.applicant_group_ids.includes('england_domiciled'));
assertEligibilityCheck(englandALevel, 'a_level_route', 'pass', 'England + A levels uses A-level route');

const englandScottish = classifyApplicant(scottishApplicant());
assert.strictEqual(englandScottish.eligibility.qualification_route, 'scottish');
assert.strictEqual(englandScottish.eligibility.status, 'eligible');
assert.strictEqual(englandScottish.guidance_pool_id, 'kcl_home_historical_percentile_guidance');
assert.ok(englandScottish.applicant_group_ids.includes('home_fee'));
assert.ok(englandScottish.applicant_group_ids.includes('england_domiciled'));
assertEligibilityCheck(englandScottish, 'scottish_post_16_requirements', 'pass', 'England + Scottish uses Scottish route');

const scotlandScottish = classifyApplicant(scottishApplicant({
  applicant_identity: {
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile: 'Scotland',
    english_language_exempt: true
  }
}));
assert.strictEqual(scotlandScottish.eligibility.qualification_route, 'scottish');
assert.strictEqual(scotlandScottish.eligibility.status, 'eligible');
assert.strictEqual(scotlandScottish.guidance_pool_id, 'kcl_home_historical_percentile_guidance');
assert.ok(scotlandScottish.applicant_group_ids.includes('home_fee'));
assert.ok(scotlandScottish.applicant_group_ids.includes('scotland_domiciled'));
assertEligibilityCheck(scotlandScottish, 'scottish_post_16_requirements', 'pass', 'Scotland + Scottish uses Scottish route');

const scotlandALevel = classifyApplicant({
  applicant_identity: {
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile: 'Scotland',
    english_language_exempt: true
  }
});
assert.strictEqual(scotlandALevel.eligibility.qualification_route, 'a_level');
assert.strictEqual(scotlandALevel.eligibility.status, 'eligible');
assert.strictEqual(scotlandALevel.guidance_pool_id, 'kcl_home_historical_percentile_guidance');
assert.ok(scotlandALevel.applicant_group_ids.includes('home_fee'));
assert.ok(scotlandALevel.applicant_group_ids.includes('scotland_domiciled'));
assertEligibilityCheck(scotlandALevel, 'a_level_route', 'pass', 'Scotland + A levels uses A-level route');

const scottishBelowAab = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({ higherGrades: ['A', 'B', 'B'] })
}));
assert.strictEqual(scottishBelowAab.eligibility.status, 'not_eligible');
assert.ok(scottishBelowAab.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishSplitSitting = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({
    completedInOneSitting: null,
    higherSittingIds: ['s5_june', 's5_june', 's6_june']
  })
}));
assert.strictEqual(scottishSplitSitting.eligibility.status, 'not_eligible');
assert.ok(scottishSplitSitting.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishAhBiologyBelowA = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({ ahBiology: 'B' })
}));
assert.strictEqual(scottishAhBiologyBelowA.eligibility.status, 'not_eligible');
assert.ok(scottishAhBiologyBelowA.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishAhChemistryBelowA = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({ ahChemistry: 'B' })
}));
assert.strictEqual(scottishAhChemistryBelowA.eligibility.status, 'not_eligible');
assert.ok(scottishAhChemistryBelowA.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishBioChemOnlyAtHigher = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({
    higherSubjects: ['biology', 'chemistry', 'mathematics'],
    advancedHigherSubjects: [
      { subject_id: 'physics', achieved_grade: 'A' },
      { subject_id: 'history', achieved_grade: 'A' }
    ]
  })
}));
assert.strictEqual(scottishBioChemOnlyAtHigher.eligibility.status, 'not_eligible');
assert.ok(scottishBioChemOnlyAtHigher.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishCannotDoubleCountHigherAhSubjects = classifyApplicant(scottishApplicant({
  scottish_profile: scottishProfile({
    higherSubjects: ['biology', 'chemistry'],
    higherGrades: ['A', 'A'],
    higherSittingIds: ['s5', 's5'],
    advancedHigherSubjects: [
      { subject_id: 'biology', achieved_grade: 'A' },
      { subject_id: 'chemistry', achieved_grade: 'A' }
    ]
  })
}));
assert.strictEqual(scottishCannotDoubleCountHigherAhSubjects.eligibility.status, 'not_eligible');
assert.ok(scottishCannotDoubleCountHigherAhSubjects.eligibility.failures.includes('scottish_post_16_requirements_not_met'));

const scottishNational5ManualReview = classifyApplicant(scottishApplicant({
  gcse_profile: undefined,
  scottish_profile: scottishProfile({
    national5Subjects: [
      { subject_id: 'english_language', achieved_grade: 'A' },
      { subject_id: 'mathematics', achieved_grade: 'A' }
    ]
  })
}));
assert.strictEqual(scottishNational5ManualReview.eligibility.qualification_route, 'scottish');
assert.strictEqual(scottishNational5ManualReview.eligibility.status, 'manual_review');
assert.ok(
  scottishNational5ManualReview.eligibility.manual_review_reasons.includes('national_5_equivalence_requires_manual_review')
);
assertEligibilityCheck(
  scottishNational5ManualReview,
  'scottish_post_16_requirements',
  'pass',
  'Scottish post-16 can pass while National 5 equivalence needs review'
);

const belowOfferWithKplus = classifyApplicant({
  a_level_profile: {
    subjects: [
      { subject_id: 'biology', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'chemistry', predicted_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'B' }
    ]
  },
  contextual_profile: {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        { programme_id: 'kcl_k_plus', status: 'completed' }
      ]
    }
  }
});
assert.strictEqual(belowOfferWithKplus.eligibility.status, 'not_eligible');
assert.ok(belowOfferWithKplus.eligibility.failures.includes('a_level_requirements_not_met'));
assert.strictEqual(belowOfferWithKplus.eligibility.contextual_eligibility.status, 'contextual');

const validIb = classifyApplicant(ibApplicant());
assert.strictEqual(validIb.eligibility.qualification_route, 'international_baccalaureate');
assert.strictEqual(validIb.eligibility.status, 'eligible');
assertEligibilityCheck(validIb, 'ib_route', 'pass', 'Existing valid IB scenario');

assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'kcl_k_plus', status: 'completed' }
        ]
      }
    }
  }),
  'kcl_wp_programme',
  'Valid K+ evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'kcl_wp_programme', status: 'participating', programme_specific_conditions_met: true }
        ]
      }
    }
  }),
  'kcl_wp_programme',
  'Validated current KCL WP programme evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      financial_support: {
        free_school_meals: 'yes'
      }
    }
  }),
  'free_school_meals',
  'Valid FSM evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      personal_circumstances: {
        care_experienced: 'yes'
      }
    }
  }),
  'care_experienced',
  'Valid care-experience evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      personal_circumstances: {
        estranged_from_family: 'yes'
      }
    }
  }),
  'estranged',
  'Valid estrangement evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'intouniversity', status: 'completed' }
        ]
      }
    }
  }),
  'intouniversity',
  'Valid IntoUniversity evidence'
);
assertProgrammeEvidenceNeedsReview(
  classifyApplicant({
    contextual_profile: {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          { programme_id: 'intouniversity', status: 'participating' }
        ]
      }
    }
  }),
  'intouniversity',
  'IntoUniversity participation without qualifying-course evidence'
);
for (const bareProgrammeStatus of ['participating', 'current', 'enrolled', 'accepted', 'offered']) {
  assertProgrammeEvidenceNeedsReview(
    classifyApplicant({
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'kcl_k_plus', status: bareProgrammeStatus }
          ]
        }
      }
    }),
    'kcl_wp_programme',
    `Bare KCL programme status ${bareProgrammeStatus}`
  );
  assertProgrammeEvidenceNeedsReview(
    classifyApplicant({
      contextual_profile: {
        access_programmes: {
          participation_status: 'yes',
          other_programmes: [
            { programme_id: 'intouniversity', status: bareProgrammeStatus }
          ]
        }
      }
    }),
    'intouniversity',
    `Bare IntoUniversity programme status ${bareProgrammeStatus}`
  );
}
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      personal_circumstances: {
        refugee: 'yes'
      }
    }
  }),
  'forced_displacement',
  'Valid forced-displacement evidence'
);
assertRecognisedContextual(
  classifyApplicant({
    contextual_profile: {
      personal_circumstances: {
        young_or_adult_carer: 'yes'
      }
    }
  }),
  'young_adult_carer',
  'Valid Young Adult Carer evidence'
);

assertNoCurrentContextualTreatment(
  classifyApplicant({
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true,
      contextual: true
    }
  }),
  'legacy contextual=true only'
);
assertNoCurrentContextualTreatment(
  classifyApplicant({
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true,
      widening_participation: true
    }
  }),
  'legacy widening_participation=true only'
);
assertNoCurrentContextualTreatment(
  classifyApplicant({
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true,
      contextual_flags: { contextual: true }
    }
  }),
  'legacy contextual_flags.contextual=true only'
);
assertNoCurrentContextualTreatment(
  classifyApplicant({
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      english_language_exempt: true,
      contextual_flags: { polar4_quintile_1: true }
    }
  }),
  'POLAR only'
);
assertNoCurrentContextualTreatment(
  classifyApplicant({
    contextual_profile: {
      home_area_region: {
        acorn_quintile: 'q1'
      }
    }
  }),
  'ACORN only'
);
assertNoCurrentContextualTreatment(
  classifyApplicant({
    school_quintile: 'lowest',
    school_quintile_source_status: 'verified'
  }),
  'school-quintile only'
);

const unresolvedContextual = classifyApplicant({
  contextual_profile: {
    personal_circumstances: {
      estranged_from_family: 'prefer_not_to_say'
    }
  }
});
assert.strictEqual(unresolvedContextual.eligibility.status, 'manual_review');
assert.strictEqual(unresolvedContextual.eligibility.contextual_eligibility.status, 'information_needed');
assert.ok(unresolvedContextual.eligibility.manual_review_reasons.includes('kcl_contextual_evidence_requires_review'));

const completedBioscienceGraduate = classifyApplicant({
  applicant_identity: {
    applicant_type: 'graduate_applicant',
    fee_status: 'Home',
    domicile: 'England',
    graduate: true,
    english_language_exempt: true
  },
  qualification_route: 'graduate',
  graduate_profile: {
    is_graduate: true,
    degree_status: 'completed',
    degree_classification: '2_1',
    degree_subject_area: 'bioscience',
    biology_content_confirmed: true,
    chemistry_content_confirmed: true
  }
});
assert.strictEqual(completedBioscienceGraduate.eligibility.qualification_route, 'graduate');
assert.strictEqual(completedBioscienceGraduate.eligibility.status, 'manual_review');
assert.ok(completedBioscienceGraduate.eligibility.manual_review_reasons.includes('qualification_route_requires_manual_review:graduate'));

const unclearBioscienceGraduate = classifyApplicant({
  applicant_identity: {
    applicant_type: 'graduate_applicant',
    fee_status: 'Home',
    domicile: 'England',
    graduate: true,
    english_language_exempt: true
  },
  qualification_route: 'graduate',
  graduate_profile: {
    is_graduate: true,
    degree_status: 'completed',
    degree_classification: '2_1',
    degree_subject_area: 'life_sciences'
  }
});
assert.strictEqual(unclearBioscienceGraduate.eligibility.status, 'manual_review');
assert.strictEqual(unclearBioscienceGraduate.canonical_interview_band, 'insufficient_evidence');

const completedNonBioscienceGraduate = classifyApplicant({
  applicant_identity: {
    applicant_type: 'graduate_applicant',
    fee_status: 'Home',
    domicile: 'England',
    graduate: true,
    english_language_exempt: true
  },
  qualification_route: 'graduate',
  graduate_profile: {
    is_graduate: true,
    degree_status: 'completed',
    degree_classification: '2_1',
    degree_subject_area: 'non_bioscience'
  },
  a_level_profile: {
    subjects: [
      { subject_id: 'biology', achieved_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'chemistry', achieved_grade: 'A', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', achieved_grade: 'A' }
    ]
  }
});
assert.strictEqual(completedNonBioscienceGraduate.eligibility.status, 'manual_review');
assert.ok(completedNonBioscienceGraduate.eligibility.manual_review_reasons.includes('qualification_route_requires_manual_review:graduate'));

for (const [label, graduateProfile] of [
  ['currently studying another degree', { is_graduate: true, degree_status: 'current', degree_classification: '2_1' }],
  ['withdrawn degree', { is_graduate: true, degree_status: 'withdrawn', degree_classification: '2_1' }],
  ['prior HE without award', { is_graduate: true, degree_status: 'prior_he_no_award', degree_classification: null }]
]) {
  const result = classifyApplicant({
    applicant_identity: {
      applicant_type: 'graduate_applicant',
      fee_status: 'Home',
      domicile: 'England',
      graduate: true,
      english_language_exempt: true
    },
    qualification_route: 'graduate',
    graduate_profile: graduateProfile
  });
  assert.strictEqual(result.eligibility.status, 'manual_review', label);
  assert.strictEqual(result.canonical_interview_band, 'insufficient_evidence', label);
}

const mappedInternationalEquivalent = classifyApplicant({
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  qualification_route: 'international_qualification',
  a_level_profile: undefined,
  international_qualification: {
    equivalence_status: 'verified',
    verified_by_institution: true,
    requirements_met: true
  }
});
assert.strictEqual(mappedInternationalEquivalent.eligibility.status, 'eligible');
assert.strictEqual(mappedInternationalEquivalent.guidance_pool_id, 'kcl_international_historical_percentile_guidance');

const unmappedInternationalEquivalent = classifyApplicant({
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  },
  qualification_route: 'international_qualification',
  a_level_profile: undefined,
  international_qualification: {
    equivalence_status: 'unlisted',
    verified_by_institution: false,
    requirements_met: null
  }
});
assert.strictEqual(unmappedInternationalEquivalent.eligibility.status, 'manual_review');
assert.ok(unmappedInternationalEquivalent.eligibility.manual_review_reasons.includes('international_qualification_requires_manual_review'));

const internationalScottish = classifyApplicant(scottishApplicant({
  applicant_identity: {
    applicant_type: 'international_standard_school_leaver',
    fee_status: 'International',
    domicile: 'International',
    english_language_exempt: true
  }
}));
assert.strictEqual(internationalScottish.eligibility.qualification_route, 'scottish');
assert.strictEqual(internationalScottish.eligibility.status, 'eligible');
assert.strictEqual(internationalScottish.guidance_pool_id, 'kcl_international_historical_percentile_guidance');
assert.ok(internationalScottish.applicant_group_ids.includes('international_fee'));
assert.ok(!internationalScottish.applicant_group_ids.includes('home_fee'));

const sjtBand4 = classifyApplicant({
  admissions_tests: {
    ucat: {
      total_score: 2281,
      score_scale: 2700,
      national_percentile: 91.28,
      sjt_band: 4,
      test_year: 2026,
      subtests: {
        verbal_reasoning: 760,
        decision_making: 760,
        quantitative_reasoning: 761
      }
    }
  }
});
assert.notStrictEqual(sjtBand4.eligibility.status, 'not_eligible');
assert.ok(!sjtBand4.eligibility.failures.includes('sjt_band_excluded'));
assert.notStrictEqual(sjtBand4.canonical_interview_band, 'not_eligible');

const presented = presentResultCard({
  eligibilityStatus: cleanClassification.eligibility.status,
  interviewBand: cleanClassification.canonical_interview_band,
  manualReviewRequired: cleanClassification.manual_review_required === true,
  transparencyContext: {
    course_identity: {
      profile_id: course.profile_id,
      university_name: course.university.name,
      course_name: course.course.name,
      ucas_code: course.course.ucas_code
    },
    applicant_context: baseApplicant(),
    applicant_group_ids: cleanClassification.applicant_group_ids,
    readiness: course.engine_notes,
    eligibility_checks: cleanClassification.eligibility.checks,
    eligibility_failures: cleanClassification.eligibility.failures,
    stage_1_eligibility: course.stage_1_eligibility,
    historical_admissions: course.historical_admissions,
    ranking: cleanClassification.ranking,
    band_metric: cleanClassification.band_metric,
    guidance_pool: cleanClassification.guidance_pool,
    score_model: config.score_model,
    guidance_pool_id: cleanClassification.guidance_pool_id,
    warnings: cleanClassification.warnings || []
  }
});
assert.ok(presented.primary_user_facing_recommendation);
assert.strictEqual(presented.primary_user_facing_recommendation, 'Strong choice for your application');
assert.strictEqual(presented.prediction.result_band, 'interview_likely');
assert.strictEqual(
  presented.primary_explanation,
  "Based on ApplySmart's assessment, your selection score appears competitive for this applicant group."
);
assert.strictEqual(
  presented.trust_statement,
  'Interview decisions vary each year depending on the applicant pool, available interview capacity and university selection decisions. ApplySmart provides an evidence-based interview prediction, not a guarantee of interview.'
);
assert.strictEqual(buildDecisionTimeline(presented).length, 5);
assert.strictEqual(buildDecisionTransparency(presented).decision_path.length, 4);
assert.ok(buildEvidenceConfidence(presented).summary);
const presentedTransparency = buildDecisionTransparency(presented);
const generatedSelectionStage = presentedTransparency.decision_path.find((stage) => stage.stage === 'Selection model');
const generatedHistoricalStage = presentedTransparency.decision_path.find((stage) => stage.stage === 'Historical guidance');
assert.match(generatedSelectionStage.summary, /published selection approach and available historical admissions evidence/);
assert.strictEqual(
  generatedHistoricalStage.summary,
  "Your UCAT performance compares favourably with applicants who have historically been invited to interview at King's College London. Interview thresholds can vary between admissions cycles depending on applicant competition and interview capacity, but your profile falls within a historically competitive range for interview consideration."
);
assert.ok(
  generatedHistoricalStage.checks.some((entry) =>
    entry.label === 'Recent admissions data' &&
    /approximately 2,810 applicants, 982 interviewed and 762 offers\./.test(entry.summary)
  ),
  'Generated KCL public card must show recent admissions data without making the prediction look dependent on one old cycle.'
);
assert.strictEqual(
  presentedTransparency.decision_path.find((stage) => stage.stage === 'Eligibility').status,
  'Met'
);

const forbiddenPublicPhrases = [
  '2022 formula',
  '2022 entry',
  'the formula remains in use',
  'not confirmed for current cycles'
];
for (const [label, publicCard] of [
  ['generated KCL card', presented],
  ['example KCL card', card]
]) {
  const publicText = JSON.stringify(publicCard);
  for (const phrase of forbiddenPublicPhrases) {
    assert.ok(
      !publicText.includes(phrase),
      `${label} must not contain public-facing stale phrase: ${phrase}`
    );
  }
}
assert.strictEqual(card.prediction.result_band, 'interview_likely');
assert.strictEqual(card.display.primary_user_facing_recommendation, 'Strong choice for your application');
assert.match(card.display.trust_statement, /not a guarantee of interview/);

const indexEntry = index.universities.find((entry) => entry.id === profileId);
assert.strictEqual(indexEntry.activation_ready, true);
assert.strictEqual(indexEntry.metadata_activation_ready, true);
assert.strictEqual(indexEntry.production_ready, true);
assert.strictEqual(indexEntry.regression, true);
assert.strictEqual(indexEntry.production_activation_blocked, undefined);
assert.strictEqual(indexEntry.activation_block_reason, undefined);

const sch05 = byId.get('SCH-05');
const sch05PolicyResult = adjustedTopGrades(sch05.input);
assert.strictEqual(sch05.input.school_quintile_source_status, 'unverified');
assert.strictEqual(sch05PolicyResult.effective_quintile, sch05.expected.effective_school_quintile);
assert.strictEqual(sch05PolicyResult.adjustment_applied, sch05.expected.adjustment_applied);
assert.strictEqual(sch05PolicyResult.result_class, sch05.expected.result_class);

console.log('KCL A100 readiness validation passed.');
