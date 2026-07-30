import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { UNIVERSITY_CODES } from './universityCodes';

interface IndexUniversity {
  id: string;
}

const requireServer = createRequire(import.meta.url);
const { loadIndex, isProductionReady } = requireServer('../../../server/src/universities') as {
  loadIndex: () => { universities: IndexUniversity[] };
  isProductionReady: (university: IndexUniversity) => boolean;
};

function productionReadyResultCardIds() {
  return loadIndex()
    .universities
    .filter(isProductionReady)
    .map((university) => university.id)
    .sort();
}

describe('UNIVERSITY_CODES', () => {
  it('has a code for every current production-ready Result Card university ID', () => {
    const missingIds = productionReadyResultCardIds().filter((id) => !UNIVERSITY_CODES[id]);

    expect(missingIds).toEqual([]);
  });

  it('does not assign duplicate codes to current production-ready Result Card universities', () => {
    const idsByCode = new Map<string, string[]>();

    for (const id of productionReadyResultCardIds()) {
      const code = UNIVERSITY_CODES[id];
      if (!code) continue;
      idsByCode.set(code, [...(idsByCode.get(code) ?? []), id]);
    }

    const duplicates = Array.from(idsByCode.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([code, ids]) => `${code}: ${ids.join(', ')}`);

    expect(duplicates).toEqual([]);
  });
});
