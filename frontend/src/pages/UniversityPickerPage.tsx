import { useEffect, useState } from 'react';
import { fetchUniversities } from '../api/client';
import type { University } from '../api/types';
import { UniversityCard } from '../components/UniversityCard';

type LoadState = 'loading' | 'success' | 'error';

export function UniversityPickerPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;

    fetchUniversities()
      .then((data) => {
        if (cancelled) return;
        setUniversities(data.universities);
        setState('success');
      })
      .catch(() => {
        if (cancelled) return;
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="page-header">
        <h1>Choose universities</h1>
        <p>Browse the medical schools ApplySmart currently supports.</p>
      </div>
      {state === 'loading' && <p>Loading universities&hellip;</p>}
      {state === 'error' && <p role="alert">Could not load universities. Is the API running?</p>}
      {state === 'success' && universities.length === 0 && (
        <p>No production-ready universities are available yet.</p>
      )}
      {state === 'success' && universities.length > 0 && (
        <div className="university-grid" data-testid="university-grid">
          {universities.map((university) => (
            <UniversityCard key={university.id} university={university} />
          ))}
        </div>
      )}
    </section>
  );
}
