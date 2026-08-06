#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CANONICAL_BANDS,
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');
const fixturePath = path.join(
  rootDir,
  'data',
  'fixtures',
  'interview-band-classification',
  'shared-standard-school-leaver.json'
);
const fixture = readJson(fixturePath);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadCase(courseProfileId) {
  return {
    course: readJson(path.join(rootDir, 'data', 'universities', `${courseProfileId}.json`)),
    config: readJson(path.join(rootDir, 'data', 'interview-band-configs', `${courseProfileId}.json`))
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const engineSource = fs.readFileSync(
  path.join(rootDir, 'assets', 'js', 'engine', 'interview-band-classifier.js'),
  'utf8'
);

for (const universityName of [
  'aberdeen',
  'dundee',
  'cardiff',
  'edinburgh',
  'glasgow',
  'lancaster',
  'liverpool',
  'manchester',
  'sheffield',
  'st-andrews'
]) {
  assert.ok(
    !engineSource.toLowerCase().includes(universityName),
    `Generic engine must not contain university-specific branch text: ${universityName}.`
  );
}

const results = fixture.cases.map((testCase) => {
  const { course, config } = loadCase(testCase.course_profile_id);
  const result = classifyInterviewBand(course, config, fixture.applicant);

  assert.strictEqual(result.eligibility.status, testCase.expected_eligibility);
  assert.strictEqual(result.ranking?.value ?? null, testCase.expected_score);
  assert.strictEqual(result.ranking?.max ?? null, testCase.expected_score_max);
  assert.strictEqual(result.canonical_interview_band, testCase.expected_band);
  assert.ok(CANONICAL_BANDS.has(result.canonical_interview_band));
  assert.ok(result.evidence_basis?.summary);
  assert.ok(['high', 'medium', 'low'].includes(result.confidence));
  assert.strictEqual(result.offer_prediction_status, undefined);
  assert.ok(result.explanation);

  return result;
});

for (const courseProfileId of [
  'aberdeen-a100',
  'dundee-a100',
  'edinburgh-a100',
  'glasgow-a100',
  'lancaster-a100',
  'liverpool-a100',
  'st-andrews-a100'
]) {
  const testCase = fixture.cases.find((candidate) => {
    return candidate.course_profile_id === courseProfileId;
  });
  const { course, config } = loadCase(courseProfileId);
  const applicant = clone(fixture.applicant);
  applicant.a_level_profile.subjects = applicant.a_level_profile.subjects.map(
    (subject) => ({
      ...subject,
      practical_endorsement:
        subject.subject_id === 'chemistry' ? 'fail' : null
    })
  );
  const result = classifyInterviewBand(course, config, applicant);

  assert.strictEqual(
    result.eligibility.status,
    testCase.expected_eligibility,
    `${courseProfileId} must not enforce an unrecorded practical requirement.`
  );
  assert.ok(
    !result.eligibility.failures.some((failure) => {
      return failure.includes('practical') || failure.includes('endorsement');
    }),
    `${courseProfileId} must not emit a practical endorsement failure.`
  );
}

const cardiffCase = loadCase('cardiff-a100');
const cardiffMissingChemistry = clone(fixture.applicant);
delete cardiffMissingChemistry.gcse_profile.subjects.chemistry;
cardiffMissingChemistry.gcse_profile.total_gcse_count = 9;
assert.strictEqual(
  classifyInterviewBand(cardiffCase.course, cardiffCase.config, cardiffMissingChemistry)
    .canonical_interview_band,
  'not_eligible',
  'Cardiff mandatory GCSE subjects must be checked from the exact subject list.'
);

const cardiffResult = results.find((result) => result.course_profile_id === 'cardiff-a100');
assert.strictEqual(
  cardiffResult.ranking.components.gcse_score.value,
  17,
  'Cardiff scoring must include mandatory subjects before selecting the remaining best GCSEs.'
);

const liverpoolCase = loadCase('liverpool-a100');
const liverpoolEightGcse = clone(fixture.applicant);
liverpoolEightGcse.gcse_profile.additional_subjects =
  liverpoolEightGcse.gcse_profile.additional_subjects.slice(0, 3);
liverpoolEightGcse.gcse_profile.total_gcse_count = 8;
const liverpoolCountResult = classifyInterviewBand(
  liverpoolCase.course,
  liverpoolCase.config,
  liverpoolEightGcse
);
assert.strictEqual(liverpoolCountResult.canonical_interview_band, 'not_eligible');
assert.ok(liverpoolCountResult.eligibility.failures.includes('minimum_gcse_count_not_met'));

const liverpoolLowPoints = clone(fixture.applicant);
for (const subjectId of Object.keys(liverpoolLowPoints.gcse_profile.subjects)) {
  liverpoolLowPoints.gcse_profile.subjects[subjectId] = '6';
}
for (const subject of liverpoolLowPoints.gcse_profile.additional_subjects) {
  subject.grade = '6';
}
const liverpoolPointsResult = classifyInterviewBand(
  liverpoolCase.course,
  liverpoolCase.config,
  liverpoolLowPoints
);
assert.strictEqual(liverpoolPointsResult.canonical_interview_band, 'not_eligible');
assert.ok(liverpoolPointsResult.eligibility.failures.includes('minimum_gcse_points_not_met'));

const stAndrewsCase = loadCase('st-andrews-a100');

function classifyStAndrews(domicile, score, changes = {}) {
  const applicant = clone(fixture.applicant);
  applicant.applicant_identity.domicile = domicile;
  applicant.admissions_tests.ucat.total_score = score;
  Object.assign(applicant.applicant_identity, changes);
  return classifyInterviewBand(stAndrewsCase.course, stAndrewsCase.config, applicant);
}

const stAndrewsBoundaryCases = [
  ['Scotland', 2040, 'interview_likely', 'scottish_home_non_contextual_a_level_school_leaver'],
  ['Scotland', 1793, 'realistic', 'scottish_home_non_contextual_a_level_school_leaver'],
  ['Scotland', 1673, 'ambitious', 'scottish_home_non_contextual_a_level_school_leaver'],
  ['Scotland', 1672, 'high_risk', 'scottish_home_non_contextual_a_level_school_leaver'],
  ['England', 2180, 'interview_likely', 'rest_of_uk_non_contextual_a_level_school_leaver'],
  ['England', 2078, 'realistic', 'rest_of_uk_non_contextual_a_level_school_leaver'],
  ['England', 1800, 'ambitious', 'rest_of_uk_non_contextual_a_level_school_leaver'],
  ['England', 1799, 'high_risk', 'rest_of_uk_non_contextual_a_level_school_leaver']
];

for (const [domicile, score, expectedBand, expectedPool] of stAndrewsBoundaryCases) {
  const result = classifyStAndrews(domicile, score);
  assert.strictEqual(result.canonical_interview_band, expectedBand);
  assert.strictEqual(result.guidance_pool_id, expectedPool);
  assert.strictEqual(result.confidence, 'low');
  assert.strictEqual(result.offer_prediction_status, undefined);
}

const stAndrewsTopLevelContextual = classifyStAndrews('England', 2200, { contextual: true });
assert.strictEqual(stAndrewsTopLevelContextual.canonical_interview_band, 'interview_likely');
assert.strictEqual(
  stAndrewsTopLevelContextual.guidance_pool_id,
  'rest_of_uk_non_contextual_a_level_school_leaver'
);

const stAndrewsGraduate = classifyStAndrews('England', 2200, { graduate: true });
assert.strictEqual(stAndrewsGraduate.canonical_interview_band, 'insufficient_evidence');
assert.strictEqual(stAndrewsGraduate.guidance_pool_id, null);

const stAndrewsInternational = classifyStAndrews('International', 1995, {
  fee_status: 'International'
});
assert.strictEqual(stAndrewsInternational.eligibility.status, 'eligible');
assert.strictEqual(
  stAndrewsInternational.guidance_pool_id,
  'international_historical_guidance'
);
assert.strictEqual(stAndrewsInternational.canonical_interview_band, 'interview_likely');

const stAndrewsWpApplicant = clone(fixture.applicant);
stAndrewsWpApplicant.applicant_identity.domicile = 'Scotland';
stAndrewsWpApplicant.applicant_identity.contextual_flags.simd40 = true;
stAndrewsWpApplicant.admissions_tests.ucat.total_score = 2200;
const stAndrewsWpResult = classifyInterviewBand(
  stAndrewsCase.course,
  stAndrewsCase.config,
  stAndrewsWpApplicant
);
assert.strictEqual(stAndrewsWpResult.canonical_interview_band, 'interview_likely');
assert.strictEqual(
  stAndrewsWpResult.guidance_pool_id,
  'scottish_home_non_contextual_a_level_school_leaver'
);

const stAndrewsSjtBand4 = clone(fixture.applicant);
stAndrewsSjtBand4.admissions_tests.ucat.sjt_band = 4;
const stAndrewsSjtResult = classifyInterviewBand(
  stAndrewsCase.course,
  stAndrewsCase.config,
  stAndrewsSjtBand4
);
assert.notStrictEqual(stAndrewsSjtResult.canonical_interview_band, 'not_eligible');
assert.ok(!stAndrewsSjtResult.eligibility.failures.includes('disqualifying_sjt_rule'));

const stAndrewsResultCard = readJson(
  path.join(rootDir, 'data', 'examples', 'st-andrews-a100-result-card.example.json')
);
const stAndrewsCardApplicant = clone(fixture.applicant);
stAndrewsCardApplicant.applicant_identity.fee_status = 'International';
stAndrewsCardApplicant.applicant_identity.domicile = 'International';
stAndrewsCardApplicant.applicant_identity.applicant_type =
  'international_standard_school_leaver';
stAndrewsCardApplicant.admissions_tests.ucat.total_score = stAndrewsResultCard.prediction.score;
const stAndrewsCardResult = classifyInterviewBand(
  stAndrewsCase.course,
  stAndrewsCase.config,
  stAndrewsCardApplicant
);
assert.strictEqual(
  stAndrewsCardResult.canonical_interview_band,
  stAndrewsResultCard.prediction.result_band
);
assert.strictEqual(
  stAndrewsCardResult.guidance_pool_id,
  stAndrewsResultCard.prediction.guidance_pool_id
);
assert.strictEqual(
  stAndrewsCardResult.confidence,
  stAndrewsResultCard.prediction.confidence_level
);
assert.strictEqual(
  stAndrewsResultCard.historical_context.official_published_evidence.official,
  true
);
assert.strictEqual(
  stAndrewsResultCard.historical_context.derived_prediction_evidence.official,
  false
);
assert.strictEqual(
  stAndrewsResultCard.historical_context.derived_prediction_evidence.evidence_status,
  'derived_for_prediction'
);

for (const testCase of fixture.cases) {
  const { course, config } = loadCase(testCase.course_profile_id);
  const missingUcat = clone(fixture.applicant);
  missingUcat.admissions_tests.ucat.total_score = null;
  const result = classifyInterviewBand(course, config, missingUcat);
  assert.strictEqual(result.canonical_interview_band, 'not_eligible');
  assert.ok(result.eligibility.failures.includes('required_admissions_test_missing:ucat'));
}

for (const courseProfileId of ['edinburgh-a100', 'liverpool-a100']) {
  const { course, config } = loadCase(courseProfileId);
  const sjtBand4 = clone(fixture.applicant);
  sjtBand4.admissions_tests.ucat.sjt_band = 4;
  const result = classifyInterviewBand(course, config, sjtBand4);
  assert.strictEqual(result.canonical_interview_band, 'not_eligible');
  assert.ok(result.eligibility.failures.includes('disqualifying_sjt_rule'));
}

const noEvidenceConfig = {
  ...cardiffCase.config,
  score_model: null,
  guidance_pools: []
};
const noEvidenceResult = classifyInterviewBand(
  cardiffCase.course,
  null,
  fixture.applicant
);
assert.strictEqual(noEvidenceResult.eligibility.status, 'eligible');
assert.strictEqual(noEvidenceResult.canonical_interview_band, 'insufficient_evidence');

assert.strictEqual(
  classifyInterviewBand(cardiffCase.course, noEvidenceConfig, fixture.applicant)
    .canonical_interview_band,
  'insufficient_evidence'
);

console.log('Generic arbitrary-profile cross-university test');
console.log('| University | Eligibility | Score / ranking basis | Canonical band | Evidence basis | Confidence | Explanation |');
console.log('| ---------- | ----------- | --------------------- | -------------- | -------------- | ---------- | ----------- |');
for (const result of results) {
  const score = result.ranking
    ? `${result.ranking.value}/${result.ranking.max} (${result.ranking.basis})`
    : 'not applied';
  console.log(
    `| ${result.course_profile_id} | ${result.eligibility.status} | ${score} | ${result.canonical_interview_band} | ${result.evidence_basis.classification} | ${result.confidence} | ${result.explanation} |`
  );
}
console.log('');
console.log(
  `PASS generic interview band classifier regression (${results.length}/${fixture.cases.length} fixture cases plus hard-filter and St Andrews restricted-scope invariants)`
);
