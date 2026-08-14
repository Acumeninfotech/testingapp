import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyProfile, type WizardProfile } from '../profileTypes';
import { ScottishStep } from './ScottishStep';

function renderStep(profile: WizardProfile = createEmptyProfile()) {
  const updateProfile = vi.fn((updater: (prev: WizardProfile) => WizardProfile) => {
    Object.assign(profile, updater(profile));
  });
  const view = render(<ScottishStep profile={profile} updateProfile={updateProfile} errors={{}} />);
  return { profile, updateProfile, ...view };
}

function section(name: string) {
  return screen.getByText(name).closest('details') as HTMLDetailsElement;
}

describe('ScottishStep', () => {
  it('uses compact sections with only Highers expanded by default', () => {
    renderStep();

    expect(section('National 5s')).not.toHaveAttribute('open');
    expect(section('Highers')).toHaveAttribute('open');
    expect(section('Advanced Highers')).not.toHaveAttribute('open');

    expect(within(section('National 5s')).getByText('Optional')).toBeInTheDocument();
    expect(within(section('Highers')).getByText('Required')).toBeInTheDocument();
    expect(within(section('Advanced Highers')).getByText('Optional')).toBeInTheDocument();
  });

  it('shows entered counts and keeps five Higher subject and grade rows', async () => {
    const profile = createEmptyProfile();
    profile.scottish_profile.national_5_subjects[0] = { subject_id: 'english', grade: 'A' };
    profile.scottish_profile.national_5_subjects[1] = { subject_id: 'mathematics', grade: 'B' };
    profile.scottish_profile.advanced_higher_subjects[0] = { subject_id: 'chemistry', grade: 'A' };

    renderStep(profile);

    expect(within(section('National 5s')).getByLabelText('2 entered')).toBeInTheDocument();
    expect(within(section('Advanced Highers')).getByLabelText('1 entered')).toBeInTheDocument();
    expect(within(section('Highers')).getAllByLabelText('Subject')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('Grade')).toHaveLength(5);

    fireEvent.click(screen.getByText('National 5s').closest('summary') as HTMLElement);
    await waitFor(() => expect(section('National 5s')).toHaveAttribute('open'));
    expect(within(section('National 5s')).getAllByLabelText('Subject')).toHaveLength(5);
    expect(within(section('National 5s')).getAllByLabelText('Grade')).toHaveLength(5);
  });
});
