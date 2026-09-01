import { IdentityStep } from './steps/IdentityStep';
import { RouteStep } from './steps/RouteStep';
import { GcseStep } from './steps/GcseStep';
import { ALevelStep } from './steps/ALevelStep';
import { ScottishStep } from './steps/ScottishStep';
import { IbStep } from './steps/IbStep';
import { BtecStep } from './steps/BtecStep';
import { AccessToHeStep } from './steps/AccessToHeStep';
import { GraduateStep } from './steps/GraduateStep';
import { InternationalStep } from './steps/InternationalStep';
import { EnglishLanguageStep } from './steps/EnglishLanguageStep';
import { UcatStep } from './steps/UcatStep';
import { ContextualStep } from './steps/ContextualStep';
import { UniversitySelectionStep } from './steps/UniversitySelectionStep';
import { ReviewStep } from './steps/ReviewStep';
import {
  validateAccessToHeStep,
  validateALevelStep,
  validateBtecStep,
  validateContextualStep,
  validateEnglishLanguageStep,
  validateGcseStep,
  validateGraduateStep,
  validateIbStep,
  validateIdentityStep,
  validateInternationalStep,
  validateRouteStep,
  validateScottishStep,
  validateUcatStep,
  validateUniversitiesStep,
  requiresEnglishLanguageEvidence,
  type ValidationErrors,
} from './validation';
import type { QualificationRoute, WizardProfile } from './profileTypes';
import type { StepProps } from './steps/StepProps';

export interface WizardStepConfig {
  id: string;
  title: string;
  Component: (props: StepProps) => React.JSX.Element;
  validate: (profile: WizardProfile) => ValidationErrors;
}

// Each qualification route contributes exactly one academic-profile step in
// place of the A-level step. Graduate applicants still need a co-required
// school-qualification profile, so they also get the A-level step
// (eligibility-evaluator.js:756-793).
const ROUTE_STEP: Record<QualificationRoute, WizardStepConfig[]> = {
  a_level: [{ id: 'a-level', title: 'A-level profile', Component: ALevelStep, validate: validateALevelStep }],
  scottish: [{ id: 'scottish', title: 'Scottish qualifications', Component: ScottishStep, validate: validateScottishStep }],
  international_baccalaureate: [{ id: 'ib', title: 'IB profile', Component: IbStep, validate: validateIbStep }],
  btec: [{ id: 'btec', title: 'BTEC profile', Component: BtecStep, validate: validateBtecStep }],
  access_to_he: [
    { id: 'access-to-he', title: 'Access to HE profile', Component: AccessToHeStep, validate: validateAccessToHeStep },
  ],
  graduate: [
    { id: 'graduate', title: 'Graduate profile', Component: GraduateStep, validate: validateGraduateStep },
    { id: 'a-level', title: 'School qualification profile', Component: ALevelStep, validate: validateALevelStep },
  ],
  international_qualification: [
    { id: 'international', title: 'International qualification', Component: InternationalStep, validate: validateInternationalStep },
  ],
};

const ENGLISH_LANGUAGE_STEP: WizardStepConfig = {
  id: 'english-language',
  title: 'English language evidence',
  Component: EnglishLanguageStep,
  validate: validateEnglishLanguageStep,
};

const IDENTITY_STEP: WizardStepConfig = {
  id: 'identity',
  title: 'About you',
  Component: IdentityStep,
  validate: validateIdentityStep,
};

const ROUTE_SELECT_STEP: WizardStepConfig = {
  id: 'route',
  title: 'Entry route',
  Component: RouteStep,
  validate: validateRouteStep,
};

const GCSE_STEP: WizardStepConfig = { id: 'gcse', title: 'GCSE profile', Component: GcseStep, validate: validateGcseStep };
const UCAT_STEP: WizardStepConfig = { id: 'ucat', title: 'UCAT / SJT', Component: UcatStep, validate: validateUcatStep };
const CONTEXTUAL_STEP: WizardStepConfig = {
  id: 'contextual',
  title: 'Contextual & widening participation',
  Component: ContextualStep,
  validate: validateContextualStep,
};
const UNIVERSITIES_STEP: WizardStepConfig = {
  id: 'universities',
  title: 'Choose universities',
  Component: UniversitySelectionStep,
  validate: validateUniversitiesStep,
};
const REVIEW_STEP: WizardStepConfig = { id: 'review', title: 'Review your profile', Component: ReviewStep, validate: () => ({}) };

// Static default (a_level route, no English language step) — kept for
// callers that need a step list before a profile exists.
export const WIZARD_STEPS: WizardStepConfig[] = getWizardSteps({
  course_target: { qualification_route: 'a_level' },
  applicant_identity: { fee_status: '' },
} as WizardProfile);

export function getWizardSteps(profile: WizardProfile): WizardStepConfig[] {
  const route = profile.course_target.qualification_route || 'a_level';
  const routeSteps = ROUTE_STEP[route] ?? ROUTE_STEP.a_level;
  const includeGcseStep = route !== 'scottish';

  const steps: WizardStepConfig[] = [
    IDENTITY_STEP,
    ROUTE_SELECT_STEP,
    ...(includeGcseStep ? [GCSE_STEP] : []),
    ...routeSteps,
    UCAT_STEP,
  ];

  if (requiresEnglishLanguageEvidence(profile)) {
    steps.push(ENGLISH_LANGUAGE_STEP);
  }

  steps.push(CONTEXTUAL_STEP, UNIVERSITIES_STEP, REVIEW_STEP);
  return steps;
}
