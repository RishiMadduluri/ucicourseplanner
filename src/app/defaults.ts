import type { Plan, Scenario } from '../domain/plan/types';
import { APP_DATA_SCHEMA_VERSION, DEFAULT_CATALOGUE_YEAR } from '../domain/schemaVersions';
import { ACTIVE_PLAN_ID } from '../persistence/db';

/**
 * Profile defaults. New plans start as Computer Science only; the
 * Mathematics second major (planning/06_DECISIONS_NEEDED.md) is opt-in.
 *
 * A new plan starts *empty* — no invented four-year sequence — because the
 * user's AP scores are runtime input. Everything here is a starting point the
 * onboarding flow can change.
 */

export function newScenario(overrides: Partial<Scenario> = {}): Scenario {
  const now = new Date().toISOString();
  return {
    id: `scenario-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Primary plan',
    isPrimary: true,
    mathProgram: 'none',
    plannedCourses: [],
    externalExams: [],
    manualCredits: [],
    overrides: [],
    pinnedAllocations: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createDefaultPlan(dataBuildId: string): Plan {
  const now = new Date().toISOString();
  const primary = newScenario({ name: 'Primary plan', isPrimary: true, mathProgram: 'none' });

  return {
    id: ACTIVE_PLAN_ID,
    name: 'My UCI Plan',
    appDataSchemaVersion: APP_DATA_SCHEMA_VERSION,
    dataBuildId,
    profile: {
      catalogueYear: DEFAULT_CATALOGUE_YEAR,
      entranceTermId: '2026-fall',
      graduationTermId: '2030-spring',
      primaryMajor: 'computer_science_bs',
      mathProgram: 'none',
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
    scenarios: [primary],
    activeScenarioId: primary.id,
    transfer: {},
    onboardingComplete: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The seeded comparison scenario (planning/06_DECISIONS_NEEDED.md).
 * Pure ↔ Applied swap each other; a CS-only plan compares against adding Pure Mathematics.
 */
export function buildComparisonScenario(source: Scenario): Scenario {
  const target = source.mathProgram === 'pure_math' ? 'applied_math' : 'pure_math';
  const now = new Date().toISOString();
  return {
    ...structuredClone(source),
    id: `scenario-${Math.random().toString(36).slice(2, 10)}`,
    name:
      target === 'applied_math'
        ? 'Compare — Applied and Computational Mathematics'
        : source.mathProgram === 'none'
          ? 'Compare — add Pure Mathematics'
          : 'Compare — Pure Mathematics',
    isPrimary: false,
    mathProgram: target,
    // Pinned allocations refer to the other program's requirement ids.
    pinnedAllocations: [],
    createdAt: now,
    updatedAt: now,
  };
}
