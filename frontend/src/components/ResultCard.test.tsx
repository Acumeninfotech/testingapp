import { render, screen } from '@testing-library/react';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard';
import type { PredictionResult } from '../api/types';

const require = createRequire(import.meta.url);
const { predict } = require('../../../server/src/predict') as {
  predict: (request: { universityIds: string[]; studentProfile: Record<string, unknown> }) => PredictionResult[];
};

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
  it('labels a strong interview_likely band as Strong Choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'interview_likely' } })} />);
    expect(screen.getAllByText('Strong Choice').length).toBeGreaterThan(0);
  });

  it('labels a very_strong_interview_potential band as Very Strong Choice, not Verify', () => {
    render(
      <ResultCard result={makeResult({ prediction: { result_band: 'very_strong_interview_potential' } })} />,
    );
    expect(screen.getAllByText('Very Strong Choice').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/This result needs a closer look/),
    ).not.toBeInTheDocument();
  });

  it('labels a realistic band as Realistic Choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(screen.getAllByText('Realistic Choice').length).toBeGreaterThan(0);
  });

  it('labels an ambitious band as Ambitious Choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'ambitious' } })} />);
    expect(screen.getAllByText('Ambitious Choice').length).toBeGreaterThan(0);
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
    expect(screen.queryByText('Ambitious Choice')).not.toBeInTheDocument();
  });

  it('labels a high_risk band as High Risk, distinct from Ambitious Choice', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'high_risk' } })} />);
    expect(screen.getAllByText('High Risk').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ambitious Choice')).not.toBeInTheDocument();
  });

  it('renders the university avatar from UNIVERSITY_CODES', () => {
    render(
      <ResultCard
        result={makeResult(
          { prediction: { result_band: 'interview_likely' } },
          { universityId: 'brighton-and-sussex-a100', university: 'Brighton and Sussex Medical School' },
        )}
      />,
    );
    expect(screen.getByLabelText('University code BS')).toHaveTextContent('BS');
  });

  it('renders the King’s A100 public wording without stale formula caveats', () => {
    const mainSummary =
      "Your academic profile meets King's College London's entry requirements, and your UCAT performance is above the range seen in applicants historically invited to interview. Based on King's published selection approach and available admissions evidence, your application is assessed as a Strong Choice for interview consideration.";
    const disclaimer =
      'Interview decisions vary each year depending on the applicant pool, available interview capacity and university selection decisions. ApplySmart provides an evidence-based interview prediction, not a guarantee of interview.';
    const selectionApproach =
      "King's College London assesses applicants using academic eligibility together with UCAT performance, GCSE attainment, Situational Judgement Test performance and contextual information during interview shortlisting. Your prediction has been assessed against this published selection approach and available historical admissions evidence.";
    const historicalContext =
      "Your UCAT performance appears competitive against applicants who have historically been invited to interview at King's College London. Interview thresholds can vary between admissions cycles depending on applicant competition and interview capacity, but your profile falls within a historically competitive range for interview consideration.";

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

    expect(screen.getAllByText('Strong Choice').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Based on ApplySmart's assessment, your academic profile appears competitive for this applicant group.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Interview decisions vary each year/)).toBeInTheDocument();
    expect(screen.getByText('You meet the academic requirements.')).toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getAllByText('Met').length).toBeGreaterThan(0);
    expect(screen.getByText(/King's College London assesses applicants/)).toBeInTheDocument();
    expect(screen.getByText(/Your UCAT performance appears competitive/)).toBeInTheDocument();
    expect(screen.queryByText('Recent admissions data:')).not.toBeInTheDocument();
    expect(screen.queryByText('approximately 2,810 applicants, 982 interviewed and 762 offers.')).not.toBeInTheDocument();
    expect(document.querySelector('.result-card-status')).toHaveTextContent('Strong Choice');
    expect(document.body).not.toHaveTextContent('2022 formula');
    expect(document.body).not.toHaveTextContent('not confirmed for current cycles');
  });

  it('renders metadata selection approach wording instead of legacy fallback wording', () => {
    const metadataSelectionApproach =
      'Applicants are assessed using the university metadata sentence.';
    const legacySelectionApproach = 'Legacy generated selection approach should not appear.';

    render(
      <ResultCard
        result={makeResult({
          selection_approach_display: metadataSelectionApproach,
          decision_transparency: {
            selection_approach_display: metadataSelectionApproach,
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
                summary: legacySelectionApproach,
                checks: [
                  {
                    label: 'Selection approach',
                    status: 'Assessed',
                    summary: legacySelectionApproach,
                  },
                ],
              },
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'Historical guidance is available.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Selection Approach')).toBeInTheDocument();
    expect(screen.getByText(metadataSelectionApproach)).toBeInTheDocument();
    expect(screen.queryByText(legacySelectionApproach)).not.toBeInTheDocument();
  });

  it('uses existing selection approach fallback when metadata wording is absent', () => {
    const fallbackSelectionApproach = 'Existing generated selection approach.';

    render(
      <ResultCard
        result={makeResult({
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
                summary: fallbackSelectionApproach,
                checks: [
                  {
                    label: 'Selection approach',
                    status: 'Assessed',
                    summary: fallbackSelectionApproach,
                  },
                ],
              },
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'Historical guidance is available.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText(fallbackSelectionApproach)).toBeInTheDocument();
  });

  it('labels a not_eligible display state as Not suitable', () => {
    render(
      <ResultCard
        result={makeResult({ recommendation_display_state: 'not_eligible' })}
      />,
    );
    expect(screen.getAllByText('Not suitable').length).toBeGreaterThan(0);
  });

  it('shows a Needs Review notice, not a rejection, for manual_review state with a specific reason', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          decision_transparency: {
            manual_review_reason:
              'This applicant group needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
          },
        })}
      />,
    );
    expect(screen.getAllByText('Needs Review').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('not a rejection');
  });

  it('shows Prediction Unavailable for insufficient_evidence with a university_methodology_gap reason code', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          decision_transparency: {
            insufficient_evidence_reason_code: 'university_methodology_gap',
            insufficient_evidence_reason: 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.',
          },
        })}
      />,
    );
    expect(screen.getAllByText('Prediction Unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows Information Needed for insufficient_evidence with an applicant_evidence_gap reason code', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          decision_transparency: {
            insufficient_evidence_reason_code: 'applicant_evidence_gap',
            insufficient_evidence_reason: 'ApplySmart needs more of your information to fully assess this application.',
          },
        })}
      />,
    );
    expect(screen.getAllByText('Information Needed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the structured Bristol UCAT comparison in expanded details', () => {
    const [result] = predict({
      universityIds: ['bristol-a100'],
      studentProfile: {
        ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      },
    });

    expect(result.result_card.decision_transparency?.selection_metric).toMatchObject({
      type: 'ucat',
      label: 'UCAT comparison',
      applicant_value: 2420,
      comparison_value: 2240,
      comparison_max_value: 2269,
      comparison_label: 'historical interview range',
      difference: 180,
      difference_direction: 'above',
      display_mode: 'comparison',
    });
    expect(result.result_card.decision_transparency?.comparison_metrics).toEqual([
      {
        label: 'historical interview range',
        value: '2240-2269',
        difference: '+180',
      },
    ]);

    render(<ResultCard result={result} />);
    expect(screen.getAllByText('2420').length).toBeGreaterThan(0);
    expect(screen.getByText('/ 2700')).toBeInTheDocument();
    expect(screen.getAllByText('2240-2269').length).toBeGreaterThan(0);
    expect(screen.getAllByText('historical interview range').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Above range').length).toBeGreaterThan(0);
  });

  it('exposes Birmingham as a selection score without hard-coded React thresholds', () => {
    const [result] = predict({
      universityIds: ['birmingham-a100'],
      studentProfile: {
        ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      },
    });

    expect(result.result_card.decision_transparency?.selection_metric).toMatchObject({
      type: 'selection_score',
      label: 'Selection score',
      applicant_value: 8.5,
      maximum_value: 10,
      comparison_value: 7.236,
      difference: 1.2640000000000002,
      comparison_label: 'historical score guide',
      display_mode: 'score',
    });
  });

  it('does not expose a hidden Cambridge model score as a selection metric', () => {
    const [result] = predict({
      universityIds: ['cambridge-a100'],
      studentProfile: {
        ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      },
    });

    expect(result.result_card.recommendation_display_state).toBe('standard');
    expect(result.result_card.decision_transparency?.selection_metric).toBeNull();
    expect(result.result_card.decision_transparency?.score_breakdown).toBeFalsy();
  });

  it('exposes Buckingham as eligibility-only without an invented comparison score', () => {
    const [result] = predict({
      universityIds: ['buckingham-71a8'],
      studentProfile: {
        ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      },
    });

    expect(result.result_card.decision_transparency?.selection_metric).toMatchObject({
      type: 'eligibility',
      display_mode: 'eligibility',
      value_label: 'Eligibility requirements met',
      applicant_value: null,
      comparison_value: null,
      difference: null,
    });
  });

  it('renders the Birmingham missing-English-Literature explanation from a browser-shaped request', () => {
    const [result] = predict({
      universityIds: ['birmingham-a100'],
      studentProfile: {
        profile_id: 'browser_missing_english_literature',
        qualification_route: 'a_level',
        applicant_identity: {
          applicant_type: 'school_leaver',
          fee_status: 'rest_of_uk_roi_fee_rate',
          domicile: 'england',
          contextual: false,
          contextual_flags: {
            care_experienced: false,
            refugee_or_asylum_seeker: false,
            free_school_meals: false,
            first_generation_higher_education: false,
            school_contextual_indicator: false,
            ucat_bursary: false,
          },
          graduate: false,
          resit: { has_resits: false, subjects_resat: [] },
        },
        course_target: {
          discipline: 'medicine',
          ucas_code: 'A100',
          course_route: 'standard',
          entry_route: 'standard_medicine_a100',
        },
        application_year: 2027,
        gcse_profile: {
          subjects: {
            english_language: '9',
            mathematics: '9',
            biology: '9',
            chemistry: '9',
            physics: '9',
            combined_science: null,
          },
          additional_subjects: [
            { subject_id: 'history', grade: '9' },
            { subject_id: 'computer_science', grade: '9' },
            { subject_id: 'french', grade: '9' },
            { subject_id: 'geography', grade: '9' },
          ],
          total_gcse_count: 9,
          top_9_gcse_grades: ['9', '9', '9', '9', '9', '9', '9', '9', '9'],
        },
        a_level_profile: {
          subjects: [
            {
              subject_id: 'chemistry',
              predicted_grade: 'A',
              achieved_grade: null,
              sitting_status: 'first_sitting',
              practical_endorsement: 'pass',
            },
            {
              subject_id: 'biology',
              predicted_grade: 'A',
              achieved_grade: null,
              sitting_status: 'first_sitting',
              practical_endorsement: 'pass',
            },
            {
              subject_id: 'mathematics',
              predicted_grade: 'A',
              achieved_grade: null,
              sitting_status: 'first_sitting',
              practical_endorsement: null,
            },
          ],
          sitting_status: 'first_sitting',
          completed_in_one_sitting: true,
        },
        admissions_tests: {
          ucat: {
            taken: true,
            total_score: 2550,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 850,
              decision_making: 850,
              quantitative_reasoning: 850,
            },
            sjt_band: 1,
            test_year: 2026,
          },
        },
        graduate_profile: { is_graduate: false },
      },
    });

    render(<ResultCard result={result} />);

    expect(screen.getAllByText('Information Needed').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Birmingham includes English Literature in its seven-subject GCSE selection score/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).toHaveTextContent('Met');
    expect(screen.queryByText(/Verified historical interview information is not available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verified historical interview data for this applicant group is currently limited/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/university_methodology_gap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manual review/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Total selection score/i)).not.toBeInTheDocument();
  });

  it('shows Edinburgh 5-GCSE historical-evidence wording as prediction unavailable, not information needed', () => {
    const studentProfile = {
      ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      gcse_profile: {
        subjects: {
          english_language: '9',
          mathematics: '9',
          biology: '9',
          chemistry: '9',
          physics: '9',
          combined_science: null,
        },
        additional_subjects: [],
        total_gcse_count: 5,
        top_9_gcse_grades: ['9', '9', '9', '9', '9'],
      },
    };
    const [result] = predict({
      universityIds: ['edinburgh-a100'],
      studentProfile,
    });

    render(<ResultCard result={result} />);

    expect(screen.getAllByText('Prediction Unavailable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prediction Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText('You meet the academic requirements.')).toBeInTheDocument();
    expect(screen.queryByText('Information Needed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Evidence not yet available/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/meet Edinburgh's published academic entry requirements/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a rejection/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).toHaveTextContent('Met');
  });

  it('shows Information Needed for insufficient_evidence with a null (applicant-data-gap) reason code', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          decision_transparency: {
            insufficient_evidence_reason_code: null,
            insufficient_evidence_reason: 'Verified historical interview information is not available for this applicant group.',
          },
        })}
      />,
    );
    expect(screen.getAllByText('Information Needed').length).toBeGreaterThan(0);
  });

  it('labels official-prediction-unavailable advisory guidance with the canonical band label, not an alternate "Interview Potential" wording, and without Verify or empty fees', () => {
    render(
      <ResultCard
        result={makeResult({
          // Post-fix, officialPredictionUnavailableHeadline() returns the
          // canonical band label itself (see CANONICAL_BAND_LABELS in
          // assets/js/engine/result-card-presenter.js), never a "Strong
          // Interview Potential"-style alternate wording.
          primary_user_facing_recommendation: 'Strong Choice',
          recommendation_display_state: 'standard',
          primary_explanation:
            "Based on the official KMMS entry requirements and the applicant information provided, you meet the supported entry requirements. ApplySmart has analysed your profile against KMMS's available selection information and historical admissions data. Your UCAT score of 2550 is above the historical interview benchmark of 1855-1864, indicating a competitive applicant profile. Use this as interview competitiveness guidance alongside KMMS's published admissions policy; it is not a guarantee of interview.",
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
                  'UCAT: 2550 - above the historical interview benchmark of 1855-1864. Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
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

    expect(document.querySelector('.result-card-status')).toHaveTextContent('Strong Choice');
    expect(screen.getAllByText('Strong Choice').length).toBeGreaterThan(0);
    expect(screen.queryByText('Strong Interview Potential')).not.toBeInTheDocument();
    expect(screen.queryByText('Competitive Interview Potential')).not.toBeInTheDocument();
    expect(screen.queryByText('Developing Interview Potential')).not.toBeInTheDocument();
    expect(screen.queryByText('Limited Interview Potential')).not.toBeInTheDocument();
    expect(screen.getByText(/UCAT score appears competitive for this applicant group/i)).toBeInTheDocument();
    expect(screen.getByText(/guarantee of interview/i)).toBeInTheDocument();
    expect(screen.getByText(/not alter university requirements or present unofficial information/i)).toBeInTheDocument();
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getAllByText('Your UCAT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2550').length).toBeGreaterThan(0);
    expect(screen.getAllByText('historical interview range').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1855-1864').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Above range').length).toBeGreaterThan(0);
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
  });

  it('renders BSMS with simplified applicant-facing wording and no fees section', () => {
    const [result] = predict({
      universityIds: ['brighton-and-sussex-a100'],
      studentProfile: {
        ...require('../../../data/regression-profiles/16_top_tier_applicant.json'),
      },
    });

    render(<ResultCard result={result} />);

    expect(screen.getAllByText('Very Strong Choice').length).toBeGreaterThan(0);
    expect(
      screen.getByText("Based on ApplySmart's assessment, your UCAT score appears highly competitive for this applicant group."),
    ).toBeInTheDocument();
    expect(screen.getByText('You meet the academic requirements.')).toBeInTheDocument();
    expect(screen.getAllByText('2420').length).toBeGreaterThan(0);
    expect(screen.getAllByText('published Home threshold').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2010-2049').length).toBeGreaterThan(0);

    expect(document.body).not.toHaveTextContent('BSMS 2026 Home standard threshold');
    expect(document.body).not.toHaveTextContent('confirmed adjusted-offer applicants');
    expect(document.body).not.toHaveTextContent('ApplySmart-derived');
    expect(document.body).not.toHaveTextContent('The threshold is official for 2026 entry');
    expect(screen.getByText('Selection Approach')).toBeInTheDocument();
    expect(
      screen.getByText('Applicants who meet the academic requirements are assessed using their UCAT score.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
    expect(screen.queryByText('Fee status')).not.toBeInTheDocument();
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
                  'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
                checks: [
                  {
                    label: 'Important limitation',
                    status: 'Guidance only',
                    summary:
                      'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
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
    expect(screen.getByText(/Historical admissions data provides a benchmark only/i)).toBeInTheDocument();
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

  it('throws for an unrecognised result_band instead of silently showing Verify', () => {
    expect(() =>
      render(
        <ResultCard result={makeResult({ prediction: { result_band: 'not_a_real_band' } })} />,
      ),
    ).toThrow(/unrecognised prediction\.result_band/);
  });

  it('throws (in dev/test) rather than showing the generic "needs a closer look" fallback for a manual_review card with no specific reason', () => {
    expect(() =>
      render(
        <ResultCard
          result={makeResult({
            recommendation_display_state: 'manual_review',
            decision_transparency: {},
          })}
        />,
      ),
    ).toThrow(/no specific manual_review_reason or insufficient_evidence_reason_code/);
  });

  it('shows the specific manual_review_reason instead of a generic fallback when the engine provides one', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          decision_transparency: {
            manual_review_reason:
              'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
          },
        })}
      />,
    );
    expect(
      screen.getAllByText(/Your international qualification equivalence needs adviser review/).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/This result needs a closer look/)).not.toBeInTheDocument();
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

  it('shows Academic Requirements Met in the Eligibility section when eligibility passes', () => {
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
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getAllByText('Met').length).toBeGreaterThan(0);
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
    expect(screen.getByText('Attention needed')).toBeInTheDocument();
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
    expect(screen.getByText('Total Selection Score')).toBeInTheDocument();
    expect(screen.getByText('35 / 36')).toBeInTheDocument();
    expect(screen.queryByText('Selection score:')).not.toBeInTheDocument();
    expect(screen.queryByText('Score Breakdown')).not.toBeInTheDocument();
    expect(screen.queryByText('GCSE academic score out of 24 plus UCAT score out of 12')).not.toBeInTheDocument();
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

    expect(screen.getByText('Total Selection Score').parentElement).toHaveTextContent('46 / 60');
    expect(screen.getAllByText(/10 \/ 15 SJT points/).length).toBeGreaterThan(0);
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
                  { label: 'UCAT', status: 'Above', summary: 'UCAT: 2420 - 485 points above the historical interview benchmark of 1935.' },
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
                  { label: 'UCAT comparison', status: 'Compared', summary: 'UCAT: 2420 - 485 points above the historical interview benchmark of 1935.' },
                ],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.queryByText('UCAT total entered:')).not.toBeInTheDocument();
    expect(screen.getByText('Selection Approach')).toBeInTheDocument();
    expect(screen.queryByText('SJT band:')).not.toBeInTheDocument();
    expect(screen.getByText(/does not publish a combined points score/)).toBeInTheDocument();
    expect(screen.getAllByText('UCAT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SJT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SJT')[0].closest('.result-card-summary-card')).toHaveTextContent('Band 1');
    expect(screen.getAllByText('historical interview range').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Difference').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+485').length).toBeGreaterThan(0);
  });

  it("renders City St George's with cleaner applicant-facing wording and no fees", () => {
    render(
      <ResultCard
        result={makeResult(
          {
            course_identity: { profile_id: 'city-st-george-s-of-london-a100' },
            primary_user_facing_recommendation: 'Strong Choice',
            primary_explanation:
              'Your UCAT score of 1910 is above the ApplySmart band range above 2026 published current-scale UCAT reference range of 1811-1909.',
            trust_statement:
              "City St George's says UCAT thresholds cannot be predicted for a future cycle. ApplySmart keeps this as guidance only.",
            prediction: {
              result_band: 'interview_likely',
              guidance_pool_id: 'home_non_graduate',
            },
            decision_transparency: {
              ucat_comparison: {
                comparison_type: 'historical_range',
                applicant_ucat: 1910,
                benchmark_min: 1811,
                benchmark_max: 1909,
                benchmark_label: '2026 published current-scale UCAT reference range',
                caveat: 'ApplySmart band range above published current-scale UCAT reference range.',
                difference_from_benchmark: 1,
                position: 'above',
                applicant_pool: 'Home non-graduate applicants',
                sjt_policy: 'SJT recorded.',
                sjt_outcome: 'ignored',
                sjt_summary: 'SJT recorded but not modelled.',
                applicant_sjt_band: 4,
                official_ucat_minimum: null,
              },
              decision_path: [
                {
                  stage: 'Eligibility',
                  status: 'Met',
                  summary: 'Entry requirements met.',
                  checks: [],
                },
                {
                  stage: 'Selection model',
                  status: 'Assessed',
                  summary:
                    "City St George's checks academic eligibility and every UCAT cognitive section first, then ranks eligible applicants by raw UCAT total within separate Home/Overseas and graduate/non-graduate pools.",
                  checks: [
                    {
                      label: 'Applicant pool',
                      status: 'Used',
                      summary:
                        'Home, Overseas, graduate and non-graduate applicants in separate UCAT-ranking pools',
                    },
                    {
                      label: 'UCAT',
                      status: 'Above',
                      summary:
                        'UCAT: 1910 - above the ApplySmart band range above 2026 published current-scale UCAT reference range of 1811-1909.',
                    },
                    {
                      label: 'Selection approach',
                      status: 'Assessed',
                      summary:
                        "City St George's checks academic eligibility and every UCAT cognitive section first, then ranks eligible applicants by raw UCAT total.",
                    },
                  ],
                },
                {
                  stage: 'Historical guidance',
                  status: 'Guidance available',
                  summary:
                    "City St George's historical guidance compares this UCAT result with previous admissions cycles. It is guidance only, not a current cut-off and not a guarantee of an interview.",
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
          {
            universityId: 'city-st-george-s-of-london-a100',
            university: "City St George's, University of London",
          },
        )}
      />,
    );

    expect(screen.getByText(/UCAT score appears competitive for this applicant group/)).toBeInTheDocument();
    expect(screen.getAllByText('1910').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1811-1909').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Home, Overseas, graduate and non-graduate applicants/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/checks academic eligibility and every UCAT cognitive section first/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
    expect(screen.queryByText(/ApplySmart band range/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2026 published current-scale/)).not.toBeInTheDocument();
    expect(screen.queryByText(/future cycle/)).not.toBeInTheDocument();
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

    expect(screen.getByText('Applicant Pool')).toBeInTheDocument();
    expect(screen.getAllByText('Home applicants').length).toBeGreaterThan(0);
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getByText('Requirements met')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText(/previous admissions cycles/)).toBeInTheDocument();
    expect(screen.queryByText(/derived interview guidance/)).not.toBeInTheDocument();
    expect(screen.queryByText(/stage 2 interview selection/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activation-ready/i)).not.toBeInTheDocument();
    expect(document.querySelector('.result-card-warning-list')).not.toBeInTheDocument();
  });

  it('renders structured historical comparison metrics without hardcoded comparison labels', () => {
    render(
      <ResultCard
        result={makeResult({
          decision_transparency: {
            comparison_metrics_title: 'Historical Interview Data (2025)',
            comparison_metrics: [
              {
                label: 'Lowest interviewed UCAT (2025)',
                value: '1680',
                difference: '+720',
              },
              {
                label: 'Average interviewed UCAT (2025)',
                value: '1995',
                difference: '+405',
              },
            ],
            decision_path: [
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'Historical interview statistics are available for this applicant pool.',
                checks: [
                  {
                    label: 'Home (2025)',
                    status: 'Historical',
                    summary: 'Legacy text that should not be shown.',
                  },
                ],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Historical Interview Data')).toBeInTheDocument();
    expect(screen.queryByText('Historical Context')).not.toBeInTheDocument();
    expect(screen.getByText('Lowest interviewed UCAT')).toBeInTheDocument();
    expect(screen.getByText('Average interviewed UCAT')).toBeInTheDocument();
    expect(screen.getByText('1680')).toBeInTheDocument();
    expect(screen.getByText('+720')).toBeInTheDocument();
    expect(screen.getByText('1995')).toBeInTheDocument();
    expect(screen.getByText('+405')).toBeInTheDocument();
    expect(screen.queryByText(/Legacy text that should not be shown/)).not.toBeInTheDocument();
    expect(screen.queryByText(/UCAT interview threshold/i)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('2025');
  });

  it('omits historical context when the structured comparison metric list is empty', () => {
    render(
      <ResultCard
        result={makeResult({
          decision_transparency: {
            comparison_metrics: [],
            decision_path: [
              {
                stage: 'Historical guidance',
                status: 'Not applied',
                summary: 'No historical comparison is available.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.queryByText('Historical Context')).not.toBeInTheDocument();
    expect(screen.queryByText(/No historical comparison is available/)).not.toBeInTheDocument();
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
    expect(screen.getAllByText('SJT').length).toBeGreaterThan(0);
    expect(screen.getByText('Excluded')).toBeInTheDocument();
    expect(screen.getByText('Excluded by policy')).toBeInTheDocument();
    expect(screen.queryByText('Your SJT band is excluded by this university’s published policy.')).not.toBeInTheDocument();
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
