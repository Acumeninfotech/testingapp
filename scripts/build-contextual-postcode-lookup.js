#!/usr/bin/env node

const path = require('path');
const {
  buildContextualPostcodeLookup
} = require('../assets/js/engine/contextual-postcode-importer');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCES = {
  polar4: path.join(REPO_ROOT, 'postcode-lookup', 'postcode-polar4.csv'),
  tundra: path.join(REPO_ROOT, 'postcode-lookup', 'postcode-tundra.csv'),
  imd: path.join(REPO_ROOT, 'postcode-lookup', 'postcode-imd-2019.csv')
};
const DEFAULT_OUTPUT = path.join(REPO_ROOT, 'data', 'contextual', 'postcode-contextual-lookup.json');

function parseArgs(argv) {
  const options = {
    sources: { ...DEFAULT_SOURCES },
    output: DEFAULT_OUTPUT
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--polar4') {
      options.sources.polar4 = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === '--tundra') {
      options.sources.tundra = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === '--imd') {
      options.sources.imd = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === '--output') {
      options.output = path.resolve(requireValue(argv, (index += 1), arg));
    } else if (arg === '--help' || arg === '-h') {
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
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${arg}`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/build-contextual-postcode-lookup.js [options]

Options:
  --polar4 <path>  POLAR4 postcode CSV. Defaults to postcode-lookup/postcode-polar4.csv.
  --tundra <path>  TUNDRA postcode CSV. Defaults to postcode-lookup/postcode-tundra.csv.
  --imd <path>     IMD 2019 postcode CSV. Defaults to postcode-lookup/postcode-imd-2019.csv.
  --output <path>  Generated JSON path. Defaults to data/contextual/postcode-contextual-lookup.json.
`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

async function main() {
  const options = parseArgs(process.argv);
  const report = await buildContextualPostcodeLookup(options);

  console.log('Contextual postcode lookup built');
  console.log(`POLAR4 source rows: ${report.polar4SourceRows}`);
  console.log(`TUNDRA source rows: ${report.tundraSourceRows}`);
  console.log(`IMD source rows: ${report.imdSourceRows}`);
  console.log(`unique normalised postcodes: ${report.uniqueNormalisedPostcodes}`);
  console.log(`postcodes with POLAR4: ${report.postcodesWithPolar4}`);
  console.log(`postcodes with TUNDRA: ${report.postcodesWithTundra}`);
  console.log(`postcodes with IMD: ${report.postcodesWithImd}`);
  console.log(`postcodes with all three values: ${report.postcodesWithAllThreeValues}`);
  console.log(`postcodes with partial data: ${report.postcodesWithPartialData}`);
  console.log(`identical duplicate count: ${report.identicalDuplicateCount}`);
  console.log(`conflicting duplicate count: ${report.conflictingDuplicateCount}`);
  console.log(`invalid row count: ${report.invalidRowCount}`);
  console.log(`generated output path: ${path.relative(REPO_ROOT, report.generatedOutputPath)}`);
  console.log(`generated output size: ${formatBytes(report.generatedOutputSize)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs
};
