#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const groupsPath = path.join(rootDir, 'data', 'applicant-groups.json');
const legacyGroupsPath = path.join(rootDir, 'data', 'application-groups.json');
const universitiesDir = path.join(rootDir, 'data', 'universities');

const GROUP_REFERENCE_KEYS = new Set([
  'applicant_group_ids',
  'applies_to_group_ids',
  'required_group_ids',
  'excluded_group_ids',
  'eligible_group_ids',
  'ineligible_group_ids',
  'ranking_pool_group_ids',
  'quota_group_ids',
  'threshold_group_ids',
  'group_ids'
]);

const LEGACY_UNIVERSITY_KEYS = new Set([
  'applicant_group'
]);

const errors = [];
const warnings = [];
const legacyApplicantGroupLocations = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${relative(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

function findDuplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  });

  return [...duplicates];
}

function walkJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return walkJsonFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
  });
}

function collectReferences(value, filePath, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectReferences(item, filePath, trail.concat(`[${index}]`));
    });
    return [];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const references = [];

  Object.entries(value).forEach(([key, child]) => {
    const childTrail = trail.concat(key);
    const location = `${relative(filePath)}:${childTrail.join('.')}`;

    if (GROUP_REFERENCE_KEYS.has(key)) {
      if (!Array.isArray(child)) {
        errors.push(`${location} must be an array of applicant group IDs.`);
      } else {
        child.forEach((groupId, index) => {
          if (typeof groupId !== 'string') {
            errors.push(`${location}[${index}] must be a string applicant group ID.`);
          } else {
            references.push({ groupId, location: `${location}[${index}]` });
          }
        });
      }
    }

    if (LEGACY_UNIVERSITY_KEYS.has(key)) {
      legacyApplicantGroupLocations.push(location);
    }

    references.push(...collectReferences(child, filePath, childTrail));
  });

  return references;
}

function validateDictionary(dictionary) {
  if (!dictionary) {
    return { groupIds: new Set() };
  }

  if (!Array.isArray(dictionary.applicant_groups)) {
    errors.push('data/applicant-groups.json: applicant_groups must be an array.');
  }

  if (!Array.isArray(dictionary.categories)) {
    errors.push('data/applicant-groups.json: categories must be an array.');
  }

  const applicantGroups = Array.isArray(dictionary.applicant_groups)
    ? dictionary.applicant_groups
    : [];
  const categories = Array.isArray(dictionary.categories)
    ? dictionary.categories
    : [];

  const groupIds = applicantGroups.map((group) => group.group_id);
  const categoryIds = categories.map((category) => category.category_id);
  const knownCategoryIds = new Set(categoryIds);

  findDuplicateValues(groupIds).forEach((groupId) => {
    errors.push(`data/applicant-groups.json: duplicate group_id "${groupId}".`);
  });

  findDuplicateValues(categoryIds).forEach((categoryId) => {
    errors.push(`data/applicant-groups.json: duplicate category_id "${categoryId}".`);
  });

  applicantGroups.forEach((group, index) => {
    const label = group && group.group_id ? group.group_id : `applicant_groups[${index}]`;

    ['group_id', 'category', 'name', 'description'].forEach((field) => {
      if (!group || typeof group[field] !== 'string' || group[field].trim() === '') {
        errors.push(`data/applicant-groups.json: ${label} must include ${field}.`);
      }
    });

    if (group && group.category && !knownCategoryIds.has(group.category)) {
      errors.push(
        `data/applicant-groups.json: ${label} uses unknown category "${group.category}".`
      );
    }

    if (group && group.mutually_exclusive === true) {
      errors.push(
        `data/applicant-groups.json: ${label} must not be marked mutually exclusive.`
      );
    }
  });

  if (dictionary.mutually_exclusive === true) {
    errors.push('data/applicant-groups.json: applicant groups must be non-mutually-exclusive.');
  }

  return { groupIds: new Set(groupIds) };
}

function validateUniversityReferences(groupIds) {
  const universityFiles = walkJsonFiles(universitiesDir);

  universityFiles.forEach((filePath) => {
    const data = readJson(filePath);
    if (!data) {
      return;
    }

    const references = collectReferences(data, filePath);
    references.forEach(({ groupId, location }) => {
      if (!groupIds.has(groupId)) {
        errors.push(`${location} references unknown applicant group "${groupId}".`);
      }
    });
  });
}

if (fs.existsSync(legacyGroupsPath)) {
  errors.push('data/application-groups.json still exists; use data/applicant-groups.json instead.');
}

if (!fs.existsSync(groupsPath)) {
  errors.push('data/applicant-groups.json is missing.');
} else {
  const dictionary = readJson(groupsPath);
  const { groupIds } = validateDictionary(dictionary);
  validateUniversityReferences(groupIds);
}

if (warnings.length > 0) {
  console.warn('Applicant group validation warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (legacyApplicantGroupLocations.length > 0) {
  console.warn('Applicant group migration warnings:');
  console.warn(
    `- ${legacyApplicantGroupLocations.length} university files still use the legacy applicant_group object. Migrate gradually to referenced applicant group IDs.`
  );
  legacyApplicantGroupLocations.slice(0, 10).forEach((location) => {
    console.warn(`  - ${location}`);
  });
  if (legacyApplicantGroupLocations.length > 10) {
    console.warn(`  - ...and ${legacyApplicantGroupLocations.length - 10} more.`);
  }
}

if (errors.length > 0) {
  console.error('Applicant group validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Applicant group validation passed.');
