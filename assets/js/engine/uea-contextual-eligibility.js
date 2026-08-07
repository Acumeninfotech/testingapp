const UEA_CONTEXTUAL_EVALUATOR_ID = 'uea_a100_contextual_screening_excluded';
const UEA_PREPARING_FOR_MEDICINE_GROUP_ID = 'uea_preparing_for_medicine_programme';
const UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID = 'uea_outreach_pathways';
const UEA_PREPARING_FOR_MEDICINE_PATHWAY_ID = 'uea_preparing_for_medicine_programme';
const UEA_PREPARING_FOR_MEDICINE_PATHWAY_LABEL = 'UEA Preparing for Medicine Programme';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function defaultUeaResult() {
  return {
    status: 'not_contextual',
    is_contextual: false,
    policy_decision: 'contextual_data_not_used_for_screening',
    applicable_to_screening: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: []
  };
}

function evaluateUeaContextualEligibility({ evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const result = defaultUeaResult();
  const programmes = asArray(evidence?.access_programmes?.other_programmes);
  const preparingForMedicineProgramme = programmes.find((entry) => {
    return normaliseId(entry?.programme_id) === UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID;
  });

  if (!preparingForMedicineProgramme) {
    return result;
  }

  const programmeStatus = normaliseId(
    preparingForMedicineProgramme.status || preparingForMedicineProgramme.programme_status
  );
  const criterion = {
    criterion_id: 'uea_preparing_for_medicine_programme',
    label: UEA_PREPARING_FOR_MEDICINE_PATHWAY_LABEL,
    evidence_path: 'access_programmes.other_programmes',
    actual: preparingForMedicineProgramme.programme_id,
    details: {
      programme_status: programmeStatus || null
    }
  };

  if (programmeStatus === 'completed') {
    return {
      ...result,
      status: 'contextual',
      is_contextual: true,
      policy_decision: 'programme_specific_guaranteed_interview_route',
      reason: 'uea_preparing_for_medicine_programme_confirmed',
      matched_contextual_pathway: UEA_PREPARING_FOR_MEDICINE_PATHWAY_ID,
      matched_contextual_pathway_label: UEA_PREPARING_FOR_MEDICINE_PATHWAY_LABEL,
      qualifying_criteria: [criterion],
      activated_applicant_group_ids: [UEA_PREPARING_FOR_MEDICINE_GROUP_ID]
    };
  }

  return {
    ...result,
    status: 'information_needed',
    reason: 'uea_preparing_for_medicine_engagement_confirmation_required',
    manual_review_reason: 'uea_preparing_for_medicine_engagement_confirmation_required',
    policy_decision: 'programme_participation_requires_engagement_confirmation',
    missing_information: [
      {
        ...criterion,
        reason: 'uea_preparing_for_medicine_engagement_confirmation_required'
      }
    ],
    provisional_activated_applicant_group_ids: [UEA_PREPARING_FOR_MEDICINE_GROUP_ID]
  };
}

module.exports = {
  UEA_CONTEXTUAL_EVALUATOR_ID,
  UEA_PREPARING_FOR_MEDICINE_GROUP_ID,
  UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID,
  evaluateUeaContextualEligibility
};
