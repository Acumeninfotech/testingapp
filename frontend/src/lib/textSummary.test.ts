import { describe, expect, it } from 'vitest';
import { firstCompleteSentence } from './textSummary';

describe('firstCompleteSentence', () => {
  it('preserves a decimal value in the first sentence', () => {
    expect(
      firstCompleteSentence(
        'Your selection score is 1.5 points above the historical interview guide of 33.5 for this applicant pool. Interview thresholds may change.',
      ),
    ).toBe(
      'Your selection score is 1.5 points above the historical interview guide of 33.5 for this applicant pool.',
    );
  });

  it('preserves multiple decimal numbers in one sentence', () => {
    expect(
      firstCompleteSentence(
        'Your score is 7.236 above a 33.5 guide and the calculated score is 35.0 overall. Extra detail follows.',
      ),
    ).toBe('Your score is 7.236 above a 33.5 guide and the calculated score is 35.0 overall.');
  });

  it('extracts a normal sentence without decimals', () => {
    expect(firstCompleteSentence('Entry requirements are met. Selection guidance is available.')).toBe(
      'Entry requirements are met.',
    );
  });

  it('extracts only the first complete sentence from multi-sentence text', () => {
    expect(firstCompleteSentence('Strong choice based on your selection score. Treat this as guidance.')).toBe(
      'Strong choice based on your selection score.',
    );
  });

  it('preserves decimal percentages before the sentence ending', () => {
    expect(firstCompleteSentence('Your score is 7.236% above the guide. This remains guidance.')).toBe(
      'Your score is 7.236% above the guide.',
    );
  });

  it('does not split on common abbreviations', () => {
    expect(firstCompleteSentence('Dr. Smith confirmed eligibility. Selection guidance is available.')).toBe(
      'Dr. Smith confirmed eligibility.',
    );
  });
});
