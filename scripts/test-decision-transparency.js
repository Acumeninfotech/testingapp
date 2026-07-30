#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildDecisionTransparency,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const { predict } = require('../server/src/predict');
const { isProductionReady } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'data', 'examples');
const universitiesDir = path.join(rootDir, 'data', 'universities');
const configsDir = path.join(rootDir, 'data', 'interview-band-configs');
const index = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'index.json'), 'utf8'));
const studentProfileTemplate = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'templates', 'student-profile-template.json'), 'utf8')
);
const completedIds = index.universities
  .filter(isProductionReady)
  .map((entry) => entry.id)
  .sort();
const evidenceCategories = new Set([
  'Official admissions policy',
  'University selection methodology',
  'UCAT policy',
  'Historical interview data',
  'FOI evidence',
  'Contextual admissions policy',
  'International admissions policy',
  'University selection process',
  'Fee information',
  'Documented prediction limitation'
]);
const forbiddenInternalWording =
  /\b(classifier|regression|config(?:uration)?|fixture|json|threshold object|band key|source id)\b/i;
const forbiddenOfferPredictionWording =
  /\boffer[- ]?(prediction|probability|likelihood|chance|outcome)\b/i;
const expectedStages = [
  'Eligibility',
  'Selection model',
  'Historical guidance',
  'Recommendation'
];

assert.ok(completedIds.includes('buckingham-71a8'), 'Buckingham 71A8 must be included in the completed production set.');

for (const profileId of completedIds) {
  const filePath = path.join(examplesDir, `${profileId}-result-card.example.json`);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const transparency = card.decision_transparency;

  assert.ok(transparency, `${profileId} must include decision_transparency.`);
  assert.deepStrictEqual(
    transparency,
    buildDecisionTransparency(card),
    `${profileId} decision transparency must match the shared builder.`
  );
  assert.deepStrictEqual(
    transparency.decision_path.map((stage) => stage.stage),
    expectedStages,
    `${profileId} must use the standard decision path in order.`
  );
  assert.ok(transparency.key_reasons.length > 0, `${profileId} must explain key reasons.`);
  assert.ok(transparency.evidence_used.length > 0, `${profileId} must identify evidence categories.`);
  assert.deepStrictEqual(
    transparency.evidence_confidence,
    card.evidence_confidence,
    `${profileId} must include evidence confidence in decision transparency.`
  );
  assert.ok(
    transparency.evidence_used.every((category) => evidenceCategories.has(category)),
    `${profileId} must expose only approved evidence categories.`
  );
  assert.ok(
    transparency.decision_path[1].checks.some((entry) => entry.label === 'Applicant pool'),
    `${profileId} must explain the applicant pool used.`
  );
  if (card.recommendation_display_state === 'eligibility_only') {
    assert.match(
      transparency.decision_path[2].summary,
      /not used.*eligibility-only result/i,
      `${profileId} must explain why historical interview comparison is not used.`
    );
  } else {
    if (profileId === 'king-s-college-london-a100') {
      assert.match(
        transparency.decision_path[2].summary,
        /historically competitive range for interview consideration/i,
        `${profileId} must use the approved parent-friendly historical context.`
      );
      assert.match(
        card.display?.trust_statement || card.trust_statement || '',
        /not a guarantee of interview/i,
        `${profileId} must state that the prediction is not a guarantee.`
      );
    } else {
      assert.match(
        transparency.decision_path[2].summary,
        /guidance only/i,
        `${profileId} must label historical information as guidance.`
      );
      assert.match(
        transparency.decision_path[2].summary,
        /not .*guarantee|never guarantees/i,
        `${profileId} must state that historical guidance is not a guarantee.`
      );
    }
  }

  const studentFacingText = JSON.stringify(transparency);
  assert.doesNotMatch(
    studentFacingText,
    forbiddenInternalWording,
    `${profileId} must not expose internal wording.`
  );
  assert.doesNotMatch(
    studentFacingText,
    forbiddenOfferPredictionWording,
    `${profileId} must not expose offer-prediction wording.`
  );
}

function transparencyFor(input) {
  return presentResultCard({
    ...input,
    transparencyContext: {
      applicantPool: 'Home standard school-leavers',
      eligibility: {
        summary: input.eligibilitySummary || 'The supported entry requirements are met.'
      },
      evidenceUsed: [
        'Official admissions policy',
        'Historical interview data'
      ]
    }
  }).decision_transparency;
}

const notEligible = transparencyFor({
  eligibilityStatus: 'not_eligible',
  interviewBand: 'interview_likely',
  manualReviewRequired: true,
  eligibilitySummary: 'The required Chemistry grade is not met.'
});
assert.strictEqual(notEligible.decision_path[3].status, 'Not eligible');
assert.match(notEligible.decision_path[3].summary, /not applied/i);
assert.match(notEligible.key_reasons.join(' '), /cannot override/i);
assert.strictEqual(notEligible.manual_review_reason, null);

const manualReview = transparencyFor({
  eligibilityStatus: 'manual_review',
  interviewBand: 'interview_likely',
  manualReviewRequired: true,
  manualReviewReason: 'Contextual evidence must be confirmed before points can be applied.'
});
assert.strictEqual(manualReview.decision_path[3].status, 'Needs review');
assert.match(manualReview.manual_review_reason, /Contextual evidence/i);
assert.doesNotMatch(manualReview.decision_path[3].summary, /Strong choice|Good chance/i);

const insufficientEvidence = transparencyFor({
  eligibilityStatus: 'eligible',
  interviewBand: 'insufficient_evidence',
  insufficientEvidenceReason: 'Verified historical interview information is missing for this applicant group.'
});
assert.strictEqual(
  insufficientEvidence.decision_path[3].status,
  'Insufficient evidence'
);
assert.match(insufficientEvidence.insufficient_evidence_reason, /missing/i);
assert.match(insufficientEvidence.decision_path[3].summary, /No confident recommendation/i);

const universityRequirements = {
  'aberdeen-a100': /Academic results contribute.*UCAT contributes.*42\.78 out of 50/s,
  'aston-a100': /six selected GCSEs and the UCAT cognitive total/i,
  'birmingham-a100': /Contextual points require verified applicant evidence/i,
  'cambridge-a100': /holistically by college.*hidden modelled guidance/i,
  'cardiff-a100': /24 points out of 24.*3 points out of 3.*0 points out of 1.*27 out of 28.*raw UCAT/s,
  'city-st-george-s-of-london-a100': /academic eligibility.*UCAT cognitive section.*raw UCAT total.*SJT is recorded but excluded/i,
  'dundee-a100': /academic attainment and UCAT national-decile performance/i,
  'edinburgh-a100': /20 points.*14 points.*6 points.*total out of 40/s,
  'edge-hill-a100': /UCAT total is the ranking metric.*No academic score is created/s,
  'glasgow-a100': /UCAT cognitive total only.*fee-status group/s,
  'hull-york-a100': /GCSE, UCAT decile and SJT components.*contextual points.*unofficial estimate/s,
  'lancashire-a100': /measurable academic requirements and UCAT.*personal reflective statement.*does not estimate interview likelihood/i,
  'lancaster-a100': /sole ranking score.*2026-entry Home historical threshold/s,
  'liverpool-a100': /Home standard non-contextual applicant pool is used/i,
  'manchester-a100': /Band 1–2 requirement.*separate international applicant group.*MMI performance/s,
  'newcastle-a100': /Academic score.*UCAT score.*combined score is 70 out of 100/s,
  'nottingham-a100': /eight GCSEs, the three UCAT cognitive sections and SJT/i,
  'sheffield-a100': /threshold-only.*UCAT cognitive total.*2025–26 Home historical cutpoint/s,
  'st-andrews-a100': /hurdles first.*UCAT Global Score.*10% UCAT uplift.*does not publish a fixed UCAT cut-off/s
};

for (const [profileId, pattern] of Object.entries(universityRequirements)) {
  const card = JSON.parse(
    fs.readFileSync(
      path.join(examplesDir, `${profileId}-result-card.example.json`),
      'utf8'
    )
  );
  assert.match(
    JSON.stringify(card.decision_transparency),
    pattern,
    `${profileId} must include its university-specific explanation.`
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setUcatTotal(profile, totalScore, sjtBand = 2) {
  const first = Math.floor(totalScore / 3);
  const second = Math.floor(totalScore / 3);
  profile.admissions_tests.ucat.total_score = totalScore;
  profile.admissions_tests.ucat.score_scale = 2700;
  profile.admissions_tests.ucat.subtests = {
    verbal_reasoning: first,
    decision_making: second,
    quantitative_reasoning: totalScore - first - second
  };
  profile.admissions_tests.ucat.sjt_band = sjtBand;
  profile.admissions_tests.ucat.test_year = 2026;
  profile.application_year = 2027;
}

function makeApiProfile(entry, { totalScore = 2200, sjtBand = 2, feeStatus = 'home', contextual = false } = {}) {
  const base = studentProfileTemplate.sample_profiles.find(
    (profile) => profile.profile_id === 'strong_standard_applicant'
  );
  assert.ok(base, 'strong_standard_applicant sample profile must exist.');

  const profile = clone(base);
  const course = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', entry.json_file), 'utf8'));

  profile.profile_id = `api_${entry.id}_${feeStatus}_${totalScore}_sjt${sjtBand}`;
  profile.qualification_route = 'a_level';
  profile.course_target = {
    ...(profile.course_target || {}),
    ucas_code: course.course?.ucas_code || entry.course_code,
    course_route: 'standard',
    entry_route: 'standard'
  };
  profile.applicant_identity.applicant_type = 'school_leaver';
  profile.applicant_identity.fee_status = feeStatus === 'international' ? 'international' : 'home';
  profile.applicant_identity.domicile = feeStatus === 'international' ? 'international' : 'england';
  profile.applicant_identity.contextual = contextual;
  profile.applicant_identity.widening_participation = contextual;
  profile.applicant_identity.contextual_flags = {
    ...(profile.applicant_identity.contextual_flags || {}),
    polar4_quintile_1_or_2: contextual,
    care_experienced: false
  };
  profile.a_level_profile.completed_in_one_sitting = true;
  profile.a_level_profile.subjects[0].predicted_grade = 'A*';
  profile.english_language_profile = {
    test: 'ielts',
    overall: 8,
    reading: 8,
    writing: 8,
    listening: 8,
    speaking: 8,
    scores: {
      overall: 8,
      reading: 8,
      writing: 8,
      listening: 8,
      speaking: 8
    }
  };
  setUcatTotal(profile, totalScore, sjtBand);

  return profile;
}

function isProductionUcatRankingEntry(entry) {
  if (!isProductionReady(entry)) {
    return false;
  }
  const course = JSON.parse(fs.readFileSync(path.join(universitiesDir, `${entry.id}.json`), 'utf8'));
  const config = JSON.parse(fs.readFileSync(path.join(configsDir, `${entry.id}.json`), 'utf8'));
  return config.score_model?.type === 'ranking_metric' &&
    config.score_model?.metric === 'ucat_total';
}

function assertUcatRankingApiCard(entry, options = {}) {
  const result = predict({
    universityIds: [entry.id],
    studentProfile: makeApiProfile(entry, options)
  })[0];
  const card = result.result_card;
  const text = JSON.stringify(card);

  if (card.recommendation_display_state === 'not_eligible') {
    return card;
  }
  if (options.allowInsufficientEvidence === true && card.recommendation_display_state === 'insufficient_evidence') {
    assert.strictEqual(card.prediction.ranking_metric, 'ucat_total', `${entry.id} must identify UCAT as the ranking metric.`);
    assert.strictEqual(card.decision_transparency.score_breakdown, null);
    assert.ok(card.decision_transparency.ucat_comparison, `${entry.id} must expose structured UCAT comparison data.`);
    assert.strictEqual(card.decision_transparency.ucat_comparison.comparison_type, 'ranking_only');
    return card;
  }

  assert.strictEqual(card.prediction.ranking_metric, 'ucat_total', `${entry.id} must identify UCAT as the ranking metric.`);
  assert.match(
    card.primary_user_facing_recommendation,
    /choice based on your UCAT|high risk based on your UCAT/i,
    `${entry.id} must use a UCAT-specific recommendation heading.`
  );
  assert.match(
    card.primary_explanation,
    /Your UCAT is|UCAT is above|Eligible applicants are ranked by UCAT|published UCAT minimum/i,
    `${entry.id} must interpret the applicant's UCAT in the main explanation.`
  );
  assert.strictEqual(
    card.decision_transparency.score_breakdown,
    null,
    `${entry.id} must not expose a combined selection score for a UCAT-ranking result.`
  );
  assert.doesNotMatch(text, /Selection score:\s*\d+\s*\/\s*\d+/i, `${entry.id} must not render a fabricated selection score.`);
  assert.doesNotMatch(text, /Your score is (above|below|within)/i, `${entry.id} must not use generic score-comparison wording for UCAT ranking.`);

  const comparison = card.decision_transparency.ucat_comparison;
  assert.ok(comparison, `${entry.id} must expose structured UCAT comparison data.`);
  assert.ok(
    [
      'official_minimum',
      'historical_threshold',
      'historical_range',
      'historical_average',
      'current_guidance',
      'ranking_only'
    ].includes(comparison.comparison_type),
    `${entry.id} must expose a supported comparison_type.`
  );
  assert.strictEqual(comparison.applicant_ucat, options.totalScore ?? 2200, `${entry.id} must expose the applicant UCAT.`);
  assert.ok(comparison.applicant_pool, `${entry.id} must expose the applicant pool.`);
  assert.ok(
    ['above', 'within', 'below', null].includes(comparison.position),
    `${entry.id} must expose the UCAT position.`
  );
  assert.ok(
    ['met', 'not_met', 'ignored', 'scored', 'post_interview'].includes(comparison.sjt_outcome),
    `${entry.id} must expose the interpreted SJT outcome.`
  );
  assert.match(comparison.sjt_summary, /Band|SJT/i, `${entry.id} must explain the SJT band effect.`);
  if (comparison.comparison_type === 'historical_threshold') {
    assert.strictEqual(
      comparison.difference_from_benchmark,
      comparison.applicant_ucat - comparison.benchmark_min,
      `${entry.id} must calculate the threshold difference correctly.`
    );
  }
  if (comparison.comparison_type === 'historical_range') {
    assert.strictEqual(comparison.difference_from_benchmark, null, `${entry.id} range comparisons must not invent a single-boundary difference.`);
    assert.ok(Number.isFinite(comparison.benchmark_min), `${entry.id} range comparison must expose benchmark_min.`);
    assert.ok(Number.isFinite(comparison.benchmark_max), `${entry.id} range comparison must expose benchmark_max.`);
  }

  const selectionChecks = card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Selection model').checks;
  assert.ok(
    selectionChecks.some((check) =>
      (check.label === 'UCAT' && /UCAT:|UCAT ranking/i.test(check.summary)) ||
      (check.label === 'Selection approach' && /UCAT cognitive total|UCAT ranking/i.test(check.summary))
    ),
    `${entry.id} must show interpreted UCAT evidence.`
  );
  assert.ok(
    selectionChecks.some((check) => check.label === 'SJT requirement' && /Band|SJT/i.test(check.summary)) ||
      /Band|SJT/i.test(comparison.sjt_summary),
    `${entry.id} must show interpreted SJT evidence.`
  );

  return card;
}

const ucatRankingEntries = index.universities
  .filter(isProductionUcatRankingEntry)
  .sort((left, right) => left.id.localeCompare(right.id));
assert.deepStrictEqual(
  ucatRankingEntries.map((entry) => entry.id),
  [
    'brighton-and-sussex-a100',
    'bristol-a100',
    'brunel-university-of-london-a100',
    'city-st-george-s-of-london-a100',
    'east-anglia-a100',
    'edge-hill-a100',
    'glasgow-a100',
    'imperial-college-london-a100',
    'keele-a100',
    'lancaster-a100',
    'liverpool-a100',
    'manchester-a100',
    'plymouth-a100',
    'queen-mary-a100',
    'sheffield-a100',
    'southampton-a100',
    'st-andrews-a100',
    'ucl-a100'
  ],
  'Production UCAT-ranking scope must be derived from ready production data and ranking configs.'
);

for (const entry of ucatRankingEntries) {
  const standardCard = assertUcatRankingApiCard(entry, {
    totalScore: entry.id === 'imperial-college-london-a100' ? 2400 : 2200,
    sjtBand: 2,
    feeStatus: entry.id === 'keele-a100' ? 'international' : 'home'
  });
  assert.notStrictEqual(
    standardCard.recommendation_display_state,
    'not_eligible',
    `${entry.id} standard UCAT-ranking API case must be eligible.`
  );

  assertUcatRankingApiCard(entry, {
    totalScore: 1800,
    sjtBand: 2,
    feeStatus: entry.id === 'keele-a100' ? 'international' : 'home'
  });
  assertUcatRankingApiCard(entry, {
    totalScore: 2450,
    sjtBand: 2,
    feeStatus: entry.id === 'keele-a100' ? 'international' : 'home'
  });
}

const band4RejectedIds = ['edge-hill-a100', 'keele-a100', 'lancaster-a100', 'liverpool-a100', 'manchester-a100', 'queen-mary-a100'];
for (const profileId of band4RejectedIds) {
  const entry = ucatRankingEntries.find((item) => item.id === profileId);
  const card = assertUcatRankingApiCard(entry, {
    totalScore: 2200,
    sjtBand: 4,
    feeStatus: profileId === 'keele-a100' ? 'international' : 'home'
  });
  assert.strictEqual(card.recommendation_display_state, 'not_eligible', `${profileId} must reject excluded SJT Band 4.`);
}

const band4IgnoredIds = ['east-anglia-a100', 'glasgow-a100', 'sheffield-a100', 'southampton-a100', 'st-andrews-a100', 'ucl-a100'];
for (const profileId of band4IgnoredIds) {
  const entry = ucatRankingEntries.find((item) => item.id === profileId);
  const card = assertUcatRankingApiCard(entry, {
    totalScore: 2200,
    sjtBand: 4,
    feeStatus: 'home'
  });
  assert.strictEqual(card.recommendation_display_state, 'standard', `${profileId} must not reject SJT Band 4.`);
}

for (const profileId of ['east-anglia-a100', 'lancaster-a100', 'liverpool-a100', 'manchester-a100', 'sheffield-a100', 'southampton-a100', 'st-andrews-a100', 'ucl-a100']) {
  const entry = ucatRankingEntries.find((item) => item.id === profileId);
  const home = assertUcatRankingApiCard(entry, { totalScore: 2200, feeStatus: 'home' });
  const international = assertUcatRankingApiCard(entry, {
    totalScore: 2200,
    feeStatus: 'international',
    allowInsufficientEvidence: profileId === 'southampton-a100' || profileId === 'east-anglia-a100'
  });
  const poolFor = (card) => card.decision_transparency.decision_path
    .find((stage) => stage.stage === 'Selection model').checks
    .find((check) => check.label === 'Applicant pool').summary;
  assert.match(poolFor(home), /Home|Rest of UK/i, `${profileId} Home applicant must use the Home/RUK pool.`);
  assert.match(poolFor(international), /International/i, `${profileId} International applicant must use the International pool.`);
}

const edgeHillEntry = ucatRankingEntries.find((item) => item.id === 'edge-hill-a100');
const edgeHillInternational = assertUcatRankingApiCard(edgeHillEntry, {
  totalScore: 2200,
  feeStatus: 'international'
});
assert.strictEqual(
  edgeHillInternational.recommendation_display_state,
  'not_eligible',
  'Edge Hill A100 International applicants must be ineligible, not assigned to an International pool.'
);
assert.match(
  JSON.stringify(edgeHillInternational.decision_transparency),
  /International applicants are not accepted|applicant group/i
);

console.log('Decision transparency regression: PASS');
console.log(`Completed university result cards checked: ${completedIds.length}`);
console.log('Precedence, guidance, wording and university-specific assertions: PASS');
console.log(`Production UCAT-ranking result-card API contracts checked: ${ucatRankingEntries.length}`);
