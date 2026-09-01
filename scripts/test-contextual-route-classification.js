#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateContextualEligibility } = require('../assets/js/engine/eligibility-evaluator');
const { classifyInterviewBand } = require('../assets/js/engine/interview-band-classifier');
const { evaluateHullYorkA100 } = require('../assets/js/engine/hull-york-a100-consumer');
const { evaluateNottinghamA100 } = require('../assets/js/engine/nottingham-a100-consumer');
const { predict } = require('../server/src/predict');
const { isProductionReady, loadIndex } = require('../server/src/universities');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const resultsDir = path.join(dataDir, 'regression-results');

const CONTEXTUAL_FLAGS = [
  'care_experienced',
  'refugee_or_asylum_seeker',
  'free_school_meals',
  'first_generation_higher_education',
  'school_contextual_indicator',
  'ucat_bursary'
];

const EXPECTED_FLAG_ROUTE_CHANGES = {
  care_experienced: [
    'anglia-ruskin-a100',
    'aston-a100',
    'bristol-a100',
    'imperial-college-london-a100',
    'keele-a100',
    'king-s-college-london-a100'
  ],
  refugee_or_asylum_seeker: [
    'bristol-a100',
    'keele-a100',
    'king-s-college-london-a100'
  ],
  free_school_meals: [
    'anglia-ruskin-a100',
    'aston-a100',
    'bristol-a100',
    'imperial-college-london-a100',
    'keele-a100',
    'king-s-college-london-a100'
  ],
  first_generation_higher_education: [
    'aston-a100',
    'bristol-a100',
    'keele-a100'
  ],
  school_contextual_indicator: [
    'bristol-a100'
  ],
  ucat_bursary: [
    'aston-a100',
    'bristol-a100'
  ]
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, relativePath), 'utf8'));
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

function makeAuditProfile(options = {}) {
  const flags = Object.fromEntries(CONTEXTUAL_FLAGS.map((flag) => [flag, false]));
  for (const flag of options.flags || []) {
    flags[flag] = true;
  }

  const topLevel = options.topLevel === true;
  return {
    profile_id: options.profileId || 'contextual_route_audit_profile',
    label: 'Contextual route audit profile',
    applicant_identity: {
      applicant_type: 'school_leaver',
      fee_status: 'home_fee',
      domicile: 'england',
      contextual: topLevel,
      widening_participation: topLevel && options.allFlags === true,
      contextual_flags: flags,
      graduate: false,
      resit: {
        has_resits: false,
        subjects_resat: []
      }
    },
    course_target: {
      discipline: 'medicine',
      ucas_code: 'A100',
      course_route: 'standard',
      entry_route: 'standard_medicine_a100'
    },
    qualification_route: 'a_level',
    application_year: 2027,
    gcse_profile: {
      subjects: {
        english_language: '9',
        english_literature: '9',
        mathematics: '9',
        biology: '9',
        chemistry: '9',
        physics: '9',
        combined_science: null
      },
      additional_subjects: [
        { subject_id: 'history', grade: '9' },
        { subject_id: 'geography', grade: '8' },
        { subject_id: 'french', grade: '8' },
        { subject_id: 'computer_science', grade: '8' }
      ],
      total_gcse_count: 10,
      top_9_gcse_grades: ['9', '9', '9', '9', '9', '9', '9', '8', '8']
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: null }
      ],
      sitting_status: 'first_sitting',
      completed_in_one_sitting: true
    },
    admissions_tests: {
      ucat: {
        taken: true,
        total_score: 2400,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 800,
          decision_making: 800,
          quantitative_reasoning: 800
        },
        sjt_band: 1,
        test_year: 2026
      },
      gamsat: {
        taken: false,
        overall_score: null,
        section_scores: [null, null, null]
      }
    },
    graduate_profile: {
      is_graduate: false,
      degree_classification: null,
      degree_status: null,
      recognised_institution: false,
      degree_age_at_course_start_years: null
    },
    english_language_profile: {
      exemption_claimed: true
    }
  };
}

function loadUniversities() {
  return loadIndex().universities
    .filter(isProductionReady)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => ({
      ...entry,
      course: readJson(entry.json_file),
      config: readJson(entry.interview_band_config_file)
    }));
}

function publicGroup(card) {
  const state = card.recommendation_display_state;
  const band = card.prediction?.result_band;
  if (state === 'not_eligible' || band === 'not_eligible') return 'Not Eligible';
  if (
    state === 'manual_review' ||
    state === 'insufficient_evidence' ||
    state === 'eligibility_only' ||
    band === 'insufficient_evidence' ||
    band === 'eligible_to_apply'
  ) {
    return 'Information Needed';
  }
  if (card.interview_outcome === 'guaranteed_interview') return 'Recommended';
  if (['very_strong_interview_potential', 'interview_likely'].includes(band)) return 'Recommended';
  if (['realistic', 'ambitious', 'high_risk'].includes(band)) return 'Consider';
  return 'Information Needed';
}

function classifyInternal(university, applicant) {
  if (university.id === 'nottingham-a100') {
    const evaluation = evaluateNottinghamA100(
      university.course,
      applicant,
      { interviewBandConfig: university.config }
    );
    return {
      applicant_group_ids: evaluation.eligibility?.applicant_group_ids || [],
      guidance_pool_id: null,
      selection_route_id: null,
      canonical_interview_band: null,
      academic_pathway: evaluation.eligibility?.academic_pathway || null,
      academic_pathway_id: evaluation.eligibility?.academic_pathway_id ?? null,
      interview_outcome: null
    };
  }

  if (university.id === 'hull-york-a100') {
    const evaluation = evaluateHullYorkA100(university.course, university.config, applicant);
    return {
      applicant_group_ids: evaluation.eligibility?.applicant_group_ids || [],
      guidance_pool_id: evaluation.guidance_pool_id || null,
      selection_route_id: evaluation.selection_route_id || null,
      canonical_interview_band: evaluation.canonical_interview_band || null,
      academic_pathway: evaluation.eligibility?.academic_pathway || null,
      academic_pathway_id: evaluation.eligibility?.academic_pathway_id ?? null,
      interview_outcome: evaluation.interview_outcome || null
    };
  }

  const classification = classifyInterviewBand(university.course, university.config, applicant);
  return {
    applicant_group_ids: classification.applicant_group_ids || [],
    guidance_pool_id: classification.guidance_pool_id || null,
    selection_route_id: classification.selection_route_id || null,
    canonical_interview_band: classification.canonical_interview_band || null,
    academic_pathway: classification.eligibility?.academic_pathway || null,
    academic_pathway_id: classification.eligibility?.academic_pathway_id ?? null,
    interview_outcome: classification.interview_outcome || null
  };
}

function evaluate(university, applicant) {
  const card = predict({
    universityIds: [university.id],
    studentProfile: applicant
  })[0].result_card;
  const internal = classifyInternal(university, applicant);
  return {
    public_group: publicGroup(card),
    result_band: card.prediction?.result_band || null,
    display_state: card.recommendation_display_state || null,
    applicant_group_ids: internal.applicant_group_ids,
    guidance_pool_id: internal.guidance_pool_id,
    selection_route_id: internal.selection_route_id,
    canonical_interview_band: internal.canonical_interview_band,
    academic_pathway: internal.academic_pathway,
    academic_pathway_id: internal.academic_pathway_id,
    interview_outcome: card.interview_outcome || internal.interview_outcome || null
  };
}

function routeSignature(result) {
  return [
    result.public_group,
    result.result_band,
    result.display_state,
    result.guidance_pool_id,
    result.selection_route_id,
    result.academic_pathway,
    result.academic_pathway_id,
    result.interview_outcome
  ].map((value) => value ?? '').join('\u0000');
}

function countPublicGroups(rows, scenario) {
  return rows.reduce((counts, row) => {
    const group = row[scenario].public_group;
    counts[group] = (counts[group] || 0) + 1;
    return counts;
  }, {});
}

function pathLabel(result) {
  return [
    result.selection_route_id,
    result.guidance_pool_id,
    result.academic_pathway_id || result.academic_pathway
  ].filter(Boolean).join(' / ') || '-';
}

function formatResult(result) {
  return `${result.public_group}${result.result_band ? ` (${result.result_band})` : ''}`;
}

function makeAuditRows(universities) {
  const standardApplicant = makeAuditProfile();
  const topOnlyApplicant = makeAuditProfile({
    topLevel: true,
    profileId: 'contextual_route_top_level_only'
  });
  const allFlagsApplicant = makeAuditProfile({
    topLevel: true,
    allFlags: true,
    flags: CONTEXTUAL_FLAGS,
    profileId: 'contextual_route_all_flags'
  });

  return universities.map((university) => {
    const standard = evaluate(university, standardApplicant);
    const topOnly = evaluate(university, topOnlyApplicant);
    const allFlags = evaluate(university, allFlagsApplicant);
    const topChanged = routeSignature(standard) !== routeSignature(topOnly);
    const allChanged = routeSignature(standard) !== routeSignature(allFlags);

    return {
      university_id: university.id,
      university_name: university.university_name,
      standard,
      top_level_only: topOnly,
      all_flags: allFlags,
      contextual_route_legitimately_activated:
        allChanged &&
        (
          allFlags.applicant_group_ids.includes('contextual') ||
          allFlags.applicant_group_ids.includes('widening_participation') ||
          allFlags.interview_outcome === 'guaranteed_interview'
        ),
      change_reason: topChanged
        ? 'unexpected_top_level_change'
        : allChanged
          ? 'evidence_specific_contextual_or_wp_route'
          : 'no_route_or_prediction_change'
    };
  });
}

function writeAudit(rows, counts) {
  fs.mkdirSync(resultsDir, { recursive: true });
  const jsonPath = path.join(resultsDir, 'contextual-route-classification-audit.json');
  const markdownPath = path.join(resultsDir, 'contextual-route-classification-audit.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify({ counts, rows }, null, 2)}\n`);

  const lines = [
    '# Contextual Route Classification Audit',
    '',
    '## Counts',
    '',
    '```json',
    JSON.stringify(counts, null, 2),
    '```',
    '',
    '| University | Standard | Top-level only | All flags | Standard groups | Top-only groups | All-flags groups | Standard path | Top-only path | All-flags path | Contextual route activated | Reason |',
    '|---|---:|---:|---:|---|---|---|---|---|---|---|---|'
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.university_id} | ${formatResult(row.standard)} | ${formatResult(row.top_level_only)} | ${formatResult(row.all_flags)} | ` +
      `${row.standard.applicant_group_ids.join(', ')} | ${row.top_level_only.applicant_group_ids.join(', ')} | ` +
      `${row.all_flags.applicant_group_ids.join(', ')} | ${pathLabel(row.standard)} | ${pathLabel(row.top_level_only)} | ` +
      `${pathLabel(row.all_flags)} | ${row.contextual_route_legitimately_activated ? 'yes' : 'no'} | ${row.change_reason} |`
    );
  }

  fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);
}

function assertNoContextualGroups(result, message) {
  assert.ok(!result.applicant_group_ids.includes('contextual'), message);
  assert.ok(!result.applicant_group_ids.includes('widening_participation'), message);
}

function run() {
  const universities = loadUniversities();
  assert.strictEqual(universities.length, 40, 'Expected 40 production-ready universities.');

  const rows = makeAuditRows(universities);
  const counts = {
    standard: countPublicGroups(rows, 'standard'),
    top_level_only: countPublicGroups(rows, 'top_level_only'),
    all_flags: countPublicGroups(rows, 'all_flags')
  };

  const topLevelChangedRows = rows.filter((row) => {
    return (
      routeSignature(row.top_level_only) !== routeSignature(row.standard) ||
      JSON.stringify(row.top_level_only.applicant_group_ids) !== JSON.stringify(row.standard.applicant_group_ids)
    );
  });
  assert.deepStrictEqual(
    topLevelChangedRows.map((row) => row.university_id),
    ['bristol-a100'],
    'Only Bristol should diverge when top-level contextual self-declaration lacks structured evidence.'
  );
  assert.deepStrictEqual(
    countPublicGroups(
      rows.filter((row) => row.university_id !== 'bristol-a100'),
      'top_level_only'
    ),
    countPublicGroups(
      rows.filter((row) => row.university_id !== 'bristol-a100'),
      'standard'
    ),
    'Top-level contextual self-declaration must not alter non-Bristol public result totals.'
  );

  const bristolTopLevelRow = topLevelChangedRows[0];
  assert.strictEqual(bristolTopLevelRow.standard.public_group, 'Recommended');
  assert.strictEqual(bristolTopLevelRow.top_level_only.public_group, 'Information Needed');
  assert.strictEqual(bristolTopLevelRow.top_level_only.display_state, 'manual_review');
  assert.strictEqual(bristolTopLevelRow.top_level_only.result_band, 'insufficient_evidence');
  assert.strictEqual(bristolTopLevelRow.top_level_only.guidance_pool_id, null);

  for (const row of rows) {
    if (row.university_id === 'bristol-a100') {
      continue;
    }
    assert.strictEqual(
      routeSignature(row.top_level_only),
      routeSignature(row.standard),
      `${row.university_id}: top-level contextual self-declaration changed routing.`
    );
    assert.deepStrictEqual(
      row.top_level_only.applicant_group_ids,
      row.standard.applicant_group_ids,
      `${row.university_id}: top-level contextual self-declaration changed applicant groups.`
    );
  }

  const byId = Object.fromEntries(universities.map((university) => [university.id, university]));
  const standardById = Object.fromEntries(
    universities.map((university) => [university.id, evaluate(university, makeAuditProfile())])
  );

  for (const flag of CONTEXTUAL_FLAGS) {
    const changed = [];
    for (const university of universities) {
      const applicant = makeAuditProfile({ flags: [flag], profileId: `contextual_flag_${flag}` });
      const result = evaluate(university, applicant);
      assert.ok(
        result.applicant_group_ids.includes(flag) ||
          (flag === 'refugee_or_asylum_seeker' && result.applicant_group_ids.includes('refugee')),
        `${university.id}: ${flag} should remain available as an evidence-specific applicant group.`
      );

      const standard = standardById[university.id];
      const routeChanged = routeSignature(result) !== routeSignature(standard);
      const contextualGroupAdded =
        result.applicant_group_ids.includes('contextual') ||
        result.applicant_group_ids.includes('widening_participation');
      if (routeChanged || contextualGroupAdded) {
        changed.push(university.id);
      }

      if (!EXPECTED_FLAG_ROUTE_CHANGES[flag].includes(university.id)) {
        assertNoContextualGroups(
          result,
          `${university.id}: ${flag} must not activate an unrelated contextual/WP route.`
        );
      }
    }

    assert.deepStrictEqual(
      changed,
      EXPECTED_FLAG_ROUTE_CHANGES[flag],
      `${flag}: unexpected contextual route activation set.`
    );
  }

  for (const id of ['keele-a100', 'queen-s-belfast-a100']) {
    const result = evaluate(byId[id], makeAuditProfile({ flags: ['ucat_bursary'] }));
    assertNoContextualGroups(result, `${id}: UCAT bursary alone should not create generic contextual/WP membership.`);
    assert.strictEqual(
      routeSignature(result),
      routeSignature(standardById[id]),
      `${id}: UCAT bursary alone should retain the standard methodology.`
    );
  }

  const qubFixture = readJson('fixtures/interview-band-classification/queen-s-belfast-a100.json');
  const qub = byId['queen-s-belfast-a100'];
  const qubNiApplicant = merge(
    qubFixture.base_applicant,
    qubFixture.scenarios.find((scenario) => scenario.scenario_id === 'ni_bt_postcode_contextual_route_suppresses_standard_prediction').overrides
  );
  const qubNi = classifyInternal(qub, qubNiApplicant);
  assert.ok(qubNi.applicant_group_ids.includes('qub_ni_bt_postcode_contextual_route'));
  assert.strictEqual(qubNi.guidance_pool_id, null);
  assert.strictEqual(qubNi.canonical_interview_band, 'insufficient_evidence');

  const qubGenericApplicant = merge(
    qubFixture.base_applicant,
    qubFixture.scenarios.find((scenario) => scenario.scenario_id === 'generic_contextual_flag_does_not_trigger_pop_override').overrides
  );
  const qubGeneric = classifyInternal(qub, qubGenericApplicant);
  assert.strictEqual(qubGeneric.guidance_pool_id, 'qub_home_standard_gcse_ucat_45_scale');
  assertNoContextualGroups(qubGeneric, 'QUB generic contextual flag should not add generic contextual/WP groups.');

  const qubPopApplicant = merge(
    qubFixture.base_applicant,
    qubFixture.scenarios.find((scenario) => scenario.scenario_id === 'verified_mdbs_pop_guaranteed_interview').overrides
  );
  assert.strictEqual(classifyInternal(qub, qubPopApplicant).interview_outcome, 'guaranteed_interview');

  const bsmsFixture = readJson('fixtures/interview-band-classification/brighton-and-sussex-a100.json');
  const bsms = byId['brighton-and-sussex-a100'];
  const bsmsCareApplicant = merge(
    bsmsFixture.base_applicant,
    bsmsFixture.scenarios.find((scenario) => scenario.scenario_id === 'care_leaver_no_ucat').overrides
  );
  const bsmsCare = classifyInternal(bsms, bsmsCareApplicant);
  assert.ok(bsmsCare.applicant_group_ids.includes('bsms_care_leaver_confirmed'));
  assert.strictEqual(bsmsCare.interview_outcome, 'care_leaver_interview_route');

  const bsmsRawCare = evaluate(bsms, makeAuditProfile({ flags: ['care_experienced'] }));
  assert.ok(!bsmsRawCare.applicant_group_ids.includes('bsms_care_leaver_confirmed'));
  assert.strictEqual(
    routeSignature(bsmsRawCare),
    routeSignature(standardById['brighton-and-sussex-a100']),
    'BSMS raw care-experienced flag alone should retain the standard route without BSMS verification.'
  );

  const bristolFixture = readJson('fixtures/interview-band-classification/bristol-a100.json');
  const bristol = byId['bristol-a100'];
  const bristolWpApplicant = merge(
    bristolFixture.base_applicant,
    bristolFixture.scenarios.find((scenario) => scenario.scenario_id === 'verified_bristol_wp_programme_guaranteed_interview').overrides
  );
  assert.strictEqual(classifyInternal(bristol, bristolWpApplicant).interview_outcome, 'guaranteed_interview');

  const bristolAwaitingConfirmationContextual = evaluateContextualEligibility(
    bristol.course,
    merge(bristolFixture.base_applicant, {
      application_year: 2027,
      contextual_profile: {
        partner_schools: {
          status: 'yes',
          relationships: [
            {
              university_id: 'bristol_a100',
              school_identifier_type: 'apply_centre_code',
              school_identifier: '10125',
              school_name: 'Westhill Academy',
              status: 'yes'
            }
          ]
        }
      }
    })
  );
  assert.strictEqual(
    bristolAwaitingConfirmationContextual.contextual_evidence.bristol_aspiring_state_school.verification_status,
    'matched_awaiting_confirmation'
  );
  assert.ok(
    bristolAwaitingConfirmationContextual.missing_information.some((entry) => {
      return entry.reason === 'bristol_aspiring_state_school_awaiting_confirmation';
    })
  );
  assert.ok(
    !bristolAwaitingConfirmationContextual.qualifying_criteria.some((criterion) => {
      return criterion.criterion_id === 'aspiring_state_school_or_college' && criterion.status === 'matched';
    })
  );

  writeAudit(rows, counts);
  console.log('Contextual route classification regression: PASS');
  console.log(`Universities checked: ${universities.length}`);
  console.log(`Standard/top-level counts: ${JSON.stringify(counts.standard)}`);
  console.log(`All-flags counts: ${JSON.stringify(counts.all_flags)}`);
}

run();
