#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const catalogPath = path.join(rootDir, 'data', 'subject-catalog.json');
const universitiesDir = path.join(rootDir, 'data', 'universities');

const SUBJECT_REFERENCE_KEYS = new Set([
  'subject_id',
  'subject_ids',
  'required_subject_ids',
  'mandatory_subject_ids',
  'excluded_subject_ids',
  'accepted_subject_ids',
  'accepted_degree_subject_ids',
  'required_hl_subject_ids',
  'one_of_subject_ids',
  'any_of_subject_ids',
  'all_of_subject_ids'
]);

const LEGACY_SUBJECT_KEYS = new Set([
  'mandatory_subjects',
  'required_subjects',
  'excluded_subjects',
  'accepted_subjects',
  'accepted_degree_subjects',
  'required_hl_subjects',
  'subject_credits'
]);

const errors = [];
const legacySubjectLocations = [];

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${relative(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
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

function validateCatalog(catalog) {
  if (!catalog) {
    return { subjectIds: new Set() };
  }

  if (!Array.isArray(catalog.subjects)) {
    errors.push('data/subject-catalog.json: subjects must be an array.');
  }

  if (!Array.isArray(catalog.categories)) {
    errors.push('data/subject-catalog.json: categories must be an array.');
  }

  const subjects = Array.isArray(catalog.subjects) ? catalog.subjects : [];
  const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
  const subjectIds = subjects.map((subject) => subject.subject_id);
  const categoryIds = categories.map((category) => category.category_id);
  const knownCategoryIds = new Set(categoryIds);

  findDuplicateValues(subjectIds).forEach((subjectId) => {
    errors.push(`data/subject-catalog.json: duplicate subject_id "${subjectId}".`);
  });

  findDuplicateValues(categoryIds).forEach((categoryId) => {
    errors.push(`data/subject-catalog.json: duplicate category_id "${categoryId}".`);
  });

  subjects.forEach((subject, index) => {
    const label = subject && subject.subject_id ? subject.subject_id : `subjects[${index}]`;

    ['subject_id', 'name'].forEach((field) => {
      if (!subject || typeof subject[field] !== 'string' || subject[field].trim() === '') {
        errors.push(`data/subject-catalog.json: ${label} must include ${field}.`);
      }
    });

    if (!Array.isArray(subject.aliases)) {
      errors.push(`data/subject-catalog.json: ${label} must include aliases as an array.`);
    } else {
      subject.aliases.forEach((alias, aliasIndex) => {
        if (typeof alias !== 'string' || alias.trim() === '') {
          errors.push(`data/subject-catalog.json: ${label}.aliases[${aliasIndex}] must be a non-empty string.`);
        }
      });
    }

    if (!Array.isArray(subject.categories) || subject.categories.length === 0) {
      errors.push(`data/subject-catalog.json: ${label} must include at least one category.`);
    } else {
      subject.categories.forEach((category) => {
        if (!knownCategoryIds.has(category)) {
          errors.push(`data/subject-catalog.json: ${label} uses unknown category "${category}".`);
        }
      });
    }

    if (subject.acceptance_rules || subject.requirement_rules || subject.university_rules) {
      errors.push(`data/subject-catalog.json: ${label} must not define university-specific rules.`);
    }
  });

  if (catalog.acceptance_rules || catalog.requirement_rules || catalog.university_rules) {
    errors.push('data/subject-catalog.json must not define university-specific subject rules.');
  }

  return { subjectIds: new Set(subjectIds) };
}

function collectReferences(value, filePath, trail = []) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectReferences(item, filePath, trail.concat(`[${index}]`)));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const references = [];

  Object.entries(value).forEach(([key, child]) => {
    const childTrail = trail.concat(key);
    const location = `${relative(filePath)}:${childTrail.join('.')}`;

    if (key === 'subject_id') {
      if (typeof child !== 'string') {
        errors.push(`${location} must be a string subject ID.`);
      } else {
        references.push({ subjectId: child, location });
      }
    } else if (SUBJECT_REFERENCE_KEYS.has(key)) {
      if (!Array.isArray(child)) {
        errors.push(`${location} must be an array of subject IDs.`);
      } else {
        child.forEach((subjectId, index) => {
          if (typeof subjectId !== 'string') {
            errors.push(`${location}[${index}] must be a string subject ID.`);
          } else {
            references.push({ subjectId, location: `${location}[${index}]` });
          }
        });
      }
    }

    if (LEGACY_SUBJECT_KEYS.has(key)) {
      legacySubjectLocations.push(location);
    }

    references.push(...collectReferences(child, filePath, childTrail));
  });

  return references;
}

function validateUniversityReferences(subjectIds) {
  walkJsonFiles(universitiesDir).forEach((filePath) => {
    const data = readJson(filePath);
    if (!data) {
      return;
    }

    collectReferences(data, filePath).forEach(({ subjectId, location }) => {
      if (!subjectIds.has(subjectId)) {
        errors.push(`${location} references unknown subject "${subjectId}".`);
      }
    });
  });
}

if (!fs.existsSync(catalogPath)) {
  errors.push('data/subject-catalog.json is missing.');
} else {
  const catalog = readJson(catalogPath);
  const { subjectIds } = validateCatalog(catalog);
  validateUniversityReferences(subjectIds);
}

if (legacySubjectLocations.length > 0) {
  console.warn('Subject catalog migration warnings:');
  console.warn(
    `- ${legacySubjectLocations.length} legacy subject fields still exist. Migrate gradually to subject_id-based fields when each course profile is reviewed.`
  );
  legacySubjectLocations.slice(0, 10).forEach((location) => {
    console.warn(`  - ${location}`);
  });
  if (legacySubjectLocations.length > 10) {
    console.warn(`  - ...and ${legacySubjectLocations.length - 10} more.`);
  }
}

if (errors.length > 0) {
  console.error('Subject catalog validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Subject catalog validation passed.');
