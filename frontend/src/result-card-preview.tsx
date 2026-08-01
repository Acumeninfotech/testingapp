import { createRoot } from 'react-dom/client';
import { ResultCard } from './components/ResultCard';
import type { PredictionResult } from './api/types';
import './index.css';
import './App.css';
import bristolCard from '../../data/examples/bristol-a100-result-card.example.json';
import brightonCard from '../../data/examples/brighton-and-sussex-a100-result-card.example.json';
import cardiffCard from '../../data/examples/cardiff-a100-result-card.example.json';
import cityCard from '../../data/examples/city-st-george-s-of-london-a100-result-card.example.json';
import hullYorkCard from '../../data/examples/hull-york-a100-result-card.example.json';
import buckinghamCard from '../../data/examples/buckingham-71a8-result-card.example.json';
import manchesterCard from '../../data/examples/manchester-a100-result-card.example.json';

type ScenarioKey =
  | 'bristol'
  | 'brighton'
  | 'cardiff'
  | 'city'
  | 'hull-york'
  | 'eligibility-only'
  | 'info-needed'
  | 'not-eligible'
  | 'mobile';

const scenario = new URLSearchParams(window.location.search).get('scenario') as ScenarioKey | null;

function cloneCard(card: unknown): PredictionResult['result_card'] {
  return JSON.parse(JSON.stringify(card)) as PredictionResult['result_card'];
}

function makeResult(
  universityId: string,
  university: string,
  card: PredictionResult['result_card'],
): PredictionResult {
  return { universityId, university, result_card: card };
}

function cardiffSelectionScoreResult(): PredictionResult {
  const card = cloneCard(cardiffCard);
  card.primary_user_facing_recommendation = 'Strong Choice';
  card.recommendation_display_state = 'standard';
  card.prediction = {
    ...card.prediction,
    result_band: 'interview_likely',
  };
  card.decision_transparency = {
    ...(card.decision_transparency || {}),
    selection_metric: {
      type: 'selection_score',
      label: 'Selection score',
      applicant_value: 27,
      comparison_value: 26,
      comparison_max_value: null,
      comparison_label: 'historical score guide',
      comparison_label_type: 'historical_interview_guide',
      comparison_context: 'Selection score',
      difference: 1,
      difference_direction: 'above',
      difference_word: 'benchmark',
      maximum_value: 28,
      display_mode: 'score',
      display_eligibility: true,
      entry_year: null,
      caveat:
        'Historical admissions data provides a benchmark only; it is not a current cut-off or a guarantee of interview.',
    },
    score_breakdown: {
      name: 'Selection score',
      value: 27,
      max: 28,
      status: 'calculated',
      explanation: 'Cardiff pre-interview selection score components are shown from presenter output.',
      checks: [
        { label: 'GCSE score', status: 'Counted', summary: '24 out of 24.' },
        { label: 'UCAT score', status: 'Counted', summary: '3 out of 3.' },
      ],
    },
    comparison_metrics: [{ label: 'historical score guide', value: '26', difference: '+1' }],
  };
  return makeResult('cardiff-a100', 'Cardiff University', card);
}

function cityUcatComparisonResult(): PredictionResult {
  const card = cloneCard(cityCard);
  card.decision_transparency = {
    ...(card.decision_transparency || {}),
    ucat_comparison: {
      comparison_type: 'historical_range',
      applicant_ucat: 1910,
      benchmark_min: 1811,
      benchmark_max: 1909,
      benchmark_label: 'published UCAT reference range',
      caveat:
        'Published thresholds and reference ranges can change between cycles and do not guarantee an interview.',
      difference_from_benchmark: 1,
      position: 'above',
      applicant_pool: 'Home non-graduate applicants',
      sjt_policy: 'SJT recorded.',
      sjt_outcome: 'ignored',
      sjt_summary: 'SJT recorded but not modelled.',
      applicant_sjt_band: 4,
      official_ucat_minimum: null,
    },
    comparison_metrics: [{ label: 'published UCAT reference range', value: '1811-1909', difference: '+1' }],
  };
  return makeResult(
    'city-st-george-s-of-london-a100',
    "City St George's, University of London",
    card,
  );
}

function informationNeededResult(): PredictionResult {
  const card = cloneCard(buckinghamCard);
  card.primary_user_facing_recommendation = 'Information needed';
  card.recommendation_display_state = 'insufficient_evidence';
  card.primary_explanation =
    'ApplySmart needs one more applicant detail before it can confirm this assessment.';
  card.trust_statement = null;
  card.prediction = {
    ...card.prediction,
    result_band: 'insufficient_evidence',
    prediction_status: 'prediction_unavailable',
  };
  card.decision_transparency = {
    ...(card.decision_transparency || {}),
    insufficient_evidence_reason:
      'A required applicant detail is missing for this route. This is not a rejection.',
    insufficient_evidence_reason_code: 'applicant_evidence_gap',
    ucat_comparison: null,
    selection_metric: null,
  };
  return makeResult('buckingham-71a8', 'University of Buckingham', card);
}

function notEligibleResult(): PredictionResult {
  const card = cloneCard(manchesterCard);
  card.primary_user_facing_recommendation = 'Not currently eligible';
  card.recommendation_display_state = 'not_eligible';
  card.primary_explanation =
    'Based on the information entered, one or more supported entry requirements are not met.';
  card.trust_statement = null;
  card.prediction = {
    ...card.prediction,
    result_band: 'not_eligible',
  };
  card.decision_transparency = {
    ...(card.decision_transparency || {}),
    ucat_comparison: null,
    selection_metric: null,
    decision_path: [
      {
        stage: 'Eligibility',
        status: 'Not met',
        summary: 'Some published requirements need attention.',
        checks: [
          {
            label: 'A-level requirements',
            status: 'Not met',
            summary: 'The entered A-level profile does not meet the published academic requirement.',
          },
          {
            label: 'GCSE requirements',
            status: 'Met',
            summary: 'GCSE requirements are met.',
          },
        ],
      },
      {
        stage: 'Selection model',
        status: 'Not applied',
        summary: 'Selection ranking is not applied until eligibility requirements are met.',
        checks: [
          { label: 'Applicant pool', status: 'Used', summary: 'Home applicants' },
          {
            label: 'Selection approach',
            status: 'Not applied',
            summary: 'Selection ranking is not applied until eligibility requirements are met.',
          },
        ],
      },
    ],
  };
  return makeResult('manchester-a100', 'University of Manchester', card);
}

const scenarios: Record<ScenarioKey, PredictionResult> = {
  bristol: makeResult('bristol-a100', 'University of Bristol', cloneCard(bristolCard)),
  brighton: makeResult(
    'brighton-and-sussex-a100',
    'Brighton and Sussex Medical School',
    cloneCard(brightonCard),
  ),
  cardiff: cardiffSelectionScoreResult(),
  city: cityUcatComparisonResult(),
  'hull-york': makeResult('hull-york-a100', 'Hull York Medical School', cloneCard(hullYorkCard)),
  'eligibility-only': makeResult('buckingham-71a8', 'University of Buckingham', cloneCard(buckinghamCard)),
  'info-needed': informationNeededResult(),
  'not-eligible': notEligibleResult(),
  mobile: makeResult('bristol-a100', 'University of Bristol', cloneCard(bristolCard)),
};

const selected = scenarios[scenario || 'bristol'] || scenarios.bristol;

createRoot(document.getElementById('root')!).render(
  <main className="result-card-preview">
    <ResultCard result={selected} />
  </main>,
);
