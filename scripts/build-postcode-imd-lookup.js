#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const https = require("https");
const os = require("os");
const path = require("path");
const readline = require("readline");
const {
  findRequiredColumn: findRequiredPostcodeColumn,
  readPostcodeSourceHeaders,
  readPostcodeSourceRows,
  resolveDefaultPostcodeSource,
} = require("./postcode-source-reader");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  "postcode-lookup",
  "postcode-imd-2019.csv",
);
const DEFAULT_IMD_SOURCE_URL =
  "https://assets.publishing.service.gov.uk/media/5dc407b440f0b6379a7acc8d/File_7_-_All_IoD2019_Scores__Ranks__Deciles_and_Population_Denominators_3.csv";
const DEFAULT_IMD_CACHE = path.join(
  os.tmpdir(),
  "applysmart-imd-2019-file-7.csv",
);

function parseArgs(argv) {
  const options = {
    input: null,
    imdSource: process.env.IMD_2019_CSV || null,
    output: DEFAULT_OUTPUT,
    forceDownload: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") {
      options.input = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === "--imd-source") {
      options.imdSource = requireValue(argv, (index += 1), arg);
    } else if (arg === "--output") {
      options.output = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === "--force-download") {
      options.forceDownload = true;
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
  console.log(`Usage: node scripts/build-postcode-imd-lookup.js [options]

Options:
  --input <path>       Postcode lookup CSV/XLSX. Defaults to postcode-lookup/postcode.xlsx,
                       falling back to postcode-lookup/Postcode-Lookup.csv.
  --imd-source <path>  Official IMD 2019 CSV path or URL. Defaults to GOV.UK File 7.
                       Can also be supplied with IMD_2019_CSV.
  --output <path>      Output CSV path. Defaults to postcode-lookup/postcode-imd-2019.csv.
  --force-download     Re-download the default GOV.UK CSV cache.
`);
}

async function main() {
  const options = parseArgs(process.argv);
  const inputPath = options.input || (await resolveDefaultPostcodeSource());
  const imdSourcePath = await resolveImdSource(options);

  const imdLookup = await loadImdLookup(imdSourcePath);
  const report = await buildLookup({
    inputPath,
    imdLookup,
    outputPath: options.output,
  });
  const verification = await verifyOutput(options.output);

  console.log("Postcode IMD 2019 lookup built");
  console.log(`input file: ${path.relative(REPO_ROOT, inputPath)}`);
  console.log(`imd source: ${describePath(imdSourcePath)}`);
  console.log(`output file: ${path.relative(REPO_ROOT, options.output)}`);
  console.log(`total postcode rows: ${report.totalPostcodeRows}`);
  console.log(`matched rows: ${report.matchedRows}`);
  console.log(`unmatched rows: ${report.unmatchedRows}`);
  console.log(`duplicate rows removed: ${report.duplicateRowsRemoved}`);
  console.log(`final output row count: ${report.finalOutputRowCount}`);
  console.log(`rows with valid quintiles: ${verification.validQuintileRows}`);
  console.log(
    `rows with missing or invalid deciles: ${verification.missingOrInvalidDecileRows}`,
  );
  console.log(`duplicate postcode count: ${verification.duplicatePostcodeCount}`);
  console.log(`output file size: ${formatBytes(report.outputFileSize)}`);
  console.log(
    `verification: passed (${verification.rowCount} rows, ${verification.columnCount} columns)`,
  );
}

async function resolveImdSource(options) {
  const source = options.imdSource || DEFAULT_IMD_SOURCE_URL;

  if (/^https?:\/\//i.test(source)) {
    const cachePath =
      source === DEFAULT_IMD_SOURCE_URL ? DEFAULT_IMD_CACHE : urlCachePath(source);
    if (!options.forceDownload && (await fileExists(cachePath))) {
      const stat = await fsp.stat(cachePath);
      if (stat.size > 0) {
        return cachePath;
      }
    }

    await downloadFile(source, cachePath);
    return cachePath;
  }

  const sourcePath = path.resolve(source);
  if (!(await fileExists(sourcePath))) {
    throw new Error(`IMD source CSV not found: ${sourcePath}`);
  }
  return sourcePath;
}

function urlCachePath(sourceUrl) {
  const safeName = sourceUrl
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .slice(-160);
  return path.join(os.tmpdir(), `applysmart-${safeName}`);
}

async function downloadFile(url, destinationPath, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error(`Too many redirects while downloading ${url}`);
  }

  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        const redirectUrl = new URL(response.headers.location, url).toString();
        downloadFile(redirectUrl, destinationPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(
          new Error(
            `Failed to download ${url}: HTTP ${response.statusCode || "unknown"}`,
          ),
        );
        return;
      }

      const file = fs.createWriteStream(destinationPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

async function loadImdLookup(imdPath) {
  const headers = await readHeaders(imdPath);
  const lsoaIndex = findRequiredColumn(headers, ["LSOA code (2011)", "LSOA code"]);
  const scoreIndex = findRequiredColumn(headers, [
    "Index of Multiple Deprivation (IMD) Score",
    "IMD Score",
  ]);
  const rankIndex = findRequiredColumn(headers, [
    "Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)",
    "IMD Rank",
  ]);
  const decileIndex = findRequiredColumn(headers, [
    "Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)",
    "IMD Decile",
  ]);

  const lookup = new Map();
  let lineNumber = 0;

  for await (const row of readCsvRows(imdPath)) {
    lineNumber += 1;
    if (lineNumber === 1) {
      continue;
    }
    if (row.length === 1 && row[0] === "") {
      continue;
    }

    const lsoa = clean(row[lsoaIndex]).toUpperCase();
    const score = clean(row[scoreIndex]);
    const rank = clean(row[rankIndex]);
    const decile = clean(row[decileIndex]);

    if (!lsoa) {
      continue;
    }
    if (!isNumeric(score)) {
      throw new Error(`Invalid IMD score for ${lsoa} on line ${lineNumber}`);
    }
    if (!isInteger(rank)) {
      throw new Error(`Invalid IMD rank for ${lsoa} on line ${lineNumber}`);
    }
    if (!isInteger(decile) || Number(decile) < 1 || Number(decile) > 10) {
      throw new Error(`Invalid IMD decile for ${lsoa} on line ${lineNumber}`);
    }

    lookup.set(lsoa, {
      score,
      rank: String(Number(rank)),
      decile: String(Number(decile)),
    });
  }

  if (lookup.size === 0) {
    throw new Error(`No IMD rows loaded from ${imdPath}`);
  }

  return lookup;
}

async function buildLookup({ inputPath, imdLookup, outputPath }) {
  const headers = await readPostcodeSourceHeaders(inputPath);
  const postcodeIndex = findRequiredPostcodeColumn(headers, ["postcode"]);
  const lsoaIndex = findRequiredPostcodeColumn(headers, [
    "LSOA_current",
    "LSOA current",
  ]);
  const seenPostcodes = new Set();

  const report = {
    totalPostcodeRows: 0,
    matchedRows: 0,
    unmatchedRows: 0,
    duplicateRowsRemoved: 0,
    finalOutputRowCount: 0,
    outputFileSize: 0,
  };

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  const output = fs.createWriteStream(outputPath);
  output.write("postcode,imd_score,imd_rank,imd_decile,imd_quintile\n");

  let lineNumber = 0;
  try {
    for await (const row of readPostcodeSourceRows(inputPath)) {
      lineNumber += 1;
      if (lineNumber === 1) {
        continue;
      }
      if (row.length === 1 && row[0] === "") {
        continue;
      }

      report.totalPostcodeRows += 1;

      const postcode = normalizePostcode(row[postcodeIndex]);
      if (!postcode) {
        report.unmatchedRows += 1;
        continue;
      }

      if (seenPostcodes.has(postcode)) {
        report.duplicateRowsRemoved += 1;
        continue;
      }
      seenPostcodes.add(postcode);

      const lsoa = clean(row[lsoaIndex]).toUpperCase();
      const imd = imdLookup.get(lsoa);
      if (!imd) {
        report.unmatchedRows += 1;
        continue;
      }

      const imdQuintile = calculateImdQuintile(imd.decile);
      if (imdQuintile === null) {
        report.unmatchedRows += 1;
        continue;
      }

      output.write(
        [
          csvEscape(postcode),
          csvEscape(imd.score),
          csvEscape(imd.rank),
          csvEscape(imd.decile),
          csvEscape(imdQuintile),
        ].join(",") + "\n",
      );
      report.matchedRows += 1;
      report.finalOutputRowCount += 1;
    }
  } finally {
    await closeWriteStream(output);
  }

  const stat = await fsp.stat(outputPath);
  report.outputFileSize = stat.size;
  return report;
}

async function verifyOutput(outputPath) {
  const expectedHeaders = [
    "postcode",
    "imd_score",
    "imd_rank",
    "imd_decile",
    "imd_quintile",
  ];
  const seenPostcodes = new Set();
  let lineNumber = 0;
  let rowCount = 0;
  let validQuintileRows = 0;
  let missingOrInvalidDecileRows = 0;
  let duplicatePostcodeCount = 0;

  for await (const row of readCsvRows(outputPath)) {
    lineNumber += 1;

    if (lineNumber === 1) {
      const normalizedHeaders = row.map((header) => stripBom(clean(header)));
      if (normalizedHeaders.join(",") !== expectedHeaders.join(",")) {
        throw new Error(
          `Output headers must be exactly ${expectedHeaders.join(",")}`,
        );
      }
      continue;
    }

    if (row.length !== expectedHeaders.length) {
      throw new Error(`Line ${lineNumber} does not contain exactly five columns`);
    }

    const [postcode, score, rank, decile, quintile] = row.map(clean);
    if (seenPostcodes.has(postcode)) {
      duplicatePostcodeCount += 1;
      throw new Error(`Duplicate postcode found in output: ${postcode}`);
    }
    seenPostcodes.add(postcode);

    if (!isNumeric(score)) {
      throw new Error(`Non-numeric IMD score on line ${lineNumber}: ${score}`);
    }
    if (!isInteger(rank)) {
      throw new Error(`Non-integer IMD rank on line ${lineNumber}: ${rank}`);
    }
    if (!isInteger(decile) || Number(decile) < 1 || Number(decile) > 10) {
      missingOrInvalidDecileRows += 1;
      throw new Error(`IMD decile outside 1-10 on line ${lineNumber}: ${decile}`);
    }
    if (!isInteger(quintile) || Number(quintile) < 1 || Number(quintile) > 5) {
      throw new Error(
        `IMD quintile outside 1-5 on line ${lineNumber}: ${quintile}`,
      );
    }

    const expectedQuintile = calculateImdQuintile(decile);
    if (Number(quintile) !== expectedQuintile) {
      throw new Error(
        `IMD quintile mismatch on line ${lineNumber}: decile ${decile} requires quintile ${expectedQuintile}, found ${quintile}`,
      );
    }

    validQuintileRows += 1;
    rowCount += 1;
  }

  return {
    columnCount: expectedHeaders.length,
    duplicatePostcodeCount,
    missingOrInvalidDecileRows,
    rowCount,
    validQuintileRows,
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

function findRequiredColumn(headers, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header)),
  );

  if (index === -1) {
    throw new Error(
      `Missing required column. Expected one of: ${aliases.join(", ")}`,
    );
  }

  return index;
}

function normalizeHeader(header) {
  return stripBom(clean(header)).toLowerCase();
}

function normalizePostcode(value) {
  const compact = clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) {
    return "";
  }
  if (compact.length <= 3) {
    return compact;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
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

function isNumeric(value) {
  return value !== "" && Number.isFinite(Number(value));
}

function isInteger(value) {
  return /^\d+$/.test(value);
}

function calculateImdQuintile(imdDecile) {
  if (!isInteger(clean(imdDecile))) {
    return null;
  }

  const decile = Number(imdDecile);
  if (decile < 1 || decile > 10) {
    return null;
  }

  return Math.ceil(decile / 2);
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function closeWriteStream(stream) {
  await new Promise((resolve, reject) => {
    stream.end((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function describePath(filePath) {
  return filePath.startsWith(REPO_ROOT)
    ? path.relative(REPO_ROOT, filePath)
    : filePath;
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
  calculateImdQuintile,
  verifyOutput,
};
