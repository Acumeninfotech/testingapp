import { useEffect, useRef, useState, type ReactNode } from 'react';
import { lookupContextualPostcode } from '../../api/client';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import {
  FINANCIAL_SUPPORT_FIELDS,
  HOME_QUINTILE_FIELDS,
  HOME_REGION_OPTIONS,
  OTHER_ACCESS_PROGRAMMES,
  PARTNER_SCHOOL_UNIVERSITY_OPTIONS,
  PERSONAL_CIRCUMSTANCE_FIELDS,
  PROGRAMME_STATUS_OPTIONS,
  QUINTILE_OPTIONS,
  SCHOOL_EDUCATION_FIELDS,
  SCHOOL_AREA_OPTIONS,
  SPECIFIC_HOME_AREA_OPTIONS,
  SENSITIVE_OPTIONS,
  UKWPMED_REGISTRY,
  YES_NO_NOT_SURE_OPTIONS,
  programmeLabel,
  providerUniversityIdForUkwpmed,
  universityLabel,
} from '../contextualRegistry';
import type {
  ContextualProfile,
  ContextualValueSource,
  HomeRegionValue,
  OtherAccessProgramme,
  PostcodeLookupMetadata,
  PostcodeLookupStatus,
  PartnerSchoolRelationship,
  ProgrammeStatus,
  QuintileValue,
  SchoolAreaValue,
  SpecificHomeAreaValue,
  SensitiveAnswer,
  YesNoNotSure,
} from '../profileTypes';
import type { StepProps } from './StepProps';

type AnswerGroupName = 'financial_support' | 'school_education' | 'personal_circumstances';
type ContextualAccordionId =
  | 'home_area_region'
  | 'financial_support'
  | 'school_education'
  | 'personal_circumstances'
  | 'access_programmes'
  | 'partner_schools';
type LookupDatasetKey = 'polar4' | 'tundra' | 'imd';
type LookupHomeKey = 'polar4_quintile' | 'tundra_quintile' | 'imd_quintile';

const POSTCODE_LOOKUP_FIELDS: {
  key: LookupHomeKey;
  lookupKey: LookupDatasetKey;
  responseKey: 'polar4_quintile' | 'tundra_quintile' | 'imd_quintile';
}[] = [
  { key: 'polar4_quintile', lookupKey: 'polar4', responseKey: 'polar4_quintile' },
  { key: 'tundra_quintile', lookupKey: 'tundra', responseKey: 'tundra_quintile' },
  { key: 'imd_quintile', lookupKey: 'imd', responseKey: 'imd_quintile' },
];

const HOME_REGION_FLAG_KEYS = [
  'south_west_england_resident',
  'north_west_england_resident',
  'north_east_england_or_cumbria_resident',
  'east_of_england_resident',
] as const;

const SPECIFIC_HOME_AREA_FLAG_KEYS = ['essex_resident', 'lincolnshire_resident'] as const;
const SCHOOL_AREA_FLAG_KEYS = [
  'northern_ireland_bt_postcode_school_to_year_12',
  'bristol_bs_ba_state_school',
  'keele_region_school',
] as const;
const SCHOOL_AREA_SELECTOR_OPTIONS = [
  ...SCHOOL_AREA_OPTIONS,
  { value: 'none', label: 'None of the above' },
  { value: 'unknown', label: 'Not sure' },
] as const;
const HOME_AREA_ERROR_KEYS = new Set([
  'polar4_quintile',
  'tundra_quintile',
  'imd_quintile',
  'home_region',
  'specific_home_area',
  'school_area',
  'school_areas',
]);

const HOME_REGION_TO_FLAG: Record<Exclude<HomeRegionValue, 'none' | 'unknown'>, typeof HOME_REGION_FLAG_KEYS[number]> = {
  south_west_england: 'south_west_england_resident',
  north_west_england: 'north_west_england_resident',
  north_east_england_or_cumbria: 'north_east_england_or_cumbria_resident',
  east_of_england: 'east_of_england_resident',
};

const SPECIFIC_HOME_AREA_TO_FLAG: Record<Exclude<SpecificHomeAreaValue, 'none' | 'unknown'>, typeof SPECIFIC_HOME_AREA_FLAG_KEYS[number]> = {
  essex: 'essex_resident',
  lincolnshire: 'lincolnshire_resident',
};

const SCHOOL_AREA_TO_FLAG: Record<Exclude<SchoolAreaValue, 'none' | 'unknown'>, typeof SCHOOL_AREA_FLAG_KEYS[number]> = {
  northern_ireland_bt_to_year_12: 'northern_ireland_bt_postcode_school_to_year_12',
  bristol_bs_ba_state_school: 'bristol_bs_ba_state_school',
  keele_region_school: 'keele_region_school',
};

function applyLegacyFlagGroup(
  flags: Record<string, YesNoNotSure | undefined>,
  keys: readonly string[],
  selectedKeys: string[],
  mode: 'known' | 'none' | 'unknown',
) {
  const next = { ...flags };

  for (const key of keys) {
    if (mode === 'unknown') {
      next[key] = 'not_sure';
      continue;
    }
    next[key] = selectedKeys.includes(key) ? 'yes' : 'no';
  }

  return next;
}

function clearLegacyFlagGroup(flags: Record<string, YesNoNotSure | undefined>, keys: readonly string[]) {
  const next = { ...flags };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function postcodeLookupStatusLabel(status: PostcodeLookupStatus) {
  if (status === 'matched') return 'Matched';
  if (status === 'partial_match') return 'Partially matched';
  if (status === 'not_found') return 'Not matched';
  if (status === 'error') return 'Error checking postcode';
  return 'Not checked';
}

function normalisePostcodeForUi(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function quintileValueFromNumber(value: number | null): QuintileValue {
  if (value === 1) return 'q1';
  if (value === 2) return 'q2';
  if (value === 3) return 'q3';
  if (value === 4) return 'q4';
  if (value === 5) return 'q5';
  return 'unknown';
}

function numberFromQuintileValue(value: QuintileValue): number | null {
  if (value === 'q1') return 1;
  if (value === 'q2') return 2;
  if (value === 'q3') return 3;
  if (value === 'q4') return 4;
  if (value === 'q5') return 5;
  return null;
}

function defaultPostcodeLookup(): PostcodeLookupMetadata {
  return {
    status: 'not_checked',
    values: {
      polar4: { value: null, source: 'unknown' },
      tundra: { value: null, source: 'unknown' },
      imd: { value: null, source: 'unknown', dataset_year: 2019 },
    },
  };
}

function sourceForField(lookup: PostcodeLookupMetadata | undefined, key: LookupDatasetKey): ContextualValueSource {
  return lookup?.values[key]?.source ?? 'unknown';
}

function canAutoPopulate(currentValue: QuintileValue, source: ContextualValueSource) {
  return currentValue === '' || currentValue === 'unknown' || source === 'unknown' || source === 'postcode_lookup';
}

function lookupStatusFromAvailability(matched: boolean, availability: Record<LookupDatasetKey, boolean>): PostcodeLookupStatus {
  if (!matched) return 'not_found';
  return availability.polar4 && availability.tundra && availability.imd ? 'matched' : 'partial_match';
}

function selectedAnswerCount(answers: Record<string, string | undefined>) {
  return Object.values(answers).filter((value) => value && value !== 'no').length;
}

function selectedQuintileCount(contextual: ContextualProfile) {
  return HOME_QUINTILE_FIELDS.filter(({ key }) => ['q1', 'q2'].includes(contextual.home_area_region[key])).length;
}

function selectedHomeAreaCount(contextual: ContextualProfile) {
  const home = contextual.home_area_region;
  const schoolSelectionCount = home.school_area ? 1 : 0;
  return (home.home_region ? 1 : 0) + (home.specific_home_area ? 1 : 0) + schoolSelectionCount;
}

function selectedAccessCount(contextual: ContextualProfile) {
  const { ukwpmed, other_programmes } = contextual.access_programmes;
  return (ukwpmed.status !== 'no' ? 1 : 0) + other_programmes.filter((programme) => programme.programme_id).length;
}

function fieldKeysFor(fields: readonly { key: string }[]) {
  return new Set(fields.map((field) => field.key));
}

const FINANCIAL_SUPPORT_ERROR_KEYS = fieldKeysFor(FINANCIAL_SUPPORT_FIELDS);
const SCHOOL_EDUCATION_ERROR_KEYS = fieldKeysFor(SCHOOL_EDUCATION_FIELDS);
const PERSONAL_CIRCUMSTANCE_ERROR_KEYS = fieldKeysFor(PERSONAL_CIRCUMSTANCE_FIELDS);

function accordionIdForErrorKey(key: string): ContextualAccordionId | null {
  if (HOME_AREA_ERROR_KEYS.has(key)) return 'home_area_region';
  if (FINANCIAL_SUPPORT_ERROR_KEYS.has(key)) return 'financial_support';
  if (SCHOOL_EDUCATION_ERROR_KEYS.has(key)) return 'school_education';
  if (PERSONAL_CIRCUMSTANCE_ERROR_KEYS.has(key)) return 'personal_circumstances';
  if (key.startsWith('ukwpmed_') || key.startsWith('other_programme_') || key.startsWith('other_access_')) {
    return 'access_programmes';
  }
  if (key === 'partner_schools' || key.startsWith('partner_school_')) return 'partner_schools';
  return null;
}

function firstAccordionIdWithError(errors: StepProps['errors']): ContextualAccordionId | null {
  for (const [key, message] of Object.entries(errors)) {
    if (!message) continue;
    const accordionId = accordionIdForErrorKey(key);
    if (accordionId) return accordionId;
  }
  return null;
}

function AccordionGroup({
  id,
  title,
  count,
  open,
  detailsRef,
  onToggle,
  children,
}: {
  id: ContextualAccordionId;
  title: string;
  count: number;
  open: boolean;
  detailsRef: (node: HTMLDetailsElement | null) => void;
  onToggle: (id: ContextualAccordionId, open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="contextual-accordion"
      open={open}
      ref={detailsRef}
      onToggle={(event) => onToggle(id, event.currentTarget.open)}
    >
      <summary>
        <span>{title}</span>
        <span className="contextual-count-badge" aria-label={`${count} selected`}>
          {count}
        </span>
      </summary>
      <div className="contextual-accordion-body">{children}</div>
    </details>
  );
}

function updateContextual(updateProfile: StepProps['updateProfile'], updater: (contextual: ContextualProfile) => ContextualProfile) {
  updateProfile((prev) => ({
    ...prev,
    contextual_profile: updater(prev.contextual_profile),
  }));
}

function AnswerSelect({
  id,
  label,
  value,
  options = YES_NO_NOT_SURE_OPTIONS,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options?: readonly { value: string; label: string }[];
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <SelectField
      id={id}
      label={label}
      value={value}
      options={[...options]}
      placeholder="Choose an answer"
      error={error}
      onChange={onChange}
    />
  );
}

function AnswerGrid({
  group,
  fields,
  profile,
  updateProfile,
}: {
  group: AnswerGroupName;
  fields: readonly { key: string; label: string }[];
  profile: StepProps['profile'];
  updateProfile: StepProps['updateProfile'];
}) {
  const values = profile.contextual_profile[group];
  const options = group === 'personal_circumstances' ? SENSITIVE_OPTIONS : YES_NO_NOT_SURE_OPTIONS;

  return (
    <div className="contextual-field-grid">
      {fields.map((field) => (
        <AnswerSelect
          key={field.key}
          id={`${group}_${field.key}`}
          label={field.label}
          value={values[field.key] ?? ''}
          options={options}
          onChange={(value) =>
            updateContextual(updateProfile, (contextual) => ({
              ...contextual,
              [group]: {
                ...contextual[group],
                [field.key]: (value || undefined) as YesNoNotSure | SensitiveAnswer | undefined,
              },
            }))
          }
        />
      ))}
    </div>
  );
}

function OtherProgrammeRow({
  programme,
  index,
  updateProfile,
}: {
  programme: OtherAccessProgramme;
  index: number;
  updateProfile: StepProps['updateProfile'];
}) {
  return (
    <div className="contextual-list-row">
      <div>
        <strong>{programmeLabel(programme.programme_id)}</strong>
        {programme.programme_id === 'other_access_wp_programme' && programme.programme_name && (
          <span>{programme.programme_name}</span>
        )}
      </div>
      <SelectField
        id={`other_programme_${index}_status`}
        label="Programme status"
        value={programme.status}
        options={PROGRAMME_STATUS_OPTIONS}
        placeholder="Select status"
        onChange={(value) =>
          updateContextual(updateProfile, (contextual) => ({
            ...contextual,
            access_programmes: {
              ...contextual.access_programmes,
              other_programmes: contextual.access_programmes.other_programmes.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, status: value as ProgrammeStatus | '' } : entry,
              ),
            },
          }))
        }
      />
      <button
        className="btn-secondary contextual-row-action"
        type="button"
        onClick={() =>
          updateContextual(updateProfile, (contextual) => ({
            ...contextual,
            access_programmes: {
              ...contextual.access_programmes,
              other_programmes: contextual.access_programmes.other_programmes.filter((_, entryIndex) => entryIndex !== index),
            },
          }))
        }
      >
        Remove
      </button>
    </div>
  );
}

function PartnerSchoolRow({
  relationship,
  index,
  updateProfile,
  error,
}: {
  relationship: PartnerSchoolRelationship;
  index: number;
  updateProfile: StepProps['updateProfile'];
  error?: string;
}) {
  const updateRelationship = (patch: Partial<PartnerSchoolRelationship>) => {
    updateContextual(updateProfile, (contextual) => ({
      ...contextual,
      partner_schools: {
        ...contextual.partner_schools,
        relationships: contextual.partner_schools.relationships.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...patch } : entry,
        ),
      },
    }));
  };

  return (
    <fieldset className="contextual-partner-row">
      <legend>Partner-school relationship {index + 1}</legend>
      <div className="field-row">
        <SelectField
          id={`partner_school_${index}_university`}
          label="University"
          value={relationship.university_id}
          options={[...PARTNER_SCHOOL_UNIVERSITY_OPTIONS]}
          placeholder="Select university"
          onChange={(value) => updateRelationship({ university_id: value })}
        />
        {relationship.university_id === 'other_university' && (
          <TextField
            id={`partner_school_${index}_university_name`}
            label="University name"
            value={relationship.university_name ?? ''}
            onChange={(value) => updateRelationship({ university_name: value })}
          />
        )}
      </div>
      <div className="field-row">
        <TextField
          id={`partner_school_${index}_school_name`}
          label="School or college name"
          value={relationship.school_name}
          error={error}
          onChange={(value) => updateRelationship({ school_name: value })}
        />
        <TextField
          id={`partner_school_${index}_relationship_type`}
          label="Relationship type"
          value={relationship.relationship_type ?? ''}
          hint="Optional"
          onChange={(value) => updateRelationship({ relationship_type: value })}
        />
      </div>
      <button
        className="btn-secondary contextual-row-action"
        type="button"
        onClick={() =>
          updateContextual(updateProfile, (contextual) => ({
            ...contextual,
            partner_schools: {
              ...contextual.partner_schools,
              relationships: contextual.partner_schools.relationships.filter((_, entryIndex) => entryIndex !== index),
            },
          }))
        }
      >
        Remove relationship
      </button>
    </fieldset>
  );
}

export function ContextualStep({ profile, updateProfile, errors }: StepProps) {
  const contextual = profile.contextual_profile;
  const accessProgrammes = contextual.access_programmes;
  const ukwpmed = accessProgrammes.ukwpmed;
  const homeArea = contextual.home_area_region;
  const postcodeLookup = homeArea.postcode_lookup ?? defaultPostcodeLookup();
  const [isCheckingPostcode, setIsCheckingPostcode] = useState(false);
  const [postcodeMessage, setPostcodeMessage] = useState<string | null>(null);
  const [expandedAccordions, setExpandedAccordions] = useState<Partial<Record<ContextualAccordionId, boolean>>>({});
  const accordionRefs = useRef<Partial<Record<ContextualAccordionId, HTMLDetailsElement | null>>>({});
  const lastErrorExpansion = useRef('');
  const availableOtherProgrammes = OTHER_ACCESS_PROGRAMMES.filter(
    (programme) => !accessProgrammes.other_programmes.some((entry) => entry.programme_id === programme.programme_id),
  );

  const setAccordionRef = (id: ContextualAccordionId) => (node: HTMLDetailsElement | null) => {
    accordionRefs.current[id] = node;
  };

  const handleAccordionToggle = (id: ContextualAccordionId, open: boolean) => {
    setExpandedAccordions((current) => ({
      ...current,
      [id]: open,
    }));
  };

  const errorSignature = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([key, message]) => `${key}:${message}`)
    .join('|');

  useEffect(() => {
    const firstInvalidAccordion = firstAccordionIdWithError(errors);
    if (!firstInvalidAccordion || !errorSignature) return;

    const expansionSignature = `${firstInvalidAccordion}:${errorSignature}`;
    if (lastErrorExpansion.current === expansionSignature) return;
    lastErrorExpansion.current = expansionSignature;

    setExpandedAccordions((current) => ({
      ...current,
      [firstInvalidAccordion]: true,
    }));

    window.requestAnimationFrame(() => {
      accordionRefs.current[firstInvalidAccordion]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [errorSignature, errors]);

  const updatePostcode = (value: string) => {
    updateContextual(updateProfile, (current) => {
      const home = current.home_area_region;
      const lookup = home.postcode_lookup ?? defaultPostcodeLookup();
      const lookedUpNormalised = lookup.normalised_postcode;
      const nextNormalised = normalisePostcodeForUi(value);
      const postcodeChangedAfterLookup = Boolean(lookedUpNormalised) && nextNormalised !== lookedUpNormalised;
      const nextHome = { ...home, postcode: value };

      if (postcodeChangedAfterLookup) {
        for (const field of POSTCODE_LOOKUP_FIELDS) {
          if (sourceForField(lookup, field.lookupKey) === 'postcode_lookup') {
            nextHome[field.key] = 'unknown';
          }
        }
        nextHome.postcode_lookup = {
          ...lookup,
          status: 'not_checked',
          stale: true,
          values: {
            polar4: {
              ...lookup.values.polar4,
              value: null,
              source: sourceForField(lookup, 'polar4') === 'postcode_lookup' ? 'unknown' : sourceForField(lookup, 'polar4'),
            },
            tundra: {
              ...lookup.values.tundra,
              value: null,
              source: sourceForField(lookup, 'tundra') === 'postcode_lookup' ? 'unknown' : sourceForField(lookup, 'tundra'),
            },
            imd: {
              ...lookup.values.imd,
              value: null,
              source: sourceForField(lookup, 'imd') === 'postcode_lookup' ? 'unknown' : sourceForField(lookup, 'imd'),
              dataset_year: 2019,
            },
          },
        };
      }

      return {
        ...current,
        home_area_region: nextHome,
      };
    });
    setPostcodeMessage(null);
  };

  const applyLookupValue = (key: LookupHomeKey, lookupKey: LookupDatasetKey) => {
    updateContextual(updateProfile, (current) => {
      const lookup = current.home_area_region.postcode_lookup ?? defaultPostcodeLookup();
      const suggestedValue = lookup.values[lookupKey]?.value ?? null;
      return {
        ...current,
        home_area_region: {
          ...current.home_area_region,
          [key]: quintileValueFromNumber(suggestedValue),
          postcode_lookup: {
            ...lookup,
            values: {
              ...lookup.values,
              [lookupKey]: {
                value: suggestedValue,
                source: 'postcode_lookup',
                ...(lookupKey === 'imd' ? { dataset_year: 2019 } : {}),
              },
            },
          },
        },
      };
    });
  };

  const setManualQuintile = (key: LookupHomeKey, lookupKey: LookupDatasetKey, value: string) => {
    updateContextual(updateProfile, (current) => {
      const lookup = current.home_area_region.postcode_lookup ?? defaultPostcodeLookup();
      const existingLookupValue = lookup.values[lookupKey]?.value ?? numberFromQuintileValue(value as QuintileValue);
      return {
        ...current,
        home_area_region: {
          ...current.home_area_region,
          [key]: value as QuintileValue,
          postcode_lookup: {
            ...lookup,
            values: {
              ...lookup.values,
              [lookupKey]: {
                value: existingLookupValue,
                source: value === 'unknown' || value === '' ? 'unknown' : 'manual',
                ...(lookupKey === 'imd' ? { dataset_year: 2019 } : {}),
              },
            },
          },
        },
      };
    });
  };

  const checkPostcode = async () => {
    const postcode = homeArea.postcode.trim();
    if (!postcode) {
      setPostcodeMessage('Enter a postcode to check, or select the contextual information manually.');
      return;
    }

    setIsCheckingPostcode(true);
    setPostcodeMessage('Checking postcode...');

    try {
      const result = await lookupContextualPostcode(postcode);
      updateContextual(updateProfile, (current) => {
        const lookup = current.home_area_region.postcode_lookup ?? defaultPostcodeLookup();
        const nextHome = {
          ...current.home_area_region,
          postcode: result.postcode || current.home_area_region.postcode,
        };
        const nextValues = { ...lookup.values };

        for (const field of POSTCODE_LOOKUP_FIELDS) {
          const returnedValue = result[field.responseKey];
          const currentValue = current.home_area_region[field.key];
          const currentSource = sourceForField(lookup, field.lookupKey);
          const shouldPopulate = returnedValue !== null && canAutoPopulate(currentValue, currentSource);

          if (shouldPopulate) {
            nextHome[field.key] = quintileValueFromNumber(returnedValue);
          }

          nextValues[field.lookupKey] = {
            value: returnedValue,
            source: shouldPopulate ? 'postcode_lookup' : currentSource,
            ...(field.lookupKey === 'imd' ? { dataset_year: 2019 } : {}),
          };
        }

        nextHome.postcode_lookup = {
          status: lookupStatusFromAvailability(result.matched, result.availability),
          normalised_postcode: result.normalised_postcode,
          looked_up_postcode: result.postcode,
          stale: false,
          values: nextValues,
        };

        return {
          ...current,
          home_area_region: nextHome,
        };
      });

      if (!result.matched) {
        setPostcodeMessage('We could not find this postcode. Please check it or enter the contextual information manually.');
      } else if (!result.availability.polar4 || !result.availability.tundra || !result.availability.imd) {
        setPostcodeMessage('Some postcode data is unavailable. Please select manually if known.');
      } else {
        setPostcodeMessage('Postcode checked.');
      }
    } catch {
      updateContextual(updateProfile, (current) => ({
        ...current,
        home_area_region: {
          ...current.home_area_region,
          postcode_lookup: {
            ...(current.home_area_region.postcode_lookup ?? defaultPostcodeLookup()),
            status: 'error',
            stale: false,
          },
        },
      }));
      setPostcodeMessage('We could not check the postcode at the moment. You can continue and enter the information manually.');
    } finally {
      setIsCheckingPostcode(false);
    }
  };

  const updateHomeRegion = (value: string) => {
    const normalised = (value || null) as HomeRegionValue | null;
    updateContextual(updateProfile, (current) => {
      const baseFlags = current.home_area_region.regional_flags ?? {};
      const nextFlags =
        normalised === null
          ? baseFlags
          : normalised === 'unknown'
            ? applyLegacyFlagGroup(baseFlags, HOME_REGION_FLAG_KEYS, [], 'unknown')
            : normalised === 'none'
              ? applyLegacyFlagGroup(baseFlags, HOME_REGION_FLAG_KEYS, [], 'none')
              : applyLegacyFlagGroup(baseFlags, HOME_REGION_FLAG_KEYS, [HOME_REGION_TO_FLAG[normalised]], 'known');

      return {
        ...current,
        home_area_region: {
          ...current.home_area_region,
          home_region: normalised,
          regional_flags: nextFlags,
        },
      };
    });
  };

  const updateSpecificHomeArea = (value: string) => {
    const normalised = (value || null) as SpecificHomeAreaValue | null;
    updateContextual(updateProfile, (current) => {
      const baseFlags = current.home_area_region.regional_flags ?? {};
      const nextFlags =
        normalised === null
          ? baseFlags
          : normalised === 'unknown'
            ? applyLegacyFlagGroup(baseFlags, SPECIFIC_HOME_AREA_FLAG_KEYS, [], 'unknown')
            : normalised === 'none'
              ? applyLegacyFlagGroup(baseFlags, SPECIFIC_HOME_AREA_FLAG_KEYS, [], 'none')
              : applyLegacyFlagGroup(baseFlags, SPECIFIC_HOME_AREA_FLAG_KEYS, [SPECIFIC_HOME_AREA_TO_FLAG[normalised]], 'known');

      return {
        ...current,
        home_area_region: {
          ...current.home_area_region,
          specific_home_area: normalised,
          regional_flags: nextFlags,
        },
      };
    });
  };

  const updateSchoolArea = (value: string) => {
    const normalised = (value || null) as SchoolAreaValue | null;
    updateContextual(updateProfile, (current) => {
      const baseFlags = current.home_area_region.regional_flags ?? {};
      const homeWithoutLegacySchoolAreas = { ...current.home_area_region };
      delete homeWithoutLegacySchoolAreas.school_areas;
      const nextFlags =
        normalised === null
          ? clearLegacyFlagGroup(baseFlags, SCHOOL_AREA_FLAG_KEYS)
          : normalised === 'unknown'
            ? applyLegacyFlagGroup(baseFlags, SCHOOL_AREA_FLAG_KEYS, [], 'unknown')
            : normalised === 'none'
              ? applyLegacyFlagGroup(baseFlags, SCHOOL_AREA_FLAG_KEYS, [], 'none')
              : applyLegacyFlagGroup(baseFlags, SCHOOL_AREA_FLAG_KEYS, [SCHOOL_AREA_TO_FLAG[normalised]], 'known');

      return {
        ...current,
        home_area_region: {
          ...homeWithoutLegacySchoolAreas,
          school_area: normalised,
          regional_flags: nextFlags,
        },
      };
    });
  };

  const hintForQuintile = (key: LookupHomeKey, lookupKey: LookupDatasetKey) => {
    const source = sourceForField(postcodeLookup, lookupKey);
    const lookupValue = postcodeLookup.values[lookupKey]?.value ?? null;
    const currentValue = homeArea[key];
    const suggestedValue = quintileValueFromNumber(lookupValue);

    if (source === 'postcode_lookup' && !postcodeLookup.stale) {
      return 'Automatically identified from your postcode.';
    }
    if (
      postcodeLookup.status === 'partial_match' &&
      lookupValue === null &&
      !postcodeLookup.stale
    ) {
      return 'Not available for this postcode. Please select manually if known.';
    }
    if (
      lookupValue !== null &&
      suggestedValue !== currentValue &&
      source !== 'postcode_lookup' &&
      !postcodeLookup.stale
    ) {
      return `Postcode lookup found Quintile ${lookupValue}.`;
    }
    return undefined;
  };

  return (
    <div className="step-grid contextual-step">
      <p>
        Share factual information that universities may ask about for contextual or widening-participation review.
        Each medical school applies its own criteria.
      </p>

      <AccordionGroup
        id="home_area_region"
        title="Home area & region"
        count={selectedQuintileCount(contextual) + selectedHomeAreaCount(contextual)}
        open={expandedAccordions.home_area_region === true}
        detailsRef={setAccordionRef('home_area_region')}
        onToggle={handleAccordionToggle}
      >
        <TextField
          id="contextual_postcode"
          label="Postcode"
          value={homeArea.postcode}
          hint={postcodeMessage ?? undefined}
          onChange={updatePostcode}
          onBlur={checkPostcode}
        />
        <TextField
          id="contextual_postcode_lookup_status"
          label="Postcode lookup status"
          value={postcodeLookupStatusLabel(postcodeLookup.status)}
          readOnly
          onChange={() => {}}
        />
        <button
          className="btn btn-secondary contextual-postcode-check"
          type="button"
          disabled={isCheckingPostcode}
          onClick={checkPostcode}
        >
          {isCheckingPostcode ? 'Checking postcode...' : 'Check postcode'}
        </button>

        <div className="contextual-field-grid">
          {HOME_QUINTILE_FIELDS.map(({ key, label }) => {
            const lookupField = POSTCODE_LOOKUP_FIELDS.find((field) => field.key === key);
            const hint = lookupField ? hintForQuintile(lookupField.key, lookupField.lookupKey) : undefined;
            const suggestedValue = lookupField
              ? quintileValueFromNumber(postcodeLookup.values[lookupField.lookupKey]?.value ?? null)
              : 'unknown';
            const shouldShowApply =
              lookupField &&
              suggestedValue !== 'unknown' &&
              suggestedValue !== homeArea[lookupField.key] &&
              sourceForField(postcodeLookup, lookupField.lookupKey) !== 'postcode_lookup' &&
              !postcodeLookup.stale;

            return (
              <div key={key} className="contextual-quintile-field">
                <SelectField
                  id={`contextual_${key}`}
                  label={label}
                  value={homeArea[key]}
                  options={[...QUINTILE_OPTIONS]}
                  hint={hint}
                  onChange={(value) => {
                    if (lookupField) {
                      setManualQuintile(lookupField.key, lookupField.lookupKey, value);
                      return;
                    }
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      home_area_region: { ...current.home_area_region, [key]: value },
                    }));
                  }}
                />
                {shouldShowApply && (
                  <button
                    className="btn-secondary contextual-apply-lookup"
                    type="button"
                    onClick={() => applyLookupValue(lookupField.key, lookupField.lookupKey)}
                  >
                    Apply postcode value
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <SelectField
          id="contextual_home_region"
          label="I live in"
          value={homeArea.home_region ?? ''}
          options={[...HOME_REGION_OPTIONS]}
          placeholder="Select an option"
          hint="Select the area in which your permanent home address is located."
          onChange={updateHomeRegion}
        />

        <SelectField
          id="contextual_specific_home_area"
          label="I live in the following area"
          value={homeArea.specific_home_area ?? ''}
          options={[...SPECIFIC_HOME_AREA_OPTIONS]}
          placeholder="Select an option"
          hint="Select an option if your permanent home address is in one of these areas."
          onChange={updateSpecificHomeArea}
        />

        <SelectField
          id="contextual_school_area"
          label="I attended school in"
          value={homeArea.school_area ?? ''}
          options={[...SCHOOL_AREA_SELECTOR_OPTIONS]}
          placeholder="Select an option"
          onChange={updateSchoolArea}
        />
      </AccordionGroup>

      <AccordionGroup
        id="financial_support"
        title="Financial support"
        count={selectedAnswerCount(contextual.financial_support)}
        open={expandedAccordions.financial_support === true}
        detailsRef={setAccordionRef('financial_support')}
        onToggle={handleAccordionToggle}
      >
        <AnswerGrid
          group="financial_support"
          fields={FINANCIAL_SUPPORT_FIELDS}
          profile={profile}
          updateProfile={updateProfile}
        />
      </AccordionGroup>

      <AccordionGroup
        id="school_education"
        title="School & education"
        count={selectedAnswerCount(contextual.school_education)}
        open={expandedAccordions.school_education === true}
        detailsRef={setAccordionRef('school_education')}
        onToggle={handleAccordionToggle}
      >
        <p className="form-field-hint">It is fine to choose Not sure for school-performance questions.</p>
        <AnswerGrid
          group="school_education"
          fields={SCHOOL_EDUCATION_FIELDS}
          profile={profile}
          updateProfile={updateProfile}
        />
      </AccordionGroup>

      <AccordionGroup
        id="personal_circumstances"
        title="Personal circumstances"
        count={selectedAnswerCount(contextual.personal_circumstances)}
        open={expandedAccordions.personal_circumstances === true}
        detailsRef={setAccordionRef('personal_circumstances')}
        onToggle={handleAccordionToggle}
      >
        <AnswerGrid
          group="personal_circumstances"
          fields={PERSONAL_CIRCUMSTANCE_FIELDS}
          profile={profile}
          updateProfile={updateProfile}
        />
      </AccordionGroup>

      <AccordionGroup
        id="access_programmes"
        title="Access / widening participation programmes"
        count={selectedAccessCount(contextual)}
        open={expandedAccordions.access_programmes === true}
        detailsRef={setAccordionRef('access_programmes')}
        onToggle={handleAccordionToggle}
      >
        <section className="contextual-subsection">
          <h3>UKWPMED programme</h3>
          <p className="form-field-hint">
            UKWPMED allows successful participants in recognised widening-participation programmes to receive
            consideration from participating medical schools. Each medical school applies its own admissions rules.
          </p>
          <AnswerSelect
            id="ukwpmed_status"
            label="Have you taken part in a recognised UKWPMED programme?"
            value={ukwpmed.status}
            error={errors.ukwpmed_status}
            onChange={(value) =>
              updateContextual(updateProfile, (current) => ({
                ...current,
                access_programmes: {
                  ...current.access_programmes,
                  ukwpmed: { ...current.access_programmes.ukwpmed, status: value as YesNoNotSure },
                },
              }))
            }
          />

          {ukwpmed.status === 'yes' && (
            <div className="contextual-conditional-panel">
              <SelectField
                id="ukwpmed_programme_id"
                label="Recognised programme"
                value={ukwpmed.programme_id}
                options={UKWPMED_REGISTRY.recognised_programmes.map((programme) => ({
                  value: programme.programme_id,
                  label: `${programme.label} - ${universityLabel(programme.provider_university_id)}`,
                }))}
                placeholder="Select programme"
                error={errors.ukwpmed_programme_id}
                onChange={(value) =>
                  updateContextual(updateProfile, (current) => ({
                    ...current,
                    access_programmes: {
                      ...current.access_programmes,
                      ukwpmed: {
                        ...current.access_programmes.ukwpmed,
                        programme_id: value,
                        provider_university_id: providerUniversityIdForUkwpmed(value) ?? '',
                        not_sure_programme: false,
                      },
                    },
                  }))
                }
              />
              <label className="checkbox-field contextual-inline-checkbox">
                <input
                  id="ukwpmed_not_sure_programme"
                  type="checkbox"
                  checked={ukwpmed.not_sure_programme}
                  onChange={(event) =>
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      access_programmes: {
                        ...current.access_programmes,
                        ukwpmed: {
                          ...current.access_programmes.ukwpmed,
                          not_sure_programme: event.target.checked,
                          programme_id: event.target.checked ? '' : current.access_programmes.ukwpmed.programme_id,
                          provider_university_id: event.target.checked
                            ? ''
                            : current.access_programmes.ukwpmed.provider_university_id,
                        },
                      },
                    }))
                  }
                />
                <span>I am not sure which programme</span>
              </label>
              <div className="field-row">
                <SelectField
                  id="ukwpmed_programme_status"
                  label="Programme status"
                  value={ukwpmed.programme_status}
                  options={PROGRAMME_STATUS_OPTIONS}
                  placeholder="Select status"
                  error={errors.ukwpmed_programme_status}
                  onChange={(value) =>
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      access_programmes: {
                        ...current.access_programmes,
                        ukwpmed: {
                          ...current.access_programmes.ukwpmed,
                          programme_status: value as ProgrammeStatus | '',
                        },
                      },
                    }))
                  }
                />
                <TextField
                  id="ukwpmed_completion_year"
                  label="Completion or expected completion year"
                  value={ukwpmed.completion_year}
                  type="number"
                  inputMode="numeric"
                  error={errors.ukwpmed_completion_year}
                  onChange={(value) =>
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      access_programmes: {
                        ...current.access_programmes,
                        ukwpmed: {
                          ...current.access_programmes.ukwpmed,
                          completion_year: value === '' ? '' : Number(value),
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
          )}
        </section>

        <section className="contextual-subsection">
          <h3>Other access and widening-participation programmes</h3>
          <AnswerSelect
            id="other_access_participation_status"
            label="Have you participated in, completed, or received an offer for another access or widening participation programme?"
            value={accessProgrammes.participation_status}
            onChange={(value) =>
              updateContextual(updateProfile, (current) => ({
                ...current,
                access_programmes: {
                  ...current.access_programmes,
                  participation_status: value as YesNoNotSure,
                },
              }))
            }
          />
          {accessProgrammes.participation_status === 'yes' && (
            <div className="contextual-conditional-panel">
              <div className="contextual-add-row">
                <SelectField
                  id="other_access_programme_selector"
                  label="Add a programme"
                  value=""
                  options={availableOtherProgrammes.map((programme) => ({
                    value: programme.programme_id,
                    label: programme.label,
                  }))}
                  placeholder="Select programme to add"
                  onChange={(value) => {
                    if (!value) return;
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      access_programmes: {
                        ...current.access_programmes,
                        other_programmes: [
                          ...current.access_programmes.other_programmes,
                          { programme_id: value, status: '' },
                        ],
                      },
                    }));
                  }}
                />
              </div>
              {accessProgrammes.other_programmes.map((programme, index) => (
                <OtherProgrammeRow
                  key={`${programme.programme_id}-${index}`}
                  programme={programme}
                  index={index}
                  updateProfile={updateProfile}
                />
              ))}
              {accessProgrammes.other_programmes.some((programme) => programme.programme_id === 'other_access_wp_programme') && (
                <TextField
                  id="other_access_programme_name"
                  label="Programme name"
                  value={accessProgrammes.other_programme_name}
                  error={errors.other_access_programme_name}
                  onChange={(value) =>
                    updateContextual(updateProfile, (current) => ({
                      ...current,
                      access_programmes: { ...current.access_programmes, other_programme_name: value },
                    }))
                  }
                />
              )}
            </div>
          )}
        </section>
      </AccordionGroup>

      <AccordionGroup
        id="partner_schools"
        title="Partner schools"
        count={contextual.partner_schools.status !== 'no' ? 1 : 0}
        open={expandedAccordions.partner_schools === true}
        detailsRef={setAccordionRef('partner_schools')}
        onToggle={handleAccordionToggle}
      >
        <AnswerSelect
          id="partner_schools_status"
          label="Have you attended a school or college identified as a partner, linked or target institution by a university?"
          value={contextual.partner_schools.status}
          error={errors.partner_schools}
          onChange={(value) =>
            updateContextual(updateProfile, (current) => ({
              ...current,
              partner_schools: { ...current.partner_schools, status: value as YesNoNotSure },
            }))
          }
        />
        {contextual.partner_schools.status === 'yes' && (
          <div className="contextual-conditional-panel">
            {contextual.partner_schools.relationships.map((relationship, index) => (
              <PartnerSchoolRow
                key={index}
                relationship={relationship}
                index={index}
                updateProfile={updateProfile}
                error={errors[`partner_school_${index}_school_name`]}
              />
            ))}
            <button
              className="btn-secondary"
              type="button"
              onClick={() =>
                updateContextual(updateProfile, (current) => ({
                  ...current,
                  partner_schools: {
                    ...current.partner_schools,
                    relationships: [
                      ...current.partner_schools.relationships,
                      { university_id: '', school_name: '', relationship_type: '', status: '' },
                    ],
                  },
                }))
              }
            >
              Add relationship
            </button>
          </div>
        )}
      </AccordionGroup>
    </div>
  );
}
