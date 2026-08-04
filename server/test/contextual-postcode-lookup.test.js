#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const {
  resetContextualPostcodeLookupCache
} = require('../src/contextual-postcode-lookup');

function requestJson(server, pathName) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http.get(`http://127.0.0.1:${port}${pathName}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function listenLocalhost(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1');
    server.on('listening', () => resolve(server));
    server.on('error', reject);
  });
}

async function main() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'applysmart-api-postcode-'));
  const lookupPath = path.join(tmpDir, 'lookup.json');
  await fs.writeFile(
    lookupPath,
    `${JSON.stringify({
      schema_version: 1,
      columns: ['postcode', 'polar4_quintile', 'tundra_quintile', 'imd_quintile'],
      imd_dataset_year: 2019,
      postcodes: {
        BL35AB: ['BL3 5AB', 2, 3, 1],
        AB123CD: ['AB12 3CD', 4, null, null],
      },
    })}\n`,
  );

  process.env.CONTEXTUAL_POSTCODE_LOOKUP_PATH = lookupPath;
  resetContextualPostcodeLookupCache();
  const server = await listenLocalhost(createApp());

  try {
    const complete = await requestJson(server, '/api/contextual/postcode-lookup?postcode=bl3%205ab');
    assert.strictEqual(complete.status, 200);
    assert.deepStrictEqual(complete.json, {
      matched: true,
      postcode: 'BL3 5AB',
      normalised_postcode: 'BL35AB',
      polar4_quintile: 2,
      tundra_quintile: 3,
      imd_quintile: 1,
      availability: {
        polar4: true,
        tundra: true,
        imd: true,
      },
    });

    const partial = await requestJson(server, '/api/contextual/postcode-lookup?postcode=AB12%203CD');
    assert.strictEqual(partial.status, 200);
    assert.strictEqual(partial.json.matched, true);
    assert.strictEqual(partial.json.polar4_quintile, 4);
    assert.strictEqual(partial.json.tundra_quintile, null);
    assert.strictEqual(partial.json.imd_quintile, null);
    assert.deepStrictEqual(partial.json.availability, {
      polar4: true,
      tundra: false,
      imd: false,
    });
    assert.deepStrictEqual(partial.json.warnings, [
      'TUNDRA data is unavailable for this postcode.',
      'IMD 2019 data is unavailable for this postcode.',
    ]);

    const noMatch = await requestJson(server, '/api/contextual/postcode-lookup?postcode=ZZ1%201ZZ');
    assert.strictEqual(noMatch.status, 200);
    assert.strictEqual(noMatch.json.matched, false);
    assert.strictEqual(noMatch.json.normalised_postcode, 'ZZ11ZZ');
    assert.deepStrictEqual(noMatch.json.availability, {
      polar4: false,
      tundra: false,
      imd: false,
    });

    const missing = await requestJson(server, '/api/contextual/postcode-lookup');
    assert.strictEqual(missing.status, 400);

    const invalid = await requestJson(server, '/api/contextual/postcode-lookup?postcode=not/a/postcode');
    assert.strictEqual(invalid.status, 400);

    process.env.CONTEXTUAL_POSTCODE_LOOKUP_PATH = path.join(tmpDir, 'missing.json');
    resetContextualPostcodeLookupCache();
    const failure = await requestJson(server, '/api/contextual/postcode-lookup?postcode=BL3%205AB');
    assert.strictEqual(failure.status, 500);
    assert.strictEqual(failure.json.error, 'Failed to check postcode');

    console.log('contextual postcode API tests passed');
  } finally {
    server.close();
    delete process.env.CONTEXTUAL_POSTCODE_LOOKUP_PATH;
    resetContextualPostcodeLookupCache();
  }
}

main().catch((error) => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
