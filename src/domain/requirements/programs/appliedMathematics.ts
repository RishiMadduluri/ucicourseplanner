import type { Requirement, RequirementProgram } from '../types';
import { DEFAULT_GRADE_POLICY, PRECEDENCE } from '../types';

/**
 * Applied and Computational Mathematics, B.S. — 2026-27.
 * Source: 02_UCI_REQUIREMENTS_2026_27.md, transcribed from
 * https://catalogue.uci.edu/.../appliedandcomputationalmathematics_bs/#requirementstext
 *
 * This is an *alternate* Mathematics scenario. UCI prohibits double majoring in
 * Mathematics, B.S. and Applied and Computational Mathematics, B.S., so the two
 * are never simultaneously active — enforced in `activeProgramsFor`.
 *
 * Structural rules encoded here:
 *   - MATH 105A/105LA and 105B/105LB are paired lecture+lab requirements.
 *   - The three additional lower-division courses are *individual* selections,
 *     not a three-course sequence.
 *   - MATH 107 pairs with MATH 107L and counts as one elective selection.
 *   - Outside-Mathematics electives must come from the official list; anything
 *     else needs a recorded adviser-approved substitution.
 */

const SOURCE_URL =
  'https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/appliedandcomputationalmathematics_bs/#requirementstext';
const YEAR = '2026-27';
const MATH_APPLIED = 'math_applied';

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

export const APPLIED_LOWER_CORE = [
  'MATH 2A', 'MATH 2B', 'MATH 2D', 'MATH 2E', 'MATH 3A', 'MATH 3D', 'MATH 9', 'MATH 13',
];

export const APPLIED_UPPER_CORE_SINGLE = [
  'MATH 121A', 'MATH 121B', 'MATH 130A', 'MATH 140A', 'MATH 140B',
];

/** Lecture + lab pairs that must both be taken. */
export const APPLIED_UPPER_CORE_PAIRS: Array<{ id: string; codes: string[] }> = [
  { id: 'math_105a', codes: ['MATH 105A', 'MATH 105LA'] },
  { id: 'math_105b', codes: ['MATH 105B', 'MATH 105LB'] },
];

export const APPLIED_ADDITIONAL_LOWER_OPTIONS = [
  'BIO SCI 93', 'BIO SCI 94', 'BIO SCI 97',
  'CHEM 1A', 'CHEM 1B', 'CHEM 1C',
  'MATH 10',
  'PHYSICS 7C', 'PHYSICS 7D', 'PHYSICS 7E',
  'STATS 7',
];

export const APPLIED_SEQUENCE = ['MATH 112A', 'MATH 112B', 'MATH 115'];

/**
 * Mathematics electives — choose three. MATH 107 carries its paired lab, so it
 * is modelled as a pair rather than a bare course option.
 */
export const APPLIED_MATH_ELECTIVE_SINGLES = [
  'MATH 110A', 'MATH 110B', 'MATH 112C', 'MATH 113A', 'MATH 113B',
  'MATH 117', 'MATH 118', 'MATH 120A', 'MATH 130B', 'MATH 130C',
  'MATH 134A', 'MATH 134B', 'MATH 140C', 'MATH 147', 'MATH 176', 'MATH 178',
];

export const APPLIED_MATH_ELECTIVE_PAIR = ['MATH 107', 'MATH 107L'];

/** The official outside-Mathematics upper-division elective list. */
export const APPLIED_OUTSIDE_OPTIONS = [
  'COMPSCI 122A', 'COMPSCI 161', 'COMPSCI 171', 'COMPSCI 172B', 'COMPSCI 178', 'COMPSCI 183',
  'ECON 100A', 'ECON 105A', 'ECON 105B',
  'MGMT 101', 'MGMT 105', 'MGMT 107',
  'PHILOS 104', 'PHILOS 105A', 'PHILOS 105B',
  'PHYSICS 100', 'PHYSICS 111A', 'PHYSICS 111B', 'PHYSICS 116', 'PHYSICS 125A', 'PHYSICS 125B',
  'STATS 110', 'STATS 111', 'STATS 112', 'STATS 120B',
];

const requirements: Requirement[] = [
  req({
    id: 'math.applied.lower_core',
    title: 'Lower-division core',
    precedence: PRECEDENCE.NAMED_COURSE,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    rule: {
      kind: 'all_of',
      children: APPLIED_LOWER_CORE.map((code) =>
        req({
          id: `math.applied.lower_core.${code.replace(/\W+/g, '_').toLowerCase()}`,
          title: code,
          precedence: PRECEDENCE.NAMED_COURSE,
          sharing: { exclusionGroups: [MATH_APPLIED] },
          rule: { kind: 'course', code },
        }),
      ),
    },
  }),

  req({
    id: 'math.applied.upper_core',
    title: 'Upper-division core',
    description: 'Includes the MATH 105A/105LA and MATH 105B/105LB lecture-and-lab pairs.',
    precedence: PRECEDENCE.NAMED_COURSE,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    rule: {
      kind: 'all_of',
      children: [
        ...APPLIED_UPPER_CORE_PAIRS.map((pair) =>
          req({
            id: `math.applied.upper_core.${pair.id}`,
            title: pair.codes.join(' + '),
            precedence: PRECEDENCE.PAIRED_COURSE,
            sharing: { exclusionGroups: [MATH_APPLIED] },
            rule: { kind: 'course_pair', codes: pair.codes },
          }),
        ),
        ...APPLIED_UPPER_CORE_SINGLE.map((code) =>
          req({
            id: `math.applied.upper_core.${code.replace(/\W+/g, '_').toLowerCase()}`,
            title: code,
            precedence: PRECEDENCE.NAMED_COURSE,
            sharing: { exclusionGroups: [MATH_APPLIED] },
            rule: { kind: 'course', code },
          }),
        ),
      ],
    },
  }),

  req({
    id: 'math.applied.additional_lower',
    title: 'Additional lower-division courses — choose three',
    description:
      'Three individual selections from BIO SCI 93/94/97, CHEM 1A/1B/1C, MATH 10, PHYSICS 7C/7D/7E, or STATS 7. This is not a three-course sequence requirement.',
    precedence: PRECEDENCE.LONG_LIST,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    rule: { kind: 'choose_n_courses', n: 3, options: APPLIED_ADDITIONAL_LOWER_OPTIONS },
  }),

  req({
    id: 'math.applied.sequence',
    title: 'Applied sequence — MATH 112A, 112B, 115',
    precedence: PRECEDENCE.NAMED_COURSE,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    rule: {
      kind: 'all_of',
      children: APPLIED_SEQUENCE.map((code) =>
        req({
          id: `math.applied.sequence.${code.replace(/\W+/g, '_').toLowerCase()}`,
          title: code,
          precedence: PRECEDENCE.NAMED_COURSE,
          sharing: { exclusionGroups: [MATH_APPLIED] },
          rule: { kind: 'course', code },
        }),
      ),
    },
  }),

  req({
    id: 'math.applied.math_electives',
    title: 'Mathematics electives — choose three',
    description:
      'Three selections from the official list. MATH 107 must be taken with MATH 107L and counts as one selection.',
    precedence: PRECEDENCE.LONG_LIST,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    rule: {
      kind: 'choose_n',
      n: 3,
      children: [
        req({
          id: 'math.applied.math_electives.math_107_pair',
          title: 'MATH 107 + MATH 107L',
          precedence: PRECEDENCE.PAIRED_COURSE,
          sharing: { exclusionGroups: [MATH_APPLIED] },
          rule: { kind: 'course_pair', codes: APPLIED_MATH_ELECTIVE_PAIR },
        }),
        ...APPLIED_MATH_ELECTIVE_SINGLES.map((code) =>
          req({
            id: `math.applied.math_electives.${code.replace(/\W+/g, '_').toLowerCase()}`,
            title: code,
            precedence: PRECEDENCE.LONG_LIST,
            sharing: { exclusionGroups: [MATH_APPLIED] },
            rule: { kind: 'course', code },
          }),
        ),
      ],
    },
  }),

  req({
    id: 'math.applied.outside_electives',
    title: 'Outside-Mathematics upper-division electives — choose two',
    description:
      'Two four-unit upper-division courses from the official list. Any other course requires advance approval from the Applied Mathematics adviser, recorded as a substitution override.',
    precedence: PRECEDENCE.LONG_LIST,
    sharing: { exclusionGroups: [MATH_APPLIED] },
    allowSubstitution: true,
    verificationNote:
      'An unlisted outside course counts only with a recorded adviser-approved substitution.',
    rule: { kind: 'choose_n_courses', n: 2, options: APPLIED_OUTSIDE_OPTIONS },
  }),
];

export const APPLIED_MATHEMATICS_BS: RequirementProgram = {
  id: 'applied_computational_mathematics_bs',
  title: 'Applied and Computational Mathematics, B.S.',
  category: 'math',
  catalogueYear: YEAR,
  sourceUrl: SOURCE_URL,
  requirements,
};

export const APPLIED_MATH_GPA_REQUIREMENTS: Requirement[] = [
  req({
    id: 'math.applied.gpa.major',
    title: 'Applied Mathematics major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: { kind: 'gpa', minimum: 2.0, filter: { departments: ['MATH'] } },
  }),
  req({
    id: 'math.applied.gpa.upper_division_major',
    title: 'Applied Mathematics upper-division major GPA at least 2.0',
    precedence: PRECEDENCE.AGGREGATE,
    sharing: { exclusionGroups: [] },
    rule: { kind: 'gpa', minimum: 2.0, filter: { departments: ['MATH'], levels: ['upper'] } },
  }),
];
