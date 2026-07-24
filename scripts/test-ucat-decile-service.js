#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  EVIDENCE_LABEL,
  UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
  deriveNationalUcatDecile,
  deriveUniversityHistoricalDecile,
  loadUcatDecileData,
  mapDecileToPoints,
  resolveUcatDecile
} = require('../assets/js/engine/ucat-decile-service');

const rootDir = path.resolve(__dirname, '..');
const ucatDataPath = path.join(rootDir, 'data', 'ucat-deciles.json');
const cardiffPath = path.join(rootDir, 'data', 'universities', 'cardiff-a100.json');

const ucatData = loadUcatDecileData(ucatDataPath);
const cardiffProfile = JSON.parse(fs.readFileSync(cardiffPath, 'utf8'));

const decileResult = deriveNationalUcatDecile(2650, ucatData);

assert.deepStrictEqual(decileResult, {
  raw_score: 2650,
  score_scale: 2700,
  national_decile: 10,
  decile_band: 'above_9th_decile',
  evidence_label: EVIDENCE_LABEL,
  flags: [
    'engine_derived',
    'not_university_published',
    'not_official_university_prediction'
  ]
});

const cardiffPointRows = cardiffProfile.stage_2_interview_selection.calculation.ucat_decile_points.points;
const cardiffUcatPoints = mapDecileToPoints(decileResult.national_decile, cardiffPointRows);

assert.strictEqual(cardiffUcatPoints.available, true);
assert.strictEqual(cardiffUcatPoints.points, 3);
assert.strictEqual(cardiffUcatPoints.national_decile, 10);
assert.strictEqual(cardiffUcatPoints.evidence_label, EVIDENCE_LABEL);
assert.deepStrictEqual(cardiffUcatPoints.flags, [
  'engine_derived',
  'not_university_published',
  'not_official_university_prediction'
]);

const edinburghHistoricalDecile = deriveUniversityHistoricalDecile('edinburgh-a100', 2200, ucatData);

assert.deepStrictEqual(edinburghHistoricalDecile, {
  available: true,
  raw_score: 2200,
  decile: 9,
  decile_band: '2198-2303',
  source_year: 2025,
  university: 'Edinburgh',
  course: 'A100',
  prediction_basis: 'historical_estimate',
  evidence_label: UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
  disclaimer: 'UCAT decile estimated using latest published Edinburgh 2025 admissions statistics, not current live applicant pool.',
  flags: [
    'historical_estimate',
    'not_current_cycle_live_deciles',
    'not_national_ucat_deciles'
  ]
});

assert.notStrictEqual(
  deriveUniversityHistoricalDecile('edinburgh-a100', 2100, ucatData).decile,
  deriveNationalUcatDecile(2100, ucatData).national_decile,
  'Edinburgh historical deciles must not silently reuse national UCAT deciles.'
);

const universitySpecific = resolveUcatDecile(2100, {
  courseProfileId: 'edinburgh-a100',
  decileData: ucatData
});
assert.strictEqual(universitySpecific.available, true);
assert.strictEqual(universitySpecific.national_decile, 7);
assert.strictEqual(universitySpecific.lookup_source, 'university_specific');

const globalFallback = resolveUcatDecile(2350, {
  courseProfileId: 'birmingham-a100',
  decileData: ucatData
});
assert.strictEqual(globalFallback.available, true);
assert.strictEqual(globalFallback.national_decile, 10);
assert.strictEqual(globalFallback.lookup_source, 'global_ucat_decile_json');

const unavailable = resolveUcatDecile(2350, {
  courseProfileId: 'birmingham-a100',
  decileData: {
    score_scale: {
      cognitive_total_min: 900,
      cognitive_total_max: 2700
    }
  }
});
assert.strictEqual(unavailable.available, false);
assert.strictEqual(unavailable.reason, 'usable_ucat_decile_data_unavailable');

console.log('UCAT decile service tests passed.');
