#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const profilePath = path.join(rootDir, 'data', 'universities', 'edinburgh-a100.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

const PASS = 'eligible';
const FAIL = 'not_eligible';

const gradeRank = {
  'A*': 6,
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4
};

const gcseRank = {
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  'A*': 8,
  A: 7,
  B: 6,
  C: 4
};

const national5Rank = {
  A: 3,
  B: 2,
  C: 1,
  D: 0
};

const scienceDegreeSubjects = new Set(
  profile.stage_1_eligibility.post_16.degree.accepted_degree_subject_ids
);

function valueForGrade(grade, scale = gradeRank) {
  const value = scale[String(grade).toUpperCase()];

  if (value === undefined) {
    throw new Error(`Unsupported grade value: ${grade}`);
  }

  return value;
}

function minimumGradeValue(minimumGrade, scale = gradeRank) {
  const tokens = String(minimumGrade).split('/').map((token) => token.trim());
  return Math.max(...tokens.map((token) => valueForGrade(token, scale)));
}

function gradesMeetProfile(actualGrades, requiredProfile, scale = gradeRank) {
  const actual = Object.values(actualGrades)
    .map((grade) => valueForGrade(grade, scale))
    .sort((a, b) => b - a);
  const required = requiredProfile
    .map((grade) => valueForGrade(grade, scale))
    .sort((a, b) => b - a);

  if (actual.length < required.length) {
    return false;
  }

  return required.every((requiredValue, index) => actual[index] >= requiredValue);
}

function subjectPresent(subjects, allowedSubjectIds) {
  return allowedSubjectIds.some((subjectId) => subjects.has(subjectId));
}

function groupSubjectCount(subjects, allowedSubjectIds) {
  return allowedSubjectIds.filter((subjectId) => subjects.has(subjectId)).length;
}

function meetsGcseRequirements(applicant, contextual) {
  const gcse = profile.stage_1_eligibility.gcse;
  const requirement = gcse.grade_requirements.find((entry) => {
    return contextual
      ? entry.requirement_id === 'gcse_widening_access_minimums'
      : entry.requirement_id.endsWith('_standard');
  });

  if (contextual) {
    return requirement.subject_ids.every((subjectId) => {
      return valueForGrade(applicant.gcses[subjectId], gcseRank) >= minimumGradeValue(requirement.minimum_grade, gcseRank);
    });
  }

  return gcse.grade_requirements
    .filter((entry) => entry.requirement_id.endsWith('_standard'))
    .every((entry) => {
      return valueForGrade(applicant.gcses[entry.subject_id], gcseRank) >= minimumGradeValue(entry.minimum_grade, gcseRank);
    });
}

function meetsAlevelRequirements(applicant, contextual) {
  const requirements = profile.stage_1_eligibility.post_16.a_level.grade_requirements;
  const requirement = requirements.find((entry) => {
    return contextual
      ? entry.requirement_id === 'a_level_widening_access_minimum'
      : entry.requirement_id === 'a_level_standard_offer';
  });
  const subjectIds = new Set(Object.keys(applicant.aLevels));
  const hasRequiredSubjects = requirement.required_subject_ids.every((subjectId) => subjectIds.has(subjectId));
  const hasSubjectGroup = requirement.one_of_subject_groups.every((group) => {
    return groupSubjectCount(subjectIds, group.subject_ids) >= group.minimum_required;
  });

  return (
    gradesMeetProfile(applicant.aLevels, requirement.grade_profile) &&
    hasRequiredSubjects &&
    hasSubjectGroup &&
    meetsGcseRequirements(applicant, contextual)
  );
}

function meetsNational5Requirements(applicant) {
  const requirements = profile.stage_1_eligibility.post_16.scottish.national_5_requirements;

  return requirements.every((requirement) => {
    return (
      valueForGrade(applicant.national5s[requirement.subject_id], national5Rank) >=
      valueForGrade(requirement.minimum_grade, national5Rank)
    );
  });
}

function meetsScottishRequirements(applicant, contextual) {
  const requirements = profile.stage_1_eligibility.post_16.scottish.grade_requirements;
  const requirement = requirements.find((entry) => {
    return contextual
      ? entry.requirement_id === 'sqa_widening_access_minimum'
      : entry.requirement_id === 'sqa_standard_offer';
  });
  const higherSubjects = new Set(Object.keys(applicant.highers));
  const hasRequiredSubjects = requirement.required_subject_ids.every((subjectId) => higherSubjects.has(subjectId));
  const hasSubjectGroup = requirement.one_of_subject_groups.every((group) => {
    return groupSubjectCount(higherSubjects, group.subject_ids) >= group.minimum_required;
  });

  return (
    gradesMeetProfile(applicant.highers, requirement.higher_grade_profile) &&
    gradesMeetProfile(applicant.advancedHighers, requirement.advanced_higher_grade_profile) &&
    hasRequiredSubjects &&
    hasSubjectGroup &&
    meetsNational5Requirements(applicant)
  );
}

function meetsGraduateRequirements(applicant) {
  const degree = profile.stage_1_eligibility.post_16.degree;
  const hasMinimumDegree = applicant.degree?.classification === '2:1' || applicant.degree?.classification === 'first';

  if (!hasMinimumDegree) {
    return false;
  }

  if (scienceDegreeSubjects.has(applicant.degree.subject_id)) {
    return true;
  }

  const chemistryGrade = applicant.additionalQualifications?.a_level?.chemistry;
  return chemistryGrade !== undefined && valueForGrade(chemistryGrade) >= valueForGrade('B');
}

function contextualState(applicant) {
  const isPlusFlag = applicant.contextual_status === 'plus_flag';
  const hasUcatBursary = applicant.ucat_bursary === true;
  const isFlag = applicant.contextual_status === 'flag';
  const isScottishSimd40 =
    applicant.domicile === 'scotland' && applicant.simd_quintile === 'second_lowest_quintile_simd40';

  return {
    academicContextual: applicant.contextual === true || isPlusFlag || isFlag || isScottishSimd40,
    isPlusFlag,
    hasUcatBursary,
    isFlag,
    isScottishSimd40
  };
}

function evaluateUcat(applicant) {
  const ucat = profile.stage_1_eligibility.admissions_tests.ucat;
  const state = contextualState(applicant);
  const appliedPolicies = [];

  if (state.isPlusFlag) {
    appliedPolicies.push('Plus Flag: any UCAT total accepted; 10% uplift metadata stored');
  }

  if (state.hasUcatBursary) {
    appliedPolicies.push('UCAT bursary: same concession as Plus Flag metadata stored');
  }

  if (state.isFlag) {
    appliedPolicies.push('Flag: cutoff required; 5% uplift metadata stored');
  }

  if (state.isScottishSimd40) {
    appliedPolicies.push('Scottish SIMD40: cutoff required; 10% uplift metadata stored');
  }

  const cutoffRequired = !(state.isPlusFlag || state.hasUcatBursary);
  const passesCutoff = !cutoffRequired || applicant.ucat_total >= ucat.minimum_total_score;

  return {
    passed: passesCutoff,
    gate_id: 'ucat_2027_minimum_total_score',
    applied_policies: appliedPolicies,
    cutoff_required: cutoffRequired,
    cutoff: ucat.minimum_total_score
  };
}

function evaluateSjt(applicant) {
  const sjt = profile.stage_1_eligibility.admissions_tests.sjt;

  return {
    passed: !sjt.excluded_bands.includes(applicant.sjt_band),
    gate_id: 'sjt_band_4_exclusion',
    excluded_bands: sjt.excluded_bands
  };
}

function evaluateAcademic(applicant) {
  const state = contextualState(applicant);

  if (applicant.route === 'a_level') {
    return {
      passed: meetsAlevelRequirements(applicant, state.academicContextual),
      gate_id: state.academicContextual ? 'a_level_widening_access_minimum' : 'a_level_standard_offer'
    };
  }

  if (applicant.route === 'scottish') {
    return {
      passed: meetsScottishRequirements(applicant, state.academicContextual),
      gate_id: state.academicContextual ? 'sqa_widening_access_minimum' : 'sqa_standard_offer'
    };
  }

  if (applicant.route === 'graduate') {
    return {
      passed: meetsGraduateRequirements(applicant),
      gate_id: 'graduate_degree_and_chemistry_requirement'
    };
  }

  throw new Error(`Unsupported applicant route: ${applicant.route}`);
}

function evaluateEligibility(applicant) {
  const failedGates = [];

  if (applicant.has_resits && !applicant.exceptional_circumstances_evidence) {
    failedGates.push('resit_policy');
  }

  const academic = evaluateAcademic(applicant);
  if (!academic.passed) {
    failedGates.push(academic.gate_id);
  }

  const ucat = evaluateUcat(applicant);
  if (!ucat.passed) {
    failedGates.push(ucat.gate_id);
  }

  const sjt = evaluateSjt(applicant);
  if (!sjt.passed) {
    failedGates.push(sjt.gate_id);
  }

  return {
    status: failedGates.length === 0 ? PASS : FAIL,
    failed_gates: failedGates,
    applied_contextual_ucat_policies: ucat.applied_policies,
    eligibility_only: true,
    formula_scoring_evaluated: false
  };
}

const testCases = [
  {
    id: 'standard_a_level_eligible',
    summary: 'Standard A-level applicant; AAA with Chemistry and Biology; GCSE sciences, English and Maths at 7; UCAT 2100; SJT Band 2.',
    expected: PASS,
    applicant: {
      route: 'a_level',
      aLevels: { chemistry: 'A', biology: 'A', history: 'A' },
      gcses: { biology: '7', chemistry: '7', english_language: '7', mathematics: '7' },
      ucat_total: 2100,
      sjt_band: 2
    }
  },
  {
    id: 'a_level_below_ucat_cutoff',
    summary: 'Academically eligible A-level applicant; UCAT 1800 below 1850; SJT Band 2.',
    expected: FAIL,
    expectedFailedGates: ['ucat_2027_minimum_total_score'],
    applicant: {
      route: 'a_level',
      aLevels: { chemistry: 'A', biology: 'A', history: 'A' },
      gcses: { biology: '7', chemistry: '7', english_language: '7', mathematics: '7' },
      ucat_total: 1800,
      sjt_band: 2
    }
  },
  {
    id: 'sjt_band_4_excluded',
    summary: 'Otherwise eligible A-level applicant; UCAT 2100; SJT Band 4.',
    expected: FAIL,
    expectedFailedGates: ['sjt_band_4_exclusion'],
    applicant: {
      route: 'a_level',
      aLevels: { chemistry: 'A', biology: 'A', history: 'A' },
      gcses: { biology: '7', chemistry: '7', english_language: '7', mathematics: '7' },
      ucat_total: 2100,
      sjt_band: 4
    }
  },
  {
    id: 'widening_access_a_level_plus_flag',
    summary: 'Widening-access A-level applicant; AAB with Chemistry and Biology; GCSEs at 6; Plus Flag; UCAT 1700 accepted under contextual policy; SJT Band 3.',
    expected: PASS,
    applicant: {
      route: 'a_level',
      contextual: true,
      contextual_status: 'plus_flag',
      aLevels: { chemistry: 'A', biology: 'A', history: 'B' },
      gcses: { biology: '6', chemistry: '6', english_language: '6', mathematics: '6' },
      ucat_total: 1700,
      sjt_band: 3
    }
  },
  {
    id: 'scottish_standard_eligible',
    summary: 'Scottish standard applicant; S5 AAAAB including Chemistry plus Biology and Maths; BB Advanced Higher; National 5 requirements met; UCAT 2050; SJT Band 1.',
    expected: PASS,
    applicant: {
      route: 'scottish',
      domicile: 'scotland',
      highers: { chemistry: 'A', biology: 'A', mathematics: 'A', english: 'A', history: 'B' },
      advancedHighers: { chemistry: 'B', biology: 'B' },
      national5s: { biology: 'B', chemistry: 'B', english_language: 'B', mathematics: 'B' },
      ucat_total: 2050,
      sjt_band: 1
    }
  },
  {
    id: 'scottish_widening_simd40',
    summary: 'Scottish widening/SIMD40 applicant; S5 AAABB including Chemistry plus Biology and Maths; CC Advanced Higher; National 5 requirements met; UCAT 1850; SJT Band 2.',
    expected: PASS,
    applicant: {
      route: 'scottish',
      domicile: 'scotland',
      contextual: true,
      simd_quintile: 'second_lowest_quintile_simd40',
      highers: { chemistry: 'A', biology: 'A', mathematics: 'A', english: 'B', history: 'B' },
      advancedHighers: { chemistry: 'C', biology: 'C' },
      national5s: { biology: 'B', chemistry: 'B', english_language: 'B', mathematics: 'B' },
      ucat_total: 1850,
      sjt_band: 2
    }
  },
  {
    id: 'graduate_non_science_with_chemistry',
    summary: 'Graduate applicant; 2:1 non-science degree; A-level Chemistry at B represented; UCAT 2200; SJT Band 2.',
    expected: PASS,
    applicant: {
      route: 'graduate',
      degree: { classification: '2:1', subject_id: 'history' },
      additionalQualifications: { a_level: { chemistry: 'B' } },
      ucat_total: 2200,
      sjt_band: 2
    }
  },
  {
    id: 'resit_without_exceptional_evidence',
    summary: 'Otherwise eligible A-level applicant with resits and no represented exceptional-circumstance evidence.',
    expected: FAIL,
    expectedFailedGates: ['resit_policy'],
    applicant: {
      route: 'a_level',
      has_resits: true,
      exceptional_circumstances_evidence: false,
      aLevels: { chemistry: 'A', biology: 'A', history: 'A' },
      gcses: { biology: '7', chemistry: '7', english_language: '7', mathematics: '7' },
      ucat_total: 2100,
      sjt_band: 2
    }
  }
];

let passed = 0;

console.log('Edinburgh A100 eligibility-only test cases');
console.log('Formula scoring checks: not evaluated by this eligibility-only script.\n');

for (const testCase of testCases) {
  const actual = evaluateEligibility(testCase.applicant);
  const statusMatches = actual.status === testCase.expected;
  const failedGateMatches =
    !testCase.expectedFailedGates ||
    testCase.expectedFailedGates.every((gateId) => actual.failed_gates.includes(gateId));
  const formulaNotEvaluated = actual.eligibility_only === true && actual.formula_scoring_evaluated === false;
  const casePassed = statusMatches && failedGateMatches && formulaNotEvaluated;

  assert.strictEqual(actual.pre_interview_score, undefined);
  assert.strictEqual(actual.prediction_score, undefined);
  assert.strictEqual(actual.competitiveness_prediction, undefined);

  if (casePassed) {
    passed += 1;
  }

  console.log(`${casePassed ? 'PASS' : 'FAIL'} ${testCase.id}`);
  console.log(`  Applicant: ${testCase.summary}`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Actual: ${actual.status}`);
  console.log(`  Failed gates: ${actual.failed_gates.length ? actual.failed_gates.join(', ') : 'none'}`);
  console.log(
    `  Contextual UCAT policy: ${
      actual.applied_contextual_ucat_policies.length
        ? actual.applied_contextual_ucat_policies.join('; ')
        : 'none'
    }`
  );
  console.log('  Mode: eligibility-only; formula scoring not evaluated\n');

  assert.ok(casePassed, `${testCase.id} did not match expected eligibility outcome.`);
}

console.log(`Edinburgh A100 eligibility-only tests passed: ${passed}/${testCases.length}.`);
