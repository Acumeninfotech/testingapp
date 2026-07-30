#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  deriveUniversityHistoricalDecile,
  loadUcatDecileData
} = require('../assets/js/engine/ucat-decile-service');
const {
  clampAcademicScore
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');
const profile = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'universities', 'edinburgh-a100.json'), 'utf8')
);
const card = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'examples', 'edinburgh-a100-result-card.example.json'), 'utf8')
);
const correctionFixture = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'data', 'fixtures', 'edinburgh-a100-academic-sjt.json'),
    'utf8'
  )
);
const ucatData = loadUcatDecileData(path.join(rootDir, 'data', 'ucat-deciles.json'));

const calculation = profile.stage_2_interview_selection.calculation;
const ucatRows = calculation.ucat_decile_points.points;
const sjtPoints = calculation.sjt_points.points_by_band;
const ucatCutoff = profile.stage_1_eligibility.admissions_tests.ucat.minimum_total_score;
const excludedSjtBands = profile.stage_1_eligibility.admissions_tests.sjt.excluded_bands;

function ucatDecilePoints(decile) {
  const row = ucatRows.find((entry) => entry.decile === decile);

  if (!row) {
    throw new Error(`No Edinburgh UCAT decile points for decile ${decile}`);
  }

  return row.points;
}

function sjtBandPoints(band) {
  if (excludedSjtBands.includes(band)) {
    return {
      eligible: false,
      points: null,
      failed_gate: 'sjt_band_4_exclusion'
    };
  }

  const points = sjtPoints[String(band)];

  if (points === undefined) {
    throw new Error(`No Edinburgh SJT points for band ${band}`);
  }

  return {
    eligible: true,
    points,
    failed_gate: null
  };
}

function gradeRank(grade) {
  return {
    'A*': 4,
    A: 3,
    B: 2,
    C: 1,
    '9': 9,
    '8': 8,
    '7': 7,
    '6': 6,
    '5': 5
  }[String(grade)] ?? 0;
}

function calculateGcseComponent(grades, subjectGrades = {}) {
  const topEight = grades.slice(0, 8);
  const grade8Or9Count = topEight.filter((grade) => gradeRank(grade) >= 8).length;
  const allGrade8Or9 = topEight.length === 8 && topEight.every((grade) => gradeRank(grade) >= 8);
  const allGrade7OrAbove = topEight.length === 8 && topEight.every((grade) => gradeRank(grade) >= 7);

  if (allGrade8Or9) return 12;
  if (allGrade7OrAbove && grade8Or9Count >= 5) return 10;
  if (allGrade7OrAbove) return 8;

  if (
    ['english_language', 'mathematics'].some((subject) => gradeRank(subjectGrades[subject]) >= 6)
  ) {
    return 4;
  }

  if (['biology', 'chemistry'].some((subject) => gradeRank(subjectGrades[subject]) >= 6)) {
    return 2;
  }

  return 0;
}

function calculateALevelComponent(subjectGrades) {
  const grades = Object.values(subjectGrades);
  const sorted = grades.map(gradeRank).sort((a, b) => b - a);
  const meetsAAA = sorted.length >= 3 && sorted[0] >= 3 && sorted[1] >= 3 && sorted[2] >= 3;

  if (!meetsAAA) return 0;

  const astarCount = grades.filter((grade) => grade === 'A*').length;
  const chemistryAstar = subjectGrades.chemistry === 'A*';

  if (astarCount >= 2) return chemistryAstar ? 8 : 6;
  if (astarCount === 1) return chemistryAstar ? 5 : 3;
  return 2;
}

function calculatePreAssessmentScore({ academicScore, ucatTotal, historicalDecile, sjtBand }) {
  if (ucatTotal < ucatCutoff) {
    return {
      eligible: false,
      failed_gate: 'ucat_2027_minimum_total_score',
      pre_assessment_score: null
    };
  }

  const sjt = sjtBandPoints(sjtBand);

  if (!sjt.eligible) {
    return {
      eligible: false,
      failed_gate: sjt.failed_gate,
      pre_assessment_score: null
    };
  }

  const ucatPoints = ucatDecilePoints(historicalDecile);
  const cappedAcademicScore = clampAcademicScore(
    academicScore,
    calculation.academic_score.hard_cap
  );

  return {
    eligible: true,
    academic_score: cappedAcademicScore,
    ucat_decile_points: ucatPoints,
    sjt_points: sjt.points,
    pre_assessment_score: Number((cappedAcademicScore + ucatPoints + sjt.points).toFixed(2))
  };
}

function calculateFinalScore(preAssessmentScore, suppliedAssessmentDayScore) {
  if (suppliedAssessmentDayScore === null || suppliedAssessmentDayScore === undefined) {
    return {
      available: false,
      final_score: null,
      reason: 'assessment_day_score_not_supplied'
    };
  }

  if (suppliedAssessmentDayScore < 0 || suppliedAssessmentDayScore > 50) {
    throw new RangeError('Assessment Day score must be between 0 and 50.');
  }

  return {
    available: true,
    final_score: Number(((preAssessmentScore / 40) * 50 + suppliedAssessmentDayScore).toFixed(2)),
    max: 100
  };
}

assert.strictEqual(calculation.total_score.scale.max, 40);
assert.strictEqual(calculation.academic_score.max_points, 20);
assert.strictEqual(calculation.academic_score.hard_cap, 20);
assert.match(calculation.academic_score.final_calculation, /min\(.+, 20\)/);
assert.strictEqual(calculation.academic_score.entry_requirements_used_in_scoring, false);
assert.strictEqual(calculation.ucat_decile_points.max_points, 14);
assert.strictEqual(calculation.sjt_points.max_points, 6);
assert.strictEqual(calculation.academic_score.routes.sqa.max_points, 20);
assert.strictEqual(calculation.academic_score.routes.sqa.national_5_component_max, 12);
assert.strictEqual(calculation.academic_score.routes.sqa.higher_advanced_higher_component_max, 8);
assert.strictEqual(calculation.academic_score.routes.ib.max_points, 20);
assert.strictEqual(calculation.academic_score.routes.ib.overall_ib_performance_component_max, 6);
assert.strictEqual(calculation.academic_score.routes.ib.higher_level_subject_combination_component_max, 14);
assert.strictEqual(calculation.academic_score.routes.ib.final_score_already_doubled, true);
assert.strictEqual(calculation.academic_score.routes.ib.post_total_multiplier, 1);
assert.strictEqual(calculation.academic_score.routes.ib.entry_requirements_used_in_scoring, false);
assert.ok(
  Array.isArray(calculation.academic_score.routes.sqa.higher_advanced_higher_component.point_bands),
  'SQA Higher/AH point bands should be stored as machine-readable rows.'
);
assert.strictEqual(calculation.academic_score.routes.ib.ib_component.component_total_max, 20);

for (const testCase of correctionFixture.academic_cap_cases) {
  const multiplier = testCase.post_total_multiplier ?? 1;
  const rawScore = testCase.component_scores.reduce((total, score) => total + score, 0) * multiplier;
  assert.strictEqual(
    clampAcademicScore(rawScore, calculation.academic_score.hard_cap),
    testCase.expected_academic_score,
    `${testCase.case_id} must respect the universal academic ceiling`
  );
}

for (const testCase of correctionFixture.sjt_cases) {
  assert.strictEqual(
    sjtPoints[String(testCase.band)],
    testCase.expected_points,
    `SJT Band ${testCase.band} point value mismatch`
  );
  assert.strictEqual(
    excludedSjtBands.includes(testCase.band),
    testCase.expected_automatic_rejection,
    `SJT Band ${testCase.band} rejection status mismatch`
  );
}

assert.strictEqual(calculation.sjt_points.evidence_classification, 'foi_verified');
assert.deepStrictEqual(calculation.sjt_points.source_ids, ['edinburgh_foi_formula_evidence']);
assert.match(calculation.sjt_points.exact_values_source_note, /verified FOI values/i);

const decileExpectations = [
  [10, 14],
  [9, 12.6],
  [8, 11.2],
  [7, 9.8],
  [6, 8.4],
  [5, 7],
  [4, 5.6],
  [3, 4.2],
  [2, 2.8],
  [1, 1.4]
];

for (const [decile, points] of decileExpectations) {
  assert.strictEqual(ucatDecilePoints(decile), points, `UCAT decile ${decile} points mismatch`);
}

assert.deepStrictEqual(
  [1, 2, 3].map((band) => sjtBandPoints(band).points),
  [6, 4.5, 3],
  'SJT Bands 1-3 points mismatch'
);

assert.deepStrictEqual(sjtBandPoints(4), {
  eligible: false,
  points: null,
  failed_gate: 'sjt_band_4_exclusion'
});

assert.strictEqual(
  calculateGcseComponent(['9', '9', '9', '9', '9', '9', '9', '9']),
  12,
  'Eight GCSE grades 8/9 should score 12.'
);
assert.strictEqual(
  calculateGcseComponent(['8', '8', '8', '8', '8', '7', '7', '7']),
  10,
  'Five to seven GCSE grades 8/9 with all grades >=7 should score 10.'
);
assert.strictEqual(
  calculateGcseComponent(['7', '7', '7', '7', '7', '7', '7', '7']),
  8,
  'All GCSE grades >=7 with up to four grades 8/9 should score 8.'
);

assert.strictEqual(calculateALevelComponent({ chemistry: 'A', biology: 'A', mathematics: 'A' }), 2);
assert.strictEqual(calculateALevelComponent({ chemistry: 'A', biology: 'A*', mathematics: 'A' }), 3);
assert.strictEqual(calculateALevelComponent({ chemistry: 'A*', biology: 'A', mathematics: 'A' }), 5);
assert.strictEqual(calculateALevelComponent({ chemistry: 'A', biology: 'A*', mathematics: 'A*' }), 6);
assert.strictEqual(calculateALevelComponent({ chemistry: 'A*', biology: 'A*', mathematics: 'A' }), 8);

const historicalDecile = deriveUniversityHistoricalDecile('edinburgh-a100', 2200, ucatData);
assert.strictEqual(historicalDecile.decile, 9);
assert.strictEqual(historicalDecile.evidence_label, 'historical_university_admissions_statistics_estimate');
assert.ok(historicalDecile.flags.includes('not_current_cycle_live_deciles'));

const academicScore = calculateGcseComponent(
  ['7', '7', '7', '7', '7', '7', '7', '7'],
  {
    biology: '7',
    chemistry: '7',
    mathematics: '7',
    english_language: '7'
  }
) + calculateALevelComponent({ chemistry: 'A', biology: 'A', mathematics: 'A' });

assert.strictEqual(academicScore, 10);

const preAssessment = calculatePreAssessmentScore({
  academicScore,
  ucatTotal: 2200,
  historicalDecile: historicalDecile.decile,
  sjtBand: 2
});

assert.deepStrictEqual(preAssessment, {
  eligible: true,
  academic_score: 10,
  ucat_decile_points: 12.6,
  sjt_points: 4.5,
  pre_assessment_score: 27.1
});

assert.deepStrictEqual(
  calculatePreAssessmentScore({
    academicScore: 27,
    ucatTotal: 2200,
    historicalDecile: historicalDecile.decile,
    sjtBand: 1
  }),
  {
    eligible: true,
    academic_score: 20,
    ucat_decile_points: 12.6,
    sjt_points: 6,
    pre_assessment_score: 38.6
  },
  'The pre-assessment formula must clamp a supplied academic score to 20.'
);

assert.deepStrictEqual(calculateFinalScore(preAssessment.pre_assessment_score, 38), {
  available: true,
  final_score: 71.88,
  max: 100
});

assert.deepStrictEqual(calculateFinalScore(preAssessment.pre_assessment_score, null), {
  available: false,
  final_score: null,
  reason: 'assessment_day_score_not_supplied'
});

assert.deepStrictEqual(
  calculatePreAssessmentScore({
    academicScore,
    ucatTotal: 1840,
    historicalDecile: 7,
    sjtBand: 2
  }),
  {
    eligible: false,
    failed_gate: 'ucat_2027_minimum_total_score',
    pre_assessment_score: null
  },
  'Below-cutoff UCAT applicant should fail before scoring.'
);

assert.deepStrictEqual(
  calculatePreAssessmentScore({
    academicScore,
    ucatTotal: 2200,
    historicalDecile: 9,
    sjtBand: 4
  }),
  {
    eligible: false,
    failed_gate: 'sjt_band_4_exclusion',
    pre_assessment_score: null
  },
  'SJT Band 4 applicant should fail before scoring.'
);

const feeCohortQuota = profile.quotas.find((quota) => quota.offer_allocation);
assert.strictEqual(feeCohortQuota.offer_allocation.ranked_within_fee_cohorts, true);
assert.strictEqual(profile.offer_selection.offer_model.final_score.scale.max, 100);
assert.strictEqual(profile.offer_selection.offer_model.ranking.ranked_within_fee_cohorts, true);
assert.match(card.prediction.band_basis, /historical international UCAT competitiveness guidance/i);
assert.match(card.prediction.band_basis, /not a fixed Edinburgh interview cut-off/i);
assert.match(card.prediction.band_basis, /total pre-interview score out of 40/i);
assert.match(card.prediction.band_basis, /not UCAT alone/i);

console.log('Edinburgh A100 official pre-assessment formula tests passed.');
