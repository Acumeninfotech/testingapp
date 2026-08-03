import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyProfile, type WizardProfile } from '../profileTypes';
import { ALevelStep } from './ALevelStep';

function StatefulALevelStep({ initialProfile = createEmptyProfile() }: { initialProfile?: WizardProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  return <ALevelStep profile={profile} updateProfile={(updater) => setProfile(updater)} errors={{}} />;
}

function selectValue(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLSelectElement, { target: { value } });
}

describe('ALevelStep subject options', () => {
  it('offers Computer Science as a canonical A-level subject without a Computing duplicate', () => {
    render(<ALevelStep profile={createEmptyProfile()} updateProfile={vi.fn()} errors={{}} />);

    for (const select of screen.getAllByLabelText('Subject')) {
      const options = within(select).getAllByRole('option');
      expect(options.filter((option) => option.textContent === 'Computer Science')).toHaveLength(1);
      expect(options.some((option) => option.getAttribute('value') === 'computer_science')).toBe(true);
      expect(options.some((option) => option.getAttribute('value') === 'computing')).toBe(false);
    }
  });
});

describe('ALevelStep EPQ section', () => {
  it('defaults EPQ status to not taken', () => {
    render(<StatefulALevelStep />);

    expect(screen.getByRole('heading', { name: 'Extended Project Qualification (EPQ)' })).toBeInTheDocument();
    expect(screen.getByLabelText('EPQ status')).toHaveValue('not_taken');
    expect(screen.queryByLabelText('Predicted EPQ grade')).not.toBeInTheDocument();
  });

  it('shows the grade selector for predicted and achieved EPQ statuses', () => {
    render(<StatefulALevelStep />);

    selectValue('epq_status', 'predicted');
    expect(screen.getByLabelText('Predicted EPQ grade')).toBeInTheDocument();

    selectValue('epq_status', 'achieved');
    expect(screen.getByLabelText('Achieved EPQ grade')).toBeInTheDocument();
  });

  it('clears the EPQ grade when switching to planning or not taken', () => {
    render(<StatefulALevelStep />);

    selectValue('epq_status', 'predicted');
    selectValue('epq_grade', 'A');
    expect(screen.getByLabelText('Predicted EPQ grade')).toHaveValue('A');

    selectValue('epq_status', 'planning');
    expect(screen.queryByLabelText('Predicted EPQ grade')).not.toBeInTheDocument();

    selectValue('epq_status', 'predicted');
    expect(screen.getByLabelText('Predicted EPQ grade')).toHaveValue('');

    selectValue('epq_grade', 'B');
    selectValue('epq_status', 'not_taken');
    selectValue('epq_status', 'achieved');
    expect(screen.getByLabelText('Achieved EPQ grade')).toHaveValue('');
  });
});
