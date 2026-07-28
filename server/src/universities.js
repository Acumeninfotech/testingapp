const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');

function loadIndex(indexPath = INDEX_PATH) {
  const raw = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(raw);
}

// Production gate: a profile is live only when the public assessment surface
// it exposes is ready. Interview-prediction courses require the full
// interview bundle; eligibility-only courses require explicit opt-in so a
// missing interview model cannot accidentally activate.
// `production_ready` alone is NOT sufficient - it does not by itself
// guarantee eligibility/result-card/band-config readiness.
const BASE_READINESS_FLAGS = [
  'activation_ready',
  'eligibility_ready',
  'result_card_ready'
];

const INTERVIEW_PREDICTION_READINESS_FLAGS = [
  ...BASE_READINESS_FLAGS,
  'interview_prediction_ready',
  'interview_band_config_ready'
];

const ELIGIBILITY_ONLY_READINESS_FLAGS = [
  ...BASE_READINESS_FLAGS,
  'eligibility_only_ready',
  'interview_band_config_ready'
];

function hasReadinessFlags(university, flags) {
  return flags.every((flag) => university[flag] === true);
}

function isEligibilityOnlyProfile(university) {
  return university?.assessment_mode === 'eligibility_only' ||
    university?.prediction_methodology === 'eligibility_only';
}

function isProductionReady(university) {
  if (isEligibilityOnlyProfile(university)) {
    return (
      hasReadinessFlags(university, ELIGIBILITY_ONLY_READINESS_FLAGS) &&
      university.interview_prediction_ready === false
    );
  }

  return hasReadinessFlags(university, INTERVIEW_PREDICTION_READINESS_FLAGS);
}

const APPROXIMATE_QUOTA_HINTS = [
  'historical',
  'estimate',
  'approx',
  'reference_only',
  'reference only',
  'not a future fixed capacity',
  'subject to',
  'expected',
  'planning figure',
  'not used as a probability',
  'not used as an exact runtime threshold'
];

function isApproximateQuota(entry) {
  const haystack = [
    entry.quota_type,
    entry.execution_role,
    entry.figure_type,
    entry.notes
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    entry.reference_only === true ||
    entry.estimate === true ||
    entry.current_cycle_executable === false ||
    APPROXIMATE_QUOTA_HINTS.some((hint) => haystack.includes(hint))
  );
}

function groupOfQuotaEntry(entry) {
  const groupIds = entry.applies_to_group_ids || entry.applicant_group_ids || [];
  const isInternational = /international|overseas/.test(
    [entry.fee_status, entry.applicant_pool, ...groupIds].filter(Boolean).join(' ').toLowerCase()
  );
  const isHome = /home|rest_of_uk|rest of uk|scotland_home/.test(
    [entry.fee_status, entry.applicant_pool, ...groupIds].filter(Boolean).join(' ').toLowerCase()
  );

  // A quota entry tagged with both home and international group ids (e.g. a
  // combined total-places figure) describes neither group individually.
  if (isInternational && isHome) return null;
  if (isInternational) return 'international';
  if (isHome) return 'home';

  // Fall back to the quota_id/name text only when structured group tags are
  // absent, since that text is more likely to describe a single title (e.g.
  // "international_places") rather than a combined figure.
  if (groupIds.length === 0) {
    const textHaystack = [entry.quota_id, entry.name].filter(Boolean).join(' ').toLowerCase();
    if (/international|overseas/.test(textHaystack)) return 'international';
    if (/home/.test(textHaystack)) return 'home';
  }

  return null;
}

// Some quota entries describe interview volume, planned offers, or a
// contextual-offer sub-allocation rather than the actual number of course
// places - only entries that read as a places/capacity figure are usable
// for a "places" display.
function isPlacesQuotaEntry(entry) {
  const haystack = [entry.quota_id, entry.name, entry.quota_type, entry.stage, entry.figure_type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/interview|offers?\b/.test(haystack)) return false;
  if (entry.stage && /interview|offer/.test(entry.stage)) return false;
  return true;
}

function numberFromQuotaEntry(entry) {
  const candidates = [entry.places, entry.value, entry.maximum_places];
  const numeric = candidates.find((v) => typeof v === 'number');
  return typeof numeric === 'number' ? numeric : null;
}

// Quota schemas vary per-university (different field names, some
// historical/approximate/reference-only) because each profile's `quotas`
// array was transcribed from that university's own published wording. This
// extracts a best-effort home/international place count and flags it as
// approximate rather than silently presenting an estimate as an exact figure.
function extractFromQuotas(quotas) {
  let homePlaces = null;
  let internationalPlaces = null;
  let homeApprox = false;
  let internationalApprox = false;

  for (const entry of quotas || []) {
    if (typeof entry.home_places === 'number' && homePlaces === null) {
      homePlaces = entry.home_places;
      homeApprox = isApproximateQuota(entry);
    }
    if (typeof entry.international_places === 'number' && internationalPlaces === null) {
      internationalPlaces = entry.international_places;
      internationalApprox = isApproximateQuota(entry);
    }

    if (entry.home_places === undefined && entry.international_places === undefined && isPlacesQuotaEntry(entry)) {
      const group = groupOfQuotaEntry(entry);
      const value = numberFromQuotaEntry(entry);
      if (group === 'home' && value !== null && homePlaces === null) {
        homePlaces = value;
        homeApprox = isApproximateQuota(entry);
      } else if (group === 'international' && value !== null && internationalPlaces === null) {
        internationalPlaces = value;
        internationalApprox = isApproximateQuota(entry);
      }
    }
  }

  return { homePlaces, internationalPlaces, approx: homeApprox || internationalApprox };
}

// applicant_pools carries per-pool `places_available` figures independently
// of `quotas` (e.g. Aberdeen, Dundee, Edinburgh only publish places here).
// Home-side pools can be split across multiple cohorts (e.g. Edinburgh's
// Scotland-domiciled + rest-of-UK pools), so home figures are summed while
// international is taken as-is (universities publish a single overseas
// figure, not per-subgroup).
function extractFromApplicantPools(pools) {
  let homePlaces = null;
  let internationalPlaces = null;

  for (const pool of pools || []) {
    if (typeof pool.places_available !== 'number') continue;
    const group = groupOfQuotaEntry({
      applies_to_group_ids: pool.applies_to_group_ids,
      quota_id: pool.pool_id,
      name: pool.name
    });
    if (group === 'home') {
      homePlaces = (homePlaces ?? 0) + pool.places_available;
    } else if (group === 'international' && internationalPlaces === null) {
      internationalPlaces = pool.places_available;
    }
  }

  return { homePlaces, internationalPlaces };
}

function extractPlaceCounts(profile) {
  const fromQuotas = extractFromQuotas(profile.quotas);
  const fromPools = extractFromApplicantPools(profile.applicant_pools);

  const homePlaces = fromQuotas.homePlaces ?? fromPools.homePlaces;
  const internationalPlaces = fromQuotas.internationalPlaces ?? fromPools.internationalPlaces;

  if (homePlaces === null && internationalPlaces === null) return {};

  return {
    home_places: homePlaces,
    international_places: internationalPlaces,
    places_approximate: fromQuotas.approx
  };
}

const REQUIREMENT_NOT_PUBLISHED = 'Not published';

const SUBJECT_LABELS = {
  biology: 'Biology',
  chemistry: 'Chemistry',
  english: 'English',
  english_language: 'English Language',
  mathematics: 'Mathematics',
  maths: 'Mathematics',
  further_mathematics: 'Further Mathematics',
  physics: 'Physics',
  human_biology: 'Human Biology',
  psychology: 'Psychology'
};

const NON_STANDARD_GROUP_HINTS = [
  'contextual',
  'widening',
  'graduate',
  'gateway',
  'access',
  'mature'
];

function sentenceLimit(text, maxLength = 260) {
  if (typeof text !== 'string') return null;
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1).trim()}...` : compact;
}

function humanize(value) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayText(value) {
  if (typeof value !== 'string') return null;
  const text = value.includes('_') || value === value.toLowerCase() ? humanize(value) : value;
  return text.replace(/\bMmi\b/gi, 'MMI');
}

function subjectLabel(subjectId) {
  return SUBJECT_LABELS[subjectId] || humanize(subjectId);
}

function joinNatural(items, conjunction = 'and') {
  const values = [...new Set((items || []).filter(Boolean))];
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`;
}

function gradeProfileText(profile) {
  if (Array.isArray(profile)) return profile.join('');
  if (typeof profile === 'number') return String(profile);
  return typeof profile === 'string' ? profile : null;
}

function isStandardApplicantRequirement(requirement) {
  const groups = requirement?.applies_to_group_ids || [];
  return !groups.some((group) => NON_STANDARD_GROUP_HINTS.some((hint) => String(group).includes(hint)));
}

function requirementSubjects(requirement) {
  const ids = requirement.subject_ids || requirement.required_subject_ids ||
    (requirement.subject_id ? [requirement.subject_id] : []);
  return ids.map(subjectLabel);
}

function requirementGradeSummary(requirements, options = {}) {
  const byGrade = new Map();
  for (const requirement of requirements || []) {
    if (options.qualificationLevelExcludes?.some((level) => String(requirement.qualification_level || '').includes(level))) {
      continue;
    }
    const grade = requirement.minimum_grade || requirement.grade || requirement.minimum;
    const subjects = requirementSubjects(requirement);
    if (!grade || subjects.length === 0) continue;
    const existing = byGrade.get(grade) || [];
    byGrade.set(grade, [...existing, ...subjects]);
  }

  return [...byGrade.entries()]
    .map(([grade, subjects]) => `${joinNatural(subjects)} at ${grade}`)
    .join('; ');
}

function groupText(group) {
  const subjects = (group.subject_ids || []).map(subjectLabel);
  if (subjects.length === 0) return null;
  const count = group.minimum_required || 1;
  const prefix = count === 1 ? 'one of' : `${count} of`;
  return `${prefix} ${joinNatural(subjects, 'or')}`;
}

function subjectOptionsText(options) {
  const sets = (options || [])
    .map((option) => (option.grade_requirements || []).map((requirement) => requirement.subject_id).filter(Boolean))
    .filter((subjects) => subjects.length > 0);
  if (sets.length === 0) return null;

  const common = sets[0].filter((subject) => sets.every((subjects) => subjects.includes(subject)));
  const alternatives = [...new Set(sets.flat().filter((subject) => !common.includes(subject)))];
  const parts = [];
  if (common.length > 0) parts.push(joinNatural(common.map(subjectLabel)));
  if (alternatives.length > 0) parts.push(`one of ${joinNatural(alternatives.map(subjectLabel), 'or')}`);
  return parts.join(' and ');
}

function subjectPatternText(...sources) {
  const required = [];
  const groups = [];
  let optionsText = null;

  for (const source of sources.filter(Boolean)) {
    if (required.length === 0) {
      required.push(...(source.required_subject_ids || source.required_hl_subject_ids || []).map(subjectLabel));
    }
    if (!optionsText) {
      optionsText = subjectOptionsText(source.required_subject_grade_options || source.required_hl_subject_grade_options);
    }
    groups.push(...(source.one_of_subject_groups || source.one_of_hl_subject_groups || []).map(groupText));
    if (source.required_subject_group) groups.push(groupText(source.required_subject_group));
    if (source.second_subject_group) groups.push(groupText(source.second_subject_group));
    if (source.second_hl_subject_group) groups.push(groupText(source.second_hl_subject_group));
  }

  const parts = [];
  if (required.length > 0) parts.push(joinNatural(required));
  if (optionsText) parts.push(optionsText);
  parts.push(...groups.filter(Boolean));
  return joinNatural(parts);
}

function publicGcseRequirement(stage1) {
  const gcse = stage1?.gcse;
  if (!gcse) return REQUIREMENT_NOT_PUBLISHED;

  const standardGradeRequirements = (gcse.grade_requirements || [])
    .filter(isStandardApplicantRequirement);
  const gradeSummary = requirementGradeSummary(standardGradeRequirements, {
    qualificationLevelExcludes: ['national_5']
  });
  const parts = [];

  if (typeof gcse.minimum_count === 'number') parts.push(`${gcse.minimum_count} GCSEs`);
  if (gradeSummary) {
    parts.push(gradeSummary);
  } else if ((gcse.mandatory_subject_ids || []).length > 0) {
    parts.push(`Includes ${joinNatural(gcse.mandatory_subject_ids.map(subjectLabel))}`);
  }
  if (gcse.science_requirement?.requirement_type === 'none') {
    parts.push('No GCSE science requirement published');
  }

  return sentenceLimit(parts.join('; ')) || sentenceLimit(gcse.notes) || REQUIREMENT_NOT_PUBLISHED;
}

function publicALevelRequirement(post16) {
  const aLevel = post16?.a_level || post16?.a_levels;
  if (!aLevel) return REQUIREMENT_NOT_PUBLISHED;

  const standardOffer = aLevel.standard_offer ||
    (aLevel.grade_requirements || []).find(isStandardApplicantRequirement);
  const gradeText = gradeProfileText(standardOffer?.grade_profile || aLevel.grade_profile);
  const subjectsText = subjectPatternText(standardOffer, aLevel);
  const parts = [];
  if (gradeText) parts.push(gradeText);
  if (subjectsText) parts.push(`including ${subjectsText}`);

  return sentenceLimit(parts.join(' ')) ||
    sentenceLimit(standardOffer?.notes) ||
    sentenceLimit(aLevel.notes) ||
    REQUIREMENT_NOT_PUBLISHED;
}

function publicIbRequirement(post16) {
  const ib = post16?.ib;
  if (!ib) return REQUIREMENT_NOT_PUBLISHED;

  const standardOffer = ib.standard_offer ||
    (ib.grade_requirements || []).find(isStandardApplicantRequirement);
  if (standardOffer) {
    const total = standardOffer.total_points || ib.total_points;
    const hlText = gradeProfileText(standardOffer.hl_grade_profile) ||
      gradeProfileText(standardOffer.hl_points || ib.hl_points);
    const subjectsText = subjectPatternText(standardOffer, ib);
    const parts = [];
    if (total) parts.push(`${total} points`);
    if (hlText) parts.push(`with ${hlText} at HL`);
    if (subjectsText) parts.push(`including HL ${subjectsText}`);
    const summary = parts.join(' ');
    if (summary) return sentenceLimit(summary);
  }

  if ((ib.routes || []).length > 0) {
    const routes = ib.routes
      .slice(0, 2)
      .map((route) => {
        const total = route.total_points ? `${route.total_points} points` : null;
        const hlText = gradeProfileText(route.hl_grade_profile);
        return [total, hlText ? `with ${hlText} at HL` : null].filter(Boolean).join(' ');
      })
      .filter(Boolean);
    if (routes.length > 0) return sentenceLimit(routes.join(' or '));
  }

  return sentenceLimit(ib.notes) || REQUIREMENT_NOT_PUBLISHED;
}

function publicScottishRequirement(post16) {
  const scottish = post16?.scottish;
  if (!scottish) return REQUIREMENT_NOT_PUBLISHED;

  const parts = [];
  const higherText = gradeProfileText(scottish.higher_offer?.grade_profile);
  const advancedText = gradeProfileText(
    scottish.advanced_higher_offer?.grade_profile ||
    scottish.advanced_higher_offer?.advanced_higher_science_profile
  );
  if (scottish.highers_alone_accepted === false) parts.push('Highers alone not accepted');
  if (higherText) parts.push(`Highers ${higherText}`);
  if (advancedText) parts.push(`Advanced Highers ${advancedText}`);

  const subjectsText = subjectPatternText(scottish.advanced_higher_offer, scottish);
  if (subjectsText) parts.push(`including ${subjectsText}`);

  const national5 = requirementGradeSummary(scottish.national_5_requirements || []);
  if (national5) parts.push(`National 5 ${national5}`);

  return sentenceLimit(parts.join('; ')) || sentenceLimit(scottish.notes) || REQUIREMENT_NOT_PUBLISHED;
}

function publicAcademicRequirements(profile) {
  const stage1 = profile.stage_1_eligibility || {};
  const post16 = stage1.post_16 || {};
  return {
    gcse: publicGcseRequirement(stage1),
    a_level: publicALevelRequirement(post16),
    scottish: publicScottishRequirement(post16),
    ib: publicIbRequirement(post16)
  };
}

function contextualAdjustmentFor(contextualAdmissions, qualification) {
  return (contextualAdmissions?.academic_adjustments || []).find((adjustment) => {
    const rawQualification = String(adjustment.qualification || '').toLowerCase();
    return rawQualification === qualification || rawQualification.replace(/-/g, '_') === qualification;
  });
}

function contextualALevelRequirement(post16, contextualAdmissions) {
  const aLevel = post16?.a_level || post16?.a_levels;
  const adjustment = contextualAdjustmentFor(contextualAdmissions, 'a_level');
  if (adjustment?.contextual_offer) return sentenceLimit(adjustment.contextual_offer);
  if (!aLevel?.contextual_offer) return null;

  const gradeText = gradeProfileText(aLevel.contextual_offer.grade_profile);
  const subjectsText = subjectPatternText(aLevel.contextual_offer, aLevel);
  const parts = [];
  if (gradeText) parts.push(gradeText);
  if (subjectsText) parts.push(`including ${subjectsText}`);

  return sentenceLimit(parts.join(' ')) ||
    sentenceLimit(aLevel.contextual_offer.notes) ||
    null;
}

function contextualIbRequirement(post16, contextualAdmissions) {
  const ib = post16?.ib;
  const adjustment = contextualAdjustmentFor(contextualAdmissions, 'ib');
  if (adjustment?.contextual_offer) return sentenceLimit(adjustment.contextual_offer);
  if (!ib?.contextual_offer) return null;

  const offer = ib.contextual_offer;
  const total = offer.total_points || ib.total_points;
  const hlText = gradeProfileText(offer.hl_grade_profile) ||
    gradeProfileText(offer.hl_points || ib.hl_points);
  const subjectsText = subjectPatternText(offer, ib);
  const parts = [];
  if (total) parts.push(`${total} points`);
  if (hlText) parts.push(`with ${hlText} at HL`);
  if (subjectsText) parts.push(`including HL ${subjectsText}`);

  return sentenceLimit(parts.join(' ')) ||
    sentenceLimit(offer.notes) ||
    null;
}

function publicContextualSupport(profile) {
  const contextualAdmissions = profile.contextual_admissions;
  if (!contextualAdmissions) return null;

  const stage1 = profile.stage_1_eligibility || {};
  const post16 = stage1.post_16 || {};
  const academicAdjustments = contextualAdmissions.academic_adjustments || [];
  const gcseAdjustment = contextualAdjustmentFor(contextualAdmissions, 'gcse');
  const scottishAdjustment = academicAdjustments.find((adjustment) => {
    const qualification = String(adjustment.qualification || '').toLowerCase();
    return qualification.includes('scottish') || qualification.includes('higher');
  });
  const criteria = (contextualAdmissions.criteria || [])
    .map((criterion) => sentenceLimit(criterion.description, 120))
    .filter(Boolean);

  return {
    available: contextualAdmissions.available === true,
    a_level: contextualALevelRequirement(post16, contextualAdmissions),
    gcse: gcseAdjustment?.contextual_offer ? sentenceLimit(gcseAdjustment.contextual_offer) : null,
    scottish: scottishAdjustment?.contextual_offer ? sentenceLimit(scottishAdjustment.contextual_offer) : null,
    ib: contextualIbRequirement(post16, contextualAdmissions),
    criteria_summary: criteria.length > 0
      ? `${criteria.slice(0, 2).join('; ')}${criteria.length > 2 ? '; other published criteria may also apply' : ''}`
      : null,
    note: sentenceLimit(contextualAdmissions.notes) ||
      "Contextual support depends on the university's published eligibility criteria."
  };
}

function publicInterviewFormat(profile) {
  const format = profile.stage_2_interview_selection?.interview_format ||
    profile.offer_selection?.interview_format;
  if (!format) return 'Published interview format not specified.';
  if (typeof format === 'string') return publicInterviewFormatText(format);

  const rawType = format.format || format.type || format.format_type;
  const routeSpecificFormats = [
    ['Home applicants', format.home || format.home_format],
    ['International applicants', format.international || format.international_format]
  ]
    .map(([label, value]) => {
      const text = publicInterviewFormatText(value);
      return text && text !== 'Published interview format not specified.' ? `${label}: ${text}` : null;
    })
    .filter(Boolean);
  if (!rawType && routeSpecificFormats.length > 0) return sentenceLimit(routeSpecificFormats.join('; '));

  const isMmi = format.is_mmi === true || /mmi|multiple_mini/.test(String(rawType || '').toLowerCase());
  const type = isMmi ? 'MMI (Multiple Mini Interviews)' : publicInterviewFormatText(rawType);
  const stationCount = format.station_count || format.stations;
  const stationText = typeof stationCount === 'number'
    ? `${stationCount} stations`
    : stationCount?.minimum && stationCount?.maximum
      ? `${stationCount.minimum}-${stationCount.maximum} stations`
      : null;
  const stationDuration = format.station_duration_minutes;
  const duration = displayText(format.duration) || format.expected_timing || format.timing;
  const delivery = format.delivery_mode_2027_plan || format.delivery || format.home_delivery;
  const deliveryText = typeof delivery === 'string'
    ? publicInterviewFormatText(delivery)
    : delivery && typeof delivery === 'object'
      ? joinNatural(Object.values(delivery).map(publicInterviewFormatText).filter(Boolean))
      : null;
  const parts = [
    type,
    stationText,
    stationDuration ? `${stationDuration} minutes per station` : null,
    typeof duration === 'string' ? duration : null,
    deliveryText
  ].filter(Boolean);

  return sentenceLimit(parts.join('; ')) || 'Published interview format not specified.';
}

function publicInterviewFormatText(value) {
  if (typeof value !== 'string') return null;
  const compact = sentenceLimit(value);
  if (!compact) return null;

  const lower = compact.toLowerCase();
  if (lower === 'not_modelled' || lower === 'not modelled' || lower === 'not published') {
    return 'Published interview format not specified.';
  }
  if (lower === 'interview') return 'Published interview format not specified.';

  if (lower === 'panel') return 'Panel Interview';

  const readable = displayText(compact) || compact;
  return readable
    .replace(/\bMultiple Mini Interviews?\b/gi, 'MMI (Multiple Mini Interviews)')
    .replace(/\bMultiple Mini Assessment\b/gi, 'Multiple Mini Assessment')
    .replace(/\bMMI\b(?!\s*\()/g, 'MMI (Multiple Mini Interviews)')
    .replace(/\bIn Person\b/g, 'In-person')
    .replace(/\bFace To Face\b/g, 'face-to-face')
    .replace(/\bQmul\b/g, 'QMUL');
}

function readCourseDetails(university, indexPath) {
  if (!university.json_file) return {};
  try {
    const profilePath = path.join(path.dirname(indexPath), university.json_file);
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const config = university.interview_band_config_file
      ? JSON.parse(fs.readFileSync(path.join(path.dirname(indexPath), university.interview_band_config_file), 'utf8'))
      : null;
    return {
      location: profile.course?.location || null,
      duration_years: profile.course?.duration_years ?? null,
      sjt_policy: publicSjtPolicy(profile, config),
      academic_requirements: publicAcademicRequirements(profile),
      contextual_support: publicContextualSupport(profile),
      interview_format: publicInterviewFormat(profile),
      ...extractPlaceCounts(profile)
    };
  } catch {
    return { location: null, duration_years: null };
  }
}

function bandListText(bands) {
  const values = [...new Set((bands || []).filter((band) => band !== null && band !== undefined))]
    .sort((a, b) => Number(a) - Number(b));
  if (values.length === 0) return null;
  return `Band${values.length === 1 ? '' : 's'} ${values.join(', ')}`;
}

function publicSjtPolicy(profile, config) {
  const policy =
    profile.stage_2_interview_selection?.sjt ||
    profile.stage_1_eligibility?.admissions_tests?.sjt ||
    profile.stage_2_interview_selection?.international_selection?.sjt ||
    config?.eligibility?.sjt ||
    config?.sjt_policy ||
    null;
  if (!policy) {
    return {
      role: 'Not published',
      accepted_bands_text: null,
      rejected_bands_text: null,
      summary: 'SJT policy not published'
    };
  }

  const acceptedBands =
    policy.accepted_bands ||
    policy.accepted_pre_interview_bands ||
    (policy.band_4_automatic_rejection === false ? [1, 2, 3, 4] : null);
  const rejectedBands =
    policy.excluded_bands ||
    policy.rejected_bands ||
    (policy.band_4_automatic_rejection === true || policy.band_4_policy === 'automatic_rejection' ? [4] : []);
  const acceptedText = bandListText(acceptedBands);
  const rejectedText = bandListText(rejectedBands);
  const scoring = policy.scoring || {};
  const usedInScore =
    scoring.used_in_score === true ||
    scoring.points_by_band ||
    policy.points_by_band ||
    policy.used_for_interview_selection === true;
  const usedAsGate =
    policy.used_as_gate === true ||
    policy.used_for_eligibility === true ||
    rejectedBands.length > 0;
  const role = usedInScore
    ? 'Scored'
    : usedAsGate
      ? 'Gate'
      : policy.used === false || policy.band_4_policy === 'not_used' || policy.used_for_interview_selection === false
        ? 'Not used'
        : 'Published policy';
  const details = [
    acceptedText ? `Accepted: ${acceptedText}` : null,
    rejectedText ? `Rejected: ${rejectedText}` : null
  ].filter(Boolean);
  return {
    role,
    accepted_bands_text: acceptedText,
    rejected_bands_text: rejectedText,
    summary: details.length ? details.join('. ') : (policy.notes || policy.instruction || `${role} in the published selection process.`)
  };
}

const SELECTION_STYLE_BY_MODEL = {
  academic_plus_ucat_weighting: {
    key: 'academic_ucat_score',
    label: 'Academic + UCAT score',
    summary: 'Uses academic achievement and UCAT performance together for interview selection.'
  },
  academic_plus_ucat_weighting_with_international_ucat_only_pool: {
    key: 'academic_ucat_score',
    label: 'Academic + UCAT score',
    summary: 'Uses academic achievement and UCAT performance, with a separate UCAT-only international pool.'
  },
  contextual_adjusted_ranking: {
    key: 'ucat_contextual',
    label: 'Contextual UCAT ranking',
    summary: 'Ranks by UCAT with contextual or widening-participation adjustments where verified.'
  },
  dual_model_points_system: {
    key: 'points_system',
    label: 'Points-based selection',
    summary: 'Uses a points model with route-specific handling for applicant groups.'
  },
  eligibility_only: {
    key: 'eligibility_only',
    label: 'Eligibility only',
    summary: 'ApplySmart checks published entry requirements but does not provide interview competitiveness guidance.'
  },
  gcse_ucat_sjt_points_ranking: {
    key: 'gcse_ucat_sjt_score',
    label: 'GCSE + UCAT + SJT score',
    summary: 'Combines GCSE, UCAT and SJT scoring before interview guidance.'
  },
  graduate_entry: {
    key: 'graduate_entry',
    label: 'Graduate route',
    summary: 'Uses graduate-entry evidence or graduate-specific applicant routing.'
  },
  holistic_review: {
    key: 'holistic_review',
    label: 'Holistic review',
    summary: 'Uses a broader review process after published academic and admissions-test checks.'
  },
  hybrid_eligibility_ucat_sjt_ist_shortlisting: {
    key: 'hybrid_shortlisting',
    label: 'Hybrid shortlisting',
    summary: 'Combines eligibility gates with admissions-test and shortlisting evidence.'
  },
  points_system: {
    key: 'points_system',
    label: 'Points-based selection',
    summary: 'Uses a scored selection model before interview guidance.'
  },
  threshold_gate_with_contextual_ranking_prediction_unavailable: {
    key: 'threshold_contextual',
    label: 'Threshold + contextual ranking',
    summary: 'Applies published thresholds and contextual ranking where verified evidence supports it.'
  },
  ucat_cutoff: {
    key: 'ucat_threshold',
    label: 'UCAT threshold',
    summary: 'Applies a UCAT threshold or minimum before further selection.'
  },
  ucat_ranking: {
    key: 'ucat_ranking',
    label: 'UCAT ranking',
    summary: 'Ranks eligible applicants primarily by UCAT performance.'
  },
  ucat_ranking_with_percentage_uplifts: {
    key: 'ucat_contextual',
    label: 'UCAT ranking with uplifts',
    summary: 'Ranks by UCAT with verified percentage uplifts for eligible applicant groups.'
  }
};

function publicSelectionStyle(university) {
  return SELECTION_STYLE_BY_MODEL[university.selection_model] || {
    key: 'other',
    label: 'Published selection process',
    summary: 'ApplySmart uses the published admissions process and available verified evidence.'
  };
}

function supportedRouteTags(university) {
  const tags = [];
  if (university.has_contextual_admissions) tags.push('contextual');
  if (university.has_graduate_entry) tags.push('graduate');
  if (university.has_gateway_course) tags.push('gateway');
  if ((university.fee_status || []).includes('international')) tags.push('international');
  return tags;
}

function getProductionReadyUniversities(indexPath = INDEX_PATH) {
  const index = loadIndex(indexPath);
  return index.universities
    .filter(isProductionReady)
    .map((university) => {
      const selectionStyle = publicSelectionStyle(university);
      return {
        id: university.id,
        university_name: university.university_name,
        course_code: university.course_code,
        course_name: university.course_name,
        entry_route: university.entry_route,
        country: university.country,
        fee_status: university.fee_status,
        entry_year: university.entry_year,
        intake_month: university.intake_month || null,
        uses_ucat: university.uses_ucat === true,
        assessment_mode: university.assessment_mode || 'interview_prediction',
        interview_prediction_available: university.interview_prediction_ready === true,
        institution_funding_type: university.institution_funding_type || null,
        selection_style: selectionStyle,
        supported_route_tags: supportedRouteTags(university),
        has_contextual_admissions: university.has_contextual_admissions === true,
        has_graduate_entry: university.has_graduate_entry === true,
        has_gateway_course: university.has_gateway_course === true,
        ...readCourseDetails(university, indexPath)
      };
    });
}

module.exports = {
  loadIndex,
  isProductionReady,
  getProductionReadyUniversities,
  READINESS_FLAGS: INTERVIEW_PREDICTION_READINESS_FLAGS,
  BASE_READINESS_FLAGS,
  INTERVIEW_PREDICTION_READINESS_FLAGS,
  ELIGIBILITY_ONLY_READINESS_FLAGS,
  INDEX_PATH
};
