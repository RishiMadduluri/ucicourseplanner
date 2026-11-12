import fixture from './fixtures/catalogue-subset.json';
import type { CatalogueSnapshot, Course, Grade } from '../src/domain/courses/types';
import { normalizeCourseCode } from '../src/domain/courses/codes';
import type {
  CourseStatus,
  ExternalExam,
  ManualCredit,
  MathProgram,
  Plan,
  PlannedCourse,
  PlanOverride,
  Scenario,
} from '../src/domain/plan/types';
import { APP_DATA_SCHEMA_VERSION } from '../src/domain/schemaVersions';
import type { ProgramResult, RequirementResult } from '../src/domain/requirements/allocate';

/**
 * Shared test helpers. The catalogue fixture is a real slice of the ingested
 * 2026-27 snapshot, so tests exercise genuine prerequisite trees, unit values,
 * and GE designations rather than invented data.
 */

export const SNAPSHOT = fixture as unknown as CatalogueSnapshot;

export const COURSE_INDEX: Map<string, Course> = new Map(
  SNAPSHOT.courses.map((c) => [c.normalizedCode, c]),
);

export const ALL_COURSE_CODES: string[] = SNAPSHOT.courses.map((c) => c.normalizedCode);

export function course(code: string): Course {
  const found = COURSE_INDEX.get(normalizeCourseCode(code));
  if (!found) throw new Error(`Fixture is missing ${code}`);
  return found;
}

let counter = 0;

export interface PlacementSpec {
  code: string;
  termId?: string;
  status?: CourseStatus;
  grade?: Grade;
  gradeBasis?: PlannedCourse['gradeBasis'];
  plannedUnits?: number;
  source?: PlannedCourse['source'];
}

export function placement(spec: PlacementSpec): PlannedCourse {
  counter += 1;
  const code = normalizeCourseCode(spec.code);
  const p: PlannedCourse = {
    id: `p${counter}-${code.replace(/\W+/g, '')}`,
    courseId: `2026-27:${code.replace(/\W+/g, '-')}`,
    code,
    status: spec.status ?? 'planned',
    source: spec.source ?? 'uci',
    overrideIds: [],
    createdAt: '2026-07-24T00:00:00.000Z',
  };
  if (spec.termId) p.termId = spec.termId;
  if (spec.grade) p.grade = spec.grade;
  if (spec.gradeBasis) p.gradeBasis = spec.gradeBasis;
  if (spec.plannedUnits !== undefined) p.plannedUnits = spec.plannedUnits;
  return p;
}

/** Convenience: several completed courses with the same grade. */
export function completed(codes: string[], grade: Grade = 'A', termId = '2026-fall'): PlannedCourse[] {
  return codes.map((code) => placement({ code, termId, status: 'completed', grade, gradeBasis: 'letter' }));
}

export function planned(codes: string[], termId = '2027-fall'): PlannedCourse[] {
  return codes.map((code) => placement({ code, termId, status: 'planned' }));
}

export interface ScenarioSpec {
  mathProgram?: MathProgram;
  plannedCourses?: PlannedCourse[];
  externalExams?: ExternalExam[];
  manualCredits?: ManualCredit[];
  overrides?: PlanOverride[];
}

export function makeScenario(spec: ScenarioSpec = {}): Scenario {
  return {
    id: 'scenario-test',
    name: 'Test scenario',
    isPrimary: true,
    mathProgram: spec.mathProgram ?? 'pure_math',
    plannedCourses: spec.plannedCourses ?? [],
    externalExams: spec.externalExams ?? [],
    manualCredits: spec.manualCredits ?? [],
    overrides: spec.overrides ?? [],
    pinnedAllocations: [],
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

export function makePlan(scenario: Scenario): Plan {
  return {
    id: 'plan-test',
    name: 'Test plan',
    appDataSchemaVersion: APP_DATA_SCHEMA_VERSION,
    dataBuildId: 'test-fixture',
    profile: {
      catalogueYear: '2026-27',
      entranceTermId: '2026-fall',
      graduationTermId: '2030-spring',
      primaryMajor: 'computer_science_bs',
      mathProgram: scenario.mathProgram,
      workload: {
        regularTargetUnits: 16,
        regularWarnAboveUnits: 16,
        summerStyle: 'up_to_two',
        intensity: 'adaptive',
        summersEnabled: true,
      },
      elwrStatus: 'unknown_needs_input',
      americanHistoryStatus: 'unknown_needs_input',
    },
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    transfer: {},
    onboardingComplete: true,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

export function exam(examKey: string, examName: string, score: string): ExternalExam {
  counter += 1;
  return {
    id: `exam${counter}-${examKey}`,
    system: 'ap',
    examKey,
    examName,
    score,
    manuallyVerified: false,
  };
}

/** Look up one requirement result anywhere in the audit tree, at any depth. */
export function findRequirement(
  programs: ProgramResult[],
  requirementId: string,
): RequirementResult | undefined {
  const search = (nodes: RequirementResult[]): RequirementResult | undefined => {
    for (const node of nodes) {
      if (node.requirementId === requirementId) return node;
      const hit = node.children ? search(node.children) : undefined;
      if (hit) return hit;
    }
    return undefined;
  };
  return search(programs.flatMap((p) => p.requirements));
}

/**
 * Same as `findRequirement`, but throws with a clear message when the id is
 * absent — tests that dereference the result want a named failure, not
 * `undefined is not an object`.
 */
export function requireRequirement(programs: ProgramResult[], requirementId: string): RequirementResult {
  const found = findRequirement(programs, requirementId);
  if (!found) throw new Error(`Requirement ${requirementId} not found in audit output`);
  return found;
}
