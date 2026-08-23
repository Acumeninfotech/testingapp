#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildHullYorkA100ResultCard,
  evaluateHullYorkA100
} = require('../assets/js/engine/hull-york-a100-consumer');

const rootDir = path.resolve(__dirname, '..');
const course = readJson('data/universities/hull-york-a100.json');
const config = readJson('data/interview-band-configs/hull-york-a100.json');
const fixture = readJson('data/fixtures/hull-york-a100-readiness.json');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, overrides) {
  if (Array.isArray(overrides) || overrides === null || typeof overrides !== 'object') {
    return clone(overrides);
  }
  const result = clone(base);
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = merge(result[key], value);
    } else {
      result[key] = clone(value);
    }
  }
  return result;
}

function subject(subjectId, grade) {
  return {
    subject_id: subjectId,
    predicted_grade: grade,
    sitting_status: 'first_sitting'
  };
}

function scottishSubject(subjectId, grade) {
  return {
    subject_id: subjectId,
    grade
  };
}

function noContextualProfile() {
  return {
    home_area_region: {
      polar4_quintile: 'q5'
    },
    financial_support: {
      ucat_bursary_recipient: 'no'
    },
    school_education: {
      school_below_progress_8: 'no',
      below_average_gcse_school: 'no',
      below_average_post16_school: 'no'
    },
    personal_circumstances: {
      care_experienced: 'no',
      refugee: 'no',
      military_family: 'no',
      gypsy_roma_traveller: 'no',
      first_in_family_at_university: 'no'
    },
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: ''
      },
      other_programmes: []
    }
  };
}

function applicantWith(overrides = {}) {
  return merge(fixture.base_applicant, {
    applicant_identity: {
      contextual: false,
      contextual_status_confirmed: false,
      contextual_flags: {
        ucat_bursary: false,
        recognised_wp_programme: false,
        polar4_quintile: null,
        care_experienced: false,
        refugee: false,
        military_family: false,
        gypsy_roma_traveller: false,
        school_below_progress_8: false,
        first_generation_higher_education: false
      }
    },
    contextual_profile: noContextualProfile(),
    ...overrides
  });
}

function evaluate(applicant) {
  return evaluateHullYorkA100(course, config, applicant);
}

function contextual(applicant) {
  return evaluate(applicant).eligibility.contextual_eligibility;
}

function assertConsequence(contextualResult, key, status, label) {
  assert.strictEqual(
    contextualResult.consequences[key].status,
    status,
    `${label}: ${key}`
  );
}

const twoOrdinary = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    home_area_region: { polar4_quintile: 'q1' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  })
}));
assert.strictEqual(twoOrdinary.status, 'contextual', 'two ordinary markers qualify');
assert.deepStrictEqual(
  twoOrdinary.qualifying_criteria.map((entry) => entry.criterion_id).sort(),
  ['polar4_quintile_1', 'ucat_bursary']
);
assertConsequence(twoOrdinary, 'reduced_offer', 'eligible', 'two ordinary markers');

const oneOrdinary = evaluate(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    financial_support: { ucat_bursary_recipient: 'yes' }
  })
}));
assert.strictEqual(oneOrdinary.eligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(oneOrdinary.estimated_selection_score.contextual.points, 8);

const legacyOnly = evaluate(applicantWith({
  applicant_identity: {
    contextual: true,
    contextual_status_confirmed: true,
    contextual_flags: {
      ucat_bursary: true,
      recognised_wp_programme: true,
      polar4_quintile: 1,
      care_experienced: true
    }
  }
}));
assert.strictEqual(legacyOnly.eligibility.contextual_eligibility.status, 'not_contextual');
assert.strictEqual(legacyOnly.estimated_selection_score.contextual.points, 0);
assert.strictEqual(legacyOnly.eligibility.applicant_group_ids.includes('contextual'), false);
assert.strictEqual(legacyOnly.eligibility.applicant_group_ids.includes('care_experienced'), false);

const oneOrdinaryUnknownSecond = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    home_area_region: { polar4_quintile: 'unknown' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  })
}));
assert.strictEqual(oneOrdinaryUnknownSecond.status, 'information_needed');
assert.ok(
  oneOrdinaryUnknownSecond.missing_information.some((entry) =>
    entry.criterion_id === 'polar4_quintile_2' ||
    entry.reason === 'hyms_second_ordinary_marker_evidence_required'
  )
);

for (const [field, expectedCriterion] of [
  ['care_experienced', 'care_experienced'],
  ['refugee', 'refugee'],
  ['military_family', 'military_family'],
  ['gypsy_roma_traveller', 'gypsy_roma_traveller']
]) {
  const result = contextual(applicantWith({
    contextual_profile: merge(noContextualProfile(), {
      personal_circumstances: { [field]: 'yes' }
    })
  }));
  assert.strictEqual(result.status, 'contextual', `${field}: contextual`);
  assert.strictEqual(result.matched_contextual_pathway, expectedCriterion);
  assertConsequence(result, 'reduced_offer', 'eligible', field);
  assertConsequence(result, 'fast_track', 'eligible', field);
}

const completedWp = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    access_programmes: {
      participation_status: 'yes',
      ukwpmed: {
        status: 'yes',
        programme_id: 'hyms_pathways_to_medicine',
        programme_status: 'completed',
        provider_university_id: 'hull-york-a100',
        completion_year: 2026
      },
      other_programmes: []
    }
  })
}));
assert.strictEqual(completedWp.status, 'contextual');
assertConsequence(completedWp, 'alternative_wp_offer', 'eligible', 'completed UKWPMED');
assertConsequence(completedWp, 'fast_track', 'eligible', 'completed UKWPMED');

for (const programmeStatus of ['participating', 'offered', 'not_sure']) {
  const result = contextual(applicantWith({
    contextual_profile: merge(noContextualProfile(), {
      access_programmes: {
        participation_status: 'yes',
        ukwpmed: {
          status: 'yes',
          programme_id: 'hyms_pathways_to_medicine',
          programme_status: programmeStatus,
          provider_university_id: 'hull-york-a100',
          completion_year: ''
        },
        other_programmes: []
      }
    })
  }));
  assert.strictEqual(result.status, 'information_needed', `${programmeStatus}: information needed`);
}

const timingUnknown = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'york_experience_summer_school',
          status: 'completed'
        }
      ]
    }
  })
}));
assert.strictEqual(timingUnknown.status, 'information_needed');
assert.ok(timingUnknown.missing_information.some((entry) =>
  entry.reason === 'hyms_programme_completion_timing_required'
));

const genericWp = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    access_programmes: {
      participation_status: 'yes',
      other_programme_name: 'Medicine summer school',
      other_programmes: []
    }
  })
}));
assert.strictEqual(genericWp.status, 'information_needed');

const unverifiedProgramme = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'unverified_provider_programme',
          status: 'completed',
          completion_year: 2026
        }
      ]
    }
  })
}));
assert.strictEqual(unverifiedProgramme.status, 'manual_review');

for (const [label, overrides, exclusion] of [
  ['international', { applicant_identity: { fee_status: 'International', applicant_type: 'international_standard_school_leaver', english_language_exempt: true } }, 'international_applicant'],
  ['graduate', { applicant_identity: { graduate: true, applicant_type: 'graduate' }, graduate_profile: { is_graduate: true, degree_classification: '2_1' } }, 'graduate_applicant'],
  ['prior university', { applicant_identity: { prior_university_study: true } }, 'prior_university_applicant']
]) {
  const result = contextual(applicantWith(merge({
    contextual_profile: merge(noContextualProfile(), {
      financial_support: { ucat_bursary_recipient: 'yes' },
      home_area_region: { polar4_quintile: 'q1' }
    })
  }, overrides)));
  assert.strictEqual(result.is_contextual, false, `${label}: not contextual`);
  assert.ok(result.exclusions.includes(exclusion), `${label}: exclusion`);
}

const yorkExperience = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    access_programmes: {
      participation_status: 'yes',
      other_programmes: [
        {
          programme_id: 'york_experience_summer_school',
          status: 'completed',
          completion_year: 2026
        }
      ]
    }
  })
}));
assert.strictEqual(yorkExperience.status, 'contextual');
assertConsequence(yorkExperience, 'reduced_offer', 'eligible', 'York Experience');

const missingFastTrackDecile = contextual(applicantWith({
  admissions_tests: { ucat: { total_score: null, sjt_band: 2, test_year: 2026 } },
  contextual_profile: merge(noContextualProfile(), {
    personal_circumstances: { care_experienced: 'yes' }
  })
}));
assert.strictEqual(missingFastTrackDecile.consequences.fast_track.status, 'information_needed');

const ibApplicant = applicantWith({
  ib_profile: {
    total_points: 36,
    higher_level_subjects: [
      { subject_id: 'biology', grade: 6 },
      { subject_id: 'chemistry', grade: 6 },
      { subject_id: 'history', grade: 5 }
    ],
    standard_level_subjects: [
      { subject_id: 'english_language', grade: 5 },
      { subject_id: 'mathematics', grade: 5 }
    ]
  },
  contextual_profile: merge(noContextualProfile(), {
    personal_circumstances: { refugee: 'yes' }
  })
});
delete ibApplicant.a_level_profile;
const ibContextual = contextual(ibApplicant);
assert.strictEqual(ibContextual.consequences.reduced_offer.ib_reduced_route_implemented, false);

function routeApplicant({ domicile, route }) {
  const applicant = applicantWith({
    applicant_identity: {
      domicile,
      fee_status: 'Home'
    }
  });
  if (route === 'a_level') {
    applicant.qualification_route = 'a_level';
    applicant.a_level_profile = {
      completed_in_one_sitting: true,
      subjects: [
        subject('biology', 'A'),
        subject('chemistry', 'A'),
        subject('history', 'A')
      ]
    };
    delete applicant.scottish_profile;
  } else {
    applicant.qualification_route = 'scottish';
    applicant.scottish_profile = {
      higher_subjects: [
        scottishSubject('biology', 'A'),
        scottishSubject('chemistry', 'A'),
        scottishSubject('english', 'A'),
        scottishSubject('mathematics', 'A'),
        scottishSubject('history', 'B')
      ],
      advanced_higher_subjects: [
        scottishSubject('biology', 'B'),
        scottishSubject('chemistry', 'B'),
        scottishSubject('history', 'B')
      ]
    };
    delete applicant.a_level_profile;
  }
  return applicant;
}

for (const [label, domicile, route] of [
  ['England + A levels', 'England', 'a_level'],
  ['England + Scottish qualifications', 'England', 'scottish'],
  ['Scotland + Scottish qualifications', 'Scotland', 'scottish'],
  ['Scotland + A levels', 'Scotland', 'a_level']
]) {
  const result = evaluate(routeApplicant({ domicile, route }));
  assert.strictEqual(result.eligibility.qualification_route, route, `${label}: route`);
  assert.strictEqual(result.eligibility.status, 'eligible', `${label}: eligibility`);
}

const card = buildHullYorkA100ResultCard(course, config, applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    home_area_region: { polar4_quintile: 'q1' },
    financial_support: { ucat_bursary_recipient: 'yes' }
  })
}));
assert.ok(card.eligibility.contextual_eligibility, 'Result Card has canonical contextual decision');
assert.strictEqual(card.contextual_eligibility, undefined, 'Result Card avoids duplicate root contextual decision');
assert.ok(card.hyms_contextual_consequences, 'Result Card exposes HYMS consequences separately');
assert.ok(card.estimated_selection_score.contextual, 'Result Card keeps estimated contextual score component');
assert.strictEqual(card.mandatory_unofficial_estimate_disclosure.includes('not a guarantee'), true);

console.log('HYMS A100 Step 6 contextual migration regression: PASS');
