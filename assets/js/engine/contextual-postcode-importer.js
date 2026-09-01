const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const readline = require('readline');
const {
  normalisePostcodeForLookup
} = require('./postcode-normaliser');

const DATASET_CONFIGS = {
  polar4: {
    label: 'POLAR4',
    postcodeColumn: 'postcode',
    quintileColumn: 'polar4_quintile',
    outputIndex: 1
  },
  tundra: {
    label: 'TUNDRA',
    postcodeColumn: 'postcode',
    quintileColumn: 'tundra_quintile',
    outputIndex: 2
  },
  imd: {
    label: 'IMD 2019',
    postcodeColumn: 'postcode',
    quintileColumn: 'imd_quintile',
    outputIndex: 3,
    datasetYear: 2019
  }
};

function clean(value) {
  return String(value ?? '').trim();
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, '');
}

function parseCsvLine(line, filename, lineNumber) {
  const fields = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (quoted) {
    throw new Error(`${filename} line ${lineNumber}: malformed CSV row with an unclosed quote`);
  }

  fields.push(current);
  return fields;
}

async function* readCsvRows(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });
  const filename = path.basename(filePath);
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber += 1;
    yield {
      lineNumber,
      row: parseCsvLine(line, filename, lineNumber)
    };
  }
}

function findRequiredColumn(headers, columnName, filename) {
  const index = headers.indexOf(columnName);
  if (index === -1) {
    throw new Error(`${filename}: missing required column "${columnName}"`);
  }
  return index;
}

function normaliseQuintile(value, filename, lineNumber, label) {
  const cleaned = clean(value);
  if (cleaned === '') return null;

  const numericMatch = cleaned.match(/^(?:q(?:uintile)?\s*)?([1-5])$/i);
  if (!numericMatch) {
    throw new Error(`${filename} line ${lineNumber}: invalid ${label} quintile "${cleaned}"`);
  }

  return Number(numericMatch[1]);
}

async function loadDataset(filePath, config) {
  const filename = path.basename(filePath);
  const rows = new Map();
  const report = {
    sourceRows: 0,
    rowsWithValues: 0,
    blankQuintileRows: 0,
    identicalDuplicateCount: 0,
    conflictingDuplicateCount: 0,
    invalidRowCount: 0
  };
  let headers = null;
  let postcodeIndex = -1;
  let quintileIndex = -1;

  try {
    for await (const { lineNumber, row } of readCsvRows(filePath)) {
      if (lineNumber === 1) {
        headers = row.map((header) => stripBom(clean(header)));
        postcodeIndex = findRequiredColumn(headers, config.postcodeColumn, filename);
        quintileIndex = findRequiredColumn(headers, config.quintileColumn, filename);
        continue;
      }

      if (row.length === 1 && clean(row[0]) === '') {
        continue;
      }

      report.sourceRows += 1;

      if (headers && row.length !== headers.length) {
        report.invalidRowCount += 1;
        throw new Error(
          `${filename} line ${lineNumber}: malformed CSV row has ${row.length} columns, expected ${headers.length}`
        );
      }

      const displayPostcode = clean(row[postcodeIndex]);
      const normalisedPostcode = normalisePostcodeForLookup(displayPostcode);
      if (!normalisedPostcode) {
        report.invalidRowCount += 1;
        throw new Error(`${filename} line ${lineNumber}: postcode is empty or invalid`);
      }

      const quintile = normaliseQuintile(row[quintileIndex], filename, lineNumber, config.label);
      if (quintile === null) {
        report.blankQuintileRows += 1;
      } else {
        report.rowsWithValues += 1;
      }

      const existing = rows.get(normalisedPostcode);
      if (existing) {
        if (existing.quintile !== quintile) {
          report.conflictingDuplicateCount += 1;
          throw new Error(
            `${filename} line ${lineNumber}: conflicting duplicate postcode ${normalisedPostcode} (${existing.quintile} vs ${quintile})`
          );
        }
        report.identicalDuplicateCount += 1;
        continue;
      }

      rows.set(normalisedPostcode, {
        postcode: displayPostcode,
        quintile
      });
    }
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      throw new Error(`${filename}: source file could not be read`);
    }
    throw error;
  }

  if (!headers) {
    throw new Error(`${filename}: source file is empty`);
  }

  return {
    headers,
    rows,
    report
  };
}

async function buildContextualPostcodeLookup({ sources, output }) {
  const datasets = {};
  for (const [key, config] of Object.entries(DATASET_CONFIGS)) {
    datasets[key] = await loadDataset(sources[key], config);
  }

  const postcodes = new Map();
  for (const [key, config] of Object.entries(DATASET_CONFIGS)) {
    for (const [normalisedPostcode, row] of datasets[key].rows.entries()) {
      const existing = postcodes.get(normalisedPostcode) || [row.postcode, null, null, null];
      if (!existing[0] || config.outputIndex === 1) {
        existing[0] = row.postcode;
      }
      existing[config.outputIndex] = row.quintile;
      postcodes.set(normalisedPostcode, existing);
    }
  }

  const sortedPostcodes = Object.fromEntries(
    [...postcodes.entries()].sort(([left], [right]) => left.localeCompare(right))
  );

  const report = {
    polar4SourceRows: datasets.polar4.report.sourceRows,
    tundraSourceRows: datasets.tundra.report.sourceRows,
    imdSourceRows: datasets.imd.report.sourceRows,
    uniqueNormalisedPostcodes: postcodes.size,
    postcodesWithPolar4: 0,
    postcodesWithTundra: 0,
    postcodesWithImd: 0,
    postcodesWithAllThreeValues: 0,
    postcodesWithPartialData: 0,
    identicalDuplicateCount: 0,
    conflictingDuplicateCount: 0,
    invalidRowCount: 0,
    generatedOutputPath: output,
    generatedOutputSize: 0,
    headers: {
      polar4: datasets.polar4.headers,
      tundra: datasets.tundra.headers,
      imd: datasets.imd.headers
    }
  };

  for (const dataset of Object.values(datasets)) {
    report.identicalDuplicateCount += dataset.report.identicalDuplicateCount;
    report.conflictingDuplicateCount += dataset.report.conflictingDuplicateCount;
    report.invalidRowCount += dataset.report.invalidRowCount;
  }

  for (const row of postcodes.values()) {
    const hasPolar4 = row[1] !== null;
    const hasTundra = row[2] !== null;
    const hasImd = row[3] !== null;
    if (hasPolar4) report.postcodesWithPolar4 += 1;
    if (hasTundra) report.postcodesWithTundra += 1;
    if (hasImd) report.postcodesWithImd += 1;
    if (hasPolar4 && hasTundra && hasImd) {
      report.postcodesWithAllThreeValues += 1;
    } else {
      report.postcodesWithPartialData += 1;
    }
  }

  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    columns: ['postcode', 'polar4_quintile', 'tundra_quintile', 'imd_quintile'],
    imd_dataset_year: DATASET_CONFIGS.imd.datasetYear,
    postcodes: sortedPostcodes
  };

  await fsp.mkdir(path.dirname(output), { recursive: true });
  await fsp.writeFile(output, `${JSON.stringify(payload)}\n`);
  report.generatedOutputSize = (await fsp.stat(output)).size;

  return report;
}

module.exports = {
  DATASET_CONFIGS,
  buildContextualPostcodeLookup,
  loadDataset,
  normaliseQuintile,
  parseCsvLine
};
