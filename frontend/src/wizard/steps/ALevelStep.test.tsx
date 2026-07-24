import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createEmptyProfile } from '../profileTypes';
import { ALevelStep } from './ALevelStep';

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
