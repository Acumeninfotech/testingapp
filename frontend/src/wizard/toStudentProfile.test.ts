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

  it('caps top_9_gcse_grades at 9 even if more are somehow present', () => {
    const profile = fillCoreGcses(createEmptyProfile());
    profile.gcse_profile.additional_subjects = [
      { subject_id: 'history', grade: '9' },
      { subject_id: 'geography', grade: '8' },
      { subject_id: 'french', grade: '7' },
      { subject_id: 'computer_science', grade: '9' },
      { subject_id: 'music', grade: '6' },
    ];
    const studentProfile = toStudentProfile(profile);
    const gcse = studentProfile.gcse_profile as Record<string, unknown>;
    expect((gcse.top_9_gcse_grades as string[]).length).toBe(9);
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
