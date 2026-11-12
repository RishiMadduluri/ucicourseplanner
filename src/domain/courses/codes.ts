/**
 * Course-code identity and alias handling.
 *
 * 03_DATA_SOURCES_AND_PREDICTIONS.md — Course identity:
 *   - `ICS 31` and `I&C SCI 31` must resolve to the same catalogue course;
 *   - `CS 161` (ICS teaching-plan abbreviation) maps to `COMPSCI 161`;
 *   - `INF 131` maps to `IN4MATX 131`;
 *   - sequences such as `MATH 2A-2B` expand into individual courses;
 *   - the source spelling is never destroyed.
 */

/**
 * Department-prefix aliases. Keys are alternate spellings a user or a
 * department teaching plan might use; values are the official catalogue prefix.
 * Matching is case- and space-insensitive.
 */
const DEPARTMENT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  ICS: 'I&C SCI',
  'I&CSCI': 'I&C SCI',
  'I&C SCI': 'I&C SCI',
  ICSCI: 'I&C SCI',
  CS: 'COMPSCI',
  COMPSCI: 'COMPSCI',
  INF: 'IN4MATX',
  INFORMATICS: 'IN4MATX',
  IN4MATX: 'IN4MATX',
  SE: 'SWE',
  SWE: 'SWE',
  STAT: 'STATS',
  STATS: 'STATS',
  MATH: 'MATH',
  PHYS: 'PHYSICS',
  PHYSICS: 'PHYSICS',
  CHEM: 'CHEM',
  BIOSCI: 'BIO SCI',
  'BIO SCI': 'BIO SCI',
  BIO: 'BIO SCI',
  WRITING: 'WRITING',
  WR: 'WRITING',
  POLSCI: 'POL SCI',
  'POL SCI': 'POL SCI',
  ARTHIS: 'ART HIS',
  'ART HIS': 'ART HIS',
  EARTHSS: 'EARTHSS',
  SOCECOL: 'SOCECOL',
  EDUC: 'EDUC',
  MGMT: 'MGMT',
  ECON: 'ECON',
  PHILOS: 'PHILOS',
  HISTORY: 'HISTORY',
  ENGR: 'ENGR',
  PSY: 'PSY',
  COGS: 'COGS',
});

/** Collapse whitespace and non-breaking spaces, uppercase, trim. */
export function cleanWhitespace(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedCode {
  /** Official (or best-known) department prefix, e.g. "I&C SCI". */
  department: string;
  /** Number exactly as written, including letter suffix, e.g. "122A". */
  number: string;
  /** Numeric component only, e.g. 122. */
  numericValue: number;
  /** Canonical "DEPARTMENT NUMBER" form. */
  normalizedCode: string;
}

/**
 * Split a course code into department and number.
 * Returns null when the input does not look like a course code at all.
 */
export function parseCourseCode(input: string): ParsedCode | null {
  const cleaned = cleanWhitespace(input).replace(/\.$/, '');
  if (!cleaned) return null;

  // The number is the trailing token: optional letter prefix (rare), digits,
  // optional letter suffix, e.g. "31", "122A", "105LA", "H32", "6N",
  // and the long language-course forms such as "1ABSP".
  const match = cleaned.match(/^(.*?)[\s]*([A-Z]?\d{1,3}[A-Z]{0,5})$/i);
  if (!match) return null;

  const rawDept = (match[1] ?? '').trim();
  const rawNumber = (match[2] ?? '').trim().toUpperCase();
  if (!rawDept || !rawNumber) return null;

  const department = normalizeDepartment(rawDept);
  const digits = rawNumber.match(/\d+/);
  if (!digits) return null;

  return {
    department,
    number: rawNumber,
    numericValue: Number.parseInt(digits[0], 10),
    normalizedCode: `${department} ${rawNumber}`,
  };
}

/** Map a department spelling to its official catalogue prefix. */
export function normalizeDepartment(input: string): string {
  const upper = cleanWhitespace(input).toUpperCase();
  const collapsed = upper.replace(/\s+/g, '');
  return DEPARTMENT_ALIASES[upper] ?? DEPARTMENT_ALIASES[collapsed] ?? upper;
}

/**
 * Canonical matching key for a course code. Both `ICS 31` and `I&C SCI 31`
 * produce `I&C SCI 31`.
 */
export function normalizeCourseCode(input: string): string {
  const parsed = parseCourseCode(input);
  return parsed ? parsed.normalizedCode : cleanWhitespace(input).toUpperCase();
}

/** Stable catalogue-year-scoped course id. */
export function courseId(catalogueYear: string, normalizedCode: string): string {
  return `${catalogueYear}:${normalizedCode.replace(/[^A-Z0-9]+/gi, '-').toUpperCase()}`;
}

/**
 * Alternate spellings to index a course under, so search finds it by any of
 * them. The official code is always included first.
 */
export function aliasesForCode(normalizedCode: string): string[] {
  const parsed = parseCourseCode(normalizedCode);
  if (!parsed) return [normalizedCode];

  const out = new Set<string>([normalizedCode]);
  const { department, number } = parsed;

  // Every alternate prefix that maps to this department.
  for (const [alias, official] of Object.entries(DEPARTMENT_ALIASES)) {
    if (official === department && alias !== department) {
      out.add(`${alias} ${number}`);
    }
  }
  // Space-collapsed form, e.g. "I&CSCI 31" and "ICS31".
  out.add(`${department.replace(/\s+/g, '')} ${number}`);
  for (const alias of Array.from(out)) {
    out.add(alias.replace(/\s+/g, ''));
  }
  return Array.from(out);
}

/**
 * Expand a catalogue sequence notation into individual course codes.
 *
 *   "MATH 2A-2B"      -> ["MATH 2A", "MATH 2B"]
 *   "MATH 5A-5B"      -> ["MATH 5A", "MATH 5B"]
 *   "CHINESE 1A-1C"   -> ["CHINESE 1A", "CHINESE 1B", "CHINESE 1C"]
 *   "MATH 105A/105LA" -> ["MATH 105A", "MATH 105LA"]
 *   "COMPSCI 161"     -> ["COMPSCI 161"]
 */
export function expandSequence(input: string): string[] {
  const cleaned = cleanWhitespace(input).replace(/\.$/, '');

  // Slash form shares the department prefix: "MATH 105A/105LA".
  if (cleaned.includes('/')) {
    const [first, ...rest] = cleaned.split('/').map((s) => s.trim());
    const firstParsed = parseCourseCode(first ?? '');
    if (!firstParsed) return [cleaned];
    const out = [firstParsed.normalizedCode];
    for (const part of rest) {
      // A bare number reuses the leading department.
      const withDept = /^[A-Z]/i.test(part) && parseCourseCode(part)?.department !== firstParsed.department
        ? part
        : `${firstParsed.department} ${part}`;
      const parsed = parseCourseCode(/\s/.test(part) ? part : withDept);
      out.push(parsed ? parsed.normalizedCode : part);
    }
    return out;
  }

  // Range form: "MATH 2A-2B", "CHINESE 1A-1C".
  const range = cleaned.match(/^(.*?)\s*([A-Z]?\d{1,3})([A-Z])\s*[–—-]\s*(?:\d{1,3})?([A-Z])$/i);
  if (range) {
    const dept = normalizeDepartment(range[1] ?? '');
    const stem = (range[2] ?? '').toUpperCase();
    const startLetter = (range[3] ?? '').toUpperCase();
    const endLetter = (range[4] ?? '').toUpperCase();
    const out: string[] = [];
    for (let c = startLetter.charCodeAt(0); c <= endLetter.charCodeAt(0); c += 1) {
      out.push(`${dept} ${stem}${String.fromCharCode(c)}`);
    }
    if (out.length > 0) return out;
  }

  const single = parseCourseCode(cleaned);
  return single ? [single.normalizedCode] : [cleaned];
}

/**
 * Infer level from the numeric component.
 * UCI: 1–99 lower division, 100–199 upper division, 200+ graduate,
 * 400+ professional/teaching.
 */
export function inferLevel(numericValue: number): 'lower' | 'upper' | 'graduate' | 'professional' {
  if (numericValue >= 400) return 'professional';
  if (numericValue >= 200) return 'graduate';
  if (numericValue >= 100) return 'upper';
  return 'lower';
}
