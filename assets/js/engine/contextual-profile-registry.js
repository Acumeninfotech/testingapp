const UKWPMED_REGISTRY = {
  scheme_id: 'ukwpmed',
  label: 'UKWPMED',
  full_name: 'UK Widening Participation in Medicine',
  recognised_medical_schools: [
    'birmingham-a100',
    'brighton-and-sussex-a100',
    'keele-a100',
    'hull-york-a100',
    'leicester-a100',
    'manchester-a100',
    'plymouth-a100'
  ],
  recognised_programmes: [
    {
      programme_id: 'birmingham_pathways_to_birmingham_medicine',
      label: 'Pathways to Birmingham: Medicine',
      provider_university_id: 'birmingham-a100'
    },
    {
      programme_id: 'bsms_brightmed',
      label: 'BrightMed',
      provider_university_id: 'brighton-and-sussex-a100'
    },
    {
      programme_id: 'hyms_pathways_to_medicine',
      label: 'Pathways to Medicine',
      provider_university_id: 'hull-york-a100'
    },
    {
      programme_id: 'keele_steps2medicine',
      label: 'Steps2Medicine',
      provider_university_id: 'keele-a100'
    },
    {
      programme_id: 'manchester_access_programme',
      label: 'Manchester Access Programme (MAP)',
      provider_university_id: 'manchester-a100'
    },
    {
      programme_id: 'uclan_pwap',
      label: 'Preston Widening Access Programme (PWAP)',
      provider_university_id: 'lancashire-a100'
    },
    {
      programme_id: 'leicester_accessleicester_medicine',
      label: 'AccessLeicester: Medicine',
      provider_university_id: 'leicester-a100'
    },
    {
      programme_id: 'plymouth_peninsula_pathways',
      label: 'Peninsula Pathways',
      provider_university_id: 'plymouth-a100'
    }
  ]
};

const UKWPMED_PROGRAMME_BY_ID = Object.fromEntries(
  UKWPMED_REGISTRY.recognised_programmes.map((programme) => [
    programme.programme_id,
    programme
  ])
);

function normaliseRegistryId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const UKWPMED_PROGRAMME_BY_NORMALISED_ID = Object.fromEntries(
  UKWPMED_REGISTRY.recognised_programmes.map((programme) => [
    normaliseRegistryId(programme.programme_id),
    programme
  ])
);

function getRecognisedUkwpmedProgramme(programmeId) {
  return UKWPMED_PROGRAMME_BY_ID[programmeId] ||
    UKWPMED_PROGRAMME_BY_NORMALISED_ID[normaliseRegistryId(programmeId)] ||
    null;
}

function isUkwpmedRecognisedByMedicalSchool(medicalSchoolId, programmeId) {
  return Boolean(getRecognisedUkwpmedProgramme(programmeId)) &&
    UKWPMED_REGISTRY.recognised_medical_schools.includes(medicalSchoolId);
}

module.exports = {
  getRecognisedUkwpmedProgramme,
  isUkwpmedRecognisedByMedicalSchool,
  UKWPMED_PROGRAMME_BY_ID,
  UKWPMED_REGISTRY
};
