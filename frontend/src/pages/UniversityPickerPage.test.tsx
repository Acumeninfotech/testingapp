import { render, screen, waitFor } from '@testing-library/react';
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
  },
];

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

    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.getByText('University of Leicester')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('shows an error state when the API call fails', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockRejectedValue(new Error('network error'));

    render(<UniversityPickerPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
