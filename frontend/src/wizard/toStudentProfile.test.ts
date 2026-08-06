import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createEmptyProfile } from './profileTypes';
import { toStudentProfile } from './toStudentProfile';
import { normaliseStoredProfile } from './useWizardProfile';

const require = createRequire(import.meta.url);
const { predict } = require('../../../server/src/predict');
const {
  collectContextualEvidence,
} = require('../../../assets/js/engine/contextual-eligibility-framework');
const {
  evaluateContextualEligibility,
  evaluateCourseEligibility,
} = require('../../../assets/js/engine/eligibility-evaluator');
const astonCourse = require('../../../data/universities/aston-a100.json');

function fillCoreGcses(profile: ReturnType<typeof createEmptyProfile>) {
  profile.gcse_profile.subjects = {
    english_language: '9',
    mathematics: '9',
    biology: '9',
    chemistry: '9',
    physics: '8',
  };
  return profile;
}

describe('toStudentProfile GCSE mapping', () => {
  it('counts only the 5 core/science GCSEs when no additional subjects are entered', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as Record<string, unknown>;
    expect(gcse.total_gcse_count).toBe(5);
    expect((gcse.top_9_gcse_grades as string[]).length).toBe(5);
  });

  it('includes additional GCSEs in total_gcse_count and top_9_gcse_grades', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'geography', grade: '8' },
      { subject_id: 'french', grade: '7' },
      { subject_id: 'computer_science', grade: '9' },
    ];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as Record<string, unknown>;
    expect(gcse.total_gcse_count).toBe(9);
    expect((gcse.top_9_gcse_grades as string[]).length).toBe(9);
  });

  it('caps top_9_gcse_grades at MAX_GCSE_COUNT (11) even if more are somehow present', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'geography', grade: '8' },
      { subject_id: 'french', grade: '7' },
      { subject_id: 'computer_science', grade: '9' },
      { subject_id: 'music', grade: '6' },
      { subject_id: 'psychology', grade: '9' },
      { subject_id: 'spanish', grade: '8' },
      { subject_id: 'art_and_design', grade: '9' },
    ];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as Record<string, unknown>;
    expect((gcse.top_9_gcse_grades as string[]).length).toBe(11);
  });

  it('accepts a full 10-GCSE profile and includes every subject, matching the Birmingham reference applicant', () => {
    const profile = createEmptyProfile();
    profile.gcse_profile.subjects = {
      english_language: '9',
      english_literature: '9',
      mathematics: '9',
      biology: '9',
      chemistry: '9',
      physics: '9',
    };
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'computer_science', grade: '9' },
      { subject_id: 'french', grade: '9' },
      { subject_id: 'geography', grade: '9' },
    ];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as {
      subjects: Record<string, unknown>;
      additional_subjects: { subject_id: string; grade: string }[];
      total_gcse_count: number;
      top_9_gcse_grades: string[];
    };
    expect(gcse.total_gcse_count).toBe(10);
    expect(gcse.subjects.english_literature).toBe('9');
    expect(gcse.additional_subjects.some((subject) => subject.subject_id === 'english_literature')).toBe(false);
    expect(gcse.top_9_gcse_grades).toHaveLength(10);
    expect(gcse.top_9_gcse_grades.every((grade) => grade === '9')).toBe(true);
  });

  it('canonicalises legacy additional English Literature rows into gcse_profile.subjects.english_literature', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'english_literature', grade: '8' },
      { subject_id: 'history', grade: '7' },
    ];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as {
      subjects: Record<string, unknown>;
      additional_subjects: { subject_id: string; grade: string }[];
      total_gcse_count: number;
    };
    expect(gcse.subjects.english_literature).toBe('8');
    expect(gcse.additional_subjects).toEqual([{ subject_id: 'history', grade: '7' }]);
    expect(gcse.total_gcse_count).toBe(7);
  });

  it('maps combined science mode to a combined_science subject grade and excludes separate sciences', () => {
    const profile = createEmptyProfile();
    profile.gcse_profile.subjects.english_language = '9';
    profile.gcse_profile.subjects.mathematics = '9';
    profile.gcse_profile.science_mode = 'combined_science';
    profile.gcse_profile.combined_science_grade = '7';
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as { subjects: Record<string, unknown>; total_gcse_count: number };
    expect(gcse.subjects.combined_science).toBe('7/7');
    expect(gcse.total_gcse_count).toBe(4); // english + maths + 2 combined science grades
  });

  it('ignores additional-subject rows with a subject but no grade', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    profile.gcse_profile.additional_subjects = [{ subject_id: 'history', grade: '' }];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as { additional_subjects: unknown[]; total_gcse_count: number };
    expect(gcse.additional_subjects).toHaveLength(0);
    expect(gcse.total_gcse_count).toBe(5);
  });
});

describe('toStudentProfile A-level mapping', () => {
  it('maps same-sitting confirmation to the engine field', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.completed_in_one_sitting = true;
    const studentProfile = toStudentProfile(profile);
    const aLevel = studentProfile.a_level_profile as Record<string, unknown>;
    expect(aLevel.completed_in_one_sitting).toBe(true);
  });

  it('normalises missing EPQ to not taken in the submitted profile', () => {
    const profile = createEmptyProfile();
    delete profile.a_level_profile.epq;

    const studentProfile = toStudentProfile(profile);
    const aLevel = studentProfile.a_level_profile as Record<string, unknown>;

    expect(aLevel.epq).toEqual({ status: 'not_taken', grade: null, taken_alongside_a_levels: null });
  });

  it('preserves predicted and achieved EPQ grades without changing A-level subjects', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.a_level_profile.epq = { status: 'predicted', grade: 'A*', taken_alongside_a_levels: true };

    const studentProfile = toStudentProfile(profile);
    const aLevel = studentProfile.a_level_profile as {
      subjects: { subject_id: string }[];
      epq: Record<string, unknown>;
    };

    expect(aLevel.epq).toEqual({ status: 'predicted', grade: 'A*', taken_alongside_a_levels: true });
    expect(aLevel.subjects).toHaveLength(3);
    expect(aLevel.subjects.map((subject) => subject.subject_id)).toEqual(['chemistry', 'biology', 'mathematics']);

    profile.a_level_profile.epq = { status: 'achieved', grade: 'A', taken_alongside_a_levels: false };
    expect((toStudentProfile(profile).a_level_profile as Record<string, unknown>).epq).toEqual({
      status: 'achieved',
      grade: 'A',
      taken_alongside_a_levels: false,
    });
  });

  it('clears submitted EPQ grades for not taken and planning statuses', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.epq = { status: 'planning', grade: 'A', taken_alongside_a_levels: true };

    expect((toStudentProfile(profile).a_level_profile as Record<string, unknown>).epq).toEqual({
      status: 'planning',
      grade: null,
      taken_alongside_a_levels: null,
    });

    profile.a_level_profile.epq = { status: 'not_taken', grade: 'A*', taken_alongside_a_levels: false };
    expect((toStudentProfile(profile).a_level_profile as Record<string, unknown>).epq).toEqual({
      status: 'not_taken',
      grade: null,
      taken_alongside_a_levels: null,
    });
  });

  it('preserves unknown EPQ taken-alongside evidence as null', () => {
    const profile = createEmptyProfile();
    profile.a_level_profile.epq = { status: 'predicted', grade: 'A', taken_alongside_a_levels: null };

    expect((toStudentProfile(profile).a_level_profile as Record<string, unknown>).epq).toEqual({
      status: 'predicted',
      grade: 'A',
      taken_alongside_a_levels: null,
    });
  });
});

describe('Aston A100 frontend payload contextual route integration', () => {
  function astonAabWizardProfile() {
    const profile = createEmptyProfile();
    profile.applicant_identity.applicant_type = 'school_leaver';
    profile.applicant_identity.fee_status = 'home';
    profile.applicant_identity.domicile = 'england';
    profile.applicant_identity.age_at_course_start_band = 'age_18';
    profile.applicant_identity.current_uk_residence = 'yes';
    profile.gcse_profile.subjects = {
      english_language: '6',
      english_literature: '',
      mathematics: '6',
      biology: '6',
      chemistry: '6',
      physics: '6',
    };
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '6' },
      { subject_id: 'geography', grade: '6' },
    ];
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'mathematics', predicted_grade: 'B', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.a_level_profile.completed_in_one_sitting = true;
    profile.admissions_tests.ucat = {
      taken: true,
      total_score: 2100,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 700,
        decision_making: 700,
        quantitative_reasoning: 700,
      },
      test_year: 2026,
      sjt_band: 4,
    };
    return profile;
  }

  function evaluateWizardProfile(profile: ReturnType<typeof createEmptyProfile>) {
    const studentProfile = toStudentProfile(profile);
    const prediction = predict({
      universityIds: ['aston-a100'],
      studentProfile,
    })[0].result_card;
    const contextualEligibility = evaluateContextualEligibility(astonCourse, studentProfile);
    const eligibility = evaluateCourseEligibility(astonCourse, studentProfile);
    const evidence = collectContextualEvidence(studentProfile);

    return {
      studentProfile,
      prediction,
      contextualEligibility,
      eligibility,
      evidence,
    };
  }

  it('sends UCAT bursary changes through the real Aston prediction path', () => {
    const unansweredProfile = astonAabWizardProfile();
    const unanswered = evaluateWizardProfile(unansweredProfile);

    expect(
      (unanswered.studentProfile.contextual_profile as {
        financial_support: Record<string, unknown>;
      }).financial_support.ucat_bursary_recipient,
    ).toBeUndefined();
    expect(unanswered.evidence.financial_support.ucat_bursary_recipient).toBeUndefined();
    expect(unanswered.contextualEligibility.is_contextual).toBe(false);
    expect(unanswered.eligibility.applicant_group_ids).not.toContain('contextual');
    expect(unanswered.eligibility.status).toBe('not_eligible');
    expect(unanswered.prediction.recommendation_display_state).toBe('not_eligible');

    const yesProfile = astonAabWizardProfile();
    yesProfile.contextual_profile.financial_support.ucat_bursary_recipient = 'yes';
    const yes = evaluateWizardProfile(yesProfile);

    expect(
      (yes.studentProfile.contextual_profile as {
        financial_support: Record<string, unknown>;
      }).financial_support.ucat_bursary_recipient,
    ).toBe('yes');
    expect(yes.evidence.financial_support.ucat_bursary_recipient).toBe('yes');
    expect(yes.contextualEligibility.status).toBe('contextual');
    expect(yes.contextualEligibility.qualifying_criteria).toEqual(
      expect.arrayContaining([expect.objectContaining({ criterion_id: 'ucat_bursary' })]),
    );
    expect(yes.eligibility.applicant_group_ids).toContain('contextual');
    expect(yes.eligibility.academic_pathway).toBe('contextual');
    expect(yes.eligibility.academic_pathway_id).toBe('contextual_school_leaver_a_level');
    expect(yes.eligibility.status).toBe('eligible');
    expect(yes.prediction.recommendation_display_state).not.toBe('not_eligible');

    const noProfile = astonAabWizardProfile();
    noProfile.contextual_profile.financial_support.ucat_bursary_recipient = 'no';
    const no = evaluateWizardProfile(noProfile);

    expect(
      (no.studentProfile.contextual_profile as {
        financial_support: Record<string, unknown>;
      }).financial_support.ucat_bursary_recipient,
    ).toBe('no');
    expect(no.evidence.financial_support.ucat_bursary_recipient).toBe('no');
    expect(no.contextualEligibility.is_contextual).toBe(false);
    expect(no.eligibility.applicant_group_ids).not.toContain('contextual');
    expect(no.eligibility.status).toBe('not_eligible');
    expect(no.prediction.recommendation_display_state).toBe('not_eligible');
  });
});

describe('toStudentProfile identity mapping', () => {
  it('sends the age-at-course-start band and does not send date of birth', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.age_at_course_start_band = 'age_17';
    profile.applicant_identity.current_uk_residence = 'no';
    profile.applicant_identity.date_of_birth = '2009-08-01';

    const studentProfile = toStudentProfile(profile);
    const identity = studentProfile.applicant_identity as Record<string, unknown>;

    expect(identity.age_at_course_start_band).toBe('age_17');
    expect(identity.current_uk_residence).toBe('no');
    expect(identity.date_of_birth).toBeUndefined();
  });

  it('loads new factual fields from stored profiles and defaults missing legacy values to not sure', () => {
    const profile = normaliseStoredProfile({
      applicant_identity: {
        age_at_course_start_band: 'age_18_or_over',
      },
      contextual_profile: {
        school_education: {
          attended_uk_school_or_college_for_gcse_or_equivalent: 'yes',
        },
        personal_circumstances: {
          care_over_three_months: 'yes',
          uk_refugee_status_granted: 'no',
          ukrainian_visa_scheme: 'homes_for_ukraine',
        },
      },
    });

    expect(profile.applicant_identity.age_at_course_start_band).toBe('age_18_or_over_legacy');
    expect(profile.applicant_identity.current_uk_residence).toBe('not_sure');
    expect(profile.contextual_profile.school_education.attended_uk_school_or_college_for_gcse_or_equivalent).toBe('yes');
    expect(profile.contextual_profile.personal_circumstances.care_over_three_months).toBe('yes');
    expect(profile.contextual_profile.personal_circumstances.uk_refugee_status_granted).toBe('no');
    expect(profile.contextual_profile.personal_circumstances.ukrainian_visa_scheme).toBe('homes_for_ukraine');
  });

  it('preserves the canonical legacy broad age value when mapping to studentProfile', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.age_at_course_start_band = 'age_18_or_over_legacy';

    const studentProfile = toStudentProfile(profile);
    const identity = studentProfile.applicant_identity as Record<string, unknown>;

    expect(identity.age_at_course_start_band).toBe('age_18_or_over_legacy');
  });

  it('submits contextual_profile without deriving legacy contextual eligibility flags', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.financial_support.free_school_meals = 'yes';
    profile.contextual_profile.access_programmes.ukwpmed = {
      status: 'yes',
      programme_id: 'keele_steps2medicine',
      programme_status: 'completed',
      provider_university_id: 'keele-a100',
      completion_year: 2026,
      not_sure_programme: false,
    };

    const studentProfile = toStudentProfile(profile);
    const identity = studentProfile.applicant_identity as { contextual: boolean; contextual_flags: Record<string, boolean> };
    const contextual = studentProfile.contextual_profile as Record<string, unknown>;

    expect(contextual).toEqual(profile.contextual_profile);
    expect(identity.contextual).toBe(false);
    expect(identity.contextual_flags.free_school_meals).toBe(false);
    expect(studentProfile.qualification_route).toBe('a_level');
  });

  it('submits singular school_area without adding legacy school_areas', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.home_area_region.school_area = 'keele_region_school';

    const contextual = toStudentProfile(profile).contextual_profile as {
      home_area_region: Record<string, unknown>;
    };

    expect(contextual.home_area_region.school_area).toBe('keele_region_school');
    expect(contextual.home_area_region.school_areas).toBeUndefined();
  });

  it('loads legacy school-area arrays into the singular school_area field', () => {
    const oneLegacyArea = normaliseStoredProfile({
      contextual_profile: {
        home_area_region: {
          school_areas: ['bristol_bs_ba_state_school'],
        },
      },
    });

    expect(oneLegacyArea.contextual_profile.home_area_region.school_area).toBe('bristol_bs_ba_state_school');
    expect(oneLegacyArea.contextual_profile.home_area_region.school_areas).toBeUndefined();

    const conflictingLegacyAreas = normaliseStoredProfile({
      contextual_profile: {
        home_area_region: {
          school_areas: ['bristol_bs_ba_state_school', 'keele_region_school'],
        },
      },
    });

    expect(conflictingLegacyAreas.contextual_profile.home_area_region.school_area).toBe('unknown');
    expect(conflictingLegacyAreas.contextual_profile.home_area_region.school_areas).toBeUndefined();
  });

  it('loads conflicting legacy school-area booleans as unknown', () => {
    const profile = normaliseStoredProfile({
      contextual_profile: {
        home_area_region: {
          regional_flags: {
            bristol_bs_ba_state_school: 'yes',
            keele_region_school: 'yes',
          },
        },
      },
    });

    expect(profile.contextual_profile.home_area_region.school_area).toBe('unknown');
  });

  it('loads existing profiles without new factual fields safely', () => {
    const profile = normaliseStoredProfile({
      applicant_identity: {
        applicant_type: 'school_leaver',
      },
      contextual_profile: {
        school_education: {},
        personal_circumstances: {},
      },
    });

    expect(profile.applicant_identity.current_uk_residence).toBe('not_sure');
    expect(profile.applicant_identity.age_at_course_start_band).toBe('not_sure');
    expect(profile.contextual_profile.personal_circumstances.ukrainian_visa_scheme).toBeUndefined();
  });
});
