const CURRENT_MEDICINE_ENTRY_YEAR = 2027;
const CURRENT_UCAT_TEST_YEAR = 2026;
const {
  normaliseALevelPracticalEndorsements
} = require('./science-practical-endorsement');
const {
  UKWPMED_PROGRAMME_BY_ID
} = require('./contextual-profile-registry');

function normaliseId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normaliseBooleanEvidence(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalised = normaliseId(value);
  if (['true', 'yes', 'y', 'confirmed', 'same_sitting'].includes(normalised)) {
    return true;
  }
  if (['false', 'no', 'n', 'not_confirmed', 'not_same_sitting'].includes(normalised)) {
    return false;
  }
  return null;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function normaliseTriState(value, fallback = undefined) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  const normalised = normaliseId(value);
  if (['yes', 'y', 'true'].includes(normalised)) return 'yes';
  if (['no', 'n', 'false'].includes(normalised)) return 'no';
  if (['not_sure', 'unsure', 'unknown'].includes(normalised)) return 'not_sure';
  return fallback;
}

function normaliseSensitiveAnswer(value) {
  const normalised = normaliseId(value);
  if (normalised === 'prefer_not_to_say') return 'prefer_not_to_say';
  return normaliseTriState(value);
}

function normaliseUkrainianVisaScheme(value) {
  const normalised = normaliseId(value);
  if ([
    'homes_for_ukraine',
    'ukraine_family_scheme',
    'ukraine_extension_scheme',
    'none',
    'not_sure'
  ].includes(normalised)) {
    return normalised;
  }
  return undefined;
}

function normaliseQuintile(value) {
  const normalised = normaliseId(value);
  if (['q1', 'q2', 'q3', 'q4', 'q5'].includes(normalised)) return normalised;
  if (['1', 'quintile_1', 'quintile1'].includes(normalised)) return 'q1';
  if (['2', 'quintile_2', 'quintile2'].includes(normalised)) return 'q2';
  if (['3', 'quintile_3', 'quintile3'].includes(normalised)) return 'q3';
  if (['4', 'quintile_4', 'quintile4'].includes(normalised)) return 'q4';
  if (['5', 'quintile_5', 'quintile5'].includes(normalised)) return 'q5';
  return 'unknown';
}

function normaliseOptionalQuintile(value) {
  if (value === undefined || value === null || value === '') return '';
  return normaliseQuintile(value);
}

function quintileNumber(value) {
  if (value === 'q1') return 1;
  if (value === 'q2') return 2;
  if (value === 'q3') return 3;
  if (value === 'q4') return 4;
  if (value === 'q5') return 5;
  return null;
}

function normaliseLookupStatus(value) {
  const normalised = normaliseId(value);
  if (['not_checked', 'matched', 'partial_match', 'not_found', 'error'].includes(normalised)) {
    return normalised;
  }
  return 'not_checked';
}

function normaliseValueSource(value, quintileValue) {
  const normalised = normaliseId(value);
  if (['postcode_lookup', 'manual', 'existing_profile', 'unknown'].includes(normalised)) {
    return normalised;
  }
  return quintileValue && quintileValue !== 'unknown' ? 'existing_profile' : 'unknown';
}

function normaliseProgrammeStatus(value) {
  const normalised = normaliseId(value);
  if (['offered', 'participating', 'completed', 'not_sure'].includes(normalised)) {
    return normalised;
  }
  return '';
}

function normaliseAnswerRecord(value, normaliseAnswer) {
  return Object.fromEntries(
    Object.entries(asObject(value))
      .map(([key, answer]) => [key, normaliseAnswer(answer)])
      .filter(([, answer]) => answer)
  );
}

function defaultContextualProfile() {
  return {
    home_area_region: {
      postcode: '',
      polar4_quintile: 'unknown',
      imd_quintile: 'unknown',
      tundra_quintile: 'unknown',
      simd_quintile: '',
      home_region: null,
      specific_home_area: null,
      school_area: null,
      regional_flags: {},
      postcode_lookup: {
        status: 'not_checked',
        values: {
          polar4: { value: null, source: 'unknown' },
          tundra: { value: null, source: 'unknown' },
          imd: { value: null, source: 'unknown', dataset_year: 2019 }
        }
      }
    },
    financial_support: {},
    school_education: {
      attended_uk_school_or_college_for_gcse_or_equivalent: 'not_sure',
      attended_uk_school_or_college_for_post16_or_equivalent: 'not_sure'
    },
    personal_circumstances: {
      care_over_three_months: 'not_sure',
      uk_refugee_status_granted: 'not_sure',
      ukrainian_visa_scheme: 'not_sure'
    },
    access_programmes: {
      participation_status: 'no',
      ukwpmed: {
        status: 'no',
        programme_id: '',
        programme_status: '',
        provider_university_id: '',
        completion_year: '',
        not_sure_programme: false
      },
      other_programmes: [],
      other_programme_name: ''
    },
    partner_schools: {
      status: 'no',
      relationships: []
    }
  };
}

const HOME_REGION_FLAG_TO_VALUE = {
  south_west_england_resident: 'south_west_england',
  north_west_england_resident: 'north_west_england',
  north_east_england_or_cumbria_resident: 'north_east_england_or_cumbria',
  east_of_england_resident: 'east_of_england'
};

const SPECIFIC_HOME_AREA_FLAG_TO_VALUE = {
  essex_resident: 'essex',
  lincolnshire_resident: 'lincolnshire',
  plymouth_widening_access_region_resident: 'plymouth_widening_access_region'
};

const SCHOOL_AREA_FLAG_TO_VALUE = {
  northern_ireland_bt_postcode_school_to_year_12: 'northern_ireland_bt_to_year_12',
  bristol_bs_ba_state_school: 'bristol_bs_ba_state_school',
  keele_region_school: 'keele_region_school'
};

function normaliseHomeRegionValue(value) {
  return ['south_west_england', 'north_west_england', 'north_east_england_or_cumbria', 'east_of_england', 'none', 'unknown'].includes(value)
    ? value
    : null;
}

function normaliseSpecificHomeAreaValue(value) {
  return [
    'essex',
    'lincolnshire',
    'plymouth_widening_access_region',
    'none',
    'unknown'
  ].includes(value)
    ? value
    : null;
}

function normaliseSchoolAreas(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => ['northern_ireland_bt_to_year_12', 'bristol_bs_ba_state_school', 'keele_region_school'].includes(entry));
}

function firstYesFromFlags(flags, map) {
  const selected = Object.entries(map)
    .filter(([flagKey]) => flags[flagKey] === 'yes')
    .map(([, mappedValue]) => mappedValue);

  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return 'unknown';

  const entries = Object.keys(map)
    .map((flagKey) => flags[flagKey])
    .filter((value) => value !== undefined);
  if (entries.length === 0) return null;
  if (entries.some((value) => value === 'not_sure')) return 'unknown';
  if (entries.every((value) => value === 'no')) return 'none';
  return null;
}

function selectedSchoolAreasFromFlags(flags) {
  const selected = Object.entries(SCHOOL_AREA_FLAG_TO_VALUE)
    .filter(([flagKey]) => flags[flagKey] === 'yes')
    .map(([, mappedValue]) => mappedValue);

  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return 'unknown';

  const entries = Object.keys(SCHOOL_AREA_FLAG_TO_VALUE)
    .map((flagKey) => flags[flagKey])
    .filter((value) => value !== undefined);
  if (entries.length === 0) return null;
  if (entries.some((value) => value === 'not_sure')) return 'unknown';
  if (entries.every((value) => value === 'no')) return 'none';
  return null;
}

function resolveLegacySchoolArea(...values) {
  const present = values.filter(Boolean);
  if (present.length === 0) return null;
  if (present.includes('unknown')) return 'unknown';
  return new Set(present).size === 1 ? present[0] : 'unknown';
}

function applyFlagProjectionFromConsolidatedFields(flags, homeRegion, specificHomeArea, schoolArea) {
  const next = { ...flags };

  const setMappedFlags = (keys, selectedKeys, mode) => {
    for (const key of keys) {
      if (mode === 'unknown') {
        next[key] = 'not_sure';
      } else {
        next[key] = selectedKeys.includes(key) ? 'yes' : 'no';
      }
    }
  };

  if (homeRegion) {
    const entries = Object.entries(HOME_REGION_FLAG_TO_VALUE);
    const keys = entries.map(([key]) => key);
    if (homeRegion === 'unknown') {
      setMappedFlags(keys, [], 'unknown');
    } else if (homeRegion === 'none') {
      setMappedFlags(keys, [], 'none');
    } else {
      setMappedFlags(keys, entries.filter(([, value]) => value === homeRegion).map(([key]) => key), 'known');
    }
  }

  if (specificHomeArea) {
    const entries = Object.entries(SPECIFIC_HOME_AREA_FLAG_TO_VALUE);
    const keys = entries.map(([key]) => key);
    if (specificHomeArea === 'unknown') {
      setMappedFlags(keys, [], 'unknown');
    } else if (specificHomeArea === 'none') {
      setMappedFlags(keys, [], 'none');
    } else {
      setMappedFlags(keys, entries.filter(([, value]) => value === specificHomeArea).map(([key]) => key), 'known');
    }
  }

  const schoolEntries = Object.entries(SCHOOL_AREA_FLAG_TO_VALUE);
  const schoolKeys = schoolEntries.map(([key]) => key);
  if (schoolArea === 'unknown') {
    setMappedFlags(schoolKeys, [], 'unknown');
  } else if (schoolArea === 'none') {
    setMappedFlags(schoolKeys, [], 'none');
  } else if (schoolArea) {
    setMappedFlags(schoolKeys, schoolEntries.filter(([, value]) => value === schoolArea).map(([key]) => key), 'known');
  }

  return next;
}

function legacyProgrammesFrom(value) {
  if (Array.isArray(value)) return value;
  const access = asObject(value);
  if (Array.isArray(access.access_programmes)) return access.access_programmes;
  if (Array.isArray(access.other_programmes)) return access.other_programmes;
  return [];
}

function normaliseContextualProfile(applicant, options = {}) {
  const defaults = defaultContextualProfile();
  const existing = asObject(applicant.contextual_profile);
  const identity = asObject(applicant.applicant_identity);
  const flags = asObject(identity.contextual_flags);
  const projectLegacyContextualCriteriaFlags = options.projectLegacyContextualCriteriaFlags !== false;
  const projectLegacyAccessProgrammes = options.projectLegacyAccessProgrammes !== false;
  const home = asObject(existing.home_area_region);
  const lookup = asObject(home.postcode_lookup);
  const lookupValues = asObject(lookup.values);
  const accessInput = existing.access_programmes ?? (
    projectLegacyAccessProgrammes ? applicant.access_programmes : undefined
  );
  const access = asObject(accessInput);
  const ukwpmedInput = asObject(access.ukwpmed);
  const legacyProgrammes = legacyProgrammesFrom(accessInput);
  const seenOtherProgrammeIds = new Set();
  const recognisedLegacyProgrammes = projectLegacyAccessProgrammes
    ? legacyProgrammes.filter((entry) => {
        const programmeId = asObject(entry).programme_id;
        return typeof programmeId === 'string' && UKWPMED_PROGRAMME_BY_ID[programmeId];
      })
    : [];
  const firstLegacyUkwpmed = asObject(recognisedLegacyProgrammes[0]);
  const ukwpmedProgrammeId =
    typeof ukwpmedInput.programme_id === 'string' && ukwpmedInput.programme_id
      ? ukwpmedInput.programme_id
      : typeof firstLegacyUkwpmed.programme_id === 'string'
        ? firstLegacyUkwpmed.programme_id
        : '';
  const ukwpmedProgramme = UKWPMED_PROGRAMME_BY_ID[ukwpmedProgrammeId];

  const otherProgrammes = [
    ...(Array.isArray(access.other_programmes) ? access.other_programmes : []),
    ...legacyProgrammes.filter((entry) => {
      const programmeId = asObject(entry).programme_id;
      return typeof programmeId !== 'string' || !UKWPMED_PROGRAMME_BY_ID[programmeId];
    })
  ]
    .map((entry) => {
      const record = asObject(entry);
      const programmeId = String(record.programme_id || '').trim();
      if (!programmeId || seenOtherProgrammeIds.has(programmeId)) return null;
      seenOtherProgrammeIds.add(programmeId);
      return {
        ...record,
        programme_id: programmeId,
        status: normaliseProgrammeStatus(record.status)
      };
    })
    .filter(Boolean);

  const polar4Quintile = normaliseQuintile(
    home.polar4_quintile ?? (projectLegacyContextualCriteriaFlags ? flags.polar_quintile : undefined)
  );
  const imdQuintile = normaliseQuintile(
    home.imd_quintile ?? (projectLegacyContextualCriteriaFlags ? flags.imd_quintile : undefined)
  );
  const tundraQuintile = normaliseQuintile(home.tundra_quintile);
  const normalisedRegionalFlags = normaliseAnswerRecord(home.regional_flags, normaliseTriState);
  const legacyHomeRegion = firstYesFromFlags(normalisedRegionalFlags, HOME_REGION_FLAG_TO_VALUE);
  const legacySpecificHomeArea = firstYesFromFlags(normalisedRegionalFlags, SPECIFIC_HOME_AREA_FLAG_TO_VALUE);
  const homeRegion = normaliseHomeRegionValue(home.home_region) ?? legacyHomeRegion;
  const specificHomeArea = normaliseSpecificHomeAreaValue(home.specific_home_area) ?? legacySpecificHomeArea;
  const legacySchoolArea = selectedSchoolAreasFromFlags(normalisedRegionalFlags);
  const explicitSchoolAreas = normaliseSchoolAreas(home.school_areas);
  const singleSchoolArea = ['none', 'unknown'].includes(home.school_area) ? home.school_area : null;
  const singleSchoolAreaOption = ['northern_ireland_bt_to_year_12', 'bristol_bs_ba_state_school', 'keele_region_school'].includes(home.school_area)
    ? home.school_area
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
    schoolArea
  );

  return {
    ...defaults,
    ...existing,
    home_area_region: {
      ...defaults.home_area_region,
      ...homeWithoutLegacySchoolAreas,
      postcode: typeof home.postcode === 'string' ? home.postcode : '',
      polar4_quintile: polar4Quintile,
      imd_quintile: imdQuintile,
      tundra_quintile: tundraQuintile,
      home_region: homeRegion,
      specific_home_area: specificHomeArea,
      school_area: schoolArea,
      acorn_quintile:
        home.acorn_quintile === null || home.acorn_quintile === undefined
          ? null
          : normaliseQuintile(home.acorn_quintile),
      simd_quintile: normaliseOptionalQuintile(
        home.simd_quintile ?? (
          projectLegacyContextualCriteriaFlags
            ? flags.simd20 === true ? 'q1' : flags.simd40 === true ? 'q2' : undefined
            : undefined
        )
      ),
      mem_quintile:
        home.mem_quintile === null || home.mem_quintile === undefined
          ? null
          : normaliseQuintile(home.mem_quintile),
      regional_flags: projectedRegionalFlags,
      postcode_lookup: {
        status: normaliseLookupStatus(lookup.status),
        normalised_postcode: typeof lookup.normalised_postcode === 'string' ? lookup.normalised_postcode : undefined,
        looked_up_postcode: typeof lookup.looked_up_postcode === 'string' ? lookup.looked_up_postcode : undefined,
        stale: lookup.stale === true,
        values: {
          polar4: {
            value: quintileNumber(polar4Quintile),
            source: normaliseValueSource(asObject(lookupValues.polar4).source, polar4Quintile)
          },
          tundra: {
            value: quintileNumber(tundraQuintile),
            source: normaliseValueSource(asObject(lookupValues.tundra).source, tundraQuintile)
          },
          imd: {
            value: quintileNumber(imdQuintile),
            source: normaliseValueSource(asObject(lookupValues.imd).source, imdQuintile),
            dataset_year: 2019
          }
        }
      }
    },
    financial_support: {
      ...normaliseAnswerRecord(existing.financial_support, normaliseTriState),
      ...(projectLegacyContextualCriteriaFlags && flags.free_school_meals === true ? { free_school_meals: 'yes' } : {}),
      ...(projectLegacyContextualCriteriaFlags && flags.ucat_bursary === true ? { ucat_bursary_recipient: 'yes' } : {})
    },
    school_education: {
      ...defaults.school_education,
      ...normaliseAnswerRecord(existing.school_education, normaliseTriState)
    },
    personal_circumstances: {
      ...defaults.personal_circumstances,
      ...normalisePersonalCircumstancesRecord(existing.personal_circumstances),
      ...(projectLegacyContextualCriteriaFlags && flags.care_experienced === true ? { care_experienced: 'yes' } : {}),
      ...(projectLegacyContextualCriteriaFlags && (flags.refugee === true || flags.refugee_or_asylum_seeker === true) ? { refugee: 'yes' } : {}),
      ...(projectLegacyContextualCriteriaFlags && flags.asylum_seeker === true ? { seeking_asylum: 'yes' } : {}),
      ...(projectLegacyContextualCriteriaFlags && flags.first_generation_higher_education === true ? { first_in_family_at_university: 'yes' } : {})
    },
    access_programmes: {
      ...defaults.access_programmes,
      ...access,
      participation_status: normaliseTriState(
        access.participation_status,
        otherProgrammes.length > 0 ? 'yes' : defaults.access_programmes.participation_status
      ),
      ukwpmed: {
        ...defaults.access_programmes.ukwpmed,
        ...ukwpmedInput,
        status: normaliseTriState(
          ukwpmedInput.status,
          ukwpmedProgrammeId ? 'yes' : defaults.access_programmes.ukwpmed.status
        ),
        programme_id: ukwpmedProgrammeId,
        programme_status: normaliseProgrammeStatus(
          ukwpmedInput.programme_status ?? firstLegacyUkwpmed.status
        ),
        provider_university_id:
          typeof ukwpmedInput.provider_university_id === 'string' && ukwpmedInput.provider_university_id
            ? ukwpmedInput.provider_university_id
            : ukwpmedProgramme?.provider_university_id || '',
        completion_year: Number.isInteger(ukwpmedInput.completion_year)
          ? ukwpmedInput.completion_year
          : '',
        not_sure_programme: ukwpmedInput.not_sure_programme === true
      },
      other_programmes: otherProgrammes,
      other_programme_name: typeof access.other_programme_name === 'string'
        ? access.other_programme_name
        : ''
    },
    partner_schools: normalisePartnerSchools(existing.partner_schools, defaults.partner_schools)
  };
}

function normalisePartnerSchools(value, defaults) {
  const partnerSchools = asObject(value);
  return {
    ...defaults,
    ...partnerSchools,
    status: normaliseTriState(partnerSchools.status, defaults.status),
    relationships: Array.isArray(partnerSchools.relationships)
      ? partnerSchools.relationships.map((entry) => {
          const record = asObject(entry);
          return {
            ...record,
            university_id: typeof record.university_id === 'string' ? record.university_id : '',
            university_name: typeof record.university_name === 'string' ? record.university_name : undefined,
            school_name: typeof record.school_name === 'string' ? record.school_name : '',
            relationship_type: typeof record.relationship_type === 'string' ? record.relationship_type : undefined,
            status: normaliseTriState(record.status, '')
          };
        })
      : []
  };
}

function normalisePersonalCircumstancesRecord(value) {
  return Object.fromEntries(
    Object.entries(asObject(value))
      .map(([key, answer]) => [
        key,
        key === 'ukrainian_visa_scheme'
          ? normaliseUkrainianVisaScheme(answer)
          : normaliseSensitiveAnswer(answer)
      ])
      .filter(([, answer]) => answer)
  );
}

function normaliseAgeAtCourseStartBand(value) {
  const normalised = normaliseId(value);
  if (['under_17', 'under17', 'under_seventeen'].includes(normalised)) {
    return 'under_17';
  }
  if (['age_17', '17', 'seventeen'].includes(normalised)) {
    return 'age_17';
  }
  if (['age_18', '18', 'eighteen'].includes(normalised)) {
    return 'age_18';
  }
  if (['age_19', '19', 'nineteen'].includes(normalised)) {
    return 'age_19';
  }
  if (['age_20', '20', 'twenty'].includes(normalised)) {
    return 'age_20';
  }
  if (['age_21_or_over', '21_or_over', '21_plus', 'twenty_one_or_over', 'over_21'].includes(normalised)) {
    return 'age_21_or_over';
  }
  if ([
    'age_18_or_over',
    '18_or_over',
    '18_plus',
    'over_18',
    'eighteen_or_over',
    'age_18_plus',
    'age_18_or_over_legacy'
  ].includes(normalised)) {
    return 'age_18_or_over_legacy';
  }
  if (['not_sure', 'unknown', 'unsure'].includes(normalised)) {
    return 'not_sure';
  }
  return null;
}

function evaluateAgeBandAgainstMinimum(ageBand, minimumAge) {
  const band = normaliseAgeAtCourseStartBand(ageBand);
  if (!band || !Number.isFinite(minimumAge)) {
    return null;
  }

  if (band === 'under_17') {
    return {
      status: 'fail',
      age: 16
    };
  }
  if (band === 'age_17') {
    if (minimumAge <= 17) {
      return {
        status: 'pass',
        age: 17
      };
    }
    return {
      status: 'manual_review',
      age: null,
      reason: 'minimum_age_requires_confirmation'
    };
  }
  if (band === 'age_18_or_over_legacy') {
    if (minimumAge <= 18) {
      return {
        status: 'pass',
        age: null
      };
    }
    return {
      status: 'manual_review',
      age: null,
      reason: 'minimum_age_requires_confirmation'
    };
  }
  if (['age_18', 'age_19', 'age_20', 'age_21_or_over'].includes(band) && minimumAge <= 18) {
    return {
      status: 'pass',
      age: Number(band.replace('age_', '').replace('_or_over', '')) || 18
    };
  }
  return {
    status: 'manual_review',
    age: null,
    reason: 'minimum_age_requires_confirmation'
  };
}

function evaluateAgeBandAgainstMaximumExclusive(ageBand, exclusiveMaximumAge) {
  const band = normaliseAgeAtCourseStartBand(ageBand);
  if (!band || !Number.isFinite(exclusiveMaximumAge)) {
    return null;
  }

  if (band === 'age_18_or_over_legacy') {
    return {
      status: 'manual_review',
      age: null,
      reason: 'maximum_age_requires_confirmation'
    };
  }

  const preciseAge =
    band === 'under_17' ? 16
      : band === 'age_17' ? 17
        : band === 'age_18' ? 18
          : band === 'age_19' ? 19
            : band === 'age_20' ? 20
              : band === 'age_21_or_over' ? 21
                : null;

  if (!Number.isFinite(preciseAge)) {
    return null;
  }

  return {
    status: preciseAge < exclusiveMaximumAge ? 'pass' : 'fail',
    age: preciseAge
  };
}

function normaliseALevelSameSittingEvidence(aLevelProfile, applicant) {
  if (!aLevelProfile || typeof aLevelProfile !== 'object') {
    return aLevelProfile;
  }

  const explicit = normaliseBooleanEvidence(aLevelProfile.completed_in_one_sitting);
  const aliases = [
    aLevelProfile.same_sitting_confirmed,
    aLevelProfile.same_sitting?.confirmed,
    aLevelProfile.same_sitting?.completed_in_one_sitting,
    applicant?.same_sitting_confirmed,
    applicant?.same_sitting?.confirmed,
    applicant?.same_sitting?.completed_in_one_sitting
  ];
  const aliasValue = aliases
    .map(normaliseBooleanEvidence)
    .find((value) => typeof value === 'boolean');

  return {
    ...aLevelProfile,
    completed_in_one_sitting:
      typeof explicit === 'boolean'
        ? explicit
        : aliasValue ?? aLevelProfile.completed_in_one_sitting
  };
}

function isStandardUndergraduateMedicine(applicant, course) {
  const identity = applicant?.applicant_identity || {};
  const target = applicant?.course_target || {};
  const courseCode = String(
    target.ucas_code ||
    course?.course?.ucas_code ||
    ''
  ).toUpperCase();
  const discipline = normaliseId(target.discipline || course?.course?.discipline || 'medicine');
  const route = normaliseId(
    applicant?.qualification_route ||
    target.course_route ||
    target.entry_route
  );
  const isGraduate =
    applicant?.graduate_profile?.is_graduate === true ||
    identity.graduate === true ||
    route === 'graduate';

  return (
    discipline === 'medicine' &&
    ['A100', 'A106'].includes(courseCode) &&
    !isGraduate
  );
}

function normaliseApplicantProfile(applicant, options = {}) {
  if (!applicant || typeof applicant !== 'object') {
    throw new TypeError('An applicant profile is required.');
  }
  const contextualProfileOptions = {
    ...(options.contextualProfileOptions || {})
  };
  if (options.course?.profile_id === 'birmingham-a100') {
    contextualProfileOptions.projectLegacyAccessProgrammes = false;
  }
  if (options.course?.profile_id === 'hull-york-a100') {
    contextualProfileOptions.projectLegacyContextualCriteriaFlags = false;
    contextualProfileOptions.projectLegacyAccessProgrammes = false;
  }
  if (options.course?.profile_id === 'king-s-college-london-a100') {
    contextualProfileOptions.projectLegacyContextualCriteriaFlags = false;
    contextualProfileOptions.projectLegacyAccessProgrammes = false;
  }

  const profile = applicant.a_level_profile
    ? {
        ...applicant,
        contextual_profile: normaliseContextualProfile(applicant, contextualProfileOptions),
        a_level_profile: normaliseALevelPracticalEndorsements(
          normaliseALevelSameSittingEvidence(
            applicant.a_level_profile,
            applicant
          )
        )
      }
    : {
        ...applicant,
        contextual_profile: normaliseContextualProfile(applicant, contextualProfileOptions)
      };

  if (!isStandardUndergraduateMedicine(profile, options.course)) {
    const identity = profile.applicant_identity || {};
    const ageBand = normaliseAgeAtCourseStartBand(identity.age_at_course_start_band);
    return {
      ...profile,
      applicant_identity: {
        ...identity,
        current_uk_residence: normaliseTriState(identity.current_uk_residence, 'not_sure'),
        ...(ageBand ? { age_at_course_start_band: ageBand } : {})
      }
    };
  }

  const admissionsTests = profile.admissions_tests || {};
  const ucat = admissionsTests.ucat || {};
  const identity = profile.applicant_identity || {};
  const ageBand = normaliseAgeAtCourseStartBand(identity.age_at_course_start_band);
  const ageOnReferenceDates = ageBand === 'under_17'
    ? {
        age_on_1_september: 16,
        age_on_1_october: 16
      }
    : ageBand === 'age_17'
      ? {
          age_on_1_september: 17
        }
      : ageBand === 'age_18'
        ? {
            age_on_1_september: 18,
            age_on_1_october: 18
          }
        : ageBand === 'age_19'
          ? {
              age_on_1_september: 19,
              age_on_1_october: 19
            }
          : ageBand === 'age_20'
            ? {
                age_on_1_september: 20,
                age_on_1_october: 20
              }
            : ageBand === 'age_21_or_over'
              ? {
                  age_on_1_september: 21,
                  age_on_1_october: 21
                }
              : {};

  return {
    ...profile,
    applicant_identity: {
      ...identity,
      current_uk_residence: normaliseTriState(identity.current_uk_residence, 'not_sure'),
      ...(ageBand ? { age_at_course_start_band: ageBand } : {}),
      ...ageOnReferenceDates
    },
    application_year:
      profile.application_year ?? CURRENT_MEDICINE_ENTRY_YEAR,
    admissions_tests: {
      ...admissionsTests,
      ucat: {
        ...ucat,
        test_year: ucat.test_year ?? CURRENT_UCAT_TEST_YEAR
      }
    }
  };
}

function expectedUcatTestYear(applicationYear) {
  if (applicationYear === CURRENT_MEDICINE_ENTRY_YEAR) {
    return CURRENT_UCAT_TEST_YEAR;
  }

  // Historic fixtures used application_year to mean the UCAT/application
  // calendar year. Preserve that convention outside the active 2027 cycle.
  return applicationYear;
}

function isUcatCycleValid(applicationYear, testYear) {
  return (
    Number.isInteger(applicationYear) &&
    Number.isInteger(testYear) &&
    testYear === expectedUcatTestYear(applicationYear)
  );
}

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11
};

function referenceDateForAge(rule, entryYear) {
  const label =
    rule.age_reference_date ||
    rule.minimum_age_date ||
    rule.minimum_age_policy ||
    rule.course_start_reference ||
    rule.age_date ||
    '1 September';
  const match = String(label).match(/(\d{1,2})\s+([A-Za-z]+)/);
  const day = match ? Number(match[1]) : 1;
  const month = match ? MONTH_INDEX[match[2].toLowerCase()] : MONTH_INDEX.september;

  return new Date(Date.UTC(
    entryYear,
    Number.isInteger(month) ? month : MONTH_INDEX.september,
    day
  ));
}

function ageAtDate(dateOfBirth, referenceDate) {
  if (!dateOfBirth || !(referenceDate instanceof Date)) {
    return null;
  }

  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > referenceDate) {
    return null;
  }

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
  return age;
}

function evaluateExplicitMinimumAge(course, applicant) {
  const rule =
    course?.stage_1_eligibility?.age_or_professional_checks ||
    course?.stage_1_eligibility?.age_or_degree ||
    {};
  const minimumAge = Number.isFinite(rule.minimum_age)
    ? rule.minimum_age
    : rule.minimum_age_by_course_start;
  const hasOfficialRequirement =
    Number.isFinite(minimumAge) &&
    Array.isArray(rule.source_ids) &&
    rule.source_ids.length > 0;

  if (!hasOfficialRequirement) {
    return {
      status: 'not_applicable',
      minimum_age: null,
      age: null,
      blocks_prediction: false
    };
  }

  const identity = applicant?.applicant_identity || {};
  const bandAssessment = evaluateAgeBandAgainstMinimum(
    identity.age_at_course_start_band,
    minimumAge
  );
  if (bandAssessment) {
    if (bandAssessment.status === 'manual_review') {
      return {
        status: 'manual_review',
        minimum_age: minimumAge,
        age: null,
        blocks_prediction: false,
        manual_review_reason: bandAssessment.reason
      };
    }
    return {
      status: bandAssessment.status,
      minimum_age: minimumAge,
      age: bandAssessment.age,
      blocks_prediction: bandAssessment.status === 'fail'
    };
  }

  const suppliedAge = identity.age_on_1_september;
  const entryYear =
    applicant?.entry_year ??
    applicant?.application_year ??
    course?.course?.entry_year ??
    CURRENT_MEDICINE_ENTRY_YEAR;
  const calculatedAge = Number.isFinite(suppliedAge)
    ? suppliedAge
    : ageAtDate(
        applicant?.applicant_identity?.date_of_birth,
        referenceDateForAge(rule, entryYear)
      );

  if (!Number.isFinite(calculatedAge)) {
    return {
      status: 'not_assessed',
      minimum_age: minimumAge,
      age: null,
      blocks_prediction: false
    };
  }

  const passed = calculatedAge >= minimumAge;
  return {
    status: passed ? 'pass' : 'fail',
    minimum_age: minimumAge,
    age: calculatedAge,
    blocks_prediction: !passed
  };
}

module.exports = {
  CURRENT_MEDICINE_ENTRY_YEAR,
  CURRENT_UCAT_TEST_YEAR,
  ageAtDate,
  evaluateExplicitMinimumAge,
  evaluateAgeBandAgainstMinimum,
  evaluateAgeBandAgainstMaximumExclusive,
  expectedUcatTestYear,
  isStandardUndergraduateMedicine,
  isUcatCycleValid,
  normaliseAgeAtCourseStartBand,
  normaliseContextualProfile,
  normaliseApplicantProfile
};
