import type { Course, GeCategory } from '../../domain/courses/types';
import { normalizeCourseCode } from '../../domain/courses/codes';

/**
 * In-memory course search over the full catalogue snapshot.
 *
 * Searching `COMPSCI 112`, `CS 112`, or title words all find the same official
 * course (acceptance criterion 5). Filters combine (criterion 6).
 */

export type PrerequisiteFilter = 'any' | 'satisfied' | 'unsatisfied' | 'none';
export type OfferingFilter = 'any' | 'scheduled' | 'planned' | 'likely' | 'unknown';

export interface SearchFilters {
  query: string;
  departments: string[];
  levels: Array<'lower' | 'upper' | 'graduate' | 'professional'>;
  geCategories: GeCategory[];
  minUnits: number | null;
  maxUnits: number | null;
  /** Off by default: graduate/professional courses stay indexed but hidden. */
  includeGraduate: boolean;
  /** Hide courses that carry an enrollment restriction. */
  hideRestricted: boolean;
  prerequisiteState: PrerequisiteFilter;
  offeringState: OfferingFilter;
  /** Restrict to an explicit code list, set by clicking a requirement badge. */
  onlyCodes: string[] | null;
}

export const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  departments: [],
  levels: [],
  geCategories: [],
  minUnits: null,
  maxUnits: null,
  includeGraduate: false,
  hideRestricted: false,
  prerequisiteState: 'any',
  offeringState: 'any',
  onlyCodes: null,
};

export function filtersAreDefault(filters: SearchFilters): boolean {
  return (
    filters.query.trim() === '' &&
    filters.departments.length === 0 &&
    filters.levels.length === 0 &&
    filters.geCategories.length === 0 &&
    filters.minUnits === null &&
    filters.maxUnits === null &&
    !filters.includeGraduate &&
    !filters.hideRestricted &&
    filters.prerequisiteState === 'any' &&
    filters.offeringState === 'any' &&
    filters.onlyCodes === null
  );
}

/** Short human list of what is currently narrowing the results. */
export function describeActiveFilters(filters: SearchFilters): string[] {
  const parts: string[] = [];
  if (filters.query.trim()) parts.push(`text “${filters.query.trim()}”`);
  if (filters.departments.length) parts.push(`department ${filters.departments.join(', ')}`);
  if (filters.levels.length) parts.push(`level ${filters.levels.join(', ')}`);
  if (filters.geCategories.length) parts.push(`GE ${filters.geCategories.join(', ')}`);
  if (filters.minUnits !== null) parts.push(`min ${filters.minUnits} units`);
  if (filters.maxUnits !== null) parts.push(`max ${filters.maxUnits} units`);
  if (filters.includeGraduate) parts.push('graduate courses shown');
  if (filters.hideRestricted) parts.push('restricted courses hidden');
  if (filters.prerequisiteState !== 'any') parts.push(`prerequisites ${filters.prerequisiteState}`);
  if (filters.offeringState !== 'any') parts.push(`offering ${filters.offeringState}`);
  if (filters.onlyCodes) parts.push(`${filters.onlyCodes.length} suggested courses`);
  return parts;
}

interface ScoredCourse {
  course: Course;
  score: number;
}

/**
 * Score a course against the free-text query.
 * Returns -1 when it does not match at all.
 */
function scoreQuery(course: Course, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return 0;

  const normalizedQuery = normalizeCourseCode(rawQuery).toLowerCase();
  const code = course.normalizedCode.toLowerCase();
  const title = course.title.toLowerCase();

  // Exact code match, via any accepted alias spelling.
  if (code === normalizedQuery) return 1000;
  if (course.aliases.some((a) => a.toLowerCase() === query || a.toLowerCase() === normalizedQuery)) return 990;

  // Code prefix, e.g. "compsci 1" or "cs 11".
  if (code.startsWith(normalizedQuery)) return 800;
  if (course.aliases.some((a) => a.toLowerCase().startsWith(query))) return 780;

  if (title === query) return 700;
  if (title.startsWith(query)) return 600;

  // All query words appear in the title.
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => title.includes(w))) return 500;

  if (title.includes(query)) return 400;
  if (course.department.toLowerCase().includes(query)) return 200;
  if (course.description.toLowerCase().includes(query)) return 100;

  return -1;
}

export interface SearchContext {
  /** Prerequisite status per normalized code for the selected term. */
  prerequisiteStatus?: Map<string, 'satisfied' | 'unsatisfied' | 'unknown'>;
  /** Offering state per normalized code for the selected term. */
  offeringStatus?: Map<string, string>;
}

export function searchCourses(
  courses: Course[],
  filters: SearchFilters,
  context: SearchContext = {},
  limit = 200,
): { results: Course[]; total: number } {
  const onlyCodes = filters.onlyCodes ? new Set(filters.onlyCodes.map(normalizeCourseCode)) : null;
  const scored: ScoredCourse[] = [];

  for (const course of courses) {
    if (onlyCodes && !onlyCodes.has(course.normalizedCode)) continue;

    // Graduate/professional courses stay indexed but hidden by default.
    const isAdvanced = course.level === 'graduate' || course.level === 'professional';
    if (isAdvanced && !filters.includeGraduate) continue;

    if (filters.departments.length > 0 && !filters.departments.includes(course.department)) continue;
    if (filters.levels.length > 0 && !filters.levels.includes(course.level)) continue;

    if (filters.geCategories.length > 0) {
      const categories = course.geCategories.map((g) => g.category);
      if (!filters.geCategories.some((c) => categories.includes(c))) continue;
    }

    if (filters.minUnits !== null && course.units.max < filters.minUnits) continue;
    if (filters.maxUnits !== null && course.units.min > filters.maxUnits) continue;

    if (filters.hideRestricted && course.restrictions.length > 0) continue;

    if (filters.prerequisiteState !== 'any') {
      if (filters.prerequisiteState === 'none') {
        if (course.prerequisiteExpr) continue;
      } else {
        const status = context.prerequisiteStatus?.get(course.normalizedCode);
        if (status !== filters.prerequisiteState) continue;
      }
    }

    if (filters.offeringState !== 'any') {
      const state = context.offeringStatus?.get(course.normalizedCode) ?? 'unknown';
      if (state !== filters.offeringState) continue;
    }

    const score = scoreQuery(course, filters.query);
    if (score < 0) continue;
    scored.push({ course, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.course.department.localeCompare(b.course.department) ||
      a.course.numericValue - b.course.numericValue ||
      a.course.number.localeCompare(b.course.number),
  );

  return { results: scored.slice(0, limit).map((s) => s.course), total: scored.length };
}

/** Distinct departments present in the snapshot, for the filter dropdown. */
export function departmentList(courses: Course[]): string[] {
  return Array.from(new Set(courses.map((c) => c.department))).sort();
}

export const GE_FILTER_OPTIONS: Array<{ value: GeCategory; label: string }> = [
  { value: 'Ia', label: 'Ia — Lower-division writing' },
  { value: 'Ib', label: 'Ib — Upper-division writing' },
  { value: 'II', label: 'II — Science and Technology' },
  { value: 'III', label: 'III — Social and Behavioral Sciences' },
  { value: 'IV', label: 'IV — Arts and Humanities' },
  { value: 'Va', label: 'Va — Quantitative' },
  { value: 'Vb', label: 'Vb — Symbolic and Computational' },
  { value: 'VI', label: 'VI — Language Other Than English' },
  { value: 'VII', label: 'VII — Multicultural Studies' },
  { value: 'VIII', label: 'VIII — International/Global Issues' },
];
