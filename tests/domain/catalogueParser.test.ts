import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  extractCourseBlocks,
  parseDepartmentIndex,
  parseDepartmentPage,
  parseGeDesignation,
  parseRepeatability,
  parseUnits,
} from '../../src/domain/courses/parseCatalogueHtml';
import {
  aliasesForCode,
  expandSequence,
  inferLevel,
  normalizeCourseCode,
  parseCourseCode,
} from '../../src/domain/courses/codes';
import { SNAPSHOT, course } from '../helpers';

const FIXTURE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/department-page.html'),
  'utf8',
);

const parsed = parseDepartmentPage({
  html: FIXTURE,
  departmentSlug: 'test',
  sourceUrl: 'https://catalogue.uci.edu/allcourses/test/',
  catalogueYear: '2026-27',
  retrievedAt: '2026-07-24T00:00:00.000Z',
});

const byCode = new Map(parsed.courses.map((c) => [c.normalizedCode, c]));

describe('course code normalization', () => {
  it('resolves department aliases to the official prefix', () => {
    expect(normalizeCourseCode('ICS 31')).toBe('I&C SCI 31');
    expect(normalizeCourseCode('I&C SCI 31')).toBe('I&C SCI 31');
    expect(normalizeCourseCode('CS 161')).toBe('COMPSCI 161');
    expect(normalizeCourseCode('INF 131')).toBe('IN4MATX 131');
  });

  it('handles letter-suffixed and letter-prefixed numbers', () => {
    expect(parseCourseCode('COMPSCI 122A')?.number).toBe('122A');
    expect(parseCourseCode('COMPSCI 122A')?.numericValue).toBe(122);
    expect(parseCourseCode('I&C SCI H32')?.number).toBe('H32');
    expect(parseCourseCode('MATH 105LA')?.number).toBe('105LA');
    // Long language-course suffixes must not be dropped.
    expect(parseCourseCode('FRENCH 1ABSP')?.number).toBe('1ABSP');
  });

  it('indexes a course under every accepted spelling (criterion 5)', () => {
    const aliases = aliasesForCode('COMPSCI 112');
    expect(aliases).toContain('COMPSCI 112');
    expect(aliases).toContain('CS 112');
    expect(aliases).toContain('CS112');

    // The real ingested course carries them too.
    expect(course('COMPSCI 112').aliases).toContain('CS 112');
  });

  it('expands sequence and slash notation', () => {
    expect(expandSequence('MATH 2A-2B')).toEqual(['MATH 2A', 'MATH 2B']);
    expect(expandSequence('CHINESE 1A-1C')).toEqual(['CHINESE 1A', 'CHINESE 1B', 'CHINESE 1C']);
    expect(expandSequence('MATH 105A/105LA')).toEqual(['MATH 105A', 'MATH 105LA']);
    expect(expandSequence('COMPSCI 161')).toEqual(['COMPSCI 161']);
  });

  it('infers level from the numeric component', () => {
    expect(inferLevel(31)).toBe('lower');
    expect(inferLevel(161)).toBe('upper');
    expect(inferLevel(250)).toBe('graduate');
    expect(inferLevel(400)).toBe('professional');
  });
});

describe('unit parsing', () => {
  it('parses fixed and variable unit ranges', () => {
    expect(parseUnits('<strong>4 Units.</strong>')).toEqual({ min: 4, max: 4, variable: false });
    expect(parseUnits('<strong>1-4 Units.</strong>')).toEqual({ min: 1, max: 4, variable: true });
  });

  it('returns null when the catalogue omits the value', () => {
    expect(parseUnits('<strong> Units.</strong>')).toBeNull();
  });
});

describe('GE designation parsing', () => {
  it('parses a single category', () => {
    expect(parseGeDesignation('(III)', '2026-27').map((g) => g.category)).toEqual(['III']);
  });

  it('parses Ia and Ib as distinct writing subcategories', () => {
    expect(parseGeDesignation('(Ia)', '2026-27')[0]!.category).toBe('Ia');
    expect(parseGeDesignation('(Ib)', '2026-27')[0]!.category).toBe('Ib');
  });

  it('parses combined designations in every printed spelling', () => {
    expect(parseGeDesignation('(II and V.B.)', '2026-27').map((g) => g.category)).toEqual(['II', 'Vb']);
    expect(parseGeDesignation('(II and VA.)', '2026-27').map((g) => g.category)).toEqual(['II', 'Va']);
    expect(parseGeDesignation('(IV and VIII)', '2026-27').map((g) => g.category)).toEqual(['IV', 'VIII']);
    expect(parseGeDesignation('((III or IV) and VII.)', '2026-27').map((g) => g.category)).toEqual(['III', 'IV', 'VII']);
  });

  it('marks Va/Vb alternatives as mutually exclusive', () => {
    const designations = parseGeDesignation('(II and (Va or Vb).)', '2026-27');
    expect(designations.map((g) => g.category)).toEqual(['II', 'Va', 'Vb']);
    expect(designations.find((g) => g.category === 'Va')!.exclusiveWithin).toEqual(['Va', 'Vb']);
    expect(designations.find((g) => g.category === 'II')!.exclusiveWithin).toBeUndefined();
  });

  it('keeps the raw printed text', () => {
    expect(parseGeDesignation('(II and (Va or Vb).)', '2026-27')[0]!.raw).toBe('II and (Va or Vb).');
  });
});

describe('department page parsing', () => {
  it('extracts one block per course including malformed ones', () => {
    expect(extractCourseBlocks(FIXTURE)).toHaveLength(8);
  });

  it('turns every well-formed block into a searchable course (criterion 2)', () => {
    expect(parsed.courses.map((c) => c.normalizedCode).sort()).toEqual([
      'TEST 10', 'TEST 20', 'TEST 250', 'TEST 300', 'TEST 30L', 'TEST 400', 'TEST 99',
    ]);
  });

  it('records a parser error instead of silently dropping a block', () => {
    const codeError = parsed.errors.find((e) => e.stage === 'code');
    expect(codeError?.message).toMatch(/no detail-code span/);

    const unitsError = parsed.errors.find((e) => e.stage === 'units' && e.code === 'TEST 400');
    expect(unitsError).toBeDefined();
    // The course is still searchable despite the missing unit value.
    expect(byCode.get('TEST 400')).toBeDefined();
  });

  it('parses prerequisites and keeps the raw text (criterion 8)', () => {
    const test20 = byCode.get('TEST 20')!;
    expect(test20.prerequisiteRaw).toMatch(/TEST 10 with a minimum grade of C/);
    expect(test20.prerequisiteExpr).toMatchObject({
      op: 'and',
      children: [
        { op: 'course', code: 'TEST 10', minGrade: 'C' },
        { op: 'or', children: [{ code: 'MATH 2A' }, { code: 'MATH 5A' }] },
      ],
    });
  });

  it('keeps restrictions separate from prerequisites (criterion 7)', () => {
    const test20 = byCode.get('TEST 20')!;
    expect(test20.restrictions).toEqual([
      { kind: 'first_consideration', raw: 'Test majors have first consideration for enrollment.' },
    ]);
    // The restriction text never leaks into the prerequisite tree.
    expect(JSON.stringify(test20.prerequisiteExpr)).not.toMatch(/consideration/);
  });

  it('parses corequisites and concurrent rules into separate fields', () => {
    const lab = byCode.get('TEST 30L')!;
    expect(lab.corequisiteExpr).toMatchObject({ op: 'course', code: 'TEST 30' });
    // "Concurrent:" names a co-taught cross-listing, not an enrollment
    // requirement, so it is captured as a duplicate-credit signal instead.
    expect(lab.concurrentRaw).toBe('TEST 20');
    expect(lab.concurrentWith).toEqual(['TEST 20']);
  });

  it('parses same-as, overlaps-with, grading options, and repeatability', () => {
    const seminar = byCode.get('TEST 99')!;
    expect(seminar.units).toEqual({ min: 1, max: 4, variable: true });
    expect(seminar.sameAs).toEqual(['OTHER 99']);
    expect(seminar.overlapsWith).toEqual(['TEST 98']);
    expect(seminar.gradingOptions[0]).toMatch(/Satisfactory\/Unsatisfactory/);
    expect(seminar.repeatability?.maxTimes).toBe(4);
  });

  it('lowers confidence but retains unparsed prerequisite prose', () => {
    const prose = byCode.get('TEST 300')!;
    expect(prose.prerequisiteRaw).toBe('Prerequisites vary.');
    expect(prose.prerequisiteExpr).toMatchObject({ op: 'unknown' });
    expect(prose.parserConfidence).toBeLessThan(1);
    expect(parsed.errors.some((e) => e.stage === 'prerequisite' && e.code === 'TEST 300')).toBe(true);
  });

  it('indexes graduate courses rather than dropping them (criterion 3)', () => {
    expect(byCode.get('TEST 250')!.level).toBe('graduate');
  });

  it('records the official source URL and catalogue year (criterion 4)', () => {
    const test10 = byCode.get('TEST 10')!;
    expect(test10.sourceUrl).toBe('https://catalogue.uci.edu/allcourses/test/');
    expect(test10.catalogueYear).toBe('2026-27');
    expect(test10.retrievedAt).toBe('2026-07-24T00:00:00.000Z');
    expect(test10.rawSourceText).toMatch(/A first course with no prerequisites/);
  });

  it('parses repeatability unit ceilings', () => {
    expect(parseRepeatability('May be repeated for a maximum of 12 units')?.maxUnits).toBe(12);
    expect(parseRepeatability('Unlimited repeatability')?.unlimited).toBe(true);
  });
});

describe('department index discovery (criterion 1)', () => {
  it('finds every department link on the index page', () => {
    expect(parseDepartmentIndex(FIXTURE)).toEqual(['compsci', 'i_c_sci', 'math']);
  });
});

describe('ingested 2026-27 snapshot', () => {
  it('contains real courses from many departments', () => {
    expect(SNAPSHOT.courses.length).toBeGreaterThan(100);
    expect(SNAPSHOT.catalogueYear).toBe('2026-27');
  });

  it('preserves the official code spelling while normalizing for matching', () => {
    const ics = course('I&C SCI 31');
    expect(ics.code).toBe('I&C SCI 31');
    expect(ics.normalizedCode).toBe('I&C SCI 31');
    expect(ics.aliases).toContain('ICS 31');
  });

  it('records the first-consideration restriction on COMPSCI 112 (criterion 7)', () => {
    const c = course('COMPSCI 112');
    expect(c.restrictions[0]!.kind).toBe('first_consideration');
    expect(c.restrictions[0]!.raw).toMatch(/first consideration for enrollment/);
    expect(c.prerequisiteRaw).toBeDefined();
  });
});
