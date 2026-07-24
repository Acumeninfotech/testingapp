#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function walkJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkJsonFiles(filePath);
    }
    return entry.isFile() && entry.name.endsWith('.json') ? [filePath] : [];
  });
}

const files = walkJsonFiles(path.join(rootDir, 'data'));
const failures = [];

for (const filePath of files) {
  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(rootDir, filePath)}: ${error.message}`);
  }
}

if (failures.length) {
  console.error('JSON validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`JSON validation passed (${files.length} files).`);
