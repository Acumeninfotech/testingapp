import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard';
import type { PredictionResult } from '../api/types';

function makeResult(
  overrides: Partial<PredictionResult['result_card']>,
  resultOverrides: Partial<Omit<PredictionResult, 'result_card'>> = {},
): PredictionResult {
  return {
    universityId: 'keele-a100',
    university: 'Keele University',
    ...resultOverrides,
    result_card: {
      primary_user_facing_recommendation: 'Good chance – recommend applying',
      recommendation_display_state: 'standard',
      primary_explanation: 'Example explanation.',
      prediction: { result_band: 'realistic' },
      ...overrides,
    },
  };
}

describe('ResultCard', () => {
  it('labels a strong interview_likely band as Strong choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'interview_likely' } })} />);
    expect(screen.getByText('Strong choice')).toBeInTheDocument();
  });

  it('labels a very_strong_interview_potential band as Very Strong Choice, not Verify', () => {
    render(
      <ResultCard result={makeResult({ prediction: { result_band: 'very_strong_interview_potential' } })} />,
    );
    expect(screen.getByText('Very Strong Choice')).toBeInTheDocument();
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/This result needs a closer look/),
    ).not.toBeInTheDocument();
  });

  it('labels a realistic band as Realistic choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(screen.getByText('Realistic choice')).toBeInTheDocument();
  });

  it('labels an ambitious band as Ambitious choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'ambitious' } })} />);
    expect(screen.getByText('Ambitious choice')).toBeInTheDocument();
  });

  it('uses a configured public choice label for the status badge', () => {
    render(
      <ResultCard
        result={makeResult({
          primary_user_facing_recommendation: 'Realistic Choice',
          prediction: { result_band: 'ambitious' },
        })}
      />,
    );
    expect(document.querySelector('.result-card-status')).toHaveTextContent('Realistic Choice');
    expect(screen.queryByText('Ambitious choice')).not.toBeInTheDocument();
  });

  it('labels a high_risk band as Ambitious choice (cautionary, not alarming)', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'high_risk' } })} />);
    expect(screen.getByText('Ambitious choice')).toBeInTheDocument();
  });

  it('renders the King’s A100 public wording without stale formula caveats', () => {
    const mainSummary =
      "Your academic profile meets King's College London's entry requirements, and your UCAT performance is above the range seen in applicants historically invited to interview. Based on King's published selection approach and available admissions evidence, your application is assessed as a Strong Choice for interview consideration.";
    const disclaimer =
      'Interview decisions vary each year depending on the applicant pool, available interview capacity and university selection decisions. ApplySmart provides an evidence-based interview prediction, not a guarantee of interview.';
    const selectionApproach =
      "King's College London assesses applicants using academic eligibility together with UCAT performance, GCSE attainment, Situational Judgement Test performance and contextual information during interview shortlisting. Your prediction has been assessed against this published selection approach and available historical admissions evidence.";
    const historicalContext =
      "Your UCAT performance compares favourably with applicants who have historically been invited to interview at King's College London. Interview thresholds can vary between admissions cycles depending on applicant competition and interview capacity, but your profile falls within a historically competitive range for interview consideration.";

    render(
      <ResultCard
        result={makeResult(
          {
            primary_user_facing_recommendation: 'Strong interview outlook',
            primary_explanation: mainSummary,
            trust_statement: disclaimer,
            prediction: { result_band: 'interview_likely' },
            decision_transparency: {
              decision_path: [
                {
                  stage: 'Eligibility',
                  status: 'Met',
                  summary: 'Published academic gates are met.',
                  checks: [],
                },
                {
                  stage: 'Selection model',
                  status: 'Assessed',
                  summary: selectionApproach,
                  checks: [
                    { label: 'Selection approach', status: 'Assessed', summary: selectionApproach },
                  ],
                },
                {
                  stage: 'Historical guidance',
                  status: 'Guidance available',
                  summary: historicalContext,
                  checks: [
                    {
                      label: 'Recent admissions data',
                      status: 'Historical',
                      summary: 'approximately 2,810 applicants, 982 interviewed and 762 offers.',
                    },
                  ],
                },
              ],
            },
          },
          { universityId: 'king-s-college-london-a100', university: "King's College London" },
        )}
      />,
    );

    expect(screen.getByText('Strong interview outlook')).toBeInTheDocument();
    expect(screen.getByText(mainSummary)).toBeInTheDocument();
    expect(screen.getByText(disclaimer)).toBeInTheDocument();
    expect(screen.getByText('Academic requirements:')).toBeInTheDocument();
    expect(screen.getByText('Met')).toBeInTheDocument();
    expect(screen.getByText('UCAT comparison:')).toBeInTheDocument();
    expect(screen.getByText('Above the historical interview range')).toBeInTheDocument();
    expect(screen.getByText(selectionApproach)).toBeInTheDocument();
    expect(screen.getByText(historicalContext)).toBeInTheDocument();
    expect(screen.getByText('Recent admissions data:')).toBeInTheDocument();
    expect(screen.getByText('approximately 2,810 applicants, 982 interviewed and 762 offers.')).toBeInTheDocument();
    expect(document.querySelector('.result-card-status')).toHaveTextContent('Strong choice');
    expect(document.body).not.toHaveTextContent('2022 formula');
    expect(document.body).not.toHaveTextContent('not confirmed for current cycles');
  });

  it('labels a not_eligible display state as Not suitable', () => {
    render(
      <ResultCard
        result={makeResult({ recommendation_display_state: 'not_eligible' })}
      />,
    );
    expect(screen.getByText('Not suitable')).toBeInTheDocument();
  });

  it('shows a Verify notice, not a rejection, for manual_review state', () => {
    render(
      <ResultCard
        result={makeResult({ recommendation_display_state: 'manual_review' })}
      />,
    );
    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('not a rejection');
  });

  it('shows insufficient evidence as a Verify-style notice', () => {
    render(
      <ResultCard
        result={makeResult({ recommendation_display_state: 'insufficient_evidence' })}
      />,
    );
    expect(screen.getByText('Verify')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('labels official-prediction-unavailable advisory guidance without Verify or empty fees', () => {
    render(
      <ResultCard
        result={makeResult({
          primary_user_facing_recommendation: 'Strong Interview Potential',
          recommendation_display_state: 'standard',
          primary_explanation:
            'Based on the official KMMS entry requirements and the applicant information provided, you meet the supported entry requirements. ApplySmart has analysed your profile against the available KMMS selection information and historical interview evidence. Your UCAT score of 2550 is above the available historical reference range of 1855-1864, indicating a competitive profile and strong interview potential. KMMS has not published an exact 2026 interview cut-off on the current UCAT scale. This prediction is based on official university information and available historical evidence. Final interview decisions remain with KMMS and may vary according to applicant competition, contextual information and other selection factors.',
          trust_statement:
            'ApplySmart does not alter university requirements or present unofficial information as an official rule. Predictions are generated only after applying the published university criteria and analysing the available admissions evidence.',
          prediction: {
            available: false,
            result_band: 'interview_likely',
            prediction_status: 'prediction_unavailable',
            official_prediction: {
              available: false,
              prediction_status: 'prediction_unavailable',
            },
          },
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'You meet the published entry requirements covered by ApplySmart.',
                checks: [],
              },
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary:
                  'UCAT: 2550 - above the historical reference range of 1855-1864. This is encouraging historical guidance only and does not confirm an interview.',
                checks: [],
              },
            ],
            ucat_comparison: {
              comparison_type: 'historical_range',
              applicant_ucat: 2550,
              benchmark_min: 1855,
              benchmark_max: 1864,
              difference_from_benchmark: null,
              position: 'above',
              applicant_pool: 'Home, Rest of UK applicants',
              sjt_policy: 'Bands 1-3 are accepted.',
              sjt_outcome: 'met',
              sjt_summary: 'Met - Bands 1-3 are accepted.',
              applicant_sjt_band: 2,
              official_ucat_minimum: null,
            },
          },
          fee_information: null,
        })}
      />,
    );

    expect(screen.getByText('ApplySmart Analysis')).toBeInTheDocument();
    expect(screen.getByText('Strong Interview Potential')).toBeInTheDocument();
    expect(screen.getByText(/UCAT score of 2550 is above the available historical reference range of 1855-1864/i)).toBeInTheDocument();
    expect(screen.getByText(/not published an exact 2026 interview cut-off on the current UCAT scale/i)).toBeInTheDocument();
    expect(screen.getByText(/not alter university requirements or present unofficial information as an official rule/i)).toBeInTheDocument();
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Entry requirements met')).toBeInTheDocument();
    expect(screen.getByText('Your UCAT')).toBeInTheDocument();
    expect(screen.getByText('2550')).toBeInTheDocument();
    expect(screen.getByText('Historical range')).toBeInTheDocument();
    expect(screen.getByText('1855-1864')).toBeInTheDocument();
    expect(screen.getByText('Above historical range')).toBeInTheDocument();
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
  });

  it('does not show evidence confidence text on the public card', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          evidence_confidence: {
            level: 'Medium',
            summary: 'The recommendation is supported by core admissions evidence.',
          },
        })}
      />,
    );
    expect(screen.queryByText('Evidence Confidence')).not.toBeInTheDocument();
    expect(screen.queryByText(/Medium: The recommendation is supported/)).not.toBeInTheDocument();
  });

  it('does not show raw confidence labels or badges for a standard eligible result', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          evidence_confidence: {
            level: 'Limited',
            summary: 'Internal confidence summary that should not render.',
          },
          decision_transparency: {
            evidence_confidence: {
              level: 'Limited',
              summary: 'Internal confidence summary that should not render.',
            },
            decision_path: [
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary:
                  'Interview thresholds may change each admissions cycle depending on applicant competition and interview capacity. Historical figures are guidance only, not a current cut-off, and do not guarantee an interview.',
                checks: [
                  {
                    label: 'Important limitation',
                    status: 'Guidance only',
                    summary:
                      'Interview thresholds may change each admissions cycle depending on applicant competition and interview capacity. Historical figures are guidance only, not a current cut-off, and do not guarantee an interview.',
                  },
                ],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.queryByText(/Low prediction confidence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Confidence:\s*(Low|Medium|High|Limited)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Low-confidence prediction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prediction reliability/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Internal confidence summary/i)).not.toBeInTheDocument();
    expect(screen.getByText(/applicant competition and interview capacity/i)).toBeInTheDocument();
  });

  it('throws for a standard result missing prediction.result_band', () => {
    expect(() =>
      render(
        <ResultCard
          result={makeResult({
            prediction: undefined,
          })}
        />,
      ),
    ).toThrow(/missing prediction\.result_band/);
  });

  it('does not show the Verify notice for a standard eligible result', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not show a warning banner for a Realistic result', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(document.querySelector('.result-card-warning-list')).not.toBeInTheDocument();
  });

  it('does not show the Verify notice for a not-eligible result (uses inline explanation instead)', () => {
    render(<ResultCard result={makeResult({ recommendation_display_state: 'not_eligible' })} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows Entry requirements: Met in the Checks section when eligibility passes', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Requirements met.',
                checks: [{ label: 'GCSE requirement', status: 'Met', summary: 'Six GCSEs at grade 6 or above.' }],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText('Checks')).toBeInTheDocument();
    expect(screen.getByText('Entry requirements:')).toBeInTheDocument();
    expect(screen.getByText('Met')).toBeInTheDocument();
    expect(screen.queryByText('Six GCSEs at grade 6 or above.')).not.toBeInTheDocument();
  });

  it('shows a genuine warning and Entry requirements: Not met when a requirement fails', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Not met',
                summary: 'Requirements not met.',
                checks: [{ label: 'GCSE requirement', status: 'Not met', summary: 'A required GCSE subject is missing.' }],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText('A required GCSE subject is missing.')).toBeInTheDocument();
    expect(screen.getByText('Not met')).toBeInTheDocument();
  });

  it('does not render "Why this result" bullets', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          decision_transparency: { key_reasons: ['Your UCAT score is within the historical range.'] },
        })}
      />,
    );
    expect(screen.queryByText('Why this result')).not.toBeInTheDocument();
  });

  it('shows the total selection score prominently for a scoring-model university', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          decision_transparency: {
            score_breakdown: {
              name: 'Selection score',
              value: 35,
              max: 36,
              status: 'calculated',
              explanation: 'GCSE academic score out of 24 plus UCAT score out of 12',
              checks: [
                { label: 'GCSE score', status: 'Counted', summary: '24 out of 24.' },
                { label: 'UCAT score', status: 'Counted', summary: '11 out of 12.' },
              ],
            },
            decision_path: [
              { stage: 'Selection model', status: 'Assessed', summary: '', checks: [] },
            ],
          },
        })}
      />,
    );
    expect(screen.getByLabelText('Total selection score')).toBeInTheDocument();
    expect(screen.getByText('Total selection score')).toBeInTheDocument();
    expect(screen.getByText('35 / 36')).toBeInTheDocument();
    expect(screen.queryByText('Selection score:')).not.toBeInTheDocument();
    expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    expect(screen.getByText('GCSE academic score out of 24 plus UCAT score out of 12')).toBeInTheDocument();
  });

  it('renders Lincoln applicant-facing score and SJT wording without public route labels or fees', () => {
    render(
      <ResultCard
        result={{
          universityId: 'lincoln-a100',
          university: 'University of Lincoln',
          result_card: {
            course_identity: { profile_id: 'lincoln-a100' },
            applicant_context: {
              admissions_tests: {
                ucat: {
                  sjt_band: 2,
                },
              },
            },
            primary_user_facing_recommendation: 'Realistic Choice',
            recommendation_display_state: 'standard',
            primary_explanation:
              'Your Lincoln selection score is in ApplySmart’s provisional realistic zone. Lincoln has not published an official interview cutoff, so use this as guidance rather than a guaranteed interview.',
            prediction: { result_band: 'ambitious' },
            decision_transparency: {
              score_breakdown: {
                name: 'Total selection score',
                value: 46,
                max: 60,
                status: 'calculated',
                explanation:
                  "Lincoln calculates an official pre-interview selection score out of 60 using the components that apply to this applicant's qualification route.",
                checks: [
                  { label: 'GCSE score', status: 'Counted', summary: '24 out of 30.' },
                  { label: 'UCAT score', status: 'Counted', summary: '12 out of 15.' },
                  { label: 'SJT score', status: 'Counted', summary: '10 out of 15.' },
                ],
              },
              decision_path: [
                { stage: 'Eligibility', status: 'Met', summary: 'Entry requirements met.', checks: [] },
                {
                  stage: 'Selection model',
                  status: 'Assessed',
                  summary:
                    'Lincoln calculates an official pre-interview score out of 60, then compares it with provisional guidance.',
                  checks: [],
                },
              ],
            },
            fee_information: {
              fee_status: 'home',
              currency: 'GBP',
              first_year: 9250,
            },
          },
        }}
      />,
    );

    expect(screen.getByLabelText('Total selection score')).toHaveTextContent('46 / 60');
    expect(screen.getAllByText('Band 2: 10 / 15 SJT points counted.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Model A|Model B/)).not.toBeInTheDocument();
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
  });

  it('shows ranking evidence, SJT status and selection approach for ranking-only universities', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          decision_transparency: {
            ucat_comparison: {
              comparison_type: 'historical_threshold',
              applicant_ucat: 2420,
              benchmark_min: 1935,
              benchmark_max: null,
              difference_from_benchmark: 485,
              position: 'above',
              applicant_pool: 'Home applicants',
              sjt_policy: 'Bands 1-3 are accepted.',
              sjt_outcome: 'met',
              sjt_summary: 'Met - Bands 1-3 are accepted.',
              applicant_sjt_band: 1,
              official_ucat_minimum: null,
            },
            decision_path: [
              {
                stage: 'Selection model',
                status: 'Assessed',
                summary: 'Ranks by UCAT total.',
                checks: [
                  { label: 'UCAT total entered', status: 'Used for ranking', summary: '2420 out of 2700.' },
                  { label: 'UCAT', status: 'Above', summary: 'UCAT: 2420 - 485 points above the previous interview threshold of 1935.' },
                  { label: 'SJT requirement', status: 'Met', summary: 'Met - Bands 1-3 are accepted.' },
                  {
                    label: 'Selection approach',
                    status: 'Ranking/cut-off based',
                    summary: 'This university does not publish a combined points score.',
                  },
                ],
              },
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'Historical information is guidance only.',
                checks: [
                  { label: 'UCAT comparison', status: 'Compared', summary: 'UCAT: 2420 - 485 points above the previous interview threshold of 1935.' },
                ],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.queryByText('UCAT total entered:')).not.toBeInTheDocument();
    expect(screen.getByText('Selection approach')).toBeInTheDocument();
    expect(screen.queryByText('SJT band:')).not.toBeInTheDocument();
    expect(screen.getByText(/does not publish a combined points score/)).toBeInTheDocument();
    expect(screen.getByText('UCAT:')).toBeInTheDocument();
    expect(screen.getAllByText(/485 points above/).length).toBeGreaterThan(0);
    expect(screen.getByText('SJT:')).toBeInTheDocument();
    expect(screen.getAllByText('Met - Bands 1-3 are accepted.').length).toBeGreaterThan(0);
    expect(screen.getByText('Historical benchmark')).toBeInTheDocument();
    expect(screen.getByText('Difference')).toBeInTheDocument();
    expect(screen.getByText('+485')).toBeInTheDocument();
  });

  it('shows applicant pool, academic status and historical context from decision transparency', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          evidence_confidence: {
            level: 'Medium',
            summary: 'Core evidence is available.',
          },
          decision_transparency: {
            warnings: [
              'derived_interview_guidance_not_official_university_threshold',
              'stage_2_interview_selection.interview_scoring',
              'activation-ready production scope',
            ],
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'You meet the published entry requirements covered by ApplySmart.',
                checks: [],
              },
              {
                stage: 'Selection model',
                status: 'Assessed',
                summary: 'Applicants are ranked by UCAT total.',
                checks: [
                  { label: 'Applicant pool', status: 'Used', summary: 'Home applicants' },
                  { label: 'UCAT total entered', status: 'Used for ranking', summary: '2420 out of 2700.' },
                  { label: 'SJT band', status: 'On file', summary: 'Band 1.' },
                ],
              },
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'The applicant is compared with previous admissions cycles.',
                checks: [
                  {
                    label: 'Home (2025)',
                    status: 'Historical',
                    summary: '~100 interviewed.',
                  },
                ],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Applicant pool')).toBeInTheDocument();
    expect(screen.getByText('Home applicants')).toBeInTheDocument();
    expect(screen.getByText('Academic status')).toBeInTheDocument();
    expect(screen.getByText(/published entry requirements/)).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText(/previous admissions cycles/)).toBeInTheDocument();
    expect(screen.queryByText(/derived interview guidance/)).not.toBeInTheDocument();
    expect(screen.queryByText(/stage 2 interview selection/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activation-ready/i)).not.toBeInTheDocument();
    expect(document.querySelector('.result-card-warning-list')).not.toBeInTheDocument();
  });

  it('shows SJT only when it causes rejection (Band 4 excluded)', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          decision_transparency: {
            decision_path: [
              {
                stage: 'Selection model',
                status: 'Not met',
                summary: '',
                checks: [
                  { label: 'SJT band', status: 'Excluded', summary: 'Your SJT band is excluded by this university’s published policy.' },
                ],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText('SJT:')).toBeInTheDocument();
    expect(screen.getAllByText('Excluded by this university’s SJT policy.').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Your SJT band is excluded by this university’s published policy.').length,
    ).toBeGreaterThan(0);
  });

  it('shows a guaranteed-interview banner instead of a scored recommendation', () => {
    render(
      <ResultCard
        result={makeResult({
          interview_outcome: 'guaranteed_interview',
          primary_explanation: 'Every published guaranteed-interview condition for this route has been verified as met.',
        })}
      />,
    );
    expect(
      screen.getAllByText('Every published guaranteed-interview condition for this route has been verified as met.').length,
    ).toBeGreaterThan(0);
  });

  it('does not render dev diagnostics', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(screen.queryByText('Dev diagnostics')).not.toBeInTheDocument();
  });

  it('does not repeat the historical guidance caveat at the bottom of the card', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          historical_guidance_caveat: 'Historical data is guidance only and does not guarantee an interview.',
        })}
      />,
    );
    expect(screen.queryByText('Historical data is guidance only and does not guarantee an interview.')).not.toBeInTheDocument();
  });
});
