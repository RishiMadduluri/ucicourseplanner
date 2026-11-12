import type { Grade, PrerequisiteExpr } from '../courses/types';
import { cleanWhitespace, normalizeCourseCode, courseId } from '../courses/codes';

/**
 * Recursive-descent parser for UCI catalogue prerequisite / corequisite /
 * concurrent text.
 *
 * Grammar observed in the live 2026-27 catalogue:
 *
 *   expr     := orExpr
 *   orExpr   := andExpr ("or" andExpr)*
 *   andExpr  := atom ("and" atom)*
 *   atom     := "(" expr ")" | courseRef | examRef | standingRef | consentRef | unknown
 *   courseRef:= CODE ["(may be taken concurrently)"] ["with a minimum grade of" GRADE]
 *   examRef  := EXAM "with a minimum score of" N
 *
 * AND binds tighter than OR. The catalogue parenthesizes wherever the intended
 * grouping differs, so this precedence reproduces the printed meaning.
 *
 * Per 03_DATA_SOURCES_AND_PREDICTIONS.md a failure never discards the rule:
 * unrecognized text becomes an `unknown` node, which the three-valued evaluator
 * reports as `unknown` rather than false.
 */

export interface ParseResult {
  expr: PrerequisiteExpr | undefined;
  /** Text after a "Recommended:" label — advisory only, never enforced. */
  recommendedRaw?: string;
  /** 0..1. Reduced by each `unknown` node retained in the tree. */
  confidence: number;
}

/**
 * Trailing sentences that *widen* eligibility ("... is also accepted") are
 * permissive notes, not extra conditions. AND-ing them as `unknown` would
 * wrongly poison an otherwise-decidable tree, so they are recorded and skipped.
 */
const PERMISSIVE_SENTENCE = /\b(is|may)\s+(also\s+)?(be\s+)?accepted\b|\bfee required\b/i;

/** Additional requirement sentences we can map to a known evidence key. */
const KNOWN_SENTENCE_KEYS: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  { pattern: /satisfactory completion of the lower-division writing/i, key: 'lower_division_writing' },
  { pattern: /entry level writing|elwr/i, key: 'elwr' },
  { pattern: /placement (via|exam)/i, key: 'placement_exam' },
];

const GRADE_TOKENS = [
  'A+', 'A-', 'A', 'B+', 'B-', 'B', 'C+', 'C-', 'C', 'D+', 'D-', 'D', 'F', 'P', 'S',
] as const;

const STANDING_WORDS: ReadonlyArray<{ word: RegExp; value: 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate' }> = [
  { word: /\bfreshman standing\b/i, value: 'freshman' },
  { word: /\bsophomore standing\b/i, value: 'sophomore' },
  { word: /\bjunior standing\b/i, value: 'junior' },
  { word: /\bsenior standing\b/i, value: 'senior' },
  { word: /\bgraduate standing\b/i, value: 'graduate' },
];

const CONSENT_PATTERN = /\b(consent|permission|approval) of (the )?(instructor|department|school|program|adviser|advisor|director)\b/i;

/** Matches "I&C SCI 45C", "COMPSCI 122A", "MATH 2B", "AP" is excluded. */
const COURSE_CODE_PATTERN = /\b([A-Z][A-Z&]*(?:\s+[A-Z][A-Z&]*){0,3})\s+([A-Z]?\d{1,3}[A-Z]{0,3})\b/;

const EXAM_PREFIX_PATTERN = /^(AP|SAT|ACT|IB|CLEP)\b/i;

interface Token {
  type: 'lparen' | 'rparen' | 'and' | 'or' | 'text';
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  let depthSafe = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) tokens.push({ type: 'text', value: trimmed });
    buffer = '';
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;

    if (ch === '(') {
      // "(may be taken concurrently)" and "(fee required)" are course modifiers,
      // not grouping parentheses — keep them inside the current text run.
      const close = input.indexOf(')', i);
      const inner = close > i ? input.slice(i + 1, close) : '';
      if (/^(may be taken concurrently|fee required|IP|in progress)/i.test(inner.trim())) {
        buffer += input.slice(i, close + 1);
        i = close;
        continue;
      }
      flush();
      tokens.push({ type: 'lparen', value: '(' });
      depthSafe += 1;
      continue;
    }

    if (ch === ')') {
      flush();
      tokens.push({ type: 'rparen', value: ')' });
      depthSafe -= 1;
      continue;
    }

    // Match " and " / " or " only as standalone connectives.
    const rest = input.slice(i);
    const andMatch = /^\s+and\s+/i.exec(rest);
    if (andMatch) {
      flush();
      tokens.push({ type: 'and', value: 'and' });
      i += andMatch[0].length - 1;
      continue;
    }
    const orMatch = /^\s+or\s+/i.exec(rest);
    if (orMatch) {
      flush();
      tokens.push({ type: 'or', value: 'or' });
      i += orMatch[0].length - 1;
      continue;
    }

    buffer += ch;
  }
  flush();
  void depthSafe;
  return tokens;
}

class Parser {
  private pos = 0;
  private unknownCount = 0;
  private leafCount = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly catalogueYear: string,
  ) {}

  get stats() {
    return { unknownCount: this.unknownCount, leafCount: this.leafCount };
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  parseExpr(): PrerequisiteExpr | undefined {
    return this.parseOr();
  }

  private parseOr(): PrerequisiteExpr | undefined {
    const children: PrerequisiteExpr[] = [];
    const first = this.parseAnd();
    if (first) children.push(first);

    while (this.peek()?.type === 'or') {
      this.next();
      const rhs = this.parseAnd();
      if (rhs) children.push(rhs);
    }

    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return { op: 'or', children };
  }

  private parseAnd(): PrerequisiteExpr | undefined {
    const children: PrerequisiteExpr[] = [];
    const first = this.parseAtom();
    if (first) children.push(first);

    while (this.peek()?.type === 'and') {
      this.next();
      const rhs = this.parseAtom();
      if (rhs) children.push(rhs);
    }

    if (children.length === 0) return undefined;
    if (children.length === 1) return children[0];
    return { op: 'and', children };
  }

  private parseAtom(): PrerequisiteExpr | undefined {
    const token = this.peek();
    if (!token) return undefined;

    if (token.type === 'lparen') {
      this.next();
      const inner = this.parseOr();
      if (this.peek()?.type === 'rparen') this.next();
      return inner;
    }

    if (token.type === 'rparen') return undefined;
    if (token.type === 'and' || token.type === 'or') return undefined;

    this.next();
    return this.parseLeaf(token.value);
  }

  private parseLeaf(raw: string): PrerequisiteExpr {
    this.leafCount += 1;
    const text = cleanWhitespace(raw).replace(/[.;]+$/, '');

    // Exam or standardized-test node.
    const scoreMatch = /^(.*?)\s+with a minimum score of\s+(\d+)/i.exec(text);
    if (scoreMatch) {
      const examName = cleanWhitespace(scoreMatch[1] ?? '');
      return {
        op: 'exam_or_placement',
        key: `${examName.toUpperCase()}>=${scoreMatch[2]}`,
        raw: text,
      };
    }
    if (EXAM_PREFIX_PATTERN.test(text)) {
      return { op: 'exam_or_placement', key: text.toUpperCase(), raw: text };
    }

    // Class standing.
    for (const { word, value } of STANDING_WORDS) {
      if (word.test(text)) return { op: 'standing', value, raw: text };
    }

    // Consent.
    if (CONSENT_PATTERN.test(text)) {
      const m = CONSENT_PATTERN.exec(text);
      return { op: 'consent', authority: m?.[3] ?? 'instructor', raw: text };
    }

    // Course reference, optionally with a minimum grade.
    const gradeMatch = /with a minimum grade of\s+([A-DF][+-]?|P|S)\b/i.exec(text);
    const beforeGrade = gradeMatch ? text.slice(0, gradeMatch.index) : text;
    const codeMatch = COURSE_CODE_PATTERN.exec(beforeGrade);

    if (codeMatch && !EXAM_PREFIX_PATTERN.test(beforeGrade.trim())) {
      const code = normalizeCourseCode(`${codeMatch[1]} ${codeMatch[2]}`);
      // Reject a false positive where the "code" is really prose.
      const node: PrerequisiteExpr = {
        op: 'course',
        courseId: courseId(this.catalogueYear, code),
        code,
      };
      if (gradeMatch) {
        const g = normalizeGradeToken(gradeMatch[1] ?? '');
        if (g) node.minGrade = g;
      }
      return node;
    }

    // Recognizable non-course requirement sentence.
    for (const { pattern, key } of KNOWN_SENTENCE_KEYS) {
      if (pattern.test(text)) return { op: 'exam_or_placement', key, raw: text };
    }

    this.unknownCount += 1;
    return { op: 'unknown', raw: text };
  }
}

function normalizeGradeToken(token: string): Grade | undefined {
  const upper = token.toUpperCase();
  return (GRADE_TOKENS as readonly string[]).includes(upper) ? (upper as Grade) : undefined;
}

/** Strip the leading "Prerequisite:" / "Corequisite:" / "Concurrent:" label. */
function stripLabel(input: string): string {
  return input.replace(/^\s*(Prerequisite|Prerequisites|Corequisite|Corequisites|Concurrent|Concurrent with)\s*:\s*/i, '');
}

/**
 * Split into sentences while protecting decimals and abbreviations that appear
 * inside course codes and scores.
 */
function splitSentences(input: string): string[] {
  // The boundary must also fire after an uppercase character, because course
  // codes routinely end a sentence ("... COMPSCI 180A. In Progress ...").
  return input
    .split(/(?<=[A-Za-z0-9)])\.\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse a raw catalogue requirement string into an expression tree.
 */
export function parsePrerequisiteText(raw: string, catalogueYear: string): ParseResult {
  const cleaned = cleanWhitespace(raw);
  if (!cleaned) return { expr: undefined, confidence: 1 };

  // Separate the advisory "Recommended:" clause first — it is never enforced.
  let body = cleaned;
  let recommendedRaw: string | undefined;
  const recIndex = body.search(/\bRecommended\s*:/i);
  if (recIndex >= 0) {
    recommendedRaw = cleanWhitespace(body.slice(recIndex).replace(/^Recommended\s*:\s*/i, '')).replace(/\.$/, '');
    body = body.slice(0, recIndex).trim();
  }
  // "Required:" introduces prose background knowledge, not catalogue courses.
  const reqIndex = body.search(/\bRequired\s*:/i);
  if (reqIndex >= 0) {
    body = body.slice(0, reqIndex).trim();
  }

  body = stripLabel(body);

  const sentences = splitSentences(body);
  const clauses: PrerequisiteExpr[] = [];
  let unknownCount = 0;
  let leafCount = 0;

  for (const sentence of sentences) {
    if (PERMISSIVE_SENTENCE.test(sentence)) continue;

    const parser = new Parser(tokenize(sentence), catalogueYear);
    const expr = parser.parseExpr();
    const stats = parser.stats;
    unknownCount += stats.unknownCount;
    leafCount += stats.leafCount;
    if (expr) clauses.push(expr);
  }

  const expr =
    clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : { op: 'and' as const, children: clauses };

  const confidence = leafCount === 0 ? (expr ? 0.5 : 1) : Math.max(0, 1 - unknownCount / leafCount);

  const result: ParseResult = { expr, confidence };
  if (recommendedRaw) result.recommendedRaw = recommendedRaw;
  return result;
}

/** Collect every course code referenced anywhere in an expression tree. */
export function collectCourseCodes(expr: PrerequisiteExpr | undefined): string[] {
  if (!expr) return [];
  switch (expr.op) {
    case 'course':
      return [expr.code];
    case 'and':
    case 'or':
    case 'n_of':
      return expr.children.flatMap(collectCourseCodes);
    default:
      return [];
  }
}
