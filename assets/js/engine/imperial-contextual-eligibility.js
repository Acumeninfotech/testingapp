const IMPERIAL_CONTEXTUAL_EVALUATOR_ID = 'imperial_contextual_medicine_a100';
const IMPERIAL_CONTEXTUAL_GROUP_ID = 'imperial_contextual';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'eligible'].includes(normaliseId(value));
}

function quintileIs(value, expected, normaliseId) {
  const normalised = normaliseId(value);
  return normalised === `q${expected}` || normalised === `quintile_${expected}` || normalised === String(expected);
}

function quintileIn(value, expected, normaliseId) {
  return expected.some((quintile) => quintileIs(value, quintile, normaliseId));
}

function check(criterionId, label, evidencePath, status, actual = undefined, details = {}) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    status,
    actual,
    ...details
  };
}

function addMatched(results, criterionId, label, evidencePath, actual, details = {}) {
  const entry = check(criterionId, label, evidencePath, 'matched', actual, details);
  results.qualifying_criteria.push(entry);
  results.checks.qualifying_criteria.push(entry);
}

function addUnmatched(results, criterionId, label, evidencePath, actual, details = {}) {
  results.checks.qualifying_criteria.push(
    check(criterionId, label, evidencePath, 'not_matched', actual, details)
  );
}

function evaluateHomeFeeRequirement(applicant, results, normaliseId) {
  const feeStatus = applicant.applicant_identity?.fee_status;
  const fee = normaliseId(feeStatus);
  const homeFee = fee === 'home' || fee === 'home_fee' || fee.includes('home');
  const internationalFee = fee === 'international' || fee === 'international_fee' || fee.includes('international');
  results.checks.base_requirements.push(check(
    'home_fee_status',
    'Home-fee status',
    'applicant_identity.fee_status',
    homeFee && !internationalFee ? 'passed' : 'not_met',
    feeStatus
  ));
  if (!homeFee || internationalFee) {
    results.exclusions.push(check(
      'not_home_fee',
      'Imperial contextual admissions require Home fee status or an appropriate UK residential status',
      'applicant_identity.fee_status',
      'excluded',
      feeStatus
    ));
  }
}

function evaluateImperialContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const home = asObject(evidence.home_area_region);
  const postcodeMeasures = asObject(evidence.postcode_measures);
  const financial = asObject(evidence.financial_support);
  const school = asObject(evidence.school_education);
  const personal = asObject(evidence.personal_circumstances);
  const results = {
    status: 'not_contextual',
    is_contextual: false,
    matched_contextual_pathway: null,
    contextual_evidence: {},
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      base_requirements: [],
      qualifying_criteria: [],
      exclusions: []
    },
    activated_applicant_group_ids: []
  };

  evaluateHomeFeeRequirement(applicant, results, normaliseId);
  if (results.exclusions.length > 0) {
    return results;
  }

  const pathways = [
    {
      pathway: 'care_experienced',
      criterionId: 'care_experienced',
      label: 'Local-authority care experience',
      evidencePath: 'personal_circumstances.care_experienced',
      actual: personal.care_experienced,
      passed: answerIsYes(personal.care_experienced, normaliseId)
    },
    {
      pathway: 'care_leaver',
      criterionId: 'care_leaver',
      label: 'Care leaver',
      evidencePath: 'personal_circumstances.care_leaver',
      actual: personal.care_leaver,
      passed: answerIsYes(personal.care_leaver, normaliseId)
    },
    {
      pathway: 'imd_2019_quintile_1',
      criterionId: 'imd_2019_quintile_1',
      label: 'IMD 2019 quintile 1',
      evidencePath: 'home_area_region.imd_quintile',
      actual: postcodeMeasures.imd_quintile ?? home.imd_quintile,
      passed: quintileIs(postcodeMeasures.imd_quintile ?? home.imd_quintile, 1, normaliseId),
      details: { dataset_year: 2019 }
    },
    {
      pathway: 'free_school_meals',
      criterionId: 'free_school_meals',
      label: 'Free school meals',
      evidencePath: 'financial_support.free_school_meals',
      actual: financial.free_school_meals,
      passed: answerIsYes(financial.free_school_meals, normaliseId)
    }
  ];

  for (const pathway of pathways) {
    if (pathway.passed) {
      addMatched(
        results,
        pathway.criterionId,
        pathway.label,
        pathway.evidencePath,
        pathway.actual,
        pathway.details || {}
      );
    } else {
      addUnmatched(
        results,
        pathway.criterionId,
        pathway.label,
        pathway.evidencePath,
        pathway.actual,
        pathway.details || {}
      );
    }
  }

  const polar4Value = postcodeMeasures.polar4_quintile ?? home.polar4_quintile;
  const polar4Qualifies = quintileIn(polar4Value, [1, 2], normaliseId);
  const polar4Indicators = [
    {
      criterionId: 'first_generation_higher_education',
      label: 'First generation in immediate family to attend university',
      evidencePath: 'personal_circumstances.first_in_family_at_university',
      actual: personal.first_in_family_at_university,
      passed: answerIsYes(personal.first_in_family_at_university, normaliseId)
    },
    {
      criterionId: 'post16_performance_below_national_average',
      label: 'Post-16 school or college performance below national average',
      evidencePath: 'school_education.below_average_post16_school',
      actual: school.below_average_post16_school,
      passed: answerIsYes(school.below_average_post16_school, normaliseId)
    },
    {
      criterionId: 'school_high_fsm_proportion',
      label: 'School had a high proportion of pupils eligible for free school meals',
      evidencePath: 'school_education.high_free_school_meals_school',
      actual: school.high_free_school_meals_school,
      passed: answerIsYes(school.high_free_school_meals_school, normaliseId)
    }
  ];
  const matchedPolar4Indicators = polar4Indicators.filter((indicator) => indicator.passed);
  const polar4CombinationPassed = polar4Qualifies && matchedPolar4Indicators.length > 0;

  if (polar4CombinationPassed) {
    addMatched(
      results,
      'polar4_q1_q2_plus_indicator',
      'POLAR4 quintile 1 or 2 plus an Imperial additional indicator',
      'home_area_region.polar4_quintile',
      polar4Value,
      {
        matched_indicators: matchedPolar4Indicators.map((indicator) => indicator.criterionId)
      }
    );
  } else {
    addUnmatched(
      results,
      'polar4_q1_q2_plus_indicator',
      'POLAR4 quintile 1 or 2 plus an Imperial additional indicator',
      'home_area_region.polar4_quintile',
      polar4Value,
      {
        polar4_quintile_1_or_2: polar4Qualifies,
        matched_indicators: matchedPolar4Indicators.map((indicator) => indicator.criterionId)
      }
    );
  }

  const matched = results.qualifying_criteria[0] || null;
  if (matched) {
    results.status = 'contextual';
    results.is_contextual = true;
    results.matched_contextual_pathway =
      matched.criterion_id === 'polar4_q1_q2_plus_indicator'
        ? `polar4_plus_${matched.matched_indicators?.[0] || 'indicator'}`
        : matched.criterion_id;
    results.contextual_evidence = {
      criterion_id: matched.criterion_id,
      evidence_path: matched.evidence_path,
      actual: matched.actual,
      ...(matched.matched_indicators ? { matched_indicators: matched.matched_indicators } : {})
    };
    results.activated_applicant_group_ids = [
      IMPERIAL_CONTEXTUAL_GROUP_ID,
      'contextual',
      'widening_participation'
    ];
  }

  return results;
}

module.exports = {
  IMPERIAL_CONTEXTUAL_EVALUATOR_ID,
  IMPERIAL_CONTEXTUAL_GROUP_ID,
  evaluateImperialContextualEligibility
};
