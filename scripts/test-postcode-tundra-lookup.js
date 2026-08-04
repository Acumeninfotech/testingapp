#!/usr/bin/env node

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const {
  buildTundraLookup,
  isNormalizedPostcode,
  isValidQuintile,
  loadMsoaTundraMappings,
  normalizeMsoaCode,
  normalizePostcode,
  verifyTundraOutput,
} = require("./build-postcode-tundra-lookup");

async function main() {
  assert.strictEqual(normalizePostcode(" aa1 1aa "), "AA1 1AA");
  assert.strictEqual(normalizePostcode("sw1a1aa"), "SW1A 1AA");
  assert.strictEqual(normalizeMsoaCode(" e02001021 "), "E02001021");
  assert.strictEqual(isNormalizedPostcode("AA1 1AA"), true);
  assert.strictEqual(isNormalizedPostcode("aa1 1aa"), false);
  assert.strictEqual(isValidQuintile("1"), true);
  assert.strictEqual(isValidQuintile("5"), true);
  assert.strictEqual(isValidQuintile("0"), false);
  assert.strictEqual(isValidQuintile("6"), false);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "postcode-tundra-test-"));
  const xlsxPath = path.join(tmpDir, "MSOA.xlsx");
  const postcodeSource = path.join(tmpDir, "Postcode-Lookup.csv");
  const outputPath = path.join(tmpDir, "postcode-tundra.csv");

  await writeFixtureWorkbook(xlsxPath, [
    ["MSOA", "Total population", "Progression rate", "Quintile"],
    ["E02000001", "100", "0.1", "1"],
    ["E02000002", "200", "0.2", "5"],
    ["E02000003", "300", "0.3", "6"],
  ]);

  await fs.writeFile(
    postcodeSource,
    [
      "postcode,MSOA_current,ignored",
      " aa1 1aa , e02000001 ,x",
      "AA11AA,E02000001,x",
      "BB11BB,E02000002,x",
      "CC11CC,E02099999,x",
      "DD11DD,,x",
      "EE11EE,E02000003,x",
    ].join("\n") + "\n",
  );

  const report = await buildTundraLookup({
    postcodeSource,
    msoaSource: xlsxPath,
    output: outputPath,
  });

  assert.deepStrictEqual(report.workbook.worksheetNames, [
    "Notes",
    "MSOA Quintile",
    "LSOA Quintile",
  ]);
  assert.strictEqual(report.workbook.worksheetUsed, "MSOA Quintile");
  assert.deepStrictEqual(report.workbook.headers, [
    "MSOA",
    "Total population",
    "Progression rate",
    "Quintile",
  ]);
  assert.strictEqual(report.workbook.msoaCodeColumn, "MSOA");
  assert.strictEqual(report.workbook.tundraQuintileColumn, "Quintile");
  assert.strictEqual(report.workbook.sampleRows.length, 3);

  assert.strictEqual(report.totalPostcodeSourceRows, 6);
  assert.strictEqual(report.rowsWithMsoaCodes, 5);
  assert.strictEqual(report.matchedPostcodeRows, 3);
  assert.strictEqual(report.unmatchedMsoaRows, 1);
  assert.strictEqual(report.missingMsoaRows, 1);
  assert.strictEqual(report.invalidQuintileRows, 1);
  assert.strictEqual(report.duplicatePostcodesRemoved, 1);
  assert.strictEqual(report.conflictingMappings, 0);
  assert.strictEqual(report.finalOutputRowCount, 2);
  assert.ok(report.outputFileSize > 0);

  await verifyTundraOutput(outputPath);

  const output = await fs.readFile(outputPath, "utf8");
  assert.strictEqual(
    output,
    [
      "postcode,tundra_quintile",
      "AA1 1AA,1",
      "BB1 1BB,5",
      "",
    ].join("\n"),
  );

  await assertValidationFails(
    tmpDir,
    "bad-header.csv",
    ["postcode,wrong", "AA1 1AA,1"].join("\n") + "\n",
    /Output headers must be exactly/,
  );
  await assertValidationFails(
    tmpDir,
    "duplicate-output.csv",
    ["postcode,tundra_quintile", "AA1 1AA,1", "AA1 1AA,1"].join("\n") + "\n",
    /Duplicate postcode/,
  );
  await assertValidationFails(
    tmpDir,
    "blank-output.csv",
    ["postcode,tundra_quintile", "AA1 1AA,"].join("\n") + "\n",
    /Blank TUNDRA quintile/,
  );
  await assertValidationFails(
    tmpDir,
    "bad-postcode-output.csv",
    ["postcode,tundra_quintile", "aa11aa,1"].join("\n") + "\n",
    /Postcode is not normalized/,
  );
  await assertValidationFails(
    tmpDir,
    "bad-quintile-output.csv",
    ["postcode,tundra_quintile", "AA1 1AA,6"].join("\n") + "\n",
    /TUNDRA quintile outside 1-5/,
  );

  await assertConflictingPostcodeFails(tmpDir, xlsxPath);
  await assertConflictingMsoaFails(tmpDir);

  console.log("postcode TUNDRA lookup tests passed");
}

async function assertValidationFails(tmpDir, fileName, contents, expectedError) {
  const filePath = path.join(tmpDir, fileName);
  await fs.writeFile(filePath, contents);
  await assert.rejects(() => verifyTundraOutput(filePath), expectedError);
}

async function assertConflictingPostcodeFails(tmpDir, xlsxPath) {
  const sourcePath = path.join(tmpDir, "postcode-conflict.csv");
  const outputPath = path.join(tmpDir, "postcode-conflict-output.csv");

  await fs.writeFile(
    sourcePath,
    [
      "postcode,MSOA_current",
      "AA11AA,E02000001",
      "AA1 1AA,E02000002",
    ].join("\n") + "\n",
  );

  await assert.rejects(
    () =>
      buildTundraLookup({
        postcodeSource: sourcePath,
        msoaSource: xlsxPath,
        output: outputPath,
      }),
    /AA1 1AA has conflicting TUNDRA quintiles: 1 vs 5/,
  );
}

async function assertConflictingMsoaFails(tmpDir) {
  const xlsxPath = path.join(tmpDir, "conflicting-MSOA.xlsx");
  await writeFixtureWorkbook(xlsxPath, [
    ["MSOA", "Quintile"],
    ["E02000001", "1"],
    ["E02000001", "2"],
  ]);

  assert.throws(
    () => loadMsoaTundraMappings(xlsxPath),
    /E02000001 has conflicting TUNDRA quintiles: 1 vs 2/,
  );
}

async function writeFixtureWorkbook(xlsxPath, msoaRows) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xlsx-fixture-"));
  await fs.mkdir(path.join(root, "xl", "_rels"), { recursive: true });
  await fs.mkdir(path.join(root, "xl", "worksheets"), { recursive: true });

  await fs.writeFile(
    path.join(root, "xl", "workbook.xml"),
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      "<sheets>",
      '<sheet name="Notes" sheetId="1" r:id="rId1"/>',
      '<sheet name="MSOA Quintile" sheetId="2" r:id="rId2"/>',
      '<sheet name="LSOA Quintile" sheetId="3" r:id="rId3"/>',
      "</sheets>",
      "</workbook>",
    ].join(""),
  );

  await fs.writeFile(
    path.join(root, "xl", "_rels", "workbook.xml.rels"),
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>',
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>',
      "</Relationships>",
    ].join(""),
  );
  await fs.writeFile(
    path.join(root, "xl", "sharedStrings.xml"),
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"></sst>',
  );

  await fs.writeFile(
    path.join(root, "xl", "worksheets", "sheet1.xml"),
    worksheetXml([["Notes"], ["Fixture workbook"]]),
  );
  await fs.writeFile(
    path.join(root, "xl", "worksheets", "sheet2.xml"),
    worksheetXml(msoaRows),
  );
  await fs.writeFile(
    path.join(root, "xl", "worksheets", "sheet3.xml"),
    worksheetXml([["LSOA", "Quintile"], ["E01000001", "1"]]),
  );

  execFileSync("zip", ["-qr", xlsxPath, "."], { cwd: root });
}

function worksheetXml(rows) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    ...rows.map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map(
            (value, columnIndex) =>
              `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`,
          )
          .join("")}</row>`,
    ),
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

function columnName(index) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
