import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WizardPage } from './WizardPage';
import * as apiClient from '../api/client';
import type { PredictionResult, University } from '../api/types';

const mockUniversities: University[] = [
  {
    id: 'keele-a100',
    university_name: 'Keele University',
    course_code: 'A100',
    course_name: 'MBChB Medicine',
    entry_route: 'Standard Entry',
    country: 'England',
    fee_status: ['home', 'international'],
    entry_year: 2027,
  },
];

const mockResults: PredictionResult[] = [
  {
    universityId: 'keele-a100',
    university: 'Keele University',
    result_card: {
      primary_user_facing_recommendation: 'Good chance – recommend applying',
      recommendation_display_state: 'standard',
      primary_explanation: 'Based on the information entered, this is a realistic choice.',
      prediction: { result_band: 'realistic' },
    },
  },
];

function selectValue(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLSelectElement, { target: { value } });
}

function typeValue(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
}

function fillIdentity(ageBand = 'age_18_or_over', options = { applicantType: 'school_leaver', feeStatus: 'home', domicile: 'england' }) {
  selectValue('applicant_type', options.applicantType);
  selectValue('fee_status', options.feeStatus);
  selectValue('domicile', options.domicile);
  selectValue('age_at_course_start_band', ageBand);
}

function clickContinue() {
  // Continue/Back are rendered both above and below the step content, so
  // there are always two matches - click the first (top) one.
  fireEvent.click(screen.getAllByRole('button', { name: /continue|submit for prediction/i })[0]);
}

function clickBack() {
  fireEvent.click(screen.getAllByRole('button', { name: /back/i })[0]);
}

function reviewSection(name: string) {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement;
}

function expectReviewValue(section: HTMLElement, label: string, value: string) {
  expect(within(section).getByText(label).nextElementSibling).toHaveTextContent(value);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
    universities: mockUniversities,
    count: mockUniversities.length,
  });
});

describe('WizardPage navigation', () => {
  it('blocks navigation past step 1 until required fields are valid', () => {
    render(<WizardPage />);

    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 1 of 8');
    clickContinue();

    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 1 of 8');
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('advances to step 2 once step 1 is valid, and can navigate back', () => {
    render(<WizardPage />);

    fillIdentity();
    clickContinue();

    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 2 of 8');

    fireEvent.click(screen.getAllByRole('button', { name: /back/i })[0]);
    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 1 of 8');
  });

  it('shows the course start year as fixed 2027 on the route step', () => {
    render(<WizardPage />);

    fillIdentity();
    clickContinue();

    const applicationYear = screen.getByLabelText(/Which year do you plan to start your course/i);
    expect(applicationYear).toHaveValue('2027');
    expect(applicationYear).toHaveAttribute('readonly');
  });

  it('persists progress to localStorage between renders', async () => {
    const { unmount } = render(<WizardPage />);
    selectValue('applicant_type', 'mature_graduate');

    await waitFor(() => {
      expect(window.localStorage.getItem('applysmart.wizard.profile.v1')).toContain('mature_graduate');
    });
    unmount();

    render(<WizardPage />);
    expect((document.getElementById('applicant_type') as HTMLSelectElement).value).toBe('mature_graduate');
  });

  it('loads old localStorage profiles containing DOB without crashing', () => {
    window.localStorage.setItem(
      'applysmart.wizard.profile.v1',
      JSON.stringify({
        applicant_identity: {
          applicant_type: 'school_leaver',
          fee_status: 'home',
          domicile: 'england',
          date_of_birth: '2010-08-01',
        },
        course_target: {
          application_year: 2027,
        },
      })
    );

    render(<WizardPage />);

    expect((document.getElementById('age_at_course_start_band') as HTMLSelectElement).value).toBe('age_17');
  });
});

describe('WizardPage submit flow', () => {
  it('walks through every step with minimal valid data and renders returned result cards', async () => {
    const submitSpy = vi.spyOn(apiClient, 'submitPrediction').mockResolvedValue({ results: mockResults });

    render(<WizardPage />);

    // Step 1: identity
    fillIdentity();
    clickContinue();

    // Step 2: route
    typeValue('application_year', '2027');
    clickContinue();

    // Step 3: GCSE
    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();

    // Step 4: A-level
    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    // Step 5: UCAT
    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    expect(screen.getByLabelText('Total score')).toHaveValue('2100');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2026');
    clickContinue();

    // Step 6: contextual (optional, skip)
    clickContinue();

    // Step 7: universities
    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();

    // Step 8: review
    expect(screen.getByText('Standard entry')).toBeInTheDocument();
    expect(screen.getByText('Home student')).toBeInTheDocument();
    expectReviewValue(reviewSection('Course target'), 'Qualification route', 'A levels');
    expect(screen.queryByText('school_leaver')).not.toBeInTheDocument();
    expect(screen.queryByText('a_level')).not.toBeInTheDocument();
    expectReviewValue(reviewSection('GCSE grades'), 'English Literature', 'Not provided');
    expect(screen.getByTestId('review-university-count')).toHaveTextContent('1 selected');
    clickContinue();

    await waitFor(() => {
      expect(screen.getByTestId('result-card-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.getByText('Possible choice for your application')).toBeInTheDocument();
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ universityIds: ['keele-a100'] })
    );
    const submittedProfile = submitSpy.mock.calls[0][0].studentProfile as Record<string, unknown>;
    expect(submittedProfile.qualification_route).toBe('a_level');
    const identity = submittedProfile.applicant_identity as Record<string, unknown>;
    expect(identity.applicant_type).toBe('school_leaver');
    expect(identity.age_at_course_start_band).toBe('age_18_or_over');
    expect(identity.date_of_birth).toBeUndefined();
    const aLevelProfile = submittedProfile.a_level_profile as Record<string, unknown>;
    expect(aLevelProfile.completed_in_one_sitting).toBe(true);
  });

  it('shows completed additional GCSEs on review and keeps them after going back', async () => {
    const submitSpy = vi.spyOn(apiClient, 'submitPrediction').mockResolvedValue({ results: mockResults });

    render(<WizardPage />);

    fillIdentity();
    clickContinue();

    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '7');
    selectValue('gcse_english_literature', '8');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    fireEvent.click(screen.getByRole('button', { name: /add another gcse/i }));
    selectValue('additional_gcse_0_subject', 'further_mathematics');
    selectValue('additional_gcse_0_grade', '9');
    fireEvent.click(screen.getByRole('button', { name: /add another gcse/i }));
    selectValue('additional_gcse_1_subject', 'psychology');
    selectValue('additional_gcse_1_grade', '8');
    clickContinue();

    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2026');
    clickContinue();

    clickContinue(); // contextual, skip

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();

    const expectReviewGcseGrades = () => {
      expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 8 of 8');
      const gcseSection = reviewSection('GCSE grades');

      for (const subject of ['English Language', 'English Literature', 'Mathematics', 'Biology', 'Chemistry', 'Physics']) {
        expect(within(gcseSection).getByText(subject)).toBeInTheDocument();
      }

      expectReviewValue(gcseSection, 'Further Mathematics', '9');
      expectReviewValue(gcseSection, 'Psychology', '8');
    };

    expectReviewGcseGrades();

    clickBack();
    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 7 of 8');
    clickContinue();

    expectReviewGcseGrades();
    clickContinue();

    await waitFor(() => {
      expect(screen.getByTestId('result-card-list')).toBeInTheDocument();
    });

    const submittedProfile = submitSpy.mock.calls[0][0].studentProfile as Record<string, unknown>;
    const submittedGcse = submittedProfile.gcse_profile as {
      additional_subjects: { subject_id: string; grade: string }[];
    };
    expect(submittedGcse.additional_subjects).toEqual(
      expect.arrayContaining([
        { subject_id: 'further_mathematics', grade: '9' },
        { subject_id: 'psychology', grade: '8' },
      ])
    );
  }, 10_000);

  it('walks through the Scottish qualifications route', async () => {
    const submitSpy = vi.spyOn(apiClient, 'submitPrediction').mockResolvedValue({ results: mockResults });

    render(<WizardPage />);

    fillIdentity('age_18_or_over', { applicantType: 'school_leaver', feeStatus: 'home', domicile: 'scotland' });
    clickContinue();

    selectValue('qualification_route', 'scottish');
    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();

    expect(screen.getByRole('heading', { name: 'Scottish qualifications' })).toBeInTheDocument();
    selectValue('higher_subjects_0_id', 'chemistry');
    selectValue('higher_subjects_0_grade', 'A');
    selectValue('higher_subjects_1_id', 'biology');
    selectValue('higher_subjects_1_grade', 'A');
    selectValue('higher_subjects_2_id', 'mathematics');
    selectValue('higher_subjects_2_grade', 'B');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    expect(screen.getByLabelText('Total score')).toHaveValue('2100');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2026');
    clickContinue();

    clickContinue(); // contextual, skip

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();

    clickContinue(); // review -> submit

    await waitFor(() => {
      expect(screen.getByTestId('result-card-list')).toBeInTheDocument();
    });

    const submittedProfile = submitSpy.mock.calls[0][0].studentProfile as Record<string, unknown>;
    expect(submittedProfile.qualification_route).toBe('scottish');
  });

  it('walks through the graduate route including GAMSAT and shows the English language step for international applicants', async () => {
    const submitSpy = vi.spyOn(apiClient, 'submitPrediction').mockResolvedValue({ results: mockResults });

    render(<WizardPage />);

    fillIdentity('age_18_or_over', { applicantType: 'mature_graduate', feeStatus: 'international', domicile: 'other' });
    clickContinue();

    selectValue('qualification_route', 'graduate');
    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();

    expect(screen.getByRole('heading', { name: 'Graduate profile' })).toBeInTheDocument();
    selectValue('degree_classification', 'upper_second');
    selectValue('degree_status', 'completed');
    fireEvent.click(screen.getByLabelText(/I have taken the GAMSAT/i));
    typeValue('gamsat_overall_score', '65');
    typeValue('gamsat_section_0', '65');
    typeValue('gamsat_section_1', '65');
    typeValue('gamsat_section_2', '65');
    clickContinue();

    // Graduate route also requires the co-required A-level/school profile.
    expect(screen.getByRole('heading', { name: 'School qualification profile' })).toBeInTheDocument();
    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    expect(screen.getByLabelText('Total score')).toHaveValue('2100');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2026');
    clickContinue();

    expect(screen.getByRole('heading', { name: 'English language evidence' })).toBeInTheDocument();
    selectValue('test', 'ielts_academic');
    typeValue('overall', '7.5');
    typeValue('reading', '7');
    typeValue('writing', '7');
    typeValue('listening', '7');
    typeValue('speaking', '7');
    clickContinue();

    clickContinue(); // contextual, skip

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();

    clickContinue(); // review -> submit

    await waitFor(() => {
      expect(screen.getByTestId('result-card-list')).toBeInTheDocument();
    });

    const submittedProfile = submitSpy.mock.calls[0][0].studentProfile as Record<string, unknown>;
    expect(submittedProfile.qualification_route).toBe('graduate');
    const graduateProfile = submittedProfile.graduate_profile as Record<string, unknown>;
    expect(graduateProfile.is_graduate).toBe(true);
    const gamsat = (submittedProfile.admissions_tests as Record<string, unknown>).gamsat as Record<string, unknown>;
    expect(gamsat.overall_score).toBe(65);
  });

  it('shows an error state when the prediction API call fails', async () => {
    vi.spyOn(apiClient, 'submitPrediction').mockRejectedValue(new Error('network error'));

    render(<WizardPage />);

    fillIdentity();
    clickContinue();
    typeValue('application_year', '2027');
    clickContinue();
    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();
    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();
    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    expect(screen.getByLabelText('Total score')).toHaveValue('2100');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2026');
    clickContinue();
    clickContinue();
    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();
    clickContinue();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('pre-fills the UCAT test year as entry year minus 1 once an entry year is entered', () => {
    render(<WizardPage />);

    fillIdentity();
    clickContinue();

    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();

    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    expect((document.getElementById('ucat_test_year') as HTMLInputElement).value).toBe('2026');
  });

  it('blocks submission with a clear inline error when the UCAT year does not match entry year minus 1', () => {
    render(<WizardPage />);

    fillIdentity();
    clickContinue();

    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '7');
    selectValue('gcse_mathematics', '8');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '8');
    clickContinue();

    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '700');
    typeValue('ucat_decision_making', '700');
    typeValue('ucat_quantitative_reasoning', '700');
    expect(screen.getByLabelText('Total score')).toHaveValue('2100');
    selectValue('sjt_band', '2');
    typeValue('ucat_test_year', '2027'); // inconsistent with entry year 2027 (should be 2026)
    clickContinue();

    // Submission is blocked: still on the UCAT step (step 5 of 8), with an inline error.
    expect(screen.getByTestId('wizard-progress')).toHaveTextContent('Step 5 of 8');
    expect(screen.getByRole('alert')).toHaveTextContent(/2026/);
  });

  it('allows entering 10 GCSEs and includes all of them in the submitted profile', async () => {
    const submitSpy = vi.spyOn(apiClient, 'submitPrediction').mockResolvedValue({ results: mockResults });

    render(<WizardPage />);

    fillIdentity('age_18_or_over', { applicantType: 'school_leaver', feeStatus: 'rest_of_uk', domicile: 'england' });
    clickContinue();

    typeValue('application_year', '2027');
    clickContinue();

    selectValue('gcse_english_language', '9');
    selectValue('gcse_english_literature', '9');
    selectValue('gcse_mathematics', '9');
    selectValue('gcse_biology', '9');
    selectValue('gcse_chemistry', '9');
    selectValue('gcse_physics', '9');
    const additionalSubjects = ['further_mathematics', 'psychology', 'geography', 'history'];
    for (let i = 0; i < additionalSubjects.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: /add another gcse/i }));
      selectValue(`additional_gcse_${i}_subject`, additionalSubjects[i]);
      selectValue(`additional_gcse_${i}_grade`, '9');
    }
    clickContinue();

    selectValue('subject_0_id', 'chemistry');
    selectValue('subject_0_predicted', 'A');
    selectValue('subject_0_practical', 'pass');
    selectValue('subject_1_id', 'biology');
    selectValue('subject_1_predicted', 'A');
    selectValue('subject_1_practical', 'pass');
    selectValue('subject_2_id', 'mathematics');
    selectValue('subject_2_predicted', 'A');
    selectValue('completed_in_one_sitting', 'yes');
    clickContinue();

    fireEvent.click(screen.getByLabelText(/I have taken the UCAT/i));
    typeValue('ucat_verbal_reasoning', '850');
    typeValue('ucat_decision_making', '850');
    typeValue('ucat_quantitative_reasoning', '850');
    expect(screen.getByLabelText('Total score')).toHaveValue('2550');
    selectValue('sjt_band', '1');
    clickContinue();

    clickContinue(); // contextual, skip

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText(/Select Keele University/i));
    clickContinue();

    clickContinue(); // review -> submit

    await waitFor(() => {
      expect(screen.getByTestId('result-card-list')).toBeInTheDocument();
    });

    const submittedProfile = submitSpy.mock.calls[0][0].studentProfile as Record<string, unknown>;
    const gcse = submittedProfile.gcse_profile as {
      subjects: Record<string, unknown>;
      total_gcse_count: number;
      top_9_gcse_grades: string[];
    };
    expect(gcse.total_gcse_count).toBe(10);
    expect(gcse.subjects.english_literature).toBe('9');
    expect(gcse.top_9_gcse_grades).toHaveLength(10);
  }, 10_000);
});
