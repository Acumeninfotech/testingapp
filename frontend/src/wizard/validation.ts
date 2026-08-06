import { A_LEVEL_SCIENCE_SUBJECTS, GCSE_CORE_SUBJECT_IDS, GCSE_SEPARATE_SCIENCE_SUBJECT_IDS, type WizardProfile } from './profileTypes';
import { UKWPMED_REGISTRY } from './contextualRegistry';

export type ValidationErrors = Record<string, string>;

const UCAT_SUBTEST_MIN = 300;
const UCAT_SUBTEST_MAX = 900;
const UCAT_TOTAL_MIN = 900;
const UCAT_TOTAL_MAX = 2700;

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
  if (!identity.age_at_course_start_band) {
    errors.age_at_course_start_band = 'Select your age on 1 September of your course-start year.';
  } else if (identity.age_at_course_start_band === 'age_18_or_over_legacy') {
    errors.age_at_course_start_band =
      'Please confirm your exact age on 1 September of your course-start year. A legacy "18 or over" answer is too broad.';
  }
  if (!identity.current_uk_residence) {
    errors.current_uk_residence = 'Select whether you currently live in the UK.';
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

  const epq = profile.a_level_profile.epq;
  if (epq?.status === 'predicted' && !epq.grade) {
    errors.epq_grade = 'Select your predicted EPQ grade.';
  }
  if (epq?.status === 'achieved' && !epq.grade) {
    errors.epq_grade = 'Select your achieved EPQ grade.';
  }

  return errors;
}

// UCAT is always sat the year before medicine entry (e.g. 2027 entry ->
// UCAT taken in 2026) - see CURRENT_MEDICINE_ENTRY_YEAR/CURRENT_UCAT_TEST_YEAR
// and expectedUcatTestYear() in assets/js/engine/applicant-profile-normaliser.js,
// which the engine enforces server-side regardless of what the frontend
// sends. This mirrors that same rule so the applicant sees the error before
// submitting, rather than only after the API rejects it as not_eligible.
export function expectedUcatTestYear(applicationYear: number): number {
  return applicationYear - 1;
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
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors[key] = 'Enter a whole-number UCAT subtest score.';
      } else if (value < UCAT_SUBTEST_MIN || value > UCAT_SUBTEST_MAX) {
        errors[key] = 'UCAT subtest scores should be between 300 and 900.';
      }
    }
  }

  if (ucat.total_score === '') {
    errors.total_score = 'UCAT total score will be calculated once all three subtest scores are entered.';
  } else if (typeof ucat.total_score !== 'number' || !Number.isInteger(ucat.total_score)) {
    errors.total_score = 'UCAT total score must be a whole number.';
  } else if (ucat.total_score < UCAT_TOTAL_MIN || ucat.total_score > UCAT_TOTAL_MAX) {
    errors.total_score = 'UCAT total score should be between 900 and 2700.';
  } else if (verbal_reasoning !== '' && decision_making !== '' && quantitative_reasoning !== '') {
    const sum = Number(verbal_reasoning) + Number(decision_making) + Number(quantitative_reasoning);
    if (sum !== ucat.total_score) {
      errors.total_score = `Your subtest scores add up to ${sum}, which doesn't match your total score.`;
    }
  }

  if (!ucat.sjt_band) {
    errors.sjt_band = 'Select your SJT band.';
  }

  const applicationYear = profile.course_target.application_year;

  if (ucat.test_year === '') {
    errors.test_year = 'Enter the year you took (or will take) the UCAT.';
  } else if (typeof ucat.test_year === 'number' && (ucat.test_year < 2015 || ucat.test_year > 2035)) {
    errors.test_year = 'Enter a realistic UCAT test year.';
  } else if (typeof ucat.test_year === 'number' && typeof applicationYear === 'number') {
    const expected = expectedUcatTestYear(applicationYear);
    if (ucat.test_year !== expected) {
      errors.test_year = `For ${applicationYear} medicine entry, the UCAT should normally have been taken in ${expected}. Enter ${expected}, or check your entry year on the previous step.`;
    }
  }

  return errors;
}

export function validateContextualStep(profile: WizardProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  const homeArea = profile.contextual_profile?.home_area_region;
  const access = profile.contextual_profile?.access_programmes;
  const ukwpmed = access?.ukwpmed;
  const allowedQuintiles = new Set(['', 'unknown', 'q1', 'q2', 'q3', 'q4', 'q5']);
  const allowedHomeRegions = new Set(['south_west_england', 'north_west_england', 'north_east_england_or_cumbria', 'east_of_england', 'none', 'unknown', null, '']);
  const allowedSpecificHomeAreas = new Set(['essex', 'lincolnshire', 'none', 'unknown', null, '']);
  const allowedSchoolAreaOptions = new Set(['northern_ireland_bt_to_year_12', 'bristol_bs_ba_state_school', 'keele_region_school']);
  const allowedSchoolAreaValues = new Set([...allowedSchoolAreaOptions, 'none', 'unknown', null, '']);
  const allowedYesNoNotSure = new Set(['yes', 'no', 'not_sure', undefined]);
  const allowedSensitiveAnswers = new Set(['yes', 'no', 'not_sure', 'prefer_not_to_say', undefined]);
  const allowedUkrainianVisaSchemes = new Set([
    'homes_for_ukraine',
    'ukraine_family_scheme',
    'ukraine_extension_scheme',
    'none',
    'not_sure',
    undefined,
  ]);

  if (homeArea) {
    for (const key of ['polar4_quintile', 'tundra_quintile', 'imd_quintile'] as const) {
      if (!allowedQuintiles.has(homeArea[key])) {
        errors[key] = 'Select Unknown or a quintile from 1 to 5.';
      }
    }

    if (!allowedHomeRegions.has(homeArea.home_region ?? null)) {
      errors.home_region = 'Select a valid home region option.';
    }
    if (!allowedSpecificHomeAreas.has(homeArea.specific_home_area ?? null)) {
      errors.specific_home_area = 'Select a valid specific home area option.';
    }
    if (!allowedSchoolAreaValues.has(homeArea.school_area ?? null)) {
      errors.school_area = 'Select a valid school area option.';
    }

    const schoolAreas = Array.isArray(homeArea.school_areas) ? homeArea.school_areas : [];
    if (schoolAreas.some((value) => !allowedSchoolAreaOptions.has(value))) {
      errors.school_areas = 'Select only valid school-area options.';
    }
    if (schoolAreas.length > 0 && homeArea.school_area) {
      errors.school_areas = 'Use either the saved school-area field or legacy school-area values, not both.';
    }
  }

  if (ukwpmed?.status === 'yes') {
    if (!ukwpmed.programme_id && !ukwpmed.not_sure_programme) {
      errors.ukwpmed_programme_id = 'Select a recognised UKWPMED programme, or choose that you are not sure which programme.';
    }
    if (ukwpmed.programme_id && !ukwpmed.programme_status) {
      errors.ukwpmed_programme_status = 'Select the status of this programme.';
    }
    if (ukwpmed.programme_id && !UKWPMED_REGISTRY.recognised_programmes.some((programme) => programme.programme_id === ukwpmed.programme_id)) {
      errors.ukwpmed_programme_id = 'Select a recognised UKWPMED programme.';
    }
    if (ukwpmed.completion_year !== '') {
      const year = Number(ukwpmed.completion_year);
      if (!Number.isInteger(year) || year < 2000 || year > 2035) {
        errors.ukwpmed_completion_year = 'Enter a sensible four-digit year.';
      }
    }
  }

  for (const [key, value] of Object.entries(profile.contextual_profile?.school_education ?? {})) {
    if (!allowedYesNoNotSure.has(value)) {
      errors[`school_education_${key}`] = 'Select Yes, No or Not sure.';
    }
  }

  for (const [key, value] of Object.entries(profile.contextual_profile?.personal_circumstances ?? {})) {
    if (key === 'ukrainian_visa_scheme') {
      if (!allowedUkrainianVisaSchemes.has(value)) {
        errors.personal_circumstances_ukrainian_visa_scheme = 'Select a valid Ukrainian visa scheme option.';
      }
      continue;
    }

    if (!allowedSensitiveAnswers.has(value)) {
      errors[`personal_circumstances_${key}`] = 'Select Yes, No, Not sure or Prefer not to say.';
    }
  }

  if (access?.participation_status === 'yes') {
    access.other_programmes.forEach((programme, index) => {
      if (programme.programme_id && !programme.status) {
        errors[`other_programme_${index}_status`] = 'Select the status of this programme.';
      }
    });
    if (
      access.other_programmes.some((programme) => programme.programme_id === 'other_access_wp_programme') &&
      !access.other_programme_name.trim()
    ) {
      errors.other_access_programme_name = 'Enter the programme name.';
    }
  }

  const partnerSchools = profile.contextual_profile?.partner_schools;
  if (partnerSchools?.status === 'yes') {
    const meaningful = partnerSchools.relationships.some((relationship) => (
      relationship.school_name.trim() ||
      relationship.university_id ||
      relationship.university_name?.trim()
    ));
    if (!meaningful) {
      errors.partner_schools = 'Add at least one partner-school relationship, or choose Not sure.';
    }
    partnerSchools.relationships.forEach((relationship, index) => {
      if ((relationship.university_id || relationship.university_name?.trim()) && !relationship.school_name.trim()) {
        errors[`partner_school_${index}_school_name`] = 'Enter the school or college name.';
      }
    });
  }

  return errors;
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
