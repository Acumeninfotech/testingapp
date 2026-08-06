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

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const course = readJson('data/universities/aston-a100.json');
const config = readJson('data/interview-band-configs/aston-a100.json');
const resultCard = readJson('data/examples/aston-a100-result-card.example.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseApplicant() {
  return {
    profile_id: 'aston_end_to_end_applicant',
    qualification_route: 'a_level',
    application_year: 2026,
    applicant_identity: {
      applicant_type: 'standard_school_leaver',
      fee_status: 'Home',
      domicile: 'England',
      contextual: false,
      contextual_status_confirmed: false,
      widening_participation: false,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    gcse_profile: {
      subjects: {
        english_language: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '8',
        history: '8',
        geography: '7'
      }
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'history', predicted_grade: 'A', sitting_status: 'first_sitting', practical_endorsement: null }
      ]
    },
    admissions_tests: {
      ucat: {
        total_score: 2400,
        score_scale: 2700,
        test_year: 2026,
        sjt_band: 4
      }
    },
    graduate_profile: {
      is_graduate: false
    }
  };
}

function setALevels(applicant, grades) {
  applicant.a_level_profile.subjects = Object.entries(grades).map(([subjectId, grade]) => ({
    subject_id: subjectId,
    predicted_grade: grade,
    sitting_status: 'first_sitting',
    practical_endorsement:
      ['biology', 'human_biology', 'chemistry', 'physics'].includes(subjectId)
        ? 'pass'
        : null
  }));
  return applicant;
}

function internationalApplicant() {
  const applicant = baseApplicant();
  applicant.applicant_identity.fee_status = 'International';
  applicant.international_qualification = {
    equivalence_status: 'verified'
  };
  applicant.english_language_profile = {
    test: 'IELTS Academic',
    scores: {
      overall: 7,
      reading: 7,
      writing: 7,
      listening: 7,
      speaking: 7
    },
    valid_at_course_start: true
  };
  return applicant;
}

function hasNestedKey(value, targetKey) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, targetKey)) {
    return true;
  }

  return Object.values(value).some((entry) => hasNestedKey(entry, targetKey));
}

function runPipeline(applicant) {
  const eligibility = evaluateCourseEligibility(course, applicant);
  const selection =
    eligibility.status === 'eligible'
      ? classifyInterviewBand(course, config, applicant)
      : null;

  return {
    eligibility,
    selection
  };
}

function assertManualReview(result, reason) {
  assert.strictEqual(result.status, 'manual_review');
  assert.ok(
    result.manual_review_reasons.includes(reason),
    `Expected manual-review reason ${reason}; received ${result.manual_review_reasons.join(', ')}.`
  );
  assert.strictEqual(result.mode, 'eligibility_only');
  assert.strictEqual(hasNestedKey(result, 'offer_probability'), false);
}

function assertOfferUnavailable(selection) {
  assert.strictEqual(selection.offer_prediction_status, undefined);
  assert.strictEqual(hasNestedKey(selection, 'offer_score'), false);
  assert.strictEqual(hasNestedKey(selection, 'offer_probability'), false);
}

const tests = [
  {
    id: 'standard_home_non_wp_end_to_end',
    run() {
      const { eligibility, selection } = runPipeline(baseApplicant());
      assert.strictEqual(eligibility.status, 'eligible');
      assert.strictEqual(selection.eligibility.status, 'eligible');
      assert.strictEqual(selection.ranking.components.gcse_academic_score.value, 24);
      assert.strictEqual(selection.ranking.components.gcse_academic_score.max, 24);
      assert.strictEqual(selection.ranking.components.ucat_score.value, 11);
      assert.strictEqual(selection.ranking.components.ucat_score.max, 12);
      assert.strictEqual(selection.ranking.value, 35);
      assert.strictEqual(selection.ranking.max, 36);
      assert.strictEqual(selection.guidance_pool_id, 'home_non_wp');
      assert.strictEqual(selection.canonical_interview_band, 'interview_likely');
      assertOfferUnavailable(selection);
    }
  },
  {
    id: 'home_wp_contextual_route_and_pool',
    run() {
      const applicant = baseApplicant();
      applicant.contextual_profile = {
        school_education: {
          state_non_fee_paying_school: 'yes'
        },
        financial_support: {
          ucat_bursary_recipient: 'yes'
        }
      };
      applicant.gcse_profile.subjects = {
        english_language: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '6',
        history: '6'
      };
      applicant.admissions_tests.ucat.total_score = 2000;
      setALevels(applicant, {
        chemistry: 'A',
        biology: 'A',
        history: 'B'
      });

      const { eligibility, selection } = runPipeline(applicant);
      assert.strictEqual(eligibility.status, 'eligible');
      assert.strictEqual(selection.guidance_pool_id, 'home_wp');
      assert.strictEqual(selection.ranking.value, 29);
      assert.strictEqual(selection.ranking.max, 36);
      assert.strictEqual(selection.canonical_interview_band, 'realistic');
      assert.deepStrictEqual(course.offer_selection.contextual_offer.grade_profile, ['A', 'A', 'B']);
      assert.ok(course.offer_selection.contextual_offer.any_group_ids.includes('widening_participation'));
      assertOfferUnavailable(selection);
    }
  },
  {
    id: 'international_uses_ucat_2700_only',
    run() {
      const { eligibility, selection } = runPipeline(internationalApplicant());
      assert.strictEqual(eligibility.status, 'eligible');
      assert.strictEqual(selection.guidance_pool_id, 'international');
      assert.deepStrictEqual(selection.band_metric, {
        metric: 'ucat_total',
        value: 2400,
        scale: { min: 0, max: 2700 }
      });
      assert.strictEqual(selection.ranking.value, 2400);
      assert.strictEqual(selection.ranking.max, 2700);
      assert.doesNotMatch(selection.explanation, /\/36/);
      assertOfferUnavailable(selection);
    }
  },
  {
    id: 'gcse_english_below_six_fails',
    run() {
      const applicant = baseApplicant();
      applicant.gcse_profile.subjects.english_language = '5';
      const eligibility = evaluateCourseEligibility(course, applicant);
      assert.strictEqual(eligibility.status, 'not_eligible');
      assert.ok(eligibility.failures.includes('gcse_requirement_not_met:english_language'));
      const selection = classifyInterviewBand(course, config, applicant);
      assert.strictEqual(selection.canonical_interview_band, 'not_eligible');
      assert.strictEqual(selection.ranking, null);
    }
  },
  {
    id: 'missing_gcse_science_alternative_fails',
    run() {
      const applicant = baseApplicant();
      delete applicant.gcse_profile.subjects.chemistry;
      const eligibility = evaluateCourseEligibility(course, applicant);
      assert.strictEqual(eligibility.status, 'not_eligible');
      assert.ok(eligibility.failures.includes('gcse_science_alternative_not_met'));
      const selection = classifyInterviewBand(course, config, applicant);
      assert.strictEqual(selection.canonical_interview_band, 'not_eligible');
    }
  },
  {
    id: 'a_star_outside_chemistry_biology_fails',
    run() {
      const applicant = setALevels(baseApplicant(), {
        chemistry: 'A',
        biology: 'A',
        mathematics: 'A*'
      });
      const eligibility = evaluateCourseEligibility(course, applicant);
      assert.strictEqual(eligibility.status, 'not_eligible');
      assert.ok(eligibility.failures.includes('a_level_requirements_not_met'));
      const selection = classifyInterviewBand(course, config, applicant);
      assert.strictEqual(selection.canonical_interview_band, 'not_eligible');
      assert.strictEqual(selection.ranking, null);
    }
  },
  {
    id: 'ucat_below_published_range_is_safeguarded',
    run() {
      const applicant = baseApplicant();
      applicant.admissions_tests.ucat.total_score = 1649;
      const { eligibility, selection } = runPipeline(applicant);
      assert.strictEqual(eligibility.status, 'eligible');
      assert.strictEqual(selection.ranking.status, 'unavailable');
      assert.strictEqual(selection.ranking.components.ucat_score.value, null);
      assert.strictEqual(selection.ranking.components.ucat_score.estimated_from_gap, false);
      assert.strictEqual(selection.canonical_interview_band, 'insufficient_evidence');
      assertOfferUnavailable(selection);
    }
  },
  {
    id: 'sjt_band_four_is_accepted_and_unscored',
    run() {
      const applicant = baseApplicant();
      const { eligibility, selection } = runPipeline(applicant);
      const sjtCheck = eligibility.checks.find((check) => check.check_id === 'sjt_policy');
      assert.strictEqual(sjtCheck.status, 'pass');
      assert.strictEqual(sjtCheck.band, 4);
      assert.strictEqual(sjtCheck.used_in_selection, false);
      assert.strictEqual(selection.ranking.value, 35);
      assert.strictEqual(selection.ranking.components.sjt, undefined);
    }
  },
  {
    id: 'legacy_gcse_a_is_insufficient_evidence',
    run() {
      const applicant = baseApplicant();
      applicant.gcse_profile.subjects.english_language = 'A';
      const { eligibility, selection } = runPipeline(applicant);
      assert.strictEqual(eligibility.status, 'eligible');
      assert.strictEqual(selection.ranking.status, 'unavailable');
      assert.match(
        selection.ranking.components.gcse_academic_score.reason,
        /^ambiguous_gcse_grade_points:english_language:A$/
      );
      assert.strictEqual(selection.canonical_interview_band, 'insufficient_evidence');
    }
  },
  {
    id: 'alternative_english_test_and_exemption_require_review',
    run() {
      const alternativeTest = internationalApplicant();
      alternativeTest.english_language_profile = {
        test: 'TOEFL iBT',
        scores: { overall: 110 }
      };
      assertManualReview(
        evaluateCourseEligibility(course, alternativeTest),
        'alternative_english_test_requires_review'
      );

      const exemption = internationalApplicant();
      exemption.english_language_profile = { exemption_claimed: true };
      assertManualReview(
        evaluateCourseEligibility(course, exemption),
        'english_language_exemption_requires_review'
      );
    }
  },
  {
    id: 'unlisted_international_qualification_requires_review',
    run() {
      const applicant = internationalApplicant();
      applicant.international_qualification.equivalence_status = 'unlisted';
      assertManualReview(
        evaluateCourseEligibility(course, applicant),
        'unlisted_international_equivalence'
      );
    }
  },
  {
    id: 'ambiguous_fee_status_requires_review',
    run() {
      const applicant = baseApplicant();
      applicant.applicant_group_ids = ['home_fee', 'international_fee'];
      assertManualReview(
        evaluateCourseEligibility(course, applicant),
        'ambiguous_fee_status'
      );
    }
  },
  {
    id: 'unsupported_and_external_foundation_require_review',
    run() {
      for (const programme of ['unlisted_foundation', 'external_foundation_year']) {
        const applicant = baseApplicant();
        applicant.qualification_route = 'foundation';
        applicant.foundation_profile = { programme };
        assertManualReview(
          evaluateCourseEligibility(course, applicant),
          'foundation_applicant'
        );
      }
    }
  },
  {
    id: 'unlisted_btec_and_mixed_t_level_require_review',
    run() {
      const btec = setALevels(baseApplicant(), {
        chemistry: 'A*',
        biology: 'A'
      });
      btec.qualification_route = 'btec';
      btec.btec_profile = {
        qualification: 'BTEC National Extended Diploma in Applied Science',
        subject_id: 'applied_science',
        grade: 'DDM'
      };
      assertManualReview(
        evaluateCourseEligibility(course, btec),
        'unlisted_btec_combination'
      );

      const mixed = baseApplicant();
      mixed.qualification_route = 'mixed_t_level_a_level';
      mixed.t_level_profile = { grade: 'Distinction' };
      assertManualReview(
        evaluateCourseEligibility(course, mixed),
        'mixed_t_level_a_level_case'
      );
    }
  },
  {
    id: 'offer_formula_is_stored_but_never_executed',
    run() {
      const offerModel = course.offer_selection.offer_model;
      assert.strictEqual(offerModel.model_id, 'aston_post_interview_2_1_1');
      assert.strictEqual(offerModel.weight_ratio, '2:1:1');
      assert.strictEqual(offerModel.academic_weight_percent, 50);
      assert.strictEqual(offerModel.ucat_weight_percent, 25);
      assert.strictEqual(offerModel.mmi_weight_percent, 25);
      assert.strictEqual(offerModel.execution_status, 'disabled_pending_offer_consumer_and_acceptance_tests');
      assert.strictEqual(course.offer_selection.execution_status, 'offer_prediction_disabled');
      assert.strictEqual(course.engine_notes.official_offer_formula_available, undefined);
      assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
      assert.strictEqual(course.engine_notes.offer_prediction_ready, undefined);

      const applicant = baseApplicant();
      applicant.interview_profile = {
        mmi_score: 45,
        mmi_score_max: 45
      };
      const selection = classifyInterviewBand(course, config, applicant);
      assertOfferUnavailable(selection);
      assert.strictEqual(hasNestedKey(selection, 'offer_prediction'), false);
    }
  },
  {
    id: 'sources_disclaimers_and_do_not_infer_are_preserved',
    run() {
      assert.strictEqual(config.score_model.fixed_current_cutoff, false);
      assert.strictEqual(course.historical_admissions.pre_interview_thresholds.fixed_current_cutoff, false);
      assert.strictEqual(resultCard.historical_context.fixed_current_cutoff, false);
      assert.strictEqual(resultCard.historical_context.use, 'context_only');
      assert.ok(
        resultCard.historical_context.guidance.every((entry) => {
          return /guidance|context/i.test(entry.classification) &&
            /not .*current cutoff|not .*observed/i.test(entry.classification);
        })
      );
      assert.ok(Array.isArray(resultCard.evidence.source_traceability));
      assert.ok(resultCard.evidence.source_traceability.length >= 3);
      assert.ok(resultCard.evidence.source_traceability.every((entry) => entry.artifact && entry.path));
      assert.ok(Array.isArray(course.engine_notes.do_not_infer));
      assert.ok(course.engine_notes.do_not_infer.length > 0);
      assert.ok(config.eligibility.do_not_infer.length > 0);
      assert.ok(
        course.engine_notes.do_not_infer.some((rule) => /UCAT points below 1650/i.test(rule))
      );
      assert.ok(
        course.engine_notes.do_not_infer.some((rule) => /International pre-interview ranking/i.test(rule))
      );
      assert.strictEqual(course.engine_notes.offer_prediction_scope, 'out_of_scope');
      assert.ok(
        course.engine_notes.do_not_infer.every((rule) => !/offer prediction/i.test(rule))
      );
    }
  }
];

let passed = 0;

console.log('Aston A100 end-to-end acceptance tests');
console.log('Artifacts: production profile + eligibility evaluator + interview config + selection classifier + result-card evidence\n');

for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`PASS ${test.id}`);
}

console.log(`\nPASS Aston A100 end-to-end acceptance (${passed}/${tests.length})`);
