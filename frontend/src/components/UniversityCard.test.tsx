import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UniversityCard } from './UniversityCard';
import type { University } from '../api/types';

const legacyUniversityWithInternalMetadata = {
  id: 'keele-a100',
  university_name: 'Keele University',
  course_code: 'A100',
  course_name: 'MBChB Medicine',
  entry_route: 'Standard Entry',
  country: 'England',
  fee_status: ['home', 'international'],
  entry_year: 2027,
  prediction_confidence: 'low',
  manual_review_required: true,
} as University;

function makeUniversity(overrides: Partial<University>): University {
  return {
    id: 'example-a100',
    university_name: 'Example University',
    course_code: 'A100',
    course_name: 'MBChB Medicine',
    entry_route: 'Standard Entry',
    country: 'England',
    fee_status: ['home', 'international'],
    entry_year: 2027,
    ...overrides,
  };
}

describe('UniversityCard', () => {
  it('does not render internal confidence or university-level manual-review metadata', () => {
    render(<UniversityCard university={legacyUniversityWithInternalMetadata} />);

    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manual review/i)).not.toBeInTheDocument();
  });

  it('renders Brighton and Sussex Medical School with the configured BS avatar code', () => {
    render(
      <UniversityCard
        university={makeUniversity({
          id: 'brighton-and-sussex-a100',
          university_name: 'Brighton and Sussex Medical School',
        })}
      />,
    );

    expect(screen.getByText('BS')).toBeInTheDocument();
  });

  it('renders City St George’s, University of London with the configured CS avatar code', () => {
    render(
      <UniversityCard
        university={makeUniversity({
          id: 'city-st-george-s-of-london-a100',
          university_name: "City St George's, University of London",
        })}
      />,
    );

    expect(screen.getByText('CS')).toBeInTheDocument();
  });
});
