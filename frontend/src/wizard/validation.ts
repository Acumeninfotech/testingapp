import { A_LEVEL_SCIENCE_SUBJECTS, GCSE_CORE_SUBJECT_IDS, GCSE_SEPARATE_SCIENCE_SUBJECT_IDS, type WizardProfile } from './profileTypes';

export type ValidationErrors = Record<string, string>;

export function validateIdentityStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const identity = profile.applicant_identity;

  if (!identity.applicant_type) {
    errors.applicant_type = 'Select the option that best describes you.';
  }
  if (!identity.fee_status) {
    errors.fee_status = 'Select your fee status.';
  }
  if (!identity.domicile) {
    errors.domicile = 'Select where you are domiciled.';
  }
  if (!identity.date_of_birth) {
    errors.date_of_birth = 'Enter your date of birth.';
  } else if (Number.isNaN(Date.parse(identity.date_of_birth))) {
    errors.date_of_birth = 'Enter a valid date.';
  }

  return errors;
}

export function validateRouteStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const year = profile.course_target.application_year;

  if (!profile.course_target.qualification_route) {
    errors.qualification_route = 'Select your qualification route.';
  }

  if (year === '' || year === null || year === undefined) {
    errors.application_year = 'Enter the year you plan to start your course.';
  } else if (typeof year === 'number' && (year < 2025 || year > 2035)) {
    errors.application_year = 'Enter a realistic application year (e.g. 2027).';
  }

  return errors;
}

function validateSubjectGradeList(
  subjects: { subject_id: string; grade: string }[],
  minCount: number,
  fieldPrefix: string,
  errors: ValidationErrors,
) {
  const filled = subjects.filter((s) => s.subject_id !== '');
  if (filled.length < minCount) {
    errors[fieldPrefix] = `Enter at least ${minCount} subject${minCount === 1 ? '' : 's'}.`;
  }
  subjects.forEach((subject, index) => {
    if (subject.subject_id && !subject.grade) {
      errors[`${fieldPrefix}_${index}_grade`] = 'Enter a grade for this subject.';
    }
  });
}

export function validateScottishStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { higher_subjects, advanced_higher_subjects } = profile.scottish_profile;

  validateSubjectGradeList(higher_subjects, 3, 'higher_subjects', errors);
  validateSubjectGradeList(advanced_higher_subjects, 0, 'advanced_higher_subjects', errors);

  return errors;
}

export function validateIbStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { total_points, higher_level_subjects } = profile.ib_profile;

  if (total_points === '' || total_points === null) {
    errors.total_points = 'Enter your total IB points.';
  } else if (typeof total_points === 'number' && (total_points < 1 || total_points > 45)) {
    errors.total_points = 'IB total points should be between 1 and 45.';
  }

  validateSubjectGradeList(higher_level_subjects, 3, 'higher_level_subjects', errors);

  return errors;
}

export function validateBtecStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { qualification, grade } = profile.btec_profile;

  if (!qualification) {
    errors.qualification = 'Enter your BTEC qualification title.';
  }
  if (!grade) {
    errors.grade = 'Enter your overall BTEC grade.';
  }

  return errors;
}

export function validateAccessToHeStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { provider_approved_by_institution, requirements_met } = profile.access_to_he_profile;

  if (!provider_approved_by_institution) {
    errors.provider_approved_by_institution =
      'Confirm your Access to HE provider is approved by the institution you are applying to.';
  }
  if (!requirements_met) {
    errors.requirements_met = 'Confirm you meet the diploma requirements for this course.';
  }

  return errors;
}

export function validateGraduateStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const graduate = profile.graduate_profile;

  if (!graduate.degree_classification) {
    errors.degree_classification = 'Select your degree classification.';
  }
  if (!graduate.degree_status) {
    errors.degree_status = 'Select your degree status.';
  }

  const gamsat = profile.admissions_tests.gamsat;
  if (gamsat.taken) {
    if (gamsat.overall_score === '') {
      errors.gamsat_overall_score = 'Enter your GAMSAT overall score.';
    }
    gamsat.section_scores.forEach((score, index) => {
      if (score === '') {
        errors[`gamsat_section_${index}`] = 'Enter this GAMSAT section score.';
      } else if (typeof score === 'number' && score < 0) {
        errors[`gamsat_section_${index}`] = 'Enter a valid GAMSAT section score.';
      }
    });
  }

  return errors;
}

export function validateInternationalStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const international = profile.international_qualification;

  if (!international.name) {
    errors.name = 'Enter the name of your qualification.';
  }
  if (!international.equivalence_status) {
    errors.equivalence_status = 'Select your UK equivalence verification status.';
  }

  return errors;
}

export function requiresEnglishLanguageEvidence(profile: WizardProfile): boolean {
  return profile.applicant_identity.fee_status === 'international';
}

export function validateEnglishLanguageStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const english = profile.english_language_profile;

  if (!requiresEnglishLanguageEvidence(profile)) {
    return errors;
  }

  if (!english.test) {
    errors.test = 'Select the English language test you have taken, or claim an exemption.';
    return errors;
  }

  if (english.test === 'exemption_claimed') {
    return errors;
  }

  if (english.overall === '') {
    errors.overall = 'Enter your overall score.';
  }
  for (const [key, value] of Object.entries({
    reading: english.reading,
    writing: english.writing,
    listening: english.listening,
    speaking: english.speaking,
  })) {
    if (value === '') {
      errors[key] = 'Enter this component score.';
    }
  }

  return errors;
}

export function validateGcseStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { subjects, science_mode, combined_science_grade, additional_subjects } = profile.gcse_profile;

  for (const subjectId of GCSE_CORE_SUBJECT_IDS) {
    if (!subjects[subjectId]) {
      errors[`gcse_${subjectId}`] = 'Select a grade for this subject.';
    }
  }

  if (science_mode === 'separate_sciences') {
    for (const subjectId of GCSE_SEPARATE_SCIENCE_SUBJECT_IDS) {
      if (!subjects[subjectId]) {
        errors[`gcse_${subjectId}`] = 'Select a grade for this subject.';
      }
    }
  } else if (!combined_science_grade) {
    errors.gcse_combined_science = 'Select a grade for Combined Science.';
  }

  additional_subjects.forEach((subject, index) => {
    if (subject.subject_id && !subject.grade) {
      errors[`additional_gcse_${index}_grade`] = 'Select a grade for this subject.';
    }
    if (!subject.subject_id && subject.grade) {
      errors[`additional_gcse_${index}_subject`] = 'Select a subject.';
    }
  });

  return errors;
}

export function validateALevelStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const { subjects } = profile.a_level_profile;

  const filledSubjects = subjects.filter((s) => s.subject_id !== '');
  if (filledSubjects.length < 3) {
    errors.subjects = 'Enter all three of your A-level subjects.';
  }

  const seenIds = new Set<string>();
  subjects.forEach((subject, index) => {
    if (!subject.subject_id) {
      if (index < 3) errors[`subject_${index}_id`] = 'Select a subject.';
      return;
    }
    if (seenIds.has(subject.subject_id)) {
      errors[`subject_${index}_id`] = 'You have already entered this subject.';
    }
    seenIds.add(subject.subject_id);

    if (!subject.predicted_grade && !subject.achieved_grade) {
      errors[`subject_${index}_grade`] = 'Enter a predicted or achieved grade.';
    }

    if (
      A_LEVEL_SCIENCE_SUBJECTS.includes(subject.subject_id as (typeof A_LEVEL_SCIENCE_SUBJECTS)[number]) &&
      subject.practical_endorsement === 'not_applicable'
    ) {
      errors[`subject_${index}_practical`] = 'Select a practical endorsement outcome for this science subject.';
    }
  });

  if (profile.applicant_identity.resit.has_resits && profile.applicant_identity.resit.subjects_resat.length === 0) {
    errors.subjects_resat = 'List which subject(s) you are resitting.';
  }

  if (typeof profile.a_level_profile.completed_in_one_sitting !== 'boolean') {
    errors.completed_in_one_sitting =
      'Confirm whether your required A-level qualifications are in the same examination sitting.';
  }

  return errors;
}

export function validateUcatStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const ucat = profile.admissions_tests.ucat;

  if (!ucat.taken) {
    return errors;
  }

  const { verbal_reasoning, decision_making, quantitative_reasoning } = ucat.subtests;

  if (verbal_reasoning === '' || decision_making === '' || quantitative_reasoning === '') {
    errors.subtests = 'Enter all three UCAT cognitive subtest scores.';
  } else {
    for (const [key, value] of Object.entries({ verbal_reasoning, decision_making, quantitative_reasoning })) {
      if (typeof value === 'number' && (value < 300 || value > 900)) {
        errors[key] = 'UCAT subtest scores are usually between 300 and 900.';
      }
    }
  }

  if (ucat.total_score === '') {
    errors.total_score = 'Enter your UCAT total score.';
  } else if (typeof ucat.total_score === 'number' && (ucat.total_score < 900 || ucat.total_score > 2700)) {
    errors.total_score = 'UCAT total score should be between 900 and 2700.';
  } else if (
    typeof ucat.total_score === 'number' &&
    verbal_reasoning !== '' &&
    decision_making !== '' &&
    quantitative_reasoning !== ''
  ) {
    const sum = Number(verbal_reasoning) + Number(decision_making) + Number(quantitative_reasoning);
    if (sum !== ucat.total_score) {
      errors.total_score = `Your subtest scores add up to ${sum}, which doesn't match your total score.`;
    }
  }

  if (!ucat.sjt_band) {
    errors.sjt_band = 'Select your SJT band.';
  }

  if (ucat.test_year === '') {
    errors.test_year = 'Enter the year you took (or will take) the UCAT.';
  } else if (typeof ucat.test_year === 'number' && (ucat.test_year < 2015 || ucat.test_year > 2035)) {
    errors.test_year = 'Enter a realistic UCAT test year.';
  }

  return errors;
}

export function validateContextualStep(): ValidationErrors {
  // All fields on this step are optional booleans — nothing to validate.
  return {};
}

export function validateUniversitiesStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  if (profile.university_ids.length === 0) {
    errors.university_ids = 'Select at least one university.';
  }
  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
