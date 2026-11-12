import type { SummerSession } from '../terms/terms';
import { isRegularQuarter, isSummerTermId, summerSessionOfTermId } from '../terms/terms';

/**
 * Course-load validation (02_UCI_REQUIREMENTS_2026_27.md, 04 — Workload risk).
 *
 * Official limits and personal preferences are deliberately separate: 17-20
 * units in a regular quarter is legal, so a personal "above 16" warning must not
 * present it as prohibited.
 *
 * Regular quarter : 12-20 units standard; outside that needs dean authorization.
 * Summer          : 20 units total normally, 12 units in any one session;
 *                   a 10-week course splits half into Session 1 and half into
 *                   Session 2 for session-load checking;
 *                   more than 32 total Summer units is invalid even with an
 *                   override.
 */

export const REGULAR_MIN_UNITS = 12;
export const REGULAR_MAX_UNITS = 20;
export const SUMMER_TOTAL_NORMAL_MAX = 20;
export const SUMMER_SESSION_NORMAL_MAX = 12;
/** Hard ceiling: no approval can permit more than this for the full Summer. */
export const SUMMER_ABSOLUTE_MAX = 32;

export type LoadSeverity = 'ok' | 'info' | 'warning' | 'invalid';

export interface LoadIssue {
  severity: LoadSeverity;
  code:
    | 'below_minimum'
    | 'above_maximum'
    | 'summer_total_above_normal'
    | 'summer_session_above_normal'
    | 'summer_absolute_exceeded'
    | 'personal_threshold'
    | 'summer_compressed_overlap';
  message: string;
  /** How the user can resolve or acknowledge it. */
  resolution: string;
  /** True when a recorded override already acknowledges this issue. */
  overridden?: boolean;
}

export interface TermLoadInput {
  termId: string;
  /** Units placed in this exact term (for Summer, this one session lane). */
  units: number;
  courseCount: number;
}

export interface RegularLoadResult {
  termId: string;
  units: number;
  issues: LoadIssue[];
  /** True when the total sits inside the official 12-20 band. */
  withinOfficialRange: boolean;
}

export interface PersonalPreferences {
  /** Warn above this many units without calling the load illegal. */
  regularWarnAboveUnits: number;
}

/** Validate one regular quarter (Fall / Winter / Spring). */
export function validateRegularQuarter(
  input: TermLoadInput,
  preferences: PersonalPreferences,
  hasOverride = false,
): RegularLoadResult {
  const issues: LoadIssue[] = [];
  const { units } = input;

  // An empty term is simply not planned yet, not an under-load.
  if (units > 0 && units < REGULAR_MIN_UNITS) {
    issues.push({
      severity: 'warning',
      code: 'below_minimum',
      message: `${units} units is below the standard minimum of ${REGULAR_MIN_UNITS} for a regular quarter.`,
      resolution: 'Still plannable, but enrolling below 12 units requires authorization from your dean.',
      overridden: hasOverride,
    });
  }
  if (units > REGULAR_MAX_UNITS) {
    issues.push({
      severity: 'warning',
      code: 'above_maximum',
      message: `${units} units is above the standard maximum of ${REGULAR_MAX_UNITS} for a regular quarter.`,
      resolution: 'Still plannable, but enrolling above 20 units requires authorization from your dean.',
      overridden: hasOverride,
    });
  }
  // Personal preference: informational only, and never for a legal load.
  if (units > preferences.regularWarnAboveUnits && units <= REGULAR_MAX_UNITS) {
    issues.push({
      severity: 'info',
      code: 'personal_threshold',
      message: `${units} units is above your personal target of ${preferences.regularWarnAboveUnits}.`,
      resolution: `This is a normal, fully authorized load — ${REGULAR_MIN_UNITS}-${REGULAR_MAX_UNITS} units is the official range. Adjust your target in Settings.`,
    });
  }

  return {
    termId: input.termId,
    units,
    issues,
    withinOfficialRange: units === 0 || (units >= REGULAR_MIN_UNITS && units <= REGULAR_MAX_UNITS),
  };
}

export interface SummerPlacement {
  session: SummerSession;
  units: number;
  code: string;
  /** True for a technical/major course, used for the compressed-overlap hint. */
  intensive?: boolean;
}

export interface SummerLoadResult {
  calendarYear: number;
  totalUnits: number;
  /** Effective load per session after splitting 10-week courses. */
  sessionUnits: Record<SummerSession, number>;
  issues: LoadIssue[];
  valid: boolean;
}

/**
 * Validate a whole Summer.
 *
 * A 10-week course contributes half its units to Session 1 and half to Session 2
 * for session-load checking, but its full units to the Summer total.
 */
export function validateSummer(
  calendarYear: number,
  placements: SummerPlacement[],
  hasOverride = false,
): SummerLoadResult {
  const sessionUnits: Record<SummerSession, number> = { session_1: 0, ten_week: 0, session_2: 0 };
  let totalUnits = 0;

  for (const placement of placements) {
    totalUnits += placement.units;
    if (placement.session === 'ten_week') {
      sessionUnits.ten_week += placement.units;
      sessionUnits.session_1 += placement.units / 2;
      sessionUnits.session_2 += placement.units / 2;
    } else {
      sessionUnits[placement.session] += placement.units;
    }
  }

  const issues: LoadIssue[] = [];

  if (totalUnits > SUMMER_ABSOLUTE_MAX) {
    issues.push({
      severity: 'invalid',
      code: 'summer_absolute_exceeded',
      message: `${totalUnits} units exceeds the absolute Summer ceiling of ${SUMMER_ABSOLUTE_MAX} units.`,
      resolution: 'No approval can permit more than 32 total Summer units. Remove courses to continue.',
    });
  } else if (totalUnits > SUMMER_TOTAL_NORMAL_MAX) {
    issues.push({
      severity: 'warning',
      code: 'summer_total_above_normal',
      message: `${totalUnits} units is above the normal Summer maximum of ${SUMMER_TOTAL_NORMAL_MAX} units.`,
      resolution: 'Requires an approved Summer exception, recorded as an override.',
      overridden: hasOverride,
    });
  }

  for (const session of ['session_1', 'session_2'] as SummerSession[]) {
    const units = sessionUnits[session];
    if (units > SUMMER_SESSION_NORMAL_MAX) {
      issues.push({
        severity: 'warning',
        code: 'summer_session_above_normal',
        message: `${formatUnits(units)} units in ${session.replace('_', ' ')} is above the normal per-session maximum of ${SUMMER_SESSION_NORMAL_MAX}. 10-week courses count half in each session.`,
        resolution: 'Requires an approved Summer exception, recorded as an override.',
        overridden: hasOverride,
      });
    }
  }

  // Personal risk hint: two compressed technical courses in one session.
  for (const session of ['session_1', 'session_2'] as SummerSession[]) {
    const intensive = placements.filter(
      (p) => p.intensive && (p.session === session || p.session === 'ten_week'),
    );
    if (intensive.length >= 2) {
      issues.push({
        severity: 'info',
        code: 'summer_compressed_overlap',
        message: `${intensive.map((p) => p.code).join(' and ')} are both technical courses overlapping ${session.replace('_', ' ')}.`,
        resolution: 'Compressed Summer sessions move fast. Consider splitting them across sessions.',
      });
    }
  }

  return {
    calendarYear,
    totalUnits,
    sessionUnits,
    issues,
    valid: totalUnits <= SUMMER_ABSOLUTE_MAX,
  };
}

function formatUnits(units: number): string {
  return Number.isInteger(units) ? String(units) : units.toFixed(1);
}

/** Highest severity present, for a term-card badge. */
export function worstSeverity(issues: LoadIssue[]): LoadSeverity {
  if (issues.some((i) => i.severity === 'invalid')) return 'invalid';
  if (issues.some((i) => i.severity === 'warning' && !i.overridden)) return 'warning';
  if (issues.some((i) => i.severity === 'info')) return 'info';
  return 'ok';
}

/** Route a term to the correct validator. */
export function validateTerm(
  termId: string,
  input: TermLoadInput,
  preferences: PersonalPreferences,
  hasOverride = false,
): RegularLoadResult | null {
  if (isRegularQuarter(termId)) return validateRegularQuarter(input, preferences, hasOverride);
  if (isSummerTermId(termId) && summerSessionOfTermId(termId)) return null; // handled per-Summer
  return null;
}
