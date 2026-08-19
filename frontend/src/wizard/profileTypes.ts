// Shape of the studentProfile this wizard collects, scoped to the fields the
// engine actually reads for the current readiness-bundle universities (see
// assets/js/engine/eligibility-evaluator.js, interview-band-classifier.js,
// nottingham-a100-consumer.js, hull-york-a100-consumer.js). Field names below
// mirror the engine's own keys exactly (e.g. applicant.scottish_profile,
// not scottish_qualifications) since a past audit found the data fixtures do
// not always match what the engine code actually reads.

export type QualificationRoute =
  | 'a_level'
  | 'scottish'
  | 'international_baccalaureate'
  | 'btec'
  | 'access_to_he'
  | 'graduate'
  | 'international_qualification';

export type ApplicantType = 'school_leaver' | 'mature_standard' | 'mature_graduate';
export type FeeStatus = 'home' | 'rest_of_uk' | 'international';
export type Domicile = 'england' | 'scotland' | 'wales' | 'northern_ireland' | 'other';
export type SittingStatus = 'first_sitting' | 'resit' | 'repeat';
export type PracticalEndorsement = 'pass' | 'fail' | 'not_applicable';
export type ALevelGrade = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U' | '';
export type GcseGrade = '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2' | '1' | 'U' | '';
export type SjtBand = 1 | 2 | 3 | 4 | 0;
export type AgeAtCourseStartBand =
  | 'under_17'
  | 'age_17'
  | 'age_18'
  | 'age_19'
  | 'age_20'
  | 'age_21_or_over'
  | 'age_18_or_over_legacy'
  | 'not_sure';
export type CurrentUkResidence = YesNoNotSure;
export type UkrainianVisaScheme =
  | 'homes_for_ukraine'
  | 'ukraine_family_scheme'
  | 'ukraine_extension_scheme'
  | 'none'
  | 'not_sure';
export type SchoolEducationFieldKey =
  | 'state_non_fee_paying_school'
  | 'current_or_most_recent_uk_school_independent_fee_paying'
  | 'below_average_gcse_school'
  | 'below_average_post16_school'
  | 'high_free_school_meals_school'
  | 'low_progression_to_higher_education_school'
  | 'scottish_target_or_access_school'
  | 'welsh_language_gcse_first_or_second_language'
  | 'attended_uk_school_or_college_for_gcse_or_equivalent'
  | 'attended_uk_school_or_college_for_post16_or_equivalent';
export type PersonalCircumstanceFieldKey =
  | 'care_experienced'
  | 'care_leaver'
  | 'estranged_from_family'
  | 'young_or_adult_carer'
  | 'parenting_responsibilities'
  | 'refugee'
  | 'seeking_asylum'
  | 'first_in_family_at_university'
  | 'military_family'
  | 'gypsy_roma_traveller'
  | 'disability'
  | 'care_over_three_months'
  | 'uk_refugee_status_granted'
  | 'ukrainian_visa_scheme';
export type PersonalCircumstanceValue = SensitiveAnswer | UkrainianVisaScheme;

// Scottish route: applicant.scottish_profile.{national_5_subjects,
// higher_subjects, advanced_higher_subjects}, letter grades A*-U plus SQA
// sitting evidence read by Glasgow's Scottish route implementation.
// (eligibility-evaluator.js:820-893,1885-2020; hull-york-a100-consumer.js:406-428).
export type ScottishSchoolYear = 's4' | 's5' | 's6' | '';
export interface ScottishSubject {
  subject_id: string;
  grade: ALevelGrade;
  school_year?: ScottishSchoolYear;
  sitting_id?: string;
  first_attempt?: boolean | null;
}
export interface ScottishProfile {
  completed_in_one_sitting: boolean | null;
  national_5_subjects: ScottishSubject[];
  higher_subjects: ScottishSubject[];
  advanced_higher_subjects: ScottishSubject[];
}

export const DEFAULT_SCOTTISH_HIGHER_ROWS = 5;
export const DEFAULT_SCOTTISH_ADVANCED_HIGHER_ROWS = 3;

// IB route: applicant.ib_profile.{total_points, higher_level_subjects,
// standard_level_subjects}, numeric 1-7 IB point scale
// (eligibility-evaluator.js:160-164,616-628; nottingham-a100-consumer.js:270-283).
export interface IbSubject {
  subject_id: string;
  grade: string;
}
export interface IbProfile {
  total_points: number | '';
  higher_level_subjects: IbSubject[];
  standard_level_subjects: IbSubject[];
}

// BTEC route: applicant.btec_profile.{qualification, grade, subject_id} —
// the engine reads one opaque overall grade string, not unit-level grades
// (eligibility-evaluator.js:664-715).
export interface BtecProfile {
  qualification: string;
  grade: string;
  subject_id: string;
}

// Access to HE route: applicant.access_to_he_profile.{provider_approved_by_institution,
// requirements_met} — a manual-attestation gate, not a computed credit count
// (eligibility-evaluator.js:1023-1036).
export interface AccessToHeProfile {
  provider_approved_by_institution: boolean;
  requirements_met: boolean;
}

// Graduate route: applicant.graduate_profile.* plus a co-required
// applicant.admissions_tests.gamsat when a university requires it instead of
// UCAT (eligibility-evaluator.js:717-818,1259-1346).
export type DegreeClassification = 'first' | 'upper_second' | 'lower_second' | 'third';
export interface GraduateProfile {
  is_graduate: boolean;
  degree_classification: DegreeClassification | '';
  degree_status: 'completed' | 'predicted' | 'achieved' | '';
  recognised_institution: boolean;
  degree_age_at_course_start_years: number | '';
}
export interface GamsatProfile {
  taken: boolean;
  overall_score: number | '';
  section_scores: [number | '', number | '', number | ''];
}

// International qualification route: applicant.international_qualification.{
// equivalence_status, verified_by_institution, requirements_met, name} — a
// verification-attestation gate (eligibility-evaluator.js:1023-1104).
export interface InternationalQualificationProfile {
  name: string;
  equivalence_status: 'verified' | 'pending' | '';
  verified_by_institution: boolean;
  requirements_met: boolean;
}

// English language evidence: applicant.english_language_profile.{test,
// overall, reading, writing, listening, speaking} — only test types the
// engine can actually score are offered (eligibility-evaluator.js:1207-1239;
// nottingham-a100-consumer.js:492-504 additionally scores PTE/Cambridge).
export type EnglishLanguageTest =
  | 'ielts_academic'
  | 'pte_academic'
  | 'cambridge_advanced'
  | 'cambridge_proficiency'
  | 'exemption_claimed'
  | '';
export interface EnglishLanguageProfile {
  test: EnglishLanguageTest;
  overall: number | '';
  reading: number | '';
  writing: number | '';
  listening: number | '';
  speaking: number | '';
  exemption_claimed: boolean;
}

export interface ContextualFlags {
  care_experienced: boolean;
  refugee_or_asylum_seeker: boolean;
  free_school_meals: boolean;
  first_generation_higher_education: boolean;
  school_contextual_indicator: boolean;
  ucat_bursary: boolean;
}

export type YesNoNotSure = 'yes' | 'no' | 'not_sure';
export type SensitiveAnswer = YesNoNotSure | 'prefer_not_to_say';
export type QuintileValue = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'unknown' | 'not_applicable' | '';
export type ProgrammeStatus = 'offered' | 'participating' | 'completed' | 'not_sure';
export type ContextualValueSource = 'postcode_lookup' | 'manual' | 'existing_profile' | 'unknown';
export type PostcodeLookupStatus = 'not_checked' | 'matched' | 'partial_match' | 'not_found' | 'error';
export type HomeRegionValue =
  | 'south_west_england'
  | 'north_west_england'
  | 'north_east_england_or_cumbria'
  | 'east_of_england'
  | 'none'
  | 'unknown';
export type SpecificHomeAreaValue = 'essex' | 'lincolnshire' | 'none' | 'unknown';
export type SchoolAreaValue =
  | 'northern_ireland_bt_to_year_12'
  | 'bristol_bs_ba_state_school'
  | 'keele_region_school'
  | 'none'
  | 'unknown';
export type SchoolAreaOption = Exclude<SchoolAreaValue, 'none' | 'unknown'>;

export interface PostcodeLookupValueMetadata {
  value: number | null;
  source: ContextualValueSource;
  dataset_year?: number;
}

export interface PostcodeLookupMetadata {
  status: PostcodeLookupStatus;
  normalised_postcode?: string;
  looked_up_postcode?: string;
  stale?: boolean;
  values: {
    polar4: PostcodeLookupValueMetadata;
    tundra: PostcodeLookupValueMetadata;
    imd: PostcodeLookupValueMetadata;
  };
}

export interface HomeAreaRegionProfile {
  postcode: string;
  polar4_quintile: QuintileValue;
  imd_quintile: QuintileValue;
  tundra_quintile: QuintileValue;
  simd_quintile: QuintileValue;
  home_region: HomeRegionValue | null;
  specific_home_area: SpecificHomeAreaValue | null;
  school_area: SchoolAreaValue | null;
  school_areas?: SchoolAreaOption[];
  // Legacy compatibility fields retained for existing profiles and rules.
  acorn_quintile?: QuintileValue | null;
  mem_quintile?: QuintileValue | null;
  regional_flags?: Record<string, YesNoNotSure | undefined>;
  postcode_lookup?: PostcodeLookupMetadata;
}

export interface UkwpmedProgramme {
  status: YesNoNotSure;
  programme_id: string;
  programme_status: ProgrammeStatus | '';
  provider_university_id: string;
  completion_year: number | '';
  not_sure_programme: boolean;
}

export interface OtherAccessProgramme {
  programme_id: string;
  status: ProgrammeStatus | '';
  programme_name?: string;
}

export interface AccessProgrammesProfile {
  participation_status: YesNoNotSure;
  ukwpmed: UkwpmedProgramme;
  other_programmes: OtherAccessProgramme[];
  other_programme_name: string;
}

export interface PartnerSchoolRelationship {
  university_id: string;
  university_name?: string;
  school_name: string;
  school_id?: string;
  school_identifier?: string;
  school_identifier_type?: 'apply_centre_code' | 'urn' | 'ukprn' | 'other' | '';
  relationship_type?: string;
  status?: YesNoNotSure | '';
}

export interface PartnerSchoolsProfile {
  status: YesNoNotSure;
  relationships: PartnerSchoolRelationship[];
}

export interface ContextualProfile {
  home_area_region: HomeAreaRegionProfile;
  financial_support: Record<string, YesNoNotSure | undefined>;
  school_education: Partial<Record<SchoolEducationFieldKey, YesNoNotSure | undefined>>;
  personal_circumstances: Partial<Record<PersonalCircumstanceFieldKey, PersonalCircumstanceValue | undefined>>;
  access_programmes: AccessProgrammesProfile;
  partner_schools: PartnerSchoolsProfile;
}

export interface ApplicantIdentity {
  applicant_type: ApplicantType | '';
  fee_status: FeeStatus | '';
  domicile: Domicile | '';
  age_at_course_start_band: AgeAtCourseStartBand | '';
  current_uk_residence: CurrentUkResidence | '';
  date_of_birth?: string;
  contextual: boolean;
  contextual_flags: ContextualFlags;
  graduate: boolean;
  resit: {
    has_resits: boolean;
    subjects_resat: string[];
  };
}

export interface CourseTarget {
  discipline: 'medicine';
  ucas_code: string;
  entry_route: 'standard_medicine_a100';
  application_year: number | '';
  qualification_route: QualificationRoute;
}

// Core GCSE subjects collected for every applicant. Biology/Chemistry/Physics
// are required only in 'separate_sciences' mode; 'combined_science' mode
// collects a single Combined Science grade instead (engine's
// stage_1_eligibility.gcse.science_requirement.accepted_options: 'separate_sciences'
// vs 'double_science', eligibility-evaluator.js:444-471).
export const GCSE_CORE_SUBJECT_IDS = ['english_language', 'mathematics'] as const;
export type GcseCoreSubjectId = (typeof GCSE_CORE_SUBJECT_IDS)[number];

export const GCSE_OPTIONAL_SCORING_SUBJECT_IDS = ['english_literature'] as const;
export type GcseOptionalScoringSubjectId = (typeof GCSE_OPTIONAL_SCORING_SUBJECT_IDS)[number];

export const GCSE_SEPARATE_SCIENCE_SUBJECT_IDS = ['biology', 'chemistry', 'physics'] as const;
export type GcseSeparateScienceSubjectId = (typeof GCSE_SEPARATE_SCIENCE_SUBJECT_IDS)[number];

export type GcseSubjectId =
  | GcseCoreSubjectId
  | GcseOptionalScoringSubjectId
  | GcseSeparateScienceSubjectId
  | 'combined_science';

// Kept for callers that need the full fixed-field id list (core + separate
// sciences); combined_science is a separate, mode-gated field.
export const GCSE_SUBJECT_IDS = [
  ...GCSE_CORE_SUBJECT_IDS,
  ...GCSE_SEPARATE_SCIENCE_SUBJECT_IDS,
] as const;

export type GcseScienceMode = 'separate_sciences' | 'combined_science';

export interface GcseAdditionalSubject {
  subject_id: string;
  grade: GcseGrade;
}

// Many universities score the best 8 or 9 GCSEs (best_subject_count in
// stage_1_eligibility.gcse.points_scoring, currently up to 9 across all
// configured universities - see data/universities/*.json), but real UK
// applicants commonly hold 10 or 11 GCSEs and must be able to enter their
// full profile. Each university's own best_subject_count/counted_subject_limit
// still decides how many of the entered subjects are actually scored, so
// raising this collection cap does not change any university's scoring rules.
export const MAX_GCSE_COUNT = 11;

export interface GcseProfile {
  subjects: Record<GcseCoreSubjectId | GcseSeparateScienceSubjectId, GcseGrade> &
    Partial<Record<GcseOptionalScoringSubjectId, GcseGrade>>;
  science_mode: GcseScienceMode;
  combined_science_grade: GcseGrade;
  additional_subjects: GcseAdditionalSubject[];
}

export const A_LEVEL_SCIENCE_SUBJECTS = ['biology', 'chemistry', 'physics'] as const;

export interface ALevelSubject {
  subject_id: string;
  predicted_grade: ALevelGrade;
  achieved_grade: ALevelGrade;
  practical_endorsement: PracticalEndorsement;
}

export type EpqStatus = 'not_taken' | 'planning' | 'predicted' | 'achieved';
export type EpqGrade = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface EpqQualification {
  status: EpqStatus;
  grade: EpqGrade | null;
  taken_alongside_a_levels?: boolean | null;
}

export const DEFAULT_EPQ_QUALIFICATION: EpqQualification = {
  status: 'not_taken',
  grade: null,
  taken_alongside_a_levels: null,
};

const EPQ_STATUSES = ['not_taken', 'planning', 'predicted', 'achieved'] as const;
const EPQ_GRADES = ['A*', 'A', 'B', 'C', 'D', 'E'] as const;

export function normaliseEpqQualification(epq: unknown): EpqQualification {
  if (!epq || typeof epq !== 'object') return { ...DEFAULT_EPQ_QUALIFICATION };

  const candidate = epq as Partial<EpqQualification>;
  const status = EPQ_STATUSES.includes(candidate.status as EpqStatus)
    ? candidate.status as EpqStatus
    : DEFAULT_EPQ_QUALIFICATION.status;

  if (status === 'not_taken' || status === 'planning') {
    return { status, grade: null, taken_alongside_a_levels: null };
  }

  const takenAlongside =
    typeof candidate.taken_alongside_a_levels === 'boolean'
      ? candidate.taken_alongside_a_levels
      : null;

  return {
    status,
    grade: EPQ_GRADES.includes(candidate.grade as EpqGrade) ? candidate.grade as EpqGrade : null,
    taken_alongside_a_levels: takenAlongside,
  };
}

export interface ALevelProfile {
  subjects: ALevelSubject[];
  sitting_status: SittingStatus;
  completed_in_one_sitting: boolean | null;
  epq?: EpqQualification;
}

export interface UcatProfile {
  taken: boolean;
  total_score: number | '';
  score_scale: 2700;
  subtests: {
    verbal_reasoning: number | '';
    decision_making: number | '';
    quantitative_reasoning: number | '';
  };
  sjt_band: SjtBand;
  // Year the UCAT was/will be taken. Several universities require the UCAT
  // to be taken in the same year as the application
  // (eligibility-evaluator.js:1302-1309, interview-band-classifier.js:828-874).
  test_year: number | '';
}

export interface WizardProfile {
  applicant_identity: ApplicantIdentity;
  contextual_profile: ContextualProfile;
  course_target: CourseTarget;
  gcse_profile: GcseProfile;
  a_level_profile: ALevelProfile;
  scottish_profile: ScottishProfile;
  ib_profile: IbProfile;
  btec_profile: BtecProfile;
  access_to_he_profile: AccessToHeProfile;
  graduate_profile: GraduateProfile;
  international_qualification: InternationalQualificationProfile;
  english_language_profile: EnglishLanguageProfile;
  admissions_tests: {
    ucat: UcatProfile;
    gamsat: GamsatProfile;
  };
  university_ids: string[];
}

export function createEmptyContextualProfile(): ContextualProfile {
  return {
    home_area_region: {
      postcode: '',
      polar4_quintile: 'unknown',
      imd_quintile: 'unknown',
      tundra_quintile: 'unknown',
      simd_quintile: '',
      home_region: null,
      specific_home_area: null,
      school_area: null,
      regional_flags: {},
      postcode_lookup: {
        status: 'not_checked',
        values: {
          polar4: { value: null, source: 'unknown' },
          tundra: { value: null, source: 'unknown' },
          imd: { value: null, source: 'unknown', dataset_year: 2019 },
        },
      },
    },
    financial_support: {},
    school_education: {},
    personal_circumstances: {},
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: '',
        not_sure_programme: false,
      },
      other_programmes: [],
      other_programme_name: '',
    },
    partner_schools: {
      status: 'no',
      relationships: [],
    },
  };
}

export function createEmptyProfile(): WizardProfile {
  return {
    applicant_identity: {
      applicant_type: '',
      fee_status: '',
      domicile: '',
      age_at_course_start_band: '',
      current_uk_residence: '',
      contextual: false,
      contextual_flags: {
        care_experienced: false,
        refugee_or_asylum_seeker: false,
        free_school_meals: false,
        first_generation_higher_education: false,
        school_contextual_indicator: false,
        ucat_bursary: false,
      },
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: [],
      },
    },
    contextual_profile: createEmptyContextualProfile(),
    course_target: {
      discipline: 'medicine',
      ucas_code: 'A100',
      entry_route: 'standard_medicine_a100',
      application_year: 2027,
      qualification_route: 'a_level',
    },
    gcse_profile: {
      subjects: {
        english_language: '',
        english_literature: '',
        mathematics: '',
        biology: '',
        chemistry: '',
        physics: '',
      },
      science_mode: 'separate_sciences',
      combined_science_grade: '',
      additional_subjects: [],
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: '', achieved_grade: '', practical_endorsement: 'not_applicable' },
        { subject_id: 'biology', predicted_grade: '', achieved_grade: '', practical_endorsement: 'not_applicable' },
        { subject_id: '', predicted_grade: '', achieved_grade: '', practical_endorsement: 'not_applicable' },
      ],
      sitting_status: 'first_sitting',
      completed_in_one_sitting: null,
      epq: { ...DEFAULT_EPQ_QUALIFICATION },
    },
    scottish_profile: {
      completed_in_one_sitting: null,
      national_5_subjects: [
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
      ],
      higher_subjects: [
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
      ],
      advanced_higher_subjects: [
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
        { subject_id: '', grade: '' },
      ],
    },
    ib_profile: {
      total_points: '',
      higher_level_subjects: [{ subject_id: '', grade: '' }, { subject_id: '', grade: '' }, { subject_id: '', grade: '' }],
      standard_level_subjects: [{ subject_id: '', grade: '' }, { subject_id: '', grade: '' }, { subject_id: '', grade: '' }],
    },
    btec_profile: {
      qualification: '',
      grade: '',
      subject_id: '',
    },
    access_to_he_profile: {
      provider_approved_by_institution: false,
      requirements_met: false,
    },
    graduate_profile: {
      is_graduate: false,
      degree_classification: '',
      degree_status: '',
      recognised_institution: false,
      degree_age_at_course_start_years: '',
    },
    international_qualification: {
      name: '',
      equivalence_status: '',
      verified_by_institution: false,
      requirements_met: false,
    },
    english_language_profile: {
      test: '',
      overall: '',
      reading: '',
      writing: '',
      listening: '',
      speaking: '',
      exemption_claimed: false,
    },
    admissions_tests: {
      ucat: {
        taken: false,
        total_score: '',
        score_scale: 2700,
        subtests: {
          verbal_reasoning: '',
          decision_making: '',
          quantitative_reasoning: '',
        },
        sjt_band: 0,
        test_year: 2026,
      },
      gamsat: {
        taken: false,
        overall_score: '',
        section_scores: ['', '', ''],
      },
    },
    university_ids: [],
  };
}
