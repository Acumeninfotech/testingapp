const EDGE_HILL_CONTEXTUAL_EVALUATOR_ID = 'edge_hill_contextual_medicine_a100';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed'].includes(normaliseId(value));
}

function completedWamProgramme(evidence, normaliseId) {
  return asArray(evidence.access_programmes?.other_programmes)
    .find((programme) => {
      const programmeId = normaliseId(programme.programme_id || programme.id || programme.name);
      const status = normaliseId(programme.status || programme.programme_status);
      return ['edge_hill_wam', 'edge_hill_widening_access_to_medicine', 'widening_access_to_medicine'].includes(programmeId) &&
        status === 'completed';
    }) || null;
}

function evaluateEdgeHillContextualEligibility({ evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const wam = completedWamProgramme(evidence, normaliseId);
  const result = {
    status: 'not_contextual',
    reason: 'edge_hill_a100_wp_criteria_not_deterministically_published',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      wam_programme: [],
      a100_wp_criteria: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      a100_academic_reduction_supported: false,
      ucat_threshold_extension_supported: false
    },
    source_ids: ['edge_hill_medicine_a100_2027', 'edge_hill_wam_information']
  };

  if (wam) {
    const entry = {
      criterion_id: 'edge_hill_wam_completed',
      label: 'Edge Hill Widening Access to Medicine completion',
      status: 'matched',
      evidence_path: 'contextual_profile.access_programmes.other_programmes',
      programme_id: wam.programme_id
    };
    result.status = 'contextual';
    result.reason = 'edge_hill_wam_threshold_extension_confirmed';
    result.is_contextual = true;
    result.matched_contextual_pathway = 'edge_hill_wam_threshold_extension';
    result.matched_contextual_pathway_label = 'Edge Hill WAM threshold extension';
    result.qualifying_criteria.push(entry);
    result.checks.wam_programme.push(entry);
    result.contextual_evidence.ucat_threshold_extension_supported = true;
    result.selection_adjustments = [
      {
        adjustment_id: 'edge_hill_ucat_threshold_extension',
        type: 'threshold_extension',
        amount: null,
        amount_published: false
      }
    ];
    result.activated_applicant_group_ids.push('widening_participation');
    return result;
  }

  const wpCriteriaNeeded = answerIsYes(
    evidence.profile?.access_programmes?.edge_hill_a100_wp_criteria_review_requested,
    normaliseId
  );
  if (wpCriteriaNeeded) {
    result.status = 'information_needed';
    result.reason = 'edge_hill_a100_wp_criteria_evidence_gap';
    result.manual_review_reason = 'edge_hill_a100_wp_criteria_evidence_gap';
    result.missing_information.push({
      criterion_id: 'edge_hill_a100_wp_criteria',
      label: 'Current A100-specific WP criteria',
      evidence_path: 'contextual_profile.access_programmes.edge_hill_a100_wp_criteria_review_requested',
      reason: 'current_a100_specific_criteria_not_enumerated_publicly'
    });
  }

  return result;
}

module.exports = {
  EDGE_HILL_CONTEXTUAL_EVALUATOR_ID,
  evaluateEdgeHillContextualEligibility
};
