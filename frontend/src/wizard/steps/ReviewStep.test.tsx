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

describe('ReviewStep contextual display', () => {
  it('shows Not provided for unanswered Home area dropdowns', () => {
    render(<ReviewStep profile={createEmptyProfile()} updateProfile={() => {}} errors={{}} />);

    const homeArea = reviewSection('Home area & region');
    expectReviewValue(homeArea, 'I live in', 'Not provided');
    expectReviewValue(homeArea, 'I live in the following area', 'Not provided');
    expectReviewValue(homeArea, 'I attended school in', 'Not provided');
  });

  it('shows contextual answers by public labels without raw programme IDs', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.home_area_region.postcode = 'BS1 1AA';
    profile.contextual_profile.home_area_region.polar4_quintile = 'q1';
    profile.contextual_profile.home_area_region.tundra_quintile = 'q3';
    profile.contextual_profile.home_area_region.home_region = 'unknown';
    profile.contextual_profile.home_area_region.specific_home_area = 'none';
    profile.contextual_profile.home_area_region.school_area = 'bristol_bs_ba_state_school';
    profile.contextual_profile.home_area_region.postcode_lookup = {
      status: 'matched',
      normalised_postcode: 'BS11AA',
      looked_up_postcode: 'BS1 1AA',
      values: {
        polar4: { value: 1, source: 'postcode_lookup' },
        tundra: { value: 3, source: 'manual' },
        imd: { value: null, source: 'unknown', dataset_year: 2019 },
      },
    };
    profile.contextual_profile.financial_support.free_school_meals = 'yes';
    profile.contextual_profile.school_education.state_non_fee_paying_school = 'not_sure';
    profile.contextual_profile.personal_circumstances.care_experienced = 'prefer_not_to_say';
    profile.contextual_profile.access_programmes.ukwpmed = {
      status: 'yes',
      programme_id: 'keele_steps2medicine',
      programme_status: 'completed',
      provider_university_id: 'keele-a100',
      completion_year: 2026,
      not_sure_programme: false,
    };
    profile.contextual_profile.access_programmes.other_programmes = [
      { programme_id: 'newcastle_partners', status: 'participating' },
    ];
    profile.contextual_profile.partner_schools = {
      status: 'yes',
      relationships: [
        {
          university_id: 'bristol-a100',
          school_name: 'Example Sixth Form',
          relationship_type: 'contextual partner school',
        },
      ],
    };

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expectReviewValue(reviewSection('Home area & region'), 'Postcode', 'BS1 1AA');
    expectReviewValue(reviewSection('Home area & region'), 'I live in', 'Not sure');
    expectReviewValue(reviewSection('Home area & region'), 'I live in the following area', 'None of the above');
    expectReviewValue(reviewSection('Home area & region'), 'I attended school in', 'State school in a Bristol BS or BA postcode area');
    expectReviewValue(reviewSection('Home area & region'), 'POLAR4 quintile', 'Quintile 1Identified from postcode');
    expectReviewValue(reviewSection('Home area & region'), 'TUNDRA quintile', 'Quintile 3');
    expectReviewValue(reviewSection('Financial support'), 'I receive or previously received free school meals', 'Yes');
    expectReviewValue(reviewSection('School & education'), 'I attended a state-funded, non-fee-paying school', 'Not sure');
    expectReviewValue(reviewSection('Personal circumstances'), 'I have experience of being in local-authority care', 'Prefer not to say');
    expectReviewValue(reviewSection('Access / WP programmes'), 'Programme', 'Steps2Medicine');
    expectReviewValue(reviewSection('Access / WP programmes'), 'Provider', 'Keele University');
    expectReviewValue(reviewSection('Access / WP programmes'), 'Status', 'Completed');
    expectReviewValue(reviewSection('Access / WP programmes'), 'Completion year', '2026');
    expect(screen.getByText('Birmingham, Brighton and Sussex, Keele, Hull York, Leicester, Manchester and Plymouth')).toBeInTheDocument();
    expectReviewValue(reviewSection('Partner schools'), 'Example Sixth Form', 'University of Bristol; contextual partner school');

    expect(screen.queryByText('keele_steps2medicine')).not.toBeInTheDocument();
    expect(screen.queryByText('programme_status')).not.toBeInTheDocument();
    expect(screen.queryByText('not_sure')).not.toBeInTheDocument();
    expect(screen.queryByText(/Guaranteed interview/i)).not.toBeInTheDocument();
    expect(screen.queryByText('BS11AA')).not.toBeInTheDocument();
    expect(screen.queryByText('postcode_lookup')).not.toBeInTheDocument();
  });

  it('handles legacy multiple school-area values as Not sure for review', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.home_area_region.school_areas = [
      'northern_ireland_bt_to_year_12',
      'keele_region_school',
    ];

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expectReviewValue(reviewSection('Home area & region'), 'I attended school in', 'Not sure');
  });
});
