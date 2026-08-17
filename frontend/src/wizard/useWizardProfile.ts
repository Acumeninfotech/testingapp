import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyProfile,
  createEmptyContextualProfile,
  normaliseEpqQualification,
  type AgeAtCourseStartBand,
  type ContextualProfile,
  type ContextualValueSource,
  type HomeRegionValue,
  type PostcodeLookupStatus,
  type ProgrammeStatus,
  type PersonalCircumstanceValue,
  type QuintileValue,
  type SchoolAreaOption,
  type SchoolAreaValue,
  type SpecificHomeAreaValue,
  type ScottishSubject,
  type SensitiveAnswer,
  type UkrainianVisaScheme,
  type WizardProfile,
  type YesNoNotSure,
} from './profileTypes';
import { providerUniversityIdForUkwpmed, UKWPMED_REGISTRY } from './contextualRegistry';

const STORAGE_KEY = 'applysmart.wizard.profile.v1';
const MIN_NATIONAL_5_ROWS = 5;
const MIN_SCOTTISH_HIGHER_ROWS = 5;

const HOME_REGION_FLAG_TO_VALUE: Record<string, HomeRegionValue> = {
  south_west_england_resident: 'south_west_england',
  north_west_england_resident: 'north_west_england',
  north_east_england_or_cumbria_resident: 'north_east_england_or_cumbria',
  east_of_england_resident: 'east_of_england',
};

const SPECIFIC_HOME_AREA_FLAG_TO_VALUE: Record<string, SpecificHomeAreaValue> = {
  essex_resident: 'essex',
  lincolnshire_resident: 'lincolnshire',
};

const SCHOOL_AREA_FLAG_TO_VALUE: Record<string, SchoolAreaOption> = {
  northern_ireland_bt_postcode_school_to_year_12: 'northern_ireland_bt_to_year_12',
  bristol_bs_ba_state_school: 'bristol_bs_ba_state_school',
  keele_region_school: 'keele_region_school',
};

const HOME_REGION_VALUES = new Set<HomeRegionValue>([
  'south_west_england',
  'north_west_england',
  'north_east_england_or_cumbria',
  'east_of_england',
  'none',
  'unknown',
]);

const SPECIFIC_HOME_AREA_VALUES = new Set<SpecificHomeAreaValue>(['essex', 'lincolnshire', 'none', 'unknown']);
const SCHOOL_AREA_SPECIAL_VALUES = new Set(['none', 'unknown']);
const SCHOOL_AREA_OPTION_VALUES = new Set<SchoolAreaOption>([
  'northern_ireland_bt_to_year_12',
  'bristol_bs_ba_state_school',
  'keele_region_school',
]);

function blankScottishSubject(): ScottishSubject {
  return { subject_id: '', grade: '' };
}

function padScottishSubjectRows(subjects: ScottishSubject[] | undefined, minRows: number) {
  const rows = Array.isArray(subjects) ? [...subjects] : [];
  while (rows.length < minRows) rows.push(blankScottishSubject());
  return rows;
}

function firstYesFromFlags<T extends string>(flags: Record<string, YesNoNotSure | undefined>, map: Record<string, T>) {
  const selected = Object.entries(map)
    .filter(([flagKey]) => flags[flagKey] === 'yes')
    .map(([, value]) => value);

  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return 'unknown' as const;

  const entries = Object.keys(map).map((flagKey) => flags[flagKey]).filter((value) => value !== undefined);
  if (entries.length === 0) return null;
  if (entries.some((value) => value === 'not_sure')) return 'unknown' as const;
  if (entries.every((value) => value === 'no')) return 'none' as const;
  return null;
}

function selectedSchoolAreasFromFlags(flags: Record<string, YesNoNotSure | undefined>) {
  const selected = Object.entries(SCHOOL_AREA_FLAG_TO_VALUE)
    .filter(([flagKey]) => flags[flagKey] === 'yes')
    .map(([, value]) => value);

  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return 'unknown' as const;

  const entries = Object.keys(SCHOOL_AREA_FLAG_TO_VALUE)
    .map((flagKey) => flags[flagKey])
    .filter((value) => value !== undefined);
  if (entries.length === 0) return null;
  if (entries.some((value) => value === 'not_sure')) return 'unknown' as const;
  if (entries.every((value) => value === 'no')) return 'none' as const;
  return null;
}

function resolveLegacySchoolArea(...values: (SchoolAreaValue | null)[]): SchoolAreaValue | null {
  const present = values.filter((value): value is SchoolAreaValue => Boolean(value));
  if (present.length === 0) return null;
  if (present.includes('unknown')) return 'unknown';
  return new Set(present).size === 1 ? present[0] : 'unknown';
}

function applyFlagProjectionFromConsolidatedFields(
  flags: Record<string, YesNoNotSure | undefined>,
  homeRegion: HomeRegionValue | null,
  specificHomeArea: SpecificHomeAreaValue | null,
  schoolArea: SchoolAreaValue | null,
) {
  const next = { ...flags };

  const setMappedFlags = (keys: string[], selected: string[], mode: 'known' | 'none' | 'unknown') => {
    for (const key of keys) {
      if (mode === 'unknown') {
        next[key] = 'not_sure';
      } else {
        next[key] = selected.includes(key) ? 'yes' : 'no';
      }
    }
  };

  if (homeRegion) {
    const homeKeyMap = Object.entries(HOME_REGION_FLAG_TO_VALUE);
    const keys = homeKeyMap.map(([key]) => key);
    if (homeRegion === 'unknown') {
      setMappedFlags(keys, [], 'unknown');
    } else if (homeRegion === 'none') {
      setMappedFlags(keys, [], 'none');
    } else {
      const selected = homeKeyMap.filter(([, value]) => value === homeRegion).map(([key]) => key);
      setMappedFlags(keys, selected, 'known');
    }
  }

  if (specificHomeArea) {
    const areaKeyMap = Object.entries(SPECIFIC_HOME_AREA_FLAG_TO_VALUE);
    const keys = areaKeyMap.map(([key]) => key);
    if (specificHomeArea === 'unknown') {
      setMappedFlags(keys, [], 'unknown');
    } else if (specificHomeArea === 'none') {
      setMappedFlags(keys, [], 'none');
    } else {
      const selected = areaKeyMap.filter(([, value]) => value === specificHomeArea).map(([key]) => key);
      setMappedFlags(keys, selected, 'known');
    }
  }

  const schoolKeyMap = Object.entries(SCHOOL_AREA_FLAG_TO_VALUE);
  const schoolKeys = schoolKeyMap.map(([key]) => key);
  if (schoolArea === 'unknown') {
    setMappedFlags(schoolKeys, [], 'unknown');
  } else if (schoolArea === 'none') {
    setMappedFlags(schoolKeys, [], 'none');
  } else if (schoolArea) {
    const selected = schoolKeyMap.filter(([, value]) => value === schoolArea).map(([key]) => key);
    setMappedFlags(schoolKeys, selected, 'known');
  }

  return next;
}

function ageBandFromDateOfBirth(dateOfBirth: unknown, applicationYear: unknown): AgeAtCourseStartBand | '' {
  if (typeof dateOfBirth !== 'string' || !dateOfBirth) return '';
  const entryYear = typeof applicationYear === 'number' ? applicationYear : 2027;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const referenceDate = new Date(Date.UTC(entryYear, 8, 1));
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) return '';

  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  if (
    referenceDate.getUTCMonth() < birth.getUTCMonth() ||
    (
      referenceDate.getUTCMonth() === birth.getUTCMonth() &&
      referenceDate.getUTCDate() < birth.getUTCDate()
    )
  ) {
    age -= 1;
  }

  if (age >= 21) return 'age_21_or_over';
  if (age === 20) return 'age_20';
  if (age === 19) return 'age_19';
  if (age === 18) return 'age_18';
  if (age === 17) return 'age_17';
  return 'under_17';
}

function normaliseAgeBand(value: unknown): AgeAtCourseStartBand | '' {
  if (
    value === 'under_17' ||
    value === 'age_17' ||
    value === 'age_18' ||
    value === 'age_19' ||
    value === 'age_20' ||
    value === 'age_21_or_over' ||
    value === 'age_18_or_over_legacy' ||
    value === 'not_sure'
  ) {
    return value;
  }
  if (value === 'age_18_or_over') return 'age_18_or_over_legacy';
  return '';
}

export function normaliseStoredProfile(parsed: unknown): WizardProfile {
  const empty = createEmptyProfile();
  if (!parsed || typeof parsed !== 'object') return empty;
  const saved = parsed as Partial<WizardProfile> & {
    applicant_identity?: Partial<WizardProfile['applicant_identity']> & { date_of_birth?: string };
  };
  const savedIdentity = (saved.applicant_identity || {}) as Partial<WizardProfile['applicant_identity']> & {
    date_of_birth?: string;
  };
  const savedCourseTarget = (saved.course_target || {}) as Partial<WizardProfile['course_target']>;
  const savedALevelProfile = (saved.a_level_profile || {}) as Partial<WizardProfile['a_level_profile']>;
  const savedScottishProfile = (
    saved.scottish_profile && typeof saved.scottish_profile === 'object' ? saved.scottish_profile : {}
  ) as Partial<WizardProfile['scottish_profile']>;
  const ageBand = normaliseAgeBand(savedIdentity.age_at_course_start_band)
    || ageBandFromDateOfBirth(savedIdentity.date_of_birth, savedCourseTarget.application_year)
    || 'not_sure';

  return {
    ...empty,
    ...saved,
    applicant_identity: {
      ...empty.applicant_identity,
      ...savedIdentity,
      age_at_course_start_band: ageBand,
      current_uk_residence: normaliseTriState(savedIdentity.current_uk_residence) ?? 'not_sure',
      date_of_birth: '',
    },
    course_target: {
      ...empty.course_target,
      ...savedCourseTarget,
    },
    contextual_profile: normaliseContextualProfile(saved.contextual_profile, savedIdentity),
    a_level_profile: {
      ...empty.a_level_profile,
      ...savedALevelProfile,
      epq: normaliseEpqQualification(savedALevelProfile.epq),
    },
    scottish_profile: {
      ...empty.scottish_profile,
      ...savedScottishProfile,
      national_5_subjects: padScottishSubjectRows(savedScottishProfile.national_5_subjects, MIN_NATIONAL_5_ROWS),
      higher_subjects: padScottishSubjectRows(savedScottishProfile.higher_subjects, MIN_SCOTTISH_HIGHER_ROWS),
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normaliseTriState(value: unknown): YesNoNotSure | undefined {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  if (value === 'yes' || value === 'no' || value === 'not_sure') return value;
  return undefined;
}

function normaliseSensitive(value: unknown): SensitiveAnswer | undefined {
  if (value === 'prefer_not_to_say') return value;
  return normaliseTriState(value);
}

function normaliseUkrainianVisaScheme(value: unknown): UkrainianVisaScheme | undefined {
  if (
    value === 'homes_for_ukraine' ||
    value === 'ukraine_family_scheme' ||
    value === 'ukraine_extension_scheme' ||
    value === 'none' ||
    value === 'not_sure'
  ) {
    return value;
  }
  return undefined;
}

function normalisePersonalCircumstances(value: unknown) {
  return Object.fromEntries(
    Object.entries(asRecord(value))
      .map(([key, answer]) => {
        const normalised = key === 'ukrainian_visa_scheme'
          ? normaliseUkrainianVisaScheme(answer)
          : normaliseSensitive(answer);
        return normalised ? [key, normalised] : null;
      })
      .filter((entry): entry is [string, PersonalCircumstanceValue] => Boolean(entry)),
  ) as ContextualProfile['personal_circumstances'];
}

function normaliseQuintile(value: unknown): QuintileValue {
  if (value === 'q1' || value === 'q2' || value === 'q3' || value === 'q4' || value === 'q5') return value;
  if (value === 'not_applicable') return value;
  if (value === 1 || value === '1') return 'q1';
  if (value === 2 || value === '2') return 'q2';
  if (value === 3 || value === '3') return 'q3';
  if (value === 4 || value === '4') return 'q4';
  if (value === 5 || value === '5') return 'q5';
  return 'unknown';
}

function normaliseOptionalQuintile(value: unknown): QuintileValue {
  if (value === undefined || value === null || value === '') return '';
  return normaliseQuintile(value);
}

function quintileNumber(value: QuintileValue): number | null {
  if (value === 'q1') return 1;
  if (value === 'q2') return 2;
  if (value === 'q3') return 3;
  if (value === 'q4') return 4;
  if (value === 'q5') return 5;
  return null;
}

function normaliseValueSource(value: unknown): ContextualValueSource {
  if (value === 'postcode_lookup' || value === 'manual' || value === 'existing_profile' || value === 'unknown') {
    return value;
  }
  return 'unknown';
}

function sourceForQuintile(savedSource: unknown, quintile: QuintileValue): ContextualValueSource {
  const source = normaliseValueSource(savedSource);
  if (source === 'unknown' && quintile !== 'unknown') {
    return 'existing_profile';
  }
  return source;
}

function normaliseProgrammeStatus(value: unknown): ProgrammeStatus | '' {
  if (value === 'offered' || value === 'participating' || value === 'completed' || value === 'not_sure') return value;
  return '';
}

function normaliseHomeRegionValue(value: unknown): HomeRegionValue | null {
  return typeof value === 'string' && HOME_REGION_VALUES.has(value as HomeRegionValue)
    ? value as HomeRegionValue
    : null;
}

function normaliseSpecificHomeAreaValue(value: unknown): SpecificHomeAreaValue | null {
  return typeof value === 'string' && SPECIFIC_HOME_AREA_VALUES.has(value as SpecificHomeAreaValue)
    ? value as SpecificHomeAreaValue
    : null;
}

function normaliseSchoolAreas(value: unknown): SchoolAreaOption[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is SchoolAreaOption => (
    typeof entry === 'string' && SCHOOL_AREA_OPTION_VALUES.has(entry as SchoolAreaOption)
  ));
}

function normaliseContextualProfile(
  savedContextual: unknown,
  savedIdentity: Partial<WizardProfile['applicant_identity']>,
): ContextualProfile {
  const empty = createEmptyContextualProfile();
  const saved = asRecord(savedContextual);
  const home = asRecord(saved.home_area_region);
  const lookup = asRecord(home.postcode_lookup);
  const lookupValues = asRecord(lookup.values);
  const access = asRecord(saved.access_programmes);
  const ukwpmed = asRecord(access.ukwpmed);
  const partnerSchools = asRecord(saved.partner_schools);
  const flags = asRecord(savedIdentity.contextual_flags);
  const legacyAccessProgrammes = Array.isArray(access)
    ? access
    : Array.isArray(access.access_programmes)
      ? access.access_programmes
      : [];

  const recognisedUkwpmedIds = new Set<string>(
    UKWPMED_REGISTRY.recognised_programmes.map((programme) => programme.programme_id),
  );
  const existingUkwpmedId = typeof ukwpmed.programme_id === 'string' ? ukwpmed.programme_id : '';
  const legacyUkwpmed = legacyAccessProgrammes.find((entry) => {
    const programmeId = asRecord(entry).programme_id;
    return typeof programmeId === 'string' && recognisedUkwpmedIds.has(programmeId);
  });
  const legacyUkwpmedRecord = asRecord(legacyUkwpmed);
  const programmeId = existingUkwpmedId || (typeof legacyUkwpmedRecord.programme_id === 'string' ? legacyUkwpmedRecord.programme_id : '');

  const otherProgrammes = Array.isArray(access.other_programmes)
    ? access.other_programmes
    : legacyAccessProgrammes.filter((entry) => {
        const programmeId = asRecord(entry).programme_id;
        return typeof programmeId !== 'string' || !recognisedUkwpmedIds.has(programmeId);
      });

  const polar4 = normaliseQuintile(home.polar4_quintile ?? flags.polar_quintile);
  const imd = normaliseQuintile(home.imd_quintile ?? flags.imd_quintile);
  const tundra = normaliseQuintile(home.tundra_quintile);
  const lookupStatus = typeof lookup.status === 'string' ? lookup.status : 'not_checked';
  const safeLookupStatus = ['not_checked', 'matched', 'partial_match', 'not_found', 'error'].includes(lookupStatus)
    ? lookupStatus as PostcodeLookupStatus
    : 'not_checked';
  const normalisedRegionalFlags = Object.fromEntries(
    Object.entries(asRecord(home.regional_flags)).flatMap(([key, value]) => {
      const normalised = normaliseTriState(value);
      return normalised ? [[key, normalised]] : [];
    }),
  ) as Record<string, YesNoNotSure | undefined>;

  const legacyHomeRegion = firstYesFromFlags(normalisedRegionalFlags, HOME_REGION_FLAG_TO_VALUE) as HomeRegionValue | 'none' | 'unknown' | null;
  const legacySpecificHomeArea = firstYesFromFlags(normalisedRegionalFlags, SPECIFIC_HOME_AREA_FLAG_TO_VALUE) as SpecificHomeAreaValue | 'none' | 'unknown' | null;
  const homeRegion = normaliseHomeRegionValue(home.home_region) ?? legacyHomeRegion;
  const specificHomeArea = normaliseSpecificHomeAreaValue(home.specific_home_area) ?? legacySpecificHomeArea;

  const legacySchoolArea = selectedSchoolAreasFromFlags(normalisedRegionalFlags);
  const explicitSchoolAreas = normaliseSchoolAreas(home.school_areas);
  const singleSchoolArea = typeof home.school_area === 'string' && SCHOOL_AREA_SPECIAL_VALUES.has(home.school_area)
    ? home.school_area as SchoolAreaValue
    : null;
  const singleSchoolAreaOption = typeof home.school_area === 'string' && SCHOOL_AREA_OPTION_VALUES.has(home.school_area as SchoolAreaOption)
    ? home.school_area as SchoolAreaOption
    : null;
  const legacySchoolAreaFromArray = explicitSchoolAreas.length === 1
    ? explicitSchoolAreas[0]
    : explicitSchoolAreas.length > 1
      ? 'unknown'
      : null;
  const explicitSchoolArea = singleSchoolAreaOption ?? singleSchoolArea;
  const schoolArea = explicitSchoolArea ?? resolveLegacySchoolArea(legacySchoolAreaFromArray, legacySchoolArea);
  const homeWithoutLegacySchoolAreas = { ...home };
  delete homeWithoutLegacySchoolAreas.school_areas;
  const projectedRegionalFlags = applyFlagProjectionFromConsolidatedFields(
    normalisedRegionalFlags,
    homeRegion,
    specificHomeArea,
    schoolArea,
  );

  return {
    ...empty,
    ...saved,
    home_area_region: {
      ...empty.home_area_region,
      ...homeWithoutLegacySchoolAreas,
      postcode: typeof home.postcode === 'string' ? home.postcode : '',
      polar4_quintile: polar4,
      imd_quintile: imd,
      tundra_quintile: tundra,
      home_region: homeRegion,
      specific_home_area: specificHomeArea,
      school_area: schoolArea,
      acorn_quintile: home.acorn_quintile === null || home.acorn_quintile === undefined
        ? null
        : normaliseQuintile(home.acorn_quintile),
      simd_quintile: normaliseOptionalQuintile(home.simd_quintile ?? (flags.simd20 === true ? 'q1' : flags.simd40 === true ? 'q2' : undefined)),
      mem_quintile: home.mem_quintile === null || home.mem_quintile === undefined
        ? null
        : normaliseQuintile(home.mem_quintile),
      regional_flags: projectedRegionalFlags,
      postcode_lookup: {
        status: safeLookupStatus,
        normalised_postcode: typeof lookup.normalised_postcode === 'string' ? lookup.normalised_postcode : undefined,
        looked_up_postcode: typeof lookup.looked_up_postcode === 'string' ? lookup.looked_up_postcode : undefined,
        stale: lookup.stale === true,
        values: {
          polar4: {
            value: quintileNumber(polar4),
            source: sourceForQuintile(asRecord(lookupValues.polar4).source, polar4),
          },
          tundra: {
            value: quintileNumber(tundra),
            source: sourceForQuintile(asRecord(lookupValues.tundra).source, tundra),
          },
          imd: {
            value: quintileNumber(imd),
            source: sourceForQuintile(asRecord(lookupValues.imd).source, imd),
            dataset_year: 2019,
          },
        },
      },
    },
    financial_support: {
      ...normaliseAnswerRecord(saved.financial_support, normaliseTriState),
      ...(flags.free_school_meals === true ? { free_school_meals: 'yes' as const } : {}),
      ...(flags.ucat_bursary === true ? { ucat_bursary_recipient: 'yes' as const } : {}),
    },
    school_education: {
      ...empty.school_education,
      ...normaliseAnswerRecord(saved.school_education, normaliseTriState),
    },
    personal_circumstances: {
      ...normalisePersonalCircumstances(saved.personal_circumstances),
      ...(flags.care_experienced === true ? { care_experienced: 'yes' as const } : {}),
      ...(flags.refugee === true || flags.refugee_or_asylum_seeker === true ? { refugee: 'yes' as const } : {}),
      ...(flags.asylum_seeker === true ? { seeking_asylum: 'yes' as const } : {}),
      ...(flags.first_generation_higher_education === true ? { first_in_family_at_university: 'yes' as const } : {}),
    },
    access_programmes: {
      ...empty.access_programmes,
      ...access,
      participation_status: normaliseTriState(access.participation_status) ?? empty.access_programmes.participation_status,
      ukwpmed: {
        ...empty.access_programmes.ukwpmed,
        ...ukwpmed,
        status: normaliseTriState(ukwpmed.status) ?? (programmeId ? 'yes' : empty.access_programmes.ukwpmed.status),
        programme_id: programmeId,
        programme_status: normaliseProgrammeStatus(ukwpmed.programme_status ?? legacyUkwpmedRecord.status),
        provider_university_id:
          typeof ukwpmed.provider_university_id === 'string' && ukwpmed.provider_university_id
            ? ukwpmed.provider_university_id
            : providerUniversityIdForUkwpmed(programmeId) ?? '',
        completion_year: typeof ukwpmed.completion_year === 'number' ? ukwpmed.completion_year : '',
        not_sure_programme: ukwpmed.not_sure_programme === true,
      },
      other_programmes: otherProgrammes.map((entry) => {
        const record = asRecord(entry);
        return {
          programme_id: typeof record.programme_id === 'string' ? record.programme_id : '',
          status: normaliseProgrammeStatus(record.status),
          programme_name: typeof record.programme_name === 'string' ? record.programme_name : undefined,
        };
      }).filter((entry) => entry.programme_id),
      other_programme_name: typeof access.other_programme_name === 'string' ? access.other_programme_name : '',
    },
    partner_schools: {
      ...empty.partner_schools,
      ...partnerSchools,
      status: normaliseTriState(partnerSchools.status) ?? empty.partner_schools.status,
      relationships: Array.isArray(partnerSchools.relationships)
        ? partnerSchools.relationships.map((entry) => {
            const record = asRecord(entry);
            return {
              university_id: typeof record.university_id === 'string' ? record.university_id : '',
              university_name: typeof record.university_name === 'string' ? record.university_name : undefined,
              school_name: typeof record.school_name === 'string' ? record.school_name : '',
              relationship_type: typeof record.relationship_type === 'string' ? record.relationship_type : undefined,
              status: normaliseTriState(record.status) ?? '',
            };
          })
        : [],
    },
  };
}

function normaliseAnswerRecord<T extends string>(
  value: unknown,
  normalise: (answer: unknown) => T | undefined,
): Record<string, T | undefined> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).flatMap(([key, answer]) => {
      const normalised = normalise(answer);
      return normalised ? [[key, normalised]] : [];
    }),
  );
}

function loadStoredProfile(): WizardProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyProfile();
    const parsed = JSON.parse(raw);
    return normaliseStoredProfile(parsed);
  } catch {
    return createEmptyProfile();
  }
}

export function useWizardProfile() {
  const [profile, setProfile] = useState<WizardProfile>(loadStoredProfile);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage may be unavailable (private browsing, quota); proceed without persistence.
    }
  }, [profile]);

  const updateProfile = useCallback((updater: (prev: WizardProfile) => WizardProfile) => {
    setProfile(updater);
  }, []);

  const resetProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setProfile(createEmptyProfile());
  }, []);

  return { profile, updateProfile, resetProfile };
}
