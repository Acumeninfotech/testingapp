import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { ResultsPage } from './ResultsPage';
import type { PredictionResult, SelectionMetric } from '../api/types';

const appCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../App.css'), 'utf8');

function makeResult(
  universityId: string,
  university: string,
  overrides: Partial<PredictionResult['result_card']>,
): PredictionResult {
  return {
    universityId,
    university,
    result_card: {
      primary_user_facing_recommendation: 'Example recommendation',
      recommendation_display_state: 'standard',
      primary_explanation: 'Example explanation for this university.',
      prediction: { result_band: 'realistic' },
      ...overrides,
    },
  };
}

function selectionMetric(overrides: Partial<SelectionMetric>): SelectionMetric {
  return {
    type: 'ucat',
    label: 'UCAT comparison',
    applicant_value: 2500,
    comparison_value: 2240,
    comparison_max_value: null,
    comparison_label: 'Historical interview guide',
    comparison_label_type: 'historical_interview_guide',
    comparison_context: null,
    difference: 260,
    difference_direction: 'above',
    difference_word: 'guide',
    maximum_value: 2700,
    display_mode: 'comparison',
    display_eligibility: true,
    entry_year: null,
    caveat: null,
    ...overrides,
  };
}

const RESULTS: PredictionResult[] = [
  makeResult('bristol-a100', 'University of Bristol', { prediction: { result_band: 'very_strong_interview_potential' } }),
  makeResult('keele-a100', 'Keele University', { prediction: { result_band: 'interview_likely' } }),
  makeResult('exeter-a100', 'University of Exeter', { prediction: { result_band: 'realistic' } }),
  makeResult('lincoln-a100', 'University of Lincoln', { prediction: { result_band: 'ambitious' } }),
  makeResult('aston-a100', 'Aston University', { prediction: { result_band: 'high_risk' } }),
  makeResult('buckingham-71a8', 'University of Buckingham', {
    recommendation_display_state: 'eligibility_only',
    prediction: { result_band: 'eligible_to_apply' },
    decision_transparency: {
      selection_metric: selectionMetric({
        type: 'eligibility',
        label: 'Eligibility',
        applicant_value: null,
        comparison_value: null,
        comparison_label: null,
        comparison_label_type: null,
        difference: null,
        difference_direction: null,
        difference_word: null,
        maximum_value: null,
        display_mode: 'eligibility',
        value_label: 'Eligibility requirements met',
      }),
    },
  }),
  makeResult('review-a100', 'Review University', {
    recommendation_display_state: 'manual_review',
    decision_transparency: {
      manual_review_reason:
        'This applicant route needs manual review because ApplySmart cannot automatically evaluate this published process for it yet.',
    },
  }),
  makeResult('reject-a100', 'Reject University', { recommendation_display_state: 'not_eligible' }),
];

describe('ResultsPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('shows exactly six simplified filter chips with aggregated counts', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByRole('tab', { name: '⭐ Recommended (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '🟡 Consider (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '⚠️ High Risk (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'ℹ️ Information Needed (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '❌ Not Eligible (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Results (8)' })).toBeInTheDocument();
  });

  it('initially selects the strongest populated filter group (Recommended)', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    expect(screen.getByRole('tab', { name: '⭐ Recommended (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('University of Bristol')).toBeInTheDocument();
    expect(screen.getByText('Keele University')).toBeInTheDocument();
    expect(screen.queryByText('University of Exeter')).not.toBeInTheDocument();
  });

  it('applies the recommendation badge class and styles to the top-right result status', () => {
    render(
      <ResultsPage
        results={[
          makeResult('anglia-ruskin-a100', 'Anglia Ruskin University', {
            prediction: { result_band: 'ambitious' },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );

    const card = screen.getByText('Anglia Ruskin University').closest('.university-result-card');
    const badge = card?.querySelector(
      '.university-result-summary-head .result-card-status--recommendation-badge',
    ) as HTMLElement | null;

    expect(badge).toHaveTextContent('Ambitious Choice');
    expect(badge).toHaveClass('result-card-status', 'result-card-status--recommendation-badge');

    const statusRule = appCss.match(/\.result-card-status\s*{[^}]+}/)?.[0] || '';
    const badgeRule = appCss.match(/\.result-card-status--recommendation-badge\s*{[^}]+}/)?.[0] || '';
    const ambitiousRule = appCss.match(/\.university-result-summary--ambitious\s*{[^}]+}/)?.[0] || '';

    expect(statusRule).toContain('background: var(--result-accent-bg)');
    expect(statusRule).toContain('color: var(--result-accent)');
    expect(statusRule).toContain('border: 1px solid var(--result-accent-border)');
    expect(statusRule).toContain('border-radius: 999px');
    expect(badgeRule).toContain('padding: 0.35rem 0.7rem');
    expect(ambitiousRule).toContain('--result-accent: var(--warning)');
    expect(ambitiousRule).toContain('--result-accent-bg: var(--warning-bg)');
    expect(ambitiousRule).toContain('--result-accent-border: var(--warning-border)');
  });

  it('filters results when a category pill is clicked', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: '❌ Not Eligible (1)' }));
    expect(screen.getByText('Reject University')).toBeInTheDocument();
    expect(screen.queryByText('University of Bristol')).not.toBeInTheDocument();
  });

  it('shows every result under All Results', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    expect(screen.queryByText('Review University')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    for (const result of RESULTS) {
      expect(screen.getByText(result.university)).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Load More Universities' })).not.toBeInTheDocument();
  });

  it('shows only the first six results initially, then loads the next six on demand', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Load More Universities' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
  });

  it('filters by university name search, case-insensitively', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: 'bristol' } });
    expect(screen.getByText('University of Bristol')).toBeInTheDocument();
    expect(screen.queryByText('Keele University')).not.toBeInTheDocument();
  });

  it('combines search with the active category filter', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: 'keele' } });
    fireEvent.click(screen.getByRole('tab', { name: '🟡 Consider (2)' }));
    expect(screen.queryByText('Keele University')).not.toBeInTheDocument();
    expect(screen.getByText('No universities match your current filters.')).toBeInTheDocument();
  });

  it('shows a friendly empty state when nothing matches', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: 'nonexistent university' } });
    expect(screen.getByText('No universities match your current filters.')).toBeInTheDocument();
    expect(screen.getByText('Try another category or clear your search.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('University of Bristol')).toBeInTheDocument();
    expect(screen.getByLabelText('Search universities')).toHaveValue('');
  });

  it('sorts alphabetically A-Z', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name_asc' } });
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    const sorted = [...headings].sort((a, b) => (a || '').localeCompare(b || ''));
    expect(headings).toEqual(sorted);
  });

  it('best-match sort keeps the underlying recommendation priority order inside simplified filter groups', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'University of Bristol',
      'Keele University',
      'University of Exeter',
      'University of Lincoln',
      'Aston University',
      'University of Buckingham',
      'Review University',
      'Reject University',
    ]);
  });

  it('resets visible results back to six when search, filters or sorting change', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);

    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: 'University' } });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);

    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name_desc' } });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));
    fireEvent.click(screen.getByRole('tab', { name: '⭐ Recommended (2)' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Load More Universities' })).not.toBeInTheDocument();
  });

  it('renders compact cards by default, without expanded detail sections', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    expect(screen.queryByText('Eligibility')).not.toBeInTheDocument();
    expect(screen.getAllByText('View details').length).toBeGreaterThan(0);
  });

  it('expands and collapses a card when its details toggle is clicked', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    const toggle = screen.getAllByText('View details')[0];
    fireEvent.click(toggle);
    expect(screen.getByText('Hide details')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide details'));
    expect(screen.queryByText('Eligibility')).not.toBeInTheDocument();
  });

  it('only expands the selected card, not others', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    const toggles = screen.getAllByText('View details');
    fireEvent.click(toggles[0]);
    expect(screen.getAllByText('Hide details')).toHaveLength(1);
    expect(screen.getAllByText('View details').length).toBe(toggles.length - 1);
  });

  it('adds and removes a university from the shortlist', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    const addButton = screen.getAllByText('Add to shortlist')[0];
    fireEvent.click(addButton);
    expect(screen.getByText('Remove from shortlist')).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove from shortlist'));
    expect(screen.getByText('0 / 4')).toBeInTheDocument();
  });

  it('caps the shortlist at four universities and shows a non-blocking message on the fifth attempt', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    const addButtons = screen.getAllByText('Add to shortlist');
    fireEvent.click(addButtons[0]);
    fireEvent.click(screen.getAllByText('Add to shortlist')[0]);
    fireEvent.click(screen.getAllByText('Add to shortlist')[0]);
    fireEvent.click(screen.getAllByText('Add to shortlist')[0]);
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Add to shortlist')[0]);
    expect(document.querySelector('.results-shortlist-limit-notice')).toHaveTextContent(
      'Your UCAS shortlist already contains four universities. Remove one before adding another.',
    );
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
  });

  it('keeps shortlist actions available without adding an extra filter chip', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    const bristolCard = screen.getByText('University of Bristol').closest('.university-result-card');
    fireEvent.click(within(bristolCard as HTMLElement).getByText('Add to shortlist'));
    expect(screen.queryByRole('tab', { name: /My Shortlist/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByText('University of Bristol')).toBeInTheDocument();
    expect(within(bristolCard as HTMLElement).getByText('Remove from shortlist')).toBeInTheDocument();
  });

  it('keeps shortlisted state after loading more results and filtering', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load More Universities' }));

    const reviewCard = screen.getByText('Review University').closest('.university-result-card');
    fireEvent.click(within(reviewCard as HTMLElement).getByText('Add to shortlist'));
    expect(within(reviewCard as HTMLElement).getByText('Remove from shortlist')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search universities'), { target: { value: 'review' } });
    const filteredReviewCard = screen.getByText('Review University').closest('.university-result-card');
    expect(within(filteredReviewCard as HTMLElement).getByText('Remove from shortlist')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    expect(screen.getByText('Review University')).toBeInTheDocument();
    expect(within(screen.getByText('Review University').closest('.university-result-card') as HTMLElement).getByText('Remove from shortlist')).toBeInTheDocument();
  });

  it('does not fall through Very Strong to a Verify/manual-review label', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    const bristolCard = screen.getByText('University of Bristol').closest('.university-result-card');
    expect(within(bristolCard as HTMLElement).getByText('Very Strong Choice')).toBeInTheDocument();
    expect(within(bristolCard as HTMLElement).queryByText('Verify')).not.toBeInTheDocument();
  });

  it('groups Realistic and Ambitious under Consider while keeping High Risk separate', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: '🟡 Consider (2)' }));
    expect(screen.getByText('University of Exeter')).toBeInTheDocument();
    expect(screen.getByText('University of Lincoln')).toBeInTheDocument();
    expect(screen.queryByText('Aston University')).not.toBeInTheDocument();
    const lincolnCard = screen.getByText('University of Lincoln').closest('.university-result-card');
    expect(within(lincolnCard as HTMLElement).getByText('Ambitious Choice')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '⚠️ High Risk (1)' }));
    expect(screen.getByText('Aston University')).toBeInTheDocument();
    expect(screen.queryByText('University of Lincoln')).not.toBeInTheDocument();
    const astonCard = screen.getByText('Aston University').closest('.university-result-card');
    expect(within(astonCard as HTMLElement).getByText('High Risk')).toBeInTheDocument();
  });

  it('groups eligibility-only and unresolved universities under Information Needed without changing card badges', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ℹ️ Information Needed (2)' }));
    expect(screen.getByText('University of Buckingham')).toBeInTheDocument();
    expect(screen.getByText('Review University')).toBeInTheDocument();
    const buckinghamCard = screen.getByText('University of Buckingham').closest('.university-result-card');
    expect(within(buckinghamCard as HTMLElement).getByText('Eligible to Apply')).toBeInTheDocument();
  });

  it('keeps manual-review results clearly identified', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ℹ️ Information Needed (2)' }));
    const reviewCard = screen.getByText('Review University').closest('.university-result-card');
    expect(within(reviewCard as HTMLElement).getByText('Needs Review')).toBeInTheDocument();
  });

  it('retains full result information after expanding a card', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getAllByText('View details')[0]);
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Based on ApplySmart's assessment, your academic profile appears highly competitive for this applicant group.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it('shows a UCAT comparison when the applicant is above the guide', () => {
    render(
      <ResultsPage
        results={[
          makeResult('bristol-a100', 'University of Bristol', {
            prediction: { result_band: 'very_strong_interview_potential' },
            decision_transparency: {
              selection_metric: selectionMetric({ applicant_value: 2500, comparison_value: 2240, difference: 260 }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );
    expect(screen.getByText('UCAT comparison')).toBeInTheDocument();
    expect(screen.getByText('2500 / 2700')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/UCAT comparison, 2500 \/ 2700, versus historical interview guide 2240/i),
    ).toBeInTheDocument();
    expect(screen.getByText('+260')).toBeInTheDocument();
    expect(screen.getByText('above guide')).toBeInTheDocument();
  });

  it('keeps decimal score differences visible without showing duplicate comparison labels in the top section', () => {
    render(
      <ResultsPage
        results={[
          makeResult('aston-a100', 'Aston University', {
            primary_user_facing_recommendation: 'Strong choice based on your selection score',
            primary_explanation:
              'Your selection score is 1.5 points above the historical interview guide of 33.5 for this applicant pool. Interview thresholds may change each admissions cycle.',
            prediction: { result_band: 'interview_likely' },
            decision_transparency: {
              compact_status: {
                label: 'Historical interview guide exceeded',
                type: 'selection_comparison',
                tone: 'positive',
              },
              selection_metric: selectionMetric({
                type: 'points',
                label: 'Points score',
                applicant_value: 35,
                comparison_value: 33.5,
                comparison_label: 'Historical interview guide',
                comparison_label_type: 'historical_interview_guide',
                difference: 1.5,
                difference_direction: 'above',
                maximum_value: 36,
                display_mode: 'score',
              }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );

    expect(screen.getByText('Strong choice for your application')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Based on ApplySmart's assessment, your selection score appears competitive for this applicant group.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Historical interview guide exceeded')).not.toBeInTheDocument();
    expect(screen.queryByText('Your selection score is 1.')).not.toBeInTheDocument();
    expect(screen.getByText('+1.5')).toBeInTheDocument();
    expect(screen.getByText('above guide')).toBeInTheDocument();
    expect(screen.getByText('35 / 36')).toBeInTheDocument();
  });

  it('falls back to the eligibility-stage status when compact_status is absent', () => {
    render(
      <ResultsPage
        results={[
          makeResult('legacy-a100', 'Legacy University', {
            prediction: { result_band: 'realistic' },
            decision_transparency: {
              decision_path: [
                {
                  stage: 'Eligibility',
                  status: 'Met',
                  summary: 'Eligibility was assessed.',
                  checks: [],
                },
              ],
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );

    expect(screen.getByText('You meet the academic requirements.')).toBeInTheDocument();
  });

  it('shows a UCAT comparison when the applicant is below the guide', () => {
    render(
      <ResultsPage
        results={[
          makeResult('bristol-a100', 'University of Bristol', {
            prediction: { result_band: 'high_risk' },
            decision_transparency: {
              selection_metric: selectionMetric({
                applicant_value: 2150,
                comparison_value: 2240,
                difference: -90,
                difference_direction: 'below',
              }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );
    expect(screen.getByText('2150 / 2700')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('below guide')).toBeInTheDocument();
  });

  it('shows At guide when the UCAT difference is zero', () => {
    render(
      <ResultsPage
        results={[
          makeResult('bristol-a100', 'University of Bristol', {
            prediction: { result_band: 'realistic' },
            decision_transparency: {
              selection_metric: selectionMetric({
                applicant_value: 2240,
                comparison_value: 2240,
                difference: 0,
                difference_direction: 'at',
              }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );
    expect(screen.getByText('At')).toBeInTheDocument();
    expect(screen.getByText('guide')).toBeInTheDocument();
  });

  it('uses the actual metric for composite, points and eligibility-only universities', () => {
    render(
      <ResultsPage
        results={[
          makeResult('birmingham-a100', 'University of Birmingham', {
            prediction: { result_band: 'interview_likely' },
            decision_transparency: {
              selection_metric: selectionMetric({
                type: 'selection_score',
                label: 'Selection score',
                applicant_value: 8.5,
                comparison_value: null,
                comparison_label: null,
                comparison_label_type: null,
                difference: null,
                difference_direction: null,
                difference_word: null,
                maximum_value: 10,
                display_mode: 'score',
              }),
            },
          }),
          makeResult('nottingham-a100', 'University of Nottingham', {
            prediction: { result_band: 'realistic' },
            decision_transparency: {
              selection_metric: selectionMetric({
                type: 'points',
                label: 'Points score',
                applicant_value: 54,
                comparison_value: null,
                comparison_label: null,
                comparison_label_type: null,
                difference: null,
                difference_direction: null,
                difference_word: null,
                maximum_value: 82,
                display_mode: 'score',
              }),
            },
          }),
          makeResult('buckingham-71a8', 'University of Buckingham', {
            recommendation_display_state: 'eligibility_only',
            prediction: { result_band: 'eligible_to_apply' },
            decision_transparency: {
              selection_metric: selectionMetric({
                type: 'eligibility',
                label: 'Eligibility',
                applicant_value: null,
                comparison_value: null,
                comparison_label: null,
                comparison_label_type: null,
                difference: null,
                difference_direction: null,
                difference_word: null,
                maximum_value: null,
                display_mode: 'eligibility',
                value_label: 'Eligibility requirements met',
              }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (3)' }));
    expect(screen.getByText('8.5 / 10')).toBeInTheDocument();
    expect(screen.getByText('54 / 82')).toBeInTheDocument();
    expect(screen.getByText('Eligibility requirements met')).toBeInTheDocument();
    expect(screen.queryByText(/UCAT comparison/i)).not.toBeInTheDocument();
  });

  it('does not render NaN, undefined, empty placeholder text or a comparison panel without valid comparison data', () => {
    render(
      <ResultsPage
        results={[
          makeResult('ranking-only-a100', 'Ranking Only University', {
            prediction: { result_band: 'realistic' },
            decision_transparency: {
              selection_metric: selectionMetric({
                label: 'UCAT ranking',
                applicant_value: 2500,
                comparison_value: null,
                comparison_label: null,
                comparison_label_type: null,
                difference: null,
                difference_direction: null,
                difference_word: null,
                display_mode: 'score',
              }),
            },
          }),
        ]}
        onStartOver={() => {}}
      />,
    );
    expect(screen.getByText('UCAT ranking')).toBeInTheDocument();
    expect(screen.getByText('2500 / 2700')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('NaN');
    expect(document.body).not.toHaveTextContent('undefined');
    expect(document.body).not.toHaveTextContent('Selection information unavailable');
    expect(screen.queryByText(/^vs$/i)).not.toBeInTheDocument();
  });

  it('keeps compact cards structurally equal-height friendly across desktop and mobile CSS classes', () => {
    render(<ResultsPage results={RESULTS} onStartOver={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All Results (8)' }));
    const cards = document.querySelectorAll('.university-result-card:not(.university-result-card--expanded)');
    expect(cards).toHaveLength(6);
    for (const card of Array.from(cards)) {
      expect(card.querySelector('.university-result-summary')).toBeInTheDocument();
      expect(card.querySelector('.university-result-selection-metric')).toBeInTheDocument();
      expect(card.querySelector('.university-result-actions')).toBeInTheDocument();
    }
  });
});
