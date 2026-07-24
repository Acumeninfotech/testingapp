#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  classifyInterviewBand
} = require('../assets/js/engine/interview-band-classifier');

const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function normaliseAlias(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildAliasMap(catalog) {
  const aliasMap = new Map();

  for (const subject of catalog.subjects) {
    for (const alias of subject.aliases) {
      const key = normaliseAlias(alias);
      assert.ok(key, `${subject.subject_id} must not define an empty normalised alias.`);
      assert.ok(!aliasMap.has(key), `Duplicate normalised alias: ${alias}`);
      aliasMap.set(key, subject.subject_id);
    }
  }

  return aliasMap;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function kmmsApplicantWithALevels(subjects) {
  return {
    profile_id: 'kmms-computer-science-regression',
    application_year: 2025,
    applicant_identity: {
      fee_status: 'home',
      domicile: 'england',
      applicant_type: 'school_leaver'
    },
    gcse_profile: {
      total_gcse_count: 8,
      subjects: {
        english_language: '6',
        mathematics: '6',
        biology: '7',
        chemistry: '7',
        physics: '7',
        english_literature: '6',
        psychology: '7',
        history: '7'
      }
    },
    a_level_profile: {
      qualification_status: 'achieved',
      completed_in_one_sitting: true,
      subjects
    },
    admissions_tests: {
      ucat: {
        total_score: 1855,
        sjt_band: 2,
        test_year: 2025
      }
    },
    kmms: {
      group: 'B',
      school_contextual_data: 'available',
      academic_input_used: 'achieved_a_level'
    }
  };
}

function reasons(result) {
  return [
    ...(result.eligibility.failures || []),
    ...(result.eligibility.manual_review_reasons || [])
  ];
}

const catalog = readJson('data/subject-catalog.json');
const catalogValidation = spawnSync(
  process.execPath,
  [path.join(rootDir, 'scripts', 'validate-subject-catalog.js')],
  { cwd: rootDir, encoding: 'utf8' }
);

assert.strictEqual(
  catalogValidation.status,
  0,
  `subject catalog validator must pass:\n${catalogValidation.stdout}\n${catalogValidation.stderr}`
);

const subjectIds = catalog.subjects.map((subject) => subject.subject_id);
assert.strictEqual(new Set(subjectIds).size, subjectIds.length, 'Subject IDs must be unique.');
assert.ok(subjectIds.includes('computer_science'), 'computer_science must exist in the subject catalog.');
assert.ok(!subjectIds.includes('computing'), 'Computing must remain an alias, not a separate canonical ID.');
assert.ok(!subjectIds.includes('unsupported_subject'), 'Unsupported synthetic subject must not be catalogued.');

const computerScience = catalog.subjects.find((subject) => subject.subject_id === 'computer_science');
assert.strictEqual(computerScience.name, 'Computer Science');
assert.deepStrictEqual(
  computerScience.categories,
  ['a_level', 'gcse'],
  'computer_science must support A-level and GCSE use.'
);

const aliasMap = buildAliasMap(catalog);
assert.strictEqual(aliasMap.get(normaliseAlias('Computer Science')), 'computer_science');
assert.strictEqual(aliasMap.get(normaliseAlias('Computing')), 'computer_science');

const kmms = readJson('data/universities/kent-and-medway-a100.json');
assert.ok(
  kmms.stage_1_eligibility.post_16.a_level.subject_combination_rule.second_subject_group.subject_ids
    .includes('computer_science'),
  'KMMS A-level second subject group must retain computer_science.'
);

const config = readJson('data/interview-band-configs/kent-and-medway-a100.json');
const validComputerScienceApplicant = kmmsApplicantWithALevels([
  {
    subject_id: 'biology',
    achieved_grade: 'A',
    practical_endorsement: 'pass'
  },
  {
    subject_id: 'computer_science',
    achieved_grade: 'A',
    practical_endorsement: 'not_applicable'
  },
  {
    subject_id: 'history',
    achieved_grade: 'B',
    practical_endorsement: 'not_applicable'
  }
]);
const validResult = classifyInterviewBand(kmms, config, validComputerScienceApplicant);
assert.notStrictEqual(validResult.eligibility.status, 'not_eligible');
assert.ok(
  validResult.eligibility.checks.some((check) => {
    return check.check === 'a_level_subject_combination' && check.passed === true;
  }),
  'Biology + Computer Science + History must satisfy the KMMS A-level subject combination.'
);
assert.ok(
  !reasons(validResult).includes('a_level_subject_combination_not_met'),
  'Computer Science must not cause a KMMS subject-combination failure.'
);

const noBiologyOrChemistryApplicant = clone(validComputerScienceApplicant);
noBiologyOrChemistryApplicant.a_level_profile.subjects = [
  {
    subject_id: 'computer_science',
    achieved_grade: 'A',
    practical_endorsement: 'not_applicable'
  },
  {
    subject_id: 'physics',
    achieved_grade: 'A',
    practical_endorsement: 'pass'
  },
  {
    subject_id: 'history',
    achieved_grade: 'B',
    practical_endorsement: 'not_applicable'
  }
];
const noBiologyOrChemistryResult = classifyInterviewBand(kmms, config, noBiologyOrChemistryApplicant);
assert.ok(
  reasons(noBiologyOrChemistryResult).includes('a_level_subject_combination_not_met'),
  'Computer Science must not replace the KMMS Chemistry/Biology primary condition.'
);

const unsupportedSecondSubjectApplicant = clone(validComputerScienceApplicant);
unsupportedSecondSubjectApplicant.a_level_profile.subjects = [
  {
    subject_id: 'biology',
    achieved_grade: 'A',
    practical_endorsement: 'pass'
  },
  {
    subject_id: 'unsupported_subject',
    achieved_grade: 'A',
    practical_endorsement: 'not_applicable'
  },
  {
    subject_id: 'history',
    achieved_grade: 'B',
    practical_endorsement: 'not_applicable'
  }
];
const unsupportedResult = classifyInterviewBand(kmms, config, unsupportedSecondSubjectApplicant);
assert.ok(
  reasons(unsupportedResult).includes('a_level_subject_combination_not_met'),
  'Unsupported A-level subjects must still fail the KMMS second-subject rule.'
);

console.log('Subject catalog regression: PASS');
