import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupContextualPostcode } from '../../api/client';
import { createEmptyProfile, type WizardProfile } from '../profileTypes';
import { validateContextualStep, type ValidationErrors } from '../validation';
import { ContextualStep } from './ContextualStep';

vi.mock('../../api/client', () => ({
  lookupContextualPostcode: vi.fn(),
}));

const lookupContextualPostcodeMock = vi.mocked(lookupContextualPostcode);

function renderStep(profile: WizardProfile = createEmptyProfile(), errors: ValidationErrors = {}) {
  const updateProfile = vi.fn((updater: (prev: WizardProfile) => WizardProfile) => {
    Object.assign(profile, updater(profile));
  });
  const view = render(<ContextualStep profile={profile} updateProfile={updateProfile} errors={errors} />);
  return { profile, updateProfile, ...view };
}

function selectValue(id: string, value: string) {
  fireEvent.change(document.getElementById(id) as HTMLSelectElement, { target: { value } });
}

describe('ContextualStep', () => {
  beforeEach(() => {
    lookupContextualPostcodeMock.mockReset();
  });

  function accordion(name: string) {
    return screen.getByText(name).closest('details') as HTMLDetailsElement;
  }

  it('renders the six contextual accordion groups with selected-count badges', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.home_area_region.polar4_quintile = 'q1';
    profile.contextual_profile.financial_support.free_school_meals = 'yes';

    renderStep(profile);

    for (const name of [
      'Home area & region',
      'Financial support',
      'School & education',
      'Personal circumstances',
      'Access / widening participation programmes',
      'Partner schools',
    ]) {
      expect(screen.getByText(name).closest('summary')).toBeInTheDocument();
    }

    const homeSummary = screen.getByText('Home area & region').closest('summary') as HTMLElement;
    expect(within(homeSummary).getByLabelText('1 selected')).toBeInTheDocument();
    const financialSummary = screen.getByText('Financial support').closest('summary') as HTMLElement;
    expect(within(financialSummary).getByLabelText('1 selected')).toBeInTheDocument();
  });

  it('starts all contextual accordions collapsed and preserves manual expansion while mounted', async () => {
    const { profile, rerender, updateProfile } = renderStep();

    for (const name of [
      'Home area & region',
      'Financial support',
      'School & education',
      'Personal circumstances',
      'Access / widening participation programmes',
      'Partner schools',
    ]) {
      expect(accordion(name)).not.toHaveAttribute('open');
    }

    fireEvent.click(screen.getByText('Financial support').closest('summary') as HTMLElement);
    await waitFor(() => expect(accordion('Financial support')).toHaveAttribute('open'));

    profile.contextual_profile.financial_support.free_school_meals = 'yes';
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(accordion('Financial support')).toHaveAttribute('open');
    expect(accordion('Home area & region')).not.toHaveAttribute('open');
    expect(within(screen.getByText('Financial support').closest('summary') as HTMLElement).getByLabelText('1 selected')).toBeInTheDocument();
  });

  it('expands and scrolls only the first accordion containing validation errors', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const { profile, rerender, updateProfile } = renderStep();

    rerender(
      <ContextualStep
        profile={profile}
        updateProfile={updateProfile}
        errors={{
          ukwpmed_programme_id: 'Select a recognised UKWPMED programme.',
          partner_schools: 'Add at least one partner-school relationship.',
        }}
      />,
    );

    await waitFor(() => expect(accordion('Access / widening participation programmes')).toHaveAttribute('open'));
    expect(accordion('Partner schools')).not.toHaveAttribute('open');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('stores UKWPMED selections separately and hides details when No is selected', () => {
    const { profile, rerender, updateProfile } = renderStep();

    selectValue('ukwpmed_status', 'yes');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    expect(screen.getByLabelText('Recognised programme')).toBeInTheDocument();

    selectValue('ukwpmed_programme_id', 'keele_steps2medicine');
    selectValue('ukwpmed_programme_status', 'completed');
    fireEvent.change(document.getElementById('ukwpmed_completion_year') as HTMLInputElement, {
      target: { value: '2026' },
    });

    expect(profile.contextual_profile.access_programmes.ukwpmed).toMatchObject({
      status: 'yes',
      programme_id: 'keele_steps2medicine',
      programme_status: 'completed',
      provider_university_id: 'keele-a100',
      completion_year: 2026,
    });

    selectValue('ukwpmed_status', 'no');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    expect(screen.queryByLabelText('Recognised programme')).not.toBeInTheDocument();
    expect(profile.contextual_profile.access_programmes.ukwpmed.programme_id).toBe('keele_steps2medicine');
  });

  it('shows all seven UKWPMED choices and excludes them from the generic selector', () => {
    const profile = createEmptyProfile();
    profile.contextual_profile.access_programmes.ukwpmed.status = 'yes';
    profile.contextual_profile.access_programmes.participation_status = 'yes';

    renderStep(profile);

    const ukwpmedOptions = within(screen.getByLabelText('Recognised programme')).getAllByRole('option');
    expect(ukwpmedOptions.map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Pathways to Birmingham: Medicine'),
        expect.stringContaining('BrightMed'),
        expect.stringContaining('Pathways to Medicine'),
        expect.stringContaining('Steps2Medicine'),
        expect.stringContaining('Manchester Access Programme'),
        expect.stringContaining('Preston Widening Access Programme'),
        expect.stringContaining('Peninsula Pathways'),
      ]),
    );

    const genericSelector = screen.getByLabelText('Add a programme');
    expect(within(genericSelector).queryByText(/Steps2Medicine/)).not.toBeInTheDocument();
    expect(within(genericSelector).getByText('PARTNERS Programme')).toBeInTheDocument();
  });

  it('renders and stores the new neutral school-attendance and visa-scheme facts', () => {
    const { profile } = renderStep();

    fireEvent.click(screen.getByText('School & education').closest('summary') as HTMLElement);
    fireEvent.click(screen.getByText('Personal circumstances').closest('summary') as HTMLElement);

    selectValue('school_education_attended_uk_school_or_college_for_gcse_or_equivalent', 'yes');
    selectValue('school_education_attended_uk_school_or_college_for_post16_or_equivalent', 'not_sure');
    selectValue('school_education_current_or_most_recent_uk_school_independent_fee_paying', 'no');
    selectValue('personal_circumstances_care_over_three_months', 'no');
    selectValue('personal_circumstances_uk_refugee_status_granted', 'yes');
    selectValue('personal_circumstances_ukrainian_visa_scheme', 'ukraine_family_scheme');

    expect(profile.contextual_profile.school_education.attended_uk_school_or_college_for_gcse_or_equivalent).toBe('yes');
    expect(profile.contextual_profile.school_education.attended_uk_school_or_college_for_post16_or_equivalent).toBe('not_sure');
    expect(profile.contextual_profile.school_education.current_or_most_recent_uk_school_independent_fee_paying).toBe('no');
    expect(profile.contextual_profile.personal_circumstances.care_over_three_months).toBe('no');
    expect(profile.contextual_profile.personal_circumstances.uk_refugee_status_granted).toBe('yes');
    expect(profile.contextual_profile.personal_circumstances.ukrainian_visa_scheme).toBe('ukraine_family_scheme');
  });

  it('adds other access programmes and partner-school relationships as structured records', () => {
    const { profile, rerender, updateProfile } = renderStep();

    selectValue('other_access_participation_status', 'yes');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    selectValue('other_access_programme_selector', 'newcastle_partners');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    selectValue('other_programme_0_status', 'participating');

    selectValue('partner_schools_status', 'yes');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add relationship' }));
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    selectValue('partner_school_0_university', 'bristol-a100');
    fireEvent.change(document.getElementById('partner_school_0_school_name') as HTMLInputElement, {
      target: { value: 'Example Sixth Form' },
    });

    expect(profile.contextual_profile.access_programmes.other_programmes).toEqual([
      { programme_id: 'newcastle_partners', status: 'participating' },
    ]);
    expect(profile.contextual_profile.partner_schools.relationships[0]).toMatchObject({
      university_id: 'bristol-a100',
      school_name: 'Example Sixth Form',
    });
  });

  it('offers Lancaster Access to Medicine in the other access programme selector', () => {
    const { profile, rerender, updateProfile } = renderStep();

    selectValue('other_access_participation_status', 'yes');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(screen.getByRole('option', { name: 'Lancaster Access to Medicine' })).toHaveValue(
      'lancaster_access_to_medicine',
    );

    selectValue('other_access_programme_selector', 'lancaster_access_to_medicine');

    expect(profile.contextual_profile.access_programmes.other_programmes).toEqual([
      { programme_id: 'lancaster_access_to_medicine', status: '' },
    ]);
  });

  it('offers Nottingham contextual programme options in the other access programme selector', () => {
    const { profile, rerender, updateProfile } = renderStep();

    selectValue('other_access_participation_status', 'yes');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(screen.getByRole('option', { name: 'Sutton Trust Online' })).toHaveValue('sutton_trust_online');
    expect(screen.getByRole('option', { name: 'Sutton Trust Pathways to Medicine at the University of Nottingham' })).toHaveValue(
      'nottingham_sutton_trust_pathways_to_medicine',
    );
    expect(screen.getByRole('option', { name: 'Nottingham Ambition 16-18 Tier 1+' })).toHaveValue(
      'nottingham_ambition_16_18_tier_1_plus',
    );
  });

  it('checks postcode on blur and populates available POLAR4, TUNDRA and IMD values', async () => {
    lookupContextualPostcodeMock.mockResolvedValue({
      matched: true,
      postcode: 'BL3 5AB',
      normalised_postcode: 'BL35AB',
      polar4_quintile: 2,
      tundra_quintile: 3,
      imd_quintile: 1,
      availability: { polar4: true, tundra: true, imd: true },
    });
    const { profile, rerender, updateProfile } = renderStep();

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'bl3 5ab' } });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.blur(screen.getByLabelText('Postcode'));

    await waitFor(() => expect(lookupContextualPostcodeMock).toHaveBeenCalledWith('bl3 5ab'));
    await waitFor(() => {
      expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('q2');
      expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('q3');
      expect(profile.contextual_profile.home_area_region.imd_quintile).toBe('q1');
    });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(screen.getAllByText('Automatically identified from your postcode.')).toHaveLength(3);
  });

  it('orders Home area & region fields with quintiles immediately below the postcode button', () => {
    renderStep();

    const orderedControls = [
      screen.getByLabelText('Postcode'),
      screen.getByLabelText('Postcode lookup status'),
      screen.getByRole('button', { name: 'Check postcode' }),
      screen.getByLabelText('POLAR4 quintile'),
      screen.getByLabelText('TUNDRA quintile'),
      screen.getByLabelText('IMD 2019 quintile'),
      screen.getByLabelText('I live in'),
      screen.getByLabelText('I live in the following area'),
      screen.getByLabelText('I attended school in'),
    ];

    for (let index = 1; index < orderedControls.length; index += 1) {
      expect(orderedControls[index - 1].compareDocumentPosition(orderedControls[index])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(screen.getByLabelText('POLAR4 quintile').closest('.contextual-field-grid')).toContainElement(
      screen.getByLabelText('TUNDRA quintile'),
    );
  });

  it('starts region and school selectors on their placeholders without storing unknown defaults', () => {
    const { profile } = renderStep();

    expect(screen.getByLabelText('I live in')).toHaveValue('');
    expect(screen.getByLabelText('I live in the following area')).toHaveValue('');
    expect(screen.getByLabelText('I attended school in')).toHaveValue('');
    expect(profile.contextual_profile.home_area_region.home_region).toBeNull();
    expect(profile.contextual_profile.home_area_region.specific_home_area).toBeNull();
    expect(profile.contextual_profile.home_area_region.school_area).toBeNull();
  });

  it('stores Not sure and None of the above only after explicit region selections', () => {
    const { profile } = renderStep();

    selectValue('contextual_home_region', 'unknown');
    expect(profile.contextual_profile.home_area_region.home_region).toBe('unknown');

    selectValue('contextual_home_region', 'none');
    expect(profile.contextual_profile.home_area_region.home_region).toBe('none');

    selectValue('contextual_specific_home_area', 'unknown');
    expect(profile.contextual_profile.home_area_region.specific_home_area).toBe('unknown');

    selectValue('contextual_specific_home_area', 'none');
    expect(profile.contextual_profile.home_area_region.specific_home_area).toBe('none');
  });

  it('leaves unavailable partial data manually selectable', async () => {
    lookupContextualPostcodeMock.mockResolvedValue({
      matched: true,
      postcode: 'AB12 3CD',
      normalised_postcode: 'AB123CD',
      polar4_quintile: 4,
      tundra_quintile: null,
      imd_quintile: null,
      availability: { polar4: true, tundra: false, imd: false },
    });
    const { profile, rerender, updateProfile } = renderStep();

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'AB12 3CD' } });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check postcode' }));

    await waitFor(() => expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('q4'));
    expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('unknown');
    expect(profile.contextual_profile.home_area_region.imd_quintile).toBe('unknown');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(screen.getAllByText('Not available for this postcode. Please select manually if known.')).toHaveLength(2);
    selectValue('contextual_tundra_quintile', 'q2');
    expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('q2');
  });

  it('does not reuse stale postcode-derived values after the postcode changes', async () => {
    lookupContextualPostcodeMock.mockResolvedValue({
      matched: true,
      postcode: 'BL3 5AB',
      normalised_postcode: 'BL35AB',
      polar4_quintile: 2,
      tundra_quintile: 3,
      imd_quintile: 1,
      availability: { polar4: true, tundra: true, imd: true },
    });
    const { profile, rerender, updateProfile } = renderStep();

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'BL3 5AB' } });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check postcode' }));
    await waitFor(() => expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('q2'));

    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'ZZ1 1ZZ' } });

    expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('unknown');
    expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('unknown');
    expect(profile.contextual_profile.home_area_region.imd_quintile).toBe('unknown');
    expect(profile.contextual_profile.home_area_region.postcode_lookup?.stale).toBe(true);
  });

  it('uses a single school-area dropdown and stores explicit Not sure and None of the above selections', () => {
    const { profile } = renderStep();

    const schoolSelector = screen.getByLabelText('I attended school in');

    expect(screen.queryByLabelText('Selected area(s) only')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Bristol BS or BA/ })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(schoolSelector).toHaveRole('combobox');

    selectValue('contextual_school_area', 'unknown');
    expect(profile.contextual_profile.home_area_region.school_area).toBe('unknown');
    expect(profile.contextual_profile.home_area_region.school_areas).toBeUndefined();

    selectValue('contextual_school_area', 'none');
    expect(profile.contextual_profile.home_area_region.school_area).toBe('none');

    selectValue('contextual_school_area', 'bristol_bs_ba_state_school');
    expect(profile.contextual_profile.home_area_region.school_area).toBe('bristol_bs_ba_state_school');
  });

  it('preserves manual overrides and offers the postcode value separately', async () => {
    lookupContextualPostcodeMock.mockResolvedValue({
      matched: true,
      postcode: 'BL3 5AB',
      normalised_postcode: 'BL35AB',
      polar4_quintile: 2,
      tundra_quintile: 3,
      imd_quintile: 1,
      availability: { polar4: true, tundra: true, imd: true },
    });
    const profile = createEmptyProfile();
    profile.contextual_profile.home_area_region.polar4_quintile = 'q5';
    profile.contextual_profile.home_area_region.postcode_lookup = {
      status: 'not_checked',
      values: {
        polar4: { value: 5, source: 'manual' },
        tundra: { value: null, source: 'unknown' },
        imd: { value: null, source: 'unknown', dataset_year: 2019 },
      },
    };
    const { rerender, updateProfile } = renderStep(profile);

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'BL3 5AB' } });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check postcode' }));

    await waitFor(() => expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('q3'));
    expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('q5');
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);

    expect(screen.getByText('Postcode lookup found Quintile 2.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply postcode value' }));
    expect(profile.contextual_profile.home_area_region.polar4_quintile).toBe('q2');
  });

  it('keeps manual controls available for no-match and server-error responses', async () => {
    lookupContextualPostcodeMock.mockResolvedValueOnce({
      matched: false,
      postcode: 'ZZ1 1ZZ',
      normalised_postcode: 'ZZ11ZZ',
      polar4_quintile: null,
      tundra_quintile: null,
      imd_quintile: null,
      availability: { polar4: false, tundra: false, imd: false },
    });
    const { profile, rerender, updateProfile } = renderStep();

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'ZZ1 1ZZ' } });
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check postcode' }));
    await screen.findByText('We could not find this postcode. Please check it or enter the contextual information manually.');
    selectValue('contextual_imd_quintile', 'q1');
    expect(profile.contextual_profile.home_area_region.imd_quintile).toBe('q1');

    lookupContextualPostcodeMock.mockRejectedValueOnce(new Error('offline'));
    rerender(<ContextualStep profile={profile} updateProfile={updateProfile} errors={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check postcode' }));
    await screen.findByText('We could not check the postcode at the moment. You can continue and enter the information manually.');
    selectValue('contextual_tundra_quintile', 'q2');
    expect(profile.contextual_profile.home_area_region.tundra_quintile).toBe('q2');
  });
});

describe('validateContextualStep', () => {
  it('validates UKWPMED, other programme, and partner-school completeness without invalidating an empty profile', () => {
    expect(validateContextualStep(createEmptyProfile())).toEqual({});

    const ukwpmed = createEmptyProfile();
    ukwpmed.contextual_profile.access_programmes.ukwpmed.status = 'yes';
    expect(validateContextualStep(ukwpmed).ukwpmed_programme_id).toBeTruthy();
    ukwpmed.contextual_profile.access_programmes.ukwpmed.not_sure_programme = true;
    expect(validateContextualStep(ukwpmed).ukwpmed_programme_id).toBeUndefined();

    const partner = createEmptyProfile();
    partner.contextual_profile.partner_schools.status = 'yes';
    expect(validateContextualStep(partner).partner_schools).toBeTruthy();
    partner.contextual_profile.partner_schools.status = 'not_sure';
    expect(validateContextualStep(partner).partner_schools).toBeUndefined();
  });
});
