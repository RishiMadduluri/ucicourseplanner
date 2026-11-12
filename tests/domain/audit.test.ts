import { describe, expect, it } from 'vitest';
import { runAudit, activeProgramsFor } from '../../src/domain/audit/audit';
import {
  ALL_COURSE_CODES,
  COURSE_INDEX,
  completed,
  exam,
  requireRequirement,
  makePlan,
  makeScenario,
  placement,
  planned,
} from '../helpers';
import type { PlanOverride, Scenario } from '../../src/domain/plan/types';

function audit(scenario: Scenario) {
  return runAudit({
    plan: makePlan(scenario),
    scenario,
    courseIndex: COURSE_INDEX,
    allCourseCodes: ALL_COURSE_CODES,
  });
}

function req(scenario: Scenario, id: string) {
  const result = audit(scenario);
  const found = requireRequirement(result.allocation.programs, id);
  if (!found) throw new Error(`Requirement ${id} not found in audit output`);
  return found;
}

const override = (targetId: string, note: string): PlanOverride => ({
  id: `ov-${targetId}`,
  type: 'substitution',
  targetId,
  note,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
});

// ---------------------------------------------------------------------------
// Computer Science
// ---------------------------------------------------------------------------

describe('Computer Science major', () => {
  it('supports both allowed programming-series paths (criterion 27)', () => {
    const standard = req(
      makeScenario({ plannedCourses: completed(['I&C SCI 31', 'I&C SCI 32', 'I&C SCI 33']) }),
      'cs.lower.programming_series',
    );
    expect(standard.state).toBe('complete');
    expect(standard.detail).toMatch(/I&C SCI 31, 32, and 33/);

    const accelerated = req(
      makeScenario({ plannedCourses: completed(['I&C SCI H32', 'I&C SCI 33']) }),
      'cs.lower.programming_series',
    );
    expect(accelerated.state).toBe('complete');
    expect(accelerated.detail).toMatch(/H32/);
  });

  it('lets MATH 3A satisfy the CS alternative and the Mathematics core (criteria 28, 39)', () => {
    const scenario = makeScenario({ plannedCourses: completed(['MATH 3A']) });
    expect(req(scenario, 'cs.lower.discrete_math_alt').state).toBe('complete');
    expect(req(scenario, 'math.pure.core_a.math_3a').state).toBe('complete');

    // The same claim is visibly shared across both majors.
    const result = audit(scenario);
    const claimId = result.claims.find((c) => c.code === 'MATH 3A')!.id;
    const usedBy = result.allocation.claimUsage.get(claimId) ?? [];
    expect(usedBy).toContain('cs.lower.discrete_math_alt');
    expect(usedBy).toContain('math.pure.core_a.math_3a');
  });

  it('leaves the Flexible Core incomplete with four courses from three areas (criterion 29)', () => {
    // 112 and 116 are both FA1, so only three distinct areas are covered.
    const scenario = makeScenario({
      plannedCourses: completed(['COMPSCI 112', 'COMPSCI 116', 'COMPSCI 121', 'COMPSCI 130']),
    });
    const result = req(scenario, 'cs.upper.flexible_core');
    expect(result.state).toBe('unmet');
    expect(result.satisfied).toBe(3);
    expect(result.detail).toMatch(/3 of 4 distinct focus areas/);
    expect(result.detail).toMatch(/repeats an area already covered|repeat areas already covered/);
  });

  it('completes the Flexible Core with four distinct areas (criterion 30)', () => {
    const scenario = makeScenario({
      plannedCourses: completed(['COMPSCI 112', 'COMPSCI 121', 'COMPSCI 130', 'COMPSCI 141']),
    });
    const result = req(scenario, 'cs.upper.flexible_core');
    expect(result.state).toBe('complete');
    expect(result.satisfied).toBe(4);
  });

  it('does not let a Flexible Core course also fill a CS elective slot (criterion 31)', () => {
    const scenario = makeScenario({
      plannedCourses: completed(['COMPSCI 112', 'COMPSCI 121', 'COMPSCI 130', 'COMPSCI 141']),
    });
    const result = audit(scenario);
    const flexible = requireRequirement(result.allocation.programs, 'cs.upper.flexible_core');
    const electives = requireRequirement(result.allocation.programs, 'cs.upper.electives');

    expect(flexible.satisfiedBy).toHaveLength(4);
    // All four were consumed by the Flexible Core, so none remain for electives.
    expect(electives.satisfiedBy).toHaveLength(0);
  });

  it('lets COMPSCI 145 fill one Flexible Core and one Project slot (criterion 32)', () => {
    const scenario = makeScenario({
      plannedCourses: completed(['COMPSCI 145', 'COMPSCI 112', 'COMPSCI 121', 'COMPSCI 130', 'COMPSCI 117']),
    });
    const result = audit(scenario);
    const claimId = result.claims.find((c) => c.code === 'COMPSCI 145')!.id;
    const usedBy = result.allocation.claimUsage.get(claimId) ?? [];

    expect(usedBy).toContain('cs.upper.flexible_core');
    expect(usedBy).toContain('cs.upper.projects');

    const projects = requireRequirement(result.allocation.programs, 'cs.upper.projects');
    expect(projects.state).toBe('complete');
    expect(projects.satisfied).toBe(2);
  });

  it('counts projects and the nine electives independently (criterion 33)', () => {
    const scenario = makeScenario({
      plannedCourses: completed([
        'COMPSCI 117', 'COMPSCI 118', // two projects
        'COMPSCI 162', 'COMPSCI 163', 'COMPSCI 164', 'COMPSCI 167', 'COMPSCI 171',
        'COMPSCI 178', 'COMPSCI 184A', 'IN4MATX 131', 'IN4MATX 133',
      ]),
    });
    const result = audit(scenario);
    const projects = requireRequirement(result.allocation.programs, 'cs.upper.projects');
    const electives = requireRequirement(result.allocation.programs, 'cs.upper.electives');

    expect(projects.satisfied).toBe(2);
    // No course is counted in both sections.
    const projectIds = new Set(projects.satisfiedBy.map((c: { id: string }) => c.id));
    for (const claim of electives.satisfiedBy) {
      expect(projectIds.has(claim.id)).toBe(false);
    }
  });

  it('excludes Engineering, ICS, Economics, and Mathematics from the CS science requirement', () => {
    // MATH and ICS GE II courses must not satisfy the CS science rule.
    const mathOnly = req(
      makeScenario({ plannedCourses: completed(['MATH 2A', 'MATH 2B']) }),
      'cs.lower.science',
    );
    expect(mathOnly.satisfied).toBe(0);

    const physicalSciences = req(
      makeScenario({ plannedCourses: completed(['CHEM 1A', 'CHEM 1B']) }),
      'cs.lower.science',
    );
    expect(physicalSciences.satisfied).toBe(2);
    expect(physicalSciences.state).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// Pure Mathematics
// ---------------------------------------------------------------------------

describe('Computer Science only (no second major)', () => {
  it('audits no Mathematics program and no double-major screening rules', () => {
    const ids = activeProgramsFor('none').map((p) => p.id);
    expect(ids).toContain('computer_science_bs');
    expect(ids).not.toContain('mathematics_bs_pure');
    expect(ids).not.toContain('applied_computational_mathematics_bs');
    expect(ids).not.toContain('add_major_eligibility');
  });

  it('still tracks the CS graduation GPA floors', () => {
    const result = audit(makeScenario({ mathProgram: 'none' }));
    expect(requireRequirement(result.allocation.programs, 'cs.gpa.major')).toBeDefined();
    expect(requireRequirement(result.allocation.programs, 'cs.gpa.upper_division_major')).toBeDefined();
    expect(result.allocation.programs.some((p) => p.category === 'math')).toBe(false);
    expect(result.gpas.map((g) => g.key)).not.toContain('math_major');
  });
});

describe('Pure Mathematics', () => {
  it('requires every named Core A course (criterion 34)', () => {
    const partial = req(makeScenario({ plannedCourses: completed(['MATH 2A', 'MATH 2B']) }), 'math.pure.core_a');
    expect(partial.state).toBe('unmet');

    const full = req(
      makeScenario({
        plannedCourses: completed([
          'MATH 2A', 'MATH 2B', 'MATH 2D', 'MATH 3A', 'MATH 3D', 'MATH 9',
          'MATH 13', 'MATH 120A', 'MATH 121A', 'MATH 130A', 'MATH 140A', 'MATH 140B',
        ]),
      }),
      'math.pure.core_a',
    );
    expect(full.state).toBe('complete');
  });

  it('accepts only a complete official science path, never a mixed one (criterion 35)', () => {
    const mixed = req(
      makeScenario({ plannedCourses: completed(['CHEM 1A', 'PHYSICS 7D', 'PHYSICS 7E']) }),
      'math.pure.core_b',
    );
    expect(mixed.state).toBe('unmet');

    const chem = req(
      makeScenario({ plannedCourses: completed(['CHEM 1A', 'CHEM 1B', 'CHEM 1C']) }),
      'math.pure.core_b',
    );
    expect(chem.state).toBe('complete');
    expect(chem.detail).toMatch(/CHEM 1A, 1B, 1C/);

    const physics = req(
      makeScenario({ plannedCourses: completed(['PHYSICS 7C', 'PHYSICS 7D', 'PHYSICS 7E']) }),
      'math.pure.core_b',
    );
    expect(physics.state).toBe('complete');

    const statsPath = req(
      makeScenario({ plannedCourses: completed(['STATS 7', 'MATH 10', 'PHYSICS 7C']) }),
      'math.pure.core_b',
    );
    expect(statsPath.state).toBe('complete');
  });

  it('includes MATH 2E, 120B, 121B, and 147 in the Pure additions (criterion 36)', () => {
    const scenario = makeScenario({
      plannedCourses: completed(['MATH 2E', 'MATH 120B', 'MATH 121B', 'MATH 147']),
    });
    for (const id of [
      'math.pure.lower.math_2e',
      'math.pure.upper.math_120b',
      'math.pure.upper.math_121b',
      'math.pure.upper.math_147',
    ]) {
      expect(req(scenario, id).state).toBe('complete');
    }
  });

  it('accepts only four-unit MATH 100-189 lecture courses as additional electives (criterion 37)', () => {
    const eligible = req(
      makeScenario({
        plannedCourses: completed(['MATH 110A', 'MATH 117', 'MATH 118', 'MATH 130B', 'MATH 134A']),
      }),
      'math.pure.upper.electives',
    );
    expect(eligible.state).toBe('complete');
    expect(eligible.satisfied).toBe(5);

    // MATH 105LA is a 2-unit lab and MATH 13 is lower division: neither counts.
    const ineligible = req(
      makeScenario({ plannedCourses: completed(['MATH 105LA', 'MATH 13']) }),
      'math.pure.upper.electives',
    );
    expect(ineligible.satisfied).toBe(0);
  });

  it('does not silently reuse named required courses as additional electives (criterion 38)', () => {
    // Every MATH course here is already required by name elsewhere.
    const result = req(
      makeScenario({
        plannedCourses: completed(['MATH 120A', 'MATH 121A', 'MATH 130A', 'MATH 140A', 'MATH 147']),
      }),
      'math.pure.upper.electives',
    );
    expect(result.satisfied).toBe(0);
    expect(result.state).toBe('unmet');
  });
});

// ---------------------------------------------------------------------------
// Applied and Computational Mathematics
// ---------------------------------------------------------------------------

describe('Applied and Computational Mathematics', () => {
  const applied = (courses: string[]) =>
    makeScenario({ mathProgram: 'applied_math', plannedCourses: completed(courses) });

  it('is mutually exclusive with Mathematics B.S. (criteria 64, 65)', () => {
    const pure = activeProgramsFor('pure_math').map((p) => p.id);
    expect(pure).toContain('mathematics_bs_pure');
    expect(pure).not.toContain('applied_computational_mathematics_bs');

    const app = activeProgramsFor('applied_math').map((p) => p.id);
    expect(app).toContain('applied_computational_mathematics_bs');
    expect(app).not.toContain('mathematics_bs_pure');
  });

  it('requires both halves of each 105-series lecture and lab pair', () => {
    const lectureOnly = req(applied(['MATH 105A']), 'math.applied.upper_core.math_105a');
    expect(lectureOnly.state).toBe('unmet');
    expect(lectureOnly.detail).toMatch(/MATH 105LA/);

    const pair = req(applied(['MATH 105A', 'MATH 105LA']), 'math.applied.upper_core.math_105a');
    expect(pair.state).toBe('complete');
  });

  it('counts exactly three individual additional lower-division selections', () => {
    const two = req(applied(['CHEM 1A', 'STATS 7']), 'math.applied.additional_lower');
    expect(two.state).toBe('unmet');
    expect(two.satisfied).toBe(2);

    // Three individual picks, deliberately not a single sequence.
    const three = req(applied(['CHEM 1A', 'STATS 7', 'PHYSICS 7C']), 'math.applied.additional_lower');
    expect(three.state).toBe('complete');
    expect(three.satisfied).toBe(3);
  });

  it('requires MATH 112A, 112B, and 115', () => {
    expect(req(applied(['MATH 112A', 'MATH 112B']), 'math.applied.sequence').state).toBe('unmet');
    expect(req(applied(['MATH 112A', 'MATH 112B', 'MATH 115']), 'math.applied.sequence').state).toBe('complete');
  });

  it('preserves the MATH 107 + 107L pairing as one elective selection', () => {
    const partial = req(applied(['MATH 107', 'MATH 117', 'MATH 118']), 'math.applied.math_electives');
    // MATH 107 without 107L does not count, so only two selections stand.
    expect(partial.satisfied).toBe(2);

    const full = req(applied(['MATH 107', 'MATH 107L', 'MATH 117', 'MATH 118']), 'math.applied.math_electives');
    expect(full.satisfied).toBe(3);
    expect(full.state).toBe('complete');
  });

  it('accepts only listed outside-Mathematics electives (criteria 66, 67)', () => {
    const listed = req(applied(['COMPSCI 161', 'ECON 100A']), 'math.applied.outside_electives');
    expect(listed.state).toBe('complete');
    expect(listed.satisfied).toBe(2);

    // COMPSCI 175 is not on the official outside list.
    const unlisted = req(applied(['COMPSCI 175', 'COMPSCI 154']), 'math.applied.outside_electives');
    expect(unlisted.satisfied).toBe(0);
    expect(unlisted.state).toBe('unmet');
    expect(unlisted.verificationNote).toMatch(/adviser-approved substitution/);
  });

  it('marks an adviser confirmation complete only when an override records it', () => {
    const withoutNote = req(applied([]), 'eligibility.physci.double_major_advising');
    expect(withoutNote.state).toBe('unknown');

    const scenario = makeScenario({
      mathProgram: 'applied_math',
      overrides: [override('eligibility.physci.double_major_advising', 'Met adviser 2027-01-14; approved.')],
    });
    const withNote = req(scenario, 'eligibility.physci.double_major_advising');
    expect(withNote.state).toBe('complete');
    expect(withNote.viaOverride).toBe(true);
    expect(withNote.detail).toMatch(/approved/i);
  });
});

// ---------------------------------------------------------------------------
// General Education
// ---------------------------------------------------------------------------

describe('General Education', () => {
  it('never lets one course fill both Va and Vb (criterion 22)', () => {
    // I&C SCI 32 is printed "(II and (VA or VB).)" — it carries both options
    // but the allocator may consume only one of them.
    const dual = COURSE_INDEX.get('I&C SCI 32')!;
    const categories = dual.geCategories.map((g) => g.category);
    expect(categories).toContain('Va');
    expect(categories).toContain('Vb');
    expect(dual.geCategories.find((g) => g.category === 'Va')!.exclusiveWithin).toEqual(['Va', 'Vb']);

    const scenario = makeScenario({ plannedCourses: completed(['I&C SCI 32']) });
    const result = audit(scenario);
    const claimId = result.claims.find((c) => c.code === 'I&C SCI 32')!.id;
    const usedBy = (result.allocation.claimUsage.get(claimId) ?? []).filter((id) =>
      ['ge.Va', 'ge.Vb', 'ge.V_third'].includes(id),
    );
    expect(usedBy).toHaveLength(1);
  });

  it('lets one approved course fill GE and a major rule at once (criterion 23)', () => {
    const scenario = makeScenario({ plannedCourses: completed(['I&C SCI 6D']) });
    const result = audit(scenario);
    const claimId = result.claims.find((c) => c.code === 'I&C SCI 6D')!.id;
    const usedBy = result.allocation.claimUsage.get(claimId) ?? [];

    expect(usedBy).toContain('cs.lower.i_c_sci_6d');
    expect(usedBy.some((id) => id.startsWith('ge.'))).toBe(true);
  });

  it('lets I&C SCI 139W fill CS core and GE upper-division writing (criterion 24)', () => {
    expect(COURSE_INDEX.get('I&C SCI 139W')!.geCategories.map((g) => g.category)).toContain('Ib');

    const scenario = makeScenario({ plannedCourses: completed(['I&C SCI 139W']) });
    const result = audit(scenario);
    const claimId = result.claims.find((c) => c.code === 'I&C SCI 139W')!.id;
    const usedBy = result.allocation.claimUsage.get(claimId) ?? [];

    expect(usedBy).toContain('cs.upper.core.i_c_sci_139w');
    expect(usedBy).toContain('ge.Ib');
  });

  it('shows all eight GE categories with the Va/Vb structure (criterion 21)', () => {
    const result = audit(makeScenario());
    const ge = result.allocation.programs.find((p) => p.category === 'ge')!;
    const ids = ge.requirements.map((r) => r.requirementId);

    expect(ids).toEqual([
      'ge.Ia', 'ge.Ib', 'ge.II', 'ge.III', 'ge.IV',
      'ge.Va', 'ge.Vb', 'ge.V_third', 'ge.VI', 'ge.VII', 'ge.VIII',
    ]);
    expect(ge.requirements.find((r) => r.requirementId === 'ge.Ia')!.needed).toBe(2);
    expect(ge.requirements.find((r) => r.requirementId === 'ge.II')!.needed).toBe(3);
    expect(ge.requirements.find((r) => r.requirementId === 'ge.VII')!.needed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Units, GPA, residence
// ---------------------------------------------------------------------------

describe('units, GPA, and residence', () => {
  it('tracks 180 units, GPA categories, and residence separately (criterion 25)', () => {
    const scenario = makeScenario({
      plannedCourses: [
        ...completed(['MATH 2A', 'I&C SCI 31'], 'A'),
        ...planned(['MATH 2B']),
      ],
    });
    const result = audit(scenario);

    expect(result.units.completed).toBeGreaterThan(0);
    expect(result.units.planned).toBeGreaterThan(0);
    expect(result.units.projected).toBe(
      result.units.completed + result.units.inProgress + result.units.planned + result.units.external,
    );

    const unitRule = requireRequirement(result.allocation.programs, 'uci.units.180');
    expect(unitRule.needed).toBe(180);
    expect(unitRule.state).toBe('unmet');

    expect(result.gpas.map((g) => g.key)).toEqual([
      'overall', 'cs_major', 'cs_upper', 'math_major', 'math_upper',
    ]);
  });

  it('never shows a residence checkmark while future modality is unknown (criterion 26)', () => {
    const result = audit(makeScenario({ plannedCourses: completed(['MATH 2A']) }));
    const residence = requireRequirement(result.allocation.programs, 'uci.residence.final45');
    const modality = requireRequirement(result.allocation.programs, 'uci.modality.fifty_percent');

    expect(residence.state).toBe('unknown');
    expect(modality.state).toBe('unknown');
    expect(residence.detail).toMatch(/cannot yet be verified/);
  });

  it('excludes exam credit and P/NP work from every GPA', () => {
    const scenario = makeScenario({
      plannedCourses: [
        placement({ code: 'MATH 2A', termId: '2026-fall', status: 'completed', grade: 'A', gradeBasis: 'letter' }),
        placement({ code: 'MATH 2B', termId: '2026-fall', status: 'completed', grade: 'P', gradeBasis: 'pass_no_pass' }),
      ],
      externalExams: [exam('calculus_bc', 'Calculus BC', '5')],
    });
    const result = audit(scenario);
    const overall = result.gpas.find((g) => g.key === 'overall')!;

    // Only MATH 2A (4 units, A) contributes.
    expect(overall.gpa).toBe(4);
    expect(overall.gradedUnits).toBe(4);
    expect(overall.note).toMatch(/Exam credit and P\/NP work excluded/);
  });

  it('reports a GPA as unknown rather than zero when nothing is graded yet', () => {
    const result = audit(makeScenario({ plannedCourses: planned(['MATH 2A']) }));
    const overall = result.gpas.find((g) => g.key === 'overall')!;
    expect(overall.gpa).toBeUndefined();

    const gpaRule = requireRequirement(result.allocation.programs, 'uci.gpa.overall');
    expect(gpaRule.state).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Double major
// ---------------------------------------------------------------------------

describe('double-major behaviour', () => {
  it('shows MATH 2A and 2B satisfying both majors (criterion 39)', () => {
    const scenario = makeScenario({ plannedCourses: completed(['MATH 2A', 'MATH 2B']) });
    const result = audit(scenario);

    for (const code of ['MATH 2A', 'MATH 2B']) {
      const claimId = result.claims.find((c) => c.code === code)!.id;
      const usedBy = result.allocation.claimUsage.get(claimId) ?? [];
      expect(usedBy.some((id) => id.startsWith('cs.'))).toBe(true);
      expect(usedBy.some((id) => id.startsWith('math.'))).toBe(true);
    }
  });

  it('lets Physical Sciences courses serve CS science and the Math sequence (criterion 40)', () => {
    const scenario = makeScenario({ plannedCourses: completed(['CHEM 1A', 'CHEM 1B', 'CHEM 1C']) });
    const result = audit(scenario);

    expect(requireRequirement(result.allocation.programs, 'math.pure.core_b').state).toBe('complete');
    expect(requireRequirement(result.allocation.programs, 'cs.lower.science').state).toBe('complete');
  });

  it('includes ICS and Physical Sciences eligibility checks without promising admission (criteria 41, 42)', () => {
    const result = audit(makeScenario());
    const eligibility = result.allocation.programs.find((p) => p.category === 'eligibility')!;
    const ids = eligibility.requirements.map((r) => r.requirementId);

    expect(ids).toContain('eligibility.ics.screening_courses');
    expect(ids).toContain('eligibility.physci.double_major_advising');

    const advising = requireRequirement(result.allocation.programs, 'eligibility.physci.double_major_advising');
    expect(advising.state).toBe('unknown');
    expect(advising.detail).toMatch(/cannot verify/i);

    const screening = requireRequirement(result.allocation.programs, 'eligibility.ics.screening_courses');
    expect(screening.verificationNote).toMatch(/Ungraded AP\/IB awards do not count/);
  });
});
