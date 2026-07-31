import { createRoot } from 'react-dom/client';
import { ResultCard } from './components/ResultCard';
import type { PredictionResult } from './api/types';
import './index.css';
import './App.css';
import bristolCard from '../../data/examples/bristol-a100-result-card.example.json';
import cityCard from '../../data/examples/city-st-george-s-of-london-a100-result-card.example.json';
import buckinghamCard from '../../data/examples/buckingham-71a8-result-card.example.json';
import manchesterCard from '../../data/examples/manchester-a100-result-card.example.json';

type ScenarioKey = 'bristol' | 'city' | 'info-needed' | 'not-eligible' | 'mobile';

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
  city: makeResult(
    'city-st-george-s-of-london-a100',
    "City St George's, University of London",
    cloneCard(cityCard),
  ),
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
