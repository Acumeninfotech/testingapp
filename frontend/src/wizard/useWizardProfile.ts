import { useCallback, useEffect, useState } from 'react';
import { createEmptyProfile, type AgeAtCourseStartBand, type WizardProfile } from './profileTypes';

const STORAGE_KEY = 'applysmart.wizard.profile.v1';

function ageBandFromDateOfBirth(dateOfBirth: unknown, applicationYear: unknown): AgeAtCourseStartBand | '' {
  if (typeof dateOfBirth !== 'string' || !dateOfBirth) return '';
  const entryYear = typeof applicationYear === 'number' ? applicationYear : 2027;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const referenceDate = new Date(Date.UTC(entryYear, 8, 1));
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) return '';

  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  if (
    referenceDate.getUTCMonth() < birth.getUTCMonth() ||
    (
      referenceDate.getUTCMonth() === birth.getUTCMonth() &&
      referenceDate.getUTCDate() < birth.getUTCDate()
    )
  ) {
    age -= 1;
  }

  if (age >= 18) return 'age_18_or_over';
  if (age === 17) return 'age_17';
  return 'under_17';
}

function normaliseStoredProfile(parsed: unknown): WizardProfile {
  const empty = createEmptyProfile();
  if (!parsed || typeof parsed !== 'object') return empty;
  const saved = parsed as Partial<WizardProfile> & {
    applicant_identity?: Partial<WizardProfile['applicant_identity']> & { date_of_birth?: string };
  };
  const savedIdentity = (saved.applicant_identity || {}) as Partial<WizardProfile['applicant_identity']> & {
    date_of_birth?: string;
  };
  const savedCourseTarget = (saved.course_target || {}) as Partial<WizardProfile['course_target']>;
  const ageBand =
    savedIdentity.age_at_course_start_band ||
    ageBandFromDateOfBirth(savedIdentity.date_of_birth, savedCourseTarget.application_year);

  return {
    ...empty,
    ...saved,
    applicant_identity: {
      ...empty.applicant_identity,
      ...savedIdentity,
      age_at_course_start_band: ageBand,
      date_of_birth: '',
    },
    course_target: {
      ...empty.course_target,
      ...savedCourseTarget,
    },
  };
}

function loadStoredProfile(): WizardProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    const parsed = JSON.parse(raw);
    return normaliseStoredProfile(parsed);
  } catch {
    return createEmptyProfile();
  }
}

export function useWizardProfile() {
  const [profile, setProfile] = useState<WizardProfile>(loadStoredProfile);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage may be unavailable (private browsing, quota); proceed without persistence.
    }
  }, [profile]);

  const updateProfile = useCallback((updater: (prev: WizardProfile) => WizardProfile) => {
    setProfile(updater);
  }, []);

  const resetProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setProfile(createEmptyProfile());
  }, []);

  return { profile, updateProfile, resetProfile };
}
