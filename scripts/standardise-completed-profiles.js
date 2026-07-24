#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  HISTORICAL_GUIDANCE_CAVEAT,
  buildDecisionTimeline,
  buildDecisionTransparency,
  buildEvidenceConfidence,
  presentResultCard
} = require('../assets/js/engine/result-card-presenter');
const { isProductionReady } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const writeMode = process.argv.includes('--write');

function loadCompletedProfileIds() {
  const index = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'index.json'), 'utf8'));
  return (index.universities || [])
    .filter(isProductionReady)
    .map((entry) => entry.id)
    .sort();
}

const completedProfileIds = loadCompletedProfileIds();

const standardReadinessFields = [
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

const capabilityFields = [
  'eligibility_ready',
  'interview_prediction_ready',
  'prediction_confidence',
  'result_card_ready'
];
const scopeFields = ['offer_prediction_scope'];

const productionTopLevelOrder = [
  'schema_version',
  'profile_id',
  'profile_status',
  'verification_status',
  'last_updated',
  'university',
  'course',
  'medical_school',
  'applicant_pools',
  'applies_to_group_ids',
  'stage_1_eligibility',
  'stage_2_interview_selection',
  'contextual_admissions',
  'ranking_pools',
  'quotas',
  'offer_selection',
  'historical_admissions',
  'sources',
  'validation',
  'engine_notes'
];

const researchTopLevelOrder = [
  'schema_version',
  'profile_id',
  'course_profile_id',
  'research_status',
  'file_purpose',
  'official_rules_source',
  'created_at',
  'last_updated',
  'research_scope',
  'evidence_classification_policy',
  'metadata',
  'readiness'
];

const resultCardTopLevelOrder = [
  'schema_version',
  'template_version',
  'result_id',
  'generated_at',
  'result_mode',
  'production_state',
  'course_identity',
  'applicant_context',
  'readiness',
  'student_summary',
  'eligibility',
  'stage_1_requirements',
  'stage_1',
  'stage_2_selection',
  'stage_2',
  'historical_context',
  'prediction',
  'offer_selection',
  'missing_data',
  'confidence',
  'evidence_confidence',
  'evidence',
  'display',
  'decision_timeline',
  'decision_transparency',
  'engine_notes'
];

const interviewBandTopLevelOrder = [
  'schema_version',
  'course_profile_id',
  'confidence',
  'evidence',
  'eligibility',
  'score_model',
  'guidance_pools'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function orderedObject(value, preferredOrder) {
  const ordered = {};

  for (const key of preferredOrder) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      ordered[key] = value[key];
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
      ordered[key] = entry;
    }
  }

  return ordered;
}

function canonicalReadiness(productionReadiness, existingReadiness = {}) {
  const standard = {};

  for (const field of standardReadinessFields) {
    if (productionReadiness[field] === undefined) {
      throw new Error(`Production readiness field ${field} is missing.`);
    }
    standard[field] = productionReadiness[field];
  }

  for (const field of capabilityFields) {
    if (productionReadiness[field] === undefined) {
      throw new Error(`Production capability field ${field} is missing.`);
    }
    standard[field] = productionReadiness[field];
  }

  const merged = {
    ...standard,
    ...existingReadiness
  };

  for (const key of Object.keys(merged)) {
    if (
      /offer_prediction|official_offer_formula|post_interview|offer_selection_evidence|offer_process_evidence|final_ranking|interview_score_inference/i.test(
        key
      )
    ) {
      delete merged[key];
    }
  }

  for (const field of [...standardReadinessFields, ...capabilityFields]) {
    merged[field] = standard[field];
  }
  merged.offer_prediction_scope = 'out_of_scope';
  removeOfferPredictionReadinessReferences(merged);

  if (
    merged.research_completeness_status !== undefined &&
    merged.research_completeness_status === merged.research_completeness
  ) {
    delete merged.research_completeness_status;
  }

  return orderedObject(merged, [
    ...standardReadinessFields,
    ...capabilityFields,
    ...scopeFields
  ]);
}

function removeOfferPredictionReadinessReferences(value) {
  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key !== 'offer_prediction_scope' && /offer[-_ ]prediction/i.test(key)) {
      delete value[key];
      continue;
    }

    if (Array.isArray(entry)) {
      value[key] = entry
        .map((item) => {
          if (typeof item === 'string') {
            return sanitiseResultCardString(item);
          }
          if (item && typeof item === 'object') {
            removeOfferPredictionReadinessReferences(item);
          }
          return item;
        })
        .filter((item) => item !== '');
      continue;
    }

    if (entry && typeof entry === 'object') {
      removeOfferPredictionReadinessReferences(entry);
      continue;
    }

    if (
      typeof entry === 'string' &&
      /(?:offer[-_ ]prediction|final[-_ ]offer prediction)/i.test(entry)
    ) {
      const sanitised = sanitiseResultCardString(entry);
      if (
        !sanitised ||
        /(?:offer[-_ ]prediction|final[-_ ]offer prediction)/i.test(sanitised)
      ) {
        delete value[key];
      } else {
        value[key] = sanitised;
      }
    }
  }
}

function normaliseProduction(profile) {
  const engineNotes = canonicalReadiness(profile.engine_notes, profile.engine_notes);

  delete engineNotes.final_offer_prediction;
  delete engineNotes.offer_prediction_blockers;
  delete engineNotes.offer_prediction_status;
  if (engineNotes.consumer_support_scope) {
    delete engineNotes.consumer_support_scope.offer_prediction_output;
  }

  return orderedObject(
    {
      ...profile,
      engine_notes: engineNotes
    },
    productionTopLevelOrder
  );
}

function normaliseResearch(research, production) {
  const existingReadiness = research.readiness || research.research_readiness_flags || {};
  const normalised = {
    ...research,
    file_purpose:
      research.file_purpose ||
      `Research and evidence profile for ${production.university.name} ${production.course.ucas_code}. This file does not replace the production admissions rules.`,
    official_rules_source:
      research.official_rules_source || `data/universities/${production.profile_id}.json`,
    created_at: Object.prototype.hasOwnProperty.call(research, 'created_at')
      ? research.created_at
      : null,
    research_scope: Object.prototype.hasOwnProperty.call(research, 'research_scope')
      ? research.research_scope
      : null,
    evidence_classification_policy: Object.prototype.hasOwnProperty.call(
      research,
      'evidence_classification_policy'
    )
      ? research.evidence_classification_policy
      : null,
    metadata: Object.prototype.hasOwnProperty.call(research, 'metadata')
      ? research.metadata
      : null,
    readiness: canonicalReadiness(production.engine_notes, existingReadiness)
  };

  delete normalised.research_readiness_flags;
  if (normalised.engine_notes) {
    delete normalised.engine_notes.offer_prediction_ready;
    delete normalised.engine_notes.offer_prediction_enabled;
    normalised.engine_notes.offer_prediction_scope = 'out_of_scope';
  }

  return orderedObject(normalised, researchTopLevelOrder);
}

function inferEligibility(card) {
  if (card.eligibility) {
    return card.eligibility;
  }

  const stageOne = card.stage_1 || {};
  const stageStatus = String(stageOne.eligibility_result || stageOne.status || 'unknown');
  const status = /pass|eligible/i.test(stageStatus) ? 'eligible' : 'unknown';

  return {
    status,
    summary: stageOne.summary || null,
    blocking_reasons: [],
    warnings: stageOne.warnings || [],
    source_ids: stageOne.source_ids || []
  };
}

function inferPrediction(card) {
  if (card.prediction) {
    return card.prediction;
  }

  const score = card.official_score || {};
  const positioning = card.interview_positioning || {};

  return {
    available: true,
    capability: 'interview',
    prediction_status: 'guidance_only_historical_positioning',
    prediction_type: 'historical_guidance_only',
    result_band: 'realistic',
    score: score.value ?? null,
    score_type: 'official_pre_interview_score',
    score_scale: {
      min: 0,
      max: score.max ?? null
    },
    band_basis:
      positioning.explanation ||
      'The official score is positioned against historical evidence as guidance only.',
    interview_probability: null,
    interview_likelihood: 'historically_competitive_guidance_only',
    confidence_level: 'low',
    deterministic: false,
    fixed_current_cutoff: false,
    missing_data_reasons: positioning.warnings || [],
    cannot_predict_explanation:
      'Historical positioning does not state or guarantee a current or future interview outcome.',
    source_ids: positioning.source_ids || []
  };
}

function inferConfidence(card, production) {
  const existing = card.confidence || {};
  const legacyStageConfidence =
    existing.stage_confidence ||
    (Object.keys(existing).length > 0
      ? Object.fromEntries(
          Object.entries(existing).filter(
            ([key]) => !['level', 'summary', 'source_ids'].includes(key)
          )
        )
      : {});

  return {
    ...existing,
    level: production.engine_notes.prediction_confidence,
    summary:
      existing.summary ||
      'Confidence reflects the supported eligibility scope and the quality of the historical interview evidence.',
    stage_confidence:
      Object.keys(legacyStageConfidence).length > 0
        ? legacyStageConfidence
        : {
            eligibility: production.engine_notes.prediction_confidence,
            interview_guidance: production.engine_notes.prediction_confidence
          },
    source_ids: existing.source_ids || card.readiness?.source_ids || []
  };
}

function inferDisplay(card, production, eligibility, prediction) {
  const presented = presentResultCard({
    eligibilityStatus: eligibility.status,
    interviewBand: prediction.result_band,
    manualReviewRequired: false
  });

  const existing = card.display || {};
  const studentSummary = card.student_summary || {};
  const display = { ...existing };

  if (
    !Object.prototype.hasOwnProperty.call(display, 'headline') &&
    Object.prototype.hasOwnProperty.call(studentSummary, 'headline')
  ) {
    display.headline = studentSummary.headline;
  }
  if (
    !Object.prototype.hasOwnProperty.call(display, 'subheadline') &&
    Object.prototype.hasOwnProperty.call(studentSummary, 'subheadline')
  ) {
    display.subheadline = studentSummary.subheadline;
  }
  if (!Object.prototype.hasOwnProperty.call(display, 'primary_user_facing_recommendation')) {
    display.primary_user_facing_recommendation = presented.primary_user_facing_recommendation;
  }
  if (!Object.prototype.hasOwnProperty.call(display, 'recommendation_display_state')) {
    display.recommendation_display_state = presented.recommendation_display_state;
  }
  if (!Object.prototype.hasOwnProperty.call(display, 'primary_explanation')) {
    display.primary_explanation =
      presented.primary_explanation || studentSummary.status_message || null;
  }
  if (!Object.prototype.hasOwnProperty.call(display, 'historical_guidance_caveat')) {
    display.historical_guidance_caveat =
      presented.historical_guidance_caveat || HISTORICAL_GUIDANCE_CAVEAT;
  }

  return display;
}

function normaliseResultCard(card, production) {
  const readiness = canonicalReadiness(production.engine_notes, card.readiness || {});
  const eligibility = inferEligibility(card);
  const prediction = inferPrediction(card);
  const confidence = inferConfidence(card, production);
  const display = inferDisplay(card, production, eligibility, prediction);
  const resultMode =
    card.result_mode || 'example_eligibility_and_historical_interview_guidance';

  const normalised = {
    ...card,
    result_mode: resultMode,
    readiness,
    eligibility,
    prediction,
    confidence,
    display
  };
  normalised.evidence_confidence = card.evidence_confidence || buildEvidenceConfidence(normalised);
  normalised.decision_timeline = card.decision_timeline || buildDecisionTimeline(normalised);
  normalised.decision_transparency = card.decision_transparency || buildDecisionTransparency(normalised);

  delete normalised.offer_selection;
  removeOfferPredictionFields(normalised);

  if (production.profile_id === 'nottingham-a100') {
    normalised.production_state = {
      ...normalised.production_state,
      profile_active: true,
      metadata_activation_enabled: true,
      result_card_output_enabled: true,
      note:
        'This validation example reflects the active scoped Nottingham output. Historical positioning remains guidance-only and non-executable.'
    };
  }

  return orderedObject(normalised, resultCardTopLevelOrder);
}

function normaliseInterviewBandConfig(config) {
  const normalised = { ...config };
  delete normalised.offer_prediction;
  return orderedObject(normalised, interviewBandTopLevelOrder);
}

function normaliseIndex(index, productionById) {
  const universities = index.universities.map((entry) => {
    const production = productionById.get(entry.id);

    if (!production) {
      return entry;
    }

    const readiness = canonicalReadiness(production.engine_notes, entry);
    const identityFields = {};
    const readinessFieldSet = new Set([
      ...standardReadinessFields,
      ...capabilityFields,
      ...scopeFields,
      'offer_prediction',
      'offer_prediction_ready',
      'offer_prediction_enabled',
      'offer_prediction_status'
    ]);

    for (const [key, value] of Object.entries(entry)) {
      if (!readinessFieldSet.has(key)) {
        identityFields[key] = value;
      }
    }

    return {
      ...identityFields,
      ...Object.fromEntries(
        [...capabilityFields, ...standardReadinessFields, ...scopeFields].map((field) => [
          field,
          readiness[field]
        ])
      )
    };
  });

  return {
    ...index,
    universities
  };
}

function removeOfferPredictionFields(value) {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const entry = value[index];
      if (
        typeof entry === 'string' &&
        /(?:offer[-_ ]prediction|final[-_ ]offer prediction)/i.test(entry)
      ) {
        const sanitised = sanitiseResultCardString(entry);
        if (sanitised) {
          value[index] = sanitised;
        } else {
          value.splice(index, 1);
        }
      } else if (
        entry &&
        typeof entry === 'object' &&
        /offer_prediction/i.test(String(entry.scenario_id || ''))
      ) {
        value.splice(index, 1);
      } else {
        removeOfferPredictionFields(entry);
      }
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const key of Object.keys(value)) {
    if (key === 'offer_prediction_scope') {
      continue;
    }
    if (
      /(?:offer_prediction|offerPrediction|show_offer_prediction|final_offer_basis)/i.test(
        key
      )
    ) {
      delete value[key];
      continue;
    }
    if (typeof value[key] === 'string') {
      value[key] = sanitiseResultCardString(value[key]);
      if (!value[key]) {
        delete value[key];
      }
    } else {
      removeOfferPredictionFields(value[key]);
    }
  }
}

function sanitiseResultCardString(value) {
  if (!containsPredictionScopeTerm(value)) {
    return value;
  }

  if (!/\s/.test(value)) {
    return value
      .replace(/_?candidate_offer_prediction_(?:unavailable|disabled|blocked)/gi, '')
      .replace(/_?offer_prediction_(?:unavailable|disabled|blocked|not_available)/gi, '')
      .replace(/_?final_offer_blocked/gi, '')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '');
  }

  if (isPredictionScopeDisclosure(value)) {
    return value;
  }

  const parts = value.match(/[^.!?]+[.!?]?|\s+/g) || [value];
  const sanitised = parts
    .map((part) => {
      if (/^\s+$/.test(part)) {
        return part;
      }
      if (
        containsPredictionScopeTerm(part) &&
        containsActionablePredictionClaim(part) &&
        !isPredictionScopeDisclosure(part)
      ) {
        return '';
      }
      return part;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitised;
}

function containsPredictionScopeTerm(value) {
  return /(?:offer[-_ ]prediction|final[-_ ]offer prediction|offer probability|offer likelihood|acceptance probability|waiting[-_ ]?list prediction|waitlist prediction|mmi (?:outcome )?prediction|post[-_ ]interview offer)/i.test(
    value
  );
}

function isPredictionScopeDisclosure(value) {
  return [
    /\b(?:no|not|never|without)\s+(?:an?\s+)?(?:final[-_ ]offer\s+)?offer[-_ ]prediction\b/i,
    /\b(?:do not|does not|cannot|can't|must not|should not)\b[^.?!]*(?:predict offers?|offer[-_ ]prediction|offer probability|waiting[-_ ]?list (?:prediction|position)|waitlist (?:prediction|position)|mmi (?:score|outcome )?prediction|post[-_ ]interview offer)/i,
    /\b(?:offer[-_ ]prediction|offer probability|waiting[-_ ]?list prediction|waitlist prediction|mmi (?:outcome )?prediction|post[-_ ]interview offer)\b[^.?!]*(?:out of (?:ApplySmart )?scope|outside\b|not provided|not available|unavailable|disabled|blocked|not enabled|not enable|not supported|not published)/i,
    /\b(?:post[-_ ]interview offer ranking|waiting[-_ ]?list policy)\b[^.?!]*(?:not published|unknown|unavailable|out of (?:ApplySmart )?scope)/i,
    /\b(?:guidance only|interview guidance|interview guidance context)\b[^.?!]*(?:not|rather than)\s+(?:an?\s+)?offer[-_ ]prediction\b/i,
    /\bnot\s+(?:an?\s+)?(?:offer[-_ ]prediction|interview guarantee)\b/i
  ].some((pattern) => pattern.test(value));
}

function containsActionablePredictionClaim(value) {
  return [
    /\b(?:offer|acceptance|waiting[-_ ]?list|waitlist|post[-_ ]interview offer)\b[^.?!]*(?:probability|likelihood|chance|outcome|prediction|forecast|estimate|score|rank|percentage|%)/i,
    /\b(?:probability|likelihood|chance|prediction|forecast|estimate|percentage|%)\b[^.?!]*(?:offer|acceptance|waiting[-_ ]?list|waitlist|post[-_ ]interview offer)\b/i
  ].some((pattern) => pattern.test(value));
}

function deepEqualIgnoringObjectOrder(left, right) {
  if (left === right) {
    return true;
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((entry, index) => deepEqualIgnoringObjectOrder(entry, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!deepEqualIgnoringObjectOrder(leftKeys, rightKeys)) {
    return false;
  }
  return leftKeys.every((key) => deepEqualIgnoringObjectOrder(left[key], right[key]));
}

function collectValueDiffs(current, proposed, pathParts = [], diffs = []) {
  if (deepEqualIgnoringObjectOrder(current, proposed)) {
    return diffs;
  }
  if (
    !current ||
    !proposed ||
    typeof current !== 'object' ||
    typeof proposed !== 'object' ||
    Array.isArray(current) !== Array.isArray(proposed)
  ) {
    diffs.push({
      path: pathParts.join('.') || '$',
      current,
      proposed
    });
    return diffs;
  }
  if (Array.isArray(current)) {
    const max = Math.max(current.length, proposed.length);
    for (let index = 0; index < max; index += 1) {
      collectValueDiffs(current[index], proposed[index], [...pathParts, index], diffs);
    }
    return diffs;
  }
  for (const key of [...new Set([...Object.keys(current), ...Object.keys(proposed)])].sort()) {
    collectValueDiffs(current[key], proposed[key], [...pathParts, key], diffs);
  }
  return diffs;
}

function classifyDiffs(relativePath, current, proposed, currentText, proposedText) {
  if (currentText === proposedText) {
    return [];
  }
  if (deepEqualIgnoringObjectOrder(current, proposed)) {
    return [currentText === serialise(current) ? 'ordering_only' : 'formatting_only'];
  }

  const classifications = new Set();
  const diffs = collectValueDiffs(current, proposed);
  for (const diff of diffs) {
    const currentString = typeof diff.current === 'string' ? diff.current : '';
    const proposedString = typeof diff.proposed === 'string' ? diff.proposed : '';
    if (
      (currentString && isPredictionScopeDisclosure(currentString) && diff.proposed === undefined) ||
      ['not an', 'Do not implement', 'No'].includes(proposedString.trim())
    ) {
      classifications.add('unsafe_text_transformation');
      continue;
    }
    if (
      /(?:stage_1_eligibility|stage_2_interview_selection|historical_admissions|applicant_pools|applies_to_group_ids|guidance_pools|score_model|profile_status|activation_ready|production_ready|eligibility_ready|interview_prediction_ready|result_card_ready|regression)/.test(
        diff.path
      )
    ) {
      classifications.add('potentially_behaviour_changing');
      continue;
    }
    if (/data\/index\.json/.test(relativePath) && /(?:last_updated|dataset_version)/.test(diff.path)) {
      classifications.add('generated_metadata');
      continue;
    }
    classifications.add('value_changing');
  }
  return [...classifications];
}

function serialise(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function processFile(relativePath, value, changedFiles) {
  const absolutePath = path.join(rootDir, relativePath);
  const next = serialise(value);
  const current = fs.readFileSync(absolutePath, 'utf8');

  if (current === next) {
    return;
  }

  const currentValue = JSON.parse(current);
  changedFiles.push({
    file: relativePath,
    classifications: classifyDiffs(relativePath, currentValue, value, current, next)
  });
  if (writeMode) {
    fs.writeFileSync(absolutePath, next);
  }
}

function buildStandardisationAudit() {
  const changedFiles = [];
  const productionById = new Map();

  for (const profileId of completedProfileIds) {
    const relativePath = `data/universities/${profileId}.json`;
    const production = normaliseProduction(readJson(relativePath));
    productionById.set(profileId, production);
    processFile(relativePath, production, changedFiles);
  }

  for (const profileId of completedProfileIds) {
    const production = productionById.get(profileId);
    const researchPath = `data/research/${profileId}-research.json`;
    const cardPath = `data/examples/${profileId}-result-card.example.json`;
    const configPath = `data/interview-band-configs/${profileId}.json`;

    processFile(
      researchPath,
      normaliseResearch(readJson(researchPath), production),
      changedFiles
    );
    processFile(
      cardPath,
      normaliseResultCard(readJson(cardPath), production),
      changedFiles
    );
    processFile(
      configPath,
      normaliseInterviewBandConfig(readJson(configPath)),
      changedFiles
    );
  }

  processFile(
    'data/index.json',
    normaliseIndex(readJson('data/index.json'), productionById),
    changedFiles
  );

  return changedFiles;
}

function isUnsafeAuditChange(change) {
  return change.classifications.some((classification) =>
    [
      'unsafe_text_transformation',
      'potentially_behaviour_changing',
      'value_changing',
      'generated_metadata'
    ].includes(classification)
  );
}

function printAudit(changedFiles) {
  const unsafeChanges = changedFiles.filter(isUnsafeAuditChange);
  const status =
    changedFiles.length === 0
      ? 'PASS'
      : unsafeChanges.length === 0
        ? 'SAFE_DRIFT'
        : 'UNSAFE_DRIFT';

  console.log(`Completed profile standardisation: ${writeMode ? 'WRITE' : status}`);
  console.log(`Files changed: ${changedFiles.length}`);
  for (const change of changedFiles) {
    console.log(`- ${change.file} [${change.classifications.join(',')}]`);
  }

  if (!writeMode && unsafeChanges.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  printAudit(buildStandardisationAudit());
}

module.exports = {
  buildStandardisationAudit,
  classifyDiffs,
  completedProfileIds,
  containsActionablePredictionClaim,
  containsPredictionScopeTerm,
  isPredictionScopeDisclosure,
  isUnsafeAuditChange,
  normaliseIndex,
  normaliseInterviewBandConfig,
  normaliseProduction,
  normaliseResearch,
  normaliseResultCard,
  sanitiseResultCardString,
  serialise
};
