const fs = require('fs');
const path = require('path');

const DEFAULT_LIST_PATH = path.resolve(
  __dirname,
  '../../../data/contextual/bristol/aspiring-state-schools/assc-lists.normalized.json'
);

let cachedDataset = null;
let cachedListPath = null;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normaliseIdentifier(value) {
  return String(value ?? '').trim();
}

function normaliseName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseIdentifierType(value) {
  const normalised = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (['apply_centre_code', 'urn', 'ukprn', 'other'].includes(normalised)) return normalised;
  return '';
}

function loadBristolAspiringStateSchoolDataset(filePath = DEFAULT_LIST_PATH) {
  if (cachedDataset && cachedListPath === filePath) return cachedDataset;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }

  if (!parsed || parsed.schema_version !== 1 || !Array.isArray(parsed.application_cycles)) {
    return null;
  }

  cachedDataset = parsed;
  cachedListPath = filePath;
  return cachedDataset;
}

function mapCycleRecords(cycle = {}) {
  const byApplyCentreCode = new Map();
  const bySchoolName = new Map();

  for (const record of asArray(cycle.records)) {
    const code = normaliseIdentifier(record.apply_centre_code);
    const name = normaliseName(record.school_name);

    if (code) {
      const matches = byApplyCentreCode.get(code) || [];
      matches.push(record);
      byApplyCentreCode.set(code, matches);
    }
    if (name) {
      const matches = bySchoolName.get(name) || [];
      matches.push(record);
      bySchoolName.set(name, matches);
    }
  }

  return {
    ...cycle,
    byApplyCentreCode,
    bySchoolName
  };
}

function cycleForApplicationYear(dataset, applicationYear) {
  if (!dataset) return null;
  const targetYear = Number(applicationYear);
  if (!Number.isInteger(targetYear)) return null;

  const cycle = asArray(dataset.application_cycles).find((entry) => Number(entry.application_cycle_year) === targetYear);
  return cycle ? mapCycleRecords(cycle) : null;
}

function hasConfirmedStatus(records = []) {
  return records.some((record) => normaliseIdentifier(record.status) === 'confirmed');
}

function hasAwaitingConfirmationStatus(records = []) {
  return records.some((record) => normaliseIdentifier(record.status) === 'awaiting_confirmation');
}

function verifyBristolAspiringSchool({
  applicationYear,
  schoolIdentifier,
  schoolIdentifierType,
  schoolName
} = {}) {
  const dataset = loadBristolAspiringStateSchoolDataset();
  if (!dataset) {
    return {
      status: 'list_unavailable'
    };
  }

  const cycle = cycleForApplicationYear(dataset, applicationYear);
  if (!cycle) {
    return {
      status: 'cycle_unavailable',
      application_cycle_year: Number.isInteger(Number(applicationYear)) ? Number(applicationYear) : null
    };
  }

  const identifier = normaliseIdentifier(schoolIdentifier);
  const identifierType = normaliseIdentifierType(schoolIdentifierType);
  const canonicalName = normaliseName(schoolName);

  if (identifier) {
    const treatAsApplyCentreCode = identifierType === 'apply_centre_code' ||
      (!identifierType && /^[0-9]+$/.test(identifier));
    if (treatAsApplyCentreCode) {
      const matches = cycle.byApplyCentreCode.get(identifier) || [];
      if (matches.length === 0) {
        return {
          status: 'not_matched',
          match_method: 'apply_centre_code',
          application_cycle_year: cycle.application_cycle_year,
          source_file: cycle.source_file
        };
      }
      if (hasConfirmedStatus(matches)) {
        return {
          status: 'matched_confirmed',
          match_method: 'apply_centre_code',
          application_cycle_year: cycle.application_cycle_year,
          source_file: cycle.source_file,
          matches
        };
      }
      if (hasAwaitingConfirmationStatus(matches)) {
        return {
          status: 'matched_awaiting_confirmation',
          match_method: 'apply_centre_code',
          application_cycle_year: cycle.application_cycle_year,
          source_file: cycle.source_file,
          matches
        };
      }
    } else if (!canonicalName) {
      return {
        status: 'identifier_unverifiable',
        match_method: identifierType || 'unknown_identifier_type',
        application_cycle_year: cycle.application_cycle_year,
        source_file: cycle.source_file
      };
    }
  }

  if (!canonicalName) {
    return {
      status: 'school_identifier_or_name_required',
      application_cycle_year: cycle.application_cycle_year,
      source_file: cycle.source_file
    };
  }

  const nameMatches = cycle.bySchoolName.get(canonicalName) || [];
  if (nameMatches.length === 0) {
    return {
      status: 'not_matched',
      match_method: 'school_name',
      application_cycle_year: cycle.application_cycle_year,
      source_file: cycle.source_file
    };
  }
  if (hasConfirmedStatus(nameMatches)) {
    return {
      status: 'matched_confirmed',
      match_method: 'school_name',
      application_cycle_year: cycle.application_cycle_year,
      source_file: cycle.source_file,
      matches: nameMatches
    };
  }
  if (hasAwaitingConfirmationStatus(nameMatches)) {
    return {
      status: 'matched_awaiting_confirmation',
      match_method: 'school_name',
      application_cycle_year: cycle.application_cycle_year,
      source_file: cycle.source_file,
      matches: nameMatches
    };
  }

  return {
    status: 'not_matched',
    match_method: 'school_name',
    application_cycle_year: cycle.application_cycle_year,
    source_file: cycle.source_file
  };
}

function resetBristolAspiringStateSchoolCache() {
  cachedDataset = null;
  cachedListPath = null;
}

module.exports = {
  loadBristolAspiringStateSchoolDataset,
  resetBristolAspiringStateSchoolCache,
  verifyBristolAspiringSchool
};
