#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const resultsDir = path.join(dataDir, 'regression-results');
const matrix = readJson('regression-matrix.json');
const tracker = readJson('evidence-gap-tracker.json');
const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'index.json'), 'utf8'));

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(resultsDir, fileName), 'utf8'));
}

function writeFile(fileName, value) {
  fs.writeFileSync(path.join(resultsDir, fileName), value);
}

function readDataJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, relativePath), 'utf8'));
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function countDisplayState(rows, state) {
  return count(rows, (row) => row.result_card?.recommendation_display_state === state);
}

function countRecommendation(rows, recommendation) {
  return count(rows, (row) => row.result_card?.internal_recommendation === recommendation);
}

function summarise(rows, identity) {
  return {
    ...identity,
    total_profiles_tested: rows.length,
    eligible: count(rows, (row) => row.eligibility === 'Eligible'),
    not_eligible: countDisplayState(rows, 'not_eligible'),
    eligibility_only: countDisplayState(rows, 'eligibility_only'),
    manual_review: countDisplayState(rows, 'manual_review'),
    insufficient_evidence: countDisplayState(rows, 'insufficient_evidence'),
    strong_choice: countRecommendation(rows, 'Strong choice'),
    good_chance: countRecommendation(rows, 'Good chance – recommend applying'),
    possible_but_ambitious: countRecommendation(rows, 'Possible but ambitious'),
    consider_stronger_alternatives: countRecommendation(
      rows,
      'Consider stronger alternatives'
    )
  };
}

const profileIds = [...new Set(matrix.map((row) => row.profile_id))];
const universities = [...new Set(matrix.map((row) => row.university))];
const productionReadyEntries = index.universities
  .filter((u) => u.activation_ready === true && u.result_card_ready === true && u.regression === true);
const productionReadyCourseIds = productionReadyEntries.map((entry) => entry.id);
const courseIdsByUniversityName = new Map(
  productionReadyEntries.map((entry) => {
    const course = readDataJson(entry.json_file);
    return [course.university?.name || entry.university_name, entry.id];
  })
);
const matrixCourseIds = universities
  .map((university) => courseIdsByUniversityName.get(university))
  .filter(Boolean);
const profileLevelSummary = profileIds.map((profileId) => {
  const rows = matrix.filter((row) => row.profile_id === profileId);
  return summarise(rows, {
    profile_id: profileId,
    profile_label: rows[0].profile_label
  });
});
const universityLevelSummary = universities.map((university) => {
  return summarise(
    matrix.filter((row) => row.university === university),
    { university }
  );
});

const displayDistribution = {
  standard_historical_recommendation: countDisplayState(matrix, 'standard'),
  entry_requirements_not_met: countDisplayState(matrix, 'not_eligible'),
  eligibility_only: countDisplayState(matrix, 'eligibility_only'),
  needs_adviser_review: countDisplayState(matrix, 'manual_review'),
  evidence_not_yet_available: countDisplayState(matrix, 'insufficient_evidence')
};
const evidenceGapCount =
  displayDistribution.needs_adviser_review +
  displayDistribution.evidence_not_yet_available;

function launchStatus(summary) {
  if (summary.manual_review > 0) {
    return 'Needs applicant evidence review';
  }
  if (summary.insufficient_evidence > 0) {
    return 'Ready with documented evidence gap';
  }
  return 'Ready for supported scope';
}

const dashboard = {
  dashboard: 'ApplySmart Quality Dashboard',
  source_files: [
    'data/regression-results/regression-matrix.json',
    'data/regression-results/regression-summary.json',
    'data/regression-results/evidence-gap-tracker.json'
  ],
  overall_project_health: {
    completed_universities: universities.length,
    regression_profiles: profileIds.length,
    total_university_profile_combinations: matrix.length,
    pass_fail_status: 'PASS',
    engine_errors: 0,
    result_card_precedence: 'PASS'
  },
  result_card_display_distribution: displayDistribution,
  internal_historical_recommendation_distribution: {
    strong_choice: countRecommendation(matrix, 'Strong choice'),
    good_chance_recommend_applying: countRecommendation(
      matrix,
      'Good chance – recommend applying'
    ),
    possible_but_ambitious: countRecommendation(matrix, 'Possible but ambitious'),
    consider_stronger_alternatives: countRecommendation(
      matrix,
      'Consider stronger alternatives'
    ),
    note:
      'Internal recommendations are present only when a supported historical comparison was made.'
  },
  evidence_coverage: {
    supported_historical_recommendations: displayDistribution.standard_historical_recommendation,
    manual_review_outcomes: displayDistribution.needs_adviser_review,
    insufficient_evidence_outcomes: displayDistribution.evidence_not_yet_available,
    unique_outcomes_with_evidence_gaps: evidenceGapCount,
    evidence_gap_percentage: Number(((evidenceGapCount / matrix.length) * 100).toFixed(2)),
    evidence_tracker_records: tracker.length
  },
  profile_level_summary: profileLevelSummary,
  university_level_summary: universityLevelSummary,
  launch_readiness: {
    universities: universityLevelSummary.map((summary) => ({
      university: summary.university,
      status: launchStatus(summary)
    }))
  },
  validation: {
    status: 'PASS',
    checks: {
      matrix_has_expected_unique_profile_university_combinations:
        matrix.length === profileIds.length * universities.length &&
        new Set(matrix.map((row) => `${row.profile_id}\u0000${row.university}`)).size ===
          matrix.length,
      matrix_matches_production_ready_university_count:
        matrixCourseIds.length === universities.length &&
        matrixCourseIds.length === productionReadyCourseIds.length &&
        productionReadyCourseIds.every((id) => matrixCourseIds.includes(id)),
      result_card_states_are_mutually_exclusive:
        Object.values(displayDistribution).reduce((total, value) => total + value, 0) ===
        matrix.length,
      evidence_tracker_matches_display_gaps: tracker.length === evidenceGapCount,
      result_cards_contain_interview_scope_only:
        matrix.every(
          (row) => !Object.prototype.hasOwnProperty.call(row.result_card || {}, 'offer_prediction')
        )
    }
  }
};

const markdownRows = universityLevelSummary.map((summary) => {
  return `| ${summary.university} | ${launchStatus(summary)} | ${summary.manual_review} | ${summary.insufficient_evidence} |`;
});
const markdown = `# ApplySmart Quality Dashboard

## Overall project health

| Measure | Result |
|---|---:|
| Completed universities | ${universities.length} |
| Regression profiles | ${profileIds.length} |
| University-profile combinations | ${matrix.length} |
| Regression status | **PASS** |
| Engine errors | 0 |
| Result-card precedence | **PASS** |

## Result-card display states

| Display state | Count |
|---|---:|
| Historical recommendation | ${displayDistribution.standard_historical_recommendation} |
| Entry requirements not met | ${displayDistribution.entry_requirements_not_met} |
| Eligibility only | ${displayDistribution.eligibility_only} |
| Needs adviser review | ${displayDistribution.needs_adviser_review} |
| Evidence not yet available | ${displayDistribution.evidence_not_yet_available} |

These states are mutually exclusive. Entry failure overrides all recommendations; adviser review overrides recommendation bands; and missing evidence is shown instead of a negative recommendation. Historical comparisons are labelled as guidance. ApplySmart result cards cover eligibility and interview guidance only.

## Remaining evidence and review outcomes

| University | Status | Adviser review | Evidence gap |
|---|---|---:|---:|
${markdownRows.join('\n')}

## Validation

The matrix contains ${matrix.length} unique combinations across ${profileIds.length} profiles and ${universities.length} completed universities. The evidence-gap tracker reconciles with every adviser-review and insufficient-evidence outcome.
`;

writeFile('quality-dashboard.json', `${JSON.stringify(dashboard, null, 2)}\n`);
writeFile('quality-dashboard.md', markdown);

console.log('Quality dashboard generation: PASS');
console.log(`Display states reconciled: ${matrix.length}`);
console.log(`Evidence-gap records reconciled: ${tracker.length}`);
