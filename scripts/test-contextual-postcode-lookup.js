#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  buildContextualPostcodeLookup,
  loadDataset
} = require('../assets/js/engine/contextual-postcode-importer');
const {
  normalisePostcodeForLookup
} = require('../assets/js/engine/postcode-normaliser');

async function writeCsv(filePath, rows) {
  await fs.writeFile(filePath, `${rows.join('\n')}\n`);
}

async function fixtureSources(tmpDir, overrides = {}) {
  const polar4 = path.join(tmpDir, overrides.polar4Name || 'polar4.csv');
  const tundra = path.join(tmpDir, overrides.tundraName || 'tundra.csv');
  const imd = path.join(tmpDir, overrides.imdName || 'imd.csv');

  await writeCsv(polar4, overrides.polar4 || [
    'postcode,polar4_quintile',
    ' bl3 5ab ,2',
    'AB12 3CD,4',
    'ZZ1 1ZZ,',
    'bl35ab,2',
  ]);
  await writeCsv(tundra, overrides.tundra || [
    'postcode,tundra_quintile',
    'BL35AB,3',
    'XY9 9XY,1',
  ]);
  await writeCsv(imd, overrides.imd || [
    'postcode,imd_score,imd_rank,imd_decile,imd_quintile',
    'BL3 5AB,10.2,123,1,1',
    'IM1 1IM,22.2,456,6,3',
  ]);

  return {
    polar4,
    tundra,
    imd
  };
}

async function buildFixture(overrides = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'applysmart-contextual-postcode-'));
  const sources = await fixtureSources(tmpDir, overrides);
  const output = path.join(tmpDir, 'postcode-contextual-lookup.json');
  const report = await buildContextualPostcodeLookup({ sources, output });
  const json = JSON.parse(await fs.readFile(output, 'utf8'));
  return { tmpDir, sources, output, report, json };
}

async function main() {
  assert.strictEqual(normalisePostcodeForLookup(' bl3 5ab '), 'BL35AB');
  assert.strictEqual(normalisePostcodeForLookup('BL35AB'), 'BL35AB');
  assert.strictEqual(normalisePostcodeForLookup('bl3 5ab'), 'BL35AB');
  assert.strictEqual(normalisePostcodeForLookup('   '), null);
  assert.strictEqual(normalisePostcodeForLookup('A'.repeat(33)), null);

  const { sources, output, report, json } = await buildFixture();
  assert.strictEqual(report.polar4SourceRows, 4);
  assert.strictEqual(report.tundraSourceRows, 2);
  assert.strictEqual(report.imdSourceRows, 2);
  assert.strictEqual(report.uniqueNormalisedPostcodes, 5);
  assert.strictEqual(report.postcodesWithAllThreeValues, 1);
  assert.strictEqual(report.postcodesWithPartialData, 4);
  assert.strictEqual(report.identicalDuplicateCount, 1);
  assert.strictEqual(report.conflictingDuplicateCount, 0);
  assert.strictEqual(report.invalidRowCount, 0);
  assert.ok((await fs.stat(output)).size > 0);

  assert.deepStrictEqual(json.postcodes.BL35AB, ['bl3 5ab', 2, 3, 1]);
  assert.deepStrictEqual(json.postcodes.AB123CD, ['AB12 3CD', 4, null, null]);
  assert.deepStrictEqual(json.postcodes.XY99XY, ['XY9 9XY', null, 1, null]);
  assert.deepStrictEqual(json.postcodes.IM11IM, ['IM1 1IM', null, null, 3]);
  assert.deepStrictEqual(json.postcodes.ZZ11ZZ, ['ZZ1 1ZZ', null, null, null]);

  await assert.rejects(
    () => loadDataset(sources.polar4, { label: 'POLAR4', postcodeColumn: 'missing', quintileColumn: 'polar4_quintile' }),
    /missing required column "missing"/,
  );

  await assert.rejects(
    () => buildFixture({ polar4: ['postcode,not_polar4', 'BL3 5AB,1'] }),
    /missing required column "polar4_quintile"/,
  );

  await assert.rejects(
    () => buildFixture({ polar4: ['postcode,polar4_quintile', 'BL3 5AB,6'] }),
    /invalid POLAR4 quintile "6"/,
  );

  await assert.rejects(
    () => buildFixture({ tundra: ['postcode,tundra_quintile', 'BL3 5AB,Quintile 2', 'BL3 5AB,Quintile 3'] }),
    /conflicting duplicate postcode BL35AB/,
  );

  await assert.rejects(
    () => buildFixture({ imd: ['postcode,imd_score,imd_rank,imd_decile,imd_quintile', '"BL3 5AB,10,20,1,1'] }),
    /malformed CSV row/,
  );

  await assert.rejects(
    () => buildContextualPostcodeLookup({
      sources: {
        polar4: path.join(os.tmpdir(), 'does-not-exist-polar4.csv'),
        tundra: sources.tundra,
        imd: sources.imd,
      },
      output,
    }),
    /source file could not be read/,
  );

  console.log('contextual postcode importer tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
