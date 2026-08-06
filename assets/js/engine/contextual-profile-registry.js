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

module.exports = {
  UKWPMED_PROGRAMME_BY_ID,
  UKWPMED_REGISTRY
};
