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
const {
  UEA_CONTEXTUAL_EVALUATOR_ID,
  UEA_PREPARING_FOR_MEDICINE_GROUP_ID,
  UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID,
  evaluateUeaContextualEligibility
} = require('./uea-contextual-eligibility');
const {
  LANCASTER_CONTEXTUAL_EVALUATOR_ID,
  evaluateLancasterContextualEligibility
} = require('./lancaster-contextual-eligibility');
const {
  LIVERPOOL_CONTEXTUAL_EVALUATOR_ID,
  evaluateLiverpoolContextualEligibility
} = require('./liverpool-contextual-eligibility');
const {
  SHEFFIELD_CONTEXTUAL_EVALUATOR_ID,
  evaluateSheffieldContextualEligibility
} = require('./sheffield-contextual-eligibility');
const {
  NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID,
  evaluateNottinghamContextualEligibility
} = require('./nottingham-contextual-eligibility');

const DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS = {
  [ASTON_READY_EVALUATOR_ID]: astonReadyMedicineEvaluator,
  [IMPERIAL_CONTEXTUAL_EVALUATOR_ID]: evaluateImperialContextualEligibility,
  [MANCHESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateManchesterContextualEligibility,
  [LEICESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateLeicesterContextualEligibility,
  [BRISTOL_CONTEXTUAL_EVALUATOR_ID]: evaluateBristolContextualEligibility,
  [UEA_CONTEXTUAL_EVALUATOR_ID]: evaluateUeaContextualEligibility,
  [LANCASTER_CONTEXTUAL_EVALUATOR_ID]: evaluateLancasterContextualEligibility,
  [LIVERPOOL_CONTEXTUAL_EVALUATOR_ID]: evaluateLiverpoolContextualEligibility,
  [SHEFFIELD_CONTEXTUAL_EVALUATOR_ID]: evaluateSheffieldContextualEligibility,
  [NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID]: evaluateNottinghamContextualEligibility
};

module.exports = {
  LIVERPOOL_CONTEXTUAL_EVALUATOR_ID,
  NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID,
  SHEFFIELD_CONTEXTUAL_EVALUATOR_ID,
  UEA_CONTEXTUAL_EVALUATOR_ID,
  UEA_PREPARING_FOR_MEDICINE_GROUP_ID,
  UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID,
  evaluateLiverpoolContextualEligibility,
  evaluateNottinghamContextualEligibility,
  evaluateSheffieldContextualEligibility,
  evaluateUeaContextualEligibility,
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
};
