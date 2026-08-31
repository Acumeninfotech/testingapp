const path = require('path');
const { loadIndex, isProductionReady, INDEX_PATH } = require('./universities');

const {
  classifyInterviewBand
} = require('../../assets/js/engine/interview-band-classifier');
const {
  evaluateNottinghamA100
} = require('../../assets/js/engine/nottingham-a100-consumer');
const {
  evaluateHullYorkA100
} = require('../../assets/js/engine/hull-york-a100-consumer');
const {
  presentResultCard,
  humanManualReviewReason,
  insufficientEvidenceReasonCodeFromWarnings
} = require('../../assets/js/engine/result-card-presenter');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');

const NOTTINGHAM_BAND_BY_COMPARISON = {
  above: 'interview_likely',
  within: 'realistic',
  below: 'ambitious'
};

class PredictionInputError extends Error {}

function readJson(filePath) {
  // eslint-disable-next-line global-require
  return JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
}

function resolveDataPath(relativePath) {
  return path.resolve(DATA_DIR, relativePath);
}

function courseRequiresUcat(university) {
  const ucat = university?.course?.stage_1_eligibility?.admissions_tests?.ucat;
  return ucat?.required === true;
}

function validateUcatProfile(studentProfile, { required }) {
  const ucat = studentProfile.admissions_tests?.ucat;
  if (!ucat) {
    if (required) {
      throw new PredictionInputError('studentProfile.admissions_tests.ucat is required.');
    }
    return;
  }

  if (ucat.taken === false && !required) {
    return;
  }

  if (ucat.taken === false && required) {
    throw new PredictionInputError('studentProfile.admissions_tests.ucat is required.');
  }

  // Same UCAT shape validation applied by scripts/run-regression-profiles.js
  // when a selected course needs UCAT, or when optional UCAT evidence is
  // supplied for a non-UCAT course.
  if (ucat.score_scale !== 2700) {
    throw new PredictionInputError('studentProfile UCAT score_scale must be 2700.');
  }
  if (!Number.isFinite(ucat.total_score)) {
    throw new PredictionInputError('studentProfile UCAT total_score must be numeric.');
  }

  const subtests = ucat.subtests || {};
  const values = [
    subtests.verbal_reasoning,
    subtests.decision_making,
    subtests.quantitative_reasoning
  ];
  if (!values.every(Number.isFinite)) {
    throw new PredictionInputError('studentProfile UCAT subtests must all be numeric.');
  }
  if (values.reduce((total, score) => total + score, 0) !== ucat.total_score) {
    throw new PredictionInputError('studentProfile UCAT total_score must equal the sum of its subtests.');
  }
}

function validateStudentProfile(studentProfile, { ucatRequired = true } = {}) {
  if (!studentProfile || typeof studentProfile !== 'object') {
    throw new PredictionInputError('studentProfile is required.');
  }

  validateUcatProfile(studentProfile, { required: ucatRequired });
}

// Resolves a universityId to its course/config JSON, rejecting anything
// that is not readiness-bundle ready (see READINESS_FLAGS in ./universities.js).
function loadReadyUniversity(universityId) {
  const index = loadIndex(INDEX_PATH);
  const entry = index.universities.find((u) => u.id === universityId);

  if (!entry) {
    throw new PredictionInputError(`Unknown universityId: ${universityId}`);
  }
  if (!isProductionReady(entry)) {
    throw new PredictionInputError(`universityId is not readiness-bundle ready: ${universityId}`);
  }

  const course = readJson(resolveDataPath(entry.json_file));
  const config = readJson(resolveDataPath(entry.interview_band_config_file));

  return {
    id: entry.id,
    university: course.university?.name || entry.university_name,
    course,
    config
  };
}

// Mirrors scripts/run-regression-profiles.js's evaluateCombination/makeMatrixRow
// exactly: this is the same engine dispatch + result-card assembly used by the
// regression suite, not a reimplementation of any admissions logic.
function evaluateCombination(studentProfile, university) {
  if (university.id === 'nottingham-a100') {
    return evaluateNottingham(studentProfile, university);
  }
  if (university.id === 'hull-york-a100') {
    return evaluateHullYork(studentProfile, university);
  }
  return evaluateGenericUniversity(studentProfile, university);
}

function evaluateGenericUniversity(studentProfile, university) {
  const classification = classifyInterviewBand(
    university.course,
    university.config,
    studentProfile
  );

  return makeResultCard(
    studentProfile,
    university,
    classification.eligibility.status,
    classification.canonical_interview_band,
    classification.manual_review_required === true,
    classification.eligibility,
    {
      ranking: classification.ranking,
      bandMetric: classification.band_metric,
      guidancePool: classification.guidance_pool,
      matchedBandRule: classification.matched_band_rule || null,
      scoreModel: university.config?.score_model,
      guidancePoolId: classification.guidance_pool_id,
      selectionRouteId: classification.selection_route_id,
      interviewOutcome: classification.interview_outcome,
      guaranteedInterviewExplanation: classification.guaranteed_interview_explanation,
      guaranteedInterviewNotice: classification.guaranteed_interview_notice,
      guaranteedInterviewPoolLabel: classification.guaranteed_interview_pool_label,
      guaranteedInterviewBadgeLabel: classification.guaranteed_interview_badge_label,
      officialPrediction: classification.official_prediction,
      warnings: classification.warnings,
      applicantGroupIds: classification.applicant_group_ids,
      insufficientEvidenceReasonCode: classification.insufficient_evidence_reason_code,
      missingInformation: classification.missing_information || null
    }
  );
}

function evaluateNottingham(studentProfile, university) {
  const evaluation = evaluateNottinghamA100(
    university.course,
    studentProfile,
    { interviewBandConfig: university.config }
  );
  const eligibilityStatus = evaluation.eligibility.status;
  const comparison = evaluation.interview_band_guidance.historical_comparison;
  const band = eligibilityStatus === 'not_eligible'
    ? 'not_eligible'
    : eligibilityStatus === 'eligible' && NOTTINGHAM_BAND_BY_COMPARISON[comparison]
      ? NOTTINGHAM_BAND_BY_COMPARISON[comparison]
      : 'insufficient_evidence';

  return makeResultCard(
    studentProfile,
    university,
    eligibilityStatus,
    band,
    eligibilityStatus === 'manual_review',
    evaluation.eligibility,
    {
      officialScore: evaluation.official_score,
      applicantGroupIds: evaluation.eligibility.applicant_group_ids,
      insufficientEvidenceReasonCode: evaluation.insufficient_evidence_reason_code || null,
      insufficientEvidenceReason: evaluation.insufficient_evidence_reason || null,
      missingInformation: evaluation.missing_information || null
    }
  );
}

function evaluateHullYork(studentProfile, university) {
  const evaluation = evaluateHullYorkA100(
    university.course,
    university.config,
    studentProfile
  );
  const eligibilityStatus = evaluation.eligibility.status;
  const band = evaluation.canonical_interview_band;

  return makeResultCard(
    studentProfile,
    university,
    eligibilityStatus,
    band,
    eligibilityStatus === 'manual_review',
    evaluation.eligibility,
    { estimatedSelectionScore: evaluation.estimated_selection_score, applicantGroupIds: evaluation.eligibility.applicant_group_ids }
  );
}

// eligibility carries the already-computed, generic checks/failures/manual_review_reasons
// from the eligibility evaluation (same {checks, failures, manual_review_reasons} shape
// across evaluateHardFilters, evaluateNottinghamA100, evaluateHullYorkA100) so the
// result-card presenter can show real per-university "why" text without duplicating
// admissions logic or hand-authoring prose per university.
function makeResultCard(studentProfile, university, eligibilityStatus, band, manualReviewRequired, eligibility, scoreContext = {}) {
  const resultCard = presentResultCard({
    eligibilityStatus,
    interviewBand: band,
    manualReviewRequired,
    manualReviewReason: humanManualReviewReason(eligibility?.manual_review_reasons),
    insufficientEvidenceReasonCode:
      scoreContext.insufficientEvidenceReasonCode ||
      insufficientEvidenceReasonCodeFromWarnings(scoreContext.warnings, {
        eligibilityStatus,
        guidancePoolId: scoreContext.guidancePoolId ?? null
      }) ||
      null,
    insufficientEvidenceReason: scoreContext.insufficientEvidenceReason || null,
    missingInformation: scoreContext.missingInformation || null,
    transparencyContext: {
      course_identity: {
        profile_id: university.id,
        university_name: university.university,
        course_name: university.course.course?.name || null,
        ucas_code: university.course.course?.ucas_code || null
      },
      applicant_context: studentProfile,
      // Real evaluated applicant-group facts (fee status, domicile,
      // contextual/graduate flags) from deriveApplicantGroupIds(), used to
      // build the actual applicant-pool label shown on the card - never the
      // static per-university guess that could mislabel a Home applicant as
      // International or vice versa.
      applicant_group_ids: scoreContext.applicantGroupIds || [],
      readiness: university.course.engine_notes,
      eligibility_checks: eligibility?.checks || [],
      eligibility_failures: eligibility?.failures || [],
      academic_pathway: eligibility?.academic_pathway || null,
      academic_pathway_id: eligibility?.academic_pathway_id ?? null,
      future_conditions: eligibility?.future_conditions || [],
      eligibility,
      stage_1_eligibility: university.course.stage_1_eligibility || null,
      stage_2_interview_selection: university.course.stage_2_interview_selection || null,
      contextual_admissions: university.course.contextual_admissions || null,
      historical_admissions: university.course.historical_admissions || null,
      fee_information: university.course.fee_information || null,
      selection_approach_display: university.course.selection_approach_display || null,
      // Already-computed engine score/ranking output (generic component_sum
      // ranking, the Nottingham consumer's official_score, or the Hull York
      // consumer's unofficial estimated_selection_score) so result cards can
      // show the applicant's real calculated score instead of static example
      // prose. Never recalculated here - just forwarded.
      ranking: scoreContext.ranking || null,
      band_metric: scoreContext.bandMetric || null,
      guidance_pool: scoreContext.guidancePool || null,
      matched_band_rule: scoreContext.matchedBandRule || null,
      score_model: scoreContext.scoreModel || null,
      missing_information: scoreContext.missingInformation || null,
      official_score: scoreContext.officialScore || null,
      estimated_selection_score: scoreContext.estimatedSelectionScore || null,
      // guidance_pool_id/interview_outcome/warnings are already computed by
      // classifyInterviewBand (e.g. Birmingham's guaranteed-interview
      // override, or route-specific warnings like
      // 'graduate_numerical_guidance_boundary_not_published') - forwarded
      // as-is so the presenter can show them without recomputing.
      guidance_pool_id: scoreContext.guidancePoolId || null,
      selection_route_id: scoreContext.selectionRouteId || null,
      interview_outcome: scoreContext.interviewOutcome || null,
      guaranteed_interview_explanation:
        scoreContext.guaranteedInterviewExplanation || null,
      guaranteed_interview_notice:
        scoreContext.guaranteedInterviewNotice || null,
      guaranteed_interview_pool_label:
        scoreContext.guaranteedInterviewPoolLabel || null,
      guaranteed_interview_badge_label:
        scoreContext.guaranteedInterviewBadgeLabel || null,
      official_prediction: scoreContext.officialPrediction || null,
      warnings: scoreContext.warnings || []
    }
  });

  return {
    universityId: university.id,
    university: university.university,
    result_card: sanitisePublicResultCard(resultCard)
  };
}

function sanitisePublicResultCard(resultCard) {
  const card = JSON.parse(JSON.stringify(resultCard));
  if (card.prediction?.result_band !== 'insufficient_evidence') {
    delete card.decision_transparency?.insufficient_evidence_reason_code;
  }
  if (card.decision_transparency && !Object.prototype.hasOwnProperty.call(card.decision_transparency, 'insufficient_evidence_reason')) {
    card.decision_transparency.insufficient_evidence_reason = null;
  }
  return card;
}

// Thin API entry point: validates input, resolves readiness-bundle-ready
// universities, and calls the existing engine per universityId. Contains
// no admissions/eligibility/interview-banding logic of its own.
function predict({ universityIds, studentProfile }) {
  if (!Array.isArray(universityIds) || universityIds.length === 0) {
    throw new PredictionInputError('universityIds must be a non-empty array.');
  }

  const universities = universityIds.map(loadReadyUniversity);
  validateStudentProfile(studentProfile, {
    ucatRequired: universities.some(courseRequiresUcat)
  });

  return universities.map((university) => evaluateCombination(studentProfile, university));
}

module.exports = { predict, PredictionInputError };
