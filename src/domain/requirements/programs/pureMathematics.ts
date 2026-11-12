import type { Requirement, RequirementProgram } from '../types';
import { DEFAULT_GRADE_POLICY, PRECEDENCE } from '../types';

/**
 * Mathematics, B.S. — Pure Mathematics (2026-27).
 * Source: 02_UCI_REQUIREMENTS_2026_27.md, transcribed from
 * https://catalogue.uci.edu/.../mathematics_bs/#requirementstext
 *
 * Structural rules encoded here:
 *   - Core B is one *complete* three-course path; mixed paths do not count.
 *   - The five additional electives must be four-unit MATH lecture courses
 *     numbered 100-189 and may not silently reuse a named required course.
 */

const SOURCE_URL =
  'https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/mathematics_bs/#requirementstext';
const YEAR = '2026-27';

/** All Pure Math requirements share this group, so named courses are not reused. */
const MATH_PURE = 'math_pure';

function req(
  partial: Omit<Requirement, 'catalogueYear' | 'sourceUrl' | 'grade' | 'allowSubstitution'> & Partial<Requirement>,
): Requirement {
  return {
    catalogueYear: YEAR,
    sourceUrl: SOURCE_URL,
    grade: DEFAULT_GRADE_POLICY,
    allowSubstitution: true,
    ...partial,
  } as Requirement;
}

export const PURE_MATH_CORE_A = [
  'MATH 2A', 'MATH 2B', 'MATH 2D', 'MATH 3A', 'MATH 3D', 'MATH 9',
  'MATH 13', 'MATH 120A', 'MATH 121A', 'MATH 130A', 'MATH 140A', 'MATH 140B',
];

/** Core B: three atomic science paths. A mixed selection satisfies none of them. */
export const PURE_MATH_SCIENCE_PATHS = [
  { id: 'chem', title: 'CHEM 1A, 1B, 1C', courses: ['CHEM 1A', 'CHEM 1B', 'CHEM 1C'] },
  { id: 'physics', title: 'PHYSICS 7C, 7D, 7E', courses: ['PHYSICS 7C', 'PHYSICS 7D', 'PHYSICS 7E'] },
  { id: 'stats_math_physics', title: 'STATS 7, MATH 10, PHYSICS 7C', courses: ['STATS 7', 'MATH 10', 'PHYSICS 7C'] },
];

export const PURE_MATH_UPPER_ADDITIONS = ['MATH 120B', 'MATH 121B', 'MATH 147'];

/**
 * Named courses that may not be recycled as one of the five additional
 * electives. Everything the program requires by name is listed here.
 */
export const PURE_MATH_NAMED_COURSES = [
  ...PURE_MATH_CORE_A,
  'MATH 2E',
  ...PURE_MATH_UPPER_ADDITIONS,
];

const coreA: Requirement = req({
  id: 'math.pure.core_a',
  title: 'Core A — required Mathematics courses',
  precedence: PRECEDENCE.NAMED_COURSE,
  sharing: { exclusionGroups: [MATH_PURE] },
  rule: {
    kind: 'all_of',
    children: PURE_MATH_CORE_A.map((code) =>
      req({
        id: `math.pure.core_a.${code.replace(/\W+/g, '_').toLowerCase()}`,
        title: code,
        precedence: PRECEDENCE.NAMED_COURSE,
        sharing: { exclusionGroups: [MATH_PURE] },
        rule: { kind: 'course', code },
      }),
    ),
  },
});

const coreB: Requirement = req({
  id: 'math.pure.core_b',
  title: 'Core B — one three-course science sequence',
  description:
    'Choose one complete path: CHEM 1A-1B-1C, PHYSICS 7C-7D-7E, or STATS 7 + MATH 10 + PHYSICS 7C. A mixed selection does not satisfy this requirement.',
  precedence: PRECEDENCE.SHORT_LIST,
  sharing: { exclusionGroups: [MATH_PURE] },
  rule: {
    kind: 'any_of',
    children: PURE_MATH_SCIENCE_PATHS.map((path) =>
      req({
        id: `math.pure.core_b.${path.id}`,
        title: path.title,
        precedence: PRECEDENCE.NAMED_COURSE,
        sharing: { exclusionGroups: [MATH_PURE] },
        rule: {
          kind: 'all_of',
          children: path.courses.map((code) =>
            req({
              id: `math.pure.core_b.${path.id}.${code.replace(/\W+/g, '_').toLowerCase()}`,
              title: code,
              precedence: PRECEDENCE.NAMED_COURSE,
              sharing: { exclusionGroups: [MATH_PURE] },
              rule: { kind: 'course', code },
            }),
          ),
        },
      }),
    ),
  },
});

const pureAdditions: Requirement[] = [
  req({
    id: 'math.pure.lower.math_2e',
    title: 'MATH 2E',
    precedence: PRECEDENCE.NAMED_COURSE,
    sharing: { exclusionGroups: [MATH_PURE] },
    rule: { kind: 'course', code: 'MATH 2E' },
  }),
  ...PURE_MATH_UPPER_ADDITIONS.map((code) =>
    req({
      id: `math.pure.upper.${code.replace(/\W+/g, '_').toLowerCase()}`,
      title: code,
      precedence: PRECEDENCE.NAMED_COURSE,
      sharing: { exclusionGroups: [MATH_PURE] },
      rule: { kind: 'course', code },
    }),
  ),
  req({
    id: 'math.pure.upper.electives',
    title: 'Five additional MATH lecture courses, 100-189',
    description:
      'Five additional four-unit MATH lecture courses numbered 100-189. Courses already required by name above do not count here.',
    precedence: PRECEDENCE.ELECTIVE_RANGE,
    sharing: { exclusionGroups: [MATH_PURE] },
    rule: {
      kind: 'course_range',
      n: 5,
      filter: {
        departments: ['MATH'],
        minNumber: 100,
        maxNumber: 189,
        unitsExactly: 4,
        excludeCodes: PURE_MATH_NAMED_COURSES,
      },
    },
  }),
];

export const PURE_MATHEMATICS_BS: RequirementProgram = {
  id: 'mathematics_bs_pure',
  title: 'Mathematics, B.S. — Pure Mathematics',
  category: 'math',
  catalogueYear: YEAR,
  sourceUrl: SOURCE_URL,
  requirements: [coreA, coreB, ...pureAdditions],
};

export const PURE_MATH_GPA_REQUIREMENTS: Requirement[] = [
  req({
    id: 'math.pure.gpa.major',
    title: 'Mathematics major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: { kind: 'gpa', minimum: 2.0, filter: { departments: ['MATH'] } },
  }),
  req({
    id: 'math.pure.gpa.upper_division_major',
    title: 'Mathematics upper-division major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: { kind: 'gpa', minimum: 2.0, filter: { departments: ['MATH'], levels: ['upper'] } },
  }),
];
