#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  buildPolar4Lookup,
  isNormalizedPostcode,
  isValidPolar4Quintile,
  normalizePostcode,
  verifyPolar4Output,
} = require("./build-postcode-polar4-lookup");

async function main() {
  assert.strictEqual(normalizePostcode(" ab10 1aa "), "AB10 1AA");
  assert.strictEqual(normalizePostcode("ab101aa"), "AB10 1AA");
  assert.strictEqual(normalizePostcode("SW1A1AA"), "SW1A 1AA");

  assert.strictEqual(isNormalizedPostcode("AB10 1AA"), true);
  assert.strictEqual(isNormalizedPostcode("ab10 1aa"), false);
  assert.strictEqual(isNormalizedPostcode("AB101AA"), false);

  for (const quintile of ["1", "2", "3", "4", "5"]) {
    assert.strictEqual(isValidPolar4Quintile(quintile), true);
  }
  for (const quintile of ["", "0", "6", "1.5", "NA"]) {
    assert.strictEqual(isValidPolar4Quintile(quintile), false);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "postcode-polar4-test-"));
  const sourcePath = path.join(tmpDir, "source.csv");
  const outputPath = path.join(tmpDir, "postcode-polar4.csv");

  await fs.writeFile(
    sourcePath,
    [
      "postcode,ignored,polar4_quintile",
      " ab10 1ab ,x,2",
      "AB101AA,x,1",
      "ZZ99 9ZZ,x,",
      "ZZ99 9ZY,x,NA",
      "AB10 1AA,x,1",
      "ab10 1ac,x,5",
    ].join("\n") + "\n",
  );

  const report = await buildPolar4Lookup({
    input: sourcePath,
    output: outputPath,
  });

  assert.strictEqual(report.totalSourceRows, 6);
  assert.strictEqual(report.validQuintileRows, 4);
  assert.strictEqual(report.missingQuintileRows, 1);
  assert.strictEqual(report.invalidQuintileRows, 1);
  assert.strictEqual(report.duplicateRowsRemoved, 1);
  assert.strictEqual(report.conflictingDuplicateCount, 0);
  assert.strictEqual(report.finalOutputRowCount, 3);
  assert.ok(report.outputFileSize > 0);

  await verifyPolar4Output(outputPath);

  const output = await fs.readFile(outputPath, "utf8");
  assert.strictEqual(
    output,
    [
      "postcode,polar4_quintile",
      "AB10 1AA,1",
      "AB10 1AB,2",
      "AB10 1AC,5",
      "",
    ].join("\n"),
  );

  await assertValidationFails(
    tmpDir,
    "duplicate-output.csv",
    [
      "postcode,polar4_quintile",
      "AB10 1AA,1",
      "AB10 1AA,1",
    ].join("\n") + "\n",
    /Duplicate postcode/,
  );

  await assertValidationFails(
    tmpDir,
    "bad-quintile-output.csv",
    [
      "postcode,polar4_quintile",
      "AB10 1AA,6",
    ].join("\n") + "\n",
    /POLAR4 quintile outside 1-5/,
  );

  await assertValidationFails(
    tmpDir,
    "bad-postcode-output.csv",
    [
      "postcode,polar4_quintile",
      "ab101aa,1",
    ].join("\n") + "\n",
    /Postcode is not normalized/,
  );

  await assertConflictingDuplicateFails(tmpDir);

  console.log("postcode POLAR4 lookup tests passed");
}

async function assertValidationFails(tmpDir, fileName, contents, expectedError) {
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, contents);
  await assert.rejects(() => verifyPolar4Output(filePath), expectedError);
}

async function assertConflictingDuplicateFails(tmpDir) {
  const sourcePath = path.join(tmpDir, "conflict-source.csv");
  const outputPath = path.join(tmpDir, "conflict-output.csv");

  await fs.writeFile(
    sourcePath,
    [
      "postcode,polar4_quintile",
      "AB101AA,1",
      "AB10 1AA,2",
    ].join("\n") + "\n",
  );

  await assert.rejects(
    () =>
      buildPolar4Lookup({
        input: sourcePath,
        output: outputPath,
      }),
    /AB10 1AA has conflicting POLAR4 quintiles: 1 vs 2/,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
