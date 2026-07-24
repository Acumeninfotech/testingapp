import { useCallback, useEffect, useState } from 'react';
import { createEmptyProfile, type WizardProfile } from './profileTypes';

const STORAGE_KEY = 'applysmart.wizard.profile.v1';

function loadStoredProfile(): WizardProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    const parsed = JSON.parse(raw);
    // Merge onto a fresh default so newly added fields are never undefined.
    return { ...createEmptyProfile(), ...parsed };
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
