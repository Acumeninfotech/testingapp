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
    expect(screen.queryByLabelText('Was your EPQ taken alongside your A-levels?')).not.toBeInTheDocument();
  });

  it('shows the grade and taken-alongside selectors for predicted and achieved EPQ statuses', () => {
    render(<StatefulALevelStep />);

    selectValue('epq_status', 'predicted');
    expect(screen.getByLabelText('Predicted EPQ grade')).toBeInTheDocument();
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('not_sure');

    selectValue('epq_status', 'achieved');
    expect(screen.getByLabelText('Achieved EPQ grade')).toBeInTheDocument();
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('not_sure');
  });

  it('preserves yes, no and not sure taken-alongside answers', () => {
    render(<StatefulALevelStep />);

    selectValue('epq_status', 'predicted');
    selectValue('epq_taken_alongside_a_levels', 'yes');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('yes');

    selectValue('epq_taken_alongside_a_levels', 'no');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('no');

    selectValue('epq_taken_alongside_a_levels', 'not_sure');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('not_sure');
  });

  it('clears the EPQ grade and taken-alongside answer when switching to planning or not taken', () => {
    render(<StatefulALevelStep />);

    selectValue('epq_status', 'predicted');
    selectValue('epq_grade', 'A');
    selectValue('epq_taken_alongside_a_levels', 'yes');
    expect(screen.getByLabelText('Predicted EPQ grade')).toHaveValue('A');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('yes');

    selectValue('epq_status', 'planning');
    expect(screen.queryByLabelText('Predicted EPQ grade')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Was your EPQ taken alongside your A-levels?')).not.toBeInTheDocument();

    selectValue('epq_status', 'predicted');
    expect(screen.getByLabelText('Predicted EPQ grade')).toHaveValue('');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('not_sure');

    selectValue('epq_grade', 'B');
    selectValue('epq_taken_alongside_a_levels', 'no');
    selectValue('epq_status', 'not_taken');
    selectValue('epq_status', 'achieved');
    expect(screen.getByLabelText('Achieved EPQ grade')).toHaveValue('');
    expect(screen.getByLabelText('Was your EPQ taken alongside your A-levels?')).toHaveValue('not_sure');
  });
});
