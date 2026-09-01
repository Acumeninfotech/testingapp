#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const readline = require("readline");
const {
  findRequiredColumn: findRequiredPostcodeColumn,
  readPostcodeSourceHeaders,
  readPostcodeSourceRows,
  resolveDefaultPostcodeSource,
} = require("./postcode-source-reader");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_MSOA_SOURCE = path.join(REPO_ROOT, "postcode-lookup", "MSOA.xlsx");
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "postcode-lookup",
  "postcode-tundra.csv",
);
const OUTPUT_HEADERS = ["postcode", "tundra_quintile"];

function parseArgs(argv) {
  const options = {
    postcodeSource: null,
    msoaSource: DEFAULT_MSOA_SOURCE,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--postcode-source") {
      options.postcodeSource = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === "--msoa-source") {
      options.msoaSource = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === "--output") {
      options.output = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(argv, index, arg) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/build-postcode-tundra-lookup.js [options]

Options:
  --postcode-source <path>  Source postcode CSV/XLSX. Defaults to postcode-lookup/postcode.xlsx,
                            falling back to postcode-lookup/Postcode-Lookup.csv.
  --msoa-source <path>      Source MSOA XLSX. Defaults to postcode-lookup/MSOA.xlsx.
  --output <path>           Output CSV path. Defaults to postcode-lookup/postcode-tundra.csv.
`);
}

async function main() {
  const options = parseArgs(process.argv);
  const postcodeSource = options.postcodeSource || (await resolveDefaultPostcodeSource());
  const report = await buildTundraLookup({ ...options, postcodeSource });
  const verification = await verifyTundraOutput(options.output);

  console.log("Postcode TUNDRA lookup built");
  console.log(`postcode source: ${path.relative(REPO_ROOT, postcodeSource)}`);
  console.log(`MSOA source: ${path.relative(REPO_ROOT, options.msoaSource)}`);
  console.log(`output file: ${path.relative(REPO_ROOT, options.output)}`);
  console.log(`worksheet names: ${report.workbook.worksheetNames.join(", ")}`);
  console.log(`worksheet used: ${report.workbook.worksheetUsed}`);
  console.log(`headers: ${report.workbook.headers.join(", ")}`);
  console.log(`identified MSOA code column: ${report.workbook.msoaCodeColumn}`);
  console.log(
    `identified TUNDRA quintile column: ${report.workbook.tundraQuintileColumn}`,
  );
  console.log("sample rows:");
  for (const sample of report.workbook.sampleRows) {
    console.log(`  ${JSON.stringify(sample)}`);
  }
  console.log(`total postcode source rows: ${report.totalPostcodeSourceRows}`);
  console.log(`rows with MSOA codes: ${report.rowsWithMsoaCodes}`);
  console.log(`matched postcode rows: ${report.matchedPostcodeRows}`);
  console.log(`unmatched MSOA rows: ${report.unmatchedMsoaRows}`);
  console.log(`missing MSOA rows: ${report.missingMsoaRows}`);
  console.log(`invalid quintile rows: ${report.invalidQuintileRows}`);
  console.log(`duplicate postcodes removed: ${report.duplicatePostcodesRemoved}`);
  console.log(`conflicting mappings: ${report.conflictingMappings}`);
  console.log(`final output row count: ${report.finalOutputRowCount}`);
  console.log(`output file size: ${formatBytes(report.outputFileSize)}`);
  console.log(
    `verification: passed (${verification.rowCount} rows, ${verification.columnCount} columns)`,
  );
}

async function buildTundraLookup({
  postcodeSource = null,
  msoaSource = DEFAULT_MSOA_SOURCE,
  output = DEFAULT_OUTPUT,
}) {
  const postcodeSourcePath = postcodeSource || (await resolveDefaultPostcodeSource());
  const { inspection, mappings } = loadMsoaTundraMappings(msoaSource);
  const postcodeHeaders = await readPostcodeSourceHeaders(postcodeSourcePath);
  const postcodeIndex = findRequiredPostcodeColumn(postcodeHeaders, ["postcode"]);
  const msoaIndex = findRequiredPostcodeColumn(postcodeHeaders, [
    "MSOA_current",
    "MSOA current",
  ]);
  const rowsByPostcode = new Map();
  const postcodeConflicts = [];

  const report = {
    workbook: inspection,
    totalPostcodeSourceRows: 0,
    rowsWithMsoaCodes: 0,
    matchedPostcodeRows: 0,
    unmatchedMsoaRows: 0,
    missingMsoaRows: 0,
    invalidQuintileRows: 0,
    duplicatePostcodesRemoved: 0,
    conflictingMappings: 0,
    finalOutputRowCount: 0,
    outputFileSize: 0,
  };

  let lineNumber = 0;
  for await (const row of readPostcodeSourceRows(postcodeSourcePath)) {
    lineNumber += 1;
    if (lineNumber === 1) {
      continue;
    }
    if (row.length === 1 && row[0] === "") {
      continue;
    }

    report.totalPostcodeSourceRows += 1;

    const postcode = normalizePostcode(row[postcodeIndex]);
    if (!postcode || !isNormalizedPostcode(postcode)) {
      throw new Error(
        `Invalid postcode on source line ${lineNumber}: ${row[postcodeIndex]}`,
      );
    }

    const msoaCode = normalizeMsoaCode(row[msoaIndex]);
    if (!msoaCode) {
      report.missingMsoaRows += 1;
      continue;
    }
    report.rowsWithMsoaCodes += 1;

    const mapping = mappings.get(msoaCode);
    if (!mapping) {
      report.unmatchedMsoaRows += 1;
      continue;
    }
    if (!mapping.valid) {
      report.invalidQuintileRows += 1;
      continue;
    }
    report.matchedPostcodeRows += 1;

    const existing = rowsByPostcode.get(postcode);
    if (existing) {
      if (existing !== mapping.quintile) {
        postcodeConflicts.push({
          postcode,
          values: [existing, mapping.quintile],
        });
        continue;
      }

      report.duplicatePostcodesRemoved += 1;
      continue;
    }

    rowsByPostcode.set(postcode, mapping.quintile);
  }

  if (postcodeConflicts.length > 0) {
    report.conflictingMappings += postcodeConflicts.length;
    throw new Error(formatPostcodeConflicts(postcodeConflicts));
  }

  const sortedRows = [...rowsByPostcode.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  await fsp.mkdir(path.dirname(output), { recursive: true });
  const outputLines = [
    OUTPUT_HEADERS.join(","),
    ...sortedRows.map(([postcode, quintile]) =>
      [csvEscape(postcode), csvEscape(quintile)].join(","),
    ),
  ];
  await fsp.writeFile(output, `${outputLines.join("\n")}\n`);

  const stat = await fsp.stat(output);
  report.finalOutputRowCount = sortedRows.length;
  report.outputFileSize = stat.size;

  return report;
}

function loadMsoaTundraMappings(xlsxPath) {
  const workbook = readWorkbook(xlsxPath);
  const sheet = findMsoaWorksheet(workbook);
  const headers = sheet.rows[0] || [];
  const msoaColumnIndex = findMsoaCodeColumn(headers);
  const quintileColumnIndex = findTundraQuintileColumn(headers, sheet.name);
  const mappings = new Map();
  const msoaConflicts = [];

  for (const row of sheet.rows.slice(1)) {
    const msoaCode = normalizeMsoaCode(row[msoaColumnIndex]);
    if (!msoaCode) {
      continue;
    }

    const rawQuintile = clean(row[quintileColumnIndex]);
    const existing = mappings.get(msoaCode);
    const mapping = isValidQuintile(rawQuintile)
      ? { valid: true, quintile: String(Number(rawQuintile)) }
      : { valid: false, quintile: rawQuintile };

    if (existing) {
      if (existing.quintile !== mapping.quintile || existing.valid !== mapping.valid) {
        msoaConflicts.push({
          msoaCode,
          values: [existing.quintile, mapping.quintile],
        });
      }
      continue;
    }

    mappings.set(msoaCode, mapping);
  }

  if (msoaConflicts.length > 0) {
    throw new Error(formatMsoaConflicts(msoaConflicts));
  }

  return {
    inspection: {
      worksheetNames: workbook.sheets.map((candidate) => candidate.name),
      worksheetUsed: sheet.name,
      headers,
      msoaCodeColumn: headers[msoaColumnIndex],
      tundraQuintileColumn: headers[quintileColumnIndex],
      sampleRows: sheet.rows.slice(1, 6).map((row) => rowToObject(headers, row)),
    },
    mappings,
  };
}

function findMsoaWorksheet(workbook) {
  const candidates = workbook.sheets
    .map((sheet) => {
      const headers = sheet.rows[0] || [];
      const hasMsoa = findMsoaCodeColumn(headers, false) !== -1;
      const hasQuintile = findTundraQuintileColumn(headers, sheet.name, false) !== -1;
      const nameScore = /msoa/i.test(sheet.name) ? 2 : 0;
      return {
        score: (hasMsoa ? 5 : 0) + (hasQuintile ? 5 : 0) + nameScore,
        sheet,
      };
    })
    .filter((candidate) => candidate.score >= 10)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    throw new Error("Could not find an MSOA worksheet with MSOA and quintile columns");
  }

  return candidates[0].sheet;
}

function findMsoaCodeColumn(headers, throwOnMissing = true) {
  const index = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return (
      normalized === "msoa" ||
      normalized === "msoa code" ||
      normalized === "msoa_current" ||
      normalized.includes("msoa code")
    );
  });

  if (index === -1 && throwOnMissing) {
    throw new Error(`Could not identify MSOA code column from headers: ${headers.join(", ")}`);
  }

  return index;
}

function findTundraQuintileColumn(headers, sheetName = "", throwOnMissing = true) {
  const index = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return (
      normalized === "tundra quintile" ||
      normalized === "tundra_quintile" ||
      normalized.includes("tundra") ||
      (/msoa/i.test(sheetName) && normalized === "quintile")
    );
  });

  if (index === -1 && throwOnMissing) {
    throw new Error(
      `Could not identify TUNDRA quintile column from headers: ${headers.join(", ")}`,
    );
  }

  return index;
}

function readWorkbook(xlsxPath) {
  const sharedStrings = readSharedStrings(xlsxPath);
  const rels = readWorkbookRelationships(xlsxPath);
  const workbookXml = unzipEntry(xlsxPath, "xl/workbook.xml");
  const sheets = [];

  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    const relationshipId = attrs["r:id"];
    const target = rels.get(relationshipId);
    if (!target) {
      continue;
    }

    const sheetPath = normalizeWorkbookTarget(target);
    sheets.push({
      name: attrs.name,
      rows: readWorksheetRows(xlsxPath, sheetPath, sharedStrings),
    });
  }

  if (sheets.length === 0) {
    throw new Error(`No worksheets found in ${xlsxPath}`);
  }

  return { sheets };
}

function readWorkbookRelationships(xlsxPath) {
  const xml = unzipEntry(xlsxPath, "xl/_rels/workbook.xml.rels");
  const rels = new Map();

  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    rels.set(attrs.Id, attrs.Target);
  }

  return rels;
}

function normalizeWorkbookTarget(target) {
  if (target.startsWith("/")) {
    return target.replace(/^\/+/, "");
  }
  if (target.startsWith("xl/")) {
    return target;
  }
  return `xl/${target}`;
}

function readSharedStrings(xlsxPath) {
  let xml = "";
  try {
    xml = unzipEntry(xlsxPath, "xl/sharedStrings.xml");
  } catch {
    return [];
  }

  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1])
        .join(""),
    ),
  );
}

function readWorksheetRows(xlsxPath, sheetPath, sharedStrings) {
  const xml = unzipEntry(xlsxPath, sheetPath);
  const rows = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const cellXml = cellMatch[0];
      const attrs = parseAttributes((cellXml.match(/<c\b([^>]*)>/) || [])[1] || "");
      const columnIndex = columnNameToIndex((attrs.r || "").match(/[A-Z]+/)?.[0] || "");
      if (columnIndex === -1) {
        continue;
      }
      cells[columnIndex] = readCellValue(cellXml, attrs, sharedStrings);
    }
    rows.push(cells.map((cell) => (cell === undefined ? "" : cell)));
  }

  return rows;
}

function readCellValue(cellXml, attrs, sharedStrings) {
  const value = (cellXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  const inlineText = (cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/) ||
    [])[1];

  if (attrs.t === "s" && value !== undefined) {
    return sharedStrings[Number(value)] || "";
  }
  if (inlineText !== undefined) {
    return decodeXml(inlineText);
  }
  if (value !== undefined) {
    return decodeXml(value);
  }
  return "";
}

async function verifyTundraOutput(outputPath) {
  const seenPostcodes = new Set();
  let lineNumber = 0;
  let rowCount = 0;
  let previousPostcode = null;

  for await (const row of readCsvRows(outputPath)) {
    lineNumber += 1;

    if (lineNumber === 1) {
      const headers = row.map((header) => stripBom(clean(header)));
      if (headers.join(",") !== OUTPUT_HEADERS.join(",")) {
        throw new Error(`Output headers must be exactly ${OUTPUT_HEADERS.join(",")}`);
      }
      continue;
    }

    if (row.length !== OUTPUT_HEADERS.length) {
      throw new Error(`Line ${lineNumber} does not contain exactly two columns`);
    }

    const [postcode, quintile] = row.map(clean);
    if (!postcode) {
      throw new Error(`Blank postcode on line ${lineNumber}`);
    }
    if (!quintile) {
      throw new Error(`Blank TUNDRA quintile on line ${lineNumber}`);
    }
    if (!isNormalizedPostcode(postcode)) {
      throw new Error(`Postcode is not normalized on line ${lineNumber}: ${postcode}`);
    }
    if (seenPostcodes.has(postcode)) {
      throw new Error(`Duplicate postcode found in output: ${postcode}`);
    }
    if (previousPostcode !== null && previousPostcode.localeCompare(postcode) > 0) {
      throw new Error(
        `Output is not sorted by postcode on line ${lineNumber}: ${postcode}`,
      );
    }
    if (!isValidQuintile(quintile)) {
      throw new Error(`TUNDRA quintile outside 1-5 on line ${lineNumber}: ${quintile}`);
    }

    seenPostcodes.add(postcode);
    previousPostcode = postcode;
    rowCount += 1;
  }

  return {
    columnCount: OUTPUT_HEADERS.length,
    rowCount,
  };
}

async function readHeaders(csvPath) {
  for await (const row of readCsvRows(csvPath)) {
    return row.map((header) => stripBom(clean(header)));
  }
  throw new Error(`CSV file is empty: ${csvPath}`);
}

async function* readCsvRows(csvPath) {
  const input = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    yield parseCsvLine(line);
  }
}

function parseCsvLine(line) {
  const row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.replace(/\r$/, ""));
  return row;
}

function findRequiredColumn(headers, requiredHeader) {
  const index = headers.findIndex(
    (header) => normalizeHeader(header) === normalizeHeader(requiredHeader),
  );

  if (index === -1) {
    throw new Error(`Missing required column: ${requiredHeader}`);
  }

  return index;
}

function rowToObject(headers, row) {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index] === undefined ? "" : row[index];
  });
  return object;
}

function parseAttributes(attributeText) {
  const attrs = {};
  for (const match of attributeText.matchAll(/([\w:.-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }
  return attrs;
}

function columnNameToIndex(columnName) {
  if (!columnName) {
    return -1;
  }

  let index = 0;
  for (const char of columnName) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
}

function normalizePostcode(value) {
  const compact = clean(value).toUpperCase().replace(/\s+/g, "");
  if (!compact || compact.length <= 3) {
    return "";
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function isNormalizedPostcode(value) {
  return /^[A-Z0-9]+ [A-Z0-9]{3}$/.test(clean(value));
}

function normalizeMsoaCode(value) {
  return clean(value).toUpperCase();
}

function isValidQuintile(value) {
  return /^[1-5]$/.test(clean(value));
}

function normalizeHeader(header) {
  return stripBom(clean(header)).toLowerCase();
}

function csvEscape(value) {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function unzipEntry(xlsxPath, entryPath) {
  return execFileSync("unzip", ["-p", xlsxPath, entryPath], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
}

function formatPostcodeConflicts(conflicts) {
  const examples = conflicts
    .slice(0, 10)
    .map(
      ({ postcode, values }) =>
        `${postcode} has conflicting TUNDRA quintiles: ${values.join(" vs ")}`,
    )
    .join("; ");
  const suffix =
    conflicts.length > 10 ? `; plus ${conflicts.length - 10} more` : "";

  return `Found ${conflicts.length} conflicting duplicate postcode row(s). ${examples}${suffix}`;
}

function formatMsoaConflicts(conflicts) {
  const examples = conflicts
    .slice(0, 10)
    .map(
      ({ msoaCode, values }) =>
        `${msoaCode} has conflicting TUNDRA quintiles: ${values.join(" vs ")}`,
    )
    .join("; ");
  const suffix =
    conflicts.length > 10 ? `; plus ${conflicts.length - 10} more` : "";

  return `Found ${conflicts.length} conflicting MSOA mapping row(s). ${examples}${suffix}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildTundraLookup,
  isNormalizedPostcode,
  isValidQuintile,
  loadMsoaTundraMappings,
  normalizeMsoaCode,
  normalizePostcode,
  verifyTundraOutput,
};
