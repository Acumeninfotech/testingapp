#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const readline = require("readline");
const {
  findRequiredColumn,
  readPostcodeSourceHeaders,
  readPostcodeSourceRows,
  resolveDefaultPostcodeSource,
} = require("./postcode-source-reader");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "postcode-lookup",
  "postcode-polar4.csv",
);
const OUTPUT_HEADERS = ["postcode", "polar4_quintile"];

function parseArgs(argv) {
  const options = {
    input: null,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      options.input = path.resolve(requireValue(argv, (index += 1), arg));
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
  console.log(`Usage: node scripts/build-postcode-polar4-lookup.js [options]

Options:
  --input <path>   Source postcode CSV/XLSX. Defaults to postcode-lookup/postcode.xlsx,
                   falling back to postcode-lookup/Postcode-Lookup.csv.
  --output <path>  Output CSV path. Defaults to postcode-lookup/postcode-polar4.csv.
`);
}

async function main() {
  const options = parseArgs(process.argv);
  const input = options.input || (await resolveDefaultPostcodeSource());
  const report = await buildPolar4Lookup({ ...options, input });
  const verification = await verifyPolar4Output(options.output);

  console.log("Postcode POLAR4 lookup built");
  console.log(`input file: ${path.relative(REPO_ROOT, input)}`);
  console.log(`output file: ${path.relative(REPO_ROOT, options.output)}`);
  console.log(`total source rows: ${report.totalSourceRows}`);
  console.log(`rows with valid POLAR4 quintiles: ${report.validQuintileRows}`);
  console.log(`rows with missing quintiles: ${report.missingQuintileRows}`);
  console.log(`rows with invalid quintiles: ${report.invalidQuintileRows}`);
  console.log(`duplicate rows removed: ${report.duplicateRowsRemoved}`);
  console.log(`conflicting duplicate count: ${report.conflictingDuplicateCount}`);
  console.log(`final output row count: ${report.finalOutputRowCount}`);
  console.log(`output file size: ${formatBytes(report.outputFileSize)}`);
  console.log(
    `verification: passed (${verification.rowCount} rows, ${verification.columnCount} columns)`,
  );
}

async function buildPolar4Lookup({ input = null, output = DEFAULT_OUTPUT }) {
  const inputPath = input || (await resolveDefaultPostcodeSource());
  const headers = await readPostcodeSourceHeaders(inputPath);
  const postcodeIndex = findRequiredColumn(headers, ["postcode"]);
  const polar4Index = findRequiredColumn(headers, [
    "polar4_quintile",
    "POLAR4 quintile",
  ]);
  const rowsByPostcode = new Map();
  const conflicts = [];

  const report = {
    totalSourceRows: 0,
    validQuintileRows: 0,
    missingQuintileRows: 0,
    invalidQuintileRows: 0,
    duplicateRowsRemoved: 0,
    conflictingDuplicateCount: 0,
    finalOutputRowCount: 0,
    outputFileSize: 0,
  };

  let lineNumber = 0;
  for await (const row of readPostcodeSourceRows(inputPath)) {
    lineNumber += 1;
    if (lineNumber === 1) {
      continue;
    }
    if (row.length === 1 && row[0] === "") {
      continue;
    }

    report.totalSourceRows += 1;

    const postcode = normalizePostcode(row[postcodeIndex]);
    const polar4Quintile = clean(row[polar4Index]);

    if (!postcode || !isNormalizedPostcode(postcode)) {
      throw new Error(`Invalid postcode on source line ${lineNumber}: ${row[postcodeIndex]}`);
    }

    if (polar4Quintile === "") {
      report.missingQuintileRows += 1;
      continue;
    }

    if (!isValidPolar4Quintile(polar4Quintile)) {
      report.invalidQuintileRows += 1;
      continue;
    }

    report.validQuintileRows += 1;

    const normalizedQuintile = String(Number(polar4Quintile));
    const existing = rowsByPostcode.get(postcode);
    if (existing) {
      if (existing !== normalizedQuintile) {
        report.conflictingDuplicateCount += 1;
        conflicts.push({
          postcode,
          values: [existing, normalizedQuintile],
        });
        continue;
      }

      report.duplicateRowsRemoved += 1;
      continue;
    }

    rowsByPostcode.set(postcode, normalizedQuintile);
  }

  if (conflicts.length > 0) {
    throw new Error(formatConflicts(conflicts));
  }

  const sortedRows = [...rowsByPostcode.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  await fsp.mkdir(path.dirname(output), { recursive: true });
  const outputLines = [
    OUTPUT_HEADERS.join(","),
    ...sortedRows.map(([postcode, polar4Quintile]) =>
      [csvEscape(postcode), csvEscape(polar4Quintile)].join(","),
    ),
  ];
  await fsp.writeFile(output, `${outputLines.join("\n")}\n`);

  const stat = await fsp.stat(output);
  report.finalOutputRowCount = sortedRows.length;
  report.outputFileSize = stat.size;

  return report;
}

async function verifyPolar4Output(outputPath) {
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

    const [postcode, polar4Quintile] = row.map(clean);
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
    if (!isValidPolar4Quintile(polar4Quintile)) {
      throw new Error(
        `POLAR4 quintile outside 1-5 on line ${lineNumber}: ${polar4Quintile}`,
      );
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

function isValidPolar4Quintile(value) {
  return /^[1-5]$/.test(clean(value));
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

function formatConflicts(conflicts) {
  const examples = conflicts
    .slice(0, 10)
    .map(
      ({ postcode, values }) =>
        `${postcode} has conflicting POLAR4 quintiles: ${values.join(" vs ")}`,
    )
    .join("; ");
  const suffix =
    conflicts.length > 10 ? `; plus ${conflicts.length - 10} more` : "";

  return `Found ${conflicts.length} conflicting duplicate postcode row(s). ${examples}${suffix}`;
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
  buildPolar4Lookup,
  isNormalizedPostcode,
  isValidPolar4Quintile,
  normalizePostcode,
  verifyPolar4Output,
};
