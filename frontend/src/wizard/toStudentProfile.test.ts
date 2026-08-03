import { describe, expect, it } from 'vitest';
import { createEmptyProfile } from './profileTypes';
import { toStudentProfile } from './toStudentProfile';

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
});

describe('toStudentProfile identity mapping', () => {
  it('sends the age-at-course-start band and does not send date of birth', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.age_at_course_start_band = 'age_17';
    profile.applicant_identity.date_of_birth = '2009-08-01';

    const studentProfile = toStudentProfile(profile);
    const identity = studentProfile.applicant_identity as Record<string, unknown>;

    expect(identity.age_at_course_start_band).toBe('age_17');
    expect(identity.date_of_birth).toBeUndefined();
  });
});
