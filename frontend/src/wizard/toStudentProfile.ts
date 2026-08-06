import type { StudentProfile } from '../api/types';
import {
  MAX_GCSE_COUNT,
  normaliseEpqQualification,
  type IbSubject,
  type ScottishSubject,
  type WizardProfile,
} from './profileTypes';

const APPLICANT_TYPE_LABEL: Record<string, string> = {
  school_leaver: 'school_leaver',
  mature_standard: 'mature_standard',
  mature_graduate: 'mature_graduate',
};

const FEE_STATUS_LABEL: Record<string, string> = {
  home: 'home_fee',
  rest_of_uk: 'rest_of_uk_roi_fee_rate',
  international: 'international_fee',
};

function subjectList(subjects: (ScottishSubject | IbSubject)[]) {
  return subjects.filter((s) => s.subject_id !== '').map((s) => ({ subject_id: s.subject_id, grade: s.grade }));
}

// Converts the wizard's UI-shaped profile into the studentProfile object the
// existing engine expects (assets/js/engine/*.js). This is a pure data
// reshape — no eligibility or admissions logic is evaluated here. The
// qualification_route field switches which route-specific block below is
// populated; the engine itself decides what each route means.
export function toStudentProfile(profile: WizardProfile): StudentProfile {
  const gcse = profile.gcse_profile;
  const route = profile.course_target.qualification_route;
  const legacyEnglishLiteratureGrade = gcse.additional_subjects.find(
    (subject) => subject.subject_id === 'english_literature' && subject.grade !== '',
  )?.grade;
  const englishLiteratureGrade = gcse.subjects.english_literature || legacyEnglishLiteratureGrade || '';

  // Combine core + science + additional GCSEs into the flat grade list the
  // engine's GCSE-count and points-scoring checks read (getCountableGcseGrades,
  // top_9_gcse_grades fallback in interview-band-classifier.js:609-614).
  const scienceGrades =
    gcse.science_mode === 'separate_sciences'
      ? [gcse.subjects.biology, gcse.subjects.chemistry, gcse.subjects.physics]
      : [gcse.combined_science_grade, gcse.combined_science_grade];
  const additionalGrades = gcse.additional_subjects
    .filter((s) => s.subject_id !== 'english_literature')
    .filter((s) => s.subject_id !== '' && s.grade !== '')
    .map((s) => s.grade);
  const allGcseGrades = [
    gcse.subjects.english_language,
    englishLiteratureGrade,
    gcse.subjects.mathematics,
    ...scienceGrades,
    ...additionalGrades,
  ]
    .filter((g) => g !== '');
  // Field name is fixed by the engine's studentProfile contract
  // (top_9_gcse_grades - see interview-band-classifier.js:642,905-908,2011)
  // but its length is not hardcoded there; it is sliced to MAX_GCSE_COUNT so
  // no entered GCSE is silently dropped before reaching the engine. Each
  // university's own best_subject_count still decides how many are scored.
  const top9GcseGrades = [...allGcseGrades].sort().reverse().slice(0, MAX_GCSE_COUNT);

  const aLevelSubjects = profile.a_level_profile.subjects
    .filter((s) => s.subject_id !== '')
    .map((s) => ({
      subject_id: s.subject_id,
      predicted_grade: s.predicted_grade || null,
      achieved_grade: s.achieved_grade || null,
      sitting_status: profile.a_level_profile.sitting_status,
      practical_endorsement:
        s.practical_endorsement === 'not_applicable' ? null : s.practical_endorsement,
    }));
  const epq = normaliseEpqQualification(profile.a_level_profile.epq);

  const ucat = profile.admissions_tests.ucat;
  const gamsat = profile.admissions_tests.gamsat;
  const graduate = profile.graduate_profile;
  const englishLanguage = profile.english_language_profile;

  return {
    profile_id: 'wizard_profile',
    qualification_route: route,
    applicant_identity: {
      applicant_type: APPLICANT_TYPE_LABEL[profile.applicant_identity.applicant_type] ?? '',
      fee_status: FEE_STATUS_LABEL[profile.applicant_identity.fee_status] ?? '',
      domicile: profile.applicant_identity.domicile || null,
      age_at_course_start_band: profile.applicant_identity.age_at_course_start_band || null,
      contextual: profile.applicant_identity.contextual,
      contextual_flags: { ...profile.applicant_identity.contextual_flags },
      graduate: profile.applicant_identity.graduate,
      resit: {
        has_resits: profile.applicant_identity.resit.has_resits,
        subjects_resat: profile.applicant_identity.resit.subjects_resat,
      },
    },
    contextual_profile: profile.contextual_profile,
    course_target: {
      discipline: profile.course_target.discipline,
      ucas_code: profile.course_target.ucas_code,
      course_route: 'standard',
      entry_route: profile.course_target.entry_route,
    },
    application_year: profile.course_target.application_year || null,
    gcse_profile: {
      subjects: {
        ...gcse.subjects,
        english_literature: englishLiteratureGrade || undefined,
        combined_science: gcse.science_mode === 'combined_science' && gcse.combined_science_grade
          ? `${gcse.combined_science_grade}/${gcse.combined_science_grade}`
          : null,
      },
      additional_subjects: gcse.additional_subjects
        .filter((s) => s.subject_id !== 'english_literature')
        .filter((s) => s.subject_id !== '' && s.grade !== '')
        .map((s) => ({ subject_id: s.subject_id, grade: s.grade })),
      total_gcse_count: allGcseGrades.length,
      top_9_gcse_grades: top9GcseGrades,
    },
    a_level_profile: {
      subjects: aLevelSubjects,
      sitting_status: profile.a_level_profile.sitting_status,
      completed_in_one_sitting: profile.a_level_profile.completed_in_one_sitting,
      epq,
    },
    scottish_profile: {
      national_5_subjects: subjectList(profile.scottish_profile.national_5_subjects),
      higher_subjects: subjectList(profile.scottish_profile.higher_subjects),
      advanced_higher_subjects: subjectList(profile.scottish_profile.advanced_higher_subjects),
    },
    ib_profile: {
      total_points: profile.ib_profile.total_points === '' ? null : profile.ib_profile.total_points,
      higher_level_subjects: subjectList(profile.ib_profile.higher_level_subjects),
      standard_level_subjects: subjectList(profile.ib_profile.standard_level_subjects),
    },
    btec_profile: {
      qualification: profile.btec_profile.qualification || null,
      grade: profile.btec_profile.grade || null,
      subject_id: profile.btec_profile.subject_id || null,
    },
    access_to_he_profile: {
      provider_approved_by_institution: profile.access_to_he_profile.provider_approved_by_institution,
      requirements_met: profile.access_to_he_profile.requirements_met,
    },
    graduate_profile: {
      is_graduate: route === 'graduate' ? true : profile.applicant_identity.graduate,
      degree_classification: graduate.degree_classification || null,
      degree_status: graduate.degree_status || null,
      recognised_institution: graduate.recognised_institution,
      degree_age_at_course_start_years:
        graduate.degree_age_at_course_start_years === '' ? null : graduate.degree_age_at_course_start_years,
    },
    international_qualification: {
      name: profile.international_qualification.name || null,
      equivalence_status: profile.international_qualification.equivalence_status || null,
      verified_by_institution: profile.international_qualification.verified_by_institution,
      requirements_met: profile.international_qualification.requirements_met,
    },
    english_language_profile: {
      test: englishLanguage.test === 'exemption_claimed' ? null : englishLanguage.test || null,
      exemption_claimed: englishLanguage.test === 'exemption_claimed' || englishLanguage.exemption_claimed,
      overall: englishLanguage.overall === '' ? null : englishLanguage.overall,
      reading: englishLanguage.reading === '' ? null : englishLanguage.reading,
      writing: englishLanguage.writing === '' ? null : englishLanguage.writing,
      listening: englishLanguage.listening === '' ? null : englishLanguage.listening,
      speaking: englishLanguage.speaking === '' ? null : englishLanguage.speaking,
    },
    admissions_tests: {
      ucat: {
        taken: ucat.taken,
        total_score: ucat.total_score === '' ? null : ucat.total_score,
        score_scale: ucat.score_scale,
        subtests: {
          verbal_reasoning: ucat.subtests.verbal_reasoning === '' ? null : ucat.subtests.verbal_reasoning,
          decision_making: ucat.subtests.decision_making === '' ? null : ucat.subtests.decision_making,
          quantitative_reasoning:
            ucat.subtests.quantitative_reasoning === '' ? null : ucat.subtests.quantitative_reasoning,
        },
        sjt_band: ucat.sjt_band || null,
        test_year: ucat.test_year === '' ? null : ucat.test_year,
      },
      gamsat: {
        taken: gamsat.taken,
        overall_score: gamsat.overall_score === '' ? null : gamsat.overall_score,
        section_scores: gamsat.section_scores.map((s) => (s === '' ? null : s)),
      },
    },
  };
}
