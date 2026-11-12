import type { Season } from '../terms/terms';
import { calendarYearOfTermId, summerSessionOfTermId } from '../terms/terms';
import type {
  CourseOfferingRecord,
  OfferingAssessment,
  OfferingEvidence,
  OfferingState,
} from './types';
import { OFFERING_LABEL } from './types';

/**
 * Offering assessment for one course/term pair.
 *
 * Prediction hierarchy (03_DATA_SOURCES_AND_PREDICTIONS.md — Overrides and cadence):
 *   1. exact published WebSoc data;
 *   2. a current department plan (still labelled tentative);
 *   3. an explicit cadence note;
 *   4. the recency-weighted historical baseline;
 *   5. unknown.
 *
 * A new course with no history is "unknown", never "unlikely".
 */

/** Recency weights applied to the four most recent comparable academic years. */
export const RECENCY_WEIGHTS = [0.4, 0.3, 0.2, 0.1] as const;

const SCORE_LABELS: Array<{ min: number; state: OfferingState }> = [
  { min: 0.75, state: 'likely' },
  { min: 0.4, state: 'possible' },
  { min: 0.15, state: 'uncommon' },
  { min: 0.0, state: 'not_observed' },
];

function seasonOfTermId(termId: string): Season | null {
  const match = /-(fall|winter|spring|summer)/.exec(termId);
  return match ? (match[1] as Season) : null;
}

/**
 * Recency-weighted seasonal score over the four most recent comparable years.
 * Returns null when there is not enough evidence to compute one.
 */
export function seasonalScore(
  evidence: OfferingEvidence[],
  season: Season,
): { score: number; years: string[]; comparableYears: number } | null {
  const seasonEvidence = evidence.filter((e) => e.season === season && e.type !== 'inferred');
  if (seasonEvidence.length === 0) return null;

  // One observation per academic year: offered if any section appeared.
  const byYear = new Map<string, boolean>();
  for (const e of seasonEvidence) {
    byYear.set(e.academicYear, (byYear.get(e.academicYear) ?? false) || e.offered);
  }

  const years = Array.from(byYear.keys()).sort().reverse().slice(0, RECENCY_WEIGHTS.length);
  if (years.length === 0) return null;

  let weighted = 0;
  let weightTotal = 0;
  years.forEach((year, index) => {
    const weight = RECENCY_WEIGHTS[index] ?? 0;
    weightTotal += weight;
    if (byYear.get(year)) weighted += weight;
  });

  return {
    score: weightTotal > 0 ? weighted / weightTotal : 0,
    years,
    comparableYears: years.length,
  };
}

export interface AssessOptions {
  record: CourseOfferingRecord | undefined;
  termId: string;
  /** Academic year the target term belongs to. */
  academicYear: string;
}

export function assessOffering({ record, termId, academicYear }: AssessOptions): OfferingAssessment {
  const season = seasonOfTermId(termId);
  const session = summerSessionOfTermId(termId);

  if (!record || record.evidence.length === 0 || !season) {
    return {
      state: 'unknown',
      evidence: [],
      suggestedTerms: [],
      label: OFFERING_LABEL.unknown,
      explanation:
        'No offering evidence has been imported for this course yet. Offerings are never guaranteed — check WebSoc closer to enrollment.',
    };
  }

  const relevant = record.evidence.filter((e) => e.season === season);

  // 1. Exact published evidence for this term (and Summer session) wins.
  const published = relevant.find(
    (e) =>
      e.type === 'scheduled' &&
      e.academicYear === academicYear &&
      (session ? e.summerSession === session : true),
  );
  if (published) {
    return {
      state: 'scheduled',
      confidence: 1,
      evidence: [published],
      suggestedTerms: [],
      lastObserved: published.academicYear,
      label: OFFERING_LABEL.scheduled,
      explanation: `Published in the Schedule of Classes for ${published.academicYear} ${season}${
        published.summerSession ? ` (${published.summerSession.replace('_', ' ')})` : ''
      }. Sections can still change or be cancelled.`,
    };
  }

  // 2. A current tentative department plan — labelled tentative, never scheduled.
  const departmentPlan = relevant.find(
    (e) =>
      e.type === 'department_plan' &&
      e.academicYear === academicYear &&
      (session ? e.summerSession === session || !e.summerSession : true),
  );
  if (departmentPlan) {
    return {
      state: departmentPlan.offered ? 'planned' : 'not_observed',
      confidence: departmentPlan.offered ? 0.8 : 0.1,
      evidence: [departmentPlan],
      suggestedTerms: suggestedTermsFor(record, termId),
      lastObserved: departmentPlan.academicYear,
      label: departmentPlan.offered ? OFFERING_LABEL.planned : OFFERING_LABEL.not_observed,
      explanation: departmentPlan.offered
        ? `Listed in the ${departmentPlan.sourceLabel} tentative teaching plan for ${departmentPlan.academicYear} ${season}. Department plans are explicitly subject to change and are not a schedule.`
        : `Not present in the ${departmentPlan.sourceLabel} tentative plan for this term. A blank cell means "not in this plan", not "impossible".`,
    };
  }

  // 3. An explicit cadence note overrides the statistical baseline.
  const cadence = relevant.find((e) => e.type === 'cadence_note');
  if (cadence) {
    return {
      state: cadence.offered ? 'likely' : 'uncommon',
      confidence: cadence.offered ? 0.75 : 0.2,
      evidence: [cadence],
      suggestedTerms: suggestedTermsFor(record, termId),
      label: cadence.offered ? OFFERING_LABEL.likely : OFFERING_LABEL.uncommon,
      explanation: `${cadence.note ?? record.cadenceNote ?? 'A published cadence note applies to this course.'} Source: ${cadence.sourceLabel}.`,
    };
  }

  // 4. Recency-weighted historical baseline.
  const scored = seasonalScore(record.evidence, season);
  if (!scored) {
    return {
      state: 'unknown',
      evidence: relevant,
      suggestedTerms: suggestedTermsFor(record, termId),
      label: OFFERING_LABEL.unknown,
      explanation:
        'No comparable historical terms are on record for this season, so no prediction is possible. This is not evidence the course will not be offered.',
    };
  }

  // Fewer than two comparable years is insufficient evidence, not a low score.
  if (scored.comparableYears < 2) {
    return {
      state: 'unknown',
      confidence: scored.score,
      evidence: relevant,
      suggestedTerms: suggestedTermsFor(record, termId),
      lastObserved: scored.years[0],
      label: OFFERING_LABEL.unknown,
      explanation: `Only ${scored.comparableYears} comparable year on record (${scored.years.join(', ')}), which is not enough to predict. Treated as unknown, not unlikely.`,
    };
  }

  const band = SCORE_LABELS.find((b) => scored.score >= b.min) ?? SCORE_LABELS[SCORE_LABELS.length - 1]!;
  return {
    state: band.state,
    confidence: scored.score,
    evidence: relevant,
    suggestedTerms: suggestedTermsFor(record, termId),
    lastObserved: scored.years[0],
    label: OFFERING_LABEL[band.state],
    explanation: `Historical inference only, from ${scored.years.length} comparable ${season} terms (${scored.years.join(', ')}), recency-weighted to ${(scored.score * 100).toFixed(0)}%. This is not a schedule and not a guarantee.`,
  };
}

/** Seasons where this course has stronger evidence, as a fallback suggestion. */
function suggestedTermsFor(record: CourseOfferingRecord, currentTermId: string): string[] {
  const year = calendarYearOfTermId(currentTermId);
  if (year === null) return [];

  const bySeason = new Map<Season, number>();
  for (const season of ['fall', 'winter', 'spring', 'summer'] as Season[]) {
    const scored = seasonalScore(record.evidence, season);
    const planned = record.evidence.some((e) => e.season === season && e.type === 'department_plan' && e.offered);
    const value = planned ? 1 : (scored?.score ?? 0);
    if (value >= 0.5) bySeason.set(season, value);
  }

  return Array.from(bySeason.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([season]) => (season === 'summer' ? `${year}-summer-session_1` : `${year}-${season}`))
    .filter((id) => id !== currentTermId)
    .slice(0, 3);
}
