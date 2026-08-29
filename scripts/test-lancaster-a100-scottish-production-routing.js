#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  evaluateCourseEligibility
} = require('../assets/js/engine/eligibility-evaluator');

const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8')
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const course = readJson('data/universities/lancaster-a100.json');
const config = readJson(
  'data/interview-band-configs/lancaster-a100.json'
);
const fixture = readJson(
  'data/fixtures/interview-band-classification/lancaster-a100.json'
);

assert.strictEqual(course.profile_id, 'lancaster-a100');

assert.ok(
  config.eligibility.qualification_routes.supported.includes('scottish'),
  'Scottish must be a supported Lancaster qualification route.'
);

assert.deepStrictEqual(
  config.eligibility.use_course_eligibility_for_qualification_routes,
  ['scottish'],
  'Scottish must delegate to shared course eligibility.'
);

const scottish =
  course.stage_1_eligibility.post_16.scottish;

assert.strictEqual(scottish.route_implemented, true);
assert.strictEqual(scottish.contextual_route_implemented, false);

for (const route of scottish.grade_requirements) {
  assert.ok(
    !route.applies_to_group_ids.includes('scotland_domiciled'),
    `${route.requirement_id} must not be Scotland-domicile gated.`
  );
}

function national5() {
  return [
    { subject_id: 'english_language', grade: 'B' },
    { subject_id: 'mathematics', grade: 'B' },
    { subject_id: 'biology', grade: 'A' },
    { subject_id: 'chemistry', grade: 'A' },
    { subject_id: 'physics', grade: 'B' },
    { subject_id: 'history', grade: 'A' },
    { subject_id: 'geography', grade: 'B' }
  ];
}

function highers() {
  return [
    {
      subject_id: 'biology',
      grade: 'A',
      achieved_grade: 'A',
      sitting_id: 's5',
      school_year: 's5'
    },
    {
      subject_id: 'chemistry',
      grade: 'A',
      achieved_grade: 'A',
      sitting_id: 's5',
      school_year: 's5'
    },
    {
      subject_id: 'mathematics',
      grade: 'A',
      achieved_grade: 'A',
      sitting_id: 's5',
      school_year: 's5'
    },
    {
      subject_id: 'english',
      grade: 'A',
      achieved_grade: 'A',
      sitting_id: 's5',
      school_year: 's5'
    },
    {
      subject_id: 'history',
      grade: 'B',
      achieved_grade: 'B',
      sitting_id: 's5',
      school_year: 's5'
    }
  ];
}

function advancedHighers() {
  return [
    {
      subject_id: 'biology',
      grade: 'A',
      predicted_grade: 'A',
      sitting_id: 's6',
      school_year: 's6'
    },
    {
      subject_id: 'chemistry',
      grade: 'A',
      predicted_grade: 'A',
      sitting_id: 's6',
      school_year: 's6'
    }
  ];
}

function baseIdentity(domicile) {
  return {
    ...(fixture.base_applicant.applicant_identity || {}),
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile,
    graduate: false,
    contextual: false,
    widening_participation: false,
    contextual_status_confirmed: false,
    contextual_flags: {}
  };
}

function scottishApplicant(domicile = 'England') {
  const applicant = clone(fixture.base_applicant);

  applicant.qualification_route = 'scottish';
  applicant.applicant_identity = baseIdentity(domicile);

  delete applicant.a_level_profile;
  delete applicant.gcse_profile;
  delete applicant.ib_profile;

  // Remove any Scottish post-16 data inherited from the generic
  // Lancaster fixture before creating the exact route under test.
  delete applicant.scottish_profile;
  delete applicant.scottish_qualifications;
  delete applicant.scottish_higher_profile;
  delete applicant.advanced_higher_profile;

  applicant.scottish_profile = {
    national_5_subjects: national5(),
    higher_subjects: highers(),
    advanced_higher_subjects: []
  };

  applicant.contextual_profile = {};

  applicant.admissions_tests = applicant.admissions_tests || {};
  applicant.admissions_tests.ucat = {
    ...(applicant.admissions_tests.ucat || {}),
    total_score: 2020,
    score_scale: 2700,
    sjt_band: 2,
    test_year: 2026
  };

  return applicant;
}

function aLevelApplicant(domicile) {
  const applicant = clone(fixture.base_applicant);

  applicant.qualification_route = 'a_level';

  applicant.applicant_identity = {
    ...applicant.applicant_identity,
    applicant_type: 'standard_school_leaver',
    fee_status: 'Home',
    domicile,
    graduate: false
  };

  return applicant;
}

function classify(applicant) {
  return classifyInterviewBand(course, config, applicant);
}

function assertScottishEligible(applicant, label) {
  const direct = evaluateCourseEligibility(course, applicant);
  const classification = classify(applicant);

  assert.strictEqual(
    direct.qualification_route,
    'scottish',
    `${label}: direct qualification route`
  );

  assert.strictEqual(
    classification.eligibility.qualification_route,
    'scottish',
    `${label}: classifier qualification route`
  );

  assert.strictEqual(
    direct.status,
    'eligible',
    `${label}: ${JSON.stringify(direct)}`
  );

  assert.strictEqual(
    classification.eligibility.status,
    'eligible',
    `${label}: ${JSON.stringify(classification.eligibility)}`
  );

  return classification;
}

function assertScottishFail(applicant, label) {
  const result = evaluateCourseEligibility(course, applicant);

  assert.strictEqual(
    result.status,
    'not_eligible',
    `${label}: ${JSON.stringify(result)}`
  );

  return result;
}

/*
 * Matrix:
 * domicile controls applicant grouping;
 * qualification controls academic evaluation.
 */

{
  const result = classify(aLevelApplicant('England'));

  assert.strictEqual(
    result.eligibility.qualification_route,
    'a_level'
  );

  assert.ok(
    !result.applicant_group_ids.includes('scotland_domiciled')
  );
}

{
  const result = classify(aLevelApplicant('Scotland'));

  assert.strictEqual(
    result.eligibility.qualification_route,
    'a_level'
  );

  assert.ok(
    result.applicant_group_ids.includes('scotland_domiciled')
  );
}

{
  const result = assertScottishEligible(
    scottishApplicant('England'),
    'England domicile + Scottish qualifications'
  );

  assert.ok(
    !result.applicant_group_ids.includes('scotland_domiciled')
  );
}

{
  const result = assertScottishEligible(
    scottishApplicant('Scotland'),
    'Scotland domicile + Scottish qualifications'
  );

  assert.ok(
    result.applicant_group_ids.includes('scotland_domiciled')
  );
}

/*
 * National 5 standard route.
 */

{
  const applicant = scottishApplicant();

  applicant.scottish_profile.national_5_subjects =
    applicant.scottish_profile.national_5_subjects.slice(0, 6);

  const result = assertScottishFail(
    applicant,
    'Only six National 5 subjects'
  );

  assert.ok(
    result.failures.includes('national_5_requirements_not_met')
  );
}

{
  const applicant = scottishApplicant();

  applicant.scottish_profile.national_5_subjects =
    applicant.scottish_profile.national_5_subjects.filter(
      subject => subject.subject_id !== 'physics'
    );

  const result = assertScottishFail(
    applicant,
    'Missing National 5 Physics'
  );

  assert.ok(
    result.failures.includes('national_5_requirements_not_met')
  );
}

{
  const applicant = scottishApplicant();

  const maths =
    applicant.scottish_profile.national_5_subjects.find(
      subject => subject.subject_id === 'mathematics'
    );

  maths.grade = 'C';

  const result = assertScottishFail(
    applicant,
    'National 5 Mathematics below B'
  );

  assert.ok(
    result.failures.includes('national_5_requirements_not_met')
  );
}

/*
 * Higher AAAAB including Biology and Chemistry A.
 */

{
  const applicant = scottishApplicant();

  const history =
    applicant.scottish_profile.higher_subjects.find(
      subject => subject.subject_id === 'history'
    );

  history.grade = 'C';
  history.achieved_grade = 'C';

  const result = assertScottishFail(
    applicant,
    'Higher profile below AAAAB'
  );

  assert.ok(
    result.failures.includes(
      'scottish_post_16_requirements_not_met'
    )
  );
}

{
  const applicant = scottishApplicant();

  const biology =
    applicant.scottish_profile.higher_subjects.find(
      subject => subject.subject_id === 'biology'
    );

  biology.grade = 'B';
  biology.achieved_grade = 'B';

  const result = assertScottishFail(
    applicant,
    'Higher Biology below A'
  );

  assert.ok(
    result.failures.includes(
      'scottish_post_16_requirements_not_met'
    )
  );
}

{
  const applicant = scottishApplicant();

  applicant.scottish_profile.higher_subjects[4].sitting_id = 's6';
  applicant.scottish_profile.higher_subjects[4].school_year = 's6';

  const result = assertScottishFail(
    applicant,
    'Highers split across sittings'
  );

  assert.ok(
    result.failures.includes(
      'scottish_post_16_requirements_not_met'
    )
  );
}

/*
 * Advanced Higher AA Biology + Chemistry.
 */

{
  const applicant = scottishApplicant();

  applicant.scottish_profile.higher_subjects = [];
  applicant.scottish_profile.advanced_higher_subjects =
    advancedHighers();

  assertScottishEligible(
    applicant,
    'Advanced Higher Biology/Chemistry AA'
  );
}

{
  const applicant = scottishApplicant();

  applicant.scottish_profile.higher_subjects = [];
  applicant.scottish_profile.advanced_higher_subjects =
    advancedHighers();

  applicant.scottish_profile
    .advanced_higher_subjects[1].grade = 'B';

  applicant.scottish_profile
    .advanced_higher_subjects[1].predicted_grade = 'B';

  const result = assertScottishFail(
    applicant,
    'Advanced Higher Chemistry below A'
  );

  assert.ok(
    result.failures.includes(
      'scottish_post_16_requirements_not_met'
    )
  );
}

/*
 * Contextual + Scottish.
 *
 * Contextual status may alter Lancaster selection treatment.
 * It must NOT manufacture a Scottish reduced-grade pathway.
 */

{
  const applicant = scottishApplicant('England');

  applicant.contextual_profile = {
    personal_circumstances: {
      care_experienced: 'yes'
    }
  };

  const result = assertScottishEligible(
    applicant,
    'Scottish + contextual care'
  );

  assert.ok(
    result.applicant_group_ids.includes('contextual')
  );

  assert.ok(
    result.applicant_group_ids.includes('widening_participation')
  );

  assert.strictEqual(
    result.eligibility.contextual_eligibility.is_contextual,
    true
  );

  assert.notStrictEqual(
    result.eligibility.academic_pathway_id,
    'lancaster_contextual_offer'
  );
}

/*
 * Band 4 must remain excluded.
 */

{
  const applicant = scottishApplicant();

  applicant.admissions_tests.ucat.sjt_band = 4;

  const result = classify(applicant);

  assert.strictEqual(
    result.eligibility.status,
    'not_eligible',
    JSON.stringify(result.eligibility)
  );

  assert.ok(
    result.eligibility.failures.includes('sjt_band_excluded')
  );
}

// LANCASTER_WIZARD_DUPLICATE_OTHER_NATIONAL5_REGRESSION
//
// The Step 5 wizard can contain multiple generic "other" National 5 rows.
// Those rows must remain separate for Lancaster's seven-subject minimum
// even though their subject_id values are identical.
{
  const duplicateOtherApplicant = scottishApplicant('England');

  duplicateOtherApplicant.scottish_profile.national_5_subjects = [
    { subject_id: 'english_language', grade: 'A' },
    { subject_id: 'mathematics', grade: 'A' },
    { subject_id: 'biology', grade: 'A' },
    { subject_id: 'chemistry', grade: 'A' },
    { subject_id: 'physics', grade: 'A' },
    { subject_id: 'other', grade: 'A' },
    { subject_id: 'other', grade: 'A' }
  ];

  const duplicateOtherResult = assertScottishEligible(
    duplicateOtherApplicant,
    'Duplicate generic Other National 5 subjects'
  );

  assert.strictEqual(
    duplicateOtherResult.eligibility.checks.find(
      (check) => check.check_id === 'national_5_requirements'
    )?.status,
    'pass',
    'Lancaster must count two separate generic Other National 5 entries toward the seven-subject minimum'
  );
}

console.log(
  'Lancaster A100 Scottish production routing regression: PASS'
);
