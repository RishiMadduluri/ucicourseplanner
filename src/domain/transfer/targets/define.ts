import type {
  EligibilityRule,
  Necessity,
  TransferRequirement,
  TransferSatisfaction,
  EquivalenceConfidence,
} from '../types';

/** Terse constructors so the per-school data reads like the source pages. */

export function req(
  id: string,
  title: string,
  satisfiedBy: TransferSatisfaction,
  options: {
    necessity?: Necessity;
    confidence?: EquivalenceConfidence;
    targetCourses?: string[];
    minGrade?: TransferRequirement['minGrade'];
    letterGradeRequired?: boolean;
    appliesWhen?: TransferRequirement['appliesWhen'];
    additional?: boolean;
    note?: string;
  } = {},
): TransferRequirement {
  return {
    id,
    title,
    satisfiedBy,
    necessity: options.necessity ?? 'required',
    confidence: options.confidence ?? 'mapped_from_catalogue',
    targetCourses: options.targetCourses,
    minGrade: options.minGrade,
    letterGradeRequired: options.letterGradeRequired,
    appliesWhen: options.appliesWhen,
    additional: options.additional,
    note: options.note,
  };
}

export function rule(
  id: string,
  kind: EligibilityRule['kind'],
  title: string,
  detail: string,
  options: { severity?: EligibilityRule['severity']; check?: EligibilityRule['check'] } = {},
): EligibilityRule {
  return {
    id,
    kind,
    title,
    detail,
    severity: options.severity ?? 'advisory',
    check: options.check,
  };
}

/** Every record in this dataset was read from its source on this date. */
export const RETRIEVED_AT = '2026-08-31';
