import type { GeCategory } from '../courses/types';

/**
 * UCI Advanced Placement credit table — 2026-27.
 *
 * Transcribed from `07_AP_CREDIT_MAPPING_2026_27.md`, which is the reviewed
 * human-readable seed reference for
 * https://catalogue.uci.edu/informationforprospectivestudents/undergraduateadmissions/#advancedplacementandinternationalbaccalaureatecredittext
 *
 * Every score band models its effects *separately* — units, exact course
 * equivalence, alternate sequences, GE effects, university-requirement effects,
 * prerequisite clearance, elective-only status, cross-exam caps, and duplicate
 * relationships — because reducing the table to one `equivalentCourse` string
 * loses rules the audit depends on.
 *
 * Global rules (07 — Global rules):
 *   - AP, IB, and college work may duplicate; UCI awards credit only once.
 *   - A student cannot earn UCI units or grade points in a course from which AP
 *     credit already exempts them.
 *   - Exam credit carries no letter grade and never enters a GPA.
 */

const SOURCE_URL =
  'https://catalogue.uci.edu/informationforprospectivestudents/undergraduateadmissions/#advancedplacementandinternationalbaccalaureatecredittext';
const YEAR = '2026-27';

export interface GeEffect {
  category: GeCategory;
  /** Number of GE slots the award fills in that category. */
  count: number;
  note?: string;
}

export interface ExamAward {
  id: string;
  system: 'ap' | 'ib' | 'a_level' | 'other';
  /** Stable key, e.g. "calculus_bc". */
  examKey: string;
  examName: string;
  scoreMin: number;
  scoreMax: number;
  /** Total UCI units awarded for this score band. */
  units: number;
  /**
   * Official course-equivalence alternatives. Each inner array is one complete
   * option granted together; the student (or solver) picks one.
   * `[["MATH 2A","MATH 2B"], ["MATH 5A","MATH 5B"]]` = the MATH 2 or MATH 5 path.
   */
  equivalentCourseOptions: string[][];
  geEffects: GeEffect[];
  /** UC/UCI requirement keys cleared, e.g. "elwr". */
  universityRequirementEffects: string[];
  /** True when the award grants units but no course equivalence at all. */
  electiveOnly: boolean;
  /** Elective units granted *in addition to* a course equivalence. */
  additionalElectiveUnits?: number;
  /** UCI courses the student may no longer earn credit in. */
  duplicateWithCourseCodes: string[];
  /** Cross-exam unit cap group, e.g. "english", "physics". */
  capGroup?: string;
  /** Placement exam / petition caveat shown next to the award. */
  placementNote?: string;
  /** Program-specific restriction on using the equivalent course. */
  programUseLimitation?: string;
  sourceUrl: string;
  catalogueYear: string;
}

function award(
  partial: Omit<ExamAward, 'system' | 'sourceUrl' | 'catalogueYear' | 'id'> & Partial<ExamAward>,
): ExamAward {
  return {
    id: `${partial.examKey}_${partial.scoreMin}_${partial.scoreMax}`,
    system: 'ap',
    sourceUrl: SOURCE_URL,
    catalogueYear: YEAR,
    ...partial,
  } as ExamAward;
}

/** Convenience: an award whose equivalences also become duplicate-credit bars. */
function equivalences(options: string[][]): { equivalentCourseOptions: string[][]; duplicateWithCourseCodes: string[] } {
  return {
    equivalentCourseOptions: options,
    duplicateWithCourseCodes: Array.from(new Set(options.flat())),
  };
}

const ELECTIVE_ONLY = {
  equivalentCourseOptions: [] as string[][],
  duplicateWithCourseCodes: [] as string[],
  electiveOnly: true,
  geEffects: [] as GeEffect[],
  universityRequirementEffects: [] as string[],
};

// ---------------------------------------------------------------------------
// STEM and computing
// ---------------------------------------------------------------------------

const stem: ExamAward[] = [
  award({
    examKey: 'biology',
    examName: 'Biology',
    scoreMin: 3, scoreMax: 5, units: 8,
    ...equivalences([]),
    electiveOnly: false,
    geEffects: [{ category: 'II', count: 1, note: 'One Biological Sciences course toward GE II for a non-Biological Sciences major.' }],
    universityRequirementEffects: [],
    programUseLimitation: 'Biological Sciences majors receive elective credit only.',
  }),
  award({
    examKey: 'chemistry',
    examName: 'Chemistry',
    scoreMin: 3, scoreMax: 3, units: 8,
    ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'chemistry',
    examName: 'Chemistry',
    scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([['CHEM 1A'], ['ENGR 1A']]),
    electiveOnly: false,
    additionalElectiveUnits: 4,
    geEffects: [],
    universityRequirementEffects: [],
  }),
  award({
    // AP Computer Science A is elective credit only. It does NOT clear the
    // I&C SCI 31/32/33 programming series (criterion 60).
    examKey: 'computer_science_a',
    examName: 'Computer Science A',
    scoreMin: 3, scoreMax: 5, units: 8,
    ...ELECTIVE_ONLY,
    programUseLimitation:
      'Elective units only. Does not clear I&C SCI 31, 32, or 33, and does not satisfy the CS major programming series.',
  }),
  award({
    // Maps to I&C SCI 20, which is not part of the CS major programming series
    // (criterion 61).
    examKey: 'computer_science_principles',
    examName: 'Computer Science Principles',
    scoreMin: 3, scoreMax: 5, units: 8,
    ...equivalences([['I&C SCI 20']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
    programUseLimitation:
      'I&C SCI 20 is not part of the Computer Science major programming series (I&C SCI 31/32/33).',
  }),
  award({
    examKey: 'environmental_science',
    examName: 'Environmental Science',
    scoreMin: 3, scoreMax: 3, units: 4,
    ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'environmental_science',
    examName: 'Environmental Science',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['EARTHSS 1']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
  }),
  award({
    examKey: 'calculus_ab',
    examName: 'Calculus AB',
    scoreMin: 3, scoreMax: 5, units: 4,
    ...equivalences([['MATH 2A'], ['MATH 5A']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
  }),
  award({
    examKey: 'calculus_bc',
    examName: 'Calculus BC',
    scoreMin: 3, scoreMax: 3, units: 8,
    ...equivalences([['MATH 2A'], ['MATH 5A']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
    programUseLimitation:
      'Eight units are awarded but only the first course of the calculus sequence is exempted. The student may take the next course for credit.',
  }),
  award({
    // Criterion 59: BC 4-5 clears MATH 2A and MATH 2B.
    examKey: 'calculus_bc',
    examName: 'Calculus BC',
    scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([['MATH 2A', 'MATH 2B'], ['MATH 5A', 'MATH 5B']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
  }),
  award({
    // "A Calculus BC score below 3 can still produce the Calculus AB award when
    // the AB subscore is 3 or higher." Entered as its own exam record.
    examKey: 'calculus_bc_ab_subscore',
    examName: 'Calculus BC — AB subscore',
    scoreMin: 3, scoreMax: 5, units: 4,
    ...equivalences([['MATH 2A'], ['MATH 5A']]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
    capGroup: 'calculus',
    programUseLimitation:
      'Applies when the overall Calculus BC score is below 3 but the AB subscore is 3 or higher.',
  }),
  award({
    examKey: 'precalculus',
    examName: 'Precalculus',
    scoreMin: 3, scoreMax: 3, units: 0,
    ...ELECTIVE_ONLY,
    programUseLimitation: 'No university credit.',
  }),
  award({
    examKey: 'precalculus',
    examName: 'Precalculus',
    scoreMin: 4, scoreMax: 5, units: 0,
    ...ELECTIVE_ONLY,
    programUseLimitation: 'Approved as an Area G college-preparatory elective. No university credit.',
  }),
  // AP Physics never maps to the PHYSICS 7 sequence used by STEM majors.
  award({
    examKey: 'physics_1',
    examName: 'Physics 1',
    scoreMin: 3, scoreMax: 5, units: 8,
    ...ELECTIVE_ONLY,
    capGroup: 'physics',
    programUseLimitation: 'Does not award PHYSICS 7C, 7D, or 7E.',
  }),
  award({
    examKey: 'physics_2',
    examName: 'Physics 2',
    scoreMin: 3, scoreMax: 5, units: 8,
    ...ELECTIVE_ONLY,
    capGroup: 'physics',
    programUseLimitation: 'Does not award PHYSICS 7C, 7D, or 7E.',
  }),
  award({
    examKey: 'physics_c_mechanics',
    examName: 'Physics C: Mechanics',
    scoreMin: 3, scoreMax: 3, units: 4,
    ...ELECTIVE_ONLY,
    capGroup: 'physics',
  }),
  award({
    examKey: 'physics_c_mechanics',
    examName: 'Physics C: Mechanics',
    scoreMin: 4, scoreMax: 4, units: 4,
    ...equivalences([['PHYSICS 2']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'physics',
  }),
  award({
    examKey: 'physics_c_mechanics',
    examName: 'Physics C: Mechanics',
    scoreMin: 5, scoreMax: 5, units: 4,
    ...equivalences([['PHYSICS 3A']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'physics',
    programUseLimitation: 'Does not award PHYSICS 7C, 7D, or 7E.',
  }),
  award({
    examKey: 'physics_c_electricity_magnetism',
    examName: 'Physics C: Electricity and Magnetism',
    scoreMin: 3, scoreMax: 3, units: 4,
    ...ELECTIVE_ONLY,
    capGroup: 'physics',
  }),
  award({
    examKey: 'physics_c_electricity_magnetism',
    examName: 'Physics C: Electricity and Magnetism',
    scoreMin: 4, scoreMax: 4, units: 4,
    ...equivalences([['PHYSICS 2']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'physics',
  }),
  award({
    examKey: 'physics_c_electricity_magnetism',
    examName: 'Physics C: Electricity and Magnetism',
    scoreMin: 5, scoreMax: 5, units: 4,
    ...equivalences([['PHYSICS 3C']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'physics',
    programUseLimitation: 'Does not award PHYSICS 7C, 7D, or 7E.',
  }),
  award({
    // Criterion 62: may satisfy STATS 7, never STATS 67.
    examKey: 'statistics',
    examName: 'Statistics',
    scoreMin: 3, scoreMax: 5, units: 4,
    ...equivalences([['STATS 7'], ['STATS 8'], ['SOCECOL 13'], ['EDUC 15']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'statistics',
    programUseLimitation:
      'Does not satisfy STATS 67, which the Computer Science major requires.',
  }),
  award({
    examKey: 'statistics_mgmt7',
    examName: 'Statistics — MGMT 7 equivalence',
    scoreMin: 4, scoreMax: 5, units: 0,
    ...equivalences([['MGMT 7']]),
    electiveOnly: false,
    geEffects: [], universityRequirementEffects: [],
    capGroup: 'statistics',
    programUseLimitation:
      'MGMT 7 is an additional allowed equivalence for Statistics 4-5. It does not add another four units.',
  }),
];

// ---------------------------------------------------------------------------
// Writing, history, government, social science
// ---------------------------------------------------------------------------

const humanities: ExamAward[] = [
  award({
    examKey: 'african_american_studies',
    examName: 'African American Studies',
    scoreMin: 3, scoreMax: 5, units: 4,
    ...equivalences([]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: [],
    programUseLimitation: 'Counts as one year of U.S. History for the Area A requirement.',
  }),
  award({
    examKey: 'macroeconomics', examName: 'Macroeconomics',
    scoreMin: 3, scoreMax: 3, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'macroeconomics', examName: 'Macroeconomics',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['ECON 20B'], ['MGMT 4B']]),
    electiveOnly: false, geEffects: [], universityRequirementEffects: [],
    programUseLimitation: 'Program-use limitations apply.',
  }),
  award({
    examKey: 'microeconomics', examName: 'Microeconomics',
    scoreMin: 3, scoreMax: 3, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'microeconomics', examName: 'Microeconomics',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['ECON 20A'], ['MGMT 4A']]),
    electiveOnly: false, geEffects: [], universityRequirementEffects: [],
    programUseLimitation: 'Program-use limitations apply.',
  }),
  award({
    examKey: 'english_language', examName: 'English Language and Composition',
    scoreMin: 3, scoreMax: 3, units: 8,
    ...ELECTIVE_ONLY,
    universityRequirementEffects: ['elwr'],
    capGroup: 'english',
  }),
  award({
    examKey: 'english_language', examName: 'English Language and Composition',
    scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([['WRITING 50']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1, note: 'One English course toward GE IV.' }],
    universityRequirementEffects: ['elwr'],
    capGroup: 'english',
    programUseLimitation:
      'Take WRITING 60 to finish GE Ia Lower-Division Writing. WRITING 30 or 31 may not be used instead.',
  }),
  award({
    examKey: 'english_literature', examName: 'English Literature and Composition',
    scoreMin: 3, scoreMax: 3, units: 8,
    ...ELECTIVE_ONLY,
    universityRequirementEffects: ['elwr'],
    capGroup: 'english',
  }),
  award({
    examKey: 'english_literature', examName: 'English Literature and Composition',
    scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([['WRITING 50']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1, note: 'One English course toward GE IV.' }],
    universityRequirementEffects: ['elwr'],
    capGroup: 'english',
    programUseLimitation:
      'Take WRITING 60 to finish GE Ia Lower-Division Writing. WRITING 30 or 31 may not be used instead.',
  }),
  award({
    examKey: 'human_geography', examName: 'Human Geography',
    scoreMin: 3, scoreMax: 5, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'us_government', examName: 'U.S. Government and Politics',
    scoreMin: 3, scoreMax: 3, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'us_government', examName: 'U.S. Government and Politics',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['POL SCI 21A']]),
    electiveOnly: false, geEffects: [],
    universityRequirementEffects: ['american_history_institutions'],
    programUseLimitation: 'Program-use limitations apply.',
  }),
  award({
    examKey: 'comparative_government', examName: 'Comparative Government and Politics',
    scoreMin: 3, scoreMax: 3, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'comparative_government', examName: 'Comparative Government and Politics',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['POL SCI 51A']]),
    electiveOnly: false, geEffects: [], universityRequirementEffects: [],
    programUseLimitation: 'Program-use limitations apply.',
  }),
  award({
    examKey: 'european_history', examName: 'European History',
    scoreMin: 3, scoreMax: 4, units: 8, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'european_history', examName: 'European History',
    scoreMin: 5, scoreMax: 5, units: 8,
    ...equivalences([]),
    electiveOnly: false,
    geEffects: [
      { category: 'IV', count: 1, note: 'One eligible lower-division History course toward GE IV.' },
      { category: 'VIII', count: 1 },
    ],
    universityRequirementEffects: [],
    additionalElectiveUnits: 4,
    programUseLimitation: 'Humanities restrictions apply.',
  }),
  award({
    examKey: 'us_history', examName: 'U.S. History',
    scoreMin: 3, scoreMax: 4, units: 8,
    ...equivalences([]),
    electiveOnly: false,
    geEffects: [],
    universityRequirementEffects: ['american_history_institutions'],
  }),
  award({
    examKey: 'us_history', examName: 'U.S. History',
    scoreMin: 5, scoreMax: 5, units: 8,
    ...equivalences([['HISTORY 40A'], ['HISTORY 40B'], ['HISTORY 40C']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1 }],
    universityRequirementEffects: ['american_history_institutions'],
    additionalElectiveUnits: 4,
  }),
  award({
    examKey: 'world_history', examName: 'World History: Modern',
    scoreMin: 3, scoreMax: 4, units: 8, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'world_history', examName: 'World History: Modern',
    scoreMin: 5, scoreMax: 5, units: 8,
    ...equivalences([['HISTORY 21B'], ['HISTORY 21C']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1 }, { category: 'VIII', count: 1 }],
    universityRequirementEffects: [],
    additionalElectiveUnits: 4,
    programUseLimitation: 'Humanities restrictions apply.',
  }),
  award({
    examKey: 'psychology', examName: 'Psychology',
    scoreMin: 3, scoreMax: 3, units: 4, ...ELECTIVE_ONLY,
  }),
  award({
    examKey: 'psychology', examName: 'Psychology',
    scoreMin: 4, scoreMax: 5, units: 4,
    ...equivalences([['PSY 9'], ['COGS 7A']]),
    electiveOnly: false, geEffects: [], universityRequirementEffects: [],
  }),
  award({
    examKey: 'research', examName: 'Research',
    scoreMin: 3, scoreMax: 5, units: 0,
    ...ELECTIVE_ONLY,
    universityRequirementEffects: ['elwr'],
    programUseLimitation: 'Satisfies ELWR and awards no university units.',
  }),
  award({
    examKey: 'seminar', examName: 'Seminar',
    scoreMin: 3, scoreMax: 5, units: 0,
    ...ELECTIVE_ONLY,
    universityRequirementEffects: ['elwr'],
    programUseLimitation: 'Satisfies ELWR and awards no university units.',
  }),
];

// ---------------------------------------------------------------------------
// Art and music
// ---------------------------------------------------------------------------

const arts: ExamAward[] = [
  award({
    examKey: 'art_history', examName: 'Art History',
    scoreMin: 3, scoreMax: 3, units: 8,
    ...equivalences([['ART HIS 40A']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1 }, { category: 'VIII', count: 1 }],
    universityRequirementEffects: [],
    additionalElectiveUnits: 4,
    programUseLimitation: 'Humanities and Archaeology restrictions apply.',
  }),
  award({
    examKey: 'art_history', examName: 'Art History',
    scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([['ART HIS 40A', 'ART HIS 40B']]),
    electiveOnly: false,
    geEffects: [{ category: 'IV', count: 1 }, { category: 'VIII', count: 1 }],
    universityRequirementEffects: [],
    programUseLimitation: 'Humanities and Archaeology restrictions apply.',
  }),
  award({ examKey: 'drawing', examName: 'Drawing', scoreMin: 3, scoreMax: 5, units: 8, ...ELECTIVE_ONLY, capGroup: 'art_design' }),
  award({ examKey: 'art_2d', examName: '2-D Art and Design', scoreMin: 3, scoreMax: 5, units: 8, ...ELECTIVE_ONLY, capGroup: 'art_design' }),
  award({ examKey: 'art_3d', examName: '3-D Art and Design', scoreMin: 3, scoreMax: 5, units: 8, ...ELECTIVE_ONLY, capGroup: 'art_design' }),
  award({ examKey: 'music_theory', examName: 'Music Theory', scoreMin: 3, scoreMax: 5, units: 8, ...ELECTIVE_ONLY }),
];

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

function language(
  examKey: string,
  examName: string,
  low: { courses: string[]; ge: GeCategory[] },
  high: { courses: string[]; ge: GeCategory[] },
  placementNote?: string,
): ExamAward[] {
  return [
    award({
      examKey, examName, scoreMin: 3, scoreMax: 3, units: 8,
      ...equivalences(low.courses.length ? [low.courses] : []),
      electiveOnly: low.courses.length === 0 && low.ge.length === 0,
      geEffects: low.ge.map((category) => ({ category, count: 1 })),
      universityRequirementEffects: [],
      ...(placementNote ? { placementNote } : {}),
    }),
    award({
      examKey, examName, scoreMin: 4, scoreMax: 5, units: 8,
      ...equivalences(high.courses.length ? [high.courses] : []),
      electiveOnly: high.courses.length === 0 && high.ge.length === 0,
      geEffects: high.ge.map((category) => ({ category, count: 1 })),
      universityRequirementEffects: [],
      ...(placementNote ? { placementNote } : {}),
    }),
  ];
}

const languages: ExamAward[] = [
  ...language(
    'chinese', 'Chinese Language and Culture',
    { courses: [], ge: [] },
    { courses: ['CHINESE 1A', 'CHINESE 1B', 'CHINESE 1C', 'CHINESE 2A'], ge: ['VI', 'VIII'] },
    'A placement exam or interview may still be required; additional credit is possible after placement.',
  ),
  ...language('french', 'French Language and Culture',
    { courses: ['FRENCH 1A', 'FRENCH 1B', 'FRENCH 1C'], ge: ['VI'] },
    { courses: ['FRENCH 2A', 'FRENCH 2B', 'FRENCH 2C'], ge: ['VI', 'VIII'] }),
  ...language('german', 'German Language and Culture',
    { courses: ['GERMAN 1A', 'GERMAN 1B', 'GERMAN 1C'], ge: ['VI'] },
    { courses: ['GERMAN 2A', 'GERMAN 2B', 'GERMAN 2C'], ge: ['VI', 'VIII'] }),
  ...language('italian', 'Italian Language and Culture',
    { courses: ['ITALIAN 1A', 'ITALIAN 1B', 'ITALIAN 1C'], ge: ['VI'] },
    { courses: ['ITALIAN 2A', 'ITALIAN 2B', 'ITALIAN 2C'], ge: ['VI', 'VIII'] }),
  ...language('japanese', 'Japanese Language and Culture',
    { courses: ['JAPANSE 1A', 'JAPANSE 1B', 'JAPANSE 1C'], ge: ['VI'] },
    { courses: ['JAPANSE 2A', 'JAPANSE 2B', 'JAPANSE 2C'], ge: ['VI', 'VIII'] },
    'A placement exam or interview may still be required.'),
  award({ examKey: 'latin', examName: 'Latin', scoreMin: 3, scoreMax: 3, units: 8, ...ELECTIVE_ONLY }),
  award({
    examKey: 'latin', examName: 'Latin', scoreMin: 4, scoreMax: 5, units: 8,
    ...equivalences([]),
    electiveOnly: false,
    geEffects: [{ category: 'VI', count: 1 }, { category: 'VIII', count: 1 }],
    universityRequirementEffects: [],
    placementNote: 'Classics major or Humanities language credit may be awarded by petition.',
  }),
  ...language('spanish_language', 'Spanish Language and Culture',
    { courses: ['SPANISH 1A', 'SPANISH 1B', 'SPANISH 1C'], ge: ['VI'] },
    { courses: ['SPANISH 2A', 'SPANISH 2B', 'SPANISH 2C'], ge: ['VI', 'VIII'] },
    'Placement may authorize SPANISH 3 or 3H.'),
  ...language('spanish_literature', 'Spanish Literature and Culture',
    { courses: ['SPANISH 1A', 'SPANISH 1B', 'SPANISH 1C'], ge: ['VI'] },
    { courses: ['SPANISH 3'], ge: ['VI', 'VII', 'VIII'] },
    'SPANISH 3H may be authorized instead of SPANISH 3 after placement.'),
];

export const AP_AWARDS: ExamAward[] = [...stem, ...humanities, ...arts, ...languages];

/**
 * Cross-exam unit caps (07 — Cross-exam caps and implementation notes).
 * When a student holds several exams in a cap group, total awarded units are
 * clamped to `maxUnits`.
 */
export interface UnitCap {
  group: string;
  label: string;
  maxUnits: number;
}

export const AP_UNIT_CAPS: UnitCap[] = [
  { group: 'english', label: 'AP English exams (Language and Literature)', maxUnits: 8 },
  { group: 'art_design', label: 'AP Art and Design family', maxUnits: 8 },
  { group: 'physics', label: 'AP Physics family', maxUnits: 8 },
  { group: 'statistics', label: 'AP Statistics equivalence rows', maxUnits: 4 },
  { group: 'calculus', label: 'AP Calculus exams', maxUnits: 8 },
];

/**
 * Effects that only apply when a *combination* of exams is held.
 * Criterion: both English exams at 4-5 award WRITING 50 plus **two** English
 * courses toward GE IV, while total units stay capped at eight.
 */
export interface CombinationRule {
  id: string;
  description: string;
  /** Every exam key must be present at a score within its band. */
  requires: Array<{ examKey: string; minScore: number }>;
  extraGeEffects: GeEffect[];
  sourceUrl: string;
}

export const AP_COMBINATION_RULES: CombinationRule[] = [
  {
    id: 'both_english_ge_iv',
    description:
      'Both AP English exams at 4-5 award WRITING 50 plus two English courses toward GE IV, with a combined maximum of eight units.',
    requires: [
      { examKey: 'english_language', minScore: 4 },
      { examKey: 'english_literature', minScore: 4 },
    ],
    extraGeEffects: [{ category: 'IV', count: 1, note: 'Second English course toward GE IV.' }],
    sourceUrl: SOURCE_URL,
  },
];

/** All distinct exams, for the onboarding picker. */
export function listApExams(): Array<{ examKey: string; examName: string; scores: string[] }> {
  const byKey = new Map<string, { examKey: string; examName: string; scores: Set<string> }>();
  for (const a of AP_AWARDS) {
    const entry = byKey.get(a.examKey) ?? { examKey: a.examKey, examName: a.examName, scores: new Set<string>() };
    for (let s = a.scoreMin; s <= a.scoreMax; s += 1) entry.scores.add(String(s));
    byKey.set(a.examKey, entry);
  }
  return Array.from(byKey.values())
    .map((e) => ({ examKey: e.examKey, examName: e.examName, scores: Array.from(e.scores).sort() }))
    .sort((a, b) => a.examName.localeCompare(b.examName));
}

/** Find the award row for an exam and score, or undefined when none applies. */
export function findAward(examKey: string, score: number): ExamAward | undefined {
  return AP_AWARDS.find((a) => a.examKey === examKey && score >= a.scoreMin && score <= a.scoreMax);
}
