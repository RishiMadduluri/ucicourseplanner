import type { CourseOfferingRecord, OfferingEvidence, OfferingSnapshot } from '../domain/offerings/types';
import { normalizeCourseCode } from '../domain/courses/codes';
import { CATALOGUE_DATA_SCHEMA_VERSION } from '../domain/schemaVersions';

/**
 * Department teaching-plan evidence for 2026-27, transcribed from
 * 03_DATA_SOURCES_AND_PREDICTIONS.md.
 *
 * Both source plans are explicitly *tentative*: the Mathematics page was marked
 * updated May 14, 2026 and says so directly, and the ICS plan is labelled
 * tentative. This data is therefore stored as `department_plan` evidence and is
 * never presented as "Published" or "scheduled".
 *
 * A blank cell means "not present in this tentative plan", not "impossible"
 * (acceptance criterion 46), so an absent season produces no negative record.
 */

const ICS_SOURCE = 'https://courselisting.ics.uci.edu/ugrad_courses/';
const MATH_SOURCE = 'https://www.math.uci.edu/undergrad-courses/plan-math-course-offerings';
const ACADEMIC_YEAR = '2026-27';
const RETRIEVED_AT = '2026-07-24T00:00:00.000Z';

type SeasonFlags = { fall?: boolean; winter?: boolean; spring?: boolean; summer?: boolean };

function plan(
  code: string,
  seasons: SeasonFlags,
  sourceUrl: string,
  sourceLabel: string,
  note?: string,
): CourseOfferingRecord {
  const evidence: OfferingEvidence[] = [];
  for (const [season, offered] of Object.entries(seasons) as Array<[keyof SeasonFlags, boolean]>) {
    const entry: OfferingEvidence = {
      type: 'department_plan',
      academicYear: ACADEMIC_YEAR,
      season: season as OfferingEvidence['season'],
      offered,
      sourceUrl,
      sourceLabel,
      retrievedAt: RETRIEVED_AT,
    };
    if (note) entry.note = note;
    evidence.push(entry);
  }
  const record: CourseOfferingRecord = { normalizedCode: normalizeCourseCode(code), evidence };
  if (note) record.cadenceNote = note;
  return record;
}

/** Explicit cadence statements override the statistical baseline. */
function cadence(
  code: string,
  seasons: SeasonFlags,
  note: string,
  sourceUrl: string,
  sourceLabel: string,
): CourseOfferingRecord {
  const evidence: OfferingEvidence[] = [];
  for (const [season, offered] of Object.entries(seasons) as Array<[keyof SeasonFlags, boolean]>) {
    evidence.push({
      type: 'cadence_note',
      academicYear: ACADEMIC_YEAR,
      season: season as OfferingEvidence['season'],
      offered,
      sourceUrl,
      sourceLabel,
      retrievedAt: RETRIEVED_AT,
      note,
    });
  }
  return { normalizedCode: normalizeCourseCode(code), evidence, cadenceNote: note };
}

const icsPlan = (code: string, seasons: SeasonFlags) =>
  plan(code, seasons, ICS_SOURCE, 'ICS tentative course offerings');

const mathPlan = (code: string, seasons: SeasonFlags) =>
  plan(code, seasons, MATH_SOURCE, 'Mathematics tentative course offerings');

/**
 * ICS 2026-27 tentative plan (Fall 2026, Winter 2027, Spring 2027, Summer 2027).
 */
const ICS_RECORDS: CourseOfferingRecord[] = [
  icsPlan('I&C SCI 31', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 32', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 33', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 45C', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 46', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 51', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 53', { fall: true, winter: true }),
  icsPlan('I&C SCI 6B', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 6D', { fall: true, winter: true, spring: true }),
  icsPlan('I&C SCI 6N', { winter: true }),
  icsPlan('I&C SCI 139W', { fall: true, winter: true, spring: true }),
  icsPlan('STATS 67', { fall: true, winter: true, spring: true }),
  icsPlan('SWE 43', { fall: true, winter: true, spring: true }),
  icsPlan('COMPSCI 161', { fall: true, winter: true, spring: true }),
];

/**
 * Mathematics 2026-27 tentative plan. The published table is explicitly
 * tentative and was last updated May 14, 2026.
 */
const MATH_RECORDS: CourseOfferingRecord[] = [
  ...['MATH 2A', 'MATH 2B', 'MATH 2D', 'MATH 2E', 'MATH 3A', 'MATH 3D', 'MATH 9', 'MATH 13'].map((code) =>
    mathPlan(code, { fall: true, winter: true, spring: true }),
  ),
  ...['MATH 120A', 'MATH 120B', 'MATH 121A', 'MATH 121B', 'MATH 130A', 'MATH 140A', 'MATH 140B', 'MATH 147'].map(
    (code) => mathPlan(code, { fall: true, winter: true, spring: true }),
  ),
  mathPlan('MATH 105A', { fall: true }),
  mathPlan('MATH 105LA', { fall: true }),
  mathPlan('MATH 110A', { winter: true }),
  mathPlan('MATH 110B', { spring: true }),
  mathPlan('MATH 112A', { fall: true }),
  mathPlan('MATH 112B', { winter: true }),
  mathPlan('MATH 130B', { fall: true, winter: true, spring: true }),
  mathPlan('MATH 130C', { spring: true }),
  mathPlan('MATH 140C', { spring: true }),
  mathPlan('MATH 141', { spring: true }),
  mathPlan('MATH 150', { fall: true }),
  mathPlan('MATH 161', { spring: true }),
  mathPlan('MATH 162A', { winter: true }),
  mathPlan('MATH 178', { winter: true }),
  mathPlan('MATH 180A', { winter: true }),

  // Explicit cadence notes from the source table.
  cadence('MATH 112C', { spring: true }, 'Listed in the every-other-year Spring cadence.', MATH_SOURCE, 'Mathematics tentative course offerings'),
  cadence('MATH 120C', { spring: true }, 'Listed on an S25 / S27 every-other-year cadence, so Spring 2027 is expected.', MATH_SOURCE, 'Mathematics tentative course offerings'),
  cadence('MATH 162B', { spring: true }, 'Tentative Spring 2027 in the published plan.', MATH_SOURCE, 'Mathematics tentative course offerings'),
  cadence('MATH 180B', { spring: true }, 'Listed on an S25 / S27 every-other-year cadence, so Spring 2027 is expected.', MATH_SOURCE, 'Mathematics tentative course offerings'),

  // Summer-only courses: a strong season rule, with session evidence preserved.
  ...['MATH 173A', 'MATH 173B', 'MATH 175'].map((code) =>
    cadence(
      code,
      { fall: false, winter: false, spring: false, summer: true },
      'Listed as Summer only in the department plan.',
      MATH_SOURCE,
      'Mathematics tentative course offerings',
    ),
  ),

  cadence(
    'MATH 195W',
    { fall: false, winter: false, spring: false },
    'Not offered in 2026-27; expected to return in 2027-28.',
    MATH_SOURCE,
    'Mathematics tentative course offerings',
  ),
];

export const OFFERINGS_2026_27: OfferingSnapshot = {
  schemaVersion: CATALOGUE_DATA_SCHEMA_VERSION,
  buildId: 'offerings-2026-27-seed',
  retrievedAt: RETRIEVED_AT,
  records: [...ICS_RECORDS, ...MATH_RECORDS],
};

export const OFFERING_INDEX: Map<string, CourseOfferingRecord> = new Map(
  OFFERINGS_2026_27.records.map((r) => [r.normalizedCode, r]),
);
