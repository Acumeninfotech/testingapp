const LEICESTER_CONTEXTUAL_EVALUATOR_ID = 'leicester_contextual_medicine_a100';
const LEICESTER_ACCESS_LEICESTER_GROUP_ID = 'leicester_contextual_access_leicester_medicine';
const LEICESTER_REALISING_OPPORTUNITIES_GROUP_ID = 'leicester_contextual_realising_opportunities';
const LEICESTER_SUTTON_TRUST_GROUP_ID = 'leicester_contextual_sutton_trust_pathways_to_medicine';
const LEICESTER_UKWPMED_2027_GROUP_ID = 'leicester_contextual_ukwpmed_2027';
const LEICESTER_IMD_INDICATOR_GROUP_ID = 'leicester_contextual_imd_plus_indicator';
const LEICESTER_GUARANTEED_INTERVIEW_GROUP_ID = 'leicester_contextual_guaranteed_interview';

const UCAT_THRESHOLD = 1780;
const UCAT_COMPARATOR = 'greater_than';

const MISSING_VALUES = new Set(['', null, undefined, 'unknown', 'not_sure', 'prefer_not_to_say']);
const ACCEPTED_A_LEVEL_SUBJECTS = new Set([
  'biology',
  'chemistry',
  'physics',
  'mathematics',
  'psychology'
]);

const GRADE_RANK = {
  U: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  'A*': 6
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isMissing(value) {
  return MISSING_VALUES.has(value);
}

function answerIsYes(value, normaliseId) {
  if (value === true) return true;
  return ['yes', 'true', 'confirmed', 'completed', 'eligible'].includes(normaliseId(value));
}

function answerIsNo(value, normaliseId) {
  if (value === false) return true;
  return ['no', 'false', 'none', 'not_applicable'].includes(normaliseId(value));
}

function normaliseGrade(value) {
  return String(value || '').trim().toUpperCase();
}

function gradeRank(value) {
  return GRADE_RANK[normaliseGrade(value)] ?? -1;
}

function sortGradesDescending(grades = []) {
  return [...grades].sort((left, right) => gradeRank(right) - gradeRank(left));
}

function gradeProfileMeets(grades = [], required = []) {
  if (!Array.isArray(required) || required.length === 0) {
    return false;
  }
  const actualSorted = sortGradesDescending(grades);
  const requiredSorted = sortGradesDescending(required);
  if (actualSorted.length < requiredSorted.length) {
    return false;
  }
  return requiredSorted.every((minimum, index) => gradeRank(actualSorted[index]) >= gradeRank(minimum));
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

function missing(criterionId, label, evidencePath, reason) {
  return {
    criterion_id: criterionId,
    label,
    evidence_path: evidencePath,
    reason
  };
}

function addMatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  const entry = check(criterionId, label, evidencePath, 'matched', actual, details);
  results.qualifying_criteria.push(entry);
  results.checks[bucket].push(entry);
}

function addUnmatched(results, bucket, criterionId, label, evidencePath, actual, details = {}) {
  results.checks[bucket].push(check(criterionId, label, evidencePath, 'not_matched', actual, details));
}

function addMissing(results, bucket, criterionId, label, evidencePath, reason) {
  const entry = missing(criterionId, label, evidencePath, reason);
  results.missing_information.push(entry);
  results.checks[bucket].push(entry);
}

function aLevelSubjects(applicant = {}) {
  return asArray(applicant.a_level_profile?.subjects);
}

function subjectGrades(subjects = [], field) {
  return subjects
    .map((subject) => subject?.[field])
    .filter((grade) => grade !== null && grade !== undefined && String(grade).trim() !== '');
}

function subjectIds(subjects = [], field) {
  return subjects
    .filter((subject) => subject?.[field] !== null && subject?.[field] !== undefined && String(subject?.[field]).trim() !== '')
    .map((subject) => String(subject.subject_id || '').trim().toLowerCase())
    .filter(Boolean);
}

function evaluateAcademicRequirement(applicant, routeAcademicRequirement) {
  const subjects = aLevelSubjects(applicant);
  const predictedGrades = subjectGrades(subjects, 'predicted_grade');
  const achievedGrades = subjectGrades(subjects, 'achieved_grade');

  const hasRequiredSubjectCombination = (() => {
    const ids = new Set([
      ...subjectIds(subjects, 'predicted_grade'),
      ...subjectIds(subjects, 'achieved_grade')
    ]);
    const hasChemistryOrBiology = ids.has('chemistry') || ids.has('biology');
    const acceptedSubjects = [...ids].filter((subjectId) => ACCEPTED_A_LEVEL_SUBJECTS.has(subjectId));
    return hasChemistryOrBiology && acceptedSubjects.length >= 2;
  })();

  const predictedAbb = gradeProfileMeets(predictedGrades, ['A', 'B', 'B']);
  const predictedAaa = gradeProfileMeets(predictedGrades, ['A', 'A', 'A']);
  const achievedAaa = gradeProfileMeets(achievedGrades, ['A', 'A', 'A']);

  const predictedComplete = predictedGrades.length >= 3;
  const achievedComplete = achievedGrades.length >= 3;
  const hasEvidence = predictedGrades.length > 0 || achievedGrades.length > 0;

  if (!hasEvidence) {
    return {
      status: 'unknown',
      reason: 'a_level_academic_evidence_missing',
      details: {
        predicted_complete: false,
        achieved_complete: false,
        predicted_profile_met: false,
        achieved_profile_met: false,
        subject_combination_met: hasRequiredSubjectCombination
      }
    };
  }

  const predictedPass = routeAcademicRequirement === 'aaa_predicted_or_achieved'
    ? predictedAaa
    : predictedAbb;
  const achievedPass = achievedAaa;
  const profilePass = (predictedComplete && predictedPass) || (achievedComplete && achievedPass);
  const pass = profilePass && hasRequiredSubjectCombination;

  return {
    status: pass ? 'pass' : 'fail',
    reason: pass
      ? null
      : (!predictedComplete && !achievedComplete)
        ? 'a_level_academic_evidence_incomplete'
        : 'a_level_academic_requirement_not_met',
    details: {
      predicted_complete: predictedComplete,
      achieved_complete: achievedComplete,
      predicted_profile_met: predictedPass,
      achieved_profile_met: achievedPass,
      subject_combination_met: hasRequiredSubjectCombination
    }
  };
}

function gcseSubjectMap(gcseProfile = {}) {
  const raw = gcseProfile.subjects;
  const fromSubjects = Array.isArray(raw)
    ? Object.fromEntries(
        raw
          .filter((entry) => entry?.subject_id)
          .map((entry) => [
            String(entry.subject_id).trim().toLowerCase(),
            entry.grade ?? entry.achieved_grade ?? entry.predicted_grade
          ])
      )
    : (raw && typeof raw === 'object' ? raw : {});
  const fromAdditional = Object.fromEntries(
    asArray(gcseProfile.additional_subjects)
      .filter((entry) => entry?.subject_id)
      .map((entry) => [String(entry.subject_id).trim().toLowerCase(), entry.grade])
  );
  return { ...fromSubjects, ...fromAdditional };
}

function evaluateGcseMinimum(applicant) {
  const gcse = asObject(applicant.gcse_profile);
  const subjects = gcseSubjectMap(gcse);
  const english = subjects.english_language;
  const maths = subjects.mathematics;
  const biology = subjects.biology;
  const chemistry = subjects.chemistry;
  const combinedScience = subjects.combined_science ?? subjects.double_science;

  const grade6OrAbove = (grade) => {
    const text = String(grade ?? '').trim();
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      return numeric >= 6;
    }
    return gradeRank(text) >= gradeRank('B');
  };

  const scienceMet = (() => {
    if (grade6OrAbove(biology) && grade6OrAbove(chemistry)) {
      return true;
    }
    return grade6OrAbove(combinedScience);
  })();
  const hasAnyGcseEvidence = [english, maths, biology, chemistry, combinedScience]
    .some((value) => !isMissing(value));

  if (!hasAnyGcseEvidence) {
    return {
      status: 'unknown',
      reason: 'gcse_minimum_evidence_missing',
      details: {}
    };
  }

  const pass = grade6OrAbove(english) && grade6OrAbove(maths) && scienceMet;
  return {
    status: pass ? 'pass' : 'fail',
    reason: pass ? null : 'gcse_minimum_requirements_not_met',
    details: {
      english_language: english,
      mathematics: maths,
      biology,
      chemistry,
      combined_science: combinedScience
    }
  };
}

function evaluateUcatThreshold(applicant) {
  const totalScore = Number(applicant?.admissions_tests?.ucat?.total_score);
  if (!Number.isFinite(totalScore)) {
    return {
      status: 'unknown',
      reason: 'ucat_total_score_required'
    };
  }
  const pass = UCAT_COMPARATOR === 'greater_than'
    ? totalScore > UCAT_THRESHOLD
    : totalScore >= UCAT_THRESHOLD;
  return {
    status: pass ? 'pass' : 'fail',
    reason: pass ? null : 'ucat_threshold_not_met',
    details: {
      total_score: totalScore,
      comparator: UCAT_COMPARATOR,
      threshold: UCAT_THRESHOLD
    }
  };
}

function evaluateSjtBand(applicant) {
  const sjtBand = Number(applicant?.admissions_tests?.ucat?.sjt_band);
  if (!Number.isFinite(sjtBand)) {
    return {
      status: 'unknown',
      reason: 'sjt_band_required'
    };
  }
  const pass = [1, 2, 3].includes(sjtBand);
  return {
    status: pass ? 'pass' : 'fail',
    reason: pass ? null : 'sjt_band_not_accepted',
    details: {
      sjt_band: sjtBand
    }
  };
}

function findProgramme(otherProgrammes, programmeId, normaliseId) {
  return asArray(otherProgrammes).find((programme) => {
    return normaliseId(programme?.programme_id) === normaliseId(programmeId);
  }) || null;
}

function evaluateAccessProgrammeRoute(evidence, route, normaliseId) {
  const access = asObject(evidence.access_programmes);
  const otherProgrammes = asArray(access.other_programmes);
  const programme = findProgramme(access.other_programmes, route.programme_id, normaliseId);
  if (programme) {
    const status = normaliseId(programme.status || programme.programme_status);
    if (['completed', 'confirmed', 'yes'].includes(status)) {
      return {
        status: 'pass',
        value: programme.programme_id,
        criterion: {
          criterion_id: route.criterion_id,
          label: route.criterion_label,
          evidence_path: 'access_programmes.other_programmes',
          actual: programme.programme_id,
          details: { programme_status: status }
        }
      };
    }
    if (['participating', 'offered', 'not_sure'].includes(status)) {
      return {
        status: 'unknown',
        reason: `${route.route_id}_programme_completion_confirmation_required`,
        value: programme.programme_id,
        criterion: {
          criterion_id: route.criterion_id,
          label: route.criterion_label,
          evidence_path: 'access_programmes.other_programmes'
        }
      };
    }
    return {
      status: 'fail',
      value: programme.programme_id,
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'access_programmes.other_programmes',
        actual: programme.programme_id,
        details: { programme_status: status }
      }
    };
  }

  const hasSpecificProgrammeRecords = otherProgrammes.some((record) => {
    const programmeId = normaliseId(record?.programme_id);
    return Boolean(programmeId && programmeId !== 'other_access_wp_programme');
  });
  if (hasSpecificProgrammeRecords) {
    return {
      status: 'fail',
      value: null,
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'access_programmes.other_programmes',
        actual: null
      }
    };
  }

  if (access.participation_status === 'yes' || access.other_programme_name) {
    return {
      status: 'unknown',
      reason: `${route.route_id}_specific_programme_confirmation_required`,
      value: null,
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'access_programmes.other_programmes'
      }
    };
  }

  return {
    status: 'fail',
    value: null,
    criterion: {
      criterion_id: route.criterion_id,
      label: route.criterion_label,
      evidence_path: 'access_programmes.other_programmes',
      actual: null
    }
  };
}

function evaluateStructuredUkwpmedRoute(evidence, route, normaliseId) {
  const record = asObject(asObject(evidence.access_programmes).ukwpmed);
  const hasRecord = Object.keys(record).length > 0;
  const optedIn = answerIsYes(record.status, normaliseId);
  if (!optedIn) {
    return {
      status: !hasRecord || answerIsNo(record.status, normaliseId) ? 'fail' : 'unknown',
      reason: `${route.route_id}_ukwpmed_confirmation_required`,
      value: record.programme_id || null,
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'access_programmes.ukwpmed',
        actual: record.programme_id || null
      }
    };
  }

  const programmeId = normaliseId(record.programme_id);
  const provider = normaliseId(record.provider_university_id);
  const status = normaliseId(record.programme_status);
  const exactProgramme = programmeId === normaliseId(route.programme_id);
  const exactProvider = provider === normaliseId(route.provider_university_id);
  const completed = ['completed', 'confirmed'].includes(status);
  const completionYear = Number(record.completion_year);
  const completionYearRequired = Array.isArray(route.completion_years);
  const completionYearKnown = Number.isInteger(completionYear);
  const completionYearAccepted = !completionYearRequired || route.completion_years.includes(completionYear);

  if (exactProgramme && exactProvider && completed && completionYearAccepted) {
    return {
      status: 'pass',
      value: record.programme_id,
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'access_programmes.ukwpmed',
        actual: record.programme_id,
        details: { programme_status: status, provider_university_id: provider, completion_year: completionYearKnown ? completionYear : null }
      }
    };
  }

  const incomplete = !programmeId || !provider || !status ||
    (completionYearRequired && !completionYearKnown) ||
    ['participating', 'offered', 'not_sure'].includes(status);
  return {
    status: incomplete ? 'unknown' : 'fail',
    reason: incomplete ? `${route.route_id}_programme_completion_or_provider_required` : null,
    value: record.programme_id || null,
    criterion: {
      criterion_id: route.criterion_id,
      label: route.criterion_label,
      evidence_path: 'access_programmes.ukwpmed',
      actual: record.programme_id || null,
      details: { programme_status: status || null, provider_university_id: provider || null, completion_year: completionYearKnown ? completionYear : null }
    }
  };
}

function evaluateRestrictedUkwpmedAcademic(applicant, normaliseId) {
  const applicationYear = Number(applicant.application_year ?? applicant.course_target?.application_year);
  const identity = asObject(applicant.applicant_identity);
  const feeStatus = normaliseId(identity.fee_status);
  const firstGapYear = identity.first_gap_year;
  const subjects = aLevelSubjects(applicant);
  const achieved = subjects.filter((subject) => !isMissing(subject?.achieved_grade));
  const achievedGrades = achieved.map((subject) => subject.achieved_grade);
  const requiredScienceAtA = achieved.some((subject) =>
    ['chemistry', 'biology'].includes(normaliseId(subject.subject_id)) && gradeRank(subject.achieved_grade) >= gradeRank('A')
  );
  const firstSitting = achieved.length >= 3 && achieved.every((subject) => normaliseId(subject.sitting_status) === 'first_sitting');
  const noResits = normaliseId(applicant.a_level_profile?.sitting_status) !== 'resit' && firstSitting;
  const home = ['home', 'home_fee', 'uk', 'united_kingdom'].includes(feeStatus);
  const knownFirstGapYear = firstGapYear === true || firstGapYear === false || ['yes', 'no'].includes(normaliseId(firstGapYear));
  const isFirstGapYear = firstGapYear === true || normaliseId(firstGapYear) === 'yes';

  if (applicationYear !== 2027 || !home || achieved.length < 3) {
    return {
      status: 'fail',
      reason: 'leicester_ukwpmed_2027_academic_or_scope_requirement_not_met',
      details: { application_year: applicationYear, home_fee: home, achieved_grade_count: achieved.length }
    };
  }
  if (!knownFirstGapYear) {
    return { status: 'unknown', reason: 'leicester_ukwpmed_2027_first_gap_year_confirmation_required', details: {} };
  }
  const pass = applicationYear === 2027 && home && isFirstGapYear &&
    achieved.length >= 3 && gradeProfileMeets(achievedGrades, ['A', 'B', 'B']) && requiredScienceAtA && noResits;
  return {
    status: pass ? 'pass' : 'fail',
    reason: pass ? null : 'leicester_ukwpmed_2027_academic_or_scope_requirement_not_met',
    details: { application_year: applicationYear, home_fee: home, first_gap_year: isFirstGapYear, required_science_at_a: requiredScienceAtA, first_sitting_no_resits: noResits }
  };
}

function quintileIsQ1(value, normaliseId) {
  const id = normaliseId(value);
  return id === 'q1' || id === '1' || id === 'quintile_1';
}

function evaluateImdPlusIndicatorRoute(evidence, route, normaliseId) {
  const postcode = asObject(evidence.postcode_measures);
  const financial = asObject(evidence.financial_support);
  const personal = asObject(evidence.personal_circumstances);
  const imdQuintile = postcode.imd_quintile ?? asObject(evidence.home_area_region).imd_quintile;
  const imdQ1 = quintileIsQ1(imdQuintile, normaliseId);
  const imdUnknown = isMissing(imdQuintile) || normaliseId(imdQuintile) === 'unknown';

  const indicators = [
    {
      criterion_id: 'ucat_bursary_recipient',
      label: 'UCAT bursary',
      evidence_path: 'financial_support.ucat_bursary_recipient',
      actual: financial.ucat_bursary_recipient
    },
    {
      criterion_id: 'ema_or_16_19_bursary',
      label: 'EMA or 16-19 bursary',
      evidence_path: 'financial_support.ema_or_16_19_bursary',
      actual: financial.ema_or_16_19_bursary
    },
    {
      criterion_id: 'free_school_meals',
      label: 'Free school meals',
      evidence_path: 'financial_support.free_school_meals',
      actual: financial.free_school_meals
    },
    {
      criterion_id: 'care_over_three_months',
      label: 'Looked after in local-authority care for more than three months',
      evidence_path: 'personal_circumstances.care_over_three_months',
      actual: personal.care_over_three_months
    }
  ];

  const matchedIndicators = indicators.filter((indicator) => answerIsYes(indicator.actual, normaliseId));
  const unknownIndicators = indicators.filter((indicator) => {
    return !answerIsYes(indicator.actual, normaliseId) &&
      !answerIsNo(indicator.actual, normaliseId);
  });

  const hasMatchedIndicator = matchedIndicators.length > 0;
  const indicatorUnknown = !hasMatchedIndicator && unknownIndicators.length > 0;

  if (imdQ1 && hasMatchedIndicator) {
    return {
      status: 'pass',
      value: {
        imd_quintile: imdQuintile,
        matched_indicators: matchedIndicators.map((indicator) => indicator.criterion_id)
      },
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'home_area_region.imd_quintile',
        actual: imdQuintile,
        details: {
          dataset_year: 2019,
          matched_indicators: matchedIndicators.map((indicator) => indicator.criterion_id)
        }
      },
      matchedIndicators
    };
  }

  if ((imdQ1 && indicatorUnknown) || (imdUnknown && hasMatchedIndicator)) {
    return {
      status: 'unknown',
      reason: `${route.route_id}_imd_or_indicator_confirmation_required`,
      value: {
        imd_quintile: imdQuintile,
        matched_indicators: matchedIndicators.map((indicator) => indicator.criterion_id)
      },
      criterion: {
        criterion_id: route.criterion_id,
        label: route.criterion_label,
        evidence_path: 'home_area_region.imd_quintile'
      },
      matchedIndicators,
      unknownIndicators
    };
  }

  return {
    status: 'fail',
    value: {
      imd_quintile: imdQuintile,
      matched_indicators: matchedIndicators.map((indicator) => indicator.criterion_id)
    },
    criterion: {
      criterion_id: route.criterion_id,
      label: route.criterion_label,
      evidence_path: 'home_area_region.imd_quintile',
      actual: imdQuintile,
      details: {
        dataset_year: 2019,
        matched_indicators: matchedIndicators.map((indicator) => indicator.criterion_id)
      }
    },
    matchedIndicators
  };
}

function evaluateRoute(route, applicant, evidence, normaliseId) {
  const routeEvidence = route.type === 'ukwpmed'
    ? evaluateStructuredUkwpmedRoute(evidence, route, normaliseId)
    : route.type === 'programme'
      ? evaluateAccessProgrammeRoute(evidence, route, normaliseId)
      : evaluateImdPlusIndicatorRoute(evidence, route, normaliseId);
  const academic = route.academic_requirement === 'restricted_ukwpmed_2027'
    ? evaluateRestrictedUkwpmedAcademic(applicant, normaliseId)
    : evaluateAcademicRequirement(applicant, route.academic_requirement);
  const gcse = evaluateGcseMinimum(applicant);
  const ucat = evaluateUcatThreshold(applicant);
  const sjt = evaluateSjtBand(applicant);

  const checks = [routeEvidence, academic, gcse, ucat, sjt];
  const hasUnknown = checks.some((entry) => entry.status === 'unknown');
  const hasFail = checks.some((entry) => entry.status === 'fail');
  const passed = checks.every((entry) => entry.status === 'pass');

  return {
    route,
    routeEvidence,
    academic,
    gcse,
    ucat,
    sjt,
    status: passed ? 'pass' : hasFail ? 'fail' : 'unknown',
    couldStillApply: !hasFail && hasUnknown && routeEvidence.status !== 'fail'
  };
}

function applyRouteEvidenceToResults(results, routeResult, normaliseId) {
  const { route, routeEvidence, academic, gcse, ucat, sjt } = routeResult;
  const bucket = route.bucket;

  if (routeEvidence.status === 'pass') {
    addMatched(
      results,
      bucket,
      routeEvidence.criterion.criterion_id,
      routeEvidence.criterion.label,
      routeEvidence.criterion.evidence_path,
      routeEvidence.criterion.actual ?? routeEvidence.value,
      routeEvidence.criterion.details || {}
    );
    if (routeEvidence.matchedIndicators) {
      for (const indicator of routeEvidence.matchedIndicators) {
        addMatched(
          results,
          bucket,
          indicator.criterion_id,
          indicator.label,
          indicator.evidence_path,
          indicator.actual
        );
      }
    }
  } else if (routeEvidence.status === 'unknown') {
    addMissing(
      results,
      bucket,
      routeEvidence.criterion.criterion_id,
      routeEvidence.criterion.label,
      routeEvidence.criterion.evidence_path,
      routeEvidence.reason
    );
  } else {
    addUnmatched(
      results,
      bucket,
      routeEvidence.criterion.criterion_id,
      routeEvidence.criterion.label,
      routeEvidence.criterion.evidence_path,
      routeEvidence.criterion.actual ?? routeEvidence.value,
      routeEvidence.criterion.details || {}
    );
  }

  const addGate = (gate, id, label, path) => {
    if (gate.status === 'pass') {
      addMatched(results, bucket, id, label, path, true, gate.details || {});
    } else if (gate.status === 'unknown') {
      addMissing(results, bucket, id, label, path, gate.reason);
    } else {
      addUnmatched(results, bucket, id, label, path, false, gate.details || {});
    }
  };

  addGate(
    academic,
    `${route.route_id}_academic_requirement`,
    route.academic_requirement_label,
    'a_level_profile.subjects'
  );
  addGate(gcse, `${route.route_id}_gcse_requirement`, 'Leicester minimum GCSE requirements', 'gcse_profile.subjects');
  addGate(
    ucat,
    `${route.route_id}_ucat_requirement`,
    'UCAT total score threshold',
    'admissions_tests.ucat.total_score'
  );
  addGate(sjt, `${route.route_id}_sjt_requirement`, 'SJT band 1, 2 or 3', 'admissions_tests.ucat.sjt_band');
}

function evaluateLeicesterContextualEligibility({ applicant, evidence, helpers }) {
  const normaliseId = helpers.normaliseId;
  const routes = [
    {
      route_id: 'leicester_access_leicester_medicine_contextual',
      route_label: 'Access Leicester: Medicine',
      group_id: LEICESTER_ACCESS_LEICESTER_GROUP_ID,
      bucket: 'access_leicester_medicine',
      type: 'ukwpmed',
      programme_id: 'leicester_accessleicester_medicine',
      provider_university_id: 'leicester-a100',
      criterion_id: 'access_leicester_medicine_programme',
      criterion_label: 'Access Leicester: Medicine programme confirmed',
      academic_requirement: 'abb_predicted_or_aaa_achieved',
      academic_requirement_label: 'Predicted ABB or achieved AAA'
    },
    {
      route_id: 'leicester_realising_opportunities_contextual',
      route_label: 'Realising Opportunities Programme',
      group_id: LEICESTER_REALISING_OPPORTUNITIES_GROUP_ID,
      bucket: 'realising_opportunities',
      type: 'programme',
      programme_id: 'realising_opportunities',
      criterion_id: 'realising_opportunities_programme',
      criterion_label: 'Realising Opportunities Programme confirmed',
      academic_requirement: 'aaa_predicted_or_achieved',
      academic_requirement_label: 'Predicted AAA or achieved AAA'
    },
    {
      route_id: 'leicester_sutton_trust_pathways_to_medicine_contextual',
      route_label: 'Sutton Trust Pathways to Medicine',
      group_id: LEICESTER_SUTTON_TRUST_GROUP_ID,
      bucket: 'sutton_trust_pathways_to_medicine',
      type: 'programme',
      programme_id: 'sutton_trust_pathways_to_medicine',
      criterion_id: 'sutton_trust_pathways_to_medicine_programme',
      criterion_label: 'Sutton Trust Pathways to Medicine programme confirmed',
      academic_requirement: 'aaa_predicted_or_achieved',
      academic_requirement_label: 'Predicted AAA or achieved AAA'
    },
    {
      route_id: 'leicester_imd_plus_indicator_contextual',
      route_label: 'IMD Quintile 1 and an additional contextual indicator',
      group_id: LEICESTER_IMD_INDICATOR_GROUP_ID,
      bucket: 'imd_plus_indicator',
      type: 'imd_plus_indicator',
      criterion_id: 'imd_q1_plus_additional_indicator',
      criterion_label: 'IMD 2019 quintile 1 plus at least one additional Leicester contextual indicator',
      academic_requirement: 'aaa_predicted_or_achieved',
      academic_requirement_label: 'Predicted AAA or achieved AAA'
    },
    {
      route_id: 'leicester_ukwpmed_restricted_2027',
      route_label: 'Restricted UKWPMED 2027 route',
      group_id: LEICESTER_UKWPMED_2027_GROUP_ID,
      bucket: 'ukwpmed_restricted_2027',
      type: 'ukwpmed',
      programme_id: 'leicester_accessleicester_medicine',
      provider_university_id: 'leicester-a100',
      completion_years: [2025, 2026],
      criterion_id: 'leicester_ukwpmed_2027_programme',
      criterion_label: 'Verified AccessLeicester UKWPMED completion',
      academic_requirement: 'restricted_ukwpmed_2027',
      academic_requirement_label: '2027 first-gap-year achieved ABB UKWPMED route'
    }
  ];

  const results = {
    status: 'not_contextual',
    reason: 'leicester_no_contextual_route_matched',
    is_contextual: false,
    matched_contextual_pathway: null,
    matched_contextual_pathway_label: null,
    qualifying_criteria: [],
    exclusions: [],
    missing_information: [],
    checks: {
      access_leicester_medicine: [],
      realising_opportunities: [],
      sutton_trust_pathways_to_medicine: [],
      imd_plus_indicator: [],
      ukwpmed_restricted_2027: []
    },
    activated_applicant_group_ids: [],
    provisional_activated_applicant_group_ids: [],
    contextual_evidence: {
      ucat_threshold: {
        comparator: UCAT_COMPARATOR,
        threshold: UCAT_THRESHOLD,
        source_wording: '>1780'
      },
      matched_routes: []
    }
  };

  const routeResults = routes.map((route) => evaluateRoute(route, applicant, evidence, normaliseId));
  for (const routeResult of routeResults) {
    applyRouteEvidenceToResults(results, routeResult, normaliseId);
  }

  const confirmedRoutes = routeResults.filter((routeResult) => routeResult.status === 'pass');
  if (confirmedRoutes.length > 0) {
    const selectedRoute = confirmedRoutes[0];
    results.status = 'contextual';
    results.reason = `${selectedRoute.route.route_id}_eligible`;
    results.is_contextual = true;
    results.matched_contextual_pathway = selectedRoute.route.route_id;
    results.matched_contextual_pathway_label = selectedRoute.route.route_label;
    results.contextual_evidence.matched_routes = confirmedRoutes.map((entry) => ({
      route_id: entry.route.route_id,
      route_label: entry.route.route_label
    }));
    results.contextual_evidence.primary_route = {
      route_id: selectedRoute.route.route_id,
      route_label: selectedRoute.route.route_label
    };
    results.activated_applicant_group_ids = [
      selectedRoute.route.group_id,
      'contextual',
      'widening_participation',
      ...(selectedRoute.route.route_id === 'leicester_access_leicester_medicine_contextual' ||
      selectedRoute.route.route_id === 'leicester_realising_opportunities_contextual' ||
      selectedRoute.route.route_id === 'leicester_sutton_trust_pathways_to_medicine_contextual' ||
      selectedRoute.route.route_id === 'leicester_ukwpmed_restricted_2027'
        ? [LEICESTER_GUARANTEED_INTERVIEW_GROUP_ID]
        : [])
    ];
    return results;
  }

  return results;
}

module.exports = {
  LEICESTER_CONTEXTUAL_EVALUATOR_ID,
  LEICESTER_ACCESS_LEICESTER_GROUP_ID,
  LEICESTER_REALISING_OPPORTUNITIES_GROUP_ID,
  LEICESTER_SUTTON_TRUST_GROUP_ID,
  LEICESTER_UKWPMED_2027_GROUP_ID,
  LEICESTER_IMD_INDICATOR_GROUP_ID,
  LEICESTER_GUARANTEED_INTERVIEW_GROUP_ID,
  evaluateLeicesterContextualEligibility
};
