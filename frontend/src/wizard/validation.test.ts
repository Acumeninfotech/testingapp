import { describe, expect, it } from 'vitest';
import { createEmptyProfile } from './profileTypes';
import {
  expectedUcatTestYear,
  hasErrors,
  requiresEnglishLanguageEvidence,
  validateAccessToHeStep,
  validateALevelStep,
  validateBtecStep,
  validateEnglishLanguageStep,
  validateGcseStep,
  validateGraduateStep,
  validateIbStep,
  validateIdentityStep,
  validateInternationalStep,
  validateRouteStep,
  validateScottishStep,
  validateUcatStep,
  validateUniversitiesStep,
} from './validation';

describe('validateIdentityStep', () => {
  it('flags all required fields when empty', () => {
    const errors = validateIdentityStep(createEmptyProfile());
    expect(hasErrors(errors)).toBe(true);
    expect(errors.applicant_type).toBeTruthy();
    expect(errors.fee_status).toBeTruthy();
    expect(errors.domicile).toBeTruthy();
    expect(errors.age_at_course_start_band).toBeTruthy();
  });

  it('passes when all fields are filled correctly', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.applicant_type = 'school_leaver';
    profile.applicant_identity.fee_status = 'home';
    profile.applicant_identity.domicile = 'england';
    profile.applicant_identity.age_at_course_start_band = 'age_18_or_over';
    expect(hasErrors(validateIdentityStep(profile))).toBe(false);
  });

  it('rejects a missing age band', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.applicant_type = 'school_leaver';
    profile.applicant_identity.fee_status = 'home';
    profile.applicant_identity.domicile = 'england';
    expect(validateIdentityStep(profile).age_at_course_start_band).toBeTruthy();
  });
});

describe('validateGcseStep', () => {
  it('requires a grade for every core and separate-science subject', () => {
    const errors = validateGcseStep(createEmptyProfile());
    expect(Object.keys(errors)).toHaveLength(5);
  });

  it('passes when every core subject and separate science has a grade', () => {
    const profile = createEmptyProfile();
    for (const key of Object.keys(profile.gcse_profile.subjects) as (keyof typeof profile.gcse_profile.subjects)[]) {
      profile.gcse_profile.subjects[key] = '7';
    }
    expect(hasErrors(validateGcseStep(profile))).toBe(false);
  });

  it('requires a combined science grade instead of separate sciences in combined mode', () => {
    const profile = createEmptyProfile();
    profile.gcse_profile.subjects.english_language = '7';
    profile.gcse_profile.subjects.mathematics = '7';
    profile.gcse_profile.science_mode = 'combined_science';
    const errors = validateGcseStep(profile);
    expect(errors.gcse_combined_science).toBeTruthy();
    expect(errors.gcse_biology).toBeUndefined();
    expect(errors.gcse_physics).toBeUndefined();
  });

  it('passes in combined science mode once the combined grade is entered', () => {
    const profile = createEmptyProfile();
    profile.gcse_profile.subjects.english_language = '7';
    profile.gcse_profile.subjects.mathematics = '7';
    profile.gcse_profile.science_mode = 'combined_science';
    profile.gcse_profile.combined_science_grade = '6';
    expect(hasErrors(validateGcseStep(profile))).toBe(false);
  });

  it('requires a grade when an additional GCSE subject is selected', () => {
    const profile = createEmptyProfile();
    for (const key of Object.keys(profile.gcse_profile.subjects) as (keyof typeof profile.gcse_profile.subjects)[]) {
      profile.gcse_profile.subjects[key] = '7';
    }
    profile.gcse_profile.additional_subjects = [{ subject_id: 'history', grade: '' }];
    expect(validateGcseStep(profile).additional_gcse_0_grade).toBeTruthy();
  });

  it('allows up to 9 total GCSEs via additional subjects', () => {
    const profile = createEmptyProfile();
    for (const key of Object.keys(profile.gcse_profile.subjects) as (keyof typeof profile.gcse_profile.subjects)[]) {
      profile.gcse_profile.subjects[key] = '7';
    }
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '7' },
      { subject_id: 'geography', grade: '6' },
      { subject_id: 'french', grade: '8' },
      { subject_id: 'computer_science', grade: '9' },
    ];
    expect(hasErrors(validateGcseStep(profile))).toBe(false);
  });

  it('allows a 10th and 11th GCSE via additional subjects', () => {
    const profile = createEmptyProfile();
    for (const key of Object.keys(profile.gcse_profile.subjects) as (keyof typeof profile.gcse_profile.subjects)[]) {
      profile.gcse_profile.subjects[key] = '9';
    }
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'geography', grade: '9' },
      { subject_id: 'french', grade: '9' },
      { subject_id: 'computer_science', grade: '9' },
      { subject_id: 'psychology', grade: '9' },
      { subject_id: 'music', grade: '9' },
    ];
    expect(hasErrors(validateGcseStep(profile))).toBe(false);
  });
});

describe('validateALevelStep', () => {
  function validALevelProfile() {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.a_level_profile.completed_in_one_sitting = true;
    return profile;
  }

  it('requires three subjects with grades', () => {
    const errors = validateALevelStep(createEmptyProfile());
    expect(hasErrors(errors)).toBe(true);
    expect(errors.subjects).toBeTruthy();
  });

  it('requires a practical endorsement outcome for science subjects', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    const errors = validateALevelStep(profile);
    expect(errors.subject_0_practical).toBeTruthy();
    expect(errors.subject_1_practical).toBeUndefined();
  });

  it('rejects duplicate subjects', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    expect(validateALevelStep(profile).subject_1_id).toBeTruthy();
  });

  it('passes for three valid non-science-conflicting subjects', () => {
    const profile = validALevelProfile();
    expect(hasErrors(validateALevelStep(profile))).toBe(false);
  });

  it('does not require EPQ when it is not taken, planned, or absent from a legacy profile', () => {
    const notTaken = validALevelProfile();
    notTaken.a_level_profile.epq = { status: 'not_taken', grade: null };
    expect(validateALevelStep(notTaken).epq_grade).toBeUndefined();

    const planning = validALevelProfile();
    planning.a_level_profile.epq = { status: 'planning', grade: null };
    expect(validateALevelStep(planning).epq_grade).toBeUndefined();

    const legacy = validALevelProfile();
    delete legacy.a_level_profile.epq;
    expect(validateALevelStep(legacy).epq_grade).toBeUndefined();
  });

  it('requires a grade for predicted and achieved EPQ statuses', () => {
    const predicted = validALevelProfile();
    predicted.a_level_profile.epq = { status: 'predicted', grade: null };
    expect(validateALevelStep(predicted).epq_grade).toBe('Select your predicted EPQ grade.');

    const achieved = validALevelProfile();
    achieved.a_level_profile.epq = { status: 'achieved', grade: null };
    expect(validateALevelStep(achieved).epq_grade).toBe('Select your achieved EPQ grade.');

    achieved.a_level_profile.epq.grade = 'A*';
    expect(validateALevelStep(achieved).epq_grade).toBeUndefined();
  });

  it('does not require EPQ taken-alongside confirmation for predicted or achieved EPQ', () => {
    const profile = validALevelProfile();
    profile.a_level_profile.epq = {
      status: 'predicted',
      grade: 'A',
      taken_alongside_a_levels: null,
    };

    expect(validateALevelStep(profile).epq_taken_alongside_a_levels).toBeUndefined();
    expect(hasErrors(validateALevelStep(profile))).toBe(false);
  });

  it('accepts Computer Science as an A-level subject without a practical endorsement', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'computer_science', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.a_level_profile.completed_in_one_sitting = true;
    expect(hasErrors(validateALevelStep(profile))).toBe(false);
  });

  it('requires same-sitting confirmation', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    expect(validateALevelStep(profile).completed_in_one_sitting).toBeTruthy();
    profile.a_level_profile.completed_in_one_sitting = false;
    expect(validateALevelStep(profile).completed_in_one_sitting).toBeUndefined();
  });

  it('requires resit subjects to be listed when has_resits is true', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.applicant_identity.resit.has_resits = true;
    expect(validateALevelStep(profile).subjects_resat).toBeTruthy();
  });
});

describe('validateUcatStep', () => {
  it('allows UCAT to be omitted until selected universities require it', () => {
    expect(validateUcatStep(createEmptyProfile()).taken).toBeUndefined();
  });

  it('requires subtest scores to sum to the total score', () => {
    const profile = createEmptyProfile();
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 700,
      decision_making: 700,
      quantitative_reasoning: 700,
    };
    profile.admissions_tests.ucat.total_score = 2500;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = 2026;
    profile.course_target.application_year = 2027;
    expect(validateUcatStep(profile).total_score).toBeTruthy();
  });

  it('requires UCAT subtest scores to be whole numbers between 300 and 900', () => {
    const profile = createEmptyProfile();
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 299,
      decision_making: 901,
      quantitative_reasoning: Number.NaN,
    };
    profile.admissions_tests.ucat.total_score = 2100;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = 2026;

    const errors = validateUcatStep(profile);
    expect(errors.verbal_reasoning).toMatch(/300 and 900/);
    expect(errors.decision_making).toMatch(/300 and 900/);
    expect(errors.quantitative_reasoning).toMatch(/whole-number/);
  });

  it('validates the internally calculated UCAT total score range defensively', () => {
    const profile = createEmptyProfile();
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 300,
      decision_making: 300,
      quantitative_reasoning: 300,
    };
    profile.admissions_tests.ucat.total_score = 899;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = 2026;
    expect(validateUcatStep(profile).total_score).toMatch(/between 900 and 2700/);

    profile.admissions_tests.ucat.total_score = 2701;
    expect(validateUcatStep(profile).total_score).toMatch(/between 900 and 2700/);
  });

  it('requires a UCAT test year', () => {
    const profile = createEmptyProfile();
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 700,
      decision_making: 700,
      quantitative_reasoning: 700,
    };
    profile.admissions_tests.ucat.total_score = 2100;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = '';
    expect(validateUcatStep(profile).test_year).toBeTruthy();
  });

  it('passes for a consistent, valid UCAT profile', () => {
    const profile = createEmptyProfile();
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 700,
      decision_making: 700,
      quantitative_reasoning: 700,
    };
    profile.admissions_tests.ucat.total_score = 2100;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = 2026;
    expect(hasErrors(validateUcatStep(profile))).toBe(false);
  });

  it('passes when entry year 2027 is paired with UCAT year 2026', () => {
    const profile = createEmptyProfile();
    profile.course_target.application_year = 2027;
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 850,
      decision_making: 850,
      quantitative_reasoning: 850,
    };
    profile.admissions_tests.ucat.total_score = 2550;
    profile.admissions_tests.ucat.sjt_band = 1;
    profile.admissions_tests.ucat.test_year = 2026;
    expect(hasErrors(validateUcatStep(profile))).toBe(false);
  });

  it('shows a clear inline error when entry year 2027 is paired with UCAT year 2027', () => {
    const profile = createEmptyProfile();
    profile.course_target.application_year = 2027;
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 850,
      decision_making: 850,
      quantitative_reasoning: 850,
    };
    profile.admissions_tests.ucat.total_score = 2550;
    profile.admissions_tests.ucat.sjt_band = 1;
    profile.admissions_tests.ucat.test_year = 2027;
    const errors = validateUcatStep(profile);
    expect(errors.test_year).toBeTruthy();
    expect(errors.test_year).toMatch(/2026/);
  });

  it('does not cross-validate against the UCAT year when no entry year has been entered yet', () => {
    const profile = createEmptyProfile();
    profile.course_target.application_year = '';
    profile.admissions_tests.ucat.taken = true;
    profile.admissions_tests.ucat.subtests = {
      verbal_reasoning: 700,
      decision_making: 700,
      quantitative_reasoning: 700,
    };
    profile.admissions_tests.ucat.total_score = 2100;
    profile.admissions_tests.ucat.sjt_band = 2;
    profile.admissions_tests.ucat.test_year = 2019;
    expect(hasErrors(validateUcatStep(profile))).toBe(false);
  });
});

describe('expectedUcatTestYear', () => {
  it('returns entry year minus 1', () => {
    expect(expectedUcatTestYear(2027)).toBe(2026);
  });
});

describe('validateRouteStep', () => {
  it('requires a qualification route to be selected', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = '' as typeof profile.course_target.qualification_route;
    expect(validateRouteStep(profile).qualification_route).toBeTruthy();
  });
});

describe('validateScottishStep', () => {
  it('requires at least three Higher subjects with grades', () => {
    const errors = validateScottishStep(createEmptyProfile());
    expect(errors.higher_subjects).toBeTruthy();
  });

  it('passes with three Highers filled in', () => {
    const profile = createEmptyProfile();
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'mathematics', grade: 'B' },
    ];
    expect(hasErrors(validateScottishStep(profile))).toBe(false);
  });
});

describe('validateIbStep', () => {
  it('requires total points and three HL subjects', () => {
    const errors = validateIbStep(createEmptyProfile());
    expect(errors.total_points).toBeTruthy();
    expect(errors.higher_level_subjects).toBeTruthy();
  });

  it('passes with total points and three HL subjects filled in', () => {
    const profile = createEmptyProfile();
    profile.ib_profile.total_points = 38;
    profile.ib_profile.higher_level_subjects = [
      { subject_id: 'chemistry', grade: '6' },
      { subject_id: 'biology', grade: '6' },
      { subject_id: 'mathematics', grade: '5' },
    ];
    expect(hasErrors(validateIbStep(profile))).toBe(false);
  });
});

describe('validateBtecStep', () => {
  it('requires qualification and grade', () => {
    const errors = validateBtecStep(createEmptyProfile());
    expect(errors.qualification).toBeTruthy();
    expect(errors.grade).toBeTruthy();
  });

  it('passes when both fields are filled in', () => {
    const profile = createEmptyProfile();
    profile.btec_profile.qualification = 'BTEC Extended Diploma';
    profile.btec_profile.grade = 'D*D*D*';
    expect(hasErrors(validateBtecStep(profile))).toBe(false);
  });
});

describe('validateAccessToHeStep', () => {
  it('requires both attestation checkboxes', () => {
    const errors = validateAccessToHeStep(createEmptyProfile());
    expect(errors.provider_approved_by_institution).toBeTruthy();
    expect(errors.requirements_met).toBeTruthy();
  });

  it('passes when both are checked', () => {
    const profile = createEmptyProfile();
    profile.access_to_he_profile.provider_approved_by_institution = true;
    profile.access_to_he_profile.requirements_met = true;
    expect(hasErrors(validateAccessToHeStep(profile))).toBe(false);
  });
});

describe('validateGraduateStep', () => {
  it('requires degree classification and status', () => {
    const errors = validateGraduateStep(createEmptyProfile());
    expect(errors.degree_classification).toBeTruthy();
    expect(errors.degree_status).toBeTruthy();
  });

  it('requires GAMSAT scores when GAMSAT is marked as taken', () => {
    const profile = createEmptyProfile();
    profile.graduate_profile.degree_classification = 'upper_second';
    profile.graduate_profile.degree_status = 'completed';
    profile.admissions_tests.gamsat.taken = true;
    const errors = validateGraduateStep(profile);
    expect(errors.gamsat_overall_score).toBeTruthy();
    expect(errors.gamsat_section_0).toBeTruthy();
  });

  it('passes with a complete graduate profile and no GAMSAT', () => {
    const profile = createEmptyProfile();
    profile.graduate_profile.degree_classification = 'upper_second';
    profile.graduate_profile.degree_status = 'completed';
    expect(hasErrors(validateGraduateStep(profile))).toBe(false);
  });
});

describe('validateInternationalStep', () => {
  it('requires qualification name and equivalence status', () => {
    const errors = validateInternationalStep(createEmptyProfile());
    expect(errors.name).toBeTruthy();
    expect(errors.equivalence_status).toBeTruthy();
  });

  it('passes when both are filled in', () => {
    const profile = createEmptyProfile();
    profile.international_qualification.name = 'Abitur';
    profile.international_qualification.equivalence_status = 'verified';
    expect(hasErrors(validateInternationalStep(profile))).toBe(false);
  });
});

describe('requiresEnglishLanguageEvidence / validateEnglishLanguageStep', () => {
  it('is not required for home fee status', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.fee_status = 'home';
    expect(requiresEnglishLanguageEvidence(profile)).toBe(false);
    expect(hasErrors(validateEnglishLanguageStep(profile))).toBe(false);
  });

  it('requires a test selection for international fee status', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.fee_status = 'international';
    expect(requiresEnglishLanguageEvidence(profile)).toBe(true);
    expect(validateEnglishLanguageStep(profile).test).toBeTruthy();
  });

  it('does not require scores when exemption is claimed', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.fee_status = 'international';
    profile.english_language_profile.test = 'exemption_claimed';
    expect(hasErrors(validateEnglishLanguageStep(profile))).toBe(false);
  });

  it('requires all component scores for a real test', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.fee_status = 'international';
    profile.english_language_profile.test = 'ielts_academic';
    const errors = validateEnglishLanguageStep(profile);
    expect(errors.overall).toBeTruthy();
    expect(errors.reading).toBeTruthy();
  });

  it('passes with a complete test score set', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.fee_status = 'international';
    profile.english_language_profile.test = 'ielts_academic';
    profile.english_language_profile.overall = 7.5;
    profile.english_language_profile.reading = 7;
    profile.english_language_profile.writing = 7;
    profile.english_language_profile.listening = 7;
    profile.english_language_profile.speaking = 7;
    expect(hasErrors(validateEnglishLanguageStep(profile))).toBe(false);
  });
});

describe('validateUniversitiesStep', () => {
  it('requires at least one university', () => {
    expect(validateUniversitiesStep(createEmptyProfile()).university_ids).toBeTruthy();
  });

  it('passes when at least one is selected', () => {
    const profile = createEmptyProfile();
    profile.university_ids = ['keele-a100'];
    expect(hasErrors(validateUniversitiesStep(profile))).toBe(false);
  });
});
