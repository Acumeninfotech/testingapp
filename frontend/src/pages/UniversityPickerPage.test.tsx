import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UniversityPickerPage } from './UniversityPickerPage';
import * as apiClient from '../api/client';
import type { University } from '../api/types';

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
    uses_ucat: true,
    selection_style: {
      key: 'ucat_ranking',
      label: 'UCAT ranking',
      summary: 'Ranks eligible applicants primarily by UCAT performance.',
    },
    supported_route_tags: ['contextual', 'international'],
    interview_prediction_available: true,
    academic_requirements: {
      gcse: '5 GCSEs including English Language and Mathematics at 6/B',
      a_level: 'AAA including Chemistry and one of Biology, Physics or Mathematics',
      scottish: 'Highers AAAAB; Advanced Highers AA',
      ib: '36 points with 666 at HL including HL Chemistry',
    },
    contextual_support: {
      available: true,
      a_level: 'AAB including Chemistry and one of Biology, Physics or Mathematics',
      gcse: null,
      scottish: null,
      ib: '34 points with 655 at HL including HL Chemistry',
      criteria_summary: 'Applicant meets a published widening participation criterion.',
      note: "Contextual support depends on the university's published eligibility criteria.",
    },
    has_contextual_admissions: true,
    interview_format: 'MMI; 7 stations',
    sjt_policy: {
      role: 'Gate',
      accepted_bands_text: 'Bands 1, 2, 3',
      rejected_bands_text: 'Band 4',
      summary: 'Accepted: Bands 1, 2, 3. Rejected: Band 4',
    },
  },
  {
    id: 'leicester-a100',
    university_name: 'University of Leicester',
    course_code: 'A100',
    course_name: 'A100 Medicine MBChB',
    entry_route: 'Standard Entry',
    country: 'England',
    fee_status: ['home', 'international'],
    entry_year: 2027,
    uses_ucat: true,
    selection_style: {
      key: 'gcse_ucat_sjt_score',
      label: 'GCSE + UCAT + SJT score',
      summary: 'Combines GCSE, UCAT and SJT scoring before interview guidance.',
    },
    supported_route_tags: ['international'],
    interview_prediction_available: true,
    academic_requirements: {
      gcse: '8 GCSEs including English Language, Mathematics and Sciences at 6/B',
      a_level: 'A*AA including Chemistry or Biology',
      scottish: 'Highers alone not accepted; Advanced Highers AAA',
      ib: '34 points with 766 at HL or 36 points with 666 at HL',
    },
    interview_format: 'MMI; face-to-face for Home and online for International',
    sjt_policy: {
      role: 'Not used',
      accepted_bands_text: 'Bands 1, 2, 3, 4',
      rejected_bands_text: null,
      summary: 'Accepted: Bands 1, 2, 3, 4',
    },
  },
];

const manyMockUniversities: University[] = Array.from({ length: 10 }, (_, index) => ({
  ...mockUniversities[index % mockUniversities.length],
  id: `mock-university-${index + 1}`,
  university_name: `Mock University ${index + 1}`,
}));

const contextualWithoutReduction: University = {
  ...mockUniversities[0],
  id: 'contextual-no-reduction-a100',
  university_name: 'Contextual No Reduction University',
  contextual_support: {
    available: true,
    a_level: null,
    gcse: null,
    scottish: null,
    ib: null,
    criteria_summary: null,
    note: null,
  },
  has_contextual_admissions: true,
};

describe('UniversityPickerPage', () => {
  it('renders a university card for each university returned by the API', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<UniversityPickerPage />);

    expect(screen.getByText(/loading universities/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /find the right medical school for your profile/i })).toBeInTheDocument();
    expect(screen.getByText('Medical Schools')).toBeInTheDocument();
    expect(screen.getByLabelText(/search medical schools/i)).toBeInTheDocument();
    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.getByText('University of Leicester')).toBeInTheDocument();
    expect(screen.getByText('UCAT ranking')).toBeInTheDocument();
    expect(screen.getByText('GCSE + UCAT + SJT score')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('filters universities by search and selection style', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /advanced filters/i }));

    fireEvent.change(screen.getByLabelText(/selection style/i), {
      target: { value: 'ucat_ranking' },
    });

    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.queryByText('University of Leicester')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 1 medical schools/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search medical schools/i), {
      target: { value: 'Leicester' },
    });

    expect(screen.getByRole('status')).toHaveTextContent(/no universities match/i);
  });

  it('applies quick filters through the existing filter state', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /apply contextual filter/i }));

    expect(screen.getByRole('button', { name: /remove contextual filter/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.queryByText('University of Leicester')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 1 medical schools/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove contextual filter/i }));

    expect(screen.getByText('University of Leicester')).toBeInTheDocument();
  });

  it('shows the first 8 universities and loads more on request', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: manyMockUniversities,
      count: manyMockUniversities.length,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText(/showing 8 of 10 medical schools/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load 2 more/i }));

    expect(screen.getAllByRole('article')).toHaveLength(10);
    expect(screen.getByText(/showing 10 of 10 medical schools/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/search medical schools/i), {
      target: { value: 'Mock University 1' },
    });

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText(/showing 2 of 2 medical schools/i)).toBeInTheDocument();
  });

  it('opens and closes the university detail drawer from a card', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /view details/i })[0]);

    const drawer = screen.getByRole('dialog', { name: 'Keele University' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText('Course Snapshot')).toBeInTheDocument();
    expect(within(drawer).getByText('Academic Requirements')).toBeInTheDocument();
    expect(within(drawer).getByText(/5 GCSEs including English Language/i)).toBeInTheDocument();
    expect(within(drawer).getByText('Contextual Support')).toBeInTheDocument();
    expect(within(drawer).getByText(/contextual offers apply only/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/AAB including Chemistry/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/34 points with 655 at HL/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/published widening participation criterion/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/Ranks eligible applicants primarily by UCAT performance/i)).toBeInTheDocument();
    expect(within(drawer).getByText('Contextual support')).toBeInTheDocument();
    expect(within(drawer).getByText('Assessment Summary')).toBeInTheDocument();
    expect(within(drawer).queryByText('Coverage Notes')).not.toBeInTheDocument();
    expect(within(drawer).getByText("UCAT: Included in ApplySmart's assessment for this university.")).toBeInTheDocument();
    expect(within(drawer).getByText('Interview format: MMI (Multiple Mini Interviews); 7 stations')).toBeInTheDocument();
    expect(within(drawer).getByText('Applicant groups supported: Home and International applicants.')).toBeInTheDocument();
    expect(within(drawer).queryByText(/\bmetadata\b|\bencoded\b|data model|explorer metadata/i)).not.toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: /close university details/i }));

    expect(screen.queryByRole('dialog', { name: 'Keele University' })).not.toBeInTheDocument();
  });

  it('shows a concise contextual fallback when no grade reduction is published', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: [contextualWithoutReduction],
      count: 1,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    const drawer = screen.getByRole('dialog', { name: 'Contextual No Reduction University' });
    expect(within(drawer).getByText('Contextual Support')).toBeInTheDocument();
    expect(within(drawer).getByText('No published contextual grade reduction available.')).toBeInTheDocument();
    expect(within(drawer).getByText('Applicant groups supported: Home and International applicants.')).toBeInTheDocument();
    expect(within(drawer).queryByText(/\bmetadata\b|\bencoded\b|data model|explorer metadata/i)).not.toBeInTheDocument();
  });

  it('uses a student-facing fallback when the interview format is not specified', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: [{
        ...mockUniversities[1],
        id: 'unknown-interview-format-a100',
        university_name: 'Unknown Interview Format University',
        interview_format: 'Interview',
      }],
      count: 1,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    const drawer = screen.getByRole('dialog', { name: 'Unknown Interview Format University' });
    expect(within(drawer).getByText('Assessment Summary')).toBeInTheDocument();
    expect(within(drawer).getByText('Interview format: Published interview format not specified.')).toBeInTheDocument();
    expect(within(drawer).queryByText('Interview format: Interview')).not.toBeInTheDocument();
  });

  it('compares selected universities in a side-by-side drawer', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    const compareButtons = screen.getAllByRole('button', { name: 'Compare' });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

    expect(screen.getByText('2 universities selected')).toBeInTheDocument();
    expect(screen.getByText('2 of 4 selected')).toBeInTheDocument();
    expect(screen.getByText('Keele')).toBeInTheDocument();
    expect(screen.getByText('Leicester')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Compare$/ }));

    const drawer = screen.getByRole('dialog', { name: 'Comparing 2 universities' });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: /comparing 2 universities/i })).toBeInTheDocument();
    expect(within(drawer).queryByText(/average duration/i)).not.toBeInTheDocument();
    expect(within(drawer).getByText('selection approaches')).toBeInTheDocument();
    expect(within(drawer).getAllByText('ApplySmart interview prediction').length).toBeGreaterThan(0);
    expect(within(drawer).getByRole('heading', { name: /Keele University/i })).toBeInTheDocument();
    expect(within(drawer).getByRole('heading', { name: /University of Leicester/i })).toBeInTheDocument();
    expect(within(drawer).getByText('Differences only')).toBeInTheDocument();
    expect(within(drawer).getByText(/Highlighted values differ/i)).toBeInTheDocument();
    expect(within(drawer).getByText('Course Overview')).toBeInTheDocument();
    expect(within(drawer).getByText('Entry Requirements')).toBeInTheDocument();
    expect(within(drawer).getByText('Applicant Routes')).toBeInTheDocument();
    expect(within(drawer).queryByText('Supported Routes')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('Coverage')).not.toBeInTheDocument();
    expect(within(drawer).getAllByText('GCSE').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('A-level').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('Scottish').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('IB').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('UCAT role').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('Used in interview selection').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('SJT role').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('Interview format').length).toBeGreaterThan(0);
    expect(within(drawer).queryByText(/Supported/)).not.toBeInTheDocument();
    expect(within(drawer).getAllByText(/Accepted: Bands 1, 2, 3\. Rejected: Band 4/i).length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText(/A\*AA including Chemistry or Biology/i).length).toBeGreaterThan(0);

    fireEvent.click(within(drawer).getByRole('checkbox', { name: /differences only/i }));

    expect(within(drawer).queryByRole('row', { name: /Home Available Available/i })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('row', { name: /GCSE 5 GCSEs including English Language/i })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: /Remove Keele University from comparison/i }));

    expect(screen.queryByRole('dialog', { name: 'Comparing 2 universities' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Comparing 1 university' })).toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockRejectedValue(new Error('network error'));

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
