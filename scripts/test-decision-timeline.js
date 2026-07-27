#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildDecisionTimeline,
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
const expectedTitles = [
  'Applicant details checked',
  'Eligibility assessed',
  'Selection model applied',
  'Historical guidance compared',
  'Interview recommendation produced'
];
const forbiddenTechnicalWording =
  /\b(regression|fixture|schema|json|config(?:uration)?|classifier|matrix|baseline)\b/i;
const forbiddenOfferPredictionWording =
  /\boffer[- ]?(prediction|probability|likelihood|chance|outcome)\b/i;
const expectedEvidenceLevels = {
  'aberdeen-a100': 'Medium',
  'anglia-ruskin-a100': 'Medium',
  'aston-a100': 'Medium',
  'birmingham-a100': 'Medium',
  'bristol-a100': 'Medium',
  'brunel-university-of-london-a100': 'Medium',
  'buckingham-71a8': 'Medium',
  'cambridge-a100': 'Medium',
  'cardiff-a100': 'High',
  'dundee-a100': 'Medium',
  'east-anglia-a100': 'Medium',
  'edge-hill-a100': 'Medium',
  'edinburgh-a100': 'High',
  'exeter-a100': 'Medium',
  'glasgow-a100': 'Medium',
  'hull-york-a100': 'Medium',
  'imperial-college-london-a100': 'Medium',
  'keele-a100': 'Medium',
  'kent-and-medway-a100': 'Medium',
  'king-s-college-london-a100': 'Medium',
  'lancashire-a100': 'Medium',
  'lancaster-a100': 'Medium',
  'leeds-a100': 'Medium',
  'leicester-a100': 'Medium',
  'lincoln-a100': 'Limited',
  'liverpool-a100': 'High',
  'manchester-a100': 'Medium',
  'newcastle-a100': 'Medium',
  'nottingham-a100': 'Medium',
  'oxford-a100': 'Medium',
  'plymouth-a100': 'Medium',
  'queen-s-belfast-a100': 'Medium',
  'queen-mary-a100': 'Medium',
  'sheffield-a100': 'Medium',
  'southampton-a100': 'Medium',
  'st-andrews-a100': 'Medium',
  'sunderland-a100': 'Medium',
  'ucl-a100': 'Medium'
};
const expectedRecommendations = {
  'aberdeen-a100': 'Good chance based on historical data',
  'anglia-ruskin-a100': 'Realistic choice',
  'aston-a100': 'Strong choice based on historical data',
  'birmingham-a100': 'Strong choice based on your selection score',
  'bristol-a100': 'Good chance based on historical data',
  'brunel-university-of-london-a100': 'Realistic choice based on your UCAT',
  'buckingham-71a8': 'Eligible to Apply',
  'cambridge-a100': 'Strong Choice',
  'cardiff-a100': 'Strong choice based on historical data',
  'dundee-a100': 'Good chance based on historical data',
  'east-anglia-a100': 'Realistic choice based on your UCAT',
  'edge-hill-a100': 'Good chance',
  'edinburgh-a100': 'Good chance based on historical data',
  'exeter-a100': 'Realistic choice based on your selection score',
  'glasgow-a100': 'Good chance based on historical data',
  'hull-york-a100': 'Strong choice based on an unofficial estimate',
  'imperial-college-london-a100': 'Good chance - recommend applying',
  'keele-a100': 'Good chance – recommend applying',
  'kent-and-medway-a100': 'Realistic Choice',
  'king-s-college-london-a100': 'Strong interview outlook',
  'lancashire-a100': 'Eligible to Apply',
  'lancaster-a100': 'Strong choice based on historical data',
  'leeds-a100': 'Strong Choice',
  'leicester-a100': 'Good chance – recommend applying',
  'lincoln-a100': 'Ambitious choice based on your selection score',
  'liverpool-a100': 'Strong choice based on historical data',
  'manchester-a100': 'Good chance based on historical data',
  'newcastle-a100': 'Strong choice based on your selection score',
  'nottingham-a100': 'Good chance based on historical data',
  'oxford-a100': 'Strong choice based on your selection score',
  'plymouth-a100': 'Strong choice based on ApplySmart historical-normalised estimate',
  'queen-s-belfast-a100': 'Strong',
  'queen-mary-a100': 'Strong choice',
  'sheffield-a100': 'Strong choice based on historical data',
  'southampton-a100': 'Strong choice based on your UCAT',
  'st-andrews-a100': 'Good chance based on historical data',
  'sunderland-a100': 'Realistic Choice',
  'ucl-a100': 'Realistic choice based on your UCAT'
};
const universitySelectionWording = {
  'aberdeen-a100': /Academic attainment and UCAT.*pre-interview score/i,
  'anglia-ruskin-a100': /Academic thresholds.*SJT filter.*adjusted-UCAT interview guidance/i,
  'aston-a100': /six selected GCSEs and the UCAT cognitive total/i,
  'birmingham-a100': /score-based interview guidance/i,
  'bristol-a100': /academic eligibility.*ranked by UCAT cognitive total.*separate Home and International pools/i,
  'brunel-university-of-london-a100': /Academic eligibility.*SJT Band 4 gate.*Brunel Home-pool UCAT ranking guidance.*No academic score/i,
  'buckingham-71a8': /Academic eligibility was checked.*not converted into an interview prediction/i,
  'cambridge-a100': /Published academic and UCAT requirements.*Cambridge-specific holistic interview guidance.*internal thresholds hidden/i,
  'cardiff-a100': /28-point score/i,
  'dundee-a100': /academic attainment and UCAT national-decile performance/i,
  'east-anglia-a100': /Academic eligibility.*UCAT-ranking guidance.*No academic score.*contextual A100 adjustment/i,
  'edge-hill-a100': /Edge Hill ranks eligible Home A100 applicants by total UCAT score after academic and SJT screening/i,
  'edinburgh-a100': /Academic, UCAT cognitive and SJT components/i,
  'exeter-a100': /official Exeter Score.*grade-profile.*UCAT national-decile.*uplifts/i,
  'glasgow-a100': /UCAT-based ranking/i,
  'hull-york-a100': /GCSE, UCAT decile and SJT components.*unofficial estimate/i,
  'imperial-college-london-a100': /academic eligibility.*UCAT cognitive total thresholds and ranking.*Academics above the minimum are not scored/i,
  'keele-a100': /Academic, UCAT and SJT gates.*UCAT-ranked International guidance.*Home \/25 guidance/i,
  'kent-and-medway-a100': /ApplySmart analysis.*not published an exact 2026 interview cut-off.*not an official university decision/i,
  'king-s-college-london-a100': /King's College London assesses applicants using academic eligibility together with UCAT performance, GCSE attainment, Situational Judgement Test performance and contextual information/i,
  'lancashire-a100': /measurable academic requirements.*UCAT guidance.*not converted into an interview prediction/i,
  'lancaster-a100': /academic requirements.*SJT filter.*UCAT ranking/i,
  'leeds-a100': /Published entry requirements.*academics and UCAT.*Leeds-specific historical Home guidance/i,
  'leicester-a100': /48-point GCSE score.*48-point UCAT score.*96-point pre-interview total/i,
  'lincoln-a100': /official pre-interview score.*out of 60.*provisional competitive benchmark/i,
  'liverpool-a100': /applicant pool and historical UCAT guidance/i,
  'manchester-a100': /SJT Band 1–2 gate.*UCAT ranking/i,
  'newcastle-a100': /academic score.*UCAT.*score/i,
  'nottingham-a100': /eight GCSEs, the UCAT cognitive sections and SJT/i,
  'oxford-a100': /university selection approach.*eligibility checks/i,
  'plymouth-a100': /historical-normalised UCAT guidance/i,
  'queen-s-belfast-a100': /GCSE points plus UCAT decile points.*interview-invitation prediction/i,
  'queen-mary-a100': /historical-normalised UCAT estimate.*published interview UCAT cut-offs.*rough context/i,
  'sheffield-a100': /academic eligibility.*UCAT minimum.*UCAT ranking/i,
  'southampton-a100': /academic eligibility.*UCAT-only ranking.*Southampton Home or International pool/i,
  'st-andrews-a100': /hurdles.*UCAT ranking/i,
  'sunderland-a100': /academic.*UCAT.*SJT gates.*Interview Selection Tool/i,
  'ucl-a100': /academic eligibility.*UCAT cognitive total.*Access UCL.*Home.*Overseas.*SJT.*tiebreaker/i
};

assert.ok(completedIds.includes('buckingham-71a8'), 'Buckingham 71A8 must be included in the completed production set.');

for (const profileId of completedIds) {
  const card = JSON.parse(
    fs.readFileSync(
      path.join(examplesDir, `${profileId}-result-card.example.json`),
      'utf8'
    )
  );
  const timeline = card.decision_timeline;

  assert.ok(Array.isArray(timeline), `${profileId} must include decision_timeline.`);
  assert.strictEqual(timeline.length, 5, `${profileId} must include exactly five timeline steps.`);
  assert.deepStrictEqual(
    timeline.map((entry) => entry.step),
    [1, 2, 3, 4, 5],
    `${profileId} timeline steps must be numbered 1–5.`
  );
  assert.deepStrictEqual(
    timeline.map((entry) => entry.title),
    expectedTitles,
    `${profileId} must use the standard timeline titles in order.`
  );
  assert.deepStrictEqual(
    timeline,
    buildDecisionTimeline(card),
    `${profileId} timeline must match the shared builder.`
  );
  if (card.recommendation_display_state === 'eligibility_only') {
    assert.match(
      timeline[3].summary,
      /not used.*eligibility-only result/i,
      `${profileId} must explain why historical interview comparison is not used.`
    );
  } else {
    if (profileId === 'king-s-college-london-a100') {
      assert.match(
        timeline[3].summary,
        /historically been invited to interview/i,
        `${profileId} must identify historical information as coming from previous cycles.`
      );
      assert.match(
        card.display?.trust_statement || card.trust_statement || '',
        /not a guarantee of interview/i,
        `${profileId} must state that the prediction is not a guarantee.`
      );
    } else {
      assert.match(
        timeline[3].summary,
        /previous admissions cycles/i,
        `${profileId} must identify historical information as coming from previous cycles.`
      );
      assert.match(
        timeline[3].summary,
        /not a guarantee of an interview|do not guarantee an interview/i,
        `${profileId} must state that historical guidance is not a guarantee.`
      );
    }
  }
  assert.match(
    timeline[2].summary,
    universitySelectionWording[profileId],
    `${profileId} must explain its implemented selection model in plain language.`
  );

  const studentFacingText = JSON.stringify(timeline);
  assert.doesNotMatch(
    studentFacingText,
    forbiddenTechnicalWording,
    `${profileId} timeline must not expose technical wording.`
  );
  assert.doesNotMatch(
    studentFacingText,
    forbiddenOfferPredictionWording,
    `${profileId} timeline must not include post-interview prediction wording.`
  );

  assert.strictEqual(
    card.evidence_confidence.level,
    expectedEvidenceLevels[profileId],
    `${profileId} evidence confidence must remain unchanged.`
  );
  assert.deepStrictEqual(
    card.evidence_confidence,
    buildEvidenceConfidence(card),
    `${profileId} timeline generation must not change evidence confidence.`
  );
  assert.strictEqual(
    card.display.primary_user_facing_recommendation,
    expectedRecommendations[profileId],
    `${profileId} recommendation must remain unchanged.`
  );
}

const notEligible = presentResultCard({
  eligibilityStatus: 'not_eligible',
  interviewBand: 'interview_likely',
  manualReviewRequired: true
}).decision_timeline;
assert.strictEqual(notEligible[1].status, 'Not eligible');
assert.strictEqual(notEligible[2].status, 'Not applied');
assert.strictEqual(notEligible[3].status, 'Not applied');
assert.strictEqual(notEligible[4].status, 'Not eligible');

const manualReview = presentResultCard({
  eligibilityStatus: 'manual_review',
  interviewBand: 'interview_likely',
  manualReviewRequired: true
}).decision_timeline;
assert.strictEqual(manualReview[1].status, 'Manual review');
assert.strictEqual(manualReview[2].status, 'Manual review');
assert.strictEqual(manualReview[3].status, 'Not applied');
assert.strictEqual(manualReview[4].status, 'Manual review');
assert.doesNotMatch(
  JSON.stringify(manualReview[4]),
  /Strong choice|Good chance|Possible but ambitious/
);

const insufficientEvidence = presentResultCard({
  eligibilityStatus: 'eligible',
  interviewBand: 'insufficient_evidence'
}).decision_timeline;
assert.strictEqual(insufficientEvidence[1].status, 'Eligible');
assert.strictEqual(insufficientEvidence[2].status, 'Insufficient evidence');
assert.strictEqual(insufficientEvidence[3].status, 'Insufficient evidence');
assert.strictEqual(insufficientEvidence[4].status, 'Insufficient evidence');
assert.doesNotMatch(
  JSON.stringify(insufficientEvidence[4]),
  /Strong choice|Good chance|Possible but ambitious/
);

const insufficientEligibilityEvidence = presentResultCard({
  eligibilityStatus: 'insufficient_evidence',
  interviewBand: 'interview_likely'
});
assert.strictEqual(
  insufficientEligibilityEvidence.decision_timeline[1].status,
  'Insufficient evidence'
);
assert.strictEqual(
  insufficientEligibilityEvidence.decision_timeline[4].status,
  'Insufficient evidence'
);
assert.strictEqual(
  insufficientEligibilityEvidence.recommendation_display_state,
  'insufficient_evidence'
);

console.log('Decision timeline regression: PASS');
console.log(`Completed university result cards checked: ${completedIds.length}`);
console.log('Structure, precedence, wording, confidence and recommendation stability: PASS');
