const {
  ASTON_READY_EVALUATOR_ID,
  astonReadyMedicineEvaluator
} = require('./aston-contextual-eligibility');
const {
  IMPERIAL_CONTEXTUAL_EVALUATOR_ID,
  evaluateImperialContextualEligibility
} = require('./imperial-contextual-eligibility');
const {
  MANCHESTER_CONTEXTUAL_EVALUATOR_ID,
  evaluateManchesterContextualEligibility
} = require('./manchester-contextual-eligibility');
const {
  LEICESTER_CONTEXTUAL_EVALUATOR_ID,
  evaluateLeicesterContextualEligibility
} = require('./leicester-contextual-eligibility');
const {
  BRISTOL_CONTEXTUAL_EVALUATOR_ID,
  evaluateBristolContextualEligibility
} = require('./bristol-contextual-eligibility');

const DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS = {
  [ASTON_READY_EVALUATOR_ID]: astonReadyMedicineEvaluator,
  [IMPERIAL_CONTEXTUAL_EVALUATOR_ID]: evaluateImperialContextualEligibility,
  [MANCHESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateManchesterContextualEligibility,
  [LEICESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateLeicesterContextualEligibility,
  [BRISTOL_CONTEXTUAL_EVALUATOR_ID]: evaluateBristolContextualEligibility
};

module.exports = {
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
};
