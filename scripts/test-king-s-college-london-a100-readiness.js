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
assert.strictEqual(presented.primary_user_facing_recommendation, 'Strong interview outlook');
assert.strictEqual(presented.prediction.result_band, 'interview_likely');
assert.strictEqual(
  presented.primary_explanation,
  "Your academic profile meets King's College London's entry requirements, and your UCAT performance is above the range seen in applicants historically invited to interview. Based on King's published selection approach and available admissions evidence, your application is assessed as a Strong Choice for interview consideration."
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
assert.strictEqual(card.display.primary_user_facing_recommendation, 'Strong interview outlook');
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
