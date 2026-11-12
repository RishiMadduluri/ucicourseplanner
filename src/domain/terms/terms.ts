/**
 * Term model.
 *
 * 02_UCI_REQUIREMENTS_2026_27.md and 06_DECISIONS_NEEDED.md fix the default
 * horizon at Incoming Summer 2026 through Spring 2030. Summer is not one
 * undifferentiated quarter: Session 1, the 10-week session, and Session 2 are
 * distinct enrollment periods with their own load rules.
 */

export type Season = 'fall' | 'winter' | 'spring' | 'summer';
export type SummerSession = 'session_1' | 'ten_week' | 'session_2';

export const SUMMER_SESSIONS: readonly SummerSession[] = ['session_1', 'ten_week', 'session_2'];

export interface Term {
  /** Stable id, e.g. "2026-summer-session_1", "2026-fall". */
  id: string;
  /** Academic year label the term belongs to, e.g. "2026-27". */
  academicYear: string;
  /** Calendar year the term begins in. */
  calendarYear: number;
  season: Season;
  summerSession?: SummerSession;
  /** True for the pre-Year-1 Summer 2026 period. */
  isIncomingSummer: boolean;
  /** Monotonic ordering key across the whole plan. */
  sequence: number;
  label: string;
  /** Short label used inside dense term cards. */
  shortLabel: string;
}

/** A Summer card groups its three session lanes. */
export interface SummerGroup {
  id: string;
  calendarYear: number;
  academicYear: string;
  isIncomingSummer: boolean;
  label: string;
  sessions: Term[];
}

/** One board row: Fall, Winter, Spring, and an optional Summer group. */
export interface AcademicYearRow {
  academicYear: string;
  label: string;
  fall: Term;
  winter: Term;
  spring: Term;
  summer?: SummerGroup;
}

/**
 * Ordering within a calendar year follows the actual start month:
 * Winter (January) < Spring (March) < Summer (June) < Fall (September).
 *
 * This is what makes Summer 2026 precede Fall 2026 while Summer 2027 still
 * follows Spring 2027, using one monotonic key.
 */
const SEASON_ORDER: Record<Season, number> = { winter: 0, spring: 1, summer: 2, fall: 3 };
const SESSION_ORDER: Record<SummerSession, number> = { session_1: 0, ten_week: 1, session_2: 2 };

const SEASON_LABEL: Record<Season, string> = {
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
};

export const SUMMER_SESSION_LABEL: Record<SummerSession, string> = {
  session_1: 'Session 1',
  ten_week: '10-week',
  session_2: 'Session 2',
};

export const SUMMER_SESSION_SHORT: Record<SummerSession, string> = {
  session_1: 'S1',
  ten_week: '10W',
  session_2: 'S2',
};

/**
 * Published Summer 2026 dates (03_DATA_SOURCES_AND_PREDICTIONS.md — Incoming
 * Summer 2026 modeling). Shown so the user can sanity-check session overlap.
 */
export const SUMMER_2026_DATES: Record<SummerSession, { start: string; end: string }> = {
  session_1: { start: 'June 22, 2026', end: 'July 29, 2026' },
  ten_week: { start: 'June 22, 2026', end: 'August 28, 2026' },
  session_2: { start: 'August 3, 2026', end: 'September 9, 2026' },
};

/**
 * Summer belongs to the academic year that just ended: Summer 2027 sits at the
 * end of academic year 2026-27.
 */
export function academicYearForTerm(calendarYear: number, season: Season): string {
  if (season === 'fall') return `${calendarYear}-${String((calendarYear + 1) % 100).padStart(2, '0')}`;
  return `${calendarYear - 1}-${String(calendarYear % 100).padStart(2, '0')}`;
}

export function makeTermId(calendarYear: number, season: Season, session?: SummerSession): string {
  return season === 'summer' ? `${calendarYear}-summer-${session}` : `${calendarYear}-${season}`;
}

/**
 * Ordering key. Summer sessions sort before the following Fall; within a Summer,
 * Session 1 precedes the 10-week session, which precedes Session 2.
 */
export function termSequence(calendarYear: number, season: Season, session?: SummerSession): number {
  const base = calendarYear * 1000 + SEASON_ORDER[season] * 100;
  return base + (season === 'summer' && session ? SESSION_ORDER[session] * 10 : 0);
}

export function makeTerm(
  calendarYear: number,
  season: Season,
  session?: SummerSession,
  isIncomingSummer = false,
): Term {
  const academicYear = academicYearForTerm(calendarYear, season);
  const label =
    season === 'summer' && session
      ? `${isIncomingSummer ? 'Incoming ' : ''}Summer ${calendarYear} — ${SUMMER_SESSION_LABEL[session]}`
      : `${SEASON_LABEL[season]} ${calendarYear}`;
  const shortLabel =
    season === 'summer' && session
      ? SUMMER_SESSION_SHORT[session]
      : `${SEASON_LABEL[season].slice(0, 2)}${String(calendarYear).slice(2)}`;

  const term: Term = {
    id: makeTermId(calendarYear, season, session),
    academicYear,
    calendarYear,
    season,
    isIncomingSummer,
    sequence: termSequence(calendarYear, season, session),
    label,
    shortLabel,
  };
  if (session) term.summerSession = session;
  return term;
}

export function makeSummerGroup(calendarYear: number, isIncomingSummer = false): SummerGroup {
  return {
    id: `${calendarYear}-summer`,
    calendarYear,
    academicYear: academicYearForTerm(calendarYear, 'summer'),
    isIncomingSummer,
    label: `${isIncomingSummer ? 'Incoming ' : ''}Summer ${calendarYear}`,
    sessions: SUMMER_SESSIONS.map((s) => makeTerm(calendarYear, 'summer', s, isIncomingSummer)),
  };
}

export interface TimelineOptions {
  /** Calendar year of the incoming Summer, e.g. 2026. */
  startYear: number;
  /** Number of academic years on the board, normally 4. */
  academicYears: number;
  /** Whether Summer terms appear inside each academic-year row. */
  summersEnabled: boolean;
  /**
   * Final term of the plan. With the default Spring 2030 target the board stops
   * at Spring 2030 rather than adding a trailing Summer 2030.
   */
  graduationTermId: string;
}

export const DEFAULT_TIMELINE: TimelineOptions = {
  startYear: 2026,
  academicYears: 4,
  summersEnabled: true,
  graduationTermId: '2030-spring',
};

export interface Timeline {
  incomingSummer: SummerGroup;
  years: AcademicYearRow[];
  /** Every term, ordered by `sequence`. */
  allTerms: Term[];
  graduationTermId: string;
}

/**
 * Build the default board: a distinct Incoming Summer card, then four academic
 * year rows, each Fall / Winter / Spring plus a Summer group that is omitted
 * once it would fall after the graduation term.
 */
export function buildTimeline(options: TimelineOptions = DEFAULT_TIMELINE): Timeline {
  const { startYear, academicYears, summersEnabled, graduationTermId } = options;
  const incomingSummer = makeSummerGroup(startYear, true);

  const gradSeq = sequenceOfTermId(graduationTermId);
  const years: AcademicYearRow[] = [];

  for (let i = 0; i < academicYears; i += 1) {
    const fallYear = startYear + i;
    const academicYear = academicYearForTerm(fallYear, 'fall');
    const fall = makeTerm(fallYear, 'fall');
    const winter = makeTerm(fallYear + 1, 'winter');
    const spring = makeTerm(fallYear + 1, 'spring');

    const row: AcademicYearRow = {
      academicYear,
      label: `Year ${i + 1} — ${academicYear}`,
      fall,
      winter,
      spring,
    };

    if (summersEnabled) {
      const summer = makeSummerGroup(fallYear + 1);
      // Include Summer only when at least one of its sessions is on or before
      // the graduation term.
      const earliest = summer.sessions[0];
      if (earliest && earliest.sequence <= gradSeq) row.summer = summer;
    }
    years.push(row);
  }

  const allTerms = [
    ...incomingSummer.sessions,
    ...years.flatMap((y) => [y.fall, y.winter, y.spring, ...(y.summer?.sessions ?? [])]),
  ]
    .filter((t) => t.sequence <= gradSeq)
    .sort((a, b) => a.sequence - b.sequence);

  return { incomingSummer, years, allTerms, graduationTermId };
}

/** Recover a sequence number from a term id without needing the term object. */
export function sequenceOfTermId(termId: string): number {
  const match = /^(\d{4})-(fall|winter|spring|summer)(?:-(session_1|ten_week|session_2))?$/.exec(termId);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const year = Number.parseInt(match[1]!, 10);
  const season = match[2] as Season;
  const session = match[3] as SummerSession | undefined;
  return termSequence(year, season, session);
}

export function isSummerTermId(termId: string): boolean {
  return termId.includes('-summer');
}

/** True for Fall / Winter / Spring, which carry the official 12–20 unit range. */
export function isRegularQuarter(termId: string): boolean {
  return /-(fall|winter|spring)$/.test(termId);
}

/** Calendar year encoded in a term id, or null when unparseable. */
export function calendarYearOfTermId(termId: string): number | null {
  const match = /^(\d{4})-/.exec(termId);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

export function summerSessionOfTermId(termId: string): SummerSession | null {
  const match = /-summer-(session_1|ten_week|session_2)$/.exec(termId);
  return match ? (match[1] as SummerSession) : null;
}
