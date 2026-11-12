import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  departmentList,
  describeActiveFilters,
  filtersAreDefault,
  searchCourses,
  type SearchFilters,
} from '../../src/features/course-explorer/search';
import { SNAPSHOT } from '../helpers';

const COURSES = SNAPSHOT.courses;

function search(overrides: Partial<SearchFilters>) {
  return searchCourses(COURSES, { ...DEFAULT_FILTERS, ...overrides });
}

const codesOf = (result: { results: Array<{ normalizedCode: string }> }) =>
  result.results.map((c) => c.normalizedCode);

describe('course search (criterion 5)', () => {
  it('finds the same course by official code, alias, and title words', () => {
    expect(codesOf(search({ query: 'COMPSCI 112' }))[0]).toBe('COMPSCI 112');
    expect(codesOf(search({ query: 'CS 112' }))[0]).toBe('COMPSCI 112');
    expect(codesOf(search({ query: 'cs112' }))[0]).toBe('COMPSCI 112');
    expect(codesOf(search({ query: 'Computer Graphics' }))).toContain('COMPSCI 112');
  });

  it('resolves the ICS and Informatics aliases', () => {
    expect(codesOf(search({ query: 'ICS 31' }))[0]).toBe('I&C SCI 31');
    expect(codesOf(search({ query: 'I&C SCI 31' }))[0]).toBe('I&C SCI 31');
    expect(codesOf(search({ query: 'INF 131' }))[0]).toBe('IN4MATX 131');
  });

  it('ranks an exact code match above a keyword match', () => {
    const results = codesOf(search({ query: 'MATH 2A' }));
    expect(results[0]).toBe('MATH 2A');
  });

  it('returns nothing for a query that matches no course', () => {
    expect(search({ query: 'zzzz-not-a-course' }).total).toBe(0);
  });
});

describe('filters combine (criterion 6)', () => {
  it('hides graduate and professional courses by default but keeps them indexed (criterion 3)', () => {
    const advanced = COURSES.filter((c) => c.level === 'graduate' || c.level === 'professional');
    // The fixture must actually contain some, or this test proves nothing.
    expect(advanced.length).toBeGreaterThan(0);

    const hidden = search({});
    expect(hidden.results.every((c) => c.level !== 'graduate' && c.level !== 'professional')).toBe(true);

    const shown = search({ includeGraduate: true });
    expect(shown.total).toBe(hidden.total + advanced.length);

    // A graduate course is still findable by exact code once the toggle is on.
    const sample = advanced[0]!;
    expect(codesOf(search({ query: sample.normalizedCode, includeGraduate: true }))).toContain(
      sample.normalizedCode,
    );
    expect(codesOf(search({ query: sample.normalizedCode }))).not.toContain(sample.normalizedCode);
  });

  it('filters by department', () => {
    const result = search({ departments: ['MATH'] });
    expect(result.total).toBeGreaterThan(0);
    expect(result.results.every((c) => c.department === 'MATH')).toBe(true);
  });

  it('filters by level', () => {
    const result = search({ levels: ['upper'] });
    expect(result.results.every((c) => c.level === 'upper')).toBe(true);
  });

  it('filters by GE category', () => {
    const result = search({ geCategories: ['Ib'] });
    expect(result.total).toBeGreaterThan(0);
    expect(
      result.results.every((c) => c.geCategories.some((g) => g.category === 'Ib')),
    ).toBe(true);
  });

  it('filters by unit range', () => {
    const result = search({ minUnits: 4, maxUnits: 4 });
    expect(result.results.every((c) => c.units.min <= 4 && c.units.max >= 4)).toBe(true);
  });

  it('hides restricted courses on request', () => {
    const all = search({ departments: ['COMPSCI'] });
    const unrestricted = search({ departments: ['COMPSCI'], hideRestricted: true });

    expect(unrestricted.total).toBeLessThan(all.total);
    expect(unrestricted.results.every((c) => c.restrictions.length === 0)).toBe(true);
  });

  it('filters to courses with no prerequisites', () => {
    const result = search({ departments: ['MATH'], prerequisiteState: 'none' });
    expect(result.results.every((c) => !c.prerequisiteExpr)).toBe(true);
  });

  it('applies department, level, and units together', () => {
    const result = search({ departments: ['MATH'], levels: ['upper'], minUnits: 4, maxUnits: 4 });

    expect(result.total).toBeGreaterThan(0);
    for (const c of result.results) {
      expect(c.department).toBe('MATH');
      expect(c.level).toBe('upper');
      expect(c.units.max).toBe(4);
    }
  });

  it('applies a text query on top of structural filters', () => {
    const broad = search({ departments: ['MATH'], levels: ['upper'] });
    const narrowed = search({ departments: ['MATH'], levels: ['upper'], query: 'algebra' });

    expect(narrowed.total).toBeGreaterThan(0);
    expect(narrowed.total).toBeLessThan(broad.total);
    expect(narrowed.results.every((c) => c.department === 'MATH' && c.level === 'upper')).toBe(true);
  });

  it('restricts to an explicit code list from a requirement badge', () => {
    const result = search({ onlyCodes: ['COMPSCI 112', 'COMPSCI 121'] });
    expect(codesOf(result).sort()).toEqual(['COMPSCI 112', 'COMPSCI 121']);
  });

  it('yields no results when filters conflict, without throwing', () => {
    const result = search({ departments: ['MATH'], geCategories: ['VII'], levels: ['graduate'] });
    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });
});

describe('filter descriptions and reset', () => {
  it('recognises the default filter set', () => {
    expect(filtersAreDefault(DEFAULT_FILTERS)).toBe(true);
    expect(filtersAreDefault({ ...DEFAULT_FILTERS, query: 'x' })).toBe(false);
  });

  it('describes every active filter so an empty result can explain itself', () => {
    const description = describeActiveFilters({
      ...DEFAULT_FILTERS,
      query: 'graphics',
      departments: ['COMPSCI'],
      levels: ['upper'],
      geCategories: ['II'],
      minUnits: 4,
      hideRestricted: true,
    });
    const text = description.join('; ');

    expect(text).toMatch(/graphics/);
    expect(text).toMatch(/COMPSCI/);
    expect(text).toMatch(/upper/);
    expect(text).toMatch(/GE II/);
    expect(text).toMatch(/min 4 units/);
    expect(text).toMatch(/restricted courses hidden/);
  });

  it('lists departments for the filter dropdown', () => {
    const departments = departmentList(COURSES);
    expect(departments).toContain('COMPSCI');
    expect(departments).toContain('MATH');
    expect(departments).toEqual([...departments].sort());
  });
});
