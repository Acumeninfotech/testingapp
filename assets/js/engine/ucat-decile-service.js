const fs = require('fs');
const path = require('path');

const EVIDENCE_LABEL = 'derived_from_official_ucat_consortium_statistics';
const UNIVERSITY_HISTORICAL_EVIDENCE_LABEL = 'historical_university_admissions_statistics_estimate';
const ENGINE_DERIVED_FLAGS = [
  'engine_derived',
  'not_university_published',
  'not_official_university_prediction'
];
const UNIVERSITY_HISTORICAL_FLAGS = [
  'historical_estimate',
  'not_current_cycle_live_deciles',
  'not_national_ucat_deciles'
];

function loadUcatDecileData(filePath = path.resolve(__dirname, '../../../data/ucat-deciles.json')) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ordinalToDecile(value) {
  if (value === 'below') {
    return 1;
  }

  if (value === 'above') {
    return 10;
  }

  const match = /^(\d+)/.exec(value);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function getBandDecile(bandId) {
  if (bandId.startsWith('below_')) {
    return 1;
  }

  if (bandId.startsWith('above_')) {
    return 10;
  }

  const [firstToken] = bandId.split('_to_');
  const lowerBoundaryDecile = ordinalToDecile(firstToken);
  return lowerBoundaryDecile === null ? null : lowerBoundaryDecile + 1;
}

function deriveNationalUcatDecile(rawScore, decileData = loadUcatDecileData()) {
  const score = Number(rawScore);
  const scale = decileData.score_scale;

  if (!Number.isFinite(score)) {
    throw new TypeError('UCAT raw score must be a finite number.');
  }

  if (!scale || scale.cognitive_total_max !== 2700) {
    throw new Error('UCAT decile data must use the 2700 cognitive score scale.');
  }

  if (score < scale.cognitive_total_min || score > scale.cognitive_total_max) {
    throw new RangeError(
      `UCAT raw score must be between ${scale.cognitive_total_min} and ${scale.cognitive_total_max}.`
    );
  }

  const bands = decileData.derived_decile_bands || {};
  const bandEntry = Object.entries(bands).find(([, band]) => score >= band.min && score <= band.max);

  if (!bandEntry) {
    throw new Error(`No UCAT decile band found for raw score ${score}.`);
  }

  const [decileBand] = bandEntry;
  const nationalDecile = getBandDecile(decileBand);

  if (!nationalDecile) {
    throw new Error(`Unable to derive national decile from band "${decileBand}".`);
  }

  return {
    raw_score: score,
    score_scale: scale.cognitive_total_max,
    national_decile: nationalDecile,
    decile_band: decileBand,
    evidence_label: EVIDENCE_LABEL,
    flags: [...ENGINE_DERIVED_FLAGS]
  };
}

function mapDecileToPoints(nationalDecile, decilePointRows) {
  if (!Array.isArray(decilePointRows)) {
    throw new TypeError('Decile point rows must be an array.');
  }

  const row = decilePointRows.find((entry) => {
    return Array.isArray(entry.deciles) && entry.deciles.includes(nationalDecile);
  });

  if (!row) {
    return {
      available: false,
      points: null,
      national_decile: nationalDecile,
      evidence_label: EVIDENCE_LABEL,
      flags: [...ENGINE_DERIVED_FLAGS]
    };
  }

  return {
    available: true,
    points: row.points,
    national_decile: nationalDecile,
    evidence_label: EVIDENCE_LABEL,
    flags: [...ENGINE_DERIVED_FLAGS]
  };
}

function parseBandRange(rangeText) {
  const text = String(rangeText || '').trim();

  if (/^<=/.test(text)) {
    const max = Number(text.replace(/^<=\s*/, ''));
    return Number.isFinite(max) ? { min: 0, max } : null;
  }

  const [minText, maxText] = text.split('-');
  const min = Number(minText);
  const max = Number(maxText);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  return { min, max };
}

function deriveUniversityHistoricalDecile(profileId, rawScore, decileData = loadUcatDecileData()) {
  const score = Number(rawScore);
  const universityDecileData = decileData.university_specific_deciles?.[profileId];

  if (!universityDecileData) {
    return {
      available: false,
      raw_score: score,
      decile: null,
      evidence_label: UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
      flags: [...UNIVERSITY_HISTORICAL_FLAGS, 'university_specific_deciles_not_available']
    };
  }

  if (!Number.isFinite(score)) {
    throw new TypeError('UCAT raw score must be a finite number.');
  }

  const bands = universityDecileData.decile_bands_2700 || {};
  const matched = Object.entries(bands).find(([, rangeText]) => {
    const range = parseBandRange(rangeText);
    return range && score >= range.min && score <= range.max;
  });

  if (!matched) {
    return {
      available: false,
      raw_score: score,
      decile: null,
      source_year: universityDecileData.source_year,
      evidence_label: UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
      flags: [...UNIVERSITY_HISTORICAL_FLAGS, 'score_not_in_historical_decile_band']
    };
  }

  const [decile, rangeText] = matched;

  return {
    available: true,
    raw_score: score,
    decile: Number(decile),
    decile_band: rangeText,
    source_year: universityDecileData.source_year,
    university: universityDecileData.university,
    course: universityDecileData.course,
    prediction_basis: universityDecileData.prediction_basis,
    evidence_label: UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
    disclaimer: 'UCAT decile estimated using latest published Edinburgh 2025 admissions statistics, not current live applicant pool.',
    flags: [...UNIVERSITY_HISTORICAL_FLAGS]
  };
}

function resolveUcatDecile(rawScore, options = {}) {
  const decileData = options.decileData || loadUcatDecileData();
  const profileId = options.courseProfileId || options.profileId || null;
  const universityDecileData =
    options.universityDecileData ||
    decileData.university_specific_deciles?.[profileId] ||
    null;

  if (universityDecileData) {
    try {
      const scopedData = {
        university_specific_deciles: {
          [profileId || 'university-specific']: universityDecileData
        }
      };
      const universityResult = deriveUniversityHistoricalDecile(
        profileId || 'university-specific',
        rawScore,
        scopedData
      );

      if (universityResult.available) {
        return {
          ...universityResult,
          national_decile: universityResult.decile,
          lookup_source: 'university_specific',
          available: true
        };
      }
    } catch {
      // Fall through to the global table when the university table is unusable.
    }
  }

  try {
    return {
      ...deriveNationalUcatDecile(rawScore, decileData),
      lookup_source: 'global_ucat_decile_json',
      available: true
    };
  } catch (error) {
    return {
      available: false,
      raw_score: Number(rawScore),
      national_decile: null,
      lookup_source: null,
      reason: 'usable_ucat_decile_data_unavailable',
      error_code: error.name
    };
  }
}

module.exports = {
  EVIDENCE_LABEL,
  ENGINE_DERIVED_FLAGS,
  UNIVERSITY_HISTORICAL_EVIDENCE_LABEL,
  UNIVERSITY_HISTORICAL_FLAGS,
  deriveNationalUcatDecile,
  deriveUniversityHistoricalDecile,
  loadUcatDecileData,
  mapDecileToPoints,
  resolveUcatDecile
};
