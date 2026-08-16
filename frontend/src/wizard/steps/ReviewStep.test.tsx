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
    profile.applicant_identity.current_uk_residence = 'yes';
    profile.applicant_identity.age_at_course_start_band = 'age_20';
    profile.contextual_profile.home_area_region.postcode = 'BS1 1AA';
    profile.contextual_profile.home_area_region.polar4_quintile = 'q1';
    profile.contextual_profile.home_area_region.tundra_quintile = 'q3';
    profile.contextual_profile.home_area_region.simd_quintile = 'not_applicable';
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
    profile.contextual_profile.school_education.attended_uk_school_or_college_for_gcse_or_equivalent = 'yes';
    profile.contextual_profile.personal_circumstances.care_experienced = 'prefer_not_to_say';
    profile.contextual_profile.personal_circumstances.care_over_three_months = 'yes';
    profile.contextual_profile.personal_circumstances.uk_refugee_status_granted = 'yes';
    profile.contextual_profile.personal_circumstances.ukrainian_visa_scheme = 'ukraine_extension_scheme';
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

    expectReviewValue(reviewSection('Identity'), 'Current UK residence', 'Yes');
    expectReviewValue(reviewSection('Identity'), 'Age on 1 September of your course-start year', '20');
    expectReviewValue(reviewSection('Home area & region'), 'Postcode', 'BS1 1AA');
    expectReviewValue(reviewSection('Home area & region'), 'I live in', 'Not sure');
    expectReviewValue(reviewSection('Home area & region'), 'I live in the following area', 'None of the above');
    expectReviewValue(
      reviewSection('Home area & region'),
      'I attended school in',
      'School in a Bristol BS or BA postcode area (does not by itself confirm Bristol Aspiring State School eligibility)',
    );
    expectReviewValue(reviewSection('Home area & region'), 'POLAR4 quintile', 'Quintile 1Identified from postcode');
    expectReviewValue(reviewSection('Home area & region'), 'TUNDRA quintile', 'Quintile 3');
    expectReviewValue(
      reviewSection('Home area & region'),
      'Scottish Index of Multiple Deprivation (SIMD)',
      'Not applicable / postcode outside Scotland',
    );
    expectReviewValue(reviewSection('Financial support'), 'I receive or previously received free school meals', 'Yes');
    expectReviewValue(reviewSection('School & education'), 'I attended a state-funded, non-fee-paying school', 'Not sure');
    expectReviewValue(reviewSection('School & education'), 'I attended a UK school or college for my GCSEs or equivalent qualifications', 'Yes');
    expectReviewValue(reviewSection('Personal circumstances'), 'I have experience of being in local-authority care', 'Prefer not to say');
    expectReviewValue(reviewSection('Personal circumstances'), 'I was looked after in local-authority care for more than three months', 'Yes');
    expectReviewValue(reviewSection('Personal circumstances'), 'My refugee status was granted by the UK government', 'Yes');
    expectReviewValue(reviewSection('Personal circumstances'), 'My current or most relevant UK visa is one of the Ukrainian schemes', 'Ukraine Extension Scheme');
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

  it('does not misrepresent the legacy broad age answer as a precise age', () => {
    const profile = createEmptyProfile();
    profile.applicant_identity.age_at_course_start_band = 'age_18_or_over_legacy';

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expectReviewValue(
      reviewSection('Identity'),
      'Age on 1 September of your course-start year',
      '18 or over (legacy answer - please confirm)',
    );
  });
});

describe('ReviewStep Scottish display', () => {
  function profileAfterALevelToScottishSwitch() {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
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
      { subject_id: 'chemistry', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'biology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'pass' },
      { subject_id: 'psychology', predicted_grade: 'A', achieved_grade: '', practical_endorsement: 'not_applicable' },
    ];
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A' },
      { subject_id: 'mathematics', grade: 'B' },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'physics', grade: 'B' },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'chemistry', grade: 'B' },
    ];
    return profile;
  }

  it('hides stale GCSE and A-level sections after switching to Scottish qualifications', () => {
    const profile = profileAfterALevelToScottishSwitch();

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expect(screen.queryByRole('heading', { name: 'GCSE grades' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A levels' })).not.toBeInTheDocument();
    expect(screen.queryByText('History')).not.toBeInTheDocument();
    expect(screen.queryByText('Psychology')).not.toBeInTheDocument();
  });

  it('shows entered National 5s alongside Highers and Advanced Highers', () => {
    const profile = createEmptyProfile();
    profile.course_target.qualification_route = 'scottish';
    profile.scottish_profile.national_5_subjects = [
      { subject_id: 'english_language', grade: 'A' },
      { subject_id: 'mathematics', grade: 'B' },
      { subject_id: '', grade: '' },
    ];
    profile.scottish_profile.higher_subjects = [
      { subject_id: 'chemistry', grade: 'A' },
      { subject_id: 'biology', grade: 'A' },
      { subject_id: 'applications_of_mathematics', grade: 'B' },
    ];
    profile.scottish_profile.advanced_higher_subjects = [
      { subject_id: 'chemistry', grade: 'B' },
    ];

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    const scottish = reviewSection('Scottish qualifications');
    expect(within(scottish).getByRole('heading', { name: 'National 5s' })).toBeInTheDocument();
    expectReviewValue(scottish, 'English Language', 'A');
    expect(within(scottish).getAllByText('Mathematics')[0].nextElementSibling).toHaveTextContent('B');
    expectReviewValue(scottish, 'Applications of Mathematics', 'B');
    expect(within(scottish).getByRole('heading', { name: 'Highers' })).toBeInTheDocument();
    expect(within(scottish).getByRole('heading', { name: 'Advanced Highers' })).toBeInTheDocument();
  });

  it('shows retained GCSE and A-level evidence again after switching back to A levels', () => {
    const profile = profileAfterALevelToScottishSwitch();
    profile.course_target.qualification_route = 'a_level';

    render(<ReviewStep profile={profile} updateProfile={() => {}} errors={{}} />);

    expect(screen.getByRole('heading', { name: 'GCSE grades' })).toBeInTheDocument();
    const aLevels = reviewSection('A levels');
    expectReviewValue(aLevels, 'Chemistry', 'Predicted A; achieved Not provided');
    expectReviewValue(aLevels, 'Psychology', 'Predicted A; achieved Not provided');
    expect(screen.queryByRole('heading', { name: 'Scottish qualifications' })).not.toBeInTheDocument();
  });
});
