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

function readCourseDetails(university, indexPath) {
  if (!university.json_file) return {};
  try {
    const profilePath = path.join(path.dirname(indexPath), university.json_file);
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    return {
      location: profile.course?.location || null,
      duration_years: profile.course?.duration_years ?? null,
      ...extractPlaceCounts(profile)
    };
  } catch {
    return { location: null, duration_years: null };
  }
}

function getProductionReadyUniversities(indexPath = INDEX_PATH) {
  const index = loadIndex(indexPath);
  return index.universities
    .filter(isProductionReady)
    .map((university) => ({
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
      ...readCourseDetails(university, indexPath)
    }));
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
