import type { Requirement, RequirementGroup, RequirementProgram } from '../types';
import { DEFAULT_GRADE_POLICY, PRECEDENCE } from '../types';

/**
 * Computer Science, B.S. — 2026-27.
 * Source: 02_UCI_REQUIREMENTS_2026_27.md, transcribed from
 * https://catalogue.uci.edu/.../computerscience_bs/#requirementstext
 *
 * Key structural rules encoded here:
 *   - Courses used in one upper-division section do not apply to another,
 *     except COMPSCI 145, which may apply to both Flexible Core and Project.
 *   - The Flexible Core needs four courses from four *distinct* focus areas.
 *   - The science requirement is two GE II courses, excluding those offered by
 *     Engineering, ICS, Economics, and Mathematics.
 */

const SOURCE_URL =
  'https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/#requirementstext';

const YEAR = '2026-27';

/** All CS upper-division sections share this group, so a course is used once. */
const CS_SECTIONS = 'cs_sections';

/**
 * The single explicit catalogue exception: COMPSCI 145 may count in both the
 * Flexible Core and the Project section.
 */
const CS145_EXCEPTION = ['COMPSCI 145'];

export const CS_FOCUS_AREAS: RequirementGroup[] = [
  { id: 'FA1', title: 'Vision and Graphics', courses: ['COMPSCI 112', 'COMPSCI 116'] },
  { id: 'FA2', title: 'Information Management', courses: ['COMPSCI 121', 'COMPSCI 122A'] },
  { id: 'FA3', title: 'Networks and Cybersecurity', courses: ['COMPSCI 130', 'COMPSCI 132', 'COMPSCI 134'] },
  { id: 'FA4', title: 'Systems and Software', courses: ['COMPSCI 141', 'COMPSCI 142A', 'COMPSCI 143A'] },
  { id: 'FA5', title: 'Architecture and Embedded Systems', courses: ['COMPSCI 145', 'COMPSCI 151', 'COMPSCI 152'] },
  { id: 'FA6', title: 'Algorithms', courses: ['COMPSCI 162', 'COMPSCI 163', 'COMPSCI 164', 'COMPSCI 167'] },
  { id: 'FA7', title: 'Artificial Intelligence and Machine Learning', courses: ['COMPSCI 171', 'COMPSCI 178', 'COMPSCI 184A'] },
];

export const CS_PROJECT_COURSES = [
  'COMPSCI 114', 'COMPSCI 117', 'COMPSCI 118', 'COMPSCI 122B', 'COMPSCI 122C',
  'COMPSCI 122D', 'COMPSCI 125', 'COMPSCI 133', 'COMPSCI 142B', 'COMPSCI 143B',
  'COMPSCI 145', 'COMPSCI 147', 'COMPSCI 154', 'COMPSCI 165', 'COMPSCI 175',
  'COMPSCI 180A', 'COMPSCI 180B', 'COMPSCI 189', 'SWE 117', 'IN4MATX 134',
];

/** Additional non-COMPSCI codes eligible for the nine upper-division electives. */
export const CS_ELECTIVE_EXTRA_COURSES = [
  'SWE 113', 'SWE 115', 'SWE 117', 'SWE 121', 'SWE 122', 'SWE 124',
  'IN4MATX 131', 'IN4MATX 133', 'IN4MATX 134',
];

function req(partial: Omit<Requirement, 'catalogueYear' | 'sourceUrl' | 'grade' | 'allowSubstitution'> & Partial<Requirement>): Requirement {
  return {
    catalogueYear: YEAR,
    sourceUrl: SOURCE_URL,
    grade: DEFAULT_GRADE_POLICY,
    allowSubstitution: true,
    ...partial,
  } as Requirement;
}

const lowerDivision: Requirement[] = [
  req({
    id: 'cs.lower.programming_series',
    title: 'Programming series',
    description: 'I&C SCI 31, 32, 33; or the accelerated I&C SCI H32, 33 route.',
    precedence: PRECEDENCE.SHORT_LIST,
    sharing: { exclusionGroups: [CS_SECTIONS] },
    rule: {
      kind: 'any_of',
      children: [
        req({
          id: 'cs.lower.programming_series.standard',
          title: 'I&C SCI 31, 32, and 33',
          precedence: PRECEDENCE.NAMED_COURSE,
          sharing: { exclusionGroups: [CS_SECTIONS] },
          rule: {
            kind: 'all_of',
            children: ['I&C SCI 31', 'I&C SCI 32', 'I&C SCI 33'].map((code) =>
              req({
                id: `cs.lower.programming_series.standard.${code.replace(/\W+/g, '_')}`,
                title: code,
                precedence: PRECEDENCE.NAMED_COURSE,
                sharing: { exclusionGroups: [CS_SECTIONS] },
                rule: { kind: 'course', code },
              }),
            ),
          },
        }),
        req({
          id: 'cs.lower.programming_series.accelerated',
          title: 'I&C SCI H32 and 33 (accelerated)',
          precedence: PRECEDENCE.NAMED_COURSE,
          sharing: { exclusionGroups: [CS_SECTIONS] },
          rule: {
            kind: 'all_of',
            children: ['I&C SCI H32', 'I&C SCI 33'].map((code) =>
              req({
                id: `cs.lower.programming_series.accelerated.${code.replace(/\W+/g, '_')}`,
                title: code,
                precedence: PRECEDENCE.NAMED_COURSE,
                sharing: { exclusionGroups: [CS_SECTIONS] },
                rule: { kind: 'course', code },
              }),
            ),
          },
        }),
      ],
    },
  }),

  ...['I&C SCI 45C', 'I&C SCI 46', 'I&C SCI 51', 'I&C SCI 53', 'SWE 43', 'MATH 2A', 'MATH 2B', 'I&C SCI 6B', 'I&C SCI 6D', 'STATS 67'].map(
    (code) =>
      req({
        id: `cs.lower.${code.replace(/\W+/g, '_').toLowerCase()}`,
        title: code,
        precedence: PRECEDENCE.NAMED_COURSE,
        sharing: { exclusionGroups: [CS_SECTIONS] },
        rule: { kind: 'course', code },
      }),
  ),

  req({
    id: 'cs.lower.discrete_math_alt',
    title: 'I&C SCI 6N or MATH 3A',
    description:
      'Choosing MATH 3A also satisfies the Mathematics major linear-algebra requirement, so it is the efficient double-major choice.',
    precedence: PRECEDENCE.SHORT_LIST,
    sharing: { exclusionGroups: [CS_SECTIONS] },
    rule: { kind: 'choose_n_courses', n: 1, options: ['I&C SCI 6N', 'MATH 3A'] },
  }),

  req({
    id: 'cs.lower.science',
    title: 'Science — two GE II courses',
    description:
      'Two GE Category II courses, excluding courses offered by the School of Engineering, the School of Information and Computer Sciences, the Department of Economics, and the Department of Mathematics.',
    precedence: PRECEDENCE.ELECTIVE_RANGE,
    sharing: { exclusionGroups: [CS_SECTIONS] },
    verificationNote:
      'University Studies courses require approval from the CS Vice Chair for Undergraduate Studies.',
    rule: {
      kind: 'course_range',
      n: 2,
      filter: {
        geCategories: ['II'],
        excludeOfferedBy: [
          'ENGR', 'ENGRCEE', 'ENGRMAE', 'ENGRMSE', 'BME', 'CBE', 'EECS', 'MSE', 'CSE',
          'I&C SCI', 'COMPSCI', 'IN4MATX', 'SWE', 'STATS', 'DATA', 'GDIM',
          'ECON',
          'MATH',
        ],
      },
    },
  }),
];

const upperDivision: Requirement[] = [
  req({
    id: 'cs.upper.core',
    title: 'A. Core',
    description: 'COMPSCI 161 and I&C SCI 139W.',
    precedence: PRECEDENCE.NAMED_COURSE,
    sharing: { exclusionGroups: [CS_SECTIONS] },
    rule: {
      kind: 'all_of',
      children: ['COMPSCI 161', 'I&C SCI 139W'].map((code) =>
        req({
          id: `cs.upper.core.${code.replace(/\W+/g, '_').toLowerCase()}`,
          title: code,
          precedence: PRECEDENCE.NAMED_COURSE,
          sharing: { exclusionGroups: [CS_SECTIONS] },
          rule: { kind: 'course', code },
        }),
      ),
    },
  }),

  req({
    id: 'cs.upper.flexible_core',
    title: 'B. Flexible Core — four courses from four distinct focus areas',
    description:
      'Four courses drawn from four different focus areas. Two courses from the same focus area complete only one area.',
    precedence: PRECEDENCE.DISTINCT_GROUPS,
    // COMPSCI 145 is the one course allowed to also serve the Project section.
    sharing: { exclusionGroups: [CS_SECTIONS], sharingExceptions: CS145_EXCEPTION },
    rule: { kind: 'choose_n_distinct_groups', n: 4, groups: CS_FOCUS_AREAS },
  }),

  req({
    id: 'cs.upper.electives',
    title: 'C. Upper-division electives — nine courses',
    description:
      'COMPSCI 103-189, SWE 113/115/117/121/122/124, or IN4MATX 131/133/134. Courses already consumed by another CS section do not count here.',
    precedence: PRECEDENCE.ELECTIVE_RANGE,
    sharing: { exclusionGroups: [CS_SECTIONS] },
    rule: {
      kind: 'course_range',
      n: 9,
      filter: {
        departments: ['COMPSCI', 'SWE', 'IN4MATX'],
        minNumber: 103,
        maxNumber: 189,
        // Only the listed SWE / IN4MATX codes are eligible; every COMPSCI
        // course in range is. Enforced by `allowedCodes` below.
      },
    },
  }),

  req({
    id: 'cs.upper.projects',
    title: 'D. Project courses — two',
    description:
      'Two courses from the official project list. COMPSCI 180A and 180B must both be completed and passed to receive course credit.',
    precedence: PRECEDENCE.LONG_LIST,
    sharing: { exclusionGroups: [CS_SECTIONS], sharingExceptions: CS145_EXCEPTION },
    verificationNote:
      'COMPSCI 180A and COMPSCI 180B are a paired sequence: both must be completed and passed for course credit.',
    rule: { kind: 'choose_n_courses', n: 2, options: CS_PROJECT_COURSES },
  }),
];

export const COMPUTER_SCIENCE_BS: RequirementProgram = {
  id: 'computer_science_bs',
  title: 'Computer Science, B.S.',
  category: 'cs',
  catalogueYear: YEAR,
  sourceUrl: SOURCE_URL,
  requirements: [...lowerDivision, ...upperDivision],
};

/**
 * Explicit eligible-code list for the nine upper-division electives.
 * A bare department+range filter would wrongly admit every SWE and IN4MATX
 * course in the 103-189 band.
 */
export function csElectiveAllowedCodes(allCourseCodes: string[]): string[] {
  const compsci = allCourseCodes.filter((code) => {
    if (!code.startsWith('COMPSCI ')) return false;
    const n = Number.parseInt(code.slice(8), 10);
    return Number.isFinite(n) && n >= 103 && n <= 189;
  });
  return [...compsci, ...CS_ELECTIVE_EXTRA_COURSES];
}

/** GPA rules the CS audit tracks separately (02 — UCI-wide requirements). */
export const CS_GPA_REQUIREMENTS: Requirement[] = [
  req({
    id: 'cs.gpa.major',
    title: 'CS major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: { kind: 'gpa', minimum: 2.0, filter: { departments: ['COMPSCI', 'I&C SCI', 'SWE', 'IN4MATX', 'STATS', 'MATH'] } },
  }),
  req({
    id: 'cs.gpa.upper_division_major',
    title: 'CS upper-division major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: {
      kind: 'gpa',
      minimum: 2.0,
      filter: { departments: ['COMPSCI', 'I&C SCI', 'SWE', 'IN4MATX'], levels: ['upper'] },
    },
  }),
];
