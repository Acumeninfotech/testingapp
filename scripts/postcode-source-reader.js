const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const readline = require("readline");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_POSTCODE_SOURCE_CANDIDATES = [
  path.join(REPO_ROOT, "postcode-lookup", "postcode.xlsx"),
  path.join(REPO_ROOT, "postcode-lookup", "Postcode.xlsx"),
  path.join(REPO_ROOT, "postcode-lookup", "Postcode-Lookup.csv"),
  path.join(REPO_ROOT, "postcode-lookup", "postcode-lookup.csv"),
];

const REQUIRED_XLSX_DATA_HEADERS = [
  "postcode",
  "polar4_quintile",
  "msoa_current",
  "lsoa_current",
];

const workbookCache = new Map();
const sharedStringsCache = new Map();

async function resolveDefaultPostcodeSource() {
  for (const candidate of DEFAULT_POSTCODE_SOURCE_CANDIDATES) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find postcode source. Checked: ${DEFAULT_POSTCODE_SOURCE_CANDIDATES.map(
      (candidate) => path.relative(REPO_ROOT, candidate),
    ).join(", ")}`,
  );
}

async function readPostcodeSourceHeaders(sourcePath) {
  for await (const row of readPostcodeSourceRows(sourcePath)) {
    return row.map((header) => stripBom(clean(header)));
  }
  throw new Error(`Postcode source is empty: ${sourcePath}`);
}

async function* readPostcodeSourceRows(sourcePath) {
  if (isXlsxPath(sourcePath)) {
    yield* readXlsxPostcodeRows(sourcePath);
    return;
  }

  yield* readCsvRows(sourcePath);
}

function isXlsxPath(sourcePath) {
  return /\.xlsx$/i.test(sourcePath);
}

async function* readXlsxPostcodeRows(sourcePath) {
  const workbook = await readWorkbookInfo(sourcePath);
  const sharedStrings = await readSharedStrings(sourcePath);
  let headersYielded = false;
  let dataSheetsFound = 0;

  for (const sheet of workbook.sheets) {
    let header = null;
    let dataRowsStarted = false;

    for await (const row of readWorksheetRows(sourcePath, sheet.path, sharedStrings)) {
      if (!header) {
        if (isPostcodeDataHeader(row)) {
          header = row.map(clean);
          dataSheetsFound += 1;

          if (!headersYielded) {
            yield header;
            headersYielded = true;
          }
        }
        continue;
      }

      dataRowsStarted = true;
      yield row;
    }

    if (header && !dataRowsStarted) {
      throw new Error(`Worksheet ${sheet.name} has postcode headers but no data rows`);
    }
  }

  if (dataSheetsFound === 0) {
    throw new Error(
      `No postcode data worksheets found in ${sourcePath}. Expected headers: ${REQUIRED_XLSX_DATA_HEADERS.join(
        ", ",
      )}`,
    );
  }
}

function isPostcodeDataHeader(row) {
  const normalizedHeaders = new Set(row.map(normalizeHeader));
  return REQUIRED_XLSX_DATA_HEADERS.every((header) =>
    normalizedHeaders.has(normalizeHeader(header)),
  );
}

async function readWorkbookInfo(sourcePath) {
  const cacheKey = path.resolve(sourcePath);
  if (!workbookCache.has(cacheKey)) {
    workbookCache.set(cacheKey, loadWorkbookInfo(sourcePath));
  }
  return workbookCache.get(cacheKey);
}

async function loadWorkbookInfo(sourcePath) {
  const workbookXml = unzipEntryText(sourcePath, "xl/workbook.xml");
  const relsXml = unzipEntryText(sourcePath, "xl/_rels/workbook.xml.rels");
  const rels = new Map();

  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    rels.set(attrs.Id, normalizeWorkbookTarget(attrs.Target));
  }

  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = parseAttributes(match[1]);
    const target = rels.get(attrs["r:id"]);
    if (target) {
      sheets.push({
        name: attrs.name,
        path: target,
      });
    }
  }

  if (sheets.length === 0) {
    throw new Error(`No worksheets found in ${sourcePath}`);
  }

  return { sheets };
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

async function readSharedStrings(sourcePath) {
  const cacheKey = path.resolve(sourcePath);
  if (!sharedStringsCache.has(cacheKey)) {
    sharedStringsCache.set(cacheKey, loadSharedStrings(sourcePath));
  }
  return sharedStringsCache.get(cacheKey);
}

async function loadSharedStrings(sourcePath) {
  if (!(await hasZipEntry(sourcePath, "xl/sharedStrings.xml"))) {
    return [];
  }

  const strings = [];
  let buffer = "";

  for await (const chunk of streamZipEntry(sourcePath, "xl/sharedStrings.xml")) {
    buffer += chunk;

    let endIndex = buffer.indexOf("</si>");
    while (endIndex !== -1) {
      const startIndex = buffer.indexOf("<si");
      if (startIndex === -1 || startIndex > endIndex) {
        buffer = buffer.slice(endIndex + "</si>".length);
        endIndex = buffer.indexOf("</si>");
        continue;
      }

      const itemXml = buffer.slice(startIndex, endIndex + "</si>".length);
      strings.push(readSharedStringItem(itemXml));
      buffer = buffer.slice(endIndex + "</si>".length);
      endIndex = buffer.indexOf("</si>");
    }
  }

  return strings;
}

function readSharedStringItem(itemXml) {
  const parts = [];
  for (const match of itemXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) {
    parts.push(match[1]);
  }
  return decodeXml(parts.join(""));
}

async function* readWorksheetRows(sourcePath, sheetPath, sharedStrings) {
  let buffer = "";

  for await (const chunk of streamZipEntry(sourcePath, sheetPath)) {
    buffer += chunk;

    let endIndex = buffer.indexOf("</row>");
    while (endIndex !== -1) {
      const startIndex = buffer.lastIndexOf("<row", endIndex);
      if (startIndex === -1) {
        buffer = buffer.slice(endIndex + "</row>".length);
        endIndex = buffer.indexOf("</row>");
        continue;
      }

      yield parseWorksheetRow(buffer.slice(startIndex, endIndex + "</row>".length), sharedStrings);
      buffer = buffer.slice(endIndex + "</row>".length);
      endIndex = buffer.indexOf("</row>");
    }

    if (buffer.length > 5_000_000) {
      buffer = buffer.slice(-1_000_000);
    }
  }
}

function parseWorksheetRow(rowXml, sharedStrings) {
  const row = [];
  for (const cellMatch of rowXml.matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
    const cellXml = cellMatch[0];
    const attrs = parseAttributes((cellXml.match(/<c\b([^>]*)>/) || [])[1] || "");
    const columnIndex = columnNameToIndex((attrs.r || "").match(/[A-Z]+/)?.[0] || "");
    if (columnIndex === -1) {
      continue;
    }
    row[columnIndex] = readCellValue(cellXml, attrs, sharedStrings);
  }

  return row.map((cell) => (cell === undefined ? "" : cell));
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

async function* streamZipEntry(sourcePath, entryPath) {
  const child = spawn("unzip", ["-p", sourcePath, entryPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const closePromise = new Promise((resolve) => {
    child.on("close", resolve);
  });

  for await (const chunk of child.stdout) {
    yield chunk;
  }

  const exitCode = await closePromise;

  if (exitCode !== 0) {
    throw new Error(
      `Failed to read ${entryPath} from ${sourcePath}: unzip exited ${exitCode}${
        stderr ? ` (${stderr.trim()})` : ""
      }`,
    );
  }
}

async function hasZipEntry(sourcePath, entryPath) {
  try {
    execFileSync("unzip", ["-l", sourcePath, entryPath], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function unzipEntryText(sourcePath, entryPath) {
  return execFileSync("unzip", ["-p", sourcePath, entryPath], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
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
  const aliasList = Array.isArray(aliases) ? aliases : [aliases];
  const normalizedAliases = aliasList.map(normalizeHeader);
  const index = headers.findIndex((header) =>
    normalizedAliases.includes(normalizeHeader(header)),
  );

  if (index === -1) {
    throw new Error(
      `Missing required column. Expected one of: ${aliasList.join(", ")}`,
    );
  }

  return index;
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

function normalizeHeader(header) {
  return stripBom(clean(header)).toLowerCase().replace(/[\s-]+/g, "_");
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

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  DEFAULT_POSTCODE_SOURCE_CANDIDATES,
  findRequiredColumn,
  isXlsxPath,
  normalizeHeader,
  readPostcodeSourceHeaders,
  readPostcodeSourceRows,
  resolveDefaultPostcodeSource,
};
