import { describe, expect, it } from 'vitest';
import { assessPlanner, downstreamDependents } from '../../src/domain/planner/warnings';
import { resolveExternalCredit } from '../../src/domain/externalCredit/resolve';
import { OFFERING_INDEX } from '../../src/data/offerings2026';
import { buildTimeline, DEFAULT_TIMELINE } from '../../src/domain/terms/terms';
import { COURSE_INDEX, completed, exam, makeScenario, placement } from '../helpers';
import type { Scenario, WorkloadPreference } from '../../src/domain/plan/types';

const TERM_IDS = buildTimeline(DEFAULT_TIMELINE).allTerms.map((t) => t.id);

const workload: WorkloadPreference = {
  regularTargetUnits: 16,
  regularWarnAboveUnits: 16,
  summerStyle: 'up_to_two',
  intensity: 'adaptive',
  summersEnabled: true,
};

function assess(scenario: Scenario) {
  return assessPlanner({
    scenario,
    courseIndex: COURSE_INDEX,
    offeringIndex: OFFERING_INDEX,
    external: resolveExternalCredit(scenario.externalExams, scenario.manualCredits),
    workload,
    termIds: TERM_IDS,
  });
}

function warningsFor(scenario: Scenario, code: string) {
  const result = assess(scenario);
  const placementId = scenario.plannedCourses.find((p) => p.code === code)!.id;
  return result.byPlacement.get(placementId)!.warnings;
}

describe('term totals', () => {
  it('updates term units immediately when a course is added (criterion 10)', () => {
    const empty = assess(makeScenario());
    expect(empty.byTerm.get('2026-fall')!.units).toBe(0);

    const withCourse = assess(
      makeScenario({ plannedCourses: [placement({ code: 'I&C SCI 31', termId: '2026-fall' })] }),
    );
    expect(withCourse.byTerm.get('2026-fall')!.units).toBe(4);
    expect(withCourse.byTerm.get('2026-fall')!.courseCount).toBe(1);
  });

  it('splits a 10-week Summer course across both sessions for session load', () => {
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'MATH 2A', termId: '2026-summer-ten_week' })],
    });
    const summer = assess(scenario).bySummer.get(2026)!;

    expect(summer.totalUnits).toBe(4);
    expect(summer.sessionUnits.session_1).toBe(2);
    expect(summer.sessionUnits.session_2).toBe(2);
  });

  it('flags a Summer above the 32-unit absolute ceiling as invalid', () => {
    const scenario = makeScenario({
      plannedCourses: [
        placement({ code: 'MATH 2A', termId: '2026-summer-session_1', plannedUnits: 12 }),
        placement({ code: 'MATH 2B', termId: '2026-summer-ten_week', plannedUnits: 12 }),
        placement({ code: 'MATH 2D', termId: '2026-summer-session_2', plannedUnits: 12 }),
      ],
    });
    const summer = assess(scenario).bySummer.get(2026)!;

    expect(summer.totalUnits).toBe(36);
    expect(summer.valid).toBe(false);
    expect(summer.loadIssues.some((i) => i.severity === 'invalid')).toBe(true);
  });
});

describe('duplicate warnings (criterion 12)', () => {
  it('warns when a non-repeatable course is placed twice', () => {
    const scenario = makeScenario({
      plannedCourses: [
        placement({ code: 'I&C SCI 31', termId: '2026-fall' }),
        placement({ code: 'I&C SCI 31', termId: '2027-winter' }),
      ],
    });
    const warnings = warningsFor(scenario, 'I&C SCI 31');
    const duplicate = warnings.find((w) => w.kind === 'duplicate')!;

    expect(duplicate.severity).toBe('warning');
    expect(duplicate.detail).toMatch(/placed 2 times/);
    expect(duplicate.detail).toMatch(/Credit is awarded once/);
  });

  it('does not warn for a single placement', () => {
    const scenario = makeScenario({ plannedCourses: [placement({ code: 'I&C SCI 31', termId: '2026-fall' })] });
    expect(warningsFor(scenario, 'I&C SCI 31').some((w) => w.kind === 'duplicate')).toBe(false);
  });

  it('warns when a UCI course duplicates exam credit (criterion 63)', () => {
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'MATH 2A', termId: '2026-fall' })],
      externalExams: [exam('calculus_bc', 'Calculus BC', '5')],
    });
    const warning = warningsFor(scenario, 'MATH 2A').find((w) => w.kind === 'duplicate_external')!;

    expect(warning.detail).toMatch(/already exempts you from MATH 2A/);
    expect(warning.detail).toMatch(/credit only once/);
  });
});

describe('prerequisite warnings on the board', () => {
  it('warns and names every missing branch', () => {
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'COMPSCI 112', termId: '2028-winter' })],
    });
    const warning = warningsFor(scenario, 'COMPSCI 112').find((w) => w.kind === 'prerequisite')!;

    expect(warning.severity).toBe('warning');
    expect(warning.detail).toMatch(/I&C SCI 46/);
    expect(warning.detail).toMatch(/MATH 3A/);
  });

  it('clears the warning once prerequisites sit in earlier terms', () => {
    const scenario = makeScenario({
      plannedCourses: [
        ...completed(['I&C SCI 46', 'MATH 3A'], 'B', '2027-fall'),
        placement({ code: 'COMPSCI 112', termId: '2028-winter' }),
      ],
    });
    expect(warningsFor(scenario, 'COMPSCI 112').some((w) => w.kind === 'prerequisite')).toBe(false);
  });

  it('re-warns when a prerequisite moves after its dependent (criteria 11, 20)', () => {
    const scenario = makeScenario({
      plannedCourses: [
        ...completed(['I&C SCI 46'], 'B', '2027-fall'),
        // MATH 3A moved to *after* COMPSCI 112.
        placement({ code: 'MATH 3A', termId: '2028-spring' }),
        placement({ code: 'COMPSCI 112', termId: '2028-winter' }),
      ],
    });
    const warning = warningsFor(scenario, 'COMPSCI 112').find((w) => w.kind === 'prerequisite')!;
    expect(warning.detail).toMatch(/MATH 3A/);
  });

  it('always surfaces the enrollment restriction separately from prerequisites', () => {
    const scenario = makeScenario({
      plannedCourses: [
        ...completed(['I&C SCI 46', 'MATH 3A'], 'A', '2027-fall'),
        placement({ code: 'COMPSCI 112', termId: '2028-winter' }),
      ],
    });
    const warnings = warningsFor(scenario, 'COMPSCI 112');

    // Prerequisites satisfied, but still enrollment-restricted.
    expect(warnings.some((w) => w.kind === 'prerequisite')).toBe(false);
    const restriction = warnings.find((w) => w.kind === 'restriction')!;
    expect(restriction.title).toMatch(/first consideration/i);
    expect(restriction.severity).toBe('info');
  });

  it('does not treat elective-only AP credit as clearing a prerequisite', () => {
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'I&C SCI 32', termId: '2026-fall' })],
      // AP CS A is elective-only and must not clear I&C SCI 31.
      externalExams: [exam('computer_science_a', 'Computer Science A', '5')],
    });
    const warnings = warningsFor(scenario, 'I&C SCI 32');
    expect(warnings.some((w) => w.kind === 'prerequisite')).toBe(true);
  });

  it('notes a course with no term instead of silently ignoring it', () => {
    const scenario = makeScenario({ plannedCourses: [placement({ code: 'MATH 2A' })] });
    const warning = warningsFor(scenario, 'MATH 2A').find((w) => w.kind === 'unscheduled')!;
    expect(warning.detail).toMatch(/not counted in any term load/);
  });
});

describe('offering warnings', () => {
  it('treats a season absent from the department plan as unknown, not as a warning', () => {
    // I&C SCI 6N is planned only in Winter. A blank Fall cell means "not in
    // this plan", not "impossible", so it produces a neutral unknown badge
    // rather than a warning (criterion 46).
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'I&C SCI 6N', termId: '2026-fall' })],
    });
    const result = assess(scenario);
    const placementId = scenario.plannedCourses[0]!.id;
    const assessment = result.byPlacement.get(placementId)!;

    expect(assessment.offering?.state).toBe('unknown');
    expect(assessment.warnings.some((w) => w.kind === 'offering')).toBe(false);
    // The stronger Winter evidence is still offered as a suggestion.
    expect(assessment.offering?.suggestedTerms.some((t) => t.includes('winter'))).toBe(true);
  });

  it('warns when the evidence actively says the course is uncommon in that season', () => {
    // MATH 195W carries an explicit "not offered in 2026-27" cadence note.
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'MATH 147', termId: '2027-spring' })],
    });
    const result = assess(scenario);
    const assessment = result.byPlacement.get(scenario.plannedCourses[0]!.id)!;
    // MATH 147 is planned in all three quarters, so no offering warning.
    expect(assessment.offering?.state).toBe('planned');
    expect(assessment.warnings.some((w) => w.kind === 'offering')).toBe(false);
  });

  it('does not warn for a course listed in the plan for that season', () => {
    const scenario = makeScenario({
      plannedCourses: [placement({ code: 'I&C SCI 31', termId: '2026-fall' })],
    });
    expect(warningsFor(scenario, 'I&C SCI 31').some((w) => w.kind === 'offering')).toBe(false);
  });
});

describe('downstream dependents', () => {
  it('lists courses in the plan that depend on a given course', () => {
    const scenario = makeScenario({
      plannedCourses: [
        placement({ code: 'MATH 3A', termId: '2027-fall' }),
        placement({ code: 'COMPSCI 112', termId: '2028-winter' }),
        placement({ code: 'MATH 2A', termId: '2026-fall' }),
      ],
    });

    expect(downstreamDependents('MATH 3A', scenario, COURSE_INDEX)).toContain('COMPSCI 112');
    // MATH 2A is not a prerequisite of anything else in this plan.
    expect(downstreamDependents('MATH 2A', scenario, COURSE_INDEX)).not.toContain('COMPSCI 112');
  });

  it('returns an empty list when nothing depends on the course', () => {
    const scenario = makeScenario({ plannedCourses: [placement({ code: 'COMPSCI 112', termId: '2028-winter' })] });
    expect(downstreamDependents('COMPSCI 112', scenario, COURSE_INDEX)).toEqual([]);
  });
});

describe('load warnings on the board', () => {
  it('does not warn for a standard 16-unit quarter', () => {
    const scenario = makeScenario({
      plannedCourses: completed(['I&C SCI 31', 'MATH 2A', 'MATH 2B', 'MATH 2D'], 'A', '2026-fall'),
    });
    const term = assess(scenario).byTerm.get('2026-fall')!;

    expect(term.units).toBe(16);
    expect(term.loadIssues.filter((i) => i.severity === 'warning')).toHaveLength(0);
  });

  it('warns that dean authorization is needed above 20 units', () => {
    const scenario = makeScenario({
      plannedCourses: completed(
        ['I&C SCI 31', 'MATH 2A', 'MATH 2B', 'MATH 2D', 'MATH 3A', 'MATH 9'],
        'A',
        '2026-fall',
      ),
    });
    const term = assess(scenario).byTerm.get('2026-fall')!;

    expect(term.units).toBe(24);
    expect(term.loadIssues.find((i) => i.code === 'above_maximum')?.resolution).toMatch(/dean/i);
  });
});
