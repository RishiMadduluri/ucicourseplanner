import type { Course } from '../courses/types';
import { normalizeCourseCode } from '../courses/codes';
import type { PlannedCourse, Scenario, WorkloadPreference } from '../plan/types';
import { assessEligibility } from '../prerequisites/evaluate';
import type { CourseRecord, EligibilityAssessment } from '../prerequisites/evaluate';
import { assessOffering } from '../offerings/assess';
import type { CourseOfferingRecord, OfferingAssessment } from '../offerings/types';
import type { ExternalCreditResult } from '../externalCredit/resolve';
import {
  isRegularQuarter,
  isSummerTermId,
  sequenceOfTermId,
  summerSessionOfTermId,
  academicYearForTerm,
  calendarYearOfTermId,
} from '../terms/terms';
import type { Season, SummerSession } from '../terms/terms';
import { validateRegularQuarter, validateSummer } from '../workload/load';
import type { LoadIssue, SummerPlacement } from '../workload/load';

/**
 * Per-placement and per-term warnings for the planning board.
 *
 * Warnings explain rather than merely flag (01 — Product principles), and they
 * do not block experimentation: everything here is advisory except the absolute
 * 32-unit Summer ceiling.
 */

export type WarningKind =
  | 'prerequisite'
  | 'corequisite'
  | 'restriction'
  | 'duplicate'
  | 'duplicate_external'
  | 'offering'
  | 'unscheduled'
  | 'repeatability';

export interface PlacementWarning {
  kind: WarningKind;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  /** Course codes or requirement ids this warning points at. */
  relatedCodes?: string[];
}

export interface PlacementAssessment {
  placementId: string;
  code: string;
  course: Course | undefined;
  units: number;
  eligibility: EligibilityAssessment | null;
  offering: OfferingAssessment | null;
  warnings: PlacementWarning[];
}

export interface TermAssessment {
  termId: string;
  units: number;
  courseCount: number;
  loadIssues: LoadIssue[];
  placements: PlacementAssessment[];
}

export interface SummerAssessment {
  calendarYear: number;
  totalUnits: number;
  sessionUnits: Record<SummerSession, number>;
  loadIssues: LoadIssue[];
  valid: boolean;
}

export interface PlannerAssessment {
  byPlacement: Map<string, PlacementAssessment>;
  byTerm: Map<string, TermAssessment>;
  bySummer: Map<number, SummerAssessment>;
  /** Every warning, for the top-level "unresolved issues" count. */
  allWarnings: PlacementWarning[];
}

export interface AssessPlannerInput {
  scenario: Scenario;
  courseIndex: Map<string, Course>;
  offeringIndex: Map<string, CourseOfferingRecord>;
  external: ExternalCreditResult;
  workload: WorkloadPreference;
  /** All term ids on the board, so empty terms still get a card. */
  termIds: string[];
}

/** Departments whose courses count as technical for the Summer overlap hint. */
const INTENSIVE_DEPARTMENTS = new Set(['COMPSCI', 'I&C SCI', 'MATH', 'PHYSICS', 'CHEM', 'SWE', 'STATS', 'IN4MATX']);

function unitsFor(course: Course | undefined, placement: PlannedCourse): number {
  if (placement.plannedUnits !== undefined) return placement.plannedUnits;
  if (!course) return 0;
  return course.units.variable ? course.units.min : course.units.max;
}

function toCourseRecords(scenario: Scenario, external: ExternalCreditResult): CourseRecord[] {
  const records: CourseRecord[] = scenario.plannedCourses.map((p) => {
    const record: CourseRecord = { code: p.code, status: p.status };
    if (p.termId) record.termId = p.termId;
    if (p.grade) record.grade = p.grade;
    if (p.source !== 'uci') record.external = true;
    return record;
  });

  // Exact external equivalences clear prerequisites; elective-only credit does not.
  for (const code of external.equivalentCourseCodes) {
    records.push({ code, status: 'completed', external: true });
  }
  for (const code of external.electiveOnlyCourseCodes) {
    records.push({ code, status: 'completed', external: true, electiveOnly: true });
  }
  return records;
}

function seasonOf(termId: string): Season | null {
  const match = /-(fall|winter|spring|summer)/.exec(termId);
  return match ? (match[1] as Season) : null;
}

export function assessPlanner(input: AssessPlannerInput): PlannerAssessment {
  const { scenario, courseIndex, offeringIndex, external, workload, termIds } = input;

  const records = toCourseRecords(scenario, external);
  const waivedCourseCodes = new Set(
    scenario.overrides.filter((o) => o.type === 'prerequisite_waiver').map((o) => normalizeCourseCode(o.targetId)),
  );

  const byPlacement = new Map<string, PlacementAssessment>();
  const allWarnings: PlacementWarning[] = [];

  // Count placements per course code to detect duplicates.
  const codeCounts = new Map<string, PlannedCourse[]>();
  for (const p of scenario.plannedCourses) {
    const list = codeCounts.get(p.code) ?? [];
    list.push(p);
    codeCounts.set(p.code, list);
  }

  for (const placement of scenario.plannedCourses) {
    const course = courseIndex.get(placement.code);
    const warnings: PlacementWarning[] = [];
    const units = unitsFor(course, placement);

    // --- prerequisites / corequisites ------------------------------------
    let eligibility: EligibilityAssessment | null = null;
    if (course && placement.termId) {
      eligibility = assessEligibility(
        {
          ...(course.prerequisiteExpr ? { prerequisiteExpr: course.prerequisiteExpr } : {}),
          ...(course.corequisiteExpr ? { corequisiteExpr: course.corequisiteExpr } : {}),
        },
        {
          records,
          targetTermId: placement.termId,
          satisfiedEvidenceKeys: external.prerequisiteEvidenceKeys,
          waivedCourseCodes,
        },
      );

      if (eligibility.prerequisite.status === 'unsatisfied') {
        warnings.push({
          kind: 'prerequisite',
          severity: 'warning',
          title: 'Prerequisites not satisfied by this term',
          detail: eligibility.prerequisite.missing.join(' '),
          relatedCodes: collectCodes(course.prerequisiteRaw),
        });
      } else if (eligibility.prerequisite.status === 'unknown') {
        warnings.push({
          kind: 'prerequisite',
          severity: 'info',
          title: 'Prerequisites need verification',
          detail: eligibility.prerequisite.unresolved.join(' '),
        });
      }

      if (eligibility.corequisite.status === 'unsatisfied' || eligibility.concurrent.status === 'unsatisfied') {
        warnings.push({
          kind: 'corequisite',
          severity: 'warning',
          title: 'Corequisite not met',
          detail: [...eligibility.corequisite.missing, ...eligibility.concurrent.missing].join(' '),
        });
      }
    }

    // --- restrictions (separate from prerequisites) -----------------------
    for (const restriction of course?.restrictions ?? []) {
      warnings.push({
        kind: 'restriction',
        severity: 'info',
        title:
          restriction.kind === 'first_consideration'
            ? 'Enrollment restriction — first consideration'
            : 'Enrollment restriction',
        detail: restriction.raw,
      });
    }

    // --- duplicates -------------------------------------------------------
    const sameCode = codeCounts.get(placement.code) ?? [];
    const repeatable = course?.repeatability !== undefined;
    if (sameCode.length > 1 && !repeatable) {
      warnings.push({
        kind: 'duplicate',
        severity: 'warning',
        title: 'Course appears more than once',
        detail: `${placement.code} is placed ${sameCode.length} times but the catalogue lists no repeatability. Credit is awarded once.`,
        relatedCodes: [placement.code],
      });
    }

    if (external.duplicateBarredCourseCodes.has(placement.code) && placement.source === 'uci') {
      warnings.push({
        kind: 'duplicate_external',
        severity: 'warning',
        title: 'Duplicates exam credit',
        detail: `An exam award already exempts you from ${placement.code}. UCI awards credit only once, and a course you are exempt from earns no units or grade points.`,
        relatedCodes: [placement.code],
      });
    }

    // Same-as / overlap / co-taught cross-list conflicts.
    for (const overlapCode of [...(course?.overlapsWith ?? []), ...(course?.concurrentWith ?? [])]) {
      if (codeCounts.has(overlapCode)) {
        warnings.push({
          kind: 'duplicate',
          severity: 'warning',
          title: 'Overlapping course in plan',
          detail: `${placement.code} overlaps with ${overlapCode}, which is also in this plan. The catalogue restricts duplicate credit.`,
          relatedCodes: [overlapCode],
        });
      }
    }

    // --- offering ---------------------------------------------------------
    let offering: OfferingAssessment | null = null;
    if (placement.termId) {
      const year = calendarYearOfTermId(placement.termId);
      const season = seasonOf(placement.termId);
      if (year !== null && season) {
        offering = assessOffering({
          record: offeringIndex.get(placement.code),
          termId: placement.termId,
          academicYear: academicYearForTerm(year, season),
        });

        if (offering.state === 'uncommon' || offering.state === 'not_observed') {
          warnings.push({
            kind: 'offering',
            severity: 'warning',
            title: `Offering: ${offering.label}`,
            detail:
              offering.explanation +
              (offering.suggestedTerms.length > 0
                ? ` Stronger evidence exists for: ${offering.suggestedTerms.join(', ')}.`
                : ''),
          });
        }
      }
    } else {
      warnings.push({
        kind: 'unscheduled',
        severity: 'info',
        title: 'Not placed in a term',
        detail: 'This course is in the plan but has no term yet, so it is not counted in any term load.',
      });
    }

    const assessment: PlacementAssessment = {
      placementId: placement.id,
      code: placement.code,
      course,
      units,
      eligibility,
      offering,
      warnings,
    };
    byPlacement.set(placement.id, assessment);
    allWarnings.push(...warnings);
  }

  // --- term loads ---------------------------------------------------------
  const byTerm = new Map<string, TermAssessment>();
  const overriddenTerms = new Set(
    scenario.overrides.filter((o) => o.type === 'load_exception').map((o) => o.targetId),
  );

  for (const termId of termIds) {
    const placements = scenario.plannedCourses
      .filter((p) => p.termId === termId)
      .map((p) => byPlacement.get(p.id))
      .filter((a): a is PlacementAssessment => Boolean(a));

    const units = placements.reduce((sum, a) => sum + a.units, 0);
    const loadIssues = isRegularQuarter(termId)
      ? validateRegularQuarter(
          { termId, units, courseCount: placements.length },
          { regularWarnAboveUnits: workload.regularWarnAboveUnits },
          overriddenTerms.has(termId),
        ).issues
      : [];

    byTerm.set(termId, { termId, units, courseCount: placements.length, loadIssues, placements });
  }

  // --- Summer loads, grouped by calendar year -----------------------------
  const bySummer = new Map<number, SummerAssessment>();
  const summerYears = new Set(
    termIds.filter(isSummerTermId).map(calendarYearOfTermId).filter((y): y is number => y !== null),
  );

  for (const year of summerYears) {
    const summerPlacements: SummerPlacement[] = scenario.plannedCourses
      .filter((p) => p.termId && isSummerTermId(p.termId) && calendarYearOfTermId(p.termId) === year)
      .map((p) => {
        const session = summerSessionOfTermId(p.termId!);
        const assessment = byPlacement.get(p.id);
        const entry: SummerPlacement = {
          session: session ?? 'session_1',
          units: assessment?.units ?? 0,
          code: p.code,
        };
        const dept = assessment?.course?.department;
        if (dept && INTENSIVE_DEPARTMENTS.has(dept)) entry.intensive = true;
        return entry;
      });

    const result = validateSummer(year, summerPlacements, overriddenTerms.has(`${year}-summer`));
    bySummer.set(year, {
      calendarYear: year,
      totalUnits: result.totalUnits,
      sessionUnits: result.sessionUnits,
      loadIssues: result.issues,
      valid: result.valid,
    });
  }

  return { byPlacement, byTerm, bySummer, allWarnings };
}

/** Course codes mentioned in a raw prerequisite string, for warning links. */
function collectCodes(raw: string | undefined): string[] {
  if (!raw) return [];
  const matches = raw.match(/\b[A-Z][A-Z&]*(?:\s+[A-Z][A-Z&]*)*\s+[A-Z]?\d{1,3}[A-Z]{0,3}\b/g) ?? [];
  return Array.from(new Set(matches.map(normalizeCourseCode)));
}

/**
 * Courses already in the plan whose prerequisites depend on `code`, so moving
 * or removing it can warn about downstream impact.
 */
export function downstreamDependents(
  code: string,
  scenario: Scenario,
  courseIndex: Map<string, Course>,
): string[] {
  const target = normalizeCourseCode(code);
  const dependents: string[] = [];

  for (const placement of scenario.plannedCourses) {
    if (placement.code === target) continue;
    const course = courseIndex.get(placement.code);
    if (!course) continue;
    const codes = [
      ...collectCodes(course.prerequisiteRaw),
      ...collectCodes(course.corequisiteRaw),
    ];
    if (codes.includes(target)) dependents.push(placement.code);
  }
  return Array.from(new Set(dependents)).sort();
}

/** Terms strictly after `termId`, used for "move later" affordances. */
export function laterTerms(termId: string, termIds: string[]): string[] {
  const seq = sequenceOfTermId(termId);
  return termIds.filter((t) => sequenceOfTermId(t) > seq);
}
