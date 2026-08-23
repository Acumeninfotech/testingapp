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

function hasEligibilityCheck(result, checkId) {
  return result.eligibility.checks.some((check) => check.id === checkId);
}

function completedOtherProgrammeResult(programmeId) {
  return contextual(applicantWith({
    admissions_tests: {
      ucat: {
        total_score: 2800,
        national_decile: 9,
        sjt_band: 2,
        test_year: 2026
      }
    },
    contextual_profile: merge(noContextualProfile(), {
      access_programmes: {
        participation_status: 'yes',
        other_programmes: [
          {
            programme_id: programmeId,
            status: 'completed',
            completion_year: 2026
          }
        ]
      }
    })
  }));
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

const oneOrdinaryNotSureSecond = contextual(applicantWith({
  contextual_profile: merge(noContextualProfile(), {
    home_area_region: { polar4_quintile: 'q2' },
    personal_circumstances: {
      first_in_family_at_university: 'not_sure'
    }
  })
}));

assert.strictEqual(oneOrdinaryNotSureSecond.status, 'information_needed');

assert.ok(
  oneOrdinaryNotSureSecond.missing_information.some((entry) =>
    entry.criterion_id === 'first_generation_higher_education' ||
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

const yorkExperience = completedOtherProgrammeResult('york_experience_summer_school');
assert.strictEqual(yorkExperience.status, 'contextual');
assertConsequence(yorkExperience, 'reduced_offer', 'eligible', 'York Experience');
assertConsequence(yorkExperience, 'alternative_wp_offer', 'not_eligible', 'York Experience');
assertConsequence(yorkExperience, 'fast_track', 'eligible', 'York Experience');
assert.strictEqual(yorkExperience.consequences.fast_track.required_decile, 4);

const yorkBlackAccess = completedOtherProgrammeResult('york_black_access');
assert.strictEqual(yorkBlackAccess.status, 'not_contextual');
assertConsequence(yorkBlackAccess, 'reduced_offer', 'not_eligible', 'York Black Access');
assertConsequence(yorkBlackAccess, 'alternative_wp_offer', 'not_eligible', 'York Black Access');
assertConsequence(yorkBlackAccess, 'fast_track', 'eligible', 'York Black Access');
assert.strictEqual(yorkBlackAccess.consequences.fast_track.required_decile, 4);

const nextStepYork = completedOtherProgrammeResult('next_step_york');
assert.strictEqual(nextStepYork.status, 'not_contextual');
assertConsequence(nextStepYork, 'reduced_offer', 'not_eligible', 'Next Step York');
assertConsequence(nextStepYork, 'alternative_wp_offer', 'not_eligible', 'Next Step York');
assertConsequence(nextStepYork, 'fast_track', 'eligible', 'Next Step York');
assert.strictEqual(nextStepYork.consequences.fast_track.required_decile, 4);

const realisingOpportunities = completedOtherProgrammeResult('realising_opportunities');
assert.strictEqual(realisingOpportunities.status, 'not_contextual');
assertConsequence(realisingOpportunities, 'reduced_offer', 'not_eligible', 'Realising Opportunities');
assertConsequence(realisingOpportunities, 'alternative_wp_offer', 'not_eligible', 'Realising Opportunities');
assertConsequence(realisingOpportunities, 'fast_track', 'eligible', 'Realising Opportunities');
assert.strictEqual(realisingOpportunities.consequences.fast_track.required_decile, 5);

const missingFastTrackDecile = contextual(applicantWith({
  admissions_tests: { ucat: { total_score: null, sjt_band: 2, test_year: 2026 } },
  contextual_profile: merge(noContextualProfile(), {
    personal_circumstances: { care_experienced: 'yes' }
  })
}));
assert.strictEqual(missingFastTrackDecile.consequences.fast_track.status, 'information_needed');

const ibApplicant = applicantWith({
  qualification_route: 'international_baccalaureate',
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
  }
});
delete ibApplicant.a_level_profile;
const ibStandard = evaluate(ibApplicant);
assert.strictEqual(ibStandard.eligibility.qualification_route, 'international_baccalaureate');
assert.strictEqual(ibStandard.eligibility.status, 'eligible');

const ibContextualApplicant = merge(ibApplicant, {
  contextual_profile: merge(noContextualProfile(), {
    personal_circumstances: { refugee: 'yes' }
  })
});
const ibContextualEvaluation = evaluate(ibContextualApplicant);
assert.strictEqual(
  ibContextualEvaluation.eligibility.qualification_route,
  'international_baccalaureate'
);
assert.strictEqual(ibContextualEvaluation.eligibility.status, 'eligible');
assert.strictEqual(ibContextualEvaluation.eligibility.academic_pathway || null, null);
assert.strictEqual(ibContextualEvaluation.eligibility.academic_pathway_id ?? null, null);
assert.strictEqual(
  hasEligibilityCheck(ibContextualEvaluation, 'a_level_contextual_reduced_offer'),
  false
);
const ibContextual = ibContextualEvaluation.eligibility.contextual_eligibility;
assert.strictEqual(ibContextual.status, 'contextual');
assertConsequence(ibContextual, 'reduced_offer', 'eligible', 'IB contextual');
assert.strictEqual(ibContextual.consequences.reduced_offer.ib_reduced_route_implemented, false);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(ibContextual.consequences.reduced_offer, 'ib_offer'),
  false
);

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
      national_5_subjects: [
        scottishSubject('english_language', 'B'),
        scottishSubject('mathematics', 'B'),
        scottishSubject('biology', 'A'),
        scottishSubject('chemistry', 'A'),
        scottishSubject('physics', 'A'),
        scottishSubject('history', 'A')
      ],
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
    delete applicant.gcse_profile;
  }
  return applicant;
}

for (const [label, domicile, route] of [
  ['England + A levels', 'England', 'a_level'],
  ['England + Scottish qualifications', 'England', 'scottish'],
  ['Scotland + Scottish qualifications', 'Scotland', 'scottish'],
  ['Scotland + A levels', 'Scotland', 'a_level']
]) {
  const applicant = routeApplicant({ domicile, route });
  const result = evaluate(applicant);

  assert.strictEqual(result.eligibility.qualification_route, route, `${label}: route`);
  assert.strictEqual(result.eligibility.status, 'eligible', `${label}: eligibility`);

  if (label === 'Scotland + Scottish qualifications') {
    assert.strictEqual(
      result.eligibility.contextual_eligibility?.status,
      'not_contextual',
      'Scotland + Scottish: contextual status must resolve as not contextual'
    );
    assert.deepStrictEqual(
      result.eligibility.manual_review_reasons,
      [],
      'Scotland + Scottish: no manual-review reasons'
    );
    assert.deepStrictEqual(
      result.eligibility.failures,
      [],
      'Scotland + Scottish: no eligibility failures'
    );

    assert.strictEqual(
      result.estimated_selection_score?.status,
      'unavailable',
      'Scotland + Scottish: complete HYMS selection estimate remains unavailable without evidenced National 5 scoring conversion'
    );
    assert.strictEqual(
      result.estimated_selection_score?.value,
      null,
      'Scotland + Scottish: no invented HYMS selection score'
    );
    assert.strictEqual(
      result.estimated_selection_score?.components?.gcse?.reason,
      'insufficient_gcse_results_for_estimate',
      'Scotland + Scottish: unsupported academic score conversion is explicit'
    );
    assert.ok(
      Number.isFinite(result.estimated_selection_score?.components?.ucat?.value),
      'Scotland + Scottish: UCAT component is still evaluated'
    );
    assert.ok(
      Number.isFinite(result.estimated_selection_score?.components?.sjt?.value),
      'Scotland + Scottish: SJT component is still evaluated'
    );
    assert.strictEqual(
      result.canonical_interview_band,
      'insufficient_evidence',
      'Scotland + Scottish: interview prediction remains unavailable rather than fabricated'
    );

    const card = buildHullYorkA100ResultCard(course, config, applicant);

    assert.strictEqual(
      card.eligibility?.status,
      'eligible',
      'Scotland + Scottish Result Card: academic eligibility remains eligible'
    );
    assert.strictEqual(
      card.display?.recommendation_display_state,
      'eligibility_only',
      'Scotland + Scottish Result Card: must not surface Information Needed'
    );
    assert.strictEqual(
      card.display?.primary_user_facing_recommendation,
      'Eligible — interview prediction unavailable',
      'Scotland + Scottish Result Card: correct public recommendation'
    );

    assert.ok(
      card.academic_requirement_checks?.some(
        (check) =>
          check.requirement_type === 'national_5_requirements' &&
          check.status === 'met'
      ),
      'Scotland + Scottish Result Card: National 5 requirement shown as met'
    );
    assert.ok(
      card.academic_requirement_checks?.some(
        (check) =>
          check.requirement_type === 'scottish_higher_and_advanced_higher_route' &&
          check.status === 'met'
      ),
      'Scotland + Scottish Result Card: Scottish Higher/AH requirement shown as met'
    );

    assert.strictEqual(
      card.alternative_academic_offer,
      null,
      'Scotland + Scottish Result Card: A-level/EPQ alternative offer must not leak into Scottish route'
    );

    assert.strictEqual(
      card.prediction?.available,
      false,
      'Scotland + Scottish Result Card: interview prediction unavailable'
    );
    assert.strictEqual(
      card.prediction?.result_band,
      'insufficient_evidence',
      'Scotland + Scottish Result Card: no fabricated interview band'
    );
    assert.strictEqual(
      card.prediction?.score,
      null,
      'Scotland + Scottish Result Card: no fabricated selection score'
    );
    assert.match(
      card.prediction?.cannot_predict_explanation || '',
      /meet HYMS's published academic requirements/i,
      'Scotland + Scottish Result Card: explanation confirms academic requirements are met'
    );
    assert.match(
      card.prediction?.cannot_predict_explanation || '',
      /National 5-to-HYMS academic scoring conversion is not available/i,
      'Scotland + Scottish Result Card: explanation identifies scoring-evidence limitation'
    );

    assert.strictEqual(
      card.stage_2_selection?.primary_model,
      'points_system',
      'Scotland + Scottish Result Card: HYMS points-based selection model exposed'
    );
    assert.ok(
      card.stage_2_selection?.ranking_factors?.some(
        (factor) =>
          factor.factor_id === 'ucat_decile' &&
          factor.role === 'scored'
      ),
      'Scotland + Scottish Result Card: UCAT exposed as scored selection factor'
    );
    assert.ok(
      card.stage_2_selection?.ranking_factors?.some(
        (factor) =>
          factor.factor_id === 'sjt_band' &&
          factor.role === 'gate_and_scored'
      ),
      'Scotland + Scottish Result Card: SJT exposed as gate and scored factor'
    );
  }
}


// HYMS Scottish lower-secondary equivalence regression.
// These must be enforced from National 5 evidence rather than an inherited GCSE profile.
for (const [label, mutate, expectedFailure] of [
  [
    'Scottish fewer than six National 5s',
    (applicant) => {
      applicant.scottish_profile.national_5_subjects =
        applicant.scottish_profile.national_5_subjects.slice(0, 5);
    },
    'national_5_requirements_not_met'
  ],
  [
    'Scottish National 5 English below B',
    (applicant) => {
      applicant.scottish_profile.national_5_subjects
        .find((subject) => subject.subject_id === 'english_language').grade = 'C';
    },
    'national_5_requirements_not_met'
  ],
  [
    'Scottish National 5 Mathematics below B',
    (applicant) => {
      applicant.scottish_profile.national_5_subjects
        .find((subject) => subject.subject_id === 'mathematics').grade = 'C';
    },
    'national_5_requirements_not_met'
  ]
]) {
  const applicant = routeApplicant({
    domicile: 'Scotland',
    route: 'scottish'
  });
  mutate(applicant);

  const result = evaluate(applicant);

  assert.strictEqual(
    result.eligibility.status,
    'not_eligible',
    `${label}: eligibility`
  );
  assert.ok(
    result.eligibility.failures.includes(expectedFailure),
    `${label}: expected ${expectedFailure}`
  );
}

// Scottish post-16 compulsory Advanced Higher sciences must remain protected.
for (const subjectId of ['biology', 'chemistry']) {
  const applicant = routeApplicant({
    domicile: 'Scotland',
    route: 'scottish'
  });
  applicant.scottish_profile.advanced_higher_subjects =
    applicant.scottish_profile.advanced_higher_subjects.filter(
      (subject) => subject.subject_id !== subjectId
    );

  const result = evaluate(applicant);

  assert.strictEqual(
    result.eligibility.status,
    'not_eligible',
    `Scottish missing AH ${subjectId}: eligibility`
  );
  assert.ok(
    result.eligibility.failures.includes('scottish_requirements_not_met'),
    `Scottish missing AH ${subjectId}: expected Scottish requirement failure`
  );
}

const scottishContextualApplicant = routeApplicant({
  domicile: 'Scotland',
  route: 'scottish'
});
scottishContextualApplicant.contextual_profile = merge(noContextualProfile(), {
  personal_circumstances: { refugee: 'yes' }
});
const scottishContextualResult = evaluate(scottishContextualApplicant);
assert.strictEqual(scottishContextualResult.eligibility.qualification_route, 'scottish');
assert.strictEqual(scottishContextualResult.eligibility.status, 'eligible');
assert.strictEqual(
  scottishContextualResult.eligibility.contextual_eligibility.status,
  'contextual'
);
assertConsequence(
  scottishContextualResult.eligibility.contextual_eligibility,
  'reduced_offer',
  'eligible',
  'Scottish contextual'
);
assert.strictEqual(
  scottishContextualResult.eligibility.contextual_eligibility.consequences.reduced_offer.scottish_offer,
  '2027 contextual Scottish reduced route'
);
assert.strictEqual(
  scottishContextualResult.eligibility.contextual_eligibility.consequences.reduced_offer.qualification_scope.includes('scottish'),
  true
);
assert.strictEqual(scottishContextualResult.eligibility.qualification_route === 'a_level', false);
assert.strictEqual(scottishContextualResult.eligibility.academic_pathway || null, null);
assert.strictEqual(scottishContextualResult.eligibility.academic_pathway_id ?? null, null);
assert.strictEqual(
  hasEligibilityCheck(scottishContextualResult, 'a_level_contextual_reduced_offer'),
  false
);

const sjtBand4ContextualApplicant = applicantWith({
  qualification_route: 'a_level',
  a_level_profile: {
    completed_in_one_sitting: true,
    subjects: [
      subject('biology', 'A'),
      subject('chemistry', 'A'),
      subject('history', 'A')
    ]
  },
  admissions_tests: {
    ucat: {
      total_score: 2600,
      score_scale: 2700,
      national_decile: 9,
      sjt_band: 4,
      test_year: 2026
    }
  },
  contextual_profile: merge(noContextualProfile(), {
    personal_circumstances: { refugee: 'yes' }
  })
});
const sjtBand4ContextualResult = evaluate(sjtBand4ContextualApplicant);
assert.strictEqual(sjtBand4ContextualResult.eligibility.status, 'not_eligible');
assert.ok(
  sjtBand4ContextualResult.eligibility.failures.includes('disqualifying_sjt_rule')
);
assert.strictEqual(sjtBand4ContextualResult.canonical_interview_band, 'not_eligible');
assert.strictEqual(
  sjtBand4ContextualResult.eligibility.contextual_eligibility.status,
  'contextual'
);
assertConsequence(
  sjtBand4ContextualResult.eligibility.contextual_eligibility,
  'reduced_offer',
  'eligible',
  'SJT Band 4 contextual'
);
assertConsequence(
  sjtBand4ContextualResult.eligibility.contextual_eligibility,
  'fast_track',
  'eligible',
  'SJT Band 4 contextual'
);
assert.strictEqual(sjtBand4ContextualResult.estimated_selection_score.status, 'not_applied');

const sjtBand4ContextualCard = buildHullYorkA100ResultCard(
  course,
  config,
  sjtBand4ContextualApplicant
);
assert.strictEqual(sjtBand4ContextualCard.eligibility.status, 'not_eligible');
assert.strictEqual(sjtBand4ContextualCard.prediction.result_band, 'not_eligible');
assert.strictEqual(sjtBand4ContextualCard.display.recommendation_display_state, 'not_eligible');

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
