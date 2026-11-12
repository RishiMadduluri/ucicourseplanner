import type { Season, SummerSession } from '../terms/terms';

/**
 * Offering evidence and prediction (03_DATA_SOURCES_AND_PREDICTIONS.md).
 *
 * Offering evidence is modelled separately from prerequisite eligibility. The
 * UI must never collapse them into one "available" field, and a department plan
 * is never relabelled as "scheduled".
 */

export type EvidenceType =
  /** Published in WebSoc for that exact term. */
  | 'scheduled'
  /** Present in a current tentative department teaching plan. */
  | 'department_plan'
  /** Observed in an older WebSoc or teaching-plan snapshot. */
  | 'historical'
  /** Explicit annual / every-other-year / Summer-only note. */
  | 'cadence_note'
  /** Generated from historical observations. */
  | 'inferred'
  | 'unknown';

export interface OfferingEvidence {
  type: EvidenceType;
  /** Academic year the evidence describes, e.g. "2026-27". */
  academicYear: string;
  season: Season;
  summerSession?: SummerSession;
  /** True when a section actually appeared / is planned. */
  offered: boolean;
  sourceUrl: string;
  sourceLabel: string;
  retrievedAt: string;
  note?: string;
}

export type OfferingState =
  | 'scheduled'
  | 'planned'
  | 'likely'
  | 'possible'
  | 'uncommon'
  | 'not_observed'
  | 'unknown';

export interface OfferingAssessment {
  state: OfferingState;
  /** 0..1 seasonal score; absent when there is no basis to compute one. */
  confidence?: number;
  evidence: OfferingEvidence[];
  /** Term ids where this course looks more likely. */
  suggestedTerms: string[];
  lastObserved?: string;
  /** Always shown next to the state so a prediction is never read as a promise. */
  label: string;
  explanation: string;
}

/** Display labels — a prediction is never called "scheduled". */
export const OFFERING_LABEL: Record<OfferingState, string> = {
  scheduled: 'Published',
  planned: 'Department planned — tentative',
  likely: 'Historically likely',
  possible: 'Historically possible',
  uncommon: 'Historically uncommon',
  not_observed: 'Not recently observed',
  unknown: 'Unknown',
};

export interface CourseOfferingRecord {
  normalizedCode: string;
  evidence: OfferingEvidence[];
  /** e.g. "Summer only", "Offered every other year (odd Springs)". */
  cadenceNote?: string;
}

export interface OfferingSnapshot {
  schemaVersion: number;
  buildId: string;
  retrievedAt: string;
  records: CourseOfferingRecord[];
}
