#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  calculateImdQuintile,
  verifyOutput,
} = require("./build-postcode-imd-lookup");

const BOUNDARY_CASES = [
  [1, 1],
  [2, 1],
  [3, 2],
  [4, 2],
  [5, 3],
  [6, 3],
  [7, 4],
  [8, 4],
  [9, 5],
  [10, 5],
];

async function main() {
  for (const [decile, expectedQuintile] of BOUNDARY_CASES) {
    assert.strictEqual(
      calculateImdQuintile(decile),
      expectedQuintile,
      `decile ${decile} should map to quintile ${expectedQuintile}`,
    );
  }

  assert.strictEqual(calculateImdQuintile(""), null);
  assert.strictEqual(calculateImdQuintile("0"), null);
  assert.strictEqual(calculateImdQuintile("11"), null);
  assert.strictEqual(calculateImdQuintile("4.5"), null);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "postcode-imd-test-"));

  await assertValidationPasses(
    tmpDir,
    "valid.csv",
    [
      "postcode,imd_score,imd_rank,imd_decile,imd_quintile",
      "AB1 2CD,12.345,1234,1,1",
      "EF3 4GH,23.456,2345,10,5",
    ].join("\n") + "\n",
  );

  await assertValidationFails(
    tmpDir,
    "bad-decile.csv",
    [
      "postcode,imd_score,imd_rank,imd_decile,imd_quintile",
      "AB1 2CD,12.345,1234,11,5",
    ].join("\n") + "\n",
    /IMD decile outside 1-10/,
  );

  await assertValidationFails(
    tmpDir,
    "bad-quintile.csv",
    [
      "postcode,imd_score,imd_rank,imd_decile,imd_quintile",
      "AB1 2CD,12.345,1234,10,6",
    ].join("\n") + "\n",
    /IMD quintile outside 1-5/,
  );

  await assertValidationFails(
    tmpDir,
    "mismatched-quintile.csv",
    [
      "postcode,imd_score,imd_rank,imd_decile,imd_quintile",
      "AB1 2CD,12.345,1234,9,4",
    ].join("\n") + "\n",
    /IMD quintile mismatch/,
  );

  console.log("postcode IMD quintile tests passed");
}

async function assertValidationPasses(tmpDir, fileName, contents) {
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, contents);
  await verifyOutput(filePath);
}

async function assertValidationFails(tmpDir, fileName, contents, expectedError) {
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, contents);

  await assert.rejects(() => verifyOutput(filePath), expectedError);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
