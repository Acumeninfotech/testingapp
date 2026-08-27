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
const {
  UCL_CONTEXTUAL_EVALUATOR_ID,
  evaluateUclContextualEligibility
} = require('./ucl-contextual-eligibility');
const {
  HYMS_CONTEXTUAL_EVALUATOR_ID,
  evaluateHymsContextualEligibility
} = require('./hyms-contextual-eligibility');
const {
  KCL_CONTEXTUAL_EVALUATOR_ID,
  evaluateKclContextualEligibility
} = require('./kcl-contextual-eligibility');
const {
  NEWCASTLE_CONTEXTUAL_EVALUATOR_ID,
  evaluateNewcastleContextualEligibility
} = require('./newcastle-contextual-eligibility');
const {
  BSMS_CONTEXTUAL_EVALUATOR_ID,
  evaluateBsmsContextualEligibility
} = require('./bsms-contextual-eligibility');
const {
  SUNDERLAND_CONTEXTUAL_EVALUATOR_ID,
  evaluateSunderlandContextualEligibility
} = require('./sunderland-contextual-eligibility');
const {
  LINCOLN_CONTEXTUAL_EVALUATOR_ID,
  evaluateLincolnContextualEligibility
} = require('./lincoln-contextual-eligibility');

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
  [NOTTINGHAM_CONTEXTUAL_EVALUATOR_ID]: evaluateNottinghamContextualEligibility,
  [UCL_CONTEXTUAL_EVALUATOR_ID]: evaluateUclContextualEligibility,
  [HYMS_CONTEXTUAL_EVALUATOR_ID]: evaluateHymsContextualEligibility,
  [KCL_CONTEXTUAL_EVALUATOR_ID]: evaluateKclContextualEligibility,
  [NEWCASTLE_CONTEXTUAL_EVALUATOR_ID]: evaluateNewcastleContextualEligibility,
  [BSMS_CONTEXTUAL_EVALUATOR_ID]: evaluateBsmsContextualEligibility,
  [SUNDERLAND_CONTEXTUAL_EVALUATOR_ID]: evaluateSunderlandContextualEligibility,
  [LINCOLN_CONTEXTUAL_EVALUATOR_ID]: evaluateLincolnContextualEligibility
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
  UCL_CONTEXTUAL_EVALUATOR_ID,
  UEA_CONTEXTUAL_EVALUATOR_ID,
  UEA_PREPARING_FOR_MEDICINE_GROUP_ID,
  UEA_PREPARING_FOR_MEDICINE_PROGRAMME_ID,
  HYMS_CONTEXTUAL_EVALUATOR_ID,
  KCL_CONTEXTUAL_EVALUATOR_ID,
  NEWCASTLE_CONTEXTUAL_EVALUATOR_ID,
  BSMS_CONTEXTUAL_EVALUATOR_ID,
  SUNDERLAND_CONTEXTUAL_EVALUATOR_ID,
  LINCOLN_CONTEXTUAL_EVALUATOR_ID,
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
  evaluateUclContextualEligibility,
  evaluateUeaContextualEligibility,
  evaluateHymsContextualEligibility,
  evaluateKclContextualEligibility,
  evaluateNewcastleContextualEligibility,
  evaluateBsmsContextualEligibility,
  evaluateSunderlandContextualEligibility,
  evaluateLincolnContextualEligibility,
  DEFAULT_CONTEXTUAL_ELIGIBILITY_EVALUATORS
};
