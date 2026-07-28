const fs = require('fs');
const path = require('path');

const { loadIndex, isProductionReady, INDEX_PATH } = require('../server/src/universities');
const { classifyInterviewBand } = require('../assets/js/engine/interview-band-classifier');
const { evaluateNottinghamA100 } = require('../assets/js/engine/nottingham-a100-consumer');
const { evaluateHullYorkA100 } = require('../assets/js/engine/hull-york-a100-consumer');
const { getGraduateCompensatoryPolicy } = require('../assets/js/engine/graduate-compensatory-policy');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const OUTPUT_DIR = path.join(DATA_DIR, 'regression-results');
const ROUTES = [
  { id: 'a_level', exposure: 'frontend' },
  { id: 'international_baccalaureate', exposure: 'frontend' },
  { id: 'scottish', exposure: 'frontend' },
  { id: 'btec', exposure: 'frontend' },
  { id: 'access_to_he', exposure: 'frontend' },
  { id: 'graduate', exposure: 'frontend' },
  { id: 'international_qualification', exposure: 'frontend' },
  { id: 'irish_leaving_certificate', exposure: 'internal' },
  { id: 'ukwpmed', exposure: 'internal' },
  { id: 'foundation', exposure: 'internal' },
  { id: 't_level', exposure: 'internal' },
  { id: 'mixed_t_level_a_level', exposure: 'internal' }
];
const FEE_STATUSES = ['home', 'rest_of_uk', 'international'];
const DOMICILES = ['england', 'scotland', 'wales', 'northern_ireland', 'other'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, relativePath), 'utf8'));
}

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function subject(subject_id, grade = '9') {
  return { subject_id, grade };
}

function routeModelPresent(course, route) {
  const post16 = course.stage_1_eligibility?.post_16 || {};
  if (route === 'a_level') {
    return Array.isArray(post16.a_level?.grade_requirements) &&
      post16.a_level.grade_requirements.length > 0;
  }
  if (route === 'international_baccalaureate') {
    return Array.isArray(post16.ib?.grade_requirements) &&
      post16.ib.grade_requirements.length > 0;
  }
  if (route === 'scottish') {
    return post16.scottish?.route_implemented === true;
  }
  if (route === 'btec') {
    return post16.btec?.status !== 'not_accepted_as_level_3_entry_route' &&
      Array.isArray(post16.btec?.accepted_combinations) &&
      post16.btec.accepted_combinations.length > 0;
  }
  if (route === 'access_to_he') {
    return post16.access_to_he?.status === 'official_source_verified_with_provider_gate';
  }
  if (route === 'graduate') {
    return Boolean(
      getGraduateCompensatoryPolicy(course) ||
      post16.degree?.degree_requirement ||
      post16.graduate?.degree_requirement ||
      post16.degree?.minimum_classification ||
      post16.graduate?.minimum_classification
    );
  }
  if (route === 'international_qualification') {
    return !Array.isArray(course.stage_1_eligibility?.unsupported_international_qualifications);
  }
  if (route === 'irish_leaving_certificate') {
    return Boolean(post16.irish?.leaving_certificate);
  }
  if (route === 'ukwpmed') {
    return (course.contextual_admissions?.guaranteed_interview_rules || [])
      .some((rule) => normaliseId(rule.route) === 'ukwpmed_guaranteed_interview');
  }
  return false;
}

function firstBtecCombination(course) {
  return course.stage_1_eligibility?.post_16?.btec?.accepted_combinations?.[0] || null;
}

function firstUkWpMedProgramme(course) {
  const rule = (course.contextual_admissions?.guaranteed_interview_rules || [])
    .find((candidate) => normaliseId(candidate.route) === 'ukwpmed_guaranteed_interview');
  return rule?.recognised_programmes?.[0] || 'UKWPMED';
}

function makeProfile({ route, feeStatus, domicile, course, entryYear }) {
  const courseCode = course.course?.ucas_code || 'A100';
  const btec = firstBtecCombination(course);
  const isGraduate = route === 'graduate';
  const isInternationalFee = feeStatus === 'international';
  const profile = {
    profile_id: `route_audit_${route}_${feeStatus}_${domicile}`,
    qualification_route: route,
    application_year: entryYear || 2027,
    applicant_identity: {
      applicant_type: isGraduate ? 'mature_graduate' : 'school_leaver',
      fee_status: feeStatus,
      domicile,
      date_of_birth: '2005-01-01',
      contextual: false,
      contextual_status_confirmed: true,
      contextual_flags: {
        plus_flag: false,
        flag: false,
        simd20: false,
        simd40: false,
        polar_quintile: null,
        imd_quintile: null,
        care_experienced: false,
        refugee: false,
        asylum_seeker: false,
        refugee_or_asylum_seeker: false,
        ucat_bursary: false,
        school_contextual_indicator: false,
        free_school_meals: false,
        first_generation_higher_education: false
      },
      graduate: isGraduate,
      resit: {
        has_resits: false,
        exceptional_circumstances_evidence: false,
        subjects_resat: []
      }
    },
    course_target: {
      discipline: 'medicine',
      ucas_code: courseCode,
      course_route: 'standard',
      entry_route: 'standard_medicine',
      qualification_route: route
    },
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
        subject('history'),
        subject('computer_science'),
        subject('french'),
        subject('geography'),
        subject('religious_studies')
      ],
      total_gcse_count: 11,
      top_8_gcse_grades: ['9', '9', '9', '9', '9', '9', '9', '9'],
      top_9_gcse_grades: ['9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9']
    },
    a_level_profile: {
      subjects: [
        { subject_id: 'chemistry', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'biology', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' },
        { subject_id: 'mathematics', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: null },
        { subject_id: 'physics', predicted_grade: 'A*', achieved_grade: null, sitting_status: 'first_sitting', practical_endorsement: 'pass' }
      ],
      sitting_status: 'first_sitting',
      completed_in_one_sitting: true,
      science_practical_endorsement: {
        biology: 'pass',
        chemistry: 'pass',
        physics: 'pass'
      }
    },
    scottish_profile: {
      national_5_subjects: [
        subject('english_language', 'A'),
        subject('mathematics', 'A'),
        subject('biology', 'A'),
        subject('chemistry', 'A'),
        subject('physics', 'A')
      ],
      higher_subjects: [
        subject('chemistry', 'A'),
        subject('biology', 'A'),
        subject('mathematics', 'A'),
        subject('physics', 'A'),
        subject('english_language', 'A')
      ],
      advanced_higher_subjects: [
        subject('chemistry', 'A'),
        subject('biology', 'A'),
        subject('mathematics', 'A')
      ]
    },
    ib_profile: {
      total_points: 45,
      higher_level_subjects: [
        subject('chemistry', '7'),
        subject('biology', '7'),
        subject('mathematics', '7')
      ],
      standard_level_subjects: [
        subject('english_language', '7'),
        subject('physics', '7'),
        subject('history', '7')
      ]
    },
    btec_profile: {
      qualification: btec?.btec_qualification || 'btec_level_3_extended_diploma',
      qualification_title: btec?.btec_qualification || 'btec_level_3_extended_diploma',
      grade: btec?.btec_grade || 'D*D*D*',
      subject_id: 'applied_science'
    },
    access_to_he_profile: {
      provider_approved_by_institution: true,
      requirements_met: true
    },
    access_to_medicine_profile: {
      provider_approved_by_institution: true,
      requirements_met: true
    },
    graduate_profile: {
      is_graduate: isGraduate,
      degree_classification: 'first',
      classification: 'first',
      degree_status: 'completed',
      recognised_institution: true,
      degree_age_at_course_start_years: 1,
      degree_subject: 'biomedical_science',
      science_degree: true,
      postgraduate_qualification: null
    },
    international_qualification: {
      name: 'verified_international_qualification',
      qualification: 'verified_international_qualification',
      equivalence_status: 'verified',
      verified_by_institution: true,
      requirements_met: true
    },
    english_language_profile: {
      test: 'ielts_academic',
      test_name: 'ielts_academic',
      exemption_claimed: false,
      overall: 9,
      reading: 9,
      writing: 9,
      listening: 9,
      speaking: 9,
      scores: { overall: 9, reading: 9, writing: 9, listening: 9, speaking: 9 },
      valid_at_course_start: true
    },
    admissions_tests: {
      ucat: {
        taken: true,
        total_score: 2670,
        score_scale: 2700,
        subtests: {
          verbal_reasoning: 890,
          decision_making: 890,
          quantitative_reasoning: 890
        },
        sjt_band: 1,
        test_year: 2026
      },
      gamsat: {
        taken: true,
        overall_score: 75,
        section_scores: [75, 75, 75]
      }
    },
    ukwpmed: {
      programme: firstUkWpMedProgramme(course),
      successfully_completed: true,
      declared_in_ucas_extra_activities: true
    },
    foundation_profile: {
      programme: 'foundation',
      requirements_met: true
    },
    t_level_profile: {
      subject_id: 'healthcare_science',
      grade: 'distinction_star',
      requirements_met: true
    }
  };

  if (!isInternationalFee) {
    profile.international_qualification.equivalence_status = 'verified';
  }

  return profile;
}

function evaluateDirect(university, course, config, profile) {
  if (university.id === 'nottingham-a100') {
    const result = evaluateNottinghamA100(course, profile, { interviewBandConfig: config });
    return {
      eligibility: result.eligibility,
      band: result.interview_band_guidance?.historical_comparison_performed === true
        ? result.interview_band_guidance.historical_comparison
        : 'insufficient_evidence',
      guidance_pool_id: result.interview_band_guidance?.guidance_group || null,
      manual_review_required: result.eligibility?.status === 'manual_review',
      warnings: [
        ...(result.interview_band_guidance?.messages || []),
        ...(result.interview_guidance?.messages || [])
      ]
    };
  }

  if (university.id === 'hull-york-a100') {
    const result = evaluateHullYorkA100(course, config, profile);
    return {
      eligibility: result.eligibility,
      band: result.canonical_interview_band || 'insufficient_evidence',
      guidance_pool_id: result.guidance_pool_id || null,
      manual_review_required: result.eligibility?.status === 'manual_review',
      warnings: result.warnings || []
    };
  }

  const result = classifyInterviewBand(course, config, profile);
  return {
    eligibility: result.eligibility,
    band: result.canonical_interview_band || result.interview_outcome || 'insufficient_evidence',
    guidance_pool_id: result.guidance_pool_id || null,
    manual_review_required: result.manual_review_required === true ||
      result.eligibility?.status === 'manual_review',
    warnings: result.warnings || []
  };
}

function reasonCodes(evaluation) {
  return [
    ...(evaluation.eligibility?.failures || []),
    ...(evaluation.eligibility?.manual_review_reasons || [])
  ].map(String);
}

function checkIds(evaluation) {
  return (evaluation.eligibility?.checks || [])
    .map((check) => String(check.check_id || check.check || check.requirement_id || ''));
}

function routeEvidencePresent(evaluation, route) {
  const evidenceText = [
    ...checkIds(evaluation),
    ...reasonCodes(evaluation)
  ].join(' ');
  const patterns = {
    a_level: /a_level/,
    international_baccalaureate: /international_baccalaureate|\bib\b/,
    scottish: /scottish|national_5|higher|advanced_higher/,
    btec: /btec/,
    access_to_he: /access/,
    graduate: /graduate|gamsat/,
    international_qualification: /international_qualification|international_equivalence/,
    irish_leaving_certificate: /irish|leaving_certificate/,
    ukwpmed: /ukwpmed/,
    foundation: /foundation/,
    t_level: /t_level/,
    mixed_t_level_a_level: /mixed_t_level_a_level/
  };

  return (patterns[route] || new RegExp(route)).test(evidenceText);
}

function classifySupport({ evaluation, modelPresent, route, routeEvaluated }) {
  const reasons = reasonCodes(evaluation);
  const reasonText = reasons.join(' ');
  const unsupportedReason = /unsupported|not_implemented|not_accepted|explicitly_blocked|_blocked|route_not_supported|qualification_route_explicitly_blocked|applicant_group_explicitly_blocked/.test(reasonText);

  if (unsupportedReason) {
    return 'unsupported';
  }
  if (!routeEvaluated && evaluation.eligibility?.status === 'eligible') {
    return 'unsupported';
  }
  if (!modelPresent && !routeEvaluated) {
    return 'unsupported';
  }
  if (evaluation.eligibility?.status === 'eligible' &&
      routeEvaluated === true &&
      evaluation.manual_review_required !== true &&
      evaluation.band &&
      evaluation.band !== 'insufficient_evidence') {
    return 'full';
  }
  if (evaluation.eligibility?.status === 'not_eligible' && !modelPresent) {
    return 'unsupported';
  }
  return 'partial';
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(';') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(rows, filePath) {
  const headers = [
    'university_id',
    'university',
    'course_code',
    'profile_engine_status',
    'fee_status',
    'domicile',
    'qualification_route',
    'route_exposure',
    'support_level',
    'route_model_present',
    'engine_route_evidence_present',
    'engine_eligibility_status',
    'result_band_or_guidance',
    'guidance_pool_id',
    'manual_review_required',
    'reason_codes',
    'warnings'
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function writeMarkdown(rows, universities, filePath) {
  const byUniversity = new Map();
  for (const row of rows) {
    if (!byUniversity.has(row.university_id)) {
      byUniversity.set(row.university_id, []);
    }
    byUniversity.get(row.university_id).push(row);
  }

  const callableCount = universities.filter(isProductionReady).length;
  const lines = [
    '# ApplySmart Applicant Route Support Audit',
    '',
    `Generated from every course profile in \`data/index.json\`. Production-ready rows are classified from actual engine evaluation output, not from index fee-status metadata. Non-production-ready profiles are marked unsupported because the public prediction engine rejects them before route evaluation.`,
    '',
    'Legend: `full` = route-specific engine evidence, automatic eligibility and a concrete interview guidance band; `partial` = route-specific eligibility/manual-review/guidance boundary is modelled but the engine withholds a complete automated recommendation; `unsupported` = route/group is explicitly unimplemented, blocked, not accepted, has no active route model, or only passed through unrelated fallback checks.',
    '',
    `Audited profiles: ${universities.length}. Engine-callable profiles: ${callableCount}. Non-production-ready profiles: ${universities.length - callableCount}. Fee statuses: ${FEE_STATUSES.join(', ')}. Domiciles: ${DOMICILES.join(', ')}. Routes: ${ROUTES.map((route) => route.id).join(', ')}.`,
    '',
    'Matrix cells: `F` = full, `P` = partial, `U` = unsupported. The CSV adds raw eligibility status, band/guidance, route-evidence flags, reason codes and warnings for each exact tuple.',
    ''
  ];

  for (const university of universities) {
    const universityRows = byUniversity.get(university.id) || [];
    const byTuple = new Map();
    for (const row of universityRows) {
      byTuple.set(
        `${row.fee_status}:${row.domicile}:${row.qualification_route}`,
        row
      );
    }
    const counts = universityRows.reduce((acc, row) => {
      acc[row.support_level] = (acc[row.support_level] || 0) + 1;
      return acc;
    }, {});
    lines.push(`## ${university.university_name} (${university.id})`);
    lines.push('');
    lines.push(`Engine status: ${isProductionReady(university) ? 'production_ready' : 'not_production_ready'}`);
    lines.push('');
    lines.push(`Totals: F ${counts.full || 0}, P ${counts.partial || 0}, U ${counts.unsupported || 0}`);
    lines.push('');
    lines.push(`| Fee status | Domicile | ${ROUTES.map((route) => route.id).join(' | ')} |`);
    lines.push(`|---|---|${ROUTES.map(() => '---').join('|')}|`);
    for (const feeStatus of FEE_STATUSES) {
      for (const domicile of DOMICILES) {
        const cells = ROUTES.map((route) => {
          const row = byTuple.get(`${feeStatus}:${domicile}:${route.id}`);
          if (row?.support_level === 'full') return 'F';
          if (row?.support_level === 'partial') return 'P';
          return 'U';
        });
        lines.push(`| ${feeStatus} | ${domicile} | ${cells.join(' | ')} |`);
      }
    }
    lines.push('');
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

function main() {
  const index = loadIndex(INDEX_PATH);
  const universities = index.universities;
  const rows = [];

  for (const university of universities) {
    const productionReady = isProductionReady(university);
    const course = productionReady ? readJson(university.json_file) : null;
    const config = productionReady ? readJson(university.interview_band_config_file) : null;
    const entryYear = university.entry_year || course?.course?.entry_year || 2027;
    for (const feeStatus of FEE_STATUSES) {
      for (const domicile of DOMICILES) {
        for (const route of ROUTES) {
          const modelPresent = productionReady ? routeModelPresent(course, route.id) : false;
          let evaluation;
          let error = null;
          if (!productionReady) {
            evaluation = {
              eligibility: {
                status: 'not_production_ready',
                failures: ['profile_not_production_ready'],
                manual_review_reasons: []
              },
              band: null,
              guidance_pool_id: null,
              manual_review_required: false,
              warnings: []
            };
          } else {
            const profile = makeProfile({
              route: route.id,
              feeStatus,
              domicile,
              course,
              entryYear
            });
            try {
              evaluation = evaluateDirect(university, course, config, profile);
            } catch (err) {
              error = err;
              evaluation = {
                eligibility: {
                  status: 'error',
                  failures: [`engine_error:${err.message}`],
                  manual_review_reasons: []
                },
                band: null,
                guidance_pool_id: null,
                manual_review_required: false,
                warnings: []
              };
            }
          }

          const routeEvaluated = routeEvidencePresent(evaluation, route.id);
          const supportLevel = !productionReady || error
            ? 'unsupported'
            : classifySupport({
              evaluation,
              modelPresent,
              route: route.id,
              routeEvaluated
            });
          rows.push({
            university_id: university.id,
            university: university.university_name,
            course_code: university.course_code,
            profile_engine_status: productionReady ? 'production_ready' : 'not_production_ready',
            fee_status: feeStatus,
            domicile,
            qualification_route: route.id,
            route_exposure: route.exposure,
            support_level: supportLevel,
            route_model_present: modelPresent,
            engine_route_evidence_present: routeEvaluated,
            engine_eligibility_status: evaluation.eligibility?.status || null,
            result_band_or_guidance: evaluation.band,
            guidance_pool_id: evaluation.guidance_pool_id,
            manual_review_required: evaluation.manual_review_required === true,
            reason_codes: reasonCodes(evaluation),
            warnings: evaluation.warnings || []
          });
        }
      }
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'applicant-route-support-matrix.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 2)}\n`
  );
  writeCsv(rows, path.join(OUTPUT_DIR, 'applicant-route-support-matrix.csv'));
  writeMarkdown(rows, universities, path.join(OUTPUT_DIR, 'applicant-route-support-audit.md'));

  const totals = rows.reduce((acc, row) => {
    acc[row.support_level] = (acc[row.support_level] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({
    profiles: universities.length,
    production_ready_profiles: universities.filter(isProductionReady).length,
    non_production_ready_profiles: universities.filter((university) => !isProductionReady(university)).length,
    rows: rows.length,
    totals,
    outputs: [
      'data/regression-results/applicant-route-support-matrix.csv',
      'data/regression-results/applicant-route-support-matrix.json',
      'data/regression-results/applicant-route-support-audit.md'
    ]
  }, null, 2));
}

main();
