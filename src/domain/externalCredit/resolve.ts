import type { ExternalExam, ManualCredit } from '../plan/types';
import { normalizeCourseCode } from '../courses/codes';
import type { GeEffect, ExamAward } from './apAwards';
import { AP_COMBINATION_RULES, AP_UNIT_CAPS, findAward } from './apAwards';

/**
 * Turns entered exams and manual credit into derived awards.
 *
 * 04_PLANNING_AND_AUDIT_ENGINE.md — External-exam evaluation:
 *   1. match exam and score to the catalogue-year award rule;
 *   2. emit distinct effects for units, course equivalence, GE, ELWR/AH&I, and
 *      prerequisite clearance;
 *   3. retain alternate sequences until one is selected;
 *   4. award units only once across duplicate credit;
 *   5. keep exam credit out of every GPA;
 *   6. return `unknown_needs_verification` when no rule matches.
 */

export interface DerivedCourseEquivalence {
  /** Which entered exam produced this. */
  examId: string;
  examName: string;
  score: string;
  /** Alternatives; each inner array is one complete option. */
  options: string[][];
  /** Index into `options` the user (or the solver) selected. */
  selectedOptionIndex: number;
  /** Normalized codes granted by the selected option. */
  grantedCourseCodes: string[];
}

export interface DerivedAward {
  examId: string;
  examKey: string;
  examName: string;
  score: string;
  status: 'resolved' | 'unknown_needs_verification';
  /** Units after cross-exam caps are applied. */
  unitsAwarded: number;
  /** Units before capping, for the "why was this reduced" explanation. */
  unitsBeforeCap: number;
  capNote?: string;
  equivalence?: DerivedCourseEquivalence;
  geEffects: GeEffect[];
  universityRequirementEffects: string[];
  electiveOnly: boolean;
  additionalElectiveUnits: number;
  duplicateWithCourseCodes: string[];
  placementNote?: string;
  programUseLimitation?: string;
  sourceUrl?: string;
  award?: ExamAward;
}

export interface ExternalCreditResult {
  awards: DerivedAward[];
  /** Course codes cleared by exact equivalence, usable for prerequisites. */
  equivalentCourseCodes: Set<string>;
  /** Codes from elective-only credit — units only, never prerequisite clearance. */
  electiveOnlyCourseCodes: Set<string>;
  /** Every UCI course the student may no longer earn credit in. */
  duplicateBarredCourseCodes: Set<string>;
  /** Requirement evidence keys, e.g. "elwr". */
  satisfiedRequirementKeys: Set<string>;
  /** Evidence keys usable by prerequisite exam nodes, e.g. "AP CALCULUS BC>=4". */
  prerequisiteEvidenceKeys: Set<string>;
  geEffects: GeEffect[];
  /** Total external units, already capped and de-duplicated. */
  totalExternalUnits: number;
  /** UCI quarter units awarded by AP/IB/other examinations only. */
  examUnits: number;
  /** Prior-college/manual units normalized to UCI quarter units. */
  manualQuarterUnits: number;
  /** Extra GE granted only by an exam combination. */
  combinationNotes: string[];
}

/** Optional per-exam choice of which equivalence alternative to use. */
export type EquivalenceSelections = Record<string, number>;

export function resolveExternalCredit(
  exams: ExternalExam[],
  manualCredits: ManualCredit[] = [],
  selections: EquivalenceSelections = {},
): ExternalCreditResult {
  const awards: DerivedAward[] = [];
  const capUsage = new Map<string, number>();

  // Deterministic order so capping is reproducible.
  const ordered = [...exams].sort((a, b) => a.examKey.localeCompare(b.examKey) || a.id.localeCompare(b.id));

  for (const exam of ordered) {
    const score = Number.parseInt(exam.score, 10);
    const rule = Number.isFinite(score) ? findAward(exam.examKey, score) : undefined;

    if (!rule) {
      awards.push({
        examId: exam.id,
        examKey: exam.examKey,
        examName: exam.examName,
        score: exam.score,
        status: 'unknown_needs_verification',
        unitsAwarded: 0,
        unitsBeforeCap: 0,
        geEffects: [],
        universityRequirementEffects: [],
        electiveOnly: false,
        additionalElectiveUnits: 0,
        duplicateWithCourseCodes: [],
      });
      continue;
    }

    // Apply the cross-exam unit cap for this award's group.
    let unitsAwarded = rule.units;
    let capNote: string | undefined;
    if (rule.capGroup) {
      const cap = AP_UNIT_CAPS.find((c) => c.group === rule.capGroup);
      if (cap) {
        const used = capUsage.get(rule.capGroup) ?? 0;
        const remaining = Math.max(0, cap.maxUnits - used);
        if (rule.units > remaining) {
          capNote = `Reduced from ${rule.units} to ${remaining} units — ${cap.label} are capped at ${cap.maxUnits} units total.`;
          unitsAwarded = remaining;
        }
        capUsage.set(rule.capGroup, used + unitsAwarded);
      }
    }

    const selectedOptionIndex = selections[exam.id] ?? 0;
    const equivalence: DerivedCourseEquivalence | undefined =
      rule.equivalentCourseOptions.length > 0
        ? {
            examId: exam.id,
            examName: rule.examName,
            score: exam.score,
            options: rule.equivalentCourseOptions,
            selectedOptionIndex: Math.min(selectedOptionIndex, rule.equivalentCourseOptions.length - 1),
            grantedCourseCodes: (
              rule.equivalentCourseOptions[Math.min(selectedOptionIndex, rule.equivalentCourseOptions.length - 1)] ?? []
            ).map(normalizeCourseCode),
          }
        : undefined;

    const derived: DerivedAward = {
      examId: exam.id,
      examKey: exam.examKey,
      examName: rule.examName,
      score: exam.score,
      status: 'resolved',
      unitsAwarded,
      unitsBeforeCap: rule.units,
      geEffects: rule.geEffects,
      universityRequirementEffects: rule.universityRequirementEffects,
      electiveOnly: rule.electiveOnly,
      additionalElectiveUnits: rule.additionalElectiveUnits ?? 0,
      duplicateWithCourseCodes: rule.duplicateWithCourseCodes.map(normalizeCourseCode),
      sourceUrl: rule.sourceUrl,
      award: rule,
    };
    if (capNote) derived.capNote = capNote;
    if (equivalence) derived.equivalence = equivalence;
    if (rule.placementNote) derived.placementNote = rule.placementNote;
    if (rule.programUseLimitation) derived.programUseLimitation = rule.programUseLimitation;

    awards.push(derived);
  }

  // ---- Combination rules ---------------------------------------------------
  const combinationNotes: string[] = [];
  const extraGe: GeEffect[] = [];
  for (const combo of AP_COMBINATION_RULES) {
    const allPresent = combo.requires.every((need) =>
      exams.some((e) => e.examKey === need.examKey && Number.parseInt(e.score, 10) >= need.minScore),
    );
    if (allPresent) {
      extraGe.push(...combo.extraGeEffects);
      combinationNotes.push(combo.description);
    }
  }

  // ---- Aggregate -----------------------------------------------------------
  const equivalentCourseCodes = new Set<string>();
  const electiveOnlyCourseCodes = new Set<string>();
  const duplicateBarredCourseCodes = new Set<string>();
  const satisfiedRequirementKeys = new Set<string>();
  const prerequisiteEvidenceKeys = new Set<string>();
  const geEffects: GeEffect[] = [...extraGe];

  for (const a of awards) {
    if (a.status !== 'resolved') continue;

    if (a.equivalence) {
      for (const code of a.equivalence.grantedCourseCodes) {
        // Elective-only awards never produce a usable equivalence, but guard
        // anyway so the two sets can never overlap.
        if (a.electiveOnly) electiveOnlyCourseCodes.add(code);
        else equivalentCourseCodes.add(code);
      }
    }
    for (const code of a.duplicateWithCourseCodes) duplicateBarredCourseCodes.add(code);
    for (const key of a.universityRequirementEffects) satisfiedRequirementKeys.add(key);
    geEffects.push(...a.geEffects);

    // Evidence key form used by parsed prerequisite exam nodes,
    // e.g. "AP Calculus BC with a minimum score of 4" -> "AP CALCULUS BC>=4".
    const score = Number.parseInt(a.score, 10);
    if (Number.isFinite(score)) {
      for (let threshold = 1; threshold <= score; threshold += 1) {
        prerequisiteEvidenceKeys.add(`AP ${a.examName}>=${threshold}`.toUpperCase());
      }
    }
  }

  // ---- Manual / transfer credit -------------------------------------------
  let manualQuarterUnits = 0;
  let manuallyEnteredExamUnits = 0;
  for (const credit of manualCredits) {
    // Existing records predate `unitSystem` and were entered in UCI quarter
    // units, so quarter is the backwards-compatible default.
    const quarterUnits = credit.unitSystem === 'semester' ? credit.units * 1.5 : credit.units;
    if (credit.source === 'ap' || credit.source === 'ib') manuallyEnteredExamUnits += quarterUnits;
    else manualQuarterUnits += quarterUnits;
    for (const raw of credit.equivalentCourseCodes) {
      equivalentCourseCodes.add(normalizeCourseCode(raw));
      duplicateBarredCourseCodes.add(normalizeCourseCode(raw));
    }
  }

  const examUnits = awards.reduce((sum, a) => sum + a.unitsAwarded, 0) + manuallyEnteredExamUnits;

  return {
    awards,
    equivalentCourseCodes,
    electiveOnlyCourseCodes,
    duplicateBarredCourseCodes,
    satisfiedRequirementKeys,
    prerequisiteEvidenceKeys,
    geEffects,
    totalExternalUnits: examUnits + manualQuarterUnits,
    examUnits,
    manualQuarterUnits,
    combinationNotes,
  };
}

/**
 * Human-readable preview of one exam+score, shown during onboarding *before*
 * the exam is saved (acceptance criterion 58).
 */
export function previewAward(examKey: string, score: number): string[] {
  const rule = findAward(examKey, score);
  if (!rule) {
    return ['No 2026-27 award rule matches this exam and score. Recorded as needing verification.'];
  }

  const lines: string[] = [];
  lines.push(rule.units > 0 ? `${rule.units} UCI units awarded.` : 'No university units awarded.');

  if (rule.electiveOnly) {
    lines.push('Elective credit only — this does not clear any specific UCI course.');
  } else if (rule.equivalentCourseOptions.length > 0) {
    const options = rule.equivalentCourseOptions.map((opt) => opt.join(' + ')).join('  —or—  ');
    lines.push(`Course equivalence: ${options}`);
  }

  if (rule.additionalElectiveUnits) {
    lines.push(`Plus ${rule.additionalElectiveUnits} elective units.`);
  }
  for (const ge of rule.geEffects) {
    lines.push(`GE ${ge.category}: ${ge.note ?? 'one course.'}`);
  }
  for (const key of rule.universityRequirementEffects) {
    lines.push(
      key === 'elwr'
        ? 'Satisfies the UC Entry Level Writing Requirement.'
        : key === 'american_history_institutions'
          ? 'Satisfies American History and Institutions.'
          : `Satisfies ${key}.`,
    );
  }
  if (rule.duplicateWithCourseCodes.length > 0) {
    lines.push(
      `Duplicate-credit bar: you may not also earn units or grade points in ${rule.duplicateWithCourseCodes.join(', ')}.`,
    );
  }
  if (rule.capGroup) {
    const cap = AP_UNIT_CAPS.find((c) => c.group === rule.capGroup);
    if (cap) lines.push(`Counts toward the ${cap.label} cap of ${cap.maxUnits} units.`);
  }
  if (rule.placementNote) lines.push(rule.placementNote);
  if (rule.programUseLimitation) lines.push(rule.programUseLimitation);
  lines.push('Exam credit carries no letter grade and is excluded from every GPA.');
  return lines;
}
