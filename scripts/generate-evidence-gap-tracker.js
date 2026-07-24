#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const resultsDir = path.join(rootDir, 'data', 'regression-results');
const matrixPath = path.join(resultsDir, 'regression-matrix.json');
const trackerPath = path.join(resultsDir, 'evidence-gap-tracker.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function gapType(row) {
  const state = row.result_card?.recommendation_display_state;
  if (state === 'manual_review') {
    return 'manual_review';
  }
  if (state === 'insufficient_evidence') {
    return 'insufficient_evidence';
  }
  return null;
}

function reasonFor(type) {
  if (type === 'manual_review') {
    return 'Some required applicant information is missing or needs confirmation by an adviser.';
  }
  return 'Verified historical interview information is not available for this applicant group.';
}

function statusFor(type) {
  return type === 'manual_review'
    ? 'Needs adviser review'
    : 'Evidence not yet available';
}

function resolutionFor(type) {
  return type === 'manual_review'
    ? 'Confirm the applicant evidence or route-specific information required before ApplySmart can show interview guidance.'
    : 'Add verified evidence for this applicant route before showing a confident interview-guidance recommendation.';
}

const matrix = readJson(matrixPath);
const tracker = matrix
  .map((row) => {
    const type = gapType(row);
    if (!type) {
      return null;
    }
    return {
      profile_id: row.profile_id,
      profile_label: row.profile_label,
      university: row.university,
      applicant_pool:
        row.result_card?.transparency_context?.guidance_pool?.comparison_guidance?.label ||
        row.result_card?.transparency_context?.guidance_pool?.pool_id ||
        'The applicant group matching the supplied fee status and entry route',
      gap_type: type,
      reason: reasonFor(type),
      current_user_facing_status: statusFor(type),
      blocks_end_user_recommendation: true,
      suggested_resolution: resolutionFor(type),
      priority: type === 'manual_review' ? 'high' : 'medium'
    };
  })
  .filter(Boolean);

writeJson(trackerPath, tracker);

console.log('Evidence-gap tracker generation: PASS');
console.log(`Evidence-gap records reconciled: ${tracker.length}`);
