import type { ProgrammeStatus } from './profileTypes';

export const YES_NO_NOT_SURE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const SENSITIVE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const UKRAINIAN_VISA_SCHEME_OPTIONS = [
  { value: 'homes_for_ukraine', label: 'Homes for Ukraine' },
  { value: 'ukraine_family_scheme', label: 'Ukraine Family Scheme' },
  { value: 'ukraine_extension_scheme', label: 'Ukraine Extension Scheme' },
  { value: 'none', label: 'None of these' },
  { value: 'not_sure', label: 'Not sure' },
] as const;

export const QUINTILE_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'q1', label: 'Quintile 1' },
  { value: 'q2', label: 'Quintile 2' },
  { value: 'q3', label: 'Quintile 3' },
  { value: 'q4', label: 'Quintile 4' },
  { value: 'q5', label: 'Quintile 5' },
] as const;

export const PROGRAMME_STATUS_OPTIONS: { value: ProgrammeStatus; label: string }[] = [
  { value: 'offered', label: 'I have received a place' },
  { value: 'participating', label: 'I am currently participating' },
  { value: 'completed', label: 'I completed the programme' },
  { value: 'not_sure', label: 'I am not sure' },
];

export const PROGRAMME_STATUS_LABELS: Record<ProgrammeStatus, string> = {
  offered: 'Place received',
  participating: 'Currently participating',
  completed: 'Completed',
  not_sure: 'Not sure',
};

export const TRI_STATE_LABELS = {
  yes: 'Yes',
  no: 'No',
  not_sure: 'Not sure',
  prefer_not_to_say: 'Prefer not to say',
} as const;

export const HOME_QUINTILE_FIELDS = [
  { key: 'polar4_quintile', label: 'POLAR4 quintile' },
  { key: 'tundra_quintile', label: 'TUNDRA quintile' },
  { key: 'imd_quintile', label: 'IMD 2019 quintile' },
] as const;

export const HOME_REGION_OPTIONS = [
  { value: 'south_west_england', label: 'South West England' },
  { value: 'north_west_england', label: 'North West England' },
  { value: 'north_east_england_or_cumbria', label: 'North East England or Cumbria' },
  { value: 'east_of_england', label: 'East of England' },
  { value: 'none', label: 'None of the above' },
  { value: 'unknown', label: 'Not sure' },
] as const;

export const SPECIFIC_HOME_AREA_OPTIONS = [
  { value: 'essex', label: 'Essex' },
  { value: 'lincolnshire', label: 'Lincolnshire' },
  { value: 'none', label: 'None of the above' },
  { value: 'unknown', label: 'Not sure' },
] as const;

export const SCHOOL_AREA_OPTIONS = [
  {
    value: 'northern_ireland_bt_to_year_12',
    label: 'Northern Ireland school with a BT postcode up to Year 12',
  },
  {
    value: 'bristol_bs_ba_state_school',
    label: 'School in a Bristol BS or BA postcode area (does not by itself confirm Bristol Aspiring State School eligibility)',
  },
  { value: 'keele_region_school', label: 'School in the Keele region' },
] as const;

export const FINANCIAL_SUPPORT_FIELDS = [
  { key: 'free_school_meals', label: 'I receive or previously received free school meals' },
  { key: 'means_tested_benefits', label: 'My household receives means-tested benefits' },
  { key: 'ema_or_16_19_bursary', label: 'I receive or previously received EMA or a 16-19 bursary' },
  { key: 'ehcp', label: 'I have or previously had an Education, Health and Care Plan' },
  { key: 'low_income_household', label: 'I am from a low-income household' },
  { key: 'ucat_bursary_recipient', label: 'I received a UCAT bursary' },
  { key: 'service_pupil_premium', label: 'I receive or previously received Service Pupil Premium' },
  { key: 'pip_recipient', label: 'I receive Personal Independence Payment' },
] as const;

export const SCHOOL_EDUCATION_FIELDS = [
  { key: 'state_non_fee_paying_school', label: 'I attended a state-funded, non-fee-paying school' },
  { key: 'below_average_gcse_school', label: "My school's GCSE performance was below the national average" },
  {
    key: 'below_average_post16_school',
    label: "My school or college's post-16 performance was below the national average",
  },
  {
    key: 'high_free_school_meals_school',
    label: 'My school had a high proportion of students eligible for free school meals',
  },
  {
    key: 'low_progression_to_higher_education_school',
    label: 'My school had low progression to higher education',
  },
  { key: 'scottish_target_or_access_school', label: 'I attended a Scottish target or access school' },
  {
    key: 'attended_uk_school_or_college_for_gcse_or_equivalent',
    label: 'I attended a UK school or college for my GCSEs or equivalent qualifications',
  },
  {
    key: 'attended_uk_school_or_college_for_post16_or_equivalent',
    label: 'I attended a UK school or college for my post-16 or equivalent qualifications',
  },
  {
    key: 'welsh_language_gcse_first_or_second_language',
    label: 'I studied Welsh Language GCSE as a first or second language',
  },
] as const;

export const PERSONAL_CIRCUMSTANCE_FIELDS = [
  { key: 'care_experienced', label: 'I have experience of being in local-authority care' },
  { key: 'care_over_three_months', label: 'I was looked after in local-authority care for more than three months' },
  { key: 'care_leaver', label: 'I am a care leaver' },
  { key: 'estranged_from_family', label: 'I am permanently estranged from my family' },
  { key: 'young_or_adult_carer', label: 'I am a young or adult carer' },
  { key: 'parenting_responsibilities', label: 'I have parenting responsibilities' },
  { key: 'refugee', label: 'I have refugee status' },
  { key: 'uk_refugee_status_granted', label: 'My refugee status was granted by the UK government' },
  {
    key: 'ukrainian_visa_scheme',
    label: 'My current or most relevant UK visa is one of the Ukrainian schemes',
    options: UKRAINIAN_VISA_SCHEME_OPTIONS,
  },
  { key: 'seeking_asylum', label: 'I am seeking asylum' },
  {
    key: 'first_in_family_at_university',
    label: 'I would be the first generation in my immediate family to attend university',
  },
  { key: 'military_family', label: 'I am from a military or service family' },
  { key: 'gypsy_roma_traveller', label: 'I identify as Gypsy, Roma or Traveller' },
  {
    key: 'disability',
    label: 'I have a disability or long-term condition relevant to contextual consideration',
  },
] as const;

export const UNIVERSITY_LABELS: Record<string, string> = {
  'birmingham-a100': 'University of Birmingham',
  'brighton-and-sussex-a100': 'Brighton and Sussex Medical School',
  'bristol-a100': 'University of Bristol',
  'dundee-a100': 'University of Dundee',
  'edinburgh-a100': 'University of Edinburgh',
  'glasgow-a100': 'University of Glasgow',
  'hull-york-a100': 'Hull York Medical School',
  'imperial-college-london-a100': 'Imperial College London',
  'keele-a100': 'Keele University',
  'king-s-college-london-a100': "King's College London",
  'lancashire-a100': 'University of Lancashire / UCLan',
  'leeds-a100': 'University of Leeds',
  'leicester-a100': 'University of Leicester',
  'manchester-a100': 'University of Manchester',
  'newcastle-a100': 'Newcastle University',
  'oxford-a100': 'University of Oxford',
  'plymouth-a100': 'University of Plymouth / Peninsula Medical School',
  'queen-mary-a100': 'Queen Mary University of London',
  'st-andrews-a100': 'University of St Andrews',
  'ucl-a100': 'University College London',
};

export const UKWPMED_REGISTRY = {
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
    'plymouth-a100',
  ],
  recognised_programmes: [
    {
      programme_id: 'birmingham_pathways_to_birmingham_medicine',
      label: 'Pathways to Birmingham: Medicine',
      provider_university_id: 'birmingham-a100',
    },
    {
      programme_id: 'bsms_brightmed',
      label: 'BrightMed',
      provider_university_id: 'brighton-and-sussex-a100',
    },
    {
      programme_id: 'hyms_pathways_to_medicine',
      label: 'Pathways to Medicine',
      provider_university_id: 'hull-york-a100',
    },
    {
      programme_id: 'keele_steps2medicine',
      label: 'Steps2Medicine',
      provider_university_id: 'keele-a100',
    },
    {
      programme_id: 'manchester_access_programme',
      label: 'Manchester Access Programme (MAP)',
      provider_university_id: 'manchester-a100',
    },
    {
      programme_id: 'uclan_pwap',
      label: 'Preston Widening Access Programme (PWAP)',
      provider_university_id: 'lancashire-a100',
    },
    {
      programme_id: 'plymouth_peninsula_pathways',
      label: 'Peninsula Pathways',
      provider_university_id: 'plymouth-a100',
    },
  ],
} as const;

export const OTHER_ACCESS_PROGRAMMES = [
  { programme_id: 'leicester_accessleicester_medicine', label: 'AccessLeicester: Medicine' },
  { programme_id: 'plymouth_peninsula_pathways_plus', label: 'Peninsula Pathways PLUS' },
  { programme_id: 'st_andrews_reach_scotland', label: 'Reach Scotland' },
  { programme_id: 'st_andrews_access_programme', label: 'St Andrews Access Programme' },
  { programme_id: 'glasgow_top_up', label: 'Top Up Programme' },
  { programme_id: 'glasgow_reach', label: 'Reach Programme' },
  { programme_id: 'edinburgh_access_edinburgh', label: 'Access Edinburgh' },
  { programme_id: 'dundee_reach', label: 'Reach Dundee' },
  { programme_id: 'dundee_access', label: 'Access Dundee' },
  { programme_id: 'newcastle_partners', label: 'PARTNERS Programme' },
  { programme_id: 'leeds_access_to_leeds', label: 'Access to Leeds' },
  { programme_id: 'realising_opportunities', label: 'Realising Opportunities' },
  { programme_id: 'bristol_access_to_bristol', label: 'Access to Bristol' },
  { programme_id: 'bristol_discover_bristol', label: 'Discover Bristol' },
  { programme_id: 'bristol_insight_into_bristol_summer_school', label: 'Insight into Bristol summer school' },
  { programme_id: 'bristol_next_step_bristol', label: 'Next Step Bristol' },
  { programme_id: 'bristol_virtual_summer_school', label: 'Virtual Summer School' },
  { programme_id: 'bristol_scholars', label: 'Bristol Scholars' },
  { programme_id: 'lancaster_access_to_medicine', label: 'Lancaster Access to Medicine' },
  { programme_id: 'exeter_scholars', label: 'Exeter Scholars' },
  { programme_id: 'southampton_access_southampton', label: 'Access Southampton' },
  { programme_id: 'uea_outreach_pathways', label: 'UEA Outreach / Pathways' },
  { programme_id: 'qmul_reach', label: 'QMUL Reach' },
  { programme_id: 'qmul_foundation_pathway', label: 'QMUL Foundation Pathway' },
  { programme_id: 'kings_k_plus', label: 'K+ Programme' },
  { programme_id: 'ucl_access_ucl', label: 'Access UCL' },
  { programme_id: 'imperial_outreach_pathways', label: 'Imperial Outreach / Pathways' },
  { programme_id: 'oxford_uniq', label: 'UNIQ' },
  { programme_id: 'cambridge_he_plus', label: 'HE+' },
  { programme_id: 'cambridge_foundation_year_outreach', label: 'Cambridge Foundation Year Outreach' },
  { programme_id: 'other_access_wp_programme', label: 'Other access or widening participation programme' },
] as const;

export const PARTNER_SCHOOL_UNIVERSITY_OPTIONS = [
  { value: 'bristol-a100', label: 'University of Bristol' },
  { value: 'dundee-a100', label: 'University of Dundee' },
  { value: 'glasgow-a100', label: 'University of Glasgow' },
  { value: 'keele-a100', label: 'Keele University' },
  { value: 'leeds-a100', label: 'University of Leeds' },
  { value: 'leicester-a100', label: 'University of Leicester' },
  { value: 'manchester-a100', label: 'University of Manchester' },
  { value: 'newcastle-a100', label: 'Newcastle University' },
  { value: 'plymouth-a100', label: 'University of Plymouth' },
  { value: 'st-andrews-a100', label: 'University of St Andrews' },
  { value: 'other_university', label: 'Other university' },
] as const;

export const CONTEXTUAL_FIELD_LABELS = Object.fromEntries(
  [
    ...FINANCIAL_SUPPORT_FIELDS,
    ...SCHOOL_EDUCATION_FIELDS,
    ...PERSONAL_CIRCUMSTANCE_FIELDS,
  ].map((field) => [field.key, field.label]),
) as Record<string, string>;

export function programmeLabel(programmeId: string) {
  return (
    UKWPMED_REGISTRY.recognised_programmes.find((programme) => programme.programme_id === programmeId)?.label ||
    OTHER_ACCESS_PROGRAMMES.find((programme) => programme.programme_id === programmeId)?.label ||
    programmeId
      .replace(/_/g, ' ')
      .replace(/\bwp\b/gi, 'WP')
      .replace(/\bukwpmed\b/gi, 'UKWPMED')
      .replace(/\w\S*/g, (word) => {
        if (/^(WP|UKWPMED)$/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
  );
}

export function providerUniversityIdForUkwpmed(programmeId: string) {
  return UKWPMED_REGISTRY.recognised_programmes.find((programme) => programme.programme_id === programmeId)
    ?.provider_university_id;
}

export function universityLabel(universityId: string, fallback?: string) {
  return UNIVERSITY_LABELS[universityId] || fallback || universityId;
}
