import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  CATEGORY_PRIORITY,
  FILTER_GROUP_LABELS,
  FILTER_GROUP_PRIORITY,
  RESULT_CATEGORY_FILTER_GROUP,
  filterGroupForCategory,
  presentResult,
  resultCardRecommendationExplanation,
  strongestPopulatedFilterGroup,
} from './resultPresenter';
import type { PredictionResult } from '../api/types';

type CardWithOptionalPrimary = Omit<PredictionResult['result_card'], 'primary_explanation'> & {
  primary_explanation?: string;
};

function card(overrides: Partial<PredictionResult['result_card']>): PredictionResult['result_card'] {
  return {
    primary_user_facing_recommendation: 'Example',
    recommendation_display_state: 'standard',
    primary_explanation: 'Example explanation.',
    prediction: { result_band: 'realistic' },
    ...overrides,
  };
}

describe('presentResult canonical band -> public label mapping', () => {
  it('maps very_strong_interview_potential to Very Strong Choice, the very_strong category and safe variant', () => {
    const result = presentResult(card({ prediction: { result_band: 'very_strong_interview_potential' } }));
    expect(result.category).toBe('very_strong');
    expect(result.variant).toBe('safe');
    expect(result.label).toBe('Very Strong Choice');
  });

  it('maps interview_likely to Strong Choice and the strong category', () => {
    const result = presentResult(card({ prediction: { result_band: 'interview_likely' } }));
    expect(result.category).toBe('strong');
    expect(result.label).toBe('Strong Choice');
  });

  it('maps realistic to Realistic Choice and the realistic category', () => {
    const result = presentResult(card({ prediction: { result_band: 'realistic' } }));
    expect(result.category).toBe('realistic');
    expect(result.label).toBe('Realistic Choice');
  });

  it('maps ambitious to Ambitious Choice and its own ambitious category (not merged with high_risk)', () => {
    const result = presentResult(card({ prediction: { result_band: 'ambitious' } }));
    expect(result.category).toBe('ambitious');
    expect(result.variant).toBe('ambitious');
    expect(result.label).toBe('Ambitious Choice');
  });

  it('maps high_risk to High Risk and its own high_risk category (not merged with ambitious)', () => {
    const result = presentResult(card({ prediction: { result_band: 'high_risk' } }));
    expect(result.category).toBe('high_risk');
    expect(result.variant).toBe('high-risk');
    expect(result.label).toBe('High Risk');
  });

  it('keeps ambitious and high_risk as distinct categories so no university can appear in both groups', () => {
    const ambitious = presentResult(card({ prediction: { result_band: 'ambitious' } }));
    const highRisk = presentResult(card({ prediction: { result_band: 'high_risk' } }));
    expect(ambitious.category).not.toBe(highRisk.category);
  });

  it('maps eligibility_only display state to eligible_to_apply, not standard tiers', () => {
    const result = presentResult(card({ recommendation_display_state: 'eligibility_only', prediction: { result_band: 'eligible_to_apply' } }));
    expect(result.category).toBe('eligible_to_apply');
    expect(result.label).toBe('Eligible to Apply');
  });

  it('maps manual_review display state to manual_review category with the Needs Review label', () => {
    const result = presentResult(card({ recommendation_display_state: 'manual_review' }));
    expect(result.category).toBe('manual_review');
    expect(result.label).toBe('Needs Review');
  });

  it('labels insufficient_evidence with a university_methodology_gap reason code as Prediction Unavailable', () => {
    const result = presentResult(
      card({
        recommendation_display_state: 'insufficient_evidence',
        decision_transparency: { insufficient_evidence_reason_code: 'university_methodology_gap' },
      }),
    );
    expect(result.category).toBe('manual_review');
    expect(result.label).toBe('Prediction Unavailable');
  });

  it('labels insufficient_evidence with a historical evidence gap reason code as Prediction Unavailable', () => {
    const result = presentResult(
      card({
        recommendation_display_state: 'insufficient_evidence',
        decision_transparency: { insufficient_evidence_reason_code: 'edinburgh_five_gcse_historical_evidence_gap' },
      }),
    );
    expect(result.category).toBe('manual_review');
    expect(result.label).toBe('Prediction Unavailable');
  });

  it('labels insufficient_evidence with no reason code as Information Needed', () => {
    const result = presentResult(card({ recommendation_display_state: 'insufficient_evidence' }));
    expect(result.category).toBe('manual_review');
    expect(result.label).toBe('Information Needed');
  });

  it('labels insufficient_evidence with a prediction_calibration_unavailable reason code as Prediction Unavailable', () => {
    const result = presentResult(
      card({
        recommendation_display_state: 'insufficient_evidence',
        decision_transparency: { insufficient_evidence_reason_code: 'prediction_calibration_unavailable' },
      }),
    );
    expect(result.category).toBe('manual_review');
    expect(result.label).toBe('Prediction Unavailable');
  });

  it('never labels any unresolved state as the generic "Verify"', () => {
    const needsReview = presentResult(card({ recommendation_display_state: 'manual_review' }));
    const predictionUnavailable = presentResult(
      card({
        recommendation_display_state: 'insufficient_evidence',
        decision_transparency: { insufficient_evidence_reason_code: 'university_methodology_gap' },
      }),
    );
    const informationNeeded = presentResult(card({ recommendation_display_state: 'insufficient_evidence' }));
    for (const result of [needsReview, predictionUnavailable, informationNeeded]) {
      expect(result.label).not.toBe('Verify');
    }
  });

  it('maps not_eligible to not_eligible category', () => {
    expect(presentResult(card({ recommendation_display_state: 'not_eligible' })).category).toBe('not_eligible');
  });

  it('retains the canonical band label when the official prediction is unavailable, never an alternate "Interview Potential" wording', () => {
    const result = presentResult(
      card({
        prediction: {
          result_band: 'interview_likely',
          available: false,
          prediction_status: 'prediction_unavailable',
          official_prediction: { available: false, prediction_status: 'prediction_unavailable' },
        },
      }),
    );
    expect(result.label).toBe('Strong Choice');
    expect(result.officialPredictionUnavailable).toBe(true);
  });

  it('throws rather than falling through to Verify for an unrecognised band', () => {
    expect(() =>
      presentResult(card({ prediction: { result_band: 'not_a_real_band' } })),
    ).toThrow(/unrecognised prediction\.result_band/);
  });
});

describe('resultCardRecommendationExplanation precedence', () => {
  it('uses structured risk_explanation for standard high-risk results', () => {
    expect(
      resultCardRecommendationExplanation(
        card({
          prediction: { result_band: 'high_risk' },
          primary_explanation: "Based on ApplySmart's assessment, your academic profile and UCAT may be less competitive for this applicant group.",
          risk_explanation: {
            primary_factor: 'ucat',
            reason_code: 'ucat_historical_guidance_range',
            contributing_factors: ['ucat'],
            summary: "Your academic entry requirements are met, but your UCAT score falls within ApplySmart's more cautious historical guidance range for this applicant group.",
          },
        }),
      ),
    ).toBe("Your academic entry requirements are met, but your UCAT score falls within ApplySmart's more cautious historical guidance range for this applicant group.");
  });

  it('falls back to decision_transparency risk_explanation for standard high-risk results', () => {
    expect(
      resultCardRecommendationExplanation(
        card({
          prediction: { result_band: 'high_risk' },
          primary_explanation: "Based on ApplySmart's assessment, your academic profile and UCAT may be less competitive for this applicant group.",
          decision_transparency: {
            risk_explanation: {
              primary_factor: 'academic',
              reason_code: 'academic_historical_guidance_range',
              contributing_factors: ['academic'],
              summary: "Your academic entry requirements are met, but your academic profile falls within ApplySmart's more cautious historical guidance range for this applicant group.",
            },
          },
        }),
      ),
    ).toBe("Your academic entry requirements are met, but your academic profile falls within ApplySmart's more cautious historical guidance range for this applicant group.");
  });

  it('prefers card.primary_explanation for unresolved results', () => {
    expect(
      resultCardRecommendationExplanation(
        card({
          recommendation_display_state: 'insufficient_evidence',
          primary_explanation: 'Specific backend explanation.',
          decision_transparency: {
            insufficient_evidence_reason: 'Transparency reason.',
          },
        }),
      ),
    ).toBe('Specific backend explanation.');
  });

  it('falls back to the relevant transparency reason when primary_explanation is absent', () => {
    const withoutPrimary = card({
      recommendation_display_state: 'insufficient_evidence',
      decision_transparency: {
        insufficient_evidence_reason: 'Transparency insufficient evidence reason.',
      },
    }) as CardWithOptionalPrimary;
    delete withoutPrimary.primary_explanation;

    expect(resultCardRecommendationExplanation(withoutPrimary as PredictionResult['result_card'])).toBe(
      'Transparency insufficient evidence reason.',
    );
  });

  it('uses generic wording only when no specific public reason exists', () => {
    const withoutPrimary = card({
      recommendation_display_state: 'manual_review',
      decision_transparency: {},
    }) as CardWithOptionalPrimary;
    delete withoutPrimary.primary_explanation;

    expect(resultCardRecommendationExplanation(withoutPrimary as PredictionResult['result_card'])).toBe(
      'ApplySmart needs additional applicant information before it can provide a complete recommendation for this applicant group.',
    );
  });
});

describe('CATEGORY_PRIORITY approved group order', () => {
  it('orders Very Strong, Strong, Realistic, Ambitious, High Risk, Eligibility Only, Missing Information, then Not Eligible', () => {
    expect(CATEGORY_PRIORITY).toEqual([
      'very_strong',
      'strong',
      'realistic',
      'ambitious',
      'high_risk',
      'eligible_to_apply',
      'manual_review',
      'not_eligible',
    ]);
  });

  it('never ranks eligible_to_apply above ambitious or high_risk', () => {
    const ambitiousRank = CATEGORY_PRIORITY.indexOf('ambitious');
    const highRiskRank = CATEGORY_PRIORITY.indexOf('high_risk');
    const eligibleRank = CATEGORY_PRIORITY.indexOf('eligible_to_apply');
    expect(eligibleRank).toBeGreaterThan(ambitiousRank);
    expect(eligibleRank).toBeGreaterThan(highRiskRank);
  });

  it('uses the approved public group headings', () => {
    expect(CATEGORY_LABELS).toEqual({
      very_strong: 'Very Strong Choice',
      strong: 'Strong Choice',
      realistic: 'Realistic Choice',
      ambitious: 'Ambitious Choice',
      high_risk: 'High Risk',
      eligible_to_apply: 'Eligibility Only',
      manual_review: 'Missing Information',
      not_eligible: 'Not Eligible',
    });
  });
});

describe('Result filter groups', () => {
  it('uses the simplified six-chip filter grouping without changing Result Card categories', () => {
    expect(FILTER_GROUP_PRIORITY).toEqual([
      'recommended',
      'consider',
      'high_risk',
      'information_needed',
      'not_eligible',
    ]);
    expect(FILTER_GROUP_LABELS).toEqual({
      recommended: '⭐ Recommended',
      consider: '🟡 Consider',
      high_risk: '⚠️ High Risk',
      information_needed: 'ℹ️ Information Needed',
      not_eligible: '❌ Not Eligible',
    });
  });

  it('maps internal recommendation categories to one filter group from the central mapping', () => {
    expect(RESULT_CATEGORY_FILTER_GROUP).toEqual({
      very_strong: 'recommended',
      strong: 'recommended',
      realistic: 'consider',
      ambitious: 'consider',
      high_risk: 'high_risk',
      eligible_to_apply: 'information_needed',
      manual_review: 'information_needed',
      not_eligible: 'not_eligible',
    });
    expect(filterGroupForCategory('very_strong')).toBe('recommended');
    expect(filterGroupForCategory('eligible_to_apply')).toBe('information_needed');
  });
});

describe('strongestPopulatedFilterGroup', () => {
  it('starts with the strongest populated simplified filter group', () => {
    expect(strongestPopulatedFilterGroup({ recommended: 0, consider: 3, high_risk: 1 })).toBe('consider');
  });

  it('falls back to "all" when no simplified filter group is populated', () => {
    expect(strongestPopulatedFilterGroup({})).toBe('all');
  });
});
