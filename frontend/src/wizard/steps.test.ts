import { describe, expect, it } from 'vitest';
import { createEmptyProfile, type Domicile, type QualificationRoute } from './profileTypes';
import { getWizardSteps } from './steps';

function stepIdsFor(route: QualificationRoute, domicile: Domicile) {
  const profile = createEmptyProfile();
  profile.course_target.qualification_route = route;
  profile.applicant_identity.domicile = domicile;
  return getWizardSteps(profile).map((step) => step.id);
}

describe('getWizardSteps qualification-route academic flow', () => {
  it.each([
    ['scotland', 'scottish'],
    ['england', 'scottish'],
  ] as const)('uses Scottish qualifications without GCSE for %s domicile and %s route', (domicile, route) => {
    const ids = stepIdsFor(route, domicile);
    expect(ids).toContain('scottish');
    expect(ids).not.toContain('gcse');
    expect(ids).not.toContain('a-level');
    expect(ids.indexOf('scottish')).toBeGreaterThan(ids.indexOf('route'));
  });

  it.each([
    ['scotland', 'a_level'],
    ['england', 'a_level'],
  ] as const)('uses GCSE then A-level for %s domicile and %s route', (domicile, route) => {
    const ids = stepIdsFor(route, domicile);
    expect(ids).toContain('gcse');
    expect(ids).toContain('a-level');
    expect(ids).not.toContain('scottish');
    expect(ids.indexOf('gcse')).toBeLessThan(ids.indexOf('a-level'));
  });
});
