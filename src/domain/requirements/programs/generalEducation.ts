import type { Requirement, RequirementProgram } from '../types';
import { DEFAULT_GRADE_POLICY, PRECEDENCE } from '../types';

/**
 * UCI General Education, categories I-VIII — 2026-27.
 * Source: https://catalogue.uci.edu/.../requirementsforabachelorsdegree/#generaleducationrequirementtext
 *
 * Overlap rules encoded via sharing groups:
 *   - Va and Vb share the `ge_v_subcategory` group, so one course cannot fill
 *     both (acceptance criterion 22).
 *   - Every other category sits in its own group, so a Category V course may
 *     also satisfy another GE category and VII/VIII may overlap by design.
 *   - No GE leaf shares a group with a major requirement, so an approved course
 *     can fill GE and a major rule simultaneously (criterion 23).
 */

const SOURCE_URL =
  'https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#generaleducationrequirementtext';
const YEAR = '2026-27';

function req(
  partial: Omit<Requirement, 'catalogueYear' | 'sourceUrl' | 'grade' | 'allowSubstitution'> & Partial<Requirement>,
): Requirement {
  return {
    catalogueYear: YEAR,
    sourceUrl: SOURCE_URL,
    grade: DEFAULT_GRADE_POLICY,
    allowSubstitution: false,
    ...partial,
  } as Requirement;
}

export const GENERAL_EDUCATION: RequirementProgram = {
  id: 'general_education',
  title: 'General Education',
  category: 'ge',
  catalogueYear: YEAR,
  sourceUrl: SOURCE_URL,
  requirements: [
    req({
      id: 'ge.Ia',
      title: 'I. Writing — Lower-Division Writing (two courses)',
      description:
        'Two approved lower-division writing courses beyond ELWR, commonly WRITING 50 and WRITING 60. C- or better, or equivalent Pass/Credit. Must be completed before the seventh UCI quarter to avoid academic notice.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_Ia'] },
      grade: { minGrade: 'C-', allowPassNoPass: true, allowExternalCredit: true },
      verificationNote:
        'Students enrolled at UCI may use only UCI courses for lower- and upper-division writing. Another institution’s Summer course does not count.',
      rule: { kind: 'ge_category', category: 'Ia', n: 2 },
    }),
    req({
      id: 'ge.Ib',
      title: 'I. Writing — Upper-Division Writing (one course)',
      description:
        'One approved upper-division writing course carrying the `W` designation, taken after lower-division writing. C- or better. I&C SCI 139W satisfies this and the CS core.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_Ib'] },
      grade: { minGrade: 'C-', allowPassNoPass: false, allowExternalCredit: false },
      verificationNote:
        'An approved course offered without its required `W` suffix does not satisfy this requirement.',
      rule: { kind: 'ge_category', category: 'Ib', n: 1 },
    }),
    req({
      id: 'ge.II',
      title: 'II. Science and Technology (three courses)',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_II'] },
      rule: { kind: 'ge_category', category: 'II', n: 3 },
    }),
    req({
      id: 'ge.III',
      title: 'III. Social and Behavioral Sciences (three courses)',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_III'] },
      rule: { kind: 'ge_category', category: 'III', n: 3 },
    }),
    req({
      id: 'ge.IV',
      title: 'IV. Arts and Humanities (three courses)',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_IV'] },
      rule: { kind: 'ge_category', category: 'IV', n: 3 },
    }),
    req({
      id: 'ge.Va',
      title: 'V.A. Quantitative Reasoning (at least one course)',
      description:
        'Category V requires three courses total with at least one Va and at least one Vb. A course approved for both may be used for only one of them.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_v_subcategory'] },
      rule: { kind: 'ge_category', category: 'Va', n: 1 },
    }),
    req({
      id: 'ge.Vb',
      title: 'V.B. Symbolic and Computational Reasoning (at least one course)',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_v_subcategory'] },
      rule: { kind: 'ge_category', category: 'Vb', n: 1 },
    }),
    req({
      id: 'ge.V_third',
      title: 'V. Third Quantitative/Symbolic course (either Va or Vb)',
      description: 'The third Category V course may be either Va or Vb.',
      precedence: PRECEDENCE.GE_CATEGORY + 1,
      sharing: { exclusionGroups: ['ge_v_subcategory'] },
      rule: {
        kind: 'course_range',
        n: 1,
        filter: { geCategories: ['Va', 'Vb'] },
      },
    }),
    req({
      id: 'ge.VI',
      title: 'VI. Language Other Than English',
      description:
        'Demonstrated competency, commonly one course equivalent to the third quarter of university-level study, or approved external evidence such as an AP language award.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_VI'] },
      rule: { kind: 'ge_category', category: 'VI', n: 1 },
    }),
    req({
      id: 'ge.VII',
      title: 'VII. Multicultural Studies (one course)',
      description: 'Designed to overlap with another approved GE category.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_VII'] },
      rule: { kind: 'ge_category', category: 'VII', n: 1 },
    }),
    req({
      id: 'ge.VIII',
      title: 'VIII. International/Global Issues (one course)',
      description: 'Designed to overlap with another approved GE category.',
      precedence: PRECEDENCE.GE_CATEGORY,
      sharing: { exclusionGroups: ['ge_VIII'] },
      rule: { kind: 'ge_category', category: 'VIII', n: 1 },
    }),
  ],
};
