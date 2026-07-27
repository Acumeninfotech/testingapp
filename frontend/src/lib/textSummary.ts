const COMMON_ABBREVIATIONS = new Set([
  'approx',
  'dept',
  'dr',
  'eg',
  'etc',
  'excl',
  'fig',
  'ie',
  'incl',
  'mr',
  'mrs',
  'ms',
  'no',
  'prof',
  'st',
  'univ',
  'vs',
]);

function isDigit(value: string | undefined): boolean {
  return Boolean(value && /\d/.test(value));
}

function isDecimalPoint(text: string, index: number): boolean {
  return isDigit(text[index - 1]) && isDigit(text[index + 1]);
}

function tokenBefore(text: string, index: number): string {
  const prefix = text.slice(0, index);
  const match = prefix.match(/([A-Za-z](?:[A-Za-z.]*)?)$/);
  return match ? match[1] : '';
}

function isAbbreviationPoint(text: string, index: number): boolean {
  const token = tokenBefore(text, index);
  if (!token) return false;

  const normalised = token.replace(/\./g, '').toLowerCase();
  if (COMMON_ABBREVIATIONS.has(normalised)) {
    return true;
  }

  return /^[A-Za-z]$/.test(token) && /^[A-Za-z]\./.test(text.slice(index + 1));
}

function sentenceEndIndex(text: string, index: number): number {
  let end = index + 1;
  while (/["')\]]/.test(text[end] || '')) {
    end += 1;
  }
  return end;
}

export function firstCompleteSentence(text: string): string {
  const trimmed = text.trim();
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (!['.', '!', '?'].includes(char)) continue;
    if (char === '.' && (isDecimalPoint(trimmed, index) || isAbbreviationPoint(trimmed, index))) {
      continue;
    }

    return trimmed.slice(0, sentenceEndIndex(trimmed, index)).trim();
  }

  return trimmed;
}
