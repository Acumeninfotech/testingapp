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

describe('UniversityCard', () => {
  it('does not render internal confidence or university-level manual-review metadata', () => {
    render(<UniversityCard university={legacyUniversityWithInternalMetadata} />);

    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manual review/i)).not.toBeInTheDocument();
  });
});
