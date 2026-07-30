#!/usr/bin/env node

const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/app');
const { loadIndex, isProductionReady } = require('../src/universities');

function requestJson(server, path) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
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
  const app = createApp();
  const server = await listenLocalhost(app);

  try {
    const health = await requestJson(server, '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.json.status, 'ok');
    console.log('PASS: GET /api/health returns 200 ok');

    const response = await requestJson(server, '/api/universities');
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.json.universities));
    console.log('PASS: GET /api/universities returns an array');

    const expectedIds = loadIndex()
      .universities.filter(isProductionReady)
      .map((u) => u.id)
      .sort();
    const actualIds = response.json.universities.map((u) => u.id).sort();

    assert.deepStrictEqual(actualIds, expectedIds);
    console.log(`PASS: /api/universities returns exactly the ${expectedIds.length} readiness-bundle-satisfying profile(s) from data/index.json`);

    assert.ok(expectedIds.includes('keele-a100'), 'expected keele-a100 to be included in the production-ready set');
    console.log('PASS: keele-a100 is included in the response');
    assert.ok(expectedIds.includes('buckingham-71a8'), 'expected buckingham-71a8 eligibility-only profile to be included in the production-ready set');
    const buckingham = response.json.universities.find((u) => u.id === 'buckingham-71a8');
    assert.strictEqual(buckingham.course_code, '71A8');
    assert.strictEqual(buckingham.uses_ucat, false);
    assert.strictEqual(buckingham.assessment_mode, 'eligibility_only');
    assert.strictEqual(buckingham.interview_prediction_available, false);
    console.log('PASS: buckingham-71a8 is included as an eligibility-only no-UCAT course');

    assert.strictEqual(response.json.count, response.json.universities.length);
    console.log('PASS: count field matches returned array length');

    const fullIndex = loadIndex();
    const nonProductionReadyIds = fullIndex.universities
      .filter((u) => !isProductionReady(u))
      .map((u) => u.id);
    assert.ok(nonProductionReadyIds.length > 0, 'expected at least one non-ready (inactive/seed) profile in fixture data to make this test meaningful');
    const leaked = actualIds.filter((id) => nonProductionReadyIds.includes(id));
    assert.deepStrictEqual(leaked, []);
    console.log('PASS: no inactive/seed profile (failing the readiness bundle) is present in the response');

    for (const uni of response.json.universities) {
      assert.strictEqual(typeof uni.id, 'string');
      assert.strictEqual(typeof uni.university_name, 'string');
      assert.strictEqual(typeof uni.course_code, 'string');
      assert.strictEqual(typeof uni.selection_style?.key, 'string');
      assert.strictEqual(typeof uni.selection_style?.label, 'string');
      assert.strictEqual(typeof uni.selection_style?.summary, 'string');
      assert.strictEqual(typeof uni.sjt_policy?.role, 'string');
      assert.strictEqual(typeof uni.sjt_policy?.summary, 'string');
      assert.strictEqual(typeof uni.academic_requirements?.gcse, 'string');
      assert.strictEqual(typeof uni.academic_requirements?.a_level, 'string');
      assert.strictEqual(typeof uni.academic_requirements?.scottish, 'string');
      assert.strictEqual(typeof uni.academic_requirements?.ib, 'string');
      if (uni.contextual_support) {
        assert.strictEqual(typeof uni.contextual_support.available, 'boolean');
        assert.ok(
          uni.contextual_support.a_level === null || typeof uni.contextual_support.a_level === 'string',
          `${uni.id} contextual A-level support must be string or null`
        );
        assert.ok(
          uni.contextual_support.ib === null || typeof uni.contextual_support.ib === 'string',
          `${uni.id} contextual IB support must be string or null`
        );
      }
      assert.strictEqual(typeof uni.interview_format, 'string');
      assert.notStrictEqual(uni.interview_format, 'Interview', `${uni.id} must not expose a generic interview format`);
      assert.notStrictEqual(uni.interview_format, 'Not Modelled', `${uni.id} must not expose implementation wording for interview format`);
      assert.ok(Array.isArray(uni.supported_route_tags));
      assert.ok(
        !Object.prototype.hasOwnProperty.call(uni, 'prediction_confidence'),
        `${uni.id} must not expose internal prediction_confidence on the student-facing universities API`
      );
      assert.ok(
        !Object.prototype.hasOwnProperty.call(uni, 'manual_review_required'),
        `${uni.id} must not expose university-level manual_review_required on the student-facing universities API`
      );
    }
    console.log('PASS: each returned university has expected public explorer shape with no internal confidence/manual-review metadata');

    const birmingham = response.json.universities.find((u) => u.id === 'birmingham-a100');
    assert.strictEqual(
      birmingham.selection_approach_display,
      "Applicants are assessed using the university's published selection score, which combines GCSE performance and UCAT."
    );
    console.log('PASS: /api/universities exposes metadata selection_approach_display where configured');

    const contextualOfferProfile = response.json.universities.find((u) => u.contextual_support?.a_level);
    assert.ok(contextualOfferProfile, 'expected at least one ready university to expose contextual A-level support');
    console.log('PASS: contextual academic support is exposed for universities with encoded contextual offers');

    const hullYork = response.json.universities.find((u) => u.id === 'hull-york-a100');
    assert.ok(hullYork.interview_format.includes('Home applicants: Five-station in-person MMI (Multiple Mini Interviews)'));
    assert.ok(hullYork.interview_format.includes('International applicants: Six-station online MMI (Multiple Mini Interviews)'));
    const leeds = response.json.universities.find((u) => u.id === 'leeds-a100');
    assert.strictEqual(leeds.interview_format, 'Published interview format not specified.');
    console.log('PASS: public interview format wording is student-facing and avoids generic/internal values');

    const readyIndexEntries = loadIndex().universities.filter(isProductionReady);
    assert.ok(
      readyIndexEntries.some((u) => Object.prototype.hasOwnProperty.call(u, 'prediction_confidence')),
      'Internal prediction_confidence metadata must remain available in data/index.json for governance.'
    );
    assert.ok(
      readyIndexEntries.some((u) => Object.prototype.hasOwnProperty.call(u, 'manual_review_required')),
      'Internal manual_review_required metadata must remain available in data/index.json for governance.'
    );
    console.log('PASS: internal readiness metadata remains available in the index');

    console.log('\nAll universities API smoke tests passed.');
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
