import { render, screen, within } from '@testing-library/react';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard';
import type { PredictionResult } from '../api/types';

const require = createRequire(import.meta.url);
const { predict } = require('../../../server/src/predict') as {
  predict: (request: { universityIds: string[]; studentProfile: Record<string, unknown> }) => PredictionResult[];
};
const lancasterFixture = require('../../../data/fixtures/interview-band-classification/lancaster-a100.json') as {
  base_applicant: Record<string, unknown>;
};
const sheffieldFixture = require('../../../data/fixtures/interview-band-classification/sheffield-a100.json') as {
  base_applicant: Record<string, unknown>;
  scenarios: Array<{ scenario_id: string; overrides: Record<string, unknown> }>;
};
const bsmsFixture = require('../../../data/fixtures/interview-band-classification/brighton-and-sussex-a100.json') as {
  base_applicant: Record<string, unknown>;
  scenarios: Array<{ scenario_id: string; overrides: Record<string, unknown> }>;
};

const sunderlandFixture = require('../../../data/fixtures/interview-band-classification/sunderland-a100.json') as {
  base_applicant: Record<string, unknown>;
};

const CONTEXTUAL_CONFIRMED_MESSAGE =
  "Contextual eligibility confirmed. Your application has been assessed using this university's published contextual admissions criteria.";

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function merge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result = clone(base);
  Object.entries(overrides).forEach(([key, value]) => {
    const existing = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      result[key] = merge(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      result[key] = clone(value);
    }
  });
  return result;
}

function lancasterApplicant(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return merge(
    lancasterFixture.base_applicant,
    merge({
      admissions_tests: {
        ucat: {
          total_score: 1920,
          score_scale: 2700,
          subtests: {
            verbal_reasoning: 640,
            decision_making: 640,
            quantitative_reasoning: 640,
          },
          sjt_band: 2,
          test_year: 2026,
        },
      },
    }, overrides),
  );
}

function sheffieldScenarioApplicant(scenarioId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const scenario = sheffieldFixture.scenarios.find((entry) => entry.scenario_id === scenarioId);
  return merge(
    merge(sheffieldFixture.base_applicant, scenario?.overrides || {}),
    overrides,
  );
}

function bsmsScenarioApplicant(scenarioId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const scenario = bsmsFixture.scenarios.find((entry) => entry.scenario_id === scenarioId);
  return merge(
    merge(bsmsFixture.base_applicant, scenario?.overrides || {}),
    overrides,
  );
}

function dundeeScottishContextualApplicant(): Record<string, unknown> {
  return {
    profile_id: 'dundee_scotland_contextual_aaabb_ucat_2100',
    qualification_route: 'scottish',
    application_year: 2027,
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'scotland',
      contextual: true,
      contextual_flags: {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] },
    },
    contextual_profile: {
      home_area_region: { simd_quintile: 'q2' },
      financial_support: { free_school_meals: 'no' },
      personal_circumstances: {
        young_or_adult_carer: 'no',
        care_experienced: 'no',
        care_over_three_months: 'no',
        estranged_from_family: 'no',
        refugee: 'no',
        uk_refugee_status_granted: 'no',
        seeking_asylum: 'no',
        asylum_seeker: 'no',
        disability: 'no',
      },
      access_programmes: {
        participation_status: 'no',
        other_programmes: [],
        other_programme_name: '',
      },
    },
    scottish_profile: {
      national_5_subjects: [
        { subject_id: 'english', grade: 'A' },
        { subject_id: 'mathematics', grade: 'A' },
        { subject_id: 'biology', grade: 'A' },
        { subject_id: 'chemistry', grade: 'A' },
        { subject_id: 'physics', grade: 'A' },
      ],
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'english', grade: 'B', school_year: 's5', first_attempt: true },
        { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true },
      ],
      advanced_higher_subjects: [
        { subject_id: 'chemistry', grade: 'B', school_year: 's6', first_attempt: true },
        { subject_id: 'biology', grade: 'B', school_year: 's6', first_attempt: true },
      ],
    },
    admissions_tests: {
      ucat: {
        total_score: 2100,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 700,
          decision_making: 700,
          quantitative_reasoning: 700,
        },
        sjt_band: 2,
      },
    },
    graduate_profile: {
      is_graduate: false,
    },
  };
}

function dundeeScottishStandardApplicant(): Record<string, unknown> {
  return merge(dundeeScottishContextualApplicant(), {
    profile_id: 'dundee_scotland_standard_aaaab_ucat_2200',
    applicant_identity: {
      contextual: false,
      widening_participation: false,
    },
    contextual_profile: {
      home_area_region: { simd_quintile: 'q4' },
    },
    scottish_profile: {
      higher_subjects: [
        { subject_id: 'chemistry', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'biology', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'mathematics', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'english', grade: 'A', school_year: 's5', first_attempt: true },
        { subject_id: 'physics', grade: 'B', school_year: 's5', first_attempt: true },
      ],
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 733,
          decision_making: 733,
          quantitative_reasoning: 734,
        },
        sjt_band: 2,
      },
    },
  });
}

function dundeeRukAlevelApplicant({
  contextual = false,
  grades = ['A', 'A', 'A'],
  feeStatus = 'rest_of_uk_roi_fee_rate',
}: {
  contextual?: boolean;
  grades?: string[];
  feeStatus?: string;
} = {}): Record<string, unknown> {
  const topTierApplicant = require('../../../data/regression-profiles/16_top_tier_applicant.json') as Record<string, unknown>;
  return merge(topTierApplicant, {
    profile_id: contextual
      ? 'dundee_ruk_contextual_a_level_wording_regression'
      : 'dundee_ruk_standard_a_level_badge_regression',
    qualification_route: 'a_level',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: feeStatus,
      domicile: 'england',
      contextual,
      widening_participation: contextual,
      contextual_flags: contextual ? { free_school_meals: true } : {},
      graduate: false,
      resit: { has_resits: false, subjects_resat: [] },
    },
    contextual_profile: {
      financial_support: { free_school_meals: contextual ? 'yes' : 'no' },
      personal_circumstances: {
        care_over_three_months: 'no',
        care_experienced: 'no',
        uk_refugee_status_granted: 'no',
        refugee: 'no',
        ukrainian_visa_scheme: 'no',
      },
    },
    a_level_profile: {
      subjects: [
        ['chemistry', grades[0]],
        ['biology', grades[1]],
        ['mathematics', grades[2]],
      ].map(([subjectId, predictedGrade]) => ({
        subject_id: subjectId,
        predicted_grade: predictedGrade,
        achieved_grade: null,
        sitting_status: 'first_sitting',
        practical_endorsement: subjectId === 'mathematics' ? null : 'pass',
      })),
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 733,
          decision_making: 733,
          quantitative_reasoning: 734,
        },
        sjt_band: 2,
      },
    },
  });
}

function lancasterAlevelApplicant({
  grades,
  epq,
}: {
  grades: string[];
  epq?: Record<string, unknown>;
}): Record<string, unknown> {
  const subjects = [
    ['biology', grades[0]],
    ['chemistry', grades[1]],
    ['mathematics', grades[2]],
  ].map(([subjectId, predictedGrade], index) => ({
    subject_id: subjectId,
    predicted_grade: predictedGrade,
    sitting_status: 'first_sitting',
    ...(index < 2 ? { practical_endorsement: 'pass' } : {}),
  }));

  return merge(lancasterFixture.base_applicant, {
    contextual_profile: {},
    a_level_profile: {
      subjects,
      sitting_status: 'first_sitting',
      ...(epq ? { epq } : {}),
    },
    admissions_tests: {
      ucat: {
        total_score: 2200,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 730,
          decision_making: 730,
          quantitative_reasoning: 740,
        },
        sjt_band: 1,
        test_year: 2026,
      },
    },
  });
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

  it('renders the top-right recommendation as a Result Card badge using the presenter label', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'interview_likely' } })} />);
    const badge = document.querySelector('.result-card-head .result-card-status--recommendation-badge');
    expect(badge).toHaveTextContent('Strong Choice');
    expect(badge?.querySelector('.result-card-icon')).not.toBeInTheDocument();
  });

  it('does not show a positive eligibility subtitle when the compact academic status is not eligible', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          primary_user_facing_recommendation: 'Not suitable',
          prediction: { result_band: 'not_eligible' },
          eligibility: { status: 'not_eligible' },
          decision_transparency: {
            compact_status: {
              label: 'You do not currently meet the academic requirements.',
              type: 'academic_status',
              tone: 'negative',
            },
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Not met',
                summary: 'You do not currently meet the academic requirements.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getAllByText('You do not currently meet the academic requirements.').length).toBeGreaterThan(0);
    expect(screen.queryByText('You meet the published requirements')).not.toBeInTheDocument();
  });

  it('renders the reusable EPQ alternative academic offer summary', () => {
    render(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'epq',
            standard_offer: 'AAA',
            alternative_offer: 'AAB + EPQ Grade A',
            epq_minimum_grade: 'A',
            pathway_id: 'sheffield_epq_alternative',
            conditions: [
              'Grade A required in the applicable mandatory science',
              'EPQ must be taken alongside A-levels',
            ],
          },
          academic_requirement_checks: [
            {
              qualification_type: 'a_level',
              requirement_type: 'epq_alternative_offer',
              label: 'A-levels + EPQ',
              status: 'met',
              reason: 'The accepted EPQ alternative academic pathway is met.',
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Alternative Academic Offer' })).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();
    expect(screen.getByText('EPQ Alternative')).toBeInTheDocument();
    expect(screen.getByText('AAB + EPQ Grade A')).toBeInTheDocument();
    expect(screen.getByText('Grade A required in the applicable mandatory science')).toBeInTheDocument();
    expect(screen.getByText('EPQ must be taken alongside A-levels')).toBeInTheDocument();
  });

  it('renders routed alternative academic offers and keeps UCAT as an eligibility requirement when ranking is bypassed', () => {
    render(
      <ResultCard
        result={makeResult({
          interview_outcome: 'guaranteed_interview',
          selection_approach_display:
            "Applicants on the completed Pathways to Birmingham Medicine guaranteed-interview route are not ranked by Birmingham's ordinary GCSE/UCAT selection score once the verified Pathways conditions are met.",
          alternative_academic_offer: {
            type: 'routed_offer',
            standard_offer: 'A*AA',
            alternative_offer: 'AAB',
            pathway_id: 'pathways_to_birmingham_a_level',
            conditions: [],
          },
          factor_usage: [
            {
              factor_id: 'ucat',
              label: 'UCAT',
              role: 'eligibility',
              detail:
                'Required as an eligibility condition; competitive UCAT ranking is bypassed for this guaranteed-interview route.',
              evidence_status: 'available',
            },
          ],
          decision_transparency: {
            factor_usage: [
              {
                factor_id: 'ucat',
                label: 'UCAT',
                role: 'eligibility',
                evidence_status: 'available',
              },
            ],
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'You meet the published requirements.',
                checks: [],
              },
              {
                stage: 'Selection model',
                status: 'Assessed',
                summary:
                  "Applicants on the completed Pathways to Birmingham Medicine guaranteed-interview route are not ranked by Birmingham's ordinary GCSE/UCAT selection score once the verified Pathways conditions are met.",
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Alternative Academic Offer' })).toBeInTheDocument();
    expect(screen.getByText('Pathways to Birmingham')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('A*AA')).toBeInTheDocument();
    expect(screen.getByText('Alternative offer')).toBeInTheDocument();
    expect(screen.getByText('AAB')).toBeInTheDocument();

    const ucatCard = screen.getAllByText('UCAT')[0].closest('.result-card-summary-card');
    expect(ucatCard).toHaveTextContent('Eligibility requirement');
    expect(ucatCard).not.toHaveTextContent('Used for ranking');
  });

  it('renders the real Sunderland applicant UCAT score and SJT band for eligibility-only cards', () => {
    const studentProfile = merge(sunderlandFixture.base_applicant, {
      admissions_tests: {
        ucat: {
          total_score: 1950,
          score_scale: 2700,
          subtests: {
            verbal_reasoning: 650,
            decision_making: 650,
            quantitative_reasoning: 650,
          },
          sjt_band: 2,
          test_year: 2026,
        },
      },
    });

    const [result] = predict({
      universityIds: ['sunderland-a100'],
      studentProfile,
    });

    const publicUcatFactor = result.result_card.factor_usage?.find(
      (entry) => entry.factor_id === 'ucat',
    );

    expect(result.result_card.applicant_context).toBeUndefined();
    expect(publicUcatFactor).toMatchObject({
      role: 'eligibility',
      applicant_value: 1950,
    });

    render(<ResultCard result={result} />);

    const ucatCard = screen.getAllByText('UCAT')[0].closest('.result-card-summary-card');
    expect(ucatCard).toHaveTextContent('Eligibility requirement');
    expect(ucatCard).toHaveTextContent('Applicant score');
    expect(ucatCard).toHaveTextContent('1950');

    const sjtCard = screen.getAllByText('SJT')[0].closest('.result-card-summary-card');
    expect(sjtCard).toHaveTextContent('Eligibility requirement');
    expect(sjtCard).toHaveTextContent('Applicant band');
    expect(sjtCard).toHaveTextContent('Band 2');
  });

  it('does not show Lancaster EPQ alternative-used presentation for AAA applicants without EPQ', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterAlevelApplicant({
        grades: ['A', 'A', 'A'],
        epq: { status: 'not_taken', grade: null },
      }),
    });

    expect(result.result_card.recommendation_display_state).toBe('standard');
    expect(result.result_card.academic_pathway).toBe('standard');
    expect(result.result_card.alternative_academic_offer).toBeNull();

    render(<ResultCard result={result} />);

    expect(screen.queryByText('Alternative Academic Offer')).not.toBeInTheDocument();
    expect(screen.queryByText('EPQ Alternative')).not.toBeInTheDocument();
    expect(screen.queryByText(/AAB \+ EPQ Grade B/i)).not.toBeInTheDocument();
  });

  it('suppresses stale EPQ presentation for contextual Lancaster standard-route applicants', () => {
    render(
      <ResultCard
        result={makeResult(
          {
            academic_pathway: 'standard',
            contextual_status: 'confirmed',
            contextual_confirmation: {
              collapsed_label: 'Contextual eligibility confirmed',
              expanded_heading: 'Contextual eligibility confirmed',
              consideration_label: 'Contextual consideration:',
              expanded_body:
                'Your contextual status may be considered during UCAT interview shortlisting. If successful at interview, you may be considered for a contextual offer of ABB.',
              contextual_offer_grade: 'ABB',
            },
            alternative_academic_offer: {
              type: 'epq',
              standard_offer: 'AAA',
              alternative_offer: 'AAB + EPQ Grade B',
              epq_minimum_grade: 'B',
              pathway_id: 'lancaster_epq_alternative',
              conditions: [],
            },
            academic_requirement_checks: [
              {
                qualification_type: 'a_level',
                requirement_type: 'a_level_epq_alternative',
                label: 'A-levels + EPQ',
                status: 'met',
              },
              {
                qualification_type: 'a_level',
                requirement_type: 'a_level_standard_offer',
                label: 'A-level grades',
                status: 'met',
              },
            ],
          },
          { universityId: 'lancaster-a100', university: 'Lancaster University' },
        )}
      />,
    );

    expect(screen.getByText('A-level grades')).toBeInTheDocument();
    expect(screen.queryByText('A-levels + EPQ')).not.toBeInTheDocument();
    expect(screen.queryByText('Alternative Academic Offer')).not.toBeInTheDocument();
    expect(screen.queryByText(/AAB \+ EPQ Grade B/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contextual eligibility confirmed' })).toBeInTheDocument();
    expect(screen.getByText(/Contextual consideration:/)).toBeInTheDocument();
    expect(screen.getByText('ABB')).toBeInTheDocument();
  });

  it('shows Lancaster EPQ alternative-used presentation for AAB plus EPQ Grade B applicants', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterAlevelApplicant({
        grades: ['A', 'A', 'B'],
        epq: { status: 'predicted', grade: 'B' },
      }),
    });

    expect(result.result_card.recommendation_display_state).toBe('standard');
    expect(result.result_card.academic_pathway).toBe('epq_alternative');
    expect(result.result_card.alternative_academic_offer).toEqual({
      type: 'epq',
      standard_offer: 'AAA',
      alternative_offer: 'AAB + EPQ Grade B',
      epq_minimum_grade: 'B',
      pathway_id: 'lancaster_epq_alternative',
      conditions: [],
    });

    render(<ResultCard result={result} />);

    const offer = screen
      .getByRole('heading', { name: 'Alternative Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('EPQ')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('EPQ Alternative')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('AAB + EPQ Grade B')).toBeInTheDocument();
  });

  it('keeps Lancaster AAB without EPQ as the existing unmet academic result', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterAlevelApplicant({
        grades: ['A', 'A', 'B'],
        epq: { status: 'not_taken', grade: null },
      }),
    });

    expect(result.result_card.recommendation_display_state).toBe('not_eligible');
    expect(result.result_card.academic_pathway).toBe('standard');
    expect(result.result_card.alternative_academic_offer).toBeNull();
    expect(
      result.result_card.academic_requirement_checks?.some(
        (check) =>
          check.requirement_type === 'a_level_standard_offer' &&
          check.status === 'not_met' &&
          check.required_value === 'AAA' &&
          check.applicant_value === 'AAB',
      ),
    ).toBe(true);
  });

  it('renders a contextual academic offer summary', () => {
    render(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAA',
            alternative_offer: 'AAB',
            pathway_id: 'lancaster_contextual_offer',
            conditions: [],
          },
          academic_requirement_checks: [
            {
              qualification_type: 'a_level',
              requirement_type: 'a_level_contextual_offer',
              label: 'A-level grades',
              status: 'met',
              required_value: 'AAB',
              applicant_value: 'AAB',
              reason: 'This requirement is met.',
            },
          ],
        })}
      />,
    );

    const offer = screen
      .getByRole('heading', { name: 'Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Contextual')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('Contextual offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('AAB')).toBeInTheDocument();
  });

  it('renders St Andrews minimum-entry wording without internal route terms', () => {
    render(
      <ResultCard
        result={makeResult({
          contextual_status: 'confirmed',
          contextual_confirmation: {
            collapsed_label: 'Minimum entry requirements apply',
            expanded_heading: 'Minimum entry requirements apply',
            consideration_label: null,
            expanded_body:
              "You qualify for St Andrews' minimum entry requirements. Applicants who meet the academic requirements are then ranked by UCAT for interview.",
          },
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAAAB in S5 + BBB in S6 (Highers, Advanced Highers or a mixture)',
            alternative_offer: 'AAABB in S5 + BB in S6 (Highers, Advanced Highers or a mixture)',
            alternative_offer_label: 'Your minimum requirements',
            pathway_id: 'st_andrews_sqa_minimum_contextual_entry',
            conditions: [
              'Minimum entry requirements apply to eligible applicants based on their circumstances.',
            ],
          },
          academic_requirement_checks: [
            {
              qualification_type: 'scottish',
              requirement_type: 'scottish_post_16_requirements',
              label: 'Scottish Highers',
              status: 'met',
              required_value: 'AAABB in S5 + BB in S6',
              applicant_value: 'AAABB in S5 + BB in S6',
              reason: 'This requirement is met.',
            },
            {
              qualification_type: 'scottish',
              requirement_type: 'national_5_requirements',
              label: 'National 5s',
              status: 'met',
              required_value: 'Met',
              applicant_value: 'Met',
              reason: 'This requirement is met.',
            },
          ],
        })}
      />,
    );

    expect(screen.getAllByText('Scottish Highers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('National 5s').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Minimum entry requirements apply' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "You qualify for St Andrews' minimum entry requirements. Applicants who meet the academic requirements are then ranked by UCAT for interview.",
      ),
    ).toBeInTheDocument();

    const offer = screen
      .getByRole('heading', { name: 'Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Your minimum requirements')).toBeInTheDocument();
    expect(within(offer as HTMLElement).queryByText('Contextual offer')).not.toBeInTheDocument();
    expect(
      within(offer as HTMLElement).getByText(
        'Minimum entry requirements apply to eligible applicants based on their circumstances.',
      ),
    ).toBeInTheDocument();

    const text = document.body.textContent || '';
    expect(text).not.toMatch(/Step 6|structured evidence|route activated|contextual route confirmed/i);
    expect(text).not.toContain('St Andrews SQA minimum/contextual route: AAABB in S5 + BB in S6');
  });

  it('shows contextual confirmation messaging for confirmed contextual applicants', () => {
    render(
      <ResultCard
        result={makeResult({
          contextual_status: 'confirmed',
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAA',
            alternative_offer: 'AAB',
            pathway_id: 'lancaster_contextual_offer',
            conditions: [],
          },
        })}
      />,
    );

    expect(screen.getByText(CONTEXTUAL_CONFIRMED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual eligibility confirmed')).not.toBeInTheDocument();
  });

  it('renders Aston contextual wording and offer comparison without Aston Ready wording', () => {
    render(
      <ResultCard
        result={makeResult(
          {
            contextual_status: 'confirmed',
            contextual_confirmation: {
              collapsed_label: "You meet Aston's contextual admissions criteria.",
              expanded_heading: "You meet Aston's contextual admissions criteria.",
              consideration_label: null,
              expanded_body:
                "Your application has been assessed using Aston's published contextual admissions criteria.",
            },
            alternative_academic_offer: {
              type: 'contextual',
              standard_offer: 'AAA',
              alternative_offer: 'ABB',
              standard_offer_label: 'Standard offer',
              alternative_offer_label: 'Contextual offer',
              explanation:
                "You are eligible for Aston's contextual offer. You must still meet all required subject and GCSE requirements.",
              applicable_offer: 'alternative',
              pathway_id: 'contextual_school_leaver_a_level',
              conditions: [],
            },
          },
          { universityId: 'aston-a100', university: 'Aston University' },
        )}
      />,
    );

    expect(screen.getByRole('heading', { name: "You meet Aston's contextual admissions criteria." })).toBeInTheDocument();
    expect(
      screen.getByText("Your application has been assessed using Aston's published contextual admissions criteria."),
    ).toBeInTheDocument();

    const offer = screen
      .getByRole('heading', { name: 'Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Standard offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('AAA')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('Contextual offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('ABB')).toBeInTheDocument();
    expect(
      within(offer as HTMLElement).getByText(
        "You are eligible for Aston's contextual offer. You must still meet all required subject and GCSE requirements.",
      ),
    ).toBeInTheDocument();
    expect(offer?.querySelector('.alternative-academic-offer__option--applicable')).toHaveTextContent('Contextual offer');
    expect(screen.queryByText(/Aston Ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();
  });

  it('shows Lancaster contextual wording only in the dedicated expanded contextual section', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterApplicant({
        contextual_profile: {
          financial_support: {
            free_school_meals: 'yes',
          },
          school_education: {
            low_progression_to_higher_education_school: 'yes',
          },
        },
      }),
    });

    render(<ResultCard result={result} />);

    const header = document.querySelector('.result-card-head');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).queryByText('Contextual eligibility confirmed')).not.toBeInTheDocument();
    expect(header).not.toHaveTextContent('ABB');

    const contextualSection = document.querySelector('.result-card-contextual-confirmation');
    expect(contextualSection).not.toBeNull();
    expect(within(contextualSection as HTMLElement).getByRole('heading', { name: 'Contextual eligibility confirmed' })).toBeInTheDocument();
    expect(contextualSection).toHaveTextContent(
      'Contextual consideration: Your contextual status may be considered during UCAT interview shortlisting. If successful at interview, you may be considered for a contextual offer of ABB.',
    );
  });

  it('does not show Lancaster contextual wording for standard Lancaster applicants', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterApplicant(),
    });

    render(<ResultCard result={result} />);

    const header = document.querySelector('.result-card-head');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).queryByText('Contextual eligibility confirmed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Contextual consideration:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/contextual offer of ABB/i)).not.toBeInTheDocument();
  });

  it('keeps Lancaster Access to Medicine guaranteed-interview presentation free of the contextual ABB notice', () => {
    const [result] = predict({
      universityIds: ['lancaster-a100'],
      studentProfile: lancasterApplicant({
        contextual_profile: {
          personal_circumstances: {
            care_experienced: 'yes',
          },
          access_programmes: {
            other_programmes: [
              {
                programme_id: 'lancaster_access_to_medicine',
                status: 'completed',
              },
            ],
          },
        },
      }),
    });

    render(<ResultCard result={result} />);

    expect(result.result_card.interview_outcome).toBe('guaranteed_interview');
    expect(result.result_card.contextual_confirmation).toBeNull();
    expect(screen.getAllByText(/Every published guaranteed-interview condition/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Contextual consideration:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/contextual offer of ABB/i)).not.toBeInTheDocument();
  });

  it('does not show contextual confirmation messaging for standard applicants', () => {
    render(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAA',
            alternative_offer: 'AAB',
            pathway_id: 'lancaster_contextual_offer',
            conditions: [],
          },
        })}
      />,
    );

    expect(screen.queryByText(CONTEXTUAL_CONFIRMED_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();
    expect(screen.queryByText('✅ Contextual eligibility confirmed')).not.toBeInTheDocument();
  });

  it('does not show contextual confirmation messaging for information-needed outcomes', () => {
    const reason = 'ApplySmart needs more information.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          contextual_status: 'confirmed',
          information_needed_reason: reason,
          decision_transparency: {
            information_needed_reason: reason,
          },
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAA',
            alternative_offer: 'AAB',
            pathway_id: 'lancaster_contextual_offer',
            conditions: [],
          },
        })}
      />,
    );

    expect(screen.queryByText(CONTEXTUAL_CONFIRMED_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();
    expect(screen.queryByText('✅ Contextual eligibility confirmed')).not.toBeInTheDocument();
  });

  it('does not show contextual confirmation messaging for not-eligible outcomes', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          contextual_status: 'confirmed',
          alternative_academic_offer: {
            type: 'contextual',
            standard_offer: 'AAA',
            alternative_offer: 'AAB',
            pathway_id: 'lancaster_contextual_offer',
            conditions: [],
          },
        })}
      />,
    );

    expect(screen.queryByText(CONTEXTUAL_CONFIRMED_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();
    expect(screen.queryByText('✅ Contextual eligibility confirmed')).not.toBeInTheDocument();
  });

  it('renders a contextual EPQ academic offer summary', () => {
    render(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'contextual_epq',
            standard_offer: 'AAB',
            alternative_offer: 'ABB + EPQ Grade B',
            epq_minimum_grade: 'B',
            pathway_id: 'lancaster_contextual_epq_alternative',
            conditions: [],
          },
        })}
      />,
    );

    const offer = screen
      .getByRole('heading', { name: 'Alternative Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Contextual + EPQ')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('Contextual EPQ Alternative')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('ABB + EPQ Grade B')).toBeInTheDocument();
  });

  it('omits the EPQ alternative summary for non-EPQ or malformed contracts', () => {
    const { rerender } = render(<ResultCard result={makeResult({ alternative_academic_offer: null })} />);
    expect(screen.queryByText('Alternative Academic Offer')).not.toBeInTheDocument();

    rerender(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'epq',
            standard_offer: '',
            alternative_offer: 'AAA + EPQ Grade A',
            epq_minimum_grade: 'A',
            pathway_id: 'keele_epq_alternative',
          },
        })}
      />,
    );
    expect(screen.queryByText('Alternative Academic Offer')).not.toBeInTheDocument();
  });

  it('keeps academic requirement badges unchanged when the EPQ summary is present', () => {
    render(
      <ResultCard
        result={makeResult({
          alternative_academic_offer: {
            type: 'epq',
            standard_offer: 'AAA',
            alternative_offer: 'AAB + EPQ Grade B',
            epq_minimum_grade: 'B',
            pathway_id: 'lancaster_epq_alternative',
            conditions: [],
          },
          academic_requirement_checks: [
            {
              qualification_type: 'gcse',
              requirement_type: 'gcse',
              label: 'GCSEs',
              status: 'met',
              reason: 'This requirement is met.',
            },
            {
              qualification_type: 'a_level',
              requirement_type: 'a_level_standard_offer',
              label: 'A-level grades',
              status: 'met',
              reason: 'This requirement is met.',
            },
          ],
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('GCSEs');
    expect(academicCard).toHaveTextContent('A-level grades');
    expect(academicCard?.querySelectorAll('.result-card-requirement-badge')).toHaveLength(2);
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
    expect(screen.queryByText('You meet the academic requirements.')).not.toBeInTheDocument();
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getByText('Eligibility Status').parentElement).toHaveTextContent('Requirements met');
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
      'Applicants are assessed using the university metadata sentence, then all eligible applicants continue through the published selection process without shortening this long presentation copy for the summary card.';
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
    expect(document.body).not.toHaveTextContent('...');
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
    const reason =
      'This applicant group needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          information_needed_reason: reason,
          decision_transparency: {
            manual_review_reason:
              'This applicant group needs manual review because ApplySmart cannot automatically evaluate this university’s published process for it yet.',
            information_needed_reason: reason,
          },
        })}
      />,
    );
    expect(screen.getAllByText('Needs Review').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('not a rejection');
  });

  it('shows Glasgow incomplete Reach as Information Needed without the generic academic subtitle', () => {
    const reason =
      'Successful completion of Reach is required to confirm the Glasgow adjusted/contextual route.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          primary_explanation: reason,
          information_needed_reason: reason,
          decision_transparency: {
            manual_review_reason_code: 'glasgow_reach_completion_required',
            manual_review_reason: reason,
            information_needed_reason: reason,
            compact_status: {
              label: 'ApplySmart needs more information to assess the academic requirements.',
              type: 'academic_status',
              tone: 'warning',
            },
          },
        })}
      />,
    );

    expect(screen.getAllByText('Information Needed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Needs Review')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(reason);
    expect(
      screen.queryByText('ApplySmart needs more information to assess the academic requirements.'),
    ).not.toBeInTheDocument();
  });

  it('shows Prediction Unavailable for insufficient_evidence with a university_methodology_gap reason code', () => {
    const reason =
      'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          information_needed_reason: reason,
          decision_transparency: {
            insufficient_evidence_reason_code: 'university_methodology_gap',
            insufficient_evidence_reason: 'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.',
            information_needed_reason: reason,
          },
        })}
      />,
    );
    expect(screen.getAllByText('Prediction Unavailable').length).toBeGreaterThan(0);
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the specific insufficient-evidence reason as the first visible explanation', () => {
    const specificReason =
      'This university has not published a complete scoring or ranking methodology that ApplySmart can apply to this specific applicant route.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          primary_explanation: specificReason,
          information_needed_reason: `${specificReason} This is not a rejection.`,
          decision_transparency: {
            insufficient_evidence_reason_code: 'university_methodology_gap',
            insufficient_evidence_reason: specificReason,
            information_needed_reason: `${specificReason} This is not a rejection.`,
          },
        })}
      />,
    );

    expect(screen.getByText(specificReason)).toHaveClass('result-card-explanation');
    expect(
      screen.queryByText(
        'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.',
      ),
    ).not.toBeInTheDocument();
  });

  it('shows Information Needed for insufficient_evidence with an applicant_evidence_gap reason code', () => {
    const reason = 'ApplySmart needs more of your information to fully assess this application. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          information_needed_reason: reason,
          decision_transparency: {
            insufficient_evidence_reason_code: 'applicant_evidence_gap',
            insufficient_evidence_reason: 'ApplySmart needs more of your information to fully assess this application.',
            information_needed_reason: reason,
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
    expect(screen.getByText('2420 / 2700')).toBeInTheDocument();
    expect(screen.getAllByText('2240-2269').length).toBeGreaterThan(0);
    expect(screen.getAllByText('historical interview range').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+180 above guide').length).toBeGreaterThan(0);
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

  it('renders Graduate Entry from an existing graduate prediction fixture', () => {
    const [result] = predict({
      universityIds: ['city-st-george-s-of-london-a100'],
      studentProfile: {
        ...require('../../../data/regression-profiles/15_graduate_applicant.json'),
      },
    });

    expect(result.result_card.academic_requirement_checks).toContainEqual(expect.objectContaining({
      qualification_type: 'graduate',
      label: 'Graduate Entry',
      status: 'met',
    }));

    render(<ResultCard result={result} />);
    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('Graduate Entry');
    expect(academicCard).not.toHaveTextContent('Academic review');
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
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).not.toHaveTextContent('Met');
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
    expect(screen.queryByText('You meet the academic requirements.')).not.toBeInTheDocument();
    expect(screen.queryByText('Information Needed')).not.toBeInTheDocument();
    expect(screen.queryByText(/Evidence not yet available/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/meet Edinburgh's published academic entry requirements/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a rejection/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).not.toHaveTextContent('Met');
  });

  it('renders the presenter information-needed reason in summary, banner, eligibility summary and historical context', () => {
    const reason =
      'This university ranks applicants using the best eight GCSEs. Only six GCSEs are available, so the published scoring model cannot be calculated. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult(
          {
            primary_user_facing_recommendation: 'More information is required',
            recommendation_display_state: 'insufficient_evidence',
            primary_explanation: reason,
            information_needed_reason: reason,
            prediction: {
              result_band: 'insufficient_evidence',
              available: false,
            },
            eligibility: { status: 'eligible' },
            decision_transparency: {
              information_needed_reason: reason,
              insufficient_evidence_reason: reason,
              insufficient_evidence_reason_code: 'insufficient_gcse_results',
              decision_path: [
                {
                  stage: 'Eligibility',
                  status: 'Met',
                  summary: 'The supported entry requirements are met.',
                  checks: [],
                },
                {
                  stage: 'Selection model',
                  status: 'Not applied',
                  summary: 'The selection approach cannot support a confident result with the available evidence.',
                  checks: [],
                },
                {
                  stage: 'Historical guidance',
                  status: 'Insufficient evidence',
                  summary: `Historical admissions data was not compared. ${reason} Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.`,
                  checks: [],
                },
                {
                  stage: 'Recommendation',
                  status: 'Insufficient evidence',
                  summary: 'A confident recommendation is not shown.',
                  checks: [],
                },
              ],
              key_reasons: [reason],
              evidence_used: ['Official admissions policy'],
              warnings: [],
              manual_review_reason: null,
              evidence_confidence: {
                level: 'Limited',
                summary: 'The evidence is limited until the required information is provided.',
                reasons: [reason],
              },
            },
          },
          { universityId: 'presenter-test-a100', university: 'Presenter Test Medical School' },
        )}
      />,
    );

    expect(screen.getAllByText(reason)).toHaveLength(3);
    expect(screen.getByText('Reason')).toBeInTheDocument();
    expect(screen.getByText(/Historical admissions data was not compared/i)).toHaveTextContent(reason);
    expect(screen.queryByText(/ApplySmart needs additional applicant information before it can provide/i)).not.toBeInTheDocument();
  });

  it('renders real Nottingham, Leeds and Edinburgh 6-GCSE reasons from presenter output', () => {
    const topTierApplicant = require('../../../data/regression-profiles/16_top_tier_applicant.json') as Record<string, unknown>;
    const studentProfile = merge(topTierApplicant, {
      profile_id: 'six_gcse_all_8_9_ucat_2400',
      gcse_profile: {
        subjects: {
          english_language: '9',
          mathematics: '9',
          biology: '9',
          chemistry: '9',
          physics: '8',
          history: '8',
        },
        additional_subjects: [],
        total_gcse_count: 6,
        top_9_gcse_grades: ['9', '9', '9', '9', '8', '8'],
      },
      admissions_tests: {
        ucat: {
          taken: true,
          total_score: 2400,
          score_scale: 2700,
          subtests: {
            verbal_reasoning: 800,
            decision_making: 800,
            quantitative_reasoning: 800,
          },
          sjt_band: 1,
          test_year: 2026,
        },
      },
    });
    const results = predict({
      universityIds: ['nottingham-a100', 'leeds-a100', 'edinburgh-a100'],
      studentProfile,
    });

    render(
      <>
        {results.map((result) => (
          <ResultCard key={result.universityId} result={result} />
        ))}
      </>,
    );

    const nottinghamReason =
      'This university ranks applicants using the best eight GCSEs. Only six GCSEs are available, so the published GCSE component cannot be calculated. This is not a rejection.';
    const leedsReason =
      'This university ranks applicants using the best eight GCSEs. Only six GCSEs are available, so the GCSE scoring component cannot be calculated. This is not a rejection.';
    const edinburghReason =
      "You meet Edinburgh's published academic entry requirements. ApplySmart cannot provide an interview competitiveness assessment because verified historical admissions evidence is currently insufficient for this applicant group. This is not a rejection and does not mean you are ineligible.";

    expect(screen.getAllByText(nottinghamReason)).toHaveLength(3);
    expect(screen.getByText(/published GCSE component cannot be calculated.*Historical admissions data provides/s)).toBeInTheDocument();
    expect(screen.getAllByText(leedsReason)).toHaveLength(3);
    expect(screen.getByText(/GCSE scoring component cannot be calculated.*Historical admissions data provides/s)).toBeInTheDocument();
    expect(screen.getAllByText(edinburghReason)).toHaveLength(3);
    expect(screen.getAllByText('Prediction Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText(/Historical admissions evidence is currently insufficient for this Edinburgh applicant group/i)).toBeInTheDocument();
    expect(screen.queryByText(/Edinburgh.*best eight GCSEs/i)).not.toBeInTheDocument();
  });

  it('shows Information Needed for insufficient_evidence with a null (applicant-data-gap) reason code', () => {
    const reason = 'Verified historical interview information is not available for this applicant group. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          information_needed_reason: reason,
          decision_transparency: {
            insufficient_evidence_reason_code: null,
            insufficient_evidence_reason: reason,
            information_needed_reason: reason,
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
    expect(screen.queryByText('Difference')).not.toBeInTheDocument();
    expect(screen.queryByText('Fees')).not.toBeInTheDocument();
  });

  it('presents ApplySmart-derived UCAT bands separately from university historical evidence', () => {
    render(
      <ResultCard
        result={makeResult(
          {
            primary_user_facing_recommendation: 'Possible choice for your application',
            prediction: {
              result_band: 'realistic',
              guidance_pool_id: 'home_scotland_school_leaver',
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
                    'UCAT: 1950 - within the ApplySmart prediction band of 1850-1999. ApplySmart prediction bands are derived from admissions evidence; they are not university-published ranges, thresholds or guarantees.',
                  checks: [],
                },
              ],
              ucat_comparison: {
                comparison_type: 'applysmart_prediction_band',
                applicant_ucat: 1950,
                benchmark_min: 1850,
                benchmark_max: 1999,
                comparison_operator: 'between_inclusive',
                benchmark_label: 'ApplySmart prediction band',
                caveat:
                  'ApplySmart prediction bands are derived from admissions evidence; they are not university-published ranges, thresholds or guarantees.',
                evidence_status: 'applysmart_derived',
                prediction_band: 'realistic',
                difference_from_benchmark: null,
                position: 'within',
                applicant_pool: 'Home Scotland school-leaver applicants',
                sjt_policy: 'SJT recorded.',
                sjt_outcome: 'ignored',
                sjt_summary: 'SJT recorded but not modelled.',
                applicant_sjt_band: 2,
                official_ucat_minimum: null,
              },
              comparison_metrics: [
                { label: 'Lowest interviewed UCAT', value: '1700', difference: '+250' },
                { label: 'Average interviewed UCAT', value: '1970', difference: '-20' },
              ],
            },
          },
          { universityId: 'aberdeen-a100', university: 'University of Aberdeen' },
        )}
      />,
    );

    expect(screen.getByRole('heading', { name: 'UCAT PREDICTION CONTEXT' })).toBeInTheDocument();
    const predictionContext = screen.getByLabelText('Prediction Context values');
    expect(within(predictionContext).getByText('ApplySmart Prediction Band')).toBeInTheDocument();
    expect(within(predictionContext).getByText('1850-1999')).toBeInTheDocument();
    expect(within(predictionContext).getByText('Lowest interviewed UCAT')).toBeInTheDocument();
    expect(within(predictionContext).getByText('Average interviewed UCAT')).toBeInTheDocument();
    expect(within(predictionContext).getByText('1700')).toBeInTheDocument();
    expect(within(predictionContext).getByText('1970')).toBeInTheDocument();
    expect(within(predictionContext).queryByText('Your UCAT')).not.toBeInTheDocument();
    expect(within(predictionContext).queryByText('Difference')).not.toBeInTheDocument();
    expect(screen.getAllByText('Your UCAT').length).toBeGreaterThan(0);
    expect(screen.getByText('Difference')).toBeInTheDocument();
    expect(screen.getByText('Within prediction band')).toBeInTheDocument();
    expect(screen.queryByText('Historical UCAT Guide')).not.toBeInTheDocument();
    expect(screen.queryByText(/historical UCAT range 1850-1999/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Historical Interview Data · ApplySmart prediction band')).not.toBeInTheDocument();
  });

  it('labels Glasgow Scotland/Home UCAT guidance as an ApplySmart prediction band', () => {
    const [result] = predict({
      universityIds: ['glasgow-a100'],
      studentProfile: {
        profile_id: 'glasgow_scottish_result_card_test_applicant',
        qualification_route: 'scottish',
        applicant_identity: {
          applicant_type: 'standard_school_leaver',
          domicile: 'Scotland',
          fee_status: 'Home',
          contextual_flags: {},
          resit: {
            has_resits: false,
          },
        },
        scottish_profile: {
          completed_in_one_sitting: true,
          national_5_subjects: [
            { subject_id: 'english_language', grade: 'B' },
          ],
          advanced_higher_subjects: [
            { subject_id: 'chemistry', predicted_grade: 'B', school_year: 's6', sitting_id: 's6', first_attempt: true },
            { subject_id: 'biology', predicted_grade: 'B', school_year: 's6', sitting_id: 's6', first_attempt: true },
          ],
          higher_subjects: [
            { subject_id: 'chemistry', predicted_grade: 'A', school_year: 's5', sitting_id: 's5', first_attempt: true },
            { subject_id: 'biology', predicted_grade: 'A', school_year: 's5', sitting_id: 's5', first_attempt: true },
            { subject_id: 'mathematics', predicted_grade: 'A', school_year: 's5', sitting_id: 's5', first_attempt: true },
            { subject_id: 'physics', predicted_grade: 'A', school_year: 's5', sitting_id: 's5', first_attempt: true },
            { subject_id: 'history', predicted_grade: 'B', school_year: 's5', sitting_id: 's5', first_attempt: true },
          ],
        },
        admissions_tests: {
          ucat: {
            total_score: 2000,
            score_scale: 2700,
            sjt_band: 4,
            subtests: {
              verbal_reasoning: 670,
              decision_making: 665,
              quantitative_reasoning: 665,
              abstract_reasoning: 0,
            },
          },
        },
        contextual_profile: {
          home_area_region: {
            simd_quintile: 'unknown',
          },
          personal_circumstances: {},
          access_programmes: {
            participation_status: 'no',
            ukwpmed: {
              status: 'no',
              programme_id: '',
              programme_status: '',
              provider_university_id: '',
            },
            other_programmes: [],
            other_programme_name: '',
          },
        },
      },
    });

    expect(result.result_card.prediction.result_band).toBe('interview_likely');
    expect(result.result_card.primary_user_facing_recommendation).toBe('Strong choice for your application');
    expect(result.result_card.decision_transparency?.ucat_comparison).toMatchObject({
      benchmark_min: 1900,
      benchmark_max: 1974,
      benchmark_label: 'ApplySmart prediction band',
      evidence_status: 'applysmart_derived',
    });
    expect(result.result_card.decision_transparency?.selection_metric).toMatchObject({
      comparison_value: 1900,
      comparison_max_value: 1974,
      comparison_label: 'ApplySmart prediction band',
      comparison_label_type: 'applysmart_advisory_guide',
      difference_word: 'prediction band',
    });

    render(<ResultCard result={result} />);

    expect(screen.getByRole('heading', { name: 'UCAT PREDICTION CONTEXT' })).toBeInTheDocument();
    const predictionContext = screen.getByLabelText('Prediction Context values');
    expect(within(predictionContext).getAllByText('ApplySmart Prediction Band')).toHaveLength(1);
    expect(within(predictionContext).getAllByText('1900-1974')).toHaveLength(1);
    expect(within(predictionContext).queryByText('ApplySmart prediction band')).not.toBeInTheDocument();
    expect(screen.getByText(/not a Glasgow-published current 2027 cutoff/i)).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee an interview/i)).toBeInTheDocument();
    expect(screen.queryByText('Historical UCAT Guide')).not.toBeInTheDocument();
    expect(screen.queryByText(/historical interview range/i)).not.toBeInTheDocument();
  });

  it('renders Glasgow RUK A-level grades once in Academic Requirements', () => {
    const [result] = predict({
      universityIds: ['glasgow-a100'],
      studentProfile: {
        profile_id: 'glasgow_ruk_result_card_test_applicant',
        qualification_route: 'a_level',
        applicant_identity: {
          applicant_type: 'standard_school_leaver',
          domicile: 'England',
          fee_status: 'RUK',
          contextual_flags: {},
          resit: {
            has_resits: false,
          },
        },
        a_level_profile: {
          completed_in_one_sitting: true,
          subjects: [
            { subject_id: 'chemistry', predicted_grade: 'A' },
            { subject_id: 'biology', predicted_grade: 'A' },
            { subject_id: 'mathematics', predicted_grade: 'A' },
          ],
        },
        gcse_profile: {
          subjects: {
            english_language: '6',
            biology: '6',
          },
        },
        admissions_tests: {
          ucat: {
            total_score: 2000,
            score_scale: 2700,
            sjt_band: 4,
            subtests: {
              verbal_reasoning: 2000,
              decision_making: 0,
              quantitative_reasoning: 0,
              abstract_reasoning: 0,
            },
          },
        },
        contextual_profile: {
          home_area_region: {
            simd_quintile: 'unknown',
          },
          personal_circumstances: {},
          access_programmes: {
            participation_status: 'no',
            ukwpmed: {
              status: 'no',
              programme_id: '',
              programme_status: '',
              provider_university_id: '',
            },
            other_programmes: [],
            other_programme_name: '',
          },
        },
      },
    });

    expect(result.result_card.decision_transparency?.ucat_comparison).toMatchObject({
      benchmark_label: 'ApplySmart prediction band',
      caveat:
        'This prediction band is ApplySmart-derived guidance informed by Glasgow historical RUK evidence; it is not a Glasgow-published current 2027 cutoff and does not guarantee an interview.',
      evidence_status: 'applysmart_derived',
    });
    expect(result.result_card.decision_transparency?.selection_metric).toMatchObject({
      comparison_label: 'ApplySmart prediction band',
      comparison_label_type: 'applysmart_advisory_guide',
      difference_word: 'prediction band',
    });
    expect(result.result_card.academic_requirement_checks?.filter((check) => check.label === 'A-level grades')).toHaveLength(1);

    render(<ResultCard result={result} />);

    expect(screen.getByRole('heading', { name: 'UCAT PREDICTION CONTEXT' })).toBeInTheDocument();
    const predictionContext = screen.getByLabelText('Prediction Context values');
    expect(within(predictionContext).getAllByText('ApplySmart Prediction Band')).toHaveLength(1);
    expect(screen.getByText(/ApplySmart-derived guidance informed by Glasgow historical RUK evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/not a Glasgow-published current 2027 cutoff/i)).toBeInTheDocument();
    expect(screen.getByText(/does not guarantee an interview/i)).toBeInTheDocument();
    expect(screen.queryByText('Historical UCAT Guide')).not.toBeInTheDocument();
    expect(screen.queryByText(/historical interview range/i)).not.toBeInTheDocument();
    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(within(academicCard as HTMLElement).getAllByText('A-level grades')).toHaveLength(1);
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
    expect(screen.queryByText('You meet the academic requirements.')).not.toBeInTheDocument();
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

  it('renders BSMS contextual UCAT ranking without implying a published contextual cut-off', () => {
    const [result] = predict({
      universityIds: ['brighton-and-sussex-a100'],
      studentProfile: bsmsScenarioApplicant('adjusted_offer_low_ucat_sjt_3', {
        profile_id: 'bsms_contextual_frontend_no_published_cutoff',
        application_year: 2027,
        admissions_tests: {
          ucat: {
            total_score: 1950,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 650,
              decision_making: 650,
              quantitative_reasoning: 650,
            },
            sjt_band: 2,
            test_year: 2026,
          },
        },
      }),
    });

    expect(result.result_card.contextual_status).toBe('confirmed');
    expect(result.result_card.factor_usage?.find((entry) => entry.factor_id === 'ucat')?.role).toBe('ranking');
    expect(result.result_card.decision_transparency?.ucat_comparison).toMatchObject({
      comparison_type: 'no_published_contextual_cutoff',
      applicant_ucat: 1950,
      benchmark_min: null,
    });

    render(<ResultCard result={result} />);

    const ucatCard = screen.getAllByText('UCAT')[0].closest('.result-card-summary-card');
    expect(ucatCard).toHaveTextContent('Contextual applicant');
    expect(ucatCard).toHaveTextContent(
      'You are considered in the BSMS contextual applicant pool.',
    );
    expect(ucatCard).toHaveTextContent(
      'Your total UCAT score is not compared with the standard Home applicant UCAT threshold.',
    );
    expect(ucatCard).not.toHaveTextContent('1990');
    expect(ucatCard).not.toHaveTextContent('published Home threshold');

    expect(screen.getByText('Applicant Pool').parentElement).toHaveTextContent('Home, Rest of UK applicants');
    expect(screen.getByText('Selection Approach').parentElement).toHaveTextContent(
      'Contextual applicants are considered separately from standard Home applicants. For 2027 entry, BSMS has not yet published a total UCAT score that guarantees an interview for contextual applicants.',
    );
    expect(screen.getByText('Previous BSMS interview outcome')).toBeInTheDocument();
    expect(document.body).toHaveTextContent(
      'In the previous admissions cycle, Home applicants eligible for an adjusted offer who met the academic requirements and achieved SJT Band 1, 2 or 3 were invited to interview regardless of their total UCAT score.',
    );
    expect(document.body).toHaveTextContent(
      'For 2027 entry, BSMS has not yet published an equivalent interview threshold.',
    );
    expect(screen.getByText('UCAT', { selector: '.result-card-factor-chip' })).toBeInTheDocument();

    expect(document.body).not.toHaveTextContent('published Home threshold of 1990');
    expect(document.body).not.toHaveTextContent('no_published_contextual_cutoff');
    expect(document.body).not.toHaveTextContent('missing threshold');
    expect(document.body).not.toHaveTextContent('internal evidence');
    expect(document.body).not.toHaveTextContent('route flag');
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
    ).toThrow(/information_needed_reason/);
  });

  it('shows the specific manual_review_reason instead of a generic fallback when the engine provides one', () => {
    const reason =
      'Your international qualification equivalence needs adviser review before eligibility can be confirmed. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          information_needed_reason: reason,
          decision_transparency: {
            manual_review_reason:
              'Your international qualification equivalence needs adviser review before eligibility can be confirmed.',
            information_needed_reason: reason,
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

  it('shows qualification badges in the Eligibility section when eligibility passes', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          academic_requirement_checks: [
            { qualification_type: 'gcse', label: 'GCSEs', status: 'met' },
            { qualification_type: 'a_level', label: 'A-levels', status: 'met' },
          ],
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Requirements met.',
                checks: [{ label: 'Entry requirements', status: 'Met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText('Eligibility')).toBeInTheDocument();
    expect(screen.getByText('Academic Requirements')).toBeInTheDocument();
    expect(screen.getAllByText('GCSEs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A-levels').length).toBeGreaterThan(0);
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).not.toHaveTextContent('Met');
    expect(screen.queryByText('Six GCSEs at grade 6 or above.')).not.toBeInTheDocument();
  });

  it('uses public academic requirement checks when the decision path is generic', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          academic_requirement_checks: [
            { qualification_type: 'gcse', label: 'GCSEs', status: 'met' },
            { qualification_type: 'a_level', label: 'A-levels', status: 'met' },
          ],
          eligibility: {
            status: 'eligible',
            stage_1_checks: [
              { check_id: 'gcse_english_maths', status: 'pass' },
              { check_id: 'a_level_AAA_biology_chemistry', status: 'pass' },
            ],
          },
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Entry requirements met.',
                checks: [{ label: 'Entry requirements', status: 'Met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('GCSEs');
    expect(academicCard).toHaveTextContent('A-levels');
    expect(academicCard).not.toHaveTextContent('Academic review');
    expect(academicCard).not.toHaveTextContent('Entry requirements');
    expect(academicCard).not.toHaveTextContent('Requirements met');
  });

  it('shows Requirements met fallback when only overall academic status is exposed', () => {
    render(
      <ResultCard
        result={makeResult({
          prediction: { result_band: 'realistic' },
          eligibility: {
            status: 'eligible',
            stage_1_checks: [
              {
                check_id: 'academic_threshold',
                label: 'Academic threshold',
                status: 'pass',
                requirement: 'AAA including Chemistry and Biology, plus GCSE requirements.',
              },
            ],
          },
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Entry requirements met.',
                checks: [{ label: 'Entry requirements', status: 'Met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).not.toHaveTextContent('Academic review');
    expect(academicCard).not.toHaveTextContent('GCSEs');
    expect(academicCard).not.toHaveTextContent('A-levels');
    expect(academicCard).not.toHaveTextContent('Met');
    expect(academicCard).toHaveTextContent('Requirements met');
    expect(academicCard?.querySelector('.result-card-requirement-badge')).toBeInTheDocument();
  });

  it('shows a genuine warning and a failed qualification badge when a requirement fails', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          academic_requirement_checks: [
            { qualification_type: 'gcse', label: 'GCSEs', status: 'not_met' },
          ],
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Not met',
                summary: 'Requirements not met.',
                checks: [{ label: 'Entry requirements', status: 'Not met', summary: 'A required GCSE subject is missing.' }],
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getAllByText('GCSEs').length).toBeGreaterThan(0);
    expect(screen.getByText('Eligibility Status').parentElement).toHaveTextContent('Requirements not met');
  });

  it('renders Imperial academic failures and contextual historical evidence without contradiction', () => {
    const topTierApplicant = require('../../../data/regression-profiles/16_top_tier_applicant.json') as Record<string, unknown>;
    const sameSittingFailedApplicant = merge(topTierApplicant, {
      a_level_profile: {
        completed_in_one_sitting: false,
        sitting_status: 'not_same_sitting',
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
          { subject_id: 'biology', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'resit', practical_endorsement: 'pass' },
          { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: null },
        ],
      },
    });
    const [result] = predict({
      universityIds: ['imperial-college-london-a100'],
      studentProfile: sameSittingFailedApplicant,
    });

    expect(result.result_card.recommendation_display_state).toBe('not_eligible');
    expect(result.result_card.prediction.result_band).toBe('not_eligible');
    expect(result.result_card.primary_explanation).toMatch(/same examination sitting/i);
    expect(result.result_card.primary_explanation).not.toBe(
      'Based on the information entered, one or more supported entry requirements are not met.',
    );
    expect(result.result_card.academic_requirement_checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirement_type: 'a_level_route', label: 'A-level grades', status: 'met' }),
        expect.objectContaining({ requirement_type: 'same_sitting_requirement', label: 'Same-sitting requirement', status: 'not_met' }),
      ]),
    );

    render(<ResultCard result={result} />);

    expect(screen.getAllByText('Not suitable').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/same examination sitting/i).length).toBeGreaterThan(0);
    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('A-level grades');
    expect(academicCard).toHaveTextContent('Same-sitting requirement');
    expect(academicCard?.querySelectorAll('.result-card-requirement-badge').length).toBeGreaterThan(1);
    expect(screen.getAllByText('UCAT')[0].closest('.result-card-summary-card')).toHaveTextContent('Used for ranking');
    expect(screen.getByText('Ranking Context')).toBeInTheDocument();
    expect(screen.getByText(/academic requirement above is not met/i)).toBeInTheDocument();
    expect(screen.getAllByText('Not suitable').length).toBeGreaterThan(0);
  });

  it('renders Imperial missing academic information as Information Needed instead of Not suitable', () => {
    const topTierApplicant = require('../../../data/regression-profiles/16_top_tier_applicant.json') as Record<string, unknown>;
    const [result] = predict({
      universityIds: ['imperial-college-london-a100'],
      studentProfile: topTierApplicant,
    });

    expect(result.result_card.recommendation_display_state).toBe('manual_review');
    expect(result.result_card.academic_requirement_checks).toContainEqual(
      expect.objectContaining({
        requirement_type: 'same_sitting_requirement',
        status: 'information_needed',
      }),
    );

    render(<ResultCard result={result} />);
    expect(screen.getAllByText('Information Needed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Not suitable')).not.toBeInTheDocument();
    expect(screen.getByText('Academic Requirements').closest('.result-card-summary-card')).toHaveTextContent('Same-sitting requirement');
  });

  it('shows Requirements not met fallback when only overall negative academic status is exposed', () => {
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'not_eligible',
          eligibility: {
            status: 'ineligible',
            stage_1_checks: [{ check_id: 'academic_threshold', label: 'Academic threshold', status: 'fail' }],
          },
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Not met',
                summary: 'Entry requirements are not met.',
                checks: [{ label: 'Entry requirements', status: 'Not met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('Requirements not met');
    expect(academicCard).not.toHaveTextContent('Academic review');
    expect(academicCard).not.toHaveTextContent('Entry requirements');
  });

  it('uses a warning badge when a qualification needs more information', () => {
    const reason = 'More information is needed for this qualification route. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          information_needed_reason: reason,
          academic_requirement_checks: [
            { qualification_type: 'ib', label: 'IB', status: 'information_needed' },
          ],
          decision_transparency: {
            insufficient_evidence_reason: 'More information is needed for this qualification route.',
            information_needed_reason: reason,
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Information needed',
                summary: 'More information needed.',
                checks: [{ label: 'Entry requirements', status: 'Information needed', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const ibBadge = screen.getByText('IB').closest('.result-card-requirement-badge');
    expect(ibBadge).toHaveClass('result-card-requirement-badge--warning');
    expect(screen.queryByText('Academic review')).not.toBeInTheDocument();
  });

  it('shows Scottish and Graduate Entry badges from the public contract', () => {
    render(
      <ResultCard
        result={makeResult({
          academic_requirement_checks: [
            { qualification_type: 'scottish', label: 'Scottish Highers', status: 'met' },
            { qualification_type: 'graduate', label: 'Graduate Entry', status: 'met' },
          ],
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Requirements met.',
                checks: [{ label: 'Entry requirements', status: 'Met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('Scottish Highers');
    expect(academicCard).toHaveTextContent('Graduate Entry');
    expect(academicCard).not.toHaveTextContent('Academic review');
  });

  it('does not duplicate qualification badges from duplicate public contract rows', () => {
    render(
      <ResultCard
        result={makeResult({
          academic_requirement_checks: [
            { qualification_type: 'gcse', label: 'GCSEs', status: 'met' },
            { qualification_type: 'gcse', label: 'GCSEs', status: 'met' },
            { qualification_type: 'a_level', label: 'A-levels', status: 'met' },
          ],
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Requirements met.',
                checks: [{ label: 'Entry requirements', status: 'Met', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    const badgeText = Array.from(academicCard?.querySelectorAll('.result-card-requirement-badge') || [])
      .map((badge) => badge.textContent);
    expect(badgeText).toEqual(['GCSEs', 'A-levels']);
  });

  it('keeps A-level academic status visible after detailed GCSE badges', () => {
    type AcademicRequirementChecks = NonNullable<PredictionResult['result_card']['academic_requirement_checks']>;
    const gcseChecks: AcademicRequirementChecks = [
      { qualification_type: 'gcse', requirement_type: 'gcse_minimum_count', label: 'GCSEs', status: 'met' },
      { qualification_type: 'gcse', requirement_type: 'gcse_english_language_minimum', label: 'GCSE English Language', status: 'met' },
      { qualification_type: 'gcse', requirement_type: 'gcse_mathematics_minimum', label: 'GCSE Mathematics', status: 'met' },
      { qualification_type: 'gcse', requirement_type: 'gcse_biology_minimum', label: 'GCSE Biology', status: 'met' },
      { qualification_type: 'gcse', requirement_type: 'gcse_chemistry_minimum', label: 'GCSE Chemistry', status: 'met' },
    ];
    const resultWithAlevels = (status: 'met' | 'not_met') => makeResult({
      academic_requirement_checks: [
        ...gcseChecks,
        {
          qualification_type: 'a_level',
          requirement_type: 'a_level_standard_offer',
          label: 'A-level grades',
          status,
        },
      ],
    });

    const { rerender } = render(<ResultCard result={resultWithAlevels('not_met')} />);
    let academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('A-level grades');
    expect(within(academicCard as HTMLElement).getByText('A-level grades').closest('.result-card-requirement-badge'))
      .toHaveClass('result-card-requirement-badge--negative');

    rerender(<ResultCard result={resultWithAlevels('met')} />);
    academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('A-level grades');
    expect(within(academicCard as HTMLElement).getByText('A-level grades').closest('.result-card-requirement-badge'))
      .toHaveClass('result-card-requirement-badge--positive');
  });

  it('shows More information needed fallback when only overall warning academic status is exposed', () => {
    const reason = 'More information is needed for this qualification route. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'insufficient_evidence',
          information_needed_reason: reason,
          eligibility: {
            status: 'information_needed',
            stage_1_checks: [{ check_id: 'academic_threshold', label: 'Academic threshold', status: 'pending' }],
          },
          decision_transparency: {
            insufficient_evidence_reason: 'More information is needed for this qualification route.',
            information_needed_reason: reason,
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Information needed',
                summary: 'More information needed.',
                checks: [{ label: 'Entry requirements', status: 'Information needed', summary: 'This requirement was assessed.' }],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('More information needed');
    expect(academicCard?.querySelector('.result-card-requirement-badge--warning')).toBeInTheDocument();
    expect(academicCard).not.toHaveTextContent('Academic review');
  });

  it('omits Academic Requirements when no academic status data is exposed', () => {
    render(<ResultCard result={makeResult({ prediction: { result_band: 'realistic' } })} />);
    expect(screen.queryByText('Academic Requirements')).not.toBeInTheDocument();
    expect(screen.queryByText('Academic review')).not.toBeInTheDocument();
  });

  it('does not render an empty Academic Requirements card', () => {
    render(
      <ResultCard
        result={makeResult({
          decision_transparency: {
            decision_path: [
              {
                stage: 'Eligibility',
                status: 'Met',
                summary: 'Entry requirements met.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard?.querySelector('.result-card-requirement-badge')).toBeInTheDocument();
    expect(academicCard).toHaveTextContent('Requirements met');
    expect(academicCard).not.toHaveTextContent('Academic review');
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
    expect(screen.getAllByText('35 / 36').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selection score:')).not.toBeInTheDocument();
    expect(screen.queryByText('Score Breakdown')).not.toBeInTheDocument();
    expect(screen.queryByText('GCSE academic score out of 24 plus UCAT score out of 12')).not.toBeInTheDocument();
  });

  it('renders all Exeter Score components from the presenter contract', () => {
    const exeterFixture = require('../../../data/fixtures/interview-band-classification/exeter-a100.json');
    const exeterApplicant = merge(exeterFixture.base_applicant, {
      a_level_profile: {
        subjects: [
          { subject_id: 'chemistry', predicted_grade: 'A*', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
          { subject_id: 'biology', predicted_grade: 'A*', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
          { subject_id: 'mathematics', predicted_grade: 'A*', sitting_status: 'first_sitting' },
        ],
      },
      admissions_tests: {
        ucat: {
          total_score: 1760,
          subtests: {
            verbal_reasoning: 590,
            decision_making: 590,
            quantitative_reasoning: 580,
          },
        },
      },
    });
    const [result] = predict({
      universityIds: ['exeter-a100'],
      studentProfile: exeterApplicant,
    });

    expect(result.result_card.decision_transparency?.score_breakdown).toMatchObject({
      name: 'Exeter Score',
      value: 70,
      max: 90,
    });

    render(<ResultCard result={result} />);

    expect(screen.getByText('Grade Profile Score')).toBeInTheDocument();
    expect(screen.queryByText('GCSE Profile Score')).not.toBeInTheDocument();
    expect(screen.getByText('58 / 58')).toBeInTheDocument();
    expect(screen.getAllByText('UCAT points').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12 / 32').length).toBeGreaterThan(0);
    expect(screen.getByText('Achieved-grade uplift')).toBeInTheDocument();
    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(screen.getAllByText(/Contextual (uplift|points)/).length).toBeGreaterThan(0);
    expect(screen.getByText('0 / 5')).toBeInTheDocument();
    expect(screen.getByText('Total Selection Score')).toBeInTheDocument();
    expect(screen.getAllByText('70 / 90').length).toBeGreaterThan(0);
  });

  it('renders Dundee international academic score from the presenter contract', () => {
    const topTierApplicant = require('../../../data/regression-profiles/16_top_tier_applicant.json');
    const dundeeApplicant = merge(topTierApplicant, {
      applicant_identity: {
        fee_status: 'International',
        domicile: 'International',
        contextual: false,
        widening_participation: false,
      },
      admissions_tests: {
        ucat: {
          total_score: 1800,
          subtests: {
            verbal_reasoning: 600,
            decision_making: 600,
            quantitative_reasoning: 600,
          },
          score_scale: 2700,
          sjt_band: 2,
        },
      },
    });
    const [result] = predict({
      universityIds: ['dundee-a100'],
      studentProfile: dundeeApplicant,
    });

    expect(result.result_card.decision_transparency?.score_breakdown).toMatchObject({
      name: 'International pre-interview score',
      value: 76,
      max: 100,
    });

    render(<ResultCard result={result} />);

    expect(screen.getByText('Academic score')).toBeInTheDocument();
    expect(screen.getByText('60 / 60')).toBeInTheDocument();
    expect(screen.getAllByText('UCAT points').length).toBeGreaterThan(0);
    expect(screen.getAllByText('16 / 40').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Selection Score')).toBeInTheDocument();
    expect(screen.getAllByText('76 / 100').length).toBeGreaterThan(0);
  });

  it('renders Dundee RUK A-level academic badges once with GCSE wording', () => {
    const [result] = predict({
      universityIds: ['dundee-a100'],
      studentProfile: dundeeRukAlevelApplicant(),
    });

    const badgeLabels = result.result_card.academic_requirement_checks?.map((check) => check.label);
    expect(badgeLabels).toEqual(['A-level requirements', 'GCSE requirements']);
    expect(badgeLabels?.filter((label) => label === 'A-level requirements')).toHaveLength(1);
    expect(badgeLabels).not.toContain('Dundee National 5 requirements');

    render(<ResultCard result={result} />);

    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    const renderedBadges = Array.from(academicCard?.querySelectorAll('.result-card-requirement-badge') || [])
      .map((badge) => badge.textContent);
    expect(renderedBadges).toEqual(['A-level requirements', 'GCSE requirements']);
    expect(within(academicCard as HTMLElement).queryByText('Dundee National 5 requirements')).not.toBeInTheDocument();
  });

  it('renders Dundee RUK contextual wording once while keeping the AAA/ABB comparison', () => {
    const [result] = predict({
      universityIds: ['dundee-a100'],
      studentProfile: dundeeRukAlevelApplicant({
        contextual: true,
        grades: ['A', 'B', 'B'],
        feeStatus: 'home_fee',
      }),
    });

    expect(result.result_card.contextual_status).toBe('confirmed');
    expect(result.result_card.contextual_confirmation).toMatchObject({
      expanded_heading: 'Contextual Route',
      expanded_body: "You meet Dundee's contextual admissions criteria and widening-access academic requirements.",
    });
    expect(result.result_card.primary_explanation).not.toMatch(/Contextual eligibility confirmed|Standard offer AAA; applied contextual offer ABB/i);
    expect(result.result_card.decision_transparency?.compact_status?.label).toBe('You meet the academic requirements.');
    expect(result.result_card.alternative_academic_offer).toMatchObject({
      standard_offer: 'AAA',
      alternative_offer: 'ABB',
    });
    expect(result.result_card.academic_requirement_checks?.map((check) => check.label)).toEqual([
      'A-level requirements',
      'GCSE requirements',
    ]);

    render(<ResultCard result={result} />);

    const contextualSection = document.querySelector('.result-card-contextual-confirmation');
    expect(contextualSection).not.toBeNull();
    expect(within(contextualSection as HTMLElement).getByRole('heading', { name: 'Contextual Route' })).toBeInTheDocument();
    expect(
      within(contextualSection as HTMLElement).getByText(
        "You meet Dundee's contextual admissions criteria and widening-access academic requirements.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Contextual eligibility confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();

    const offer = screen
      .getByRole('heading', { name: 'Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Standard offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('AAA')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('Contextual offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('ABB')).toBeInTheDocument();
  });

  it('hides Dundee Scottish Standard technical trust wording from the primary Result Card summary', () => {
    const [result] = predict({
      universityIds: ['dundee-a100'],
      studentProfile: dundeeScottishStandardApplicant(),
    });

    expect(result.result_card.primary_explanation).toBe(
      "Based on ApplySmart's assessment, your academic profile appears competitive for this applicant group.",
    );
    expect(result.result_card.trust_statement).toBeNull();
    expect(result.result_card.academic_requirement_checks?.map((check) => check.label)).toEqual([
      'Dundee National 5 requirements',
      'Dundee Scottish standard route',
    ]);

    render(<ResultCard result={result} />);

    const header = document.querySelector('.result-card-head');
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).getByText(
        "Based on ApplySmart's assessment, your academic profile appears competitive for this applicant group.",
      ),
    ).toBeInTheDocument();
    expect(
      within(header as HTMLElement).queryByText(/ApplySmart cannot reproduce Dundee's exact internal score/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/complete academic scoring table and current Dundee applicant-pool UCAT decile boundaries/i),
    ).not.toBeInTheDocument();
    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('Dundee National 5 requirements');
    expect(academicCard).toHaveTextContent('Dundee Scottish standard route');
  });

  it('renders Dundee Scottish contextual confirmation once without public Category 1/2 wording', () => {
    const [result] = predict({
      universityIds: ['dundee-a100'],
      studentProfile: dundeeScottishContextualApplicant(),
    });

    expect(result.result_card.contextual_status).toBe('confirmed');
    expect(result.result_card.contextual_confirmation).toMatchObject({
      expanded_heading: 'Contextual Route',
      expanded_body: "You meet Dundee's contextual admissions criteria and widening-access academic requirements.",
    });
    expect(result.result_card.trust_statement).toBeNull();
    expect(result.result_card.alternative_academic_offer).toMatchObject({
      standard_offer: 'AAAAB Scottish Highers + BB Advanced Highers',
      alternative_offer: 'AAABB Scottish Highers + BB Advanced Highers',
    });
    expect(result.result_card.academic_requirement_checks?.map((check) => check.label)).toEqual([
      'Dundee National 5 requirements',
      'Dundee Scottish widening-access route',
    ]);

    render(<ResultCard result={result} />);

    const header = document.querySelector('.result-card-head');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).queryByText(/Contextual eligibility confirmed/i)).not.toBeInTheDocument();
    expect(within(header as HTMLElement).queryByText(/Category 1\/2|ApplySmart-mapped/i)).not.toBeInTheDocument();

    const contextualSection = document.querySelector('.result-card-contextual-confirmation');
    expect(contextualSection).not.toBeNull();
    expect(within(contextualSection as HTMLElement).getByRole('heading', { name: 'Contextual Route' })).toBeInTheDocument();
    expect(
      within(contextualSection as HTMLElement).getByText(
        "You meet Dundee's contextual admissions criteria and widening-access academic requirements.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Contextual eligibility confirmed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /This is an ApplySmart prediction based on published contextual admissions evidence and historical UCAT guidance/i,
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Category 1\/2|ApplySmart-mapped/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Contextual Status')).not.toBeInTheDocument();

    const offer = screen
      .getByRole('heading', { name: 'Academic Offer' })
      .closest('.alternative-academic-offer');
    expect(offer).not.toBeNull();
    expect(within(offer as HTMLElement).getByText('Standard offer')).toBeInTheDocument();
    expect(within(offer as HTMLElement).getByText('AAAAB Scottish Highers + BB Advanced Highers')).toBeInTheDocument();
    const academicCard = screen.getByText('Academic Requirements').closest('.result-card-summary-card');
    expect(academicCard).toHaveTextContent('Dundee National 5 requirements');
    expect(academicCard).toHaveTextContent('Dundee Scottish widening-access route');
    expect(within(offer as HTMLElement).getByText('AAABB Scottish Highers + BB Advanced Highers')).toBeInTheDocument();
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
    expect(screen.getAllByText('SJT points')[0].parentElement).toHaveTextContent('10 / 15');
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
    expect(screen.getAllByText('+485 above guide').length).toBeGreaterThan(0);
  });

  it('does not present an applicant UCAT score as a university minimum when UCAT is used for ranking', () => {
    const [result] = predict({
      universityIds: ['sheffield-a100'],
      studentProfile: sheffieldScenarioApplicant('access_plus_imd_contextual_aab_home_pool', {
        admissions_tests: {
          ucat: {
            total_score: 2400,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 800,
              decision_making: 800,
              quantitative_reasoning: 800,
            },
            sjt_band: 2,
            test_year: 2026,
          },
        },
      }),
    });

    expect(result.result_card.factor_usage?.find((entry) => entry.factor_id === 'ucat')?.role).toBe('ranking');

    render(<ResultCard result={result} />);

    const ucatCard = screen.getAllByText('UCAT')[0].closest('.result-card-summary-card');
    expect(ucatCard).toHaveTextContent('Used for ranking');
    expect(ucatCard).not.toHaveTextContent('Minimum');
    expect(ucatCard).not.toHaveTextContent('2400');
  });

  it('preserves the Sheffield Access to Medicine UCAT minimum display when ranking is bypassed', () => {
    const [result] = predict({
      universityIds: ['sheffield-a100'],
      studentProfile: sheffieldScenarioApplicant('verified_access_to_sheffield_medicine_step6', {
        admissions_tests: {
          ucat: {
            total_score: 2400,
            score_scale: 2700,
            subtests: {
              verbal_reasoning: 800,
              decision_making: 800,
              quantitative_reasoning: 800,
            },
            sjt_band: 2,
            test_year: 2026,
          },
        },
      }),
    });

    expect(result.result_card.factor_usage?.find((entry) => entry.factor_id === 'ucat')?.role).toBe('eligibility');

    render(<ResultCard result={result} />);

    const ucatCard = screen.getAllByText('UCAT')[0].closest('.result-card-summary-card');
    expect(ucatCard).toHaveTextContent('Eligibility requirement');
    expect(ucatCard).toHaveTextContent('Minimum');
    expect(ucatCard).toHaveTextContent('1800');
    expect(ucatCard).not.toHaveTextContent('2700');
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
    expect(screen.getByText('Selection Method').parentElement).toHaveTextContent('Ranked by UCAT');
    expect(screen.getByText('Ranking Context')).toBeInTheDocument();
    expect(screen.getAllByText(/Applicants are ranked by UCAT total/).length).toBeGreaterThan(0);
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

  it('renders historical context whenever the presenter supplies a renderable historical stage', () => {
    const reason = 'Please confirm the remaining applicant information. This is not a rejection.';
    render(
      <ResultCard
        result={makeResult({
          recommendation_display_state: 'manual_review',
          information_needed_reason: reason,
          prediction: { result_band: 'insufficient_evidence' },
          decision_transparency: {
            manual_review_reason: 'Please confirm the remaining applicant information.',
            information_needed_reason: reason,
            decision_path: [
              {
                stage: 'Historical guidance',
                status: 'Guidance available',
                summary: 'Historical admissions evidence is available for this applicant group.',
                checks: [],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('Historical admissions evidence is available for this applicant group.')).toBeInTheDocument();
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
          applicant_context: {
            admissions_tests: {
              ucat: { sjt_band: 4 },
            },
          },
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
    expect(screen.getByText('Excluded by policy')).toBeInTheDocument();
    expect(screen.getByText('Band 4 (Rejected)')).toBeInTheDocument();
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
