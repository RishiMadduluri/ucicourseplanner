import type { Requirement, RequirementProgram } from '../types';
import { DEFAULT_GRADE_POLICY, PRECEDENCE } from '../types';

/**
 * University of California and UCI-wide degree requirements — 2026-27.
 * Source: https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/
 *
 * ELWR and American History & Institutions are modelled as *evidence* the user
 * supplies, not as something inferred from planned UCI coursework, because both
 * are commonly satisfied before entrance.
 *
 * Residence and modality intentionally resolve to `unknown` while future course
 * origin and modality are unpublished — the audit must never show a green check
 * based on an assumption (acceptance criterion 26).
 */

const UC_SOURCE =
  'https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#universityrequirementstext';
const UCI_SOURCE =
  'https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#ucirequirementstext';
const YEAR = '2026-27';

function req(
  partial: Omit<Requirement, 'catalogueYear' | 'grade' | 'allowSubstitution'> & Partial<Requirement>,
): Requirement {
  return {
    catalogueYear: YEAR,
    grade: DEFAULT_GRADE_POLICY,
    allowSubstitution: false,
    ...partial,
  } as Requirement;
}

export const UC_REQUIREMENTS: RequirementProgram = {
  id: 'uc_requirements',
  title: 'University of California Requirements',
  category: 'uc',
  catalogueYear: YEAR,
  sourceUrl: UC_SOURCE,
  requirements: [
    req({
      id: 'uc.elwr',
      title: 'Entry Level Writing Requirement (ELWR)',
      description:
        'Satisfied before entrance by qualifying AP/IB/SAT/ACT results or a transferable English composition course, or at UCI. A student who enters without ELWR must satisfy it before the beginning of the fourth UCI quarter.',
      sourceUrl: UC_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'external_evidence', key: 'elwr' },
    }),
    req({
      id: 'uc.american_history_institutions',
      title: 'American History and Institutions',
      description:
        'Commonly satisfied by qualifying high-school coursework, AP/IB/SAT evidence, or approved college coursework. UCI options include HISTORY 40A/40B/40C for U.S. History and AP U.S. Government or POL SCI 21A for U.S. Government.',
      sourceUrl: UC_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'external_evidence', key: 'american_history_institutions' },
    }),
  ],
};

export const UCI_REQUIREMENTS: RequirementProgram = {
  id: 'uci_requirements',
  title: 'UCI Degree Requirements',
  category: 'uci',
  catalogueYear: YEAR,
  sourceUrl: UCI_SOURCE,
  requirements: [
    req({
      id: 'uci.units.180',
      title: 'Minimum 180 quarter units',
      sourceUrl: UCI_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'min_units', units: 180 },
    }),
    req({
      id: 'uci.gpa.overall',
      title: 'Overall GPA at least 2.0',
      sourceUrl: UCI_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'gpa', minimum: 2.0, filter: {} },
    }),
    req({
      id: 'uci.residence.final45',
      title: 'Residence — 36 of the final 45 units at UCI',
      description:
        'At least 36 of the final 45 units must be earned in residence at UCI, subject to the exceptions listed in the Catalogue.',
      sourceUrl: UCI_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      verificationNote:
        'Evaluated only when the origin of the final 45 units is known. Otherwise reported as needing verification.',
      rule: { kind: 'residence', rule: 'final_45_in_residence' },
    }),
    req({
      id: 'uci.modality.fifty_percent',
      title: 'Modality — at least 50% of UCI units not online or mixed modality',
      description:
        'At least 50 percent of total UCI units before graduation must come from courses not designated online or mixed modality, unless the degree program has an exception.',
      sourceUrl: UCI_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      verificationNote:
        'Future term modality is not published, so this rule stays "needs verification" rather than showing a checkmark.',
      rule: { kind: 'residence', rule: 'modality_fifty_percent' },
    }),
    req({
      id: 'uci.declaration.junior_status',
      title: 'Declare a major by junior status',
      description:
        'Junior status is 90 units, excluding college work completed before high-school graduation.',
      sourceUrl: UCI_SOURCE,
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'advisor_confirmation', key: 'major_declared_by_junior_status' },
    }),
  ],
};

/**
 * Add/double-major eligibility. These are checklists, never guarantees —
 * acceptance criterion 42 requires the app to say so explicitly.
 */
export const ADD_MAJOR_ELIGIBILITY: RequirementProgram = {
  id: 'add_major_eligibility',
  title: 'Add / Double-Major Eligibility',
  category: 'eligibility',
  catalogueYear: YEAR,
  sourceUrl: 'https://changeofmajor.uci.edu/',
  requirements: [
    req({
      id: 'eligibility.ics.gpa_overall',
      title: 'ICS — minimum 3.0 overall UC GPA',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'gpa', minimum: 3.0, filter: {} },
    }),
    req({
      id: 'eligibility.ics.gpa_cs_required',
      title: 'ICS — minimum 3.0 GPA across CS-major-required courses',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: {
        kind: 'gpa',
        minimum: 3.0,
        filter: { departments: ['COMPSCI', 'I&C SCI', 'SWE', 'IN4MATX', 'STATS', 'MATH'] },
      },
    }),
    req({
      id: 'eligibility.ics.screening_courses',
      title: 'ICS — 3.3 average with no grade below C across I&C SCI 33 plus three screening courses',
      description:
        'I&C SCI 33 and three of MATH 2B, I&C SCI 6B, I&C SCI 6D, I&C SCI 6N or MATH 3A, and STATS 67. AP credit is not a grade for change/add-major review, so AP credit in these areas requires additional graded coursework.',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      verificationNote:
        'Requires letter-graded UCI courses. Ungraded AP/IB awards do not count toward this average.',
      rule: { kind: 'advisor_confirmation', key: 'ics_screening_average' },
    }),
    req({
      id: 'eligibility.ics.application_window',
      title: 'ICS — apply within the first six full-time UCI quarters',
      description:
        'First-year entrants may apply through StudentAccess in their first six full-time quarters. Quarters seven through nine require an appeal. At most two repeats total and one repeat per course.',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'advisor_confirmation', key: 'ics_application_window' },
    }),
    req({
      id: 'eligibility.physci.gpa_lower_division_math',
      title: 'Physical Sciences — minimum 3.0 GPA across lower-division Mathematics courses counting toward the major',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-physical-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'gpa', minimum: 3.0, filter: { departments: ['MATH'], levels: ['lower'] } },
    }),
    req({
      id: 'eligibility.physci.two_uci_math_courses',
      title: 'Physical Sciences — at least two UCI Mathematics courses counting toward the major',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-physical-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'course_range', n: 2, filter: { departments: ['MATH'] } },
    }),
    req({
      id: 'eligibility.physci.double_major_advising',
      title: 'Physical Sciences — double-major adviser confirmation',
      description:
        'Physical Sciences states that students declaring a double major have additional requirements and must contact its academic advising office. Course completion alone does not grant approval.',
      sourceUrl: 'https://changeofmajor.uci.edu/school-of-physical-sciences/',
      precedence: PRECEDENCE.AGGREGATE,
      sharing: { exclusionGroups: [] },
      rule: { kind: 'advisor_confirmation', key: 'physci_double_major_review' },
    }),
  ],
};
