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

describe('toStudentProfile Scottish route filtering', () => {
  function profileWithScottishRouteAndStaleEnglishQualifications() {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.applicant_identity = {
      ...profile.applicant_identity,
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'scotland',
      age_at_course_start_band: 'age_18',
      current_uk_residence: 'yes',
    };
    profile.gcse_profile.subjects = {
      english_language: '9',
      english_literature: '8',
      mathematics: '9',
      biology: '9',
      chemistry: '9',
      physics: '9',
    };
    profile.gcse_profile.additional_subjects = [{ subject_id: 'history', grade: '8' }];
    profile.a_level_profile.subjects = [
      { subject_id: 'chemistry', predicted_grade: 'E', achieved_grade: '', practical_endorsement: 'fail' },
      { subject_id: 'psychology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.a_level_profile.completed_in_one_sitting = false;
    profile.a_level_profile.epq = { status: 'predicted', grade: 'A*', taken_alongside_a_levels: true };
    profile.scottish_profile.completed_in_one_sitting = true;
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A', school_year: 's4', first_attempt: true },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english_language', grade: 'A', school_year: 's5', first_attempt: true },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'physics', grade: 'A', school_year: 's6', first_attempt: true },
      { subject_id: 'other', grade: 'A', school_year: 's6', first_attempt: true },
    ];
    profile.admissions_tests.ucat = {
      taken: true,
      total_score: 2000,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 670,
        decision_making: 665,
        quantitative_reasoning: 665,
      },
      sjt_band: 4,
      test_year: 2026,
    };
    return profile;
  }

  it('does not submit stale GCSE or A-level evidence as active Scottish-route evidence', () => {
    const profile = profileWithScottishRouteAndStaleEnglishQualifications();
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as {
      subjects: Record<string, unknown>;
      additional_subjects: unknown[];
      total_gcse_count: number;
      top_9_gcse_grades: unknown[];
    };
    const aLevel = studentProfile.a_level_profile as {
      subjects: unknown[];
      completed_in_one_sitting: boolean | null;
      epq: Record<string, unknown>;
    };
    const scottishProfile = studentProfile.scottish_profile as {
      national_5_subjects: { subject_id: string; grade: string }[];
      higher_subjects: { subject_id: string; grade: string }[];
      advanced_higher_subjects: { subject_id: string; grade: string }[];
    };

    expect(profile.gcse_profile.additional_subjects).toEqual([{ subject_id: 'history', grade: '8' }]);
    expect(profile.a_level_profile.subjects.map((subject) => subject.subject_id)).toEqual(['chemistry', 'psychology']);
    expect(studentProfile.qualification_route).toBe('scottish');
    expect(gcse).toEqual({
      subjects: {},
      additional_subjects: [],
      total_gcse_count: 0,
      top_9_gcse_grades: [],
    });
    expect(aLevel).toEqual({
      subjects: [],
      sitting_status: 'first_sitting',
      completed_in_one_sitting: null,
      epq: { status: 'not_taken', grade: null, taken_alongside_a_levels: null },
    });
    expect(scottishProfile.national_5_subjects).toHaveLength(1);
    expect(scottishProfile.higher_subjects).toHaveLength(5);
    expect(scottishProfile.advanced_higher_subjects).toHaveLength(2);
    expect(JSON.stringify(studentProfile)).not.toContain('psychology');
    expect(JSON.stringify(studentProfile)).not.toContain('history');

    const result = predict({
      universityIds: ['glasgow-a100'],
      studentProfile,
    })[0].result_card as { recommendation_display_state: string };

    expect(result.recommendation_display_state).toBe('standard');
  });

  it('submits retained A-level evidence after switching back to the A-level route', () => {
    const profile = profileWithScottishRouteAndStaleEnglishQualifications();
    profile.course_target.qualification_route = 'a_level';

    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as {
      additional_subjects: { subject_id: string; grade: string }[];
      total_gcse_count: number;
    };
    const aLevel = studentProfile.a_level_profile as {
      subjects: { subject_id: string; predicted_grade: string | null }[];
      completed_in_one_sitting: boolean | null;
      epq: Record<string, unknown>;
    };

    expect(studentProfile.qualification_route).toBe('a_level');
    expect(gcse.additional_subjects).toEqual([{ subject_id: 'history', grade: '8' }]);
    expect(gcse.total_gcse_count).toBe(7);
    expect(aLevel.subjects.map((subject) => subject.subject_id)).toEqual(['chemistry', 'psychology']);
    expect(aLevel.completed_in_one_sitting).toBe(false);
    expect(aLevel.epq).toEqual({ status: 'predicted', grade: 'A*', taken_alongside_a_levels: true });
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

  it('seeds five Scottish Higher rows for new profiles', () => {
    expect(createEmptyProfile().scottish_profile.higher_subjects).toHaveLength(5);
  });

  it('seeds six optional National 5 rows for new Scottish profiles', () => {
    expect(createEmptyProfile().scottish_profile.national_5_subjects).toHaveLength(6);
  });

  it('preserves entered National 5 rows through studentProfile mapping', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A', school_year: 's4', first_attempt: true },
      { subject_id: 'mathematics', grade: 'B', school_year: 's4', first_attempt: true },
      { subject_id: '', grade: '' },
    ];

    const studentProfile = toStudentProfile(profile);
    const scottishProfile = studentProfile.scottish_profile as {
      national_5_subjects: {
        subject_id: string;
        grade: string;
        predicted_grade: string;
        school_year: string;
        sitting_id: string;
        first_attempt: boolean;
      }[];
    };

    expect(scottishProfile.national_5_subjects).toEqual([
      {
        subject_id: 'english_language',
        grade: 'A',
        predicted_grade: 'A',
        school_year: 's4',
        sitting_id: 's4',
        first_attempt: true,
      },
      {
        subject_id: 'mathematics',
        grade: 'B',
        predicted_grade: 'B',
        school_year: 's4',
        sitting_id: 's4',
        first_attempt: true,
      },
    ]);
  });

  it('preserves Applications of Mathematics as distinct from Mathematics in Scottish Higher mapping', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'applications_of_mathematics', grade: 'A', school_year: 's5', first_attempt: true },
    ];

    const studentProfile = toStudentProfile(profile);
    const scottishProfile = studentProfile.scottish_profile as {
      higher_subjects: {
        subject_id: string;
        grade: string;
        predicted_grade: string;
        school_year: string;
        sitting_id: string;
        first_attempt: boolean;
      }[];
    };

    expect(scottishProfile.higher_subjects[2]).toEqual({
      subject_id: 'applications_of_mathematics',
      grade: 'A',
      predicted_grade: 'A',
      school_year: 's5',
      sitting_id: 's5',
      first_attempt: true,
    });
    expect(scottishProfile.higher_subjects.map((subject) => subject.subject_id)).not.toContain('mathematics');
  });

  it('maps the Glasgow Scottish standard Case 1 wizard profile as eligible', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.applicant_identity = {
      ...profile.applicant_identity,
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'scotland',
      age_at_course_start_band: 'age_18',
      current_uk_residence: 'yes',
    };
    profile.scottish_profile.completed_in_one_sitting = true;
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A', school_year: 's4', first_attempt: true },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english_language', grade: 'A', school_year: 's5', first_attempt: true },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'physics', grade: 'A', school_year: 's6', first_attempt: true },
      { subject_id: 'other', grade: 'A', school_year: 's6', first_attempt: true },
    ];
    profile.admissions_tests.ucat = {
      taken: true,
      total_score: 2000,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 670,
        decision_making: 665,
        quantitative_reasoning: 665,
      },
      sjt_band: 4,
      test_year: 2026,
    };

    const result = predict({
      universityIds: ['glasgow-a100'],
      studentProfile: toStudentProfile(profile),
    })[0].result_card as {
      recommendation_display_state: string;
      primary_user_facing_recommendation: string;
      decision_transparency?: {
        compact_status?: { label: string; tone: string };
      };
      academic_requirement_checks?: { label: string; status: string }[];
    };

    expect(result.recommendation_display_state).toBe('standard');
    expect(result.decision_transparency?.compact_status).toMatchObject({
      label: 'You meet the academic requirements.',
      tone: 'positive',
    });
    expect(result.academic_requirement_checks?.map((entry) => [
      entry.label,
      entry.status,
    ])).toEqual([
      ['National 5 English at grade B', 'met'],
      ['Scottish standard route', 'met'],
    ]);
    expect(result.primary_user_facing_recommendation).not.toMatch(/not suitable/i);
  });

  it('does not let Glasgow Case 8 treat Higher Applications of Mathematics as Higher Mathematics', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.applicant_identity = {
      ...profile.applicant_identity,
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'scotland',
      age_at_course_start_band: 'age_18',
      current_uk_residence: 'yes',
    };
    profile.scottish_profile.completed_in_one_sitting = true;
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A', school_year: 's4', first_attempt: true },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'applications_of_mathematics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'english_language', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'history', grade: 'B', school_year: 's5', first_attempt: true },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true },
    ];
    profile.admissions_tests.ucat = {
      taken: true,
      total_score: 2000,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 670,
        decision_making: 665,
        quantitative_reasoning: 665,
      },
      sjt_band: 4,
      test_year: 2026,
    };

    const result = predict({
      universityIds: ['glasgow-a100'],
      studentProfile: toStudentProfile(profile),
    })[0].result_card as {
      primary_user_facing_recommendation: string;
      academic_requirement_checks?: { label: string; status: string }[];
    };

    expect(result.academic_requirement_checks?.map((entry) => [
      entry.label,
      entry.status,
    ])).toEqual([
      ['National 5 English at grade B', 'met'],
      ['Scottish standard route', 'not_met'],
    ]);
    expect(result.primary_user_facing_recommendation).toBe('Not currently eligible');
  });

  it('maps the Glasgow Scottish adjusted Case 3 wizard profile as eligible', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.applicant_identity = {
      ...profile.applicant_identity,
      applicant_type: 'school_leaver',
      fee_status: 'home',
      domicile: 'scotland',
      age_at_course_start_band: 'age_18',
      current_uk_residence: 'yes',
    };
    profile.contextual_profile.home_area_region.simd_quintile = 'q1';
    profile.contextual_profile.access_programmes.participation_status = 'yes';
    profile.contextual_profile.access_programmes.other_programmes = [
      { programme_id: 'glasgow_reach', status: 'completed' },
    ];
    profile.scottish_profile.completed_in_one_sitting = true;
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'B', school_year: 's4', first_attempt: true },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
      { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true },
      { subject_id: 'history', grade: 'B', school_year: 's5', first_attempt: true },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
      { subject_id: 'biology', grade: 'C', school_year: 's6', first_attempt: true },
    ];
    profile.admissions_tests.ucat = {
      taken: true,
      total_score: 2000,
      score_scale: 2700,
      subtests: {
        verbal_reasoning: 670,
        decision_making: 665,
        quantitative_reasoning: 665,
      },
      sjt_band: 4,
      test_year: 2026,
    };

    const result = predict({
      universityIds: ['glasgow-a100'],
      studentProfile: toStudentProfile(profile),
    })[0].result_card as {
      recommendation_display_state: string;
      primary_user_facing_recommendation: string;
      contextual_status?: string | null;
      contextual_confirmation?: { collapsed_label?: string } | null;
      decision_transparency?: {
        compact_status?: { label: string; tone: string };
        decision_path?: { checks?: { label: string; summary?: string }[] }[];
      };
      academic_requirement_checks?: { label: string; status: string }[];
      alternative_academic_offer?: { pathway_id?: string; alternative_offer?: string } | null;
    };

    expect(result.recommendation_display_state).toBe('standard');
    expect(result.contextual_status).toBe('confirmed');
    expect(result.contextual_confirmation?.collapsed_label).toBe('Glasgow adjusted Scottish route confirmed');
    expect(result.decision_transparency?.compact_status).toMatchObject({
      label: 'Contextual eligibility confirmed.',
      tone: 'positive',
    });
    expect(result.academic_requirement_checks?.map((entry) => [
      entry.label,
      entry.status,
    ])).toEqual([
      ['National 5 English at grade B', 'met'],
      ['Scottish adjusted/contextual route', 'met'],
    ]);
    expect(result.alternative_academic_offer).toMatchObject({
      pathway_id: 'glasgow_scottish_adjusted',
      alternative_offer: 'AAABB or AAAAC Scottish Highers + BC Advanced Highers',
    });
    expect(
      result.decision_transparency?.decision_path
        ?.flatMap((stage) => stage.checks ?? [])
        .find((entry) => entry.label === 'Applicant pool')?.summary,
    ).toBe('Home, Scotland-domiciled applicants (contextual/widening participation)');
    expect(result.primary_user_facing_recommendation).not.toMatch(/information needed|not suitable/i);
  });

  it('pads older stored National 5 rows to five without replacing entries', () => {
    const profile = normaliseStoredProfile({
      scottish_profile: {
        national_5_subjects: [
          { subject_id: 'english_language', grade: 'A' },
          { subject_id: 'mathematics', grade: 'B' },
        ],
      },
    });

    expect(profile.scottish_profile.national_5_subjects).toEqual([
      { subject_id: 'english_language', grade: 'A' },
      { subject_id: 'mathematics', grade: 'B' },
      { subject_id: '', grade: '' },
      { subject_id: '', grade: '' },
      { subject_id: '', grade: '' },
    ]);
  });

  it('does not truncate stored National 5 rows beyond five', () => {
    const national5Subjects = [
      { subject_id: 'english_language', grade: 'A' },
      { subject_id: 'mathematics', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'physics', grade: 'A' },
      { subject_id: 'history', grade: 'B' },
    ];
    const profile = normaliseStoredProfile({
      scottish_profile: {
        national_5_subjects: national5Subjects,
      },
    });

    expect(profile.scottish_profile.national_5_subjects).toEqual(national5Subjects);
  });

  it('pads older stored Scottish Higher rows to five without replacing entries', () => {
    const profile = normaliseStoredProfile({
      scottish_profile: {
        higher_subjects: [
          { subject_id: 'chemistry', grade: 'A' },
          { subject_id: 'biology', grade: 'B' },
          { subject_id: 'mathematics', grade: 'A' },
        ],
      },
    });

    expect(profile.scottish_profile.higher_subjects).toEqual([
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'B' },
      { subject_id: 'mathematics', grade: 'A' },
      { subject_id: '', grade: '' },
      { subject_id: '', grade: '' },
    ]);
  });

  it('pads older stored Scottish Advanced Higher rows to three without replacing entries', () => {
    const profile = normaliseStoredProfile({
      scottish_profile: {
        advanced_higher_subjects: [
          { subject_id: 'chemistry', grade: 'A' },
          { subject_id: 'biology', grade: 'B' },
        ],
      },
    });

    expect(profile.scottish_profile.higher_subjects).toHaveLength(5);
    expect(profile.scottish_profile.advanced_higher_subjects).toEqual([
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'B' },
      { subject_id: '', grade: '' },
    ]);
  });

  it('does not truncate stored Scottish Higher rows beyond five', () => {
    const higherSubjects = [
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'mathematics', grade: 'A' },
      { subject_id: 'physics', grade: 'A' },
      { subject_id: 'english_language', grade: 'B' },
      { subject_id: 'history', grade: 'A' },
    ];
    const profile = normaliseStoredProfile({
      scottish_profile: {
        higher_subjects: higherSubjects,
      },
    });

    expect(profile.scottish_profile.higher_subjects).toEqual(higherSubjects);
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
    profile.contextual_profile.home_area_region.simd_quintile = 'q1';
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
    expect((contextual.home_area_region as Record<string, unknown>).simd_quintile).toBe('q1');
    expect(identity.contextual).toBe(false);
    expect(identity.contextual_flags.free_school_meals).toBe(false);
    expect(identity.contextual_flags.simd20).toBeUndefined();
    expect(identity.contextual_flags.simd40).toBeUndefined();
    expect(studentProfile.qualification_route).toBe('a_level');
  });

  it('loads canonical manual SIMD values from saved profiles', () => {
    const profile = normaliseStoredProfile({
      contextual_profile: {
        home_area_region: {
          simd_quintile: 'unknown',
        },
        school_education: {
          current_or_most_recent_uk_school_independent_fee_paying: 'not_sure',
        },
      },
    });

    expect(profile.contextual_profile.home_area_region.simd_quintile).toBe('unknown');
    expect(profile.contextual_profile.school_education.current_or_most_recent_uk_school_independent_fee_paying).toBe(
      'not_sure',
    );
  });

  it('loads canonical manual SIMD not-applicable values from saved profiles', () => {
    const profile = normaliseStoredProfile({
      contextual_profile: {
        home_area_region: {
          simd_quintile: 'not_applicable',
        },
      },
    });

    expect(profile.contextual_profile.home_area_region.simd_quintile).toBe('not_applicable');
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
