#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');
const {
  evaluateNottinghamA100
} = require('../assets/js/engine/nottingham-a100-consumer');
const {
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');
const {
  presentResultCard,
  CANONICAL_BAND_LABELS
} = require('../assets/js/engine/result-card-presenter');
const { isProductionReady } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const profilesDir = path.join(dataDir, 'regression-profiles');
const resultsDir = path.join(dataDir, 'regression-results');
const matrixPath = path.join(resultsDir, 'regression-matrix.json');
const summaryPath = path.join(resultsDir, 'regression-summary.json');
const indexPath = path.join(dataDir, 'index.json');

// Reuses the engine's own canonical band -> public label map (see
// assets/js/engine/result-card-presenter.js) so this regression matrix can't
// independently drift from the approved public wording.
const RECOMMENDATION_BY_BAND = {
  ...CANONICAL_BAND_LABELS,
  eligible_to_apply: 'Eligible to Apply',
  insufficient_evidence: null,
  not_eligible: null
};

const HISTORICAL_ASSESSMENT_BY_BAND = {
  very_strong_interview_potential: 'Well above historical interview range',
  interview_likely: 'Above historical interview range',
  realistic: 'Within historical interview range',
  ambitious: 'Slightly below historical interview range',
  high_risk: 'Well below historical interview range'
};

const NOTTINGHAM_BAND_BY_COMPARISON = {
  above: 'interview_likely',
  within: 'realistic',
  below: 'ambitious'
};

const STANDARD_READINESS_FIELDS = [
  'eligibility',
  'interview_prediction',
  'historical_guidance',
  'international_prediction',
  'contextual_logic',
  'result_card',
  'regression',
  'research_completeness',
  'manual_review_required'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveDataPath(relativePath, description) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error(`${description} path is missing.`);
  }

  const filePath = path.resolve(dataDir, relativePath);
  const relativeToData = path.relative(dataDir, filePath);

  if (relativeToData.startsWith('..') || path.isAbsolute(relativeToData)) {
    throw new Error(`${description} path must stay within data/: ${relativePath}`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} does not exist: ${relativePath}`);
  }

  return filePath;
}

function loadRegressionProfiles() {
  const fileNames = fs.readdirSync(profilesDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  if (fileNames.length === 0) {
    throw new Error('No JSON regression profiles were found.');
  }

  const seenProfileIds = new Set();
  return fileNames.map((fileName) => {
    const filePath = path.join(profilesDir, fileName);
    const applicant = readJson(filePath);
    const profileId = applicant.profile_id;
    const ucat = applicant.admissions_tests?.ucat;

    if (!profileId || !applicant.label) {
      throw new Error(`${fileName} must contain profile_id and label.`);
    }
    if (seenProfileIds.has(profileId)) {
      throw new Error(`Duplicate regression profile_id: ${profileId}`);
    }
    if (ucat?.score_scale !== 2700) {
      throw new Error(`${profileId} must use UCAT score_scale 2700.`);
    }
    if (!Number.isFinite(ucat.total_score)) {
      throw new Error(`${profileId} must contain a numeric UCAT total_score.`);
    }

    const subtests = ucat.subtests || {};
    const subtestTotal = [
      subtests.verbal_reasoning,
      subtests.decision_making,
      subtests.quantitative_reasoning
    ].reduce((total, score) => total + score, 0);

    if (![
      subtests.verbal_reasoning,
      subtests.decision_making,
      subtests.quantitative_reasoning
    ].every(Number.isFinite)) {
      throw new Error(`${profileId} must contain all three numeric UCAT cognitive subtests.`);
    }
    if (subtestTotal !== ucat.total_score) {
      throw new Error(
        `${profileId} UCAT total_score ${ucat.total_score} does not equal its subtest sum ${subtestTotal}.`
      );
    }

    seenProfileIds.add(profileId);
    return {
      file_name: fileName,
      applicant
    };
  });
}

function loadCompletedUniversities() {
  const index = readJson(indexPath);
  const entries = (index.universities || [])
    .filter(isProductionReady)
    .sort((left, right) => left.id.localeCompare(right.id));

  if (entries.length === 0) {
    throw new Error('No active production universities were found in data/index.json.');
  }

  return entries.map((entry) => {
    const isEligibilityOnly = entry.assessment_mode === 'eligibility_only' ||
      entry.prediction_methodology === 'eligibility_only';
    const readinessIsConsistent = isEligibilityOnly
      ? entry.eligibility_ready === true &&
        entry.eligibility_only_ready === true &&
        entry.interview_prediction_ready === false
      : entry.eligibility_ready === true &&
        entry.interview_prediction_ready === true;

    if (!readinessIsConsistent) {
      throw new Error(
        `${entry.id} is result-card ready but does not satisfy its assessment-mode readiness contract.`
      );
    }

    const coursePath = resolveDataPath(
      entry.json_file,
      `${entry.id} university production profile`
    );
    const configPath = resolveDataPath(
      entry.interview_band_config_file,
      `${entry.id} interview-band config`
    );
    const course = readJson(coursePath);
    const config = readJson(configPath);

    if (course.profile_id !== entry.id) {
      throw new Error(
        `${entry.id} index entry does not match course profile ${course.profile_id}.`
      );
    }
    if (config.course_profile_id !== entry.id) {
      throw new Error(
        `${entry.id} index entry does not match config profile ${config.course_profile_id}.`
      );
    }

    for (const field of STANDARD_READINESS_FIELDS) {
      if (entry[field] === undefined || course.engine_notes?.[field] === undefined) {
        throw new Error(`${entry.id} is missing standard readiness field ${field}.`);
      }
      if (entry[field] !== course.engine_notes[field]) {
        throw new Error(
          `${entry.id} readiness field ${field} differs between index and production profile.`
        );
      }
    }

    if (entry.activation_ready !== true) {
      throw new Error(`${entry.id} is completed but index activation_ready is not true.`);
    }
    if (entry.production_ready !== true) {
      throw new Error(`${entry.id} is readiness-bundle ready but index production_ready is not true.`);
    }
    if (entry.regression !== true) {
      throw new Error(`${entry.id} is readiness-bundle ready but index regression is not true.`);
    }

    return {
      id: entry.id,
      university: course.university?.name || entry.university_name,
      course,
      config
    };
  });
}

function displayEligibility(status) {
  return {
    eligible: 'Eligible',
    not_eligible: 'Not Eligible',
    manual_review: 'Manual review'
  }[status] || status;
}

function makeMatrixRow(
  applicant,
  university,
  eligibilityStatus,
  band,
  reason,
  manualReviewRequired = false,
  options = {}
) {
  const recommendation = options.recommendation ?? RECOMMENDATION_BY_BAND[band] ?? null;
  const resultCard = presentResultCard({
    eligibilityStatus,
    interviewBand: band,
    manualReviewRequired,
    transparencyContext: {
      course_identity: {
        profile_id: university.id
      },
      applicant_context: applicant,
      readiness: university.course.engine_notes,
      ...(options.transparencyContext || {})
    }
  });

  if (!Object.prototype.hasOwnProperty.call(RECOMMENDATION_BY_BAND, band)) {
    throw new Error(
      `${university.id} returned unsupported interview band ${String(band)} for ${applicant.profile_id}.`
    );
  }
  if (!reason) {
    throw new Error(
      `${university.id} returned no production reason for ${applicant.profile_id}.`
    );
  }

  return {
    profile_id: applicant.profile_id,
    profile_label: applicant.label,
    university: university.university,
    eligibility: displayEligibility(eligibilityStatus),
    interview_recommendation: recommendation,
    reason,
    historical_assessment: HISTORICAL_ASSESSMENT_BY_BAND[band]
      ? `Historical guidance: ${HISTORICAL_ASSESSMENT_BY_BAND[band]}`
      : null,
    result_card: resultCard
  };
}

function evaluateGenericUniversity(applicant, university) {
  const classification = classifyInterviewBand(
    university.course,
    university.config,
    applicant
  );
  const presentation = university.config.score_model?.presentation || {};
  const suppressScoreDetails = presentation.hide_selection_score_details === true ||
    presentation.hide_score_breakdown === true;
  const publicReason = suppressScoreDetails
    ? presentation.band_explanations?.[classification.canonical_interview_band] ||
      presentation.selection_summary ||
      classification.explanation
    : classification.explanation;
  const publicRecommendation = suppressScoreDetails
    ? presentation.band_recommendations?.[classification.canonical_interview_band]
    : undefined;

  return {
    row: makeMatrixRow(
      applicant,
      university,
      classification.eligibility.status,
      classification.canonical_interview_band,
      publicReason,
      classification.manual_review_required === true,
      {
        recommendation: publicRecommendation,
        transparencyContext: {
          applicant_group_ids: classification.applicant_group_ids || [],
          eligibility_checks: classification.eligibility.checks || [],
          eligibility_failures: classification.eligibility.failures || [],
          stage_1_eligibility: university.course.stage_1_eligibility || null,
          historical_admissions: university.course.historical_admissions || null,
          ranking: classification.ranking || null,
          band_metric: classification.band_metric || null,
          guidance_pool: classification.guidance_pool || null,
          score_model: university.config.score_model || null,
          guidance_pool_id: classification.guidance_pool_id || null,
          official_prediction: classification.official_prediction || null,
          warnings: classification.warnings || []
        }
      }
    ),
    production_warnings: classification.warnings || [],
    production_band: classification.canonical_interview_band
  };
}

function makeNottinghamReason(evaluation) {
  const eligibilityMessage = evaluation.eligibility.message;
  const guidance = evaluation.interview_band_guidance;

  if (guidance.historical_comparison_performed === true) {
    return (
      `${eligibilityMessage} ` +
      `Official score ${evaluation.official_score.value}/${evaluation.official_score.max}; ` +
      `${guidance.guidance_label} ` +
      `(${guidance.historical_typical_range.min}–${guidance.historical_typical_range.max}).`
    );
  }

  return [eligibilityMessage, guidance.message].filter(Boolean).join(' ');
}

function evaluateNottingham(applicant, university) {
  const evaluation = evaluateNottinghamA100(
    university.course,
    applicant,
    { interviewBandConfig: university.config }
  );
  const eligibilityStatus = evaluation.eligibility.status;
  const comparison = evaluation.interview_band_guidance.historical_comparison;
  const band = eligibilityStatus === 'not_eligible'
    ? 'not_eligible'
    : eligibilityStatus === 'eligible' && NOTTINGHAM_BAND_BY_COMPARISON[comparison]
      ? NOTTINGHAM_BAND_BY_COMPARISON[comparison]
      : 'insufficient_evidence';

  return {
    row: makeMatrixRow(
      applicant,
      university,
      eligibilityStatus,
      band,
      makeNottinghamReason(evaluation),
      eligibilityStatus === 'manual_review'
    ),
    production_warnings: evaluation.interview_band_guidance.messages || [],
    production_band: band
  };
}

function evaluateHullYork(applicant, university) {
  const evaluation = evaluateHullYorkA100(
    university.course,
    university.config,
    applicant
  );
  const eligibilityStatus = evaluation.eligibility.status;
  const band = evaluation.canonical_interview_band;

  return {
    row: makeMatrixRow(
      applicant,
      university,
      eligibilityStatus,
      band,
      evaluation.explanation,
      eligibilityStatus === 'manual_review'
    ),
    production_warnings: evaluation.warnings,
    production_band: band
  };
}

function evaluateCombination(applicant, university) {
  if (university.id === 'nottingham-a100') {
    return evaluateNottingham(applicant, university);
  }
  if (university.id === 'hull-york-a100') {
    return evaluateHullYork(applicant, university);
  }
  return evaluateGenericUniversity(applicant, university);
}

function buildSummary(profiles, matrix) {
  return profiles.map(({ applicant }) => {
    const rows = matrix.filter((row) => row.profile_id === applicant.profile_id);
    const recommendationCount = (label) => {
      return rows.filter((row) => row.interview_recommendation === label).length;
    };

    return {
      profile_id: applicant.profile_id,
      profile_label: applicant.label,
      total_universities_analysed: rows.length,
      eligible: rows.filter((row) => row.eligibility === 'Eligible').length,
      not_eligible: rows.filter((row) => row.eligibility === 'Not Eligible').length,
      very_strong_choice: recommendationCount('Very Strong Choice'),
      strong_choice: recommendationCount('Strong Choice'),
      realistic_choice: recommendationCount('Realistic Choice'),
      ambitious_choice: recommendationCount('Ambitious Choice'),
      high_risk: recommendationCount('High Risk'),
      eligible_to_apply: recommendationCount('Eligible to Apply'),
      needs_adviser_review: rows.filter((row) => {
        return row.result_card.recommendation_display_state === 'manual_review';
      }).length,
      evidence_not_yet_available: rows.filter((row) => {
        return row.result_card.recommendation_display_state === 'insufficient_evidence';
      }).length,
      entry_requirements_not_met: rows.filter((row) => {
        return row.result_card.recommendation_display_state === 'not_eligible';
      }).length
    };
  });
}

function validateResults(profiles, universities, matrix, summary) {
  const expectedCombinations = profiles.length * universities.length;

  if (matrix.length !== expectedCombinations) {
    throw new Error(
      `Expected ${expectedCombinations} matrix rows but produced ${matrix.length}.`
    );
  }
  if (summary.length !== profiles.length) {
    throw new Error(
      `Expected ${profiles.length} summary rows but produced ${summary.length}.`
    );
  }

  const rowKeys = new Set();
  for (const row of matrix) {
    const key = `${row.profile_id}\u0000${row.university}`;
    if (rowKeys.has(key)) {
      throw new Error(`Duplicate matrix row for ${row.profile_id} and ${row.university}.`);
    }
    if (!row.reason || !row.eligibility || !row.result_card?.primary_user_facing_recommendation) {
      throw new Error(`Incomplete matrix row for ${row.profile_id} and ${row.university}.`);
    }
    rowKeys.add(key);
  }

  for (const row of summary) {
    const recommendationTotal =
      row.very_strong_choice +
      row.strong_choice +
      row.realistic_choice +
      row.ambitious_choice +
      row.high_risk +
      row.eligible_to_apply +
      row.needs_adviser_review +
      row.evidence_not_yet_available +
      row.entry_requirements_not_met;

    if (row.total_universities_analysed !== universities.length) {
      throw new Error(
        `${row.profile_id} summary contains ${row.total_universities_analysed} universities; expected ${universities.length}.`
      );
    }
    if (recommendationTotal !== row.total_universities_analysed) {
      const profileRows = matrix.filter((entry) => entry.profile_id === row.profile_id);
      const labels = [...new Set(profileRows.map((entry) => entry.interview_recommendation || entry.result_card?.primary_user_facing_recommendation || 'unknown'))].sort();
      throw new Error(
        `${row.profile_id} recommendation counts do not equal its university total. Labels: ${labels.join(', ')}.`
      );
    }
  }
}

function run() {
  const profiles = loadRegressionProfiles();
  const universities = loadCompletedUniversities();
  const matrix = [];
  const productionWarnings = [];
  const productionBandCounts = {};

  for (const { applicant } of profiles) {
    for (const university of universities) {
      const evaluation = evaluateCombination(applicant, university);
      matrix.push(evaluation.row);
      productionBandCounts[evaluation.production_band] =
        (productionBandCounts[evaluation.production_band] || 0) + 1;

      for (const warning of evaluation.production_warnings) {
        productionWarnings.push({
          profile_id: applicant.profile_id,
          university: university.university,
          warning
        });
      }
    }
  }

  const summary = buildSummary(profiles, matrix);
  validateResults(profiles, universities, matrix, summary);

  fs.mkdirSync(resultsDir, { recursive: true });
  writeJson(matrixPath, matrix);
  writeJson(summaryPath, summary);

  const uniqueWarnings = [...new Set(
    productionWarnings.map((entry) => entry.warning)
  )].sort();
  const manualReviewCount = matrix.filter((row) => {
    return row.eligibility === 'Manual review';
  }).length;

  console.log('ApplySmart regression status: PASS');
  console.log(`Total profiles tested: ${profiles.length}`);
  console.log(`Completed universities tested: ${universities.length}`);
  console.log(`Total university-profile combinations: ${matrix.length}`);
  console.log(`Errors: 0`);
  console.log(
    `Production guidance warnings: ${productionWarnings.length} occurrences (${uniqueWarnings.length} unique)`
  );
  for (const warning of uniqueWarnings) {
    console.log(`- ${warning}`);
  }
  console.log(`Manual-review outcomes: ${manualReviewCount}`);
  console.log(
    `Insufficient-evidence outcomes: ${productionBandCounts.insufficient_evidence || 0}`
  );
  console.log(`Matrix: ${path.relative(rootDir, matrixPath)}`);
  console.log(`Summary: ${path.relative(rootDir, summaryPath)}`);

  return {
    profiles: profiles.length,
    universities: universities.length,
    combinations: matrix.length,
    productionWarnings,
    manualReviewCount,
    matrix,
    summary
  };
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error('ApplySmart regression status: FAIL');
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildSummary,
  loadCompletedUniversities,
  loadRegressionProfiles,
  run,
  validateResults
};
