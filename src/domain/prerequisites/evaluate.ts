import type { Grade, PrerequisiteExpr } from '../courses/types';
import { GRADE_POINTS } from '../courses/types';
import { normalizeCourseCode } from '../courses/codes';
import { sequenceOfTermId } from '../terms/terms';

/**
 * Three-valued prerequisite evaluation (04_PLANNING_AND_AUDIT_ENGINE.md).
 *
 * `unknown` is a first-class result — consent, class standing, placement, an
 * unparsed clause, or a missing transfer equivalency must not be silently
 * treated as either satisfied or unsatisfied.
 */

export type Trivalent = 'satisfied' | 'unsatisfied' | 'unknown';

/** How a requirement node is being evaluated with respect to the target term. */
export type TimingMode =
  /** Must be finished strictly before the target term. */
  | 'prerequisite'
  /** May be taken in the target term itself. */
  | 'concurrent';

export interface CourseRecord {
  code: string;
  termId?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'waived' | 'failed' | 'not_taken';
  grade?: Grade;
  /** True when supplied by an exam/transfer award rather than UCI enrollment. */
  external?: boolean;
  /**
   * Elective-only external credit supplies units but can never satisfy a course
   * prerequisite (04 — Prerequisite evaluation).
   */
  electiveOnly?: boolean;
}

export interface EvaluationContext {
  /** Every course the student has completed, is taking, or has planned. */
  records: CourseRecord[];
  /** Term the course under evaluation would be taken in. */
  targetTermId: string;
  /**
   * Evidence keys the student holds, e.g. `AP CALCULUS BC>=4`, `elwr`,
   * `lower_division_writing`. Matched case-insensitively against exam nodes.
   */
  satisfiedEvidenceKeys: Set<string>;
  /** Class standing at the target term, when derivable from planned units. */
  classStanding?: 'freshman' | 'sophomore' | 'junior' | 'senior';
  /** Prerequisite-waiver override ids keyed by course code. */
  waivedCourseCodes?: Set<string>;
}

export interface NodeExplanation {
  status: Trivalent;
  /**
   * True when the node is satisfied only because a course is *planned* and has
   * no recorded grade yet — reported as "planned", not "complete".
   */
  conditional: boolean;
  /** Short human sentence for this node. */
  label: string;
  /** Longer detail, e.g. which term supplies it or what grade is required. */
  detail?: string;
  /** Raw catalogue text when the node came from unparsed prose. */
  raw?: string;
  children?: NodeExplanation[];
  op: PrerequisiteExpr['op'];
}

export interface PrerequisiteResult {
  status: Trivalent;
  conditional: boolean;
  explanation: NodeExplanation | null;
  /** Flat list of the branches that are not yet met, for warning text. */
  missing: string[];
  /** Flat list of branches that could not be decided. */
  unresolved: string[];
}

function gradeMeetsMinimum(actual: Grade | undefined, minimum: Grade | undefined): Trivalent {
  if (!minimum) return 'satisfied';
  if (!actual) return 'unknown';

  // A Pass / Satisfactory mark meets a minimum only when the rule itself
  // accepts P or S; otherwise UCI needs a letter grade and we cannot decide.
  if (actual === 'P' || actual === 'S') {
    return minimum === 'P' || minimum === 'S' ? 'satisfied' : 'unknown';
  }
  const actualPoints = GRADE_POINTS[actual];
  const minPoints = GRADE_POINTS[minimum];
  if (actualPoints === undefined || minPoints === undefined) return 'unknown';
  return actualPoints >= minPoints ? 'satisfied' : 'unsatisfied';
}

interface CourseNodeOutcome {
  status: Trivalent;
  conditional: boolean;
  detail: string;
}

function evaluateCourseNode(
  code: string,
  minGrade: Grade | undefined,
  ctx: EvaluationContext,
  timing: TimingMode,
): CourseNodeOutcome {
  const normalized = normalizeCourseCode(code);

  if (ctx.waivedCourseCodes?.has(normalized)) {
    return { status: 'satisfied', conditional: false, detail: 'Waived by a recorded adviser override.' };
  }

  const targetSeq = sequenceOfTermId(ctx.targetTermId);
  const candidates = ctx.records.filter((r) => normalizeCourseCode(r.code) === normalized);

  if (candidates.length === 0) {
    return { status: 'unsatisfied', conditional: false, detail: `${normalized} is not in the plan.` };
  }

  // Starts null so the first real candidate always replaces the generic
  // fallback message, instead of losing a rank tie to it.
  let best: CourseNodeOutcome | null = null;

  for (const record of candidates) {
    // Elective-only external credit never clears a course prerequisite.
    if (record.electiveOnly) {
      best = mergeBest(best, {
        status: 'unsatisfied',
        conditional: false,
        detail: `${normalized} credit is elective-only and does not clear this prerequisite.`,
      });
      continue;
    }

    if (record.status === 'failed') {
      best = mergeBest(best, {
        status: 'unsatisfied',
        conditional: false,
        detail: `${normalized} was failed and does not satisfy this prerequisite.`,
      });
      continue;
    }
    if (record.status === 'not_taken') continue;

    // Exam / transfer equivalency has no term and is available from the start.
    if (record.external || record.status === 'waived') {
      const gradeCheck = minGrade ? 'unknown' : 'satisfied';
      best = mergeBest(best, {
        status: gradeCheck,
        conditional: false,
        detail:
          gradeCheck === 'satisfied'
            ? `Satisfied by external credit equivalent to ${normalized}.`
            : `External credit for ${normalized} carries no letter grade, so the minimum grade of ${minGrade} cannot be verified.`,
      });
      continue;
    }

    if (!record.termId) continue;
    const recordSeq = sequenceOfTermId(record.termId);

    const timingOk = timing === 'prerequisite' ? recordSeq < targetSeq : recordSeq <= targetSeq;
    if (!timingOk) {
      best = mergeBest(best, {
        status: 'unsatisfied',
        conditional: false,
        detail:
          timing === 'prerequisite'
            ? `${normalized} is planned in or after this term; a prerequisite must finish earlier.`
            : `${normalized} is planned after this term.`,
      });
      continue;
    }

    const gradeStatus = gradeMeetsMinimum(record.grade, minGrade);

    if (record.status === 'completed') {
      best = mergeBest(best, {
        status: gradeStatus,
        conditional: false,
        detail:
          gradeStatus === 'satisfied'
            ? `Completed ${normalized}${record.grade ? ` with ${record.grade}` : ''}.`
            : gradeStatus === 'unsatisfied'
              ? `${normalized} grade ${record.grade} is below the required minimum of ${minGrade}.`
              : `${normalized} is completed but has no recorded grade, so the minimum of ${minGrade} cannot be verified.`,
      });
      continue;
    }

    // Planned or in progress with no final grade: conditionally satisfied.
    const conditionalStatus: Trivalent = minGrade && record.grade === undefined ? 'satisfied' : gradeStatus;
    best = mergeBest(best, {
      status: conditionalStatus,
      conditional: true,
      detail: minGrade
        ? `${normalized} is planned earlier and must be finished with at least ${minGrade}.`
        : `${normalized} is planned earlier in the plan.`,
    });
  }

  return (
    best ?? {
      status: 'unsatisfied',
      conditional: false,
      detail: `${normalized} is not completed before this term.`,
    }
  );
}

/** satisfied > unknown > unsatisfied, preferring a non-conditional satisfaction. */
function mergeBest(a: CourseNodeOutcome | null, b: CourseNodeOutcome): CourseNodeOutcome {
  if (!a) return b;
  const rank = (o: CourseNodeOutcome) =>
    o.status === 'satisfied' ? (o.conditional ? 2 : 3) : o.status === 'unknown' ? 1 : 0;
  return rank(b) > rank(a) ? b : a;
}

const STANDING_RANK: Record<string, number> = { freshman: 1, sophomore: 2, junior: 3, senior: 4 };

function evaluateNode(
  expr: PrerequisiteExpr,
  ctx: EvaluationContext,
  timing: TimingMode,
): NodeExplanation {
  switch (expr.op) {
    case 'course': {
      const outcome = evaluateCourseNode(expr.code, expr.minGrade, ctx, timing);
      return {
        status: outcome.status,
        conditional: outcome.conditional,
        label: expr.minGrade ? `${expr.code} (minimum grade ${expr.minGrade})` : expr.code,
        detail: outcome.detail,
        op: 'course',
      };
    }

    case 'exam_or_placement': {
      const key = expr.key.toUpperCase();
      const held = Array.from(ctx.satisfiedEvidenceKeys).some((k) => k.toUpperCase() === key);
      return {
        status: held ? 'satisfied' : 'unknown',
        conditional: false,
        label: expr.raw,
        detail: held
          ? 'Satisfied by recorded exam or placement evidence.'
          : 'No exam or placement evidence recorded. Enter it in External Credit to resolve this.',
        raw: expr.raw,
        op: 'exam_or_placement',
      };
    }

    case 'standing': {
      if (!ctx.classStanding) {
        return {
          status: 'unknown',
          conditional: false,
          label: expr.raw,
          detail: 'Class standing at this term is not known.',
          raw: expr.raw,
          op: 'standing',
        };
      }
      const ok = (STANDING_RANK[ctx.classStanding] ?? 0) >= (STANDING_RANK[expr.value] ?? 0);
      return {
        status: ok ? 'satisfied' : 'unsatisfied',
        conditional: false,
        label: expr.raw,
        detail: ok
          ? `Projected ${ctx.classStanding} standing meets this requirement.`
          : `Projected ${ctx.classStanding} standing is below ${expr.value}.`,
        raw: expr.raw,
        op: 'standing',
      };
    }

    case 'consent':
      return {
        status: 'unknown',
        conditional: false,
        label: expr.raw,
        detail: `Requires ${expr.authority} consent, which this planner cannot verify.`,
        raw: expr.raw,
        op: 'consent',
      };

    case 'unknown':
      return {
        status: 'unknown',
        conditional: false,
        label: 'Needs manual review',
        detail: 'This clause could not be parsed automatically. Read the original catalogue text.',
        raw: expr.raw,
        op: 'unknown',
      };

    case 'and': {
      const children = expr.children.map((c) => evaluateNode(c, ctx, timing));
      const hasUnsatisfied = children.some((c) => c.status === 'unsatisfied');
      const hasUnknown = children.some((c) => c.status === 'unknown');
      const status: Trivalent = hasUnsatisfied ? 'unsatisfied' : hasUnknown ? 'unknown' : 'satisfied';
      return {
        status,
        conditional: status === 'satisfied' && children.some((c) => c.conditional),
        label: 'All of the following',
        children,
        op: 'and',
      };
    }

    case 'or': {
      const children = expr.children.map((c) => evaluateNode(c, ctx, timing));
      const firmSatisfied = children.some((c) => c.status === 'satisfied' && !c.conditional);
      const anySatisfied = children.some((c) => c.status === 'satisfied');
      const hasUnknown = children.some((c) => c.status === 'unknown');
      const status: Trivalent = anySatisfied ? 'satisfied' : hasUnknown ? 'unknown' : 'unsatisfied';
      return {
        status,
        conditional: anySatisfied && !firmSatisfied,
        label: 'At least one of the following',
        children,
        op: 'or',
      };
    }

    case 'n_of': {
      const children = expr.children.map((c) => evaluateNode(c, ctx, timing));
      const satisfiedCount = children.filter((c) => c.status === 'satisfied').length;
      const possibleCount = satisfiedCount + children.filter((c) => c.status === 'unknown').length;
      const status: Trivalent =
        satisfiedCount >= expr.n ? 'satisfied' : possibleCount >= expr.n ? 'unknown' : 'unsatisfied';
      return {
        status,
        conditional:
          status === 'satisfied' &&
          children.filter((c) => c.status === 'satisfied' && !c.conditional).length < expr.n,
        label: `At least ${expr.n} of the following`,
        detail: `${satisfiedCount} of ${expr.n} satisfied.`,
        children,
        op: 'n_of',
      };
    }
  }
}

function collectLeaves(node: NodeExplanation, predicate: (n: NodeExplanation) => boolean): string[] {
  if (node.children && node.children.length > 0) {
    // For an OR that is already satisfied, its unmet branches are not "missing".
    if (node.op === 'or' && node.status === 'satisfied') return [];
    return node.children.flatMap((c) => collectLeaves(c, predicate));
  }
  return predicate(node) ? [node.detail ?? node.label] : [];
}

/**
 * Evaluate a prerequisite (or corequisite/concurrent) expression against a plan.
 */
export function evaluatePrerequisite(
  expr: PrerequisiteExpr | undefined,
  ctx: EvaluationContext,
  timing: TimingMode = 'prerequisite',
): PrerequisiteResult {
  if (!expr) {
    return { status: 'satisfied', conditional: false, explanation: null, missing: [], unresolved: [] };
  }
  const explanation = evaluateNode(expr, ctx, timing);
  return {
    status: explanation.status,
    conditional: explanation.conditional,
    explanation,
    missing: collectLeaves(explanation, (n) => n.status === 'unsatisfied'),
    unresolved: collectLeaves(explanation, (n) => n.status === 'unknown'),
  };
}

/**
 * Combined assessment for placing `course` into `targetTermId`: prerequisites
 * must precede the term, corequisites and concurrent rules may share it.
 */
export interface EligibilityAssessment {
  prerequisite: PrerequisiteResult;
  corequisite: PrerequisiteResult;
  concurrent: PrerequisiteResult;
  /** Worst status across all three. */
  overall: Trivalent;
  conditional: boolean;
}

export function assessEligibility(
  exprs: {
    prerequisiteExpr?: PrerequisiteExpr;
    corequisiteExpr?: PrerequisiteExpr;
    concurrentExpr?: PrerequisiteExpr;
  },
  ctx: EvaluationContext,
): EligibilityAssessment {
  const prerequisite = evaluatePrerequisite(exprs.prerequisiteExpr, ctx, 'prerequisite');
  const corequisite = evaluatePrerequisite(exprs.corequisiteExpr, ctx, 'concurrent');
  const concurrent = evaluatePrerequisite(exprs.concurrentExpr, ctx, 'concurrent');

  const all = [prerequisite, corequisite, concurrent];
  const overall: Trivalent = all.some((r) => r.status === 'unsatisfied')
    ? 'unsatisfied'
    : all.some((r) => r.status === 'unknown')
      ? 'unknown'
      : 'satisfied';

  return {
    prerequisite,
    corequisite,
    concurrent,
    overall,
    conditional: overall === 'satisfied' && all.some((r) => r.conditional),
  };
}

/** Flatten an explanation tree into readable indented lines. */
export function explanationToLines(node: NodeExplanation, depth = 0): string[] {
  const marker = node.status === 'satisfied' ? '✓' : node.status === 'unsatisfied' ? '✗' : '?';
  const indent = '  '.repeat(depth);
  const lines = [`${indent}${marker} ${node.label}${node.detail ? ` — ${node.detail}` : ''}`];
  for (const child of node.children ?? []) lines.push(...explanationToLines(child, depth + 1));
  return lines;
}
