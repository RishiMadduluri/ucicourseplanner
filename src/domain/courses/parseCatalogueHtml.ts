import type {
  Course,
  GeCategory,
  GeDesignation,
  ParserError,
  RepeatabilityRule,
  Restriction,
  Units,
} from './types';
import { aliasesForCode, cleanWhitespace, courseId, inferLevel, normalizeCourseCode, parseCourseCode, expandSequence } from './codes';
import { parsePrerequisiteText } from '../prerequisites/parse';

/**
 * Parser for UCI catalogue department pages (`/allcourses/<dept>/`).
 *
 * The live 2026-27 site marks each course with `div.courseblock` and exposes
 * `detail-code`, `detail-title`, `detail-hours_html`, `detail-prereqs`,
 * `detail-coreqs`, `detail-concurrent`, `detail-restrictions`, `detail-same_as`,
 * `detail-overlaps_with`, `detail-repeatability`, `detail-grading_option`, and
 * `detail-gened`, with the description in `div.courseblockextra`.
 *
 * Implemented with regex rather than a DOM library so the same code runs in the
 * Node refresh script and in jsdom tests without an extra dependency.
 */

const NBSP = /\u00a0/g;

/** Decode the small set of HTML entities the catalogue actually emits. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

/** Remove tags and normalize whitespace, keeping the human-readable text. */
export function stripTags(html: string): string {
  return cleanWhitespace(decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(NBSP, ' '));
}

/** Pull the text of a `detail-<name>` span, minus its bold "label" prefix. */
function detail(block: string, name: string): string | undefined {
  const re = new RegExp(`<span class="text detail-${name}[^"]*">([\\s\\S]*?)</span>\\s*(?:&#160;|&nbsp;|\\s)*(?:</div>|<span class="text detail-)`, 'i');
  const match = re.exec(block);
  if (!match) {
    // Fall back to a simpler non-greedy span match.
    const simple = new RegExp(`<span class="text detail-${name}[^"]*">([\\s\\S]*?)</span>`, 'i');
    const m2 = simple.exec(block);
    if (!m2) return undefined;
    return cleanText(m2[1] ?? '');
  }
  return cleanText(match[1] ?? '');
}

function cleanText(raw: string): string | undefined {
  const withoutLabel = raw.replace(/<span class="label">[\s\S]*?<\/span>/i, '');
  const text = stripTags(withoutLabel);
  return text || undefined;
}

/** Parse "4 Units.", "1-4 Units.", "2 Units." into a unit range. */
export function parseUnits(raw: string | undefined): Units | null {
  if (!raw) return null;
  const text = stripTags(raw);
  const range = /(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*Units?/i.exec(text);
  if (range) {
    return { min: Number.parseFloat(range[1]!), max: Number.parseFloat(range[2]!), variable: true };
  }
  const single = /(\d+(?:\.\d+)?)\s*Units?/i.exec(text);
  if (single) {
    const value = Number.parseFloat(single[1]!);
    return { min: value, max: value, variable: false };
  }
  if (/^\s*0\s*Units?/i.test(text)) return { min: 0, max: 0, variable: false };
  return null;
}

const GE_TOKEN = /\b(I{1,3}|IV|V|VI{1,3}|VIII|VII)\s*\.?\s*([ABab])?\b/g;

/**
 * Parse a printed GE designation such as `(II)`, `(Vb)`, `(II and V.B.)`, or
 * `(II and (Va or Vb).)` into structured categories.
 *
 * When the catalogue prints "Va or Vb" the course carries both options but the
 * allocator may use only one — recorded via `exclusiveWithin`.
 */
export function parseGeDesignation(raw: string | undefined, catalogueYear: string): GeDesignation[] {
  if (!raw) return [];
  const text = stripTags(raw).replace(/^\(|\)\.?$/g, '').trim();
  if (!text) return [];

  const found: GeCategory[] = [];
  GE_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GE_TOKEN.exec(text)) !== null) {
    const roman = (match[1] ?? '').toUpperCase();
    const sub = (match[2] ?? '').toLowerCase();
    // Only categories I and V carry an a/b split: Ia lower-division writing,
    // Ib upper-division writing, Va/Vb the two Category V halves.
    const category = ((roman === 'V' || roman === 'I') && sub ? `${roman}${sub}` : roman) as GeCategory;
    if (!found.includes(category)) found.push(category);
  }
  if (found.length === 0) return [];

  // "Va or Vb" — the two are mutually exclusive for this course.
  const hasVaVbAlternative = /Va?\s*\.?\s*[Aa]?\s*or\s*V\s*\.?\s*[Bb]/i.test(text) ||
    (found.includes('Va') && found.includes('Vb') && /\bor\b/i.test(text));

  return found.map((category) => {
    const designation: GeDesignation = { category, catalogueYear, raw: text };
    if (hasVaVbAlternative && (category === 'Va' || category === 'Vb')) {
      designation.exclusiveWithin = ['Va', 'Vb'];
    }
    return designation;
  });
}

function classifyRestriction(raw: string): Restriction['kind'] {
  const lower = raw.toLowerCase();
  if (/first consideration/.test(lower)) return 'first_consideration';
  if (/majors? only|majors have|major students only/.test(lower)) return 'major_only';
  if (/school of .* only|students only/.test(lower)) return 'school_only';
  if (/standing/.test(lower)) return 'class_standing';
  if (/consent|permission|authorization/.test(lower)) return 'consent';
  return 'other';
}

export function parseRepeatability(raw: string | undefined): RepeatabilityRule | undefined {
  if (!raw) return undefined;
  const text = stripTags(raw);
  const times = /(?:credit|taken)\s+(\d+)\s+times?/i.exec(text);
  const units = /maximum of\s+(\d+(?:\.\d+)?)\s+units/i.exec(text);
  const unlimited = /unlimited/i.test(text);
  const rule: RepeatabilityRule = { raw: text, unlimited };
  if (times) rule.maxTimes = Number.parseInt(times[1]!, 10);
  if (units) rule.maxUnits = Number.parseFloat(units[1]!);
  return rule;
}

/** Split a "same as" / "overlaps with" list into normalized course codes. */
function parseCourseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return stripTags(raw)
    .split(/[,;]|\band\b/i)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .flatMap((part) => expandSequence(part))
    .map((code) => normalizeCourseCode(code))
    .filter((code) => parseCourseCode(code) !== null);
}

/** Extract each `div.courseblock` by brace-free depth counting over div tags. */
export function extractCourseBlocks(html: string): string[] {
  const blocks: string[] = [];
  const openRe = /<div class="courseblock"[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openRe.exec(html)) !== null) {
    const start = match.index;
    let depth = 0;
    let i = start;
    const tagRe = /<(\/?)div\b[^>]*>/gi;
    tagRe.lastIndex = start;
    let tag: RegExpExecArray | null;

    while ((tag = tagRe.exec(html)) !== null) {
      depth += tag[1] === '/' ? -1 : 1;
      i = tag.index + tag[0].length;
      if (depth === 0) break;
    }
    if (depth === 0) {
      blocks.push(html.slice(start, i));
      openRe.lastIndex = i;
    }
  }
  return blocks;
}

export interface ParseDepartmentOptions {
  html: string;
  departmentSlug: string;
  sourceUrl: string;
  catalogueYear: string;
  retrievedAt: string;
}

export interface ParseDepartmentResult {
  courses: Course[];
  errors: ParserError[];
}

/** Parse one department page into normalized courses plus recorded failures. */
export function parseDepartmentPage(options: ParseDepartmentOptions): ParseDepartmentResult {
  const { html, departmentSlug, sourceUrl, catalogueYear, retrievedAt } = options;
  const courses: Course[] = [];
  const errors: ParserError[] = [];

  for (const block of extractCourseBlocks(html)) {
    const rawCode = detail(block, 'code');
    if (!rawCode) {
      errors.push({
        department: departmentSlug,
        sourceUrl,
        stage: 'code',
        message: 'Course block had no detail-code span.',
        rawExcerpt: stripTags(block).slice(0, 200),
      });
      continue;
    }

    const code = rawCode.replace(/\.$/, '').trim();
    const parsedCode = parseCourseCode(code);
    if (!parsedCode) {
      errors.push({
        department: departmentSlug,
        sourceUrl,
        code,
        stage: 'code',
        message: `Could not split "${code}" into department and number.`,
        rawExcerpt: stripTags(block).slice(0, 200),
      });
      continue;
    }

    const hoursRaw = detail(block, 'hours_html');
    const units = parseUnits(hoursRaw);
    if (!units) {
      errors.push({
        department: departmentSlug,
        sourceUrl,
        code,
        stage: 'units',
        message: `Could not parse units from "${hoursRaw ?? '(missing)'}".`,
        rawExcerpt: stripTags(block).slice(0, 200),
      });
    }

    const title = (detail(block, 'title') ?? '').replace(/\.$/, '').trim();

    const descMatch = /<div class="courseblockextra[^"]*">([\s\S]*?)<\/div>/i.exec(block);
    const description = descMatch ? stripTags(descMatch[1] ?? '') : '';

    const prereqRaw = detail(block, 'prereqs');
    const coreqRaw = detail(block, 'coreqs');
    const concurrentRaw = detail(block, 'concurrent');
    const restrictionsRaw = detail(block, 'restrictions');
    const geRaw = detail(block, 'gened');

    const prereqParse = parsePrerequisiteText(prereqRaw ?? '', catalogueYear);
    const coreqParse = parsePrerequisiteText(coreqRaw ?? '', catalogueYear);

    const normalizedCode = parsedCode.normalizedCode;
    const gradingRaw = detail(block, 'grading_option');

    const course: Course = {
      id: courseId(catalogueYear, normalizedCode),
      catalogueYear,
      code,
      normalizedCode,
      aliases: aliasesForCode(normalizedCode),
      department: parsedCode.department,
      number: parsedCode.number,
      numericValue: parsedCode.numericValue,
      title,
      description,
      units: units ?? { min: 0, max: 0, variable: false },
      level: inferLevel(parsedCode.numericValue),
      restrictions: restrictionsRaw
        ? [{ kind: classifyRestriction(restrictionsRaw), raw: restrictionsRaw }]
        : [],
      sameAs: parseCourseList(detail(block, 'same_as')),
      overlapsWith: parseCourseList(detail(block, 'overlaps_with')),
      concurrentWith: parseCourseList(concurrentRaw),
      gradingOptions: gradingRaw ? [gradingRaw] : [],
      geCategories: parseGeDesignation(geRaw, catalogueYear),
      sourceUrl,
      retrievedAt,
      parserConfidence: Math.min(
        units ? 1 : 0.6,
        prereqRaw ? prereqParse.confidence : 1,
        coreqRaw ? coreqParse.confidence : 1,
      ),
      rawSourceText: stripTags(block),
    };

    if (prereqRaw) course.prerequisiteRaw = prereqRaw;
    if (prereqParse.expr) course.prerequisiteExpr = prereqParse.expr;
    if (coreqRaw) course.corequisiteRaw = coreqRaw;
    if (coreqParse.expr) course.corequisiteExpr = coreqParse.expr;
    if (concurrentRaw) course.concurrentRaw = concurrentRaw;
    if (prereqParse.recommendedRaw) course.recommendedRaw = prereqParse.recommendedRaw;
    const repeatability = parseRepeatability(detail(block, 'repeatability'));
    if (repeatability) course.repeatability = repeatability;

    if (prereqRaw && prereqParse.confidence < 1) {
      errors.push({
        department: departmentSlug,
        sourceUrl,
        code,
        stage: 'prerequisite',
        message: `Prerequisite text partially unparsed (confidence ${prereqParse.confidence.toFixed(2)}). Raw text retained.`,
        rawExcerpt: prereqRaw.slice(0, 240),
      });
    }

    courses.push(course);
  }

  return { courses, errors };
}

/**
 * Extract department page slugs from the All Courses index.
 * Parsed every run so renamed or new departments appear automatically
 * (03_DATA_SOURCES_AND_PREDICTIONS.md — Department index).
 */
export function parseDepartmentIndex(html: string): string[] {
  const slugs = new Set<string>();
  const re = /<a href="\/allcourses\/([a-z0-9_&-]+)\/"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const slug = match[1];
    if (slug) slugs.add(slug);
  }
  return Array.from(slugs).sort();
}
