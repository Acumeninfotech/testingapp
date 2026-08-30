const KMMS_CONTEXTUAL_EVALUATOR_ID = 'kmms_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalisedAnswerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'available'].includes(normaliseId(value));
}

function schoolContextualDataAvailable(evidence, normaliseId) {
  const school = evidence.school_education || {};
  return normalisedAnswerIsYes(
    school.kmms_school_contextualisation_data_available ||
      school.school_performance_contextualisation_data_available ||
      school.english_school_contextualisation_data_available,
    normaliseId
  );
}

function evaluateKmmsContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const identity = asObject(applicant.applicant_identity);
  const route = normaliseId(applicant.qualification_route || applicant.course_target?.qualification_route);
  const domicile = normaliseId(identity.domicile);
  const hasScottishQualifications = Boolean(applicant.scottish_profile) ||
    ['scottish', 'scottish_advanced_highers'].includes(route) ||
    domicile === 'scotland';
  const schoolDataAvailable = schoolContextualDataAvailable(evidence, normaliseId);
  const group = hasScottishQualifications || !schoolDataAvailable ? 'group_c' : 'group_a_or_b';

  const result = {
    status: 'not_contextual',
    reason: hasScottishQualifications
      ? 'kmms_scottish_or_no_reliable_school_data_group_c'
      : 'kmms_school_relative_contextualisation_not_binary_wp_marker',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      applicant_group: [
        {
          criterion_id: 'kmms_school_relative_contextualisation',
          label: 'KMMS applicant-group contextualisation',
          status: group === 'group_c' ? 'manual_review_boundary' : 'classified',
          evidence_path: 'contextual_profile.school_education.school_performance_contextualisation_data_available',
          applicant_group: group
        }
      ],
      unsupported_binary_markers: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      kmms_applicant_group: group,
      school_contextualisation_data_available: schoolDataAvailable,
      postcode_family_markers_used_for_lower_offer: false
    },
    selection_classification: {
      group,
      manual_review_required: group === 'group_c',
      reason: group === 'group_c'
        ? 'subjective_group_c_scoring_or_school_data_boundary'
        : 'school_relative_contextualisation_data_required'
    },
    source_ids: ['kmms_entry_requirements_2027']
  };

  if (group === 'group_c') {
    result.manual_review_reason = 'kmms_group_c_subjective_contextualisation';
  } else if (!schoolDataAvailable) {
    result.status = 'information_needed';
    result.reason = 'kmms_school_contextualisation_data_needed';
    result.manual_review_reason = 'kmms_school_contextualisation_data_needed';
  }

  return result;
}

module.exports = {
  KMMS_CONTEXTUAL_EVALUATOR_ID,
  evaluateKmmsContextualEligibility
};
