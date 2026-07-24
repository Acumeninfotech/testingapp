import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UniversitySelectionStep } from './UniversitySelectionStep';
import * as apiClient from '../../api/client';
import type { University } from '../../api/types';
import { createEmptyProfile, type WizardProfile } from '../profileTypes';

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
    fee_status: ['home'],
    entry_year: 2027,
  },
  {
    id: 'queen-s-belfast-a100',
    university_name: "Queen's University Belfast",
    course_code: 'A100',
    course_name: 'MBBCh Medicine',
    entry_route: 'Standard Entry',
    country: 'Northern Ireland',
    fee_status: ['home'],
    entry_year: 2027,
  },
];

function StatefulStep() {
  const [profile, setProfile] = useState<WizardProfile>(createEmptyProfile());
  const updateProfile = (updater: (prev: WizardProfile) => WizardProfile) => {
    setProfile((prev) => updater(prev));
  };
  return <UniversitySelectionStep profile={profile} updateProfile={updateProfile} errors={{}} />;
}

describe('UniversitySelectionStep select all', () => {
  it('selects every visible university, then deselects them all on a second click', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<StatefulStep />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    expect(selectAll).not.toBeChecked();

    fireEvent.click(selectAll);

    const cardCheckboxes = screen.getAllByRole('checkbox', { name: /^Select (?!all)/i });
    expect(cardCheckboxes).toHaveLength(3);
    cardCheckboxes.forEach((checkbox) => expect(checkbox).toBeChecked());
    expect(screen.getByRole('checkbox', { name: /select all/i })).toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }));
    screen
      .getAllByRole('checkbox', { name: /^Select /i })
      .forEach((checkbox) => expect(checkbox).not.toBeChecked());
    expect(screen.getByRole('checkbox', { name: /select all/i })).not.toBeChecked();
  });

  it('only selects the universities matching the active country filter', async () => {
    vi.spyOn(apiClient, 'fetchUniversities').mockResolvedValue({
      universities: mockUniversities,
      count: mockUniversities.length,
    });

    render(<StatefulStep />);

    await waitFor(() => {
      expect(screen.getByTestId('university-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Northern Ireland' }));

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(1);
    });

    const selectAll = screen.getByRole('checkbox', { name: /select all shown/i });
    fireEvent.click(selectAll);

    expect(
      screen.getByRole('checkbox', { name: "Select Queen's University Belfast" }),
    ).toBeChecked();
  });
});
