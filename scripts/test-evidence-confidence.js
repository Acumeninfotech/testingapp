#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildEvidenceConfidence,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const { isProductionReady } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'data', 'examples');
const index = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'data', 'index.json'), 'utf8')
);
const completedIds = index.universities
  .filter(isProductionReady)
  .map((entry) => entry.id)
  .sort();
const allowedLevels = new Set(['High', 'Medium', 'Limited']);
const forbiddenTechnicalWording =
  /\b(regression|fixture|schema|classifier|json|config(?:uration)?|matrix|baseline)\b/i;
const forbiddenGuidanceWording =
  /\b(chance|probability|guaranteed|likely to get an interview|offer[- ]?(prediction|probability|likelihood|chance|outcome))\b/i;
const percentage = /\d+(?:\.\d+)?\s*%/;

assert.ok(completedIds.includes('buckingham-71a8'), 'Buckingham 71A8 must be included in the completed production set.');

for (const profileId of completedIds) {
  const card = JSON.parse(
    fs.readFileSync(
      path.join(examplesDir, `${profileId}-result-card.example.json`),
      'utf8'
    )
  );
  const evidenceConfidence = card.evidence_confidence;

  assert.ok(evidenceConfidence, `${profileId} must include evidence_confidence.`);
  assert.ok(
    allowedLevels.has(evidenceConfidence.level),
    `${profileId} must use an allowed evidence-confidence level.`
  );
  assert.ok(evidenceConfidence.summary, `${profileId} must include a confidence summary.`);
  assert.ok(
    evidenceConfidence.reasons.length > 0,
    `${profileId} must include evidence-confidence reasons.`
  );
  assert.deepStrictEqual(
    evidenceConfidence,
    buildEvidenceConfidence(card),
    `${profileId} evidence confidence must match the shared builder.`
  );
  assert.deepStrictEqual(
    card.decision_transparency.evidence_confidence,
    evidenceConfidence,
    `${profileId} decision transparency must include the same evidence confidence.`
  );

  const studentFacingText = JSON.stringify(evidenceConfidence);
  assert.doesNotMatch(
    studentFacingText,
    percentage,
    `${profileId} evidence confidence must not use percentages.`
  );
  assert.doesNotMatch(
    studentFacingText,
    forbiddenTechnicalWording,
    `${profileId} evidence confidence must not expose technical wording.`
  );
  assert.doesNotMatch(
    studentFacingText,
    forbiddenGuidanceWording,
    `${profileId} evidence confidence must not imply an interview or post-interview outcome.`
  );
}

const supportedContext = {
  readiness: {
    eligibility: true,
    interview_prediction: true,
    historical_guidance: true,
    regression: true,
    research_completeness: 'complete_for_supported_scope_with_documented_gaps',
    prediction_confidence: 'medium',
    contextual_logic: true,
    international_prediction: true,
    manual_review_required: false
  },
  applicant_context: {
    entry_route: 'standard_entry',
    fee_cohort: 'home',
    contextual: false,
    graduate: false
  }
};

const manualReview = presentResultCard({
  eligibilityStatus: 'manual_review',
  interviewBand: 'interview_likely',
  manualReviewRequired: true,
  transparencyContext: supportedContext
});
assert.strictEqual(manualReview.evidence_confidence.level, 'Limited');

const manualReviewWithFailedEligibility = presentResultCard({
  eligibilityStatus: 'not_eligible',
  interviewBand: 'not_eligible',
  manualReviewRequired: true,
  transparencyContext: supportedContext
});
assert.strictEqual(
  manualReviewWithFailedEligibility.evidence_confidence.level,
  'Limited',
  'A required review must limit evidence confidence even when eligibility takes display precedence.'
);

const insufficientEvidence = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'insufficient_evidence',
  transparencyContext: supportedContext
});
assert.strictEqual(insufficientEvidence.evidence_confidence.level, 'Limited');

const strongApplicant = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'interview_likely',
  transparencyContext: supportedContext
});
const weakApplicant = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'high_risk',
  transparencyContext: supportedContext
});
assert.deepStrictEqual(
  weakApplicant.evidence_confidence,
  strongApplicant.evidence_confidence,
  'Applicant strength must not determine evidence confidence.'
);

const unsupportedContextualRoute = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'realistic',
  transparencyContext: {
    ...supportedContext,
    readiness: {
      ...supportedContext.readiness,
      contextual_logic: false
    },
    applicant_context: {
      ...supportedContext.applicant_context,
      contextual: true
    }
  }
});
assert.strictEqual(unsupportedContextualRoute.evidence_confidence.level, 'Limited');

const expectedExampleLevels = {
  'aberdeen-a100': 'Medium',
  'aston-a100': 'Medium',
  'birmingham-a100': 'Medium',
  'buckingham-71a8': 'Medium',
  'cambridge-a100': 'Medium',
  'cardiff-a100': 'High',
  'dundee-a100': 'Medium',
  'edge-hill-a100': 'Medium',
  'edinburgh-a100': 'High',
  'glasgow-a100': 'Medium',
  'hull-york-a100': 'Medium',
  'lancashire-a100': 'Medium',
  'lancaster-a100': 'Medium',
  'liverpool-a100': 'High',
  'manchester-a100': 'Medium',
  'newcastle-a100': 'Medium',
  'nottingham-a100': 'Medium',
  'sheffield-a100': 'Medium',
  'st-andrews-a100': 'Medium',
  'sunderland-a100': 'Medium'
};

for (const [profileId, expectedLevel] of Object.entries(expectedExampleLevels)) {
  const card = JSON.parse(
    fs.readFileSync(
      path.join(examplesDir, `${profileId}-result-card.example.json`),
      'utf8'
    )
  );
  assert.strictEqual(
    card.evidence_confidence.level,
    expectedLevel,
    `${profileId} must use the evidence level supported by its current example route.`
  );
}

console.log('Evidence confidence regression: PASS');
console.log(`Completed university result cards checked: ${completedIds.length}`);
console.log('Levels, precedence, route gaps, applicant-strength independence and wording: PASS');
