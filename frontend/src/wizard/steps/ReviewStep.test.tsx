import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createEmptyProfile, type WizardProfile } from '../profileTypes';
import { ReviewStep } from './ReviewStep';

function reviewSection(name: string) {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement;
}

function expectReviewValue(section: HTMLElement, label: string, value: string) {
  expect(within(section).getByText(label).nextElementSibling).toHaveTextContent(value);
}

function profileWithEpq(takenAlongside: boolean | null): WizardProfile {
  const profile = createEmptyProfile();
  profile.a_level_profile.subjects = [
    { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
    { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
    { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
  ];
  profile.a_level_profile.epq = {
    status: 'predicted',
    grade: 'A',
    taken_alongside_a_levels: takenAlongside,
  };
  return profile;
}

describe('ReviewStep EPQ display', () => {
  it.each([
    [true, 'Yes'],
    [false, 'No'],
    [null, 'Not sure'],
  ] as const)('shows taken-alongside evidence as %s', (takenAlongside, expected) => {
    render(<ReviewStep profile={profileWithEpq(takenAlongside)} updateProfile={() => {}} errors={{}} />);

    const aLevels = reviewSection('A levels');
    expectReviewValue(aLevels, 'EPQ', 'Predicted grade A');
    expectReviewValue(aLevels, 'Taken alongside A-levels', expected);
  });

  it('does not show taken-alongside evidence for planned EPQ', () => {
    const profile = profileWithEpq(true);
    profile.a_level_profile.epq = {
      status: 'planning',
      grade: null,
      taken_alongside_a_levels: null,
    };

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expect(within(reviewSection('A levels')).queryByText('Taken alongside A-levels')).not.toBeInTheDocument();
  });
});
