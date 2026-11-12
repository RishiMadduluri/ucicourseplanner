import type { Course, Grade } from '../courses/types';
import { GRADE_POINTS, isGradedLetter } from '../courses/types';
import type { Claim } from '../requirements/allocate';
import type { RequirementState } from '../requirements/types';
import type {
  EligibilityCheck,
  EligibilityRule,
  TransferCourseFilter,
  TransferExamCreditPolicy,
  TransferInstitution,
  TransferProgram,
  TransferRequirement,
  TransferSatisfaction,
} from './types';
import { quarterToSemesterUnits } from './types';

/**
 * Outbound-transfer evaluation.
 *
 * The engine answers one question per target: **if I stopped taking UCI courses
 * after term T, what would this school see?** Everything downstream — the
 * coursework check, the unit windows, the GPA, Yale's grade-distribution rule —
 * is computed from the same snapshot, so a target can never be judged against
 * courses the student would not actually have finished in time.
 *
 * Three-valued throughout. `unknown` is a real answer: a rule that depends on a
 * test score, a graded paper, or an adviser's syllabus review is never scored
 * as satisfied *or* as failed.
 */

/** How far a course has to have progressed to count for a requirement. */
type ClaimStanding = 'completed' | 'in_progress' | 'planned';

/**
 * The lowest grade counted inside the "A or B" band for Yale's distribution
 * rule. Stated as a named constant because it is an interpretation, not a
 * quotation.
 */
const A_OR_B_FLOOR: Grade = 'B-';

/** Grade points, or -1 for anything that carries none. */
function gradeValue(grade: Grade | undefined): number {
  if (grade === undefined) return -1;
  const value = GRADE_POINTS[grade];
  return value === undefined ? -1 : value;
}

export interface TransferSnapshot {
  /** The last UCI term the student would complete before leaving. */
  lastTermId: string;
  lastTermLabel: string;
  /** Claims that would exist by the end of that term. */
  claims: Claim[];
  /** Regular (non-summer) UCI quarters completed or in progress by then. */
  regularQuartersCompleted: number;
  /** Summer terms, counted separately — Brown and others exclude them. */
  summerTermsCompleted: number;
  /** UCI quarter units earned or in progress. */
  quarterUnits: number;
  /** Classroom credit before any destination-specific exam-credit decision. */
  courseworkQuarterUnits: number;
  /** UCI quarter units derived from AP/IB/other examinations. */
  examQuarterUnits: number;
  /** The same total expressed in semester units (x 2/3). */
  semesterUnitsEquivalent: number;
  /** GPA over letter-graded UCI work; undefined when nothing is graded yet. */
  gpa?: number;
  gradedUnits: number;
  /** Fraction of letter-graded courses at A or B — Yale's rule. */
  fractionAtAOrB?: number;
  /** Worst letter grade recorded, for floor-grade rules. */
  lowestLetterGrade?: Grade;
  /** Courses explicitly recorded Pass/No Pass or Satisfactory/Unsatisfactory. */
  passNoPassClaims: Claim[];
}

export interface RequirementCheck {
  requirement: TransferRequirement;
  state: RequirementState;
  /** Claims the engine used to satisfy it. */
  satisfiedBy: Claim[];
  /** UCI codes still needed, when the engine can name them. */
  missingCodes: string[];
  detail: string;
  /** False for conditional rules that do not apply to this plan. */
  applicable: boolean;
}

export interface EligibilityCheckResult {
  rule: EligibilityRule;
  status: 'met' | 'not_met' | 'unknown' | 'informational';
  detail: string;
}

/**
 * Coursework and eligibility are reported SEPARATELY on purpose.
 *
 * They fail for different reasons and are fixed by different actions: a
 * coursework gap is closed by adding a course, while an eligibility failure is
 * usually closed by transferring a term earlier or later — or cannot be closed
 * at all. Collapsing them into one badge hides which lever to pull.
 */
export type CourseworkReadiness =
  /** Every required course is complete, in progress, or on the plan. */
  | 'on_track'
  /** Some required coursework is missing or below the school's minimum grade. */
  | 'gaps'
  /** None of the required coursework is on the plan yet. */
  | 'not_started'
  /** The school publishes no required course list for transfer applicants. */
  | 'none_published';

export type EligibilityStatus =
  /** No blocking rule fails against this snapshot. */
  | 'open'
  /** No rule is known to fail, but at least one blocking rule lacks evidence. */
  | 'needs_review'
  /** At least one blocking rule fails at this transfer point. */
  | 'blocked'
  /** The program does not accept external transfer applicants at all. */
  | 'closed';

/** Overall sort key, derived from the two above. */
export type ProgramReadiness =
  | 'closed'
  | 'ineligible'
  | 'needs_review'
  | 'on_track'
  | 'gaps'
  | 'not_started'
  /** The school publishes no transfer course list, so there is nothing to be "on track" against. */
  | 'none_published';

export interface ProgramResult {
  institution: TransferInstitution;
  program: TransferProgram;
  /** Whether the plan's coursework covers what the school asks for. */
  coursework: CourseworkReadiness;
  /** Whether the plan's shape — units, terms, GPA — clears the blocking rules. */
  eligibility: EligibilityStatus;
  /** Combined key used for sorting and for the one-line summary badge. */
  readiness: ProgramReadiness;
  requirementChecks: RequirementCheck[];
  eligibilityResults: EligibilityCheckResult[];
  /** The blocking rules that currently fail, so the UI can name them. */
  failingRules: EligibilityCheckResult[];
  /** Counts over `necessity: 'required'` requirements only. */
  requiredTotal: number;
  requiredSatisfied: number;
  /** Requirements that are required and not yet satisfied. */
  blockingGaps: RequirementCheck[];
  /** UCI courses that would close the remaining required gaps. */
  suggestedCodes: string[];
}

// -------------------------------------------------------------- snapshot

const REGULAR_SEASONS = new Set(['fall', 'winter', 'spring']);

export const DEFAULT_EXAM_CREDIT_POLICY: TransferExamCreditPolicy = {
  coursework: 'manual_review',
  units: 'manual_review',
  detail: 'The destination must evaluate AP/IB credit under its own rules; a UCI equivalency is not automatically portable.',
  sourceUrls: [],
};

function isExamClaim(claim: Claim): boolean {
  return claim.source === 'ap' || claim.source === 'ib' || claim.externalExamSystem !== undefined;
}

/** Parse a term id like "2027-winter" or "2027-summer-session_1". */
function seasonOf(termId: string): string {
  return termId.split('-')[1] ?? '';
}

/**
 * Build the snapshot of what a target would see.
 *
 * `termSequence` maps term id -> monotonic order, so "before the transfer" is a
 * numeric comparison rather than string parsing. External credit (AP, prior
 * transfer work) has no term and always counts as already held.
 */
export function buildSnapshot(
  claims: Claim[],
  termSequence: Map<string, number>,
  lastTermId: string,
  lastTermLabel: string,
  creditTotals?: { examQuarterUnits: number; manualQuarterUnits: number },
  allowedTermIds?: ReadonlySet<string>,
): TransferSnapshot {
  const cutoff = termSequence.get(lastTermId);
  const kept = claims.filter((claim) => {
    if (claim.status === 'not_taken' || claim.status === 'failed') return false;
    if (!claim.termId) return true; // external credit
    if (allowedTermIds) return allowedTermIds.has(claim.termId);
    const sequence = termSequence.get(claim.termId);
    if (sequence === undefined || cutoff === undefined) return false;
    return sequence <= cutoff;
  });

  const regular = new Set<string>();
  const summer = new Set<string>();
  for (const claim of kept) {
    if (!claim.termId) continue;
    if (REGULAR_SEASONS.has(seasonOf(claim.termId))) regular.add(claim.termId);
    else summer.add(claim.termId.split('-').slice(0, 2).join('-'));
  }

  const nonExamClaims = kept.filter((claim) => !isExamClaim(claim));
  const classroomClaims = creditTotals
    ? nonExamClaims.filter((claim) => !claim.id.startsWith('manual:'))
    : nonExamClaims;
  const courseworkQuarterUnits =
    classroomClaims.reduce((total, claim) => total + claim.units, 0) +
    (creditTotals?.manualQuarterUnits ?? 0);
  const examQuarterUnits = creditTotals?.examQuarterUnits ??
    kept.filter(isExamClaim).reduce((total, claim) => total + claim.units, 0);
  const quarterUnits = courseworkQuarterUnits + examQuarterUnits;

  let points = 0;
  let gradedUnits = 0;
  let atAOrB = 0;
  let gradedCourses = 0;
  let lowestLetterGrade: Grade | undefined;

  for (const claim of kept) {
    if (claim.external) continue;
    if (!isGradedLetter(claim.grade)) continue;
    const grade = claim.grade as Grade;
    const value = gradeValue(grade);
    points += value * claim.units;
    gradedUnits += claim.units;
    gradedCourses += 1;
    // Yale's rule says "a letter grade of A or B" without saying whether B-
    // counts. We read B- as inside the B range, which is how most registrars
    // speak, and the UI states that reading so it can be checked rather than
    // trusted. Yale also counts course CREDITS; UCI courses are almost all four
    // units, so counting courses tracks it closely but is not identical.
    if (value >= gradeValue(A_OR_B_FLOOR)) atAOrB += 1;
    if (lowestLetterGrade === undefined || value < gradeValue(lowestLetterGrade)) {
      lowestLetterGrade = grade;
    }
  }

  return {
    lastTermId,
    lastTermLabel,
    claims: kept,
    regularQuartersCompleted: regular.size,
    summerTermsCompleted: summer.size,
    quarterUnits,
    semesterUnitsEquivalent: quarterToSemesterUnits(quarterUnits),
    courseworkQuarterUnits,
    examQuarterUnits,
    gpa: gradedUnits > 0 ? points / gradedUnits : undefined,
    gradedUnits,
    fractionAtAOrB: gradedCourses > 0 ? atAOrB / gradedCourses : undefined,
    lowestLetterGrade,
    passNoPassClaims: kept.filter((claim) =>
      claim.gradeBasis === 'pass_no_pass' ||
      claim.grade === 'P' || claim.grade === 'NP' || claim.grade === 'S' || claim.grade === 'U'
    ),
  };
}

// ------------------------------------------------------- satisfaction tree

interface Resolution {
  /** 'yes' when the tree is structurally satisfied by the claims used. */
  status: 'yes' | 'no' | 'unknown';
  used: Claim[];
  /** Weakest standing among the used claims. */
  standing: ClaimStanding;
  /** Codes named by the rule that are still missing. */
  missing: string[];
}

const STANDING_ORDER: Record<ClaimStanding, number> = { completed: 0, in_progress: 1, planned: 2 };

function standingOf(claim: Claim): ClaimStanding {
  if (claim.status === 'completed' || claim.status === 'waived') return 'completed';
  if (claim.status === 'in_progress') return 'in_progress';
  return 'planned';
}

function weakest(a: ClaimStanding, b: ClaimStanding): ClaimStanding {
  return STANDING_ORDER[a] >= STANDING_ORDER[b] ? a : b;
}

function matchesFilter(claim: Claim, filter: TransferCourseFilter, course?: Course): boolean {
  if (filter.codes && !filter.codes.includes(claim.code)) return false;
  if (filter.excludeCodes?.includes(claim.code)) return false;
  const department = course?.department ?? claim.department;
  if (filter.departments && !filter.departments.includes(department)) return false;
  if (filter.excludeDepartments?.includes(department)) return false;
  const numeric = course?.numericValue ?? claim.numericValue;
  if (filter.minNumber !== undefined && numeric < filter.minNumber) return false;
  if (filter.maxNumber !== undefined && numeric > filter.maxNumber) return false;
  return true;
}

function resolve(
  node: TransferSatisfaction,
  claims: Claim[],
  used: Set<string>,
  courseIndex: Map<string, Course>,
): Resolution {
  switch (node.kind) {
    case 'course': {
      const match = claims.find((claim) => claim.code === node.code && !used.has(claim.id));
      if (!match) return { status: 'no', used: [], standing: 'planned', missing: [node.code] };
      used.add(match.id);
      return { status: 'yes', used: [match], standing: standingOf(match), missing: [] };
    }

    case 'all_of': {
      const collected: Claim[] = [];
      const missing: string[] = [];
      let standing: ClaimStanding = 'completed';
      let status: Resolution['status'] = 'yes';
      for (const child of node.children) {
        const result = resolve(child, claims, used, courseIndex);
        collected.push(...result.used);
        missing.push(...result.missing);
        standing = weakest(standing, result.standing);
        if (result.status === 'no') status = 'no';
        else if (result.status === 'unknown' && status === 'yes') status = 'unknown';
      }
      return { status, used: collected, standing, missing };
    }

    case 'any_of': {
      // Try each branch on a scratch copy so a failed branch consumes nothing.
      let best: Resolution | undefined;
      let bestScratch: Set<string> | undefined;
      const missing: string[] = [];
      for (const child of node.children) {
        const scratch = new Set(used);
        const result = resolve(child, claims, scratch, courseIndex);
        if (result.status === 'no') {
          missing.push(...result.missing);
          continue;
        }
        const better =
          !best ||
          (best.status === 'unknown' && result.status === 'yes') ||
          (best.status === result.status && STANDING_ORDER[result.standing] < STANDING_ORDER[best.standing]);
        if (better) {
          best = result;
          bestScratch = scratch;
        }
      }
      if (best && bestScratch) {
        bestScratch.forEach((id) => used.add(id));
        return { ...best, missing: [] };
      }
      // Nothing matched: report the first branch's missing codes as the cheapest path.
      const firstChild = node.children[0];
      const firstBranch = firstChild
        ? resolve(firstChild, claims, new Set(used), courseIndex)
        : undefined;
      const cheapest = firstBranch && firstBranch.missing.length > 0 ? firstBranch.missing : missing;
      return { status: 'no', used: [], standing: 'planned', missing: cheapest };
    }

    case 'n_of': {
      const collected: Claim[] = [];
      const missing: string[] = [];
      let satisfied = 0;
      let standing: ClaimStanding = 'completed';
      for (const child of node.children) {
        if (satisfied >= node.n) break;
        const scratch = new Set(used);
        const result = resolve(child, claims, scratch, courseIndex);
        if (result.status === 'yes') {
          scratch.forEach((id) => used.add(id));
          collected.push(...result.used);
          standing = weakest(standing, result.standing);
          satisfied += 1;
        } else {
          missing.push(...result.missing);
        }
      }
      return satisfied >= node.n
        ? { status: 'yes', used: collected, standing, missing: [] }
        : { status: 'no', used: collected, standing, missing };
    }

    case 'course_range': {
      const matched: Claim[] = [];
      let standing: ClaimStanding = 'completed';
      for (const claim of claims) {
        if (matched.length >= node.n) break;
        if (used.has(claim.id)) continue;
        if (!matchesFilter(claim, node.filter, courseIndex.get(claim.code))) continue;
        used.add(claim.id);
        matched.push(claim);
        standing = weakest(standing, standingOf(claim));
      }
      return matched.length >= node.n
        ? { status: 'yes', used: matched, standing, missing: [] }
        : { status: 'no', used: matched, standing, missing: [node.filter.description] };
    }

    case 'external_evidence':
      return { status: 'unknown', used: [], standing: 'completed', missing: [] };
  }
}

// ------------------------------------------------------ requirement checks

function gradeMeets(grade: Grade | undefined, minimum: Grade): boolean {
  if (grade === undefined) return true; // ungraded yet — not a failure
  if (!isGradedLetter(grade)) return true;
  return gradeValue(grade) >= gradeValue(minimum);
}

export function checkRequirement(
  requirement: TransferRequirement,
  claims: Claim[],
  courseIndex: Map<string, Course>,
  /**
   * Claim ids already spoken for by this program's other requirements. Only
   * `additional: true` requirements are given a non-empty set — that is what
   * makes "one ADDITIONAL natural science" mean what the school means.
   */
  excludeClaimIds: ReadonlySet<string> = new Set(),
  policy: {
    examCreditMode?: 'accept_uci_equivalency' | TransferExamCreditPolicy['coursework'];
    forceLetterGrade?: boolean;
  } = {},
): RequirementCheck {
  const available = excludeClaimIds.size === 0
    ? claims
    : claims.filter((claim) => !excludeClaimIds.has(claim.id));
  if (requirement.appliesWhen?.kind === 'exam_credit_for') {
    const applies = available.some((claim) =>
      isExamClaim(claim) && requirement.appliesWhen!.courseCodes.includes(claim.code)
    );
    if (!applies) {
      return {
        requirement,
        state: 'complete',
        satisfiedBy: [],
        missingCodes: [],
        detail: 'Not applicable — no matching exam-derived credit is recorded in this plan.',
        applicable: false,
      };
    }
  }

  const examCreditMode = policy.examCreditMode ?? 'accept_uci_equivalency';
  const policyUsable = examCreditMode === 'accept_uci_equivalency'
    ? available
    : available.filter((claim) => !isExamClaim(claim));
  // A student-entered equivalency is useful planning evidence, but it is not
  // a confirmed articulation until an adviser/evaluator is recorded. Prefer
  // confirmed mappings and return `unknown` when an unverified mapping is the
  // only way to close the requirement.
  const directlyUsable = policyUsable.filter((claim) => claim.externalEquivalencyVerified !== false);
  const used = new Set<string>();
  const resolution = resolve(requirement.satisfiedBy, directlyUsable, used, courseIndex);

  if (resolution.status === 'no') {
    const withUnverified = resolve(requirement.satisfiedBy, policyUsable, new Set<string>(), courseIndex);
    const unverified = withUnverified.used.filter((claim) => claim.externalEquivalencyVerified === false);
    if (withUnverified.status === 'yes' && unverified.length > 0) {
      return {
        requirement,
        state: 'unknown',
        satisfiedBy: withUnverified.used,
        missingCodes: [],
        detail: `Potentially covered by ${unverified.map((claim) => claim.title).join(', ')}, but the UCI equivalency is not yet documented. Record adviser or evaluator verification before relying on it.`,
        applicable: true,
      };
    }
  }

  if (resolution.status === 'no' && examCreditMode !== 'accept_uci_equivalency') {
    const withExam = resolve(requirement.satisfiedBy, available, new Set<string>(), courseIndex);
    if (withExam.status === 'yes') {
      const examCodes = withExam.used.filter(isExamClaim).map((claim) => claim.code).join(', ');
      if (examCreditMode === 'manual_review') {
        return {
          requirement,
          state: 'unknown',
          satisfiedBy: withExam.used,
          missingCodes: [],
          detail: `UCI records exam-derived credit for ${examCodes}, but this destination must apply its own AP/IB table. Verify the score and target equivalency.`,
          applicable: true,
        };
      }
      return {
        requirement,
        state: 'unmet',
        satisfiedBy: withExam.used,
        missingCodes: resolution.missing,
        detail: `Exam-derived UCI credit (${examCodes}) does not earn transfer credit here; classroom coursework is still needed.`,
        applicable: true,
      };
    }
  }

  if (resolution.status === 'unknown') {
    const prompt =
      requirement.satisfiedBy.kind === 'external_evidence'
        ? requirement.satisfiedBy.prompt
        : 'This requirement depends on evidence the planner cannot see.';
    return {
      requirement,
      state: 'unknown',
      satisfiedBy: [],
      missingCodes: [],
      detail: prompt,
      applicable: true,
    };
  }

  if (resolution.status === 'no') {
    const anyProgress = resolution.used.length > 0;
    return {
      requirement,
      state: 'unmet',
      satisfiedBy: resolution.used,
      missingCodes: resolution.missing,
      detail: anyProgress
        ? `Partly covered. Still needed: ${resolution.missing.join(', ') || 'more coursework'}.`
        : `Not yet covered. Needed: ${resolution.missing.join(', ') || 'coursework'}.`,
      applicable: true,
    };
  }

  const belowMinimum = requirement.minGrade
    ? resolution.used.filter((claim) => !gradeMeets(claim.grade, requirement.minGrade as Grade))
    : [];

  if (belowMinimum.length > 0) {
    return {
      requirement,
      state: 'at_risk',
      satisfiedBy: resolution.used,
      missingCodes: [],
      detail: `Covered, but ${belowMinimum
        .map((claim) => `${claim.code} (${claim.grade})`)
        .join(', ')} is below the ${requirement.minGrade} this school requires.`,
      applicable: true,
    };
  }

  const requiresLetterGrade = requirement.letterGradeRequired || policy.forceLetterGrade;
  const invalidBasis = requiresLetterGrade
    ? resolution.used.filter((claim) =>
        claim.gradeBasis === 'pass_no_pass' ||
        claim.grade === 'P' || claim.grade === 'NP' || claim.grade === 'S' || claim.grade === 'U'
      )
    : [];
  if (invalidBasis.length > 0) {
    return {
      requirement,
      state: 'at_risk',
      satisfiedBy: resolution.used,
      missingCodes: [],
      detail: `Covered by ${resolution.used.map((claim) => claim.code).join(', ')}, but ${invalidBasis.map((claim) => claim.code).join(', ')} is Pass/No Pass or S/U and this requirement must be letter-graded.`,
      applicable: true,
    };
  }

  const state: RequirementState =
    resolution.standing === 'completed'
      ? 'complete'
      : resolution.standing === 'in_progress'
        ? 'in_progress'
        : 'planned';

  return {
    requirement,
    state,
    satisfiedBy: resolution.used,
    missingCodes: [],
    detail:
      state === 'complete'
        ? `Covered by ${resolution.used.map((claim) => claim.code).join(', ')}.`
        : `On the plan via ${resolution.used.map((claim) => claim.code).join(', ')}, not yet finished.`,
    applicable: true,
  };
}

// -------------------------------------------------------- eligibility

function unitRange(snapshot: TransferSnapshot, policy: TransferExamCreditPolicy): { min: number; max: number } {
  const classroom = quarterToSemesterUnits(snapshot.courseworkQuarterUnits);
  const withExam = classroom + quarterToSemesterUnits(snapshot.examQuarterUnits);
  return policy.units === 'excluded'
    ? { min: classroom, max: classroom }
    : { min: classroom, max: withExam };
}

function subjectGpa(snapshot: TransferSnapshot, departments: string[]): { gpa?: number; units: number } {
  const graded = snapshot.claims.filter((claim) =>
    !claim.external && departments.includes(claim.department) && isGradedLetter(claim.grade)
  );
  const units = graded.reduce((sum, claim) => sum + claim.units, 0);
  const points = graded.reduce((sum, claim) => sum + gradeValue(claim.grade) * claim.units, 0);
  return { gpa: units > 0 ? points / units : undefined, units };
}

function evaluateCheck(
  check: EligibilityCheck,
  snapshot: TransferSnapshot,
  examPolicy: TransferExamCreditPolicy,
): {
  status: EligibilityCheckResult['status'];
  detail: string;
} {
  switch (check.kind) {
    case 'min_quarters_completed': {
      const value = snapshot.regularQuartersCompleted;
      return value >= check.quarters
        ? { status: 'met', detail: `${value} regular quarters by ${snapshot.lastTermLabel}.` }
        : { status: 'not_met', detail: `${value} regular quarters by ${snapshot.lastTermLabel}; needs ${check.quarters}.` };
    }
    case 'max_quarters_completed': {
      const value = snapshot.regularQuartersCompleted;
      return value <= check.quarters
        ? { status: 'met', detail: `${value} regular quarters — within the ${check.quarters}-quarter ceiling.` }
        : { status: 'not_met', detail: `${value} regular quarters exceeds the ${check.quarters}-quarter ceiling. Transferring a term earlier would fix this.` };
    }
    case 'min_semester_units': {
      const range = unitRange(snapshot, examPolicy);
      if (range.min >= check.units) {
        return { status: 'met', detail: `${range.min.toFixed(1)} classroom semester-unit equivalent, excluding exam credit.` };
      }
      if (range.max < check.units) {
        return { status: 'not_met', detail: `${range.max.toFixed(1)} semester-unit equivalent even if all recorded exam credit is accepted; needs ${check.units}.` };
      }
      return { status: 'unknown', detail: `${range.min.toFixed(1)} classroom units; up to ${range.max.toFixed(1)} if the destination awards all recorded exam credit. Target review decides this threshold.` };
    }
    case 'max_semester_units': {
      const range = unitRange(snapshot, examPolicy);
      if (range.max <= check.units) {
        return { status: 'met', detail: `${range.max.toFixed(1)} semester-unit equivalent at most — within the ${check.units} ceiling.` };
      }
      if (range.min > check.units) {
        return { status: 'not_met', detail: `${range.min.toFixed(1)} classroom semester-unit equivalent exceeds the ${check.units}-unit ceiling even without exam credit.` };
      }
      return { status: 'unknown', detail: `${range.min.toFixed(1)} classroom units; up to ${range.max.toFixed(1)} with exam credit. Target treatment of exams decides the ${check.units}-unit ceiling.` };
    }
    case 'min_gpa': {
      if (snapshot.gpa === undefined) {
        return { status: 'unknown', detail: 'No letter-graded UCI work recorded yet.' };
      }
      return snapshot.gpa >= check.gpa
        ? { status: 'met', detail: `UCI GPA ${snapshot.gpa.toFixed(2)} meets the ${check.gpa.toFixed(2)} minimum.` }
        : { status: 'not_met', detail: `UCI GPA ${snapshot.gpa.toFixed(2)} is below the ${check.gpa.toFixed(2)} minimum.` };
    }
    case 'competitive_gpa': {
      if (snapshot.gpa === undefined) {
        return { status: 'unknown', detail: 'No letter-graded UCI work recorded yet.' };
      }
      return snapshot.gpa >= check.gpa
        ? { status: 'met', detail: `UCI GPA ${snapshot.gpa.toFixed(2)} is at or above the ${check.gpa.toFixed(2)} typical admit.` }
        : { status: 'not_met', detail: `UCI GPA ${snapshot.gpa.toFixed(2)} is below the ${check.gpa.toFixed(2)} typical admit — competitiveness, not eligibility.` };
    }
    case 'subject_gpa': {
      const value = subjectGpa(snapshot, check.departments);
      if (value.gpa === undefined) {
        return { status: 'unknown', detail: `No letter-graded ${check.label.toLowerCase()} coursework recorded yet.` };
      }
      const posture = check.competitive ? 'competitive benchmark' : 'minimum';
      return value.gpa >= check.gpa
        ? { status: 'met', detail: `${check.label} GPA ${value.gpa.toFixed(2)} across ${value.units} UCI units meets the ${check.gpa.toFixed(2)} ${posture}.` }
        : { status: 'not_met', detail: `${check.label} GPA ${value.gpa.toFixed(2)} is below the ${check.gpa.toFixed(2)} ${posture}.` };
    }
    case 'minimum_subject_grade': {
      const graded = snapshot.claims.filter((claim) =>
        !claim.external && check.departments.includes(claim.department) && isGradedLetter(claim.grade)
      );
      if (graded.length === 0) return { status: 'unknown', detail: `No letter-graded ${check.label.toLowerCase()} coursework recorded yet.` };
      const below = graded.filter((claim) => gradeValue(claim.grade) < gradeValue(check.grade));
      return below.length === 0
        ? { status: 'met', detail: `Every recorded ${check.label.toLowerCase()} grade meets the ${check.grade} floor.` }
        : { status: 'not_met', detail: `${below.map((claim) => `${claim.code} (${claim.grade})`).join(', ')} falls below the ${check.grade} floor.` };
    }
    case 'no_pass_no_pass': {
      const affected = snapshot.passNoPassClaims.filter((claim) =>
        !check.departments || check.departments.includes(claim.department)
      );
      return affected.length === 0
        ? { status: 'met', detail: `No Pass/No Pass or S/U ${check.label?.toLowerCase() ?? 'coursework'} is recorded.` }
        : { status: 'not_met', detail: `${affected.map((claim) => claim.code).join(', ')} is recorded Pass/No Pass or S/U.` };
    }
    case 'grade_distribution': {
      if (snapshot.fractionAtAOrB === undefined || snapshot.lowestLetterGrade === undefined) {
        return { status: 'unknown', detail: 'No letter-graded UCI work recorded yet.' };
      }
      const fractionOk = snapshot.fractionAtAOrB >= check.minFractionAB;
      const floorOk = gradeValue(snapshot.lowestLetterGrade) >= gradeValue(check.floorGrade);
      const percent = (snapshot.fractionAtAOrB * 100).toFixed(0);
      const reading = ` Counted over graded courses, with ${A_OR_B_FLOOR} read as inside the B range — confirm that reading with the school.`;
      if (fractionOk && floorOk) {
        return {
          status: 'met',
          detail: `${percent}% of graded courses at A or B, lowest grade ${snapshot.lowestLetterGrade}.${reading}`,
        };
      }
      const problems: string[] = [];
      if (!fractionOk) problems.push(`only ${percent}% at A or B (needs ${(check.minFractionAB * 100).toFixed(0)}%)`);
      if (!floorOk) problems.push(`lowest grade ${snapshot.lowestLetterGrade} is below ${check.floorGrade}`);
      return { status: 'not_met', detail: problems.join('; ') + '.' + reading };
    }
  }
}

export function evaluateEligibility(
  rules: EligibilityRule[],
  snapshot: TransferSnapshot,
  examPolicy: TransferExamCreditPolicy = DEFAULT_EXAM_CREDIT_POLICY,
): EligibilityCheckResult[] {
  return rules.map((rule) => {
    if (!rule.check) {
      return { rule, status: 'informational' as const, detail: rule.detail };
    }
    const outcome = evaluateCheck(rule.check, snapshot, examPolicy);
    return { rule, status: outcome.status, detail: outcome.detail };
  });
}

// ------------------------------------------------------------ program roll-up

export function evaluateProgram(
  institution: TransferInstitution,
  program: TransferProgram,
  snapshot: TransferSnapshot,
  courseIndex: Map<string, Course>,
): ProgramResult {
  const examPolicy = institution.examCreditPolicy ?? DEFAULT_EXAM_CREDIT_POLICY;
  // Two passes. Named requirements claim their courses first; only then do the
  // "additional" rules run, against what is left. Requirements never compete
  // otherwise — a physics course is allowed to satisfy both a target's physics
  // rule and its lab-science rule when the school lists them as alternatives.
  const ordinary = program.requirements.filter((requirement) => !requirement.additional);
  const additional = program.requirements.filter((requirement) => requirement.additional);

  const ordinaryChecks = ordinary.map((requirement) =>
    checkRequirement(requirement, snapshot.claims, courseIndex, new Set(), {
      examCreditMode: examPolicy.coursework,
      forceLetterGrade: program.requirementsMustBeLetterGraded,
    }),
  );
  const spokenFor = new Set(
    ordinaryChecks.flatMap((check) => check.satisfiedBy.map((claim) => claim.id)),
  );
  const additionalChecks = additional.map((requirement) =>
    checkRequirement(requirement, snapshot.claims, courseIndex, spokenFor, {
      examCreditMode: examPolicy.coursework,
      forceLetterGrade: program.requirementsMustBeLetterGraded,
    }),
  );

  // Restore the author's ordering so the UI reads like the source page.
  const byId = new Map(
    [...ordinaryChecks, ...additionalChecks].map((check) => [check.requirement.id, check]),
  );
  const requirementChecks = program.requirements
    .map((requirement) => byId.get(requirement.id))
    .filter((check): check is RequirementCheck => check !== undefined);

  // Institution-wide rules first, then the program's own, de-duplicated by id.
  const seenRules = new Set<string>();
  const rules = [...institution.institutionRules, ...program.eligibility.rules].filter((rule) => {
    if (seenRules.has(rule.id)) return false;
    seenRules.add(rule.id);
    return true;
  });
  const eligibilityResults = evaluateEligibility(rules, snapshot, examPolicy);

  const required = requirementChecks.filter((check) => check.applicable && check.requirement.necessity === 'required');
  const satisfiedStates: RequirementState[] = ['complete', 'in_progress', 'planned'];
  const requiredSatisfied = required.filter((check) => satisfiedStates.includes(check.state)).length;
  const blockingGaps = required.filter((check) => check.state === 'unmet' || check.state === 'at_risk');

  const failingRules = eligibilityResults.filter(
    (result) => result.status === 'not_met' && result.rule.severity === 'blocking',
  );
  const uncertainRules = eligibilityResults.filter(
    (result) => result.status === 'unknown' && result.rule.severity === 'blocking',
  );

  const eligibility: EligibilityStatus = program.eligibility.closedToTransfer
    ? 'closed'
    : failingRules.length > 0
      ? 'blocked'
      : uncertainRules.length > 0
        ? 'needs_review'
      : 'open';

  const coursework: CourseworkReadiness =
    required.length === 0
      ? 'none_published'
      : requiredSatisfied === required.length
        ? 'on_track'
        : requiredSatisfied === 0
          ? 'not_started'
          : 'gaps';

  // Eligibility dominates the headline, because no amount of coursework fixes a
  // closed major or a blown term ceiling.
  const readiness: ProgramReadiness =
    eligibility === 'closed'
      ? 'closed'
      : eligibility === 'blocked'
        ? 'ineligible'
        : eligibility === 'needs_review'
          ? 'needs_review'
        // A school that publishes no course list gets its own headline rather
        // than being folded into "on track". Counting those as on-track let the
        // summary claim 62 programs were satisfied when 19 of them had never
        // stated a requirement to satisfy.
        : coursework;

  // Suggestions come from required gaps first, then recommended ones.
  //
  // Several targets — CMU, Rice, Harvard, Stanford — publish no transfer course
  // list at all, so they have no required gaps to draw on. Those are exactly the
  // schools where a student most needs to be told what to take, so recommended
  // gaps feed the suggestion list too. Readiness still ignores them: what you
  // should take and what you must take are different claims.
  const recommendedGaps = requirementChecks.filter(
    (check) =>
      check.applicable &&
      check.requirement.necessity === 'recommended' &&
      (check.state === 'unmet' || check.state === 'at_risk'),
  );
  // `missingCodes` mixes real course codes with the prose description of an
  // open-ended rule ("two laboratory science courses"). Only the former can be
  // offered as a clickable course, so filter against the catalogue itself
  // rather than guessing from the string's shape.
  const suggestedCodes = [
    ...new Set(
      [...blockingGaps, ...recommendedGaps]
        .flatMap((check) => check.missingCodes)
        .filter((code) => courseIndex.has(code)),
    ),
  ];

  return {
    institution,
    program,
    coursework,
    eligibility,
    readiness,
    requirementChecks,
    eligibilityResults,
    failingRules,
    requiredTotal: required.length,
    requiredSatisfied,
    blockingGaps,
    suggestedCodes,
  };
}

export const READINESS_PRESENTATION: Record<ProgramReadiness, { icon: string; label: string; tone: string }> = {
  closed: { icon: '\u26D4', label: 'Closed to transfers', tone: 'error' },
  ineligible: { icon: '\u2717', label: 'Eligibility rule fails', tone: 'error' },
  needs_review: { icon: '?', label: 'Eligibility needs review', tone: 'unknown' },
  on_track: { icon: '\u2713', label: 'Coursework on track', tone: 'ok' },
  gaps: { icon: '\u25D0', label: 'Coursework gaps', tone: 'warn' },
  not_started: { icon: '\u25CB', label: 'Not started', tone: 'neutral' },
  none_published: { icon: '?', label: 'No published course list', tone: 'unknown' },
};

export const COURSEWORK_PRESENTATION: Record<CourseworkReadiness, { icon: string; label: string; tone: string }> = {
  on_track: { icon: '\u2713', label: 'Coursework on track', tone: 'ok' },
  gaps: { icon: '\u25D0', label: 'Coursework gaps', tone: 'warn' },
  not_started: { icon: '\u25CB', label: 'Coursework not started', tone: 'neutral' },
  none_published: { icon: '?', label: 'No published course list', tone: 'unknown' },
};

export const ELIGIBILITY_PRESENTATION: Record<EligibilityStatus, { icon: string; label: string; tone: string }> = {
  open: { icon: '\u2713', label: 'Eligibility rules clear', tone: 'ok' },
  needs_review: { icon: '?', label: 'Eligibility needs review', tone: 'unknown' },
  blocked: { icon: '\u2717', label: 'Blocked at this transfer point', tone: 'error' },
  closed: { icon: '\u26D4', label: 'Closed to transfers', tone: 'error' },
};
