import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildCatalogueDiff,
  buildExport,
  exportFilename,
  parseImport,
  serializePlan,
  type CourseSummaryForDiff,
} from '../../src/persistence/exportImport';
import { db, loadPlan, savePlan } from '../../src/persistence/db';
import { PLAN_EXPORT_SCHEMA_VERSION } from '../../src/domain/schemaVersions';
import { completed, exam, makePlan, makeScenario, placement } from '../helpers';
import type { PlanOverride } from '../../src/domain/plan/types';

const override: PlanOverride = {
  id: 'ov-1',
  type: 'substitution',
  targetId: 'math.applied.outside_electives',
  note: 'Adviser approved COMPSCI 175 as an outside elective, 2028-02-03.',
  adviser: 'Applied Math adviser',
  createdAt: '2028-02-03T00:00:00.000Z',
  updatedAt: '2028-02-03T00:00:00.000Z',
};

function richPlan() {
  const scenario = makeScenario({
    plannedCourses: [
      ...completed(['MATH 2A', 'I&C SCI 31'], 'A', '2026-fall'),
      placement({ code: 'COMPSCI 112', termId: '2028-winter', status: 'planned' }),
      placement({ code: 'MATH 2B', termId: '2027-winter', status: 'in_progress' }),
    ],
    externalExams: [exam('calculus_bc', 'Calculus BC', '5')],
    manualCredits: [
      {
        id: 'mc-1',
        institution: 'Local CC',
        courseTitle: 'Intro Statistics',
        units: 4,
        equivalentCourseCodes: ['STATS 7'],
        source: 'transfer',
      },
    ],
    overrides: [override],
  });
  scenario.pinnedAllocations = [{ requirementId: 'cs.lower.math_2a', claimIds: ['pinned-claim'] }];
  const plan = makePlan(scenario);
  plan.transfer = { lastTermId: '2028-spring' };
  return plan;
}

describe('JSON export and import', () => {
  it('round-trips placements, grades, external credit, overrides, and pins (criterion 50)', () => {
    const plan = richPlan();
    const result = parseImport(serializePlan(plan));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan).toEqual(plan);

    const scenario = result.plan.scenarios[0]!;
    expect(scenario.plannedCourses).toHaveLength(4);
    expect(scenario.plannedCourses.find((p) => p.code === 'MATH 2A')?.grade).toBe('A');
    expect(scenario.plannedCourses.find((p) => p.code === 'MATH 2B')?.status).toBe('in_progress');
    expect(scenario.externalExams[0]?.examKey).toBe('calculus_bc');
    expect(scenario.manualCredits[0]?.equivalentCourseCodes).toEqual(['STATS 7']);
    expect(scenario.overrides[0]?.note).toMatch(/Adviser approved/);
    expect(scenario.pinnedAllocations[0]?.requirementId).toBe('cs.lower.math_2a');
    expect(result.plan.transfer?.lastTermId).toBe('2028-spring');
  });

  it('writes a versioned envelope and a dated filename', () => {
    const plan = richPlan();
    const envelope = buildExport(plan);

    expect(envelope.format).toBe('zotpath-plan');
    expect(envelope.exportSchemaVersion).toBe(PLAN_EXPORT_SCHEMA_VERSION);
    expect(exportFilename(plan)).toMatch(/^zotpath-test-plan-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('summarizes the import for preview before anything is applied', () => {
    const result = parseImport(serializePlan(richPlan()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toMatchObject({
      planName: 'Test plan',
      catalogueYear: '2026-27',
      scenarioCount: 1,
      plannedCourseCount: 4,
      externalExamCount: 1,
      manualCreditCount: 1,
      overrideCount: 1,
      pinnedAllocationCount: 1,
      graduationTermId: '2030-spring',
      transferPointId: '2028-spring',
    });
  });
});

describe('corrupted and incompatible imports fail safely', () => {
  it('rejects malformed JSON', () => {
    const result = parseImport('{ this is not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it('rejects a structurally invalid plan and names the fields', () => {
    const broken = JSON.stringify({
      format: 'zotpath-plan',
      exportSchemaVersion: 1,
      exportedAt: '2026-07-24T00:00:00.000Z',
      appVersion: '0.1.0',
      plan: { id: 'x', name: 'Broken' },
    });
    const result = parseImport(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(' ')).toMatch(/profile|scenarios/);
  });

  it('rejects a truncated file', () => {
    const full = serializePlan(richPlan());
    const result = parseImport(full.slice(0, Math.floor(full.length / 2)));
    expect(result.ok).toBe(false);
  });

  it('refuses a newer export schema instead of guessing', () => {
    const plan = richPlan();
    const envelope = { ...buildExport(plan), exportSchemaVersion: PLAN_EXPORT_SCHEMA_VERSION + 5 };
    const result = parseImport(JSON.stringify(envelope));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/Update ZotPath before importing/);
  });

  it('rejects a plan whose active scenario id does not exist', () => {
    const plan = richPlan();
    plan.activeScenarioId = 'does-not-exist';
    const result = parseImport(serializePlan(plan));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(' ')).toMatch(/active scenario id/i);
  });

  it('accepts a bare plan object but says the envelope was missing', () => {
    const result = parseImport(JSON.stringify(richPlan()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(' ')).toMatch(/no ZotPath export envelope/);
  });
});

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    await db.plans.clear();
  });

  it('round-trips a plan through the local store (criterion 49)', async () => {
    const plan = richPlan();
    await savePlan(plan);

    const restored = await loadPlan(plan.id);
    expect(restored).toEqual(plan);
    expect(restored?.scenarios[0]?.plannedCourses).toHaveLength(4);
  });

  it('overwrites rather than duplicating on repeated saves', async () => {
    const plan = richPlan();
    await savePlan(plan);
    await savePlan({ ...plan, name: 'Renamed' });

    expect(await db.plans.count()).toBe(1);
    expect((await loadPlan(plan.id))?.name).toBe('Renamed');
  });
});

describe('catalogue-data migration preview (criterion 51)', () => {
  const plan = richPlan();

  const oldCourses = new Map<string, CourseSummaryForDiff>([
    ['MATH 2A', { normalizedCode: 'MATH 2A', units: { min: 4, max: 4, variable: false } }],
    ['I&C SCI 31', { normalizedCode: 'I&C SCI 31', units: { min: 4, max: 4, variable: false } }],
    ['COMPSCI 112', {
      normalizedCode: 'COMPSCI 112',
      units: { min: 4, max: 4, variable: false },
      prerequisiteRaw: 'I&C SCI 46 with a minimum grade of C',
    }],
    ['MATH 2B', { normalizedCode: 'MATH 2B', units: { min: 4, max: 4, variable: false } }],
  ]);

  it('reports a clean diff when nothing relevant changed', () => {
    const diff = buildCatalogueDiff(plan, 'build-a', 'build-b', oldCourses, oldCourses);
    expect(diff.clean).toBe(true);
    expect(diff.removedCourses).toHaveLength(0);
  });

  it('flags a planned course that disappeared from the newer snapshot', () => {
    const newCourses = new Map(oldCourses);
    newCourses.delete('COMPSCI 112');

    const diff = buildCatalogueDiff(plan, 'build-a', 'build-b', oldCourses, newCourses);
    expect(diff.clean).toBe(false);
    expect(diff.removedCourses).toEqual([{ code: 'COMPSCI 112', scenarioName: 'Test scenario' }]);
  });

  it('flags changed units and changed prerequisite text', () => {
    const newCourses = new Map(oldCourses);
    newCourses.set('MATH 2A', { normalizedCode: 'MATH 2A', units: { min: 2, max: 5, variable: true } });
    newCourses.set('COMPSCI 112', {
      normalizedCode: 'COMPSCI 112',
      units: { min: 4, max: 4, variable: false },
      prerequisiteRaw: 'I&C SCI 46 with a minimum grade of B',
    });

    const diff = buildCatalogueDiff(plan, 'build-a', 'build-b', oldCourses, newCourses);
    expect(diff.changedUnits).toEqual([{ code: 'MATH 2A', from: '4', to: '2-5' }]);
    expect(diff.changedPrerequisites).toEqual([{ code: 'COMPSCI 112' }]);
    expect(diff.clean).toBe(false);
  });

  it('records both build ids so the user can see what is being compared', () => {
    const diff = buildCatalogueDiff(plan, 'build-a', 'build-b', oldCourses, oldCourses);
    expect(diff.fromBuildId).toBe('build-a');
    expect(diff.toBuildId).toBe('build-b');
  });
});
