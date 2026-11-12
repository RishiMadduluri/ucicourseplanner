import type { Course } from '../courses/types';
import { GRADE_POINTS, isGradedLetter } from '../courses/types';
import { normalizeCourseCode } from '../courses/codes';
import type { MathProgram, Plan, Scenario } from '../plan/types';
import { resolveExternalCredit } from '../externalCredit/resolve';
import type { ExternalCreditResult } from '../externalCredit/resolve';
import { allocate } from '../requirements/allocate';
import type { AllocationOutput, Claim } from '../requirements/allocate';
import type { RequirementProgram } from '../requirements/types';
import {
  COMPUTER_SCIENCE_BS,
  CS_GPA_REQUIREMENTS,
  csElectiveAllowedCodes,
} from '../requirements/programs/computerScience';
import { PURE_MATHEMATICS_BS, PURE_MATH_GPA_REQUIREMENTS } from '../requirements/programs/pureMathematics';
import { APPLIED_MATHEMATICS_BS, APPLIED_MATH_GPA_REQUIREMENTS } from '../requirements/programs/appliedMathematics';
import { GENERAL_EDUCATION } from '../requirements/programs/generalEducation';
import { ADD_MAJOR_ELIGIBILITY, UC_REQUIREMENTS, UCI_REQUIREMENTS } from '../requirements/programs/universityRequirements';

/**
 * Audit orchestrator: turns a scenario plus the catalogue into claims, resolves
 * external credit, and runs the allocation solver.
 *
 * Mutual exclusion (02, 01): Mathematics B.S. and Applied and Computational
 * Mathematics B.S. can never both be active in one scenario, so exactly one
 * Mathematics program is ever returned.
 */

export interface UnitTotals {
  completed: number;
  inProgress: number;
  planned: number;
  external: number;
  /** completed + inProgress + planned + external */
  projected: number;
}

export interface GpaSummary {
  key: string;
  label: string;
  /** Undefined when there is not enough graded data. */
  gpa?: number;
  gradedUnits: number;
  note: string;
}

export interface AuditResult {
  allocation: AllocationOutput;
  externalCredit: ExternalCreditResult;
  claims: Claim[];
  units: UnitTotals;
  gpas: GpaSummary[];
  activeMathProgram: MathProgram;
  /** Requirement ids that block graduation and need attention first. */
  blockingRequirementIds: string[];
}

/**
 * Active requirement programs for a scenario.
 * Never returns both Mathematics programs (criterion 65).
 */
export function activeProgramsFor(mathProgram: MathProgram): RequirementProgram[] {
  const programs: RequirementProgram[] = [
    UC_REQUIREMENTS,
    UCI_REQUIREMENTS,
    GENERAL_EDUCATION,
    COMPUTER_SCIENCE_BS,
  ];

  if (mathProgram === 'pure_math') programs.push(PURE_MATHEMATICS_BS);
  else if (mathProgram === 'applied_math') programs.push(APPLIED_MATHEMATICS_BS);

  // CS-only students were admitted straight into the major, so the
  // add/double-major screening rules (ICS change-of-major, Physical Sciences
  // double-major review) do not apply — only the CS graduation GPA floors do.
  if (mathProgram === 'none') {
    programs.push({
      id: 'cs_major_gpa',
      title: 'Computer Science GPA requirements',
      category: 'gpa',
      catalogueYear: ADD_MAJOR_ELIGIBILITY.catalogueYear,
      sourceUrl: COMPUTER_SCIENCE_BS.sourceUrl,
      requirements: [...CS_GPA_REQUIREMENTS],
    });
    return programs;
  }

  programs.push({
    ...ADD_MAJOR_ELIGIBILITY,
    requirements: [
      ...ADD_MAJOR_ELIGIBILITY.requirements,
      ...CS_GPA_REQUIREMENTS,
      ...(mathProgram === 'pure_math'
        ? PURE_MATH_GPA_REQUIREMENTS
        : mathProgram === 'applied_math'
          ? APPLIED_MATH_GPA_REQUIREMENTS
          : []),
    ],
  });

  return programs;
}

/** Units to count for a placement, honouring variable-unit selections. */
export function unitsForPlacement(course: Course | undefined, plannedUnits?: number): number {
  if (plannedUnits !== undefined) return plannedUnits;
  if (!course) return 0;
  return course.units.variable ? course.units.min : course.units.max;
}

/**
 * Build the claim list: every countable planned course, plus one synthetic
 * claim per external course-equivalence award.
 */
export function buildClaims(
  scenario: Scenario,
  courseIndex: Map<string, Course>,
  external: ExternalCreditResult,
): Claim[] {
  const claims: Claim[] = [];

  for (const placement of scenario.plannedCourses) {
    const code = normalizeCourseCode(placement.code);
    const course = courseIndex.get(code);
    const claim: Claim = {
      id: placement.id,
      code,
      units: unitsForPlacement(course, placement.plannedUnits),
      status: placement.status,
      external: placement.source !== 'uci',
      source: placement.source,
      department: course?.department ?? code.replace(/\s+\S+$/, ''),
      numericValue: course?.numericValue ?? 0,
      level: course?.level ?? 'lower',
      geCategories: course?.geCategories.map((g) => g.category) ?? [],
      geExclusiveSets:
        course?.geCategories
          .filter((g) => g.exclusiveWithin)
          .map((g) => g.exclusiveWithin!) ?? [],
      title: course?.title ?? code,
    };
    if (placement.grade) claim.grade = placement.grade;
    if (placement.gradeBasis) claim.gradeBasis = placement.gradeBasis;
    if (placement.termId) claim.termId = placement.termId;
    claims.push(claim);
  }

  // External course equivalences become claims so they satisfy named
  // requirements, but they are marked external and carry no grade.
  for (const award of external.awards) {
    if (award.status !== 'resolved' || !award.equivalence) continue;
    for (const code of award.equivalence.grantedCourseCodes) {
      // Skip when the student also has a real placement for the same course.
      if (claims.some((c) => c.code === code)) continue;
      const course = courseIndex.get(code);
      claims.push({
        id: `award:${award.examId}:${code}`,
        code,
        units: unitsForPlacement(course),
        status: 'completed',
        external: true,
        source: 'ap',
        externalExamKey: award.examKey,
        externalExamSystem: 'ap',
        department: course?.department ?? code.replace(/\s+\S+$/, ''),
        numericValue: course?.numericValue ?? 0,
        level: course?.level ?? 'lower',
        geCategories: course?.geCategories.map((g) => g.category) ?? [],
        geExclusiveSets: [],
        title: course?.title ?? code,
        gradeBasis: 'external',
      });
    }
  }

  // Adviser-entered prior-college equivalencies must be real claims too. The
  // previous implementation added their units to the total but never exposed
  // the equivalent course to either the UCI audit or transfer audit.
  for (const credit of scenario.manualCredits) {
    for (const rawCode of credit.equivalentCourseCodes) {
      const code = normalizeCourseCode(rawCode);
      if (claims.some((claim) => claim.code === code)) continue;
      const course = courseIndex.get(code);
      const manualClaim: Claim = {
        id: `manual:${credit.id}:${code}`,
        code,
        // The unit ledger uses ExternalCreditResult.manualQuarterUnits, so this
        // value is only used for requirement shape/range matching.
        units: unitsForPlacement(course),
        status: 'completed',
        external: true,
        source: credit.source,
        externalEquivalencyVerified: Boolean(credit.verifiedBy),
        ...(credit.source === 'ap' || credit.source === 'ib'
          ? { externalExamSystem: credit.source, externalExamKey: credit.courseTitle }
          : {}),
        department: course?.department ?? code.replace(/\s+\S+$/, ''),
        numericValue: course?.numericValue ?? 0,
        level: course?.level ?? 'lower',
        geCategories: course?.geCategories.map((g) => g.category) ?? [],
        geExclusiveSets: [],
        title: course?.title ?? credit.courseTitle,
        gradeBasis: credit.grade && isGradedLetter(credit.grade) ? 'letter' : 'external',
      };
      if (credit.grade) manualClaim.grade = credit.grade;
      claims.push(manualClaim);
    }
  }

  return claims;
}

function computeUnits(claims: Claim[], external: ExternalCreditResult): UnitTotals {
  const uci = claims.filter((c) => !c.external);
  const completed = uci.filter((c) => c.status === 'completed' || c.status === 'waived').reduce((s, c) => s + c.units, 0);
  const inProgress = uci.filter((c) => c.status === 'in_progress').reduce((s, c) => s + c.units, 0);
  const planned = uci.filter((c) => c.status === 'planned').reduce((s, c) => s + c.units, 0);
  const externalUnits = external.totalExternalUnits;

  return {
    completed: round(completed),
    inProgress: round(inProgress),
    planned: round(planned),
    external: round(externalUnits),
    projected: round(completed + inProgress + planned + externalUnits),
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

interface GpaSpec {
  key: string;
  label: string;
  filter: (claim: Claim) => boolean;
}

function computeGpas(claims: Claim[], mathProgram: MathProgram): GpaSummary[] {
  const csDepartments = ['COMPSCI', 'I&C SCI', 'SWE', 'IN4MATX', 'STATS', 'MATH'];
  const csUpperDepartments = ['COMPSCI', 'I&C SCI', 'SWE', 'IN4MATX'];

  const specs: GpaSpec[] = [
    { key: 'overall', label: 'Overall UC GPA', filter: () => true },
    { key: 'cs_major', label: 'CS major GPA', filter: (c) => csDepartments.includes(c.department) },
    {
      key: 'cs_upper',
      label: 'CS upper-division major GPA',
      filter: (c) => csUpperDepartments.includes(c.department) && c.level === 'upper',
    },
  ];

  if (mathProgram !== 'none') {
    const label = mathProgram === 'pure_math' ? 'Mathematics' : 'Applied Mathematics';
    specs.push(
      { key: 'math_major', label: `${label} major GPA`, filter: (c) => c.department === 'MATH' },
      {
        key: 'math_upper',
        label: `${label} upper-division major GPA`,
        filter: (c) => c.department === 'MATH' && c.level === 'upper',
      },
    );
  }

  return specs.map((spec) => {
    // Exam credit and P/NP work never enter a GPA (07 — Global rules).
    const graded = claims.filter(
      (c) =>
        !c.external &&
        c.status === 'completed' &&
        isGradedLetter(c.grade) &&
        c.gradeBasis !== 'pass_no_pass' &&
        spec.filter(c),
    );
    const gradedUnits = graded.reduce((s, c) => s + c.units, 0);
    if (graded.length === 0 || gradedUnits === 0) {
      return {
        key: spec.key,
        label: spec.label,
        gradedUnits: 0,
        note: 'Not enough completed letter-graded coursework to calculate.',
      };
    }
    const points = graded.reduce((s, c) => s + (GRADE_POINTS[c.grade!] ?? 0) * c.units, 0);
    return {
      key: spec.key,
      label: spec.label,
      gpa: Math.round((points / gradedUnits) * 100) / 100,
      gradedUnits: round(gradedUnits),
      note: `${round(gradedUnits)} graded units. Exam credit and P/NP work excluded.`,
    };
  });
}

export interface RunAuditOptions {
  plan: Plan;
  scenario: Scenario;
  courseIndex: Map<string, Course>;
  /** Every catalogue code, for the CS elective allow-list. */
  allCourseCodes: string[];
}

export function runAudit({ plan, scenario, courseIndex, allCourseCodes }: RunAuditOptions): AuditResult {
  const external = resolveExternalCredit(scenario.externalExams, scenario.manualCredits);
  const claims = buildClaims(scenario, courseIndex, external);

  // Evidence keys combine what the exams grant with what the user asserted in
  // their profile, since ELWR and AH&I are commonly satisfied before entrance.
  const evidenceKeys = new Set(external.satisfiedRequirementKeys);
  if (plan.profile.elwrStatus === 'satisfied' || plan.profile.elwrStatus === 'waived_or_external_evidence') {
    evidenceKeys.add('elwr');
  }
  if (plan.profile.americanHistoryStatus === 'satisfied') {
    evidenceKeys.add('american_history_institutions');
  }

  const allocation = allocate({
    programs: activeProgramsFor(scenario.mathProgram),
    claims,
    courseIndex,
    pinnedAllocations: scenario.pinnedAllocations,
    overrides: scenario.overrides,
    satisfiedEvidenceKeys: evidenceKeys,
    csElectiveAllowedCodes: csElectiveAllowedCodes(allCourseCodes),
  });

  const blockingRequirementIds = allocation.programs
    .filter((p) => p.category === 'cs' || p.category === 'math' || p.category === 'ge' || p.category === 'uci')
    .flatMap((p) => p.requirements)
    .filter((r) => r.state === 'unmet' || r.state === 'at_risk')
    .map((r) => r.requirementId);

  return {
    allocation,
    externalCredit: external,
    claims,
    units: computeUnits(claims, external),
    gpas: computeGpas(claims, scenario.mathProgram),
    activeMathProgram: scenario.mathProgram,
    blockingRequirementIds,
  };
}
