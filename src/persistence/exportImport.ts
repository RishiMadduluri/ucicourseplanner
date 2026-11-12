import { z } from 'zod';
import { planExportSchema, planSchema } from '../domain/plan/types';
import type { Plan, PlanExport } from '../domain/plan/types';
import { APP_DATA_SCHEMA_VERSION, PLAN_EXPORT_SCHEMA_VERSION } from '../domain/schemaVersions';

/**
 * Versioned JSON backup.
 *
 * 04_PLANNING_AND_AUDIT_ENGINE.md — Persistence and migration:
 *   - export a schema-versioned backup;
 *   - validate imports and show a preview before applying;
 *   - a bad or incompatible import must fail safely without destroying the
 *     existing local plan.
 */

export const APP_VERSION = '0.1.0';

export function buildExport(plan: Plan): PlanExport {
  return {
    format: 'zotpath-plan',
    exportSchemaVersion: PLAN_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    plan,
  };
}

export function serializePlan(plan: Plan): string {
  return JSON.stringify(buildExport(plan), null, 2);
}

export function exportFilename(plan: Plan): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = plan.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `zotpath-${safeName || 'plan'}-${date}.json`;
}

export interface ImportSummary {
  planName: string;
  catalogueYear: string;
  dataBuildId: string;
  scenarioCount: number;
  scenarioNames: string[];
  plannedCourseCount: number;
  externalExamCount: number;
  manualCreditCount: number;
  overrideCount: number;
  pinnedAllocationCount: number;
  graduationTermId: string;
  transferPointId?: string;
  mathProgram: string;
}

export type ImportResult =
  | { ok: true; plan: Plan; summary: ImportSummary; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Parse and validate an uploaded backup.
 *
 * Returns a result object rather than throwing, and never mutates local state —
 * the caller shows the preview and only then commits.
 */
export function parseImport(raw: string): ImportResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`The file is not valid JSON: ${(error as Error).message}`] };
  }

  const envelope = planExportSchema.safeParse(json);
  if (!envelope.success) {
    // Accept a bare plan object too, but say so.
    const barePlan = planSchema.safeParse(json);
    if (barePlan.success) {
      return finish(barePlan.data, ['File had no ZotPath export envelope; imported the plan object directly.']);
    }
    return { ok: false, errors: describeZodErrors(envelope.error) };
  }

  const warnings: string[] = [];
  const data = envelope.data;

  if (data.exportSchemaVersion > PLAN_EXPORT_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `This backup uses export schema version ${data.exportSchemaVersion}, but this build understands up to ${PLAN_EXPORT_SCHEMA_VERSION}. Update ZotPath before importing it.`,
      ],
    };
  }
  if (data.exportSchemaVersion < PLAN_EXPORT_SCHEMA_VERSION) {
    warnings.push(
      `Backup was written with export schema ${data.exportSchemaVersion}; it will be migrated to ${PLAN_EXPORT_SCHEMA_VERSION}.`,
    );
  }
  if (data.plan.appDataSchemaVersion !== APP_DATA_SCHEMA_VERSION) {
    warnings.push(
      `Plan was saved with app data schema ${data.plan.appDataSchemaVersion}; this build uses ${APP_DATA_SCHEMA_VERSION}.`,
    );
  }

  return finish(data.plan, warnings);
}

function finish(plan: Plan, warnings: string[]): ImportResult {
  // Structural sanity that Zod cannot express.
  const errors: string[] = [];
  if (plan.scenarios.length === 0) errors.push('The plan contains no scenarios.');
  if (!plan.scenarios.some((s) => s.id === plan.activeScenarioId)) {
    errors.push('The active scenario id does not match any scenario in the file.');
  }
  // `mathProgram` is a single enum per scenario, so the "both Mathematics
  // programs active" case is structurally impossible rather than validated here.
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, plan, summary: summarize(plan), warnings };
}

function summarize(plan: Plan): ImportSummary {
  const active = plan.scenarios.find((s) => s.id === plan.activeScenarioId) ?? plan.scenarios[0]!;
  return {
    planName: plan.name,
    catalogueYear: plan.profile.catalogueYear,
    dataBuildId: plan.dataBuildId,
    scenarioCount: plan.scenarios.length,
    scenarioNames: plan.scenarios.map((s) => s.name),
    plannedCourseCount: plan.scenarios.reduce((n, s) => n + s.plannedCourses.length, 0),
    externalExamCount: plan.scenarios.reduce((n, s) => n + s.externalExams.length, 0),
    manualCreditCount: plan.scenarios.reduce((n, s) => n + s.manualCredits.length, 0),
    overrideCount: plan.scenarios.reduce((n, s) => n + s.overrides.length, 0),
    pinnedAllocationCount: plan.scenarios.reduce((n, s) => n + s.pinnedAllocations.length, 0),
    graduationTermId: plan.profile.graduationTermId,
    transferPointId: plan.transfer?.lastTermId,
    mathProgram: active.mathProgram,
  };
}

function describeZodErrors(error: z.ZodError): string[] {
  return error.errors.slice(0, 8).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

// ---------------------------------------------------------------------------
// Catalogue-data migration preview
// ---------------------------------------------------------------------------

export interface CatalogueDiff {
  fromBuildId: string;
  toBuildId: string;
  /** Planned courses that no longer exist in the newer snapshot. */
  removedCourses: Array<{ code: string; scenarioName: string }>;
  /** Planned courses whose units changed between builds. */
  changedUnits: Array<{ code: string; from: string; to: string }>;
  /** Planned courses whose prerequisite text changed. */
  changedPrerequisites: Array<{ code: string }>;
  /** True when nothing in the plan is affected. */
  clean: boolean;
}

export interface CourseSummaryForDiff {
  normalizedCode: string;
  units: { min: number; max: number; variable: boolean };
  prerequisiteRaw?: string;
}

/**
 * Compare a plan's courses against a newer catalogue build.
 *
 * The caller must show this before reinterpreting the plan; a planned course
 * that disappears from a newer catalogue is never silently deleted.
 */
export function buildCatalogueDiff(
  plan: Plan,
  fromBuildId: string,
  toBuildId: string,
  oldCourses: Map<string, CourseSummaryForDiff>,
  newCourses: Map<string, CourseSummaryForDiff>,
): CatalogueDiff {
  const removedCourses: CatalogueDiff['removedCourses'] = [];
  const changedUnits: CatalogueDiff['changedUnits'] = [];
  const changedPrerequisites: CatalogueDiff['changedPrerequisites'] = [];
  const seen = new Set<string>();

  for (const scenario of plan.scenarios) {
    for (const placement of scenario.plannedCourses) {
      const code = placement.code;
      const next = newCourses.get(code);
      if (!next) {
        removedCourses.push({ code, scenarioName: scenario.name });
        continue;
      }
      if (seen.has(code)) continue;
      seen.add(code);

      const previous = oldCourses.get(code);
      if (!previous) continue;

      const before = formatUnits(previous.units);
      const after = formatUnits(next.units);
      if (before !== after) changedUnits.push({ code, from: before, to: after });

      if ((previous.prerequisiteRaw ?? '') !== (next.prerequisiteRaw ?? '')) {
        changedPrerequisites.push({ code });
      }
    }
  }

  return {
    fromBuildId,
    toBuildId,
    removedCourses,
    changedUnits,
    changedPrerequisites,
    clean: removedCourses.length === 0 && changedUnits.length === 0 && changedPrerequisites.length === 0,
  };
}

function formatUnits(units: { min: number; max: number; variable: boolean }): string {
  return units.variable ? `${units.min}-${units.max}` : String(units.max);
}
