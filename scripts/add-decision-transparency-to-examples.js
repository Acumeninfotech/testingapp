#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  buildEvidenceConfidence,
  buildDecisionTimeline,
  buildDecisionTransparency
} = require('../assets/js/engine/result-card-presenter');

const examplesDir = path.resolve(__dirname, '..', 'data', 'examples');
const resultCardFiles = fs.readdirSync(examplesDir)
  .filter((fileName) => /-a100-result-card\.example\.json$/.test(fileName))
  .sort();

for (const fileName of resultCardFiles) {
  const filePath = path.join(examplesDir, fileName);
  const card = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  card.evidence_confidence = buildEvidenceConfidence(card);
  card.decision_timeline = buildDecisionTimeline(card);
  card.decision_transparency = buildDecisionTransparency(card);
  fs.writeFileSync(filePath, `${JSON.stringify(card, null, 2)}\n`);
}

console.log(`Decision timeline, transparency and evidence confidence added to ${resultCardFiles.length} result-card examples.`);
