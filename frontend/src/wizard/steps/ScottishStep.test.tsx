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

function renderedRows(sectionName: string) {
  return section(sectionName).querySelectorAll('.scottish-subject-row');
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

  it('shows entered counts and keeps five Higher subject and grade rows by default', async () => {
    const profile = createEmptyProfile();
    profile.scottish_profile.national_5_subjects[0] = { subject_id: 'english_language', grade: 'A' };
    profile.scottish_profile.national_5_subjects[1] = { subject_id: 'mathematics', grade: 'B' };
    profile.scottish_profile.advanced_higher_subjects[0] = { subject_id: 'chemistry', grade: 'A' };

    renderStep(profile);

    expect(within(section('National 5s')).getByLabelText('2 entered')).toBeInTheDocument();
    expect(within(section('Advanced Highers')).getByLabelText('1 entered')).toBeInTheDocument();
    expect(within(section('Highers')).getAllByLabelText('Subject')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('Grade')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('School year')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('Attempt')).toHaveLength(5);

    fireEvent.click(screen.getByText('National 5s').closest('summary') as HTMLElement);
    await waitFor(() => expect(section('National 5s')).toHaveAttribute('open'));
    expect(within(section('National 5s')).getAllByLabelText('Subject')).toHaveLength(5);
    expect(within(section('National 5s')).getAllByLabelText('Grade')).toHaveLength(5);
  });

  it('provides five Higher rows and three Advanced Higher rows for Scottish profiles', async () => {
    renderStep();

    expect(within(section('Highers')).getAllByLabelText('Subject')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('Grade')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('School year')).toHaveLength(5);
    expect(within(section('Highers')).getAllByLabelText('Attempt')).toHaveLength(5);

    fireEvent.click(screen.getByText('Advanced Highers').closest('summary') as HTMLElement);
    await waitFor(() => expect(section('Advanced Highers')).toHaveAttribute('open'));
    expect(renderedRows('Advanced Highers')).toHaveLength(3);
    expect(within(section('Advanced Highers')).queryByLabelText('Qualification')).not.toBeInTheDocument();
    expect(within(section('Advanced Highers')).getAllByLabelText('Subject')).toHaveLength(3);
    expect(within(section('Advanced Highers')).getAllByLabelText('Grade')).toHaveLength(3);
    expect(within(section('Advanced Highers')).getAllByLabelText('School year')).toHaveLength(3);
    expect(within(section('Advanced Highers')).getAllByLabelText('Attempt')).toHaveLength(3);
  });

  it('updates same-sitting, school-year and attempt evidence', () => {
    const { profile, rerender, updateProfile } = renderStep();

    fireEvent.change(screen.getByLabelText('Were your required SQA subjects completed in the same sitting?'), {
      target: { value: 'yes' },
    });
    fireEvent.change(within(section('Highers')).getAllByLabelText('School year')[0], {
      target: { value: 's5' },
    });
    rerender(<ScottishStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.change(within(section('Highers')).getAllByLabelText('Attempt')[0], {
      target: { value: 'yes' },
    });

    expect(profile.scottish_profile.completed_in_one_sitting).toBe(true);
    expect(profile.scottish_profile.higher_subjects[0].school_year).toBe('s5');
    expect(profile.scottish_profile.higher_subjects[0].first_attempt).toBe(true);
  });

  it('offers Applications of Mathematics as a distinct Scottish Higher subject', () => {
    const { profile } = renderStep();

    const subjectSelect = within(section('Highers')).getAllByLabelText('Subject')[2] as HTMLSelectElement;
    const applicationsOption = within(subjectSelect).getByRole('option', {
      name: 'Applications of Mathematics',
    }) as HTMLOptionElement;

    expect(applicationsOption.value).toBe('applications_of_mathematics');

    fireEvent.change(subjectSelect, { target: { value: 'applications_of_mathematics' } });

    expect(profile.scottish_profile.higher_subjects[2].subject_id).toBe('applications_of_mathematics');
    expect(profile.scottish_profile.higher_subjects[2].subject_id).not.toBe('mathematics');
  });
});
