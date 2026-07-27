import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'applysmart.results.shortlist.v1';
export const SHORTLIST_MAX = 4;

function loadStoredShortlist(): string[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string').slice(0, SHORTLIST_MAX) : [];
  } catch {
    return [];
  }
}

export function useShortlist() {
  const [shortlist, setShortlist] = useState<string[]>(loadStoredShortlist);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(shortlist));
    } catch {
      // Storage may be unavailable (private browsing, quota); proceed without persistence.
    }
  }, [shortlist]);

  const isShortlisted = useCallback((universityId: string) => shortlist.includes(universityId), [shortlist]);

  const toggleShortlist = useCallback((universityId: string) => {
    setLimitMessage(null);
    setShortlist((prev) => {
      if (prev.includes(universityId)) {
        return prev.filter((id) => id !== universityId);
      }
      if (prev.length >= SHORTLIST_MAX) {
        setLimitMessage(
          'Your UCAS shortlist already contains four universities. Remove one before adding another.',
        );
        return prev;
      }
      return [...prev, universityId];
    });
  }, []);

  const clearLimitMessage = useCallback(() => setLimitMessage(null), []);

  return { shortlist, isShortlisted, toggleShortlist, limitMessage, clearLimitMessage };
}
