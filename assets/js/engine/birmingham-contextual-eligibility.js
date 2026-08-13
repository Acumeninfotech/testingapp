const BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID = 'birmingham_contextual_medicine_a100';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  return normaliseId(value) === 'yes';
}

function check(criterionId, label, evidencePath, status, actual = undefined) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual
  };
}

function evaluateBirminghamContextualEligibility({ evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const result = {
    status: 'not_contextual',
    reason: 'birmingham_contextual_criteria_not_met',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      qualifying_criteria: []
    },
    activated_applicant_group_ids: []
  };

  const criteria = [
    {
      criterionId: 'free_school_meals',
      label: 'Free School Meals during secondary education',
      evidencePath: 'financial_support.free_school_meals',
      actual: financial.free_school_meals
    },
    {
      criterionId: 'local_authority_care',
      label: 'Local-authority care experience',
      evidencePath: 'personal_circumstances.care_experienced',
      actual: personal.care_experienced
    }
  ];

  for (const criterion of criteria) {
    const matched = answerIsYes(criterion.actual, normaliseId);
    const entry = check(
      criterion.criterionId,
      criterion.label,
      criterion.evidencePath,
      matched ? 'matched' : 'not_matched',
      criterion.actual
    );
    result.checks.qualifying_criteria.push(entry);
    if (matched) {
      result.qualifying_criteria.push(entry);
    }
  }

  const matched = result.qualifying_criteria[0] || null;
  if (matched) {
    result.status = 'contextual';
    result.reason = 'birmingham_contextual_criterion_met';
    result.is_contextual = true;
    result.matched_contextual_pathway = matched.criterion_id;
    result.matched_contextual_pathway_label = matched.label;
    result.activated_applicant_group_ids = ['contextual'];
  }

  return result;
}

module.exports = {
  BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID,
  evaluateBirminghamContextualEligibility
};
