import type { Course, Grade, GeCategory } from '../courses/types';
import { GRADE_POINTS, isGradedLetter } from '../courses/types';
import { normalizeCourseCode } from '../courses/codes';
import type { CourseStatus, CreditSource, GradeBasis, PinnedAllocation, PlanOverride } from '../plan/types';
import type {
  CourseFilter,
  Requirement,
  RequirementProgram,
  RequirementState,
  SharingPolicy,
} from './types';

/**
 * Deterministic requirement allocation solver.
 *
 * 04_PLANNING_AND_AUDIT_ENGINE.md — Requirement allocation:
 *   1. find every eligible requirement claim for each course;
 *   2. apply required named courses before broad elective ranges;
 *   3. maximize completed requirements without violating sharing policies;
 *   4. avoid consuming a course in an elective bucket when a stricter rule needs it;
 *   5. store a deterministic result;
 *   6. let the user pin a different valid allocation.
 *
 * Sharing is enforced through exclusion groups: two leaves that share a group
 * cannot both claim one course, unless that course appears in *both* leaves'
 * `sharingExceptions` — which is exactly the COMPSCI 145 Flexible Core / Project
 * case.
 */

export interface Claim {
  /** Planned-course id, or a synthetic id for an external award. */
  id: string;
  code: string;
  units: number;
  status: CourseStatus;
  grade?: Grade;
  gradeBasis?: GradeBasis;
  /** True for exam / transfer credit — never enters a GPA. */
  external: boolean;
  /**
   * The evidence source. Transfer evaluation needs this distinction because a
   * target may accept classroom transfer work while refusing AP/IB credit.
   * Older callers may omit it; `external` remains the compatibility fallback.
   */
  source?: CreditSource;
  /**
   * Whether a manually entered external-course equivalency has documentary
   * confirmation. `false` means the course may be displayed, but a transfer
   * target must not treat the mapping as settled.
   */
  externalEquivalencyVerified?: boolean;
  /** Exam metadata retained so target-specific conditional rules can be tested. */
  externalExamKey?: string;
  externalExamSystem?: 'ap' | 'ib' | 'a_level' | 'other';
  termId?: string;
  department: string;
  numericValue: number;
  level: Course['level'];
  geCategories: GeCategory[];
  /** GE categories this course may use only one of, e.g. ["Va","Vb"]. */
  geExclusiveSets: GeCategory[][];
  title: string;
}

export interface RequirementResult {
  requirementId: string;
  title: string;
  description?: string;
  state: RequirementState;
  /** Claims allocated to this requirement. */
  satisfiedBy: Claim[];
  /** How many selections the rule needs, when countable. */
  needed: number;
  satisfied: number;
  /** Human sentence explaining the current state. */
  detail: string;
  sourceUrl: string;
  catalogueYear: string;
  verificationNote?: string;
  children?: RequirementResult[];
  /** Codes that would advance this requirement, for "add a course" actions. */
  suggestedCodes?: string[];
  /** True when an adviser override is what makes this requirement count. */
  viaOverride?: boolean;
}

export interface ProgramResult {
  programId: string;
  title: string;
  category: RequirementProgram['category'];
  sourceUrl: string;
  state: RequirementState;
  requirements: RequirementResult[];
  /** Fraction 0..1 of leaf selections satisfied, for a progress bar. */
  progress: number;
}

export interface AllocationInput {
  programs: RequirementProgram[];
  claims: Claim[];
  courseIndex: Map<string, Course>;
  pinnedAllocations?: PinnedAllocation[];
  overrides?: PlanOverride[];
  /** Evidence keys satisfied outside coursework, e.g. "elwr". */
  satisfiedEvidenceKeys?: Set<string>;
  /** Explicit code list for the CS nine-elective rule. */
  csElectiveAllowedCodes?: string[];
}

export interface AllocationOutput {
  programs: ProgramResult[];
  /** claimId -> requirement ids that consumed it, for "shared" badges. */
  claimUsage: Map<string, string[]>;
}

// ---------------------------------------------------------------------------
// Ledger — tracks which requirement leaves have consumed which claims.
// ---------------------------------------------------------------------------

interface Assignment {
  requirementId: string;
  sharing: SharingPolicy;
  /** For GE leaves: which category was consumed, so Va/Vb can conflict. */
  geCategory?: GeCategory;
}

class Ledger {
  private readonly byClaim = new Map<string, Assignment[]>();

  /** Can this requirement also claim the course, given what already holds it? */
  canClaim(claimId: string, code: string, sharing: SharingPolicy, requirementId: string): boolean {
    const existing = this.byClaim.get(claimId);
    if (!existing || existing.length === 0) return true;

    // A course can never fill two slots of the same requirement.
    if (existing.some((prior) => prior.requirementId === requirementId)) return false;

    for (const prior of existing) {
      const overlaps = prior.sharing.exclusionGroups.some((g) => sharing.exclusionGroups.includes(g));
      if (!overlaps) continue;

      // The one documented escape hatch: both leaves must list the course.
      const priorAllows = prior.sharing.sharingExceptions?.includes(code) ?? false;
      const selfAllows = sharing.sharingExceptions?.includes(code) ?? false;
      if (priorAllows && selfAllows) continue;

      return false;
    }
    return true;
  }

  assign(claimId: string, requirementId: string, sharing: SharingPolicy, geCategory?: GeCategory): void {
    const list = this.byClaim.get(claimId) ?? [];
    const entry: Assignment = { requirementId, sharing };
    if (geCategory) entry.geCategory = geCategory;
    list.push(entry);
    this.byClaim.set(claimId, list);
  }

  usage(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [claimId, assignments] of this.byClaim) {
      out.set(claimId, assignments.map((a) => a.requirementId));
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Claim eligibility
// ---------------------------------------------------------------------------

/** A claim only counts if the work was actually (or will be) earned. */
function isCountableStatus(status: CourseStatus): boolean {
  return status === 'completed' || status === 'in_progress' || status === 'planned' || status === 'waived';
}

function stateForClaims(claims: Claim[], needed: number): RequirementState {
  if (claims.length < needed) return 'unmet';
  if (claims.every((c) => c.status === 'completed' || c.status === 'waived')) return 'complete';
  if (claims.some((c) => c.status === 'in_progress')) return 'in_progress';
  return 'planned';
}

/** Does the claim's grade satisfy the requirement's grade policy? */
function gradePolicyOk(claim: Claim, requirement: Requirement): boolean {
  const policy = requirement.grade;

  if (claim.external) return policy.allowExternalCredit;

  if (claim.gradeBasis === 'pass_no_pass' && !policy.allowPassNoPass) return false;

  if (policy.minGrade && claim.grade) {
    const actual = GRADE_POINTS[claim.grade];
    const minimum = GRADE_POINTS[policy.minGrade];
    if (actual !== undefined && minimum !== undefined && actual < minimum) return false;
  }
  // A planned course with no grade yet stays eligible; the state reflects that
  // it is "planned" rather than "complete".
  return true;
}

function matchesFilter(claim: Claim, filter: CourseFilter, allowedCodes?: string[]): boolean {
  if (allowedCodes && !allowedCodes.includes(claim.code)) return false;
  if (filter.departments && !filter.departments.includes(claim.department)) return false;
  if (filter.excludeDepartments?.includes(claim.department)) return false;
  if (filter.excludeOfferedBy?.includes(claim.department)) return false;
  if (filter.excludeCodes?.includes(claim.code)) return false;
  if (filter.minNumber !== undefined && claim.numericValue < filter.minNumber) return false;
  if (filter.maxNumber !== undefined && claim.numericValue > filter.maxNumber) return false;
  if (filter.unitsExactly !== undefined && claim.units !== filter.unitsExactly) return false;
  if (filter.levels && !filter.levels.includes(claim.level)) return false;
  if (filter.geCategories && !filter.geCategories.some((g) => claim.geCategories.includes(g))) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Distinct-group matching (CS Flexible Core)
// ---------------------------------------------------------------------------

/**
 * Maximum bipartite matching between claims and focus-area groups, so four
 * courses from four *distinct* areas complete the rule while four courses from
 * three areas do not (criteria 29 and 30).
 */
function matchDistinctGroups(
  candidates: Array<{ claim: Claim; groupIds: string[] }>,
  groupIds: string[],
): Map<string, Claim> {
  const groupToClaim = new Map<string, Claim>();
  const claimToGroup = new Map<string, string>();

  const tryAssign = (index: number, visited: Set<string>): boolean => {
    const candidate = candidates[index];
    if (!candidate) return false;
    for (const groupId of candidate.groupIds) {
      if (!groupIds.includes(groupId) || visited.has(groupId)) continue;
      visited.add(groupId);
      const holder = groupToClaim.get(groupId);
      if (!holder) {
        groupToClaim.set(groupId, candidate.claim);
        claimToGroup.set(candidate.claim.id, groupId);
        return true;
      }
      const holderIndex = candidates.findIndex((c) => c.claim.id === holder.id);
      if (holderIndex >= 0 && tryAssign(holderIndex, visited)) {
        groupToClaim.set(groupId, candidate.claim);
        claimToGroup.set(candidate.claim.id, groupId);
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < candidates.length; i += 1) {
    tryAssign(i, new Set<string>());
  }
  return groupToClaim;
}

// ---------------------------------------------------------------------------
// Leaf evaluation
// ---------------------------------------------------------------------------

interface SolveContext {
  ledger: Ledger;
  claims: Claim[];
  pinned: Map<string, string[]>;
  overrides: PlanOverride[];
  evidenceKeys: Set<string>;
  csElectiveAllowedCodes?: string[];
  /** Filled in by aggregate rules after coursework allocation. */
  totalUnits: number;
  gpaData: Claim[];
}

function eligibleClaims(
  ctx: SolveContext,
  requirement: Requirement,
  predicate: (claim: Claim) => boolean,
): Claim[] {
  const pinnedIds = ctx.pinned.get(requirement.id);

  const usable = ctx.claims.filter(
    (claim) =>
      isCountableStatus(claim.status) &&
      predicate(claim) &&
      gradePolicyOk(claim, requirement) &&
      ctx.ledger.canClaim(claim.id, claim.code, requirement.sharing, requirement.id),
  );

  if (!pinnedIds || pinnedIds.length === 0) return usable;

  // A pinned allocation wins: pinned claims first, in the user's order.
  const pinnedFirst = pinnedIds
    .map((id) => usable.find((c) => c.id === id))
    .filter((c): c is Claim => Boolean(c));
  const rest = usable.filter((c) => !pinnedIds.includes(c.id));
  return [...pinnedFirst, ...rest];
}

/** Prefer completed work, then in-progress, then planned; stable by code. */
function claimPriority(a: Claim, b: Claim): number {
  const rank = (c: Claim) =>
    c.status === 'completed' ? 0 : c.status === 'waived' ? 1 : c.status === 'in_progress' ? 2 : 3;
  return rank(a) - rank(b) || a.code.localeCompare(b.code);
}

function take(ctx: SolveContext, requirement: Requirement, pool: Claim[], n: number, geCategory?: GeCategory): Claim[] {
  const chosen: Claim[] = [];
  for (const claim of [...pool].sort(claimPriority)) {
    if (chosen.length >= n) break;
    if (!ctx.ledger.canClaim(claim.id, claim.code, requirement.sharing, requirement.id)) continue;
    ctx.ledger.assign(claim.id, requirement.id, requirement.sharing, geCategory);
    chosen.push(claim);
  }
  return chosen;
}

function baseResult(requirement: Requirement, extra: Partial<RequirementResult>): RequirementResult {
  const result: RequirementResult = {
    requirementId: requirement.id,
    title: requirement.title,
    state: 'unmet',
    satisfiedBy: [],
    needed: 1,
    satisfied: 0,
    detail: '',
    sourceUrl: requirement.sourceUrl,
    catalogueYear: requirement.catalogueYear,
    ...extra,
  };
  if (requirement.description) result.description = requirement.description;
  if (requirement.verificationNote) result.verificationNote = requirement.verificationNote;
  return result;
}

function overrideFor(ctx: SolveContext, requirementId: string): PlanOverride | undefined {
  return ctx.overrides.find((o) => o.targetId === requirementId);
}

function solveRequirement(ctx: SolveContext, requirement: Requirement): RequirementResult {
  const rule = requirement.rule;

  switch (rule.kind) {
    case 'course': {
      const code = normalizeCourseCode(rule.code);
      const pool = eligibleClaims(ctx, requirement, (c) => c.code === code);
      const chosen = take(ctx, requirement, pool, 1);
      const state = chosen.length > 0 ? stateForClaims(chosen, 1) : 'unmet';
      return baseResult(requirement, {
        state,
        satisfiedBy: chosen,
        needed: 1,
        satisfied: chosen.length,
        suggestedCodes: chosen.length ? [] : [code],
        detail:
          chosen.length > 0
            ? describeClaims(chosen)
            : `${code} is not yet in the plan.`,
      });
    }

    case 'course_pair': {
      const codes = rule.codes.map(normalizeCourseCode);
      const chosen: Claim[] = [];
      for (const code of codes) {
        const pool = eligibleClaims(ctx, requirement, (c) => c.code === code);
        chosen.push(...take(ctx, requirement, pool, 1));
      }
      const complete = chosen.length === codes.length;
      return baseResult(requirement, {
        state: complete ? stateForClaims(chosen, codes.length) : 'unmet',
        satisfiedBy: chosen,
        needed: codes.length,
        satisfied: chosen.length,
        suggestedCodes: codes.filter((c) => !chosen.some((x) => x.code === c)),
        detail: complete
          ? describeClaims(chosen)
          : `Both ${codes.join(' and ')} are required together. Missing: ${codes
              .filter((c) => !chosen.some((x) => x.code === c))
              .join(', ')}.`,
      });
    }

    case 'choose_n_courses': {
      const options = rule.options.map(normalizeCourseCode);
      const pool = eligibleClaims(ctx, requirement, (c) => options.includes(c.code));
      const chosen = take(ctx, requirement, pool, rule.n);
      return baseResult(requirement, {
        state: chosen.length >= rule.n ? stateForClaims(chosen, rule.n) : chosen.length > 0 ? 'unmet' : 'unmet',
        satisfiedBy: chosen,
        needed: rule.n,
        satisfied: chosen.length,
        suggestedCodes: options.filter((c) => !chosen.some((x) => x.code === c)).slice(0, 12),
        detail:
          chosen.length >= rule.n
            ? describeClaims(chosen)
            : `${chosen.length} of ${rule.n} selected. Choose from: ${options.slice(0, 8).join(', ')}${options.length > 8 ? ', …' : ''}.`,
      });
    }

    case 'choose_n_distinct_groups': {
      const groupIds = rule.groups.map((g) => g.id);
      const candidates = ctx.claims
        .filter(
          (claim) =>
            isCountableStatus(claim.status) &&
            gradePolicyOk(claim, requirement) &&
            ctx.ledger.canClaim(claim.id, claim.code, requirement.sharing, requirement.id),
        )
        .map((claim) => ({
          claim,
          groupIds: rule.groups.filter((g) => g.courses.map(normalizeCourseCode).includes(claim.code)).map((g) => g.id),
        }))
        .filter((c) => c.groupIds.length > 0)
        .sort((a, b) => claimPriority(a.claim, b.claim));

      const matching = matchDistinctGroups(candidates, groupIds);
      const chosen: Claim[] = [];
      const usedGroups: string[] = [];

      for (const [groupId, claim] of matching) {
        if (chosen.length >= rule.n) break;
        if (!ctx.ledger.canClaim(claim.id, claim.code, requirement.sharing, requirement.id)) continue;
        ctx.ledger.assign(claim.id, requirement.id, requirement.sharing);
        chosen.push(claim);
        usedGroups.push(groupId);
      }

      const distinct = usedGroups.length;
      const groupTitles = usedGroups
        .map((id) => rule.groups.find((g) => g.id === id)?.title ?? id)
        .sort();

      // Courses present that could not add a new distinct area.
      const surplus = candidates.filter((c) => !chosen.some((x) => x.id === c.claim.id)).map((c) => c.claim.code);

      return baseResult(requirement, {
        state: distinct >= rule.n ? stateForClaims(chosen, rule.n) : 'unmet',
        satisfiedBy: chosen,
        needed: rule.n,
        satisfied: distinct,
        suggestedCodes: rule.groups
          .filter((g) => !usedGroups.includes(g.id))
          .flatMap((g) => g.courses)
          .slice(0, 12),
        detail:
          distinct >= rule.n
            ? `${distinct} distinct focus areas: ${groupTitles.join('; ')}.`
            : `${distinct} of ${rule.n} distinct focus areas covered${groupTitles.length ? ` (${groupTitles.join('; ')})` : ''}.` +
              (surplus.length
                ? ` ${surplus.join(', ')} ${surplus.length === 1 ? 'repeats an area already' : 'repeat areas already'} covered, so ${surplus.length === 1 ? 'it does' : 'they do'} not add a new one.`
                : ''),
      });
    }

    case 'course_range': {
      const allowedCodes = requirement.id === 'cs.upper.electives' ? ctx.csElectiveAllowedCodes : undefined;
      const pool = eligibleClaims(ctx, requirement, (c) => matchesFilter(c, rule.filter, allowedCodes));
      const chosen = take(ctx, requirement, pool, rule.n);
      return baseResult(requirement, {
        state: chosen.length >= rule.n ? stateForClaims(chosen, rule.n) : 'unmet',
        satisfiedBy: chosen,
        needed: rule.n,
        satisfied: chosen.length,
        detail:
          chosen.length >= rule.n
            ? describeClaims(chosen)
            : `${chosen.length} of ${rule.n} courses allocated.`,
      });
    }

    case 'ge_category': {
      const category = rule.category;
      const pool = eligibleClaims(ctx, requirement, (c) => c.geCategories.includes(category));
      const chosen = take(ctx, requirement, pool, rule.n, category);
      return baseResult(requirement, {
        state: chosen.length >= rule.n ? stateForClaims(chosen, rule.n) : 'unmet',
        satisfiedBy: chosen,
        needed: rule.n,
        satisfied: chosen.length,
        detail:
          chosen.length >= rule.n
            ? describeClaims(chosen)
            : `${chosen.length} of ${rule.n} GE ${category} courses allocated.`,
      });
    }

    case 'all_of': {
      const children = rule.children.map((child) => solveRequirement(ctx, child));
      const complete = children.filter((c) => c.state === 'complete').length;
      const met = children.filter((c) => c.state !== 'unmet' && c.state !== 'at_risk').length;
      const state: RequirementState =
        children.every((c) => c.state === 'complete')
          ? 'complete'
          : children.some((c) => c.state === 'in_progress')
            ? 'in_progress'
            : met === children.length
              ? 'planned'
              : 'unmet';
      return baseResult(requirement, {
        state,
        children,
        needed: children.length,
        satisfied: met,
        satisfiedBy: children.flatMap((c) => c.satisfiedBy),
        detail: `${complete} of ${children.length} complete, ${met} of ${children.length} planned or better.`,
      });
    }

    case 'any_of': {
      // Choose the branch with the most coverage *before* committing claims,
      // so an unused alternative never consumes courses another rule needs.
      const previews = rule.children.map((child) => {
        const sandbox: SolveContext = { ...ctx, ledger: new Ledger() };
        return { child, result: solveRequirement(sandbox, child) };
      });
      const rank = (r: RequirementResult) =>
        (r.state === 'complete' ? 3000 : r.state === 'in_progress' ? 2000 : r.state === 'planned' ? 1000 : 0) +
        r.satisfied * 10 - r.needed;
      previews.sort((a, b) => rank(b.result) - rank(a.result));

      const best = previews[0];
      if (!best) {
        return baseResult(requirement, { state: 'unmet', detail: 'No options defined.' });
      }
      // Re-solve the winning branch against the real ledger to commit it.
      const committed = solveRequirement(ctx, best.child);
      return baseResult(requirement, {
        state: committed.state,
        children: [committed, ...previews.slice(1).map((p) => ({ ...p.result, satisfiedBy: [] }))],
        needed: 1,
        satisfied: committed.state === 'unmet' ? 0 : 1,
        satisfiedBy: committed.satisfiedBy,
        detail:
          committed.state === 'unmet'
            ? `No option is complete yet. Closest: ${committed.title} (${committed.satisfied} of ${committed.needed}).`
            : `Using: ${committed.title}.`,
      });
    }

    case 'choose_n': {
      const children = rule.children.map((child) => {
        const sandbox: SolveContext = { ...ctx, ledger: new Ledger() };
        return { child, preview: solveRequirement(sandbox, child) };
      });
      // Commit the strongest children first, up to n.
      const rank = (r: RequirementResult) =>
        (r.state === 'complete' ? 3 : r.state === 'in_progress' ? 2 : r.state === 'planned' ? 1 : 0);
      children.sort((a, b) => rank(b.preview) - rank(a.preview));

      const committed: RequirementResult[] = [];
      for (const { child } of children) {
        if (committed.filter((c) => c.state !== 'unmet').length >= rule.n) break;
        const result = solveRequirement(ctx, child);
        if (result.state !== 'unmet') committed.push(result);
      }
      const satisfied = committed.length;
      return baseResult(requirement, {
        state: satisfied >= rule.n ? stateForClaims(committed.flatMap((c) => c.satisfiedBy), 1) : 'unmet',
        children: committed,
        needed: rule.n,
        satisfied,
        satisfiedBy: committed.flatMap((c) => c.satisfiedBy),
        detail:
          satisfied >= rule.n
            ? committed.map((c) => c.title).join(', ')
            : `${satisfied} of ${rule.n} selections made.`,
      });
    }

    case 'min_units': {
      const relevant = rule.filter
        ? ctx.claims.filter((c) => isCountableStatus(c.status) && matchesFilter(c, rule.filter!))
        : ctx.claims.filter((c) => isCountableStatus(c.status));
      const total = relevant.reduce((sum, c) => sum + c.units, 0);
      const earned = relevant
        .filter((c) => c.status === 'completed' || c.status === 'waived')
        .reduce((sum, c) => sum + c.units, 0);
      return baseResult(requirement, {
        state: earned >= rule.units ? 'complete' : total >= rule.units ? 'planned' : 'unmet',
        needed: rule.units,
        satisfied: Math.round(total * 10) / 10,
        satisfiedBy: [],
        detail: `${earned} units earned, ${Math.round(total * 10) / 10} projected of ${rule.units} required.`,
      });
    }

    case 'gpa': {
      const graded = ctx.claims.filter(
        (c) =>
          !c.external &&
          c.status === 'completed' &&
          isGradedLetter(c.grade) &&
          c.gradeBasis !== 'pass_no_pass' &&
          matchesFilter(c, rule.filter),
      );
      if (graded.length === 0) {
        return baseResult(requirement, {
          state: 'unknown',
          needed: rule.minimum,
          satisfied: 0,
          detail: 'No completed letter-graded courses yet, so this GPA cannot be calculated.',
        });
      }
      const points = graded.reduce((sum, c) => sum + (GRADE_POINTS[c.grade!] ?? 0) * c.units, 0);
      const units = graded.reduce((sum, c) => sum + c.units, 0);
      const gpa = units > 0 ? points / units : 0;
      return baseResult(requirement, {
        state: gpa >= rule.minimum ? 'complete' : 'at_risk',
        needed: rule.minimum,
        satisfied: Math.round(gpa * 100) / 100,
        detail: `${gpa.toFixed(2)} across ${units} graded units (minimum ${rule.minimum.toFixed(1)}). Exam and P/NP credit excluded.`,
      });
    }

    case 'residence': {
      // Future course origin and modality are not published, so this stays
      // "needs verification" rather than showing a false checkmark.
      return baseResult(requirement, {
        state: 'unknown',
        needed: 1,
        satisfied: 0,
        detail:
          'Projected residence and modality status cannot yet be verified because future term modality is not published.',
      });
    }

    case 'external_evidence': {
      const held = ctx.evidenceKeys.has(rule.key);
      return baseResult(requirement, {
        state: held ? 'complete' : 'unknown',
        needed: 1,
        satisfied: held ? 1 : 0,
        detail: held
          ? 'Satisfied by recorded evidence.'
          : 'No evidence recorded yet. Enter it in Settings or External Credit.',
      });
    }

    case 'advisor_confirmation': {
      const override = overrideFor(ctx, requirement.id);
      return baseResult(requirement, {
        state: override ? 'complete' : 'unknown',
        needed: 1,
        satisfied: override ? 1 : 0,
        viaOverride: Boolean(override),
        detail: override
          ? `Confirmed: ${override.note}`
          : 'Requires confirmation from an academic adviser. This planner cannot verify it.',
      });
    }
  }
}

function describeClaims(claims: Claim[]): string {
  return claims
    .map((c) => {
      const status =
        c.status === 'completed'
          ? c.grade
            ? `completed, ${c.grade}`
            : 'completed'
          : c.status === 'in_progress'
            ? 'in progress'
            : c.status === 'waived'
              ? 'waived'
              : c.external
                ? 'external credit'
                : 'planned';
      return `${c.code} (${status})`;
    })
    .join(', ');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function allocate(input: AllocationInput): AllocationOutput {
  const ledger = new Ledger();
  const ctx: SolveContext = {
    ledger,
    claims: input.claims,
    pinned: new Map((input.pinnedAllocations ?? []).map((p) => [p.requirementId, p.claimIds])),
    overrides: input.overrides ?? [],
    evidenceKeys: input.satisfiedEvidenceKeys ?? new Set(),
    totalUnits: 0,
    gpaData: input.claims,
  };
  if (input.csElectiveAllowedCodes) ctx.csElectiveAllowedCodes = input.csElectiveAllowedCodes;

  // Flatten every top-level requirement across programs and process in global
  // precedence order, so a named course is claimed before an elective bucket.
  const entries = input.programs.flatMap((program) =>
    program.requirements.map((requirement) => ({ program, requirement })),
  );
  entries.sort((a, b) => a.requirement.precedence - b.requirement.precedence);

  const resultsByProgram = new Map<string, RequirementResult[]>();
  for (const { program, requirement } of entries) {
    const result = solveRequirement(ctx, requirement);
    const list = resultsByProgram.get(program.id) ?? [];
    list.push(result);
    resultsByProgram.set(program.id, list);
  }

  const programs: ProgramResult[] = input.programs.map((program) => {
    // Restore the author's declared order for display.
    const solved = resultsByProgram.get(program.id) ?? [];
    const ordered = program.requirements
      .map((r) => solved.find((s) => s.requirementId === r.id))
      .filter((r): r is RequirementResult => Boolean(r));

    const needed = ordered.reduce((sum, r) => sum + r.needed, 0);
    const satisfied = ordered.reduce((sum, r) => sum + Math.min(r.satisfied, r.needed), 0);

    const state: RequirementState = ordered.every((r) => r.state === 'complete')
      ? 'complete'
      : ordered.some((r) => r.state === 'at_risk')
        ? 'at_risk'
        : ordered.some((r) => r.state === 'in_progress')
          ? 'in_progress'
          : ordered.every((r) => r.state !== 'unmet')
            ? 'planned'
            : 'unmet';

    return {
      programId: program.id,
      title: program.title,
      category: program.category,
      sourceUrl: program.sourceUrl,
      state,
      requirements: ordered,
      progress: needed > 0 ? Math.min(1, satisfied / needed) : 0,
    };
  });

  return { programs, claimUsage: ledger.usage() };
}
