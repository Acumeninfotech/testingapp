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
  BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID,
  evaluateBirminghamContextualEligibility
} = require('./birmingham-contextual-eligibility');
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
  PLYMOUTH_CONTEXTUAL_EVALUATOR_ID,
  evaluatePlymouthContextualEligibility
} = require('./plymouth-contextual-eligibility');
const {
  SHEFFIELD_CONTEXTUAL_EVALUATOR_ID,
  evaluateSheffieldContextualEligibility
} = require('./sheffield-contextual-eligibility');
const {
  NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID,
  evaluateNottinghamContextualEligibility
} = require('./nottingham-contextual-eligibility');
const {
  ABERDEEN_CONTEXTUAL_EVALUATOR_ID,
  evaluateAberdeenContextualEligibility
} = require('./aberdeen-contextual-eligibility');
const {
  GLASGOW_CONTEXTUAL_EVALUATOR_ID,
  evaluateGlasgowContextualEligibility
} = require('./glasgow-contextual-eligibility');
const {
  DUNDEE_CONTEXTUAL_EVALUATOR_ID,
  evaluateDundeeContextualEligibility
} = require('./dundee-contextual-eligibility');
const {
  EDINBURGH_CONTEXTUAL_EVALUATOR_ID,
  evaluateEdinburghContextualEligibility
} = require('./edinburgh-contextual-eligibility');
const {
  ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID,
  evaluateStAndrewsContextualEligibility
} = require('./st-andrews-contextual-eligibility');
const {
  SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID,
  evaluateSouthamptonContextualEligibility
} = require('./southampton-contextual-eligibility');

const DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS = {
  [ABERDEEN_CONTEXTUAL_EVALUATOR_ID]: evaluateAberdeenContextualEligibility,
  [DUNDEE_CONTEXTUAL_EVALUATOR_ID]: evaluateDundeeContextualEligibility,
  [EDINBURGH_CONTEXTUAL_EVALUATOR_ID]: evaluateEdinburghContextualEligibility,
  [GLASGOW_CONTEXTUAL_EVALUATOR_ID]: evaluateGlasgowContextualEligibility,
  [ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID]: evaluateStAndrewsContextualEligibility,
  [SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID]: evaluateSouthamptonContextualEligibility,
  [ASTON_READY_EVALUATOR_ID]: astonReadyMedicineEvaluator,
  [IMPERIAL_CONTEXTUAL_EVALUATOR_ID]: evaluateImperialContextualEligibility,
  [MANCHESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateManchesterContextualEligibility,
  [LEICESTER_CONTEXTUAL_EVALUATOR_ID]: evaluateLeicesterContextualEligibility,
  [BRISTOL_CONTEXTUAL_EVALUATOR_ID]: evaluateBristolContextualEligibility,
  [BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID]: evaluateBirminghamContextualEligibility,
  [UEA_CONTEXTUAL_EVALUATOR_ID]: evaluateUeaContextualEligibility,
  [LANCASTER_CONTEXTUAL_EVALUATOR_ID]: evaluateLancasterContextualEligibility,
  [LIVERPOOL_CONTEXTUAL_EVALUATOR_ID]: evaluateLiverpoolContextualEligibility,
  [PLYMOUTH_CONTEXTUAL_EVALUATOR_ID]: evaluatePlymouthContextualEligibility,
  [SHEFFIELD_CONTEXTUAL_EVALUATOR_ID]: evaluateSheffieldContextualEligibility,
  [NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID]: evaluateNottinghamContextualEligibility
};

module.exports = {
  ABERDEEN_CONTEXTUAL_EVALUATOR_ID,
  BIRMINGHAM_CONTEXTUAL_EVALUATOR_ID,
  DUNDEE_CONTEXTUAL_EVALUATOR_ID,
  EDINBURGH_CONTEXTUAL_EVALUATOR_ID,
  GLASGOW_CONTEXTUAL_EVALUATOR_ID,
  ST_ANDREWS_CONTEXTUAL_EVALUATOR_ID,
  SOUTHAMPTON_CONTEXTUAL_EVALUATOR_ID,
  LIVERPOOL_CONTEXTUAL_EVALUATOR_ID,
  NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID,
  SHEFFIELD_CONTEXTUAL_EVALUATOR_ID,
  UEA_CONTEXTUAL_EVALUATOR_ID,
  UEA_PREPARING_FOR_MEDICINE_GROUP_ID,
  UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID,
  evaluateAberdeenContextualEligibility,
  evaluateBirminghamContextualEligibility,
  evaluateDundeeContextualEligibility,
  evaluateEdinburghContextualEligibility,
  evaluateGlasgowContextualEligibility,
  evaluateStAndrewsContextualEligibility,
  evaluateSouthamptonContextualEligibility,
  evaluateLiverpoolContextualEligibility,
  evaluatePlymouthContextualEligibility,
  evaluateNottinghamContextualEligibility,
  evaluateSheffieldContextualEligibility,
  evaluateUeaContextualEligibility,
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
};
