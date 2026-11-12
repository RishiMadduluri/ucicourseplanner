import { describe, expect, it } from 'vitest';
import { findAward, listApExams } from '../../src/domain/externalCredit/apAwards';
import { previewAward, resolveExternalCredit } from '../../src/domain/externalCredit/resolve';
import { runAudit } from '../../src/domain/audit/audit';
import {
  ALL_COURSE_CODES,
  COURSE_INDEX,
  completed,
  exam,
  requireRequirement,
  makePlan,
  makeScenario,
} from '../helpers';
import type { Scenario } from '../../src/domain/plan/types';

function audit(scenario: Scenario) {
  return runAudit({ plan: makePlan(scenario), scenario, courseIndex: COURSE_INDEX, allCourseCodes: ALL_COURSE_CODES });
}

describe('AP award table', () => {
  it('awards Calculus AB 3 four units with a MATH 2A / MATH 5A alternative (seed test 1)', () => {
    const rule = findAward('calculus_ab', 3)!;
    expect(rule.units).toBe(4);
    expect(rule.equivalentCourseOptions).toEqual([['MATH 2A'], ['MATH 5A']]);
    expect(rule.electiveOnly).toBe(false);
  });

  it('gives Calculus BC 3 eight units but only the first course of the sequence (seed test 2)', () => {
    const rule = findAward('calculus_bc', 3)!;
    expect(rule.units).toBe(8);
    expect(rule.equivalentCourseOptions).toEqual([['MATH 2A'], ['MATH 5A']]);
    expect(rule.programUseLimitation).toMatch(/only the first course/i);
  });

  it('clears MATH 2A and MATH 2B at BC 4-5 (criterion 59, seed test 3)', () => {
    for (const score of [4, 5]) {
      const rule = findAward('calculus_bc', score)!;
      expect(rule.units).toBe(8);
      expect(rule.equivalentCourseOptions).toEqual([
        ['MATH 2A', 'MATH 2B'],
        ['MATH 5A', 'MATH 5B'],
      ]);
    }
  });

  it('supports the BC AB-subscore route (seed test 4)', () => {
    const rule = findAward('calculus_bc_ab_subscore', 3)!;
    expect(rule.units).toBe(4);
    expect(rule.equivalentCourseOptions).toEqual([['MATH 2A'], ['MATH 5A']]);
    expect(rule.programUseLimitation).toMatch(/AB subscore/i);
  });

  it('makes Computer Science A elective-only (criterion 60, seed test 5)', () => {
    const rule = findAward('computer_science_a', 5)!;
    expect(rule.units).toBe(8);
    expect(rule.electiveOnly).toBe(true);
    expect(rule.equivalentCourseOptions).toEqual([]);
    expect(rule.duplicateWithCourseCodes).toEqual([]);
    expect(rule.programUseLimitation).toMatch(/does not clear I&C SCI 31, 32, or 33/i);
  });

  it('maps Computer Science Principles to I&C SCI 20 only (criterion 61, seed test 6)', () => {
    const rule = findAward('computer_science_principles', 4)!;
    expect(rule.equivalentCourseOptions).toEqual([['I&C SCI 20']]);
    expect(rule.programUseLimitation).toMatch(/not part of the Computer Science major programming series/i);
  });

  it('maps Statistics to STATS 7 but never STATS 67 (criterion 62, seed test 7)', () => {
    const rule = findAward('statistics', 5)!;
    const allCodes = rule.equivalentCourseOptions.flat();
    expect(allCodes).toContain('STATS 7');
    expect(allCodes).not.toContain('STATS 67');
    expect(rule.programUseLimitation).toMatch(/Does not satisfy STATS 67/i);
  });

  it('maps Chemistry 4-5 to CHEM 1A or ENGR 1A plus elective units (seed test 8)', () => {
    const rule = findAward('chemistry', 5)!;
    expect(rule.equivalentCourseOptions).toEqual([['CHEM 1A'], ['ENGR 1A']]);
    expect(rule.additionalElectiveUnits).toBe(4);
  });

  it('gives Research and Seminar ELWR with zero units (seed test 10)', () => {
    for (const key of ['research', 'seminar']) {
      const rule = findAward(key, 4)!;
      expect(rule.units).toBe(0);
      expect(rule.universityRequirementEffects).toContain('elwr');
    }
  });

  it('never maps AP Physics to the PHYSICS 7 sequence', () => {
    const codes = ['physics_1', 'physics_2', 'physics_c_mechanics', 'physics_c_electricity_magnetism']
      .flatMap((key) => [3, 4, 5].map((s) => findAward(key, s)))
      .filter(Boolean)
      .flatMap((rule) => rule!.equivalentCourseOptions.flat());

    expect(codes).not.toContain('PHYSICS 7C');
    expect(codes).not.toContain('PHYSICS 7D');
    expect(codes).not.toContain('PHYSICS 7E');
  });

  it('lists every exam for the onboarding picker', () => {
    const exams = listApExams();
    expect(exams.length).toBeGreaterThan(35);
    expect(exams.map((e) => e.examName)).toContain('Calculus BC');
    expect(exams.map((e) => e.examName)).toContain('Computer Science Principles');
  });
});

describe('external-credit resolution', () => {
  it('normalizes semester coursework separately from exam units', () => {
    const result = resolveExternalCredit(
      [exam('calculus_ab', 'Calculus AB', '5')],
      [{
        id: 'semester-course',
        institution: 'Local College',
        courseTitle: 'Calculus I',
        units: 3,
        unitSystem: 'semester',
        equivalentCourseCodes: ['MATH 2A'],
        source: 'transfer',
      }],
    );

    expect(result.examUnits).toBe(4);
    expect(result.manualQuarterUnits).toBe(4.5);
    expect(result.totalExternalUnits).toBe(8.5);
  });

  it('keeps manually entered AP/IB units in the exam bucket', () => {
    const result = resolveExternalCredit([], [{
      id: 'manual-ib',
      institution: 'IB',
      courseTitle: 'IB Mathematics HL',
      units: 8,
      equivalentCourseCodes: ['MATH 2A', 'MATH 2B'],
      source: 'ib',
    }]);

    expect(result.examUnits).toBe(8);
    expect(result.manualQuarterUnits).toBe(0);
  });

  it('caps the two English exams at eight units total (seed test 9)', () => {
    const result = resolveExternalCredit([
      exam('english_language', 'English Language and Composition', '5'),
      exam('english_literature', 'English Literature and Composition', '5'),
    ]);

    expect(result.totalExternalUnits).toBe(8);
    const capped = result.awards.find((a) => a.capNote);
    expect(capped?.capNote).toMatch(/capped at 8 units/);
  });

  it('adds the second GE IV course only when both English exams are held', () => {
    const single = resolveExternalCredit([exam('english_language', 'English Language and Composition', '5')]);
    expect(single.geEffects.filter((g) => g.category === 'IV')).toHaveLength(1);
    expect(single.combinationNotes).toHaveLength(0);

    const both = resolveExternalCredit([
      exam('english_language', 'English Language and Composition', '5'),
      exam('english_literature', 'English Literature and Composition', '4'),
    ]);
    expect(both.geEffects.filter((g) => g.category === 'IV')).toHaveLength(3);
    expect(both.combinationNotes[0]).toMatch(/two English courses toward GE IV/);
  });

  it('caps the physics family at eight units', () => {
    const result = resolveExternalCredit([
      exam('physics_1', 'Physics 1', '5'),
      exam('physics_2', 'Physics 2', '5'),
    ]);
    expect(result.totalExternalUnits).toBe(8);
  });

  it('keeps elective-only credit out of the usable-equivalence set', () => {
    const result = resolveExternalCredit([exam('computer_science_a', 'Computer Science A', '5')]);
    expect(result.equivalentCourseCodes.size).toBe(0);
    expect(result.totalExternalUnits).toBe(8);
  });

  it('records duplicate-credit bars and ELWR evidence', () => {
    const result = resolveExternalCredit([
      exam('calculus_bc', 'Calculus BC', '5'),
      exam('english_language', 'English Language and Composition', '4'),
    ]);
    expect(result.duplicateBarredCourseCodes.has('MATH 2A')).toBe(true);
    expect(result.duplicateBarredCourseCodes.has('MATH 2B')).toBe(true);
    expect(result.satisfiedRequirementKeys.has('elwr')).toBe(true);
  });

  it('emits prerequisite evidence keys usable by exam nodes', () => {
    const result = resolveExternalCredit([exam('calculus_bc', 'Calculus BC', '5')]);
    expect(result.prerequisiteEvidenceKeys.has('AP CALCULUS BC>=4')).toBe(true);
    expect(result.prerequisiteEvidenceKeys.has('AP CALCULUS BC>=5')).toBe(true);
    expect(result.prerequisiteEvidenceKeys.has('AP CALCULUS BC>=6')).toBe(false);
  });

  it('returns unknown_needs_verification for an unmapped exam', () => {
    const result = resolveExternalCredit([exam('underwater_basket_weaving', 'Underwater Basket Weaving', '5')]);
    expect(result.awards[0]!.status).toBe('unknown_needs_verification');
    expect(result.totalExternalUnits).toBe(0);
  });

  it('previews every official effect before the exam is saved (criterion 58)', () => {
    const lines = previewAward('calculus_bc', 5).join('\n');
    expect(lines).toMatch(/8 UCI units/);
    expect(lines).toMatch(/MATH 2A \+ MATH 2B/);
    expect(lines).toMatch(/MATH 5A \+ MATH 5B/);
    expect(lines).toMatch(/Duplicate-credit bar/);
    expect(lines).toMatch(/no letter grade/);

    const csa = previewAward('computer_science_a', 4).join('\n');
    expect(csa).toMatch(/Elective credit only/);
  });
});

describe('AP credit inside the audit', () => {
  it('creates usable claims for adviser-verified prior-college equivalencies', () => {
    const result = audit(makeScenario({
      manualCredits: [{
        id: 'cc-statistics',
        institution: 'Local College',
        courseTitle: 'Introduction to Statistics',
        units: 4,
        equivalentCourseCodes: ['STATS 7'],
        source: 'transfer',
        verifiedBy: 'UCI transfer-credit evaluator',
      }],
    }));

    const claim = result.claims.find((candidate) => candidate.id === 'manual:cc-statistics:STATS 7');
    expect(claim).toMatchObject({ code: 'STATS 7', source: 'transfer', externalEquivalencyVerified: true });
    expect(requireRequirement(result.allocation.programs, 'math.pure.core_b').state).toBe('unmet');
  });

  it('lets AP Calculus BC 4-5 satisfy MATH 2A and MATH 2B as named requirements', () => {
    const scenario = makeScenario({ externalExams: [exam('calculus_bc', 'Calculus BC', '5')] });
    const result = audit(scenario);

    expect(requireRequirement(result.allocation.programs, 'cs.lower.math_2a').state).toBe('complete');
    expect(requireRequirement(result.allocation.programs, 'cs.lower.math_2b').state).toBe('complete');
    expect(requireRequirement(result.allocation.programs, 'math.pure.core_a.math_2a').state).toBe('complete');
    expect(result.units.external).toBe(8);
  });

  it('does not let AP Computer Science A satisfy the programming series (criterion 60)', () => {
    const scenario = makeScenario({ externalExams: [exam('computer_science_a', 'Computer Science A', '5')] });
    const result = audit(scenario);

    expect(requireRequirement(result.allocation.programs, 'cs.lower.programming_series').state).toBe('unmet');
    // Units are still awarded.
    expect(result.units.external).toBe(8);
  });

  it('does not let AP Statistics satisfy STATS 67 (criterion 62)', () => {
    const scenario = makeScenario({ externalExams: [exam('statistics', 'Statistics', '5')] });
    const result = audit(scenario);
    expect(requireRequirement(result.allocation.programs, 'cs.lower.stats_67').state).toBe('unmet');
  });

  it('flags a UCI course that duplicates an exam award and assigns no grade (criterion 63)', () => {
    const scenario = makeScenario({
      externalExams: [exam('calculus_bc', 'Calculus BC', '5')],
      plannedCourses: completed(['MATH 2A']),
    });
    const result = audit(scenario);

    expect(result.externalCredit.duplicateBarredCourseCodes.has('MATH 2A')).toBe(true);

    // The award never fabricates a letter grade.
    const awardClaims = result.claims.filter((c) => c.id.startsWith('award:'));
    for (const claim of awardClaims) {
      expect(claim.grade).toBeUndefined();
      expect(claim.gradeBasis).toBe('external');
    }
  });

  it('clears ELWR and American History from exam evidence', () => {
    const scenario = makeScenario({
      externalExams: [
        exam('english_language', 'English Language and Composition', '4'),
        exam('us_government', 'U.S. Government and Politics', '5'),
      ],
    });
    const result = audit(scenario);

    expect(requireRequirement(result.allocation.programs, 'uc.elwr').state).toBe('complete');
    expect(requireRequirement(result.allocation.programs, 'uc.american_history_institutions').state).toBe('complete');
  });
});
