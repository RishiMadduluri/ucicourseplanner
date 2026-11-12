import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COURSE_INDEX } from '../helpers';
import type { Claim } from '../../src/domain/requirements/allocate';
import {
  TRANSFER_INSTITUTIONS,
  TRANSFER_PROGRAMS,
  findProgram,
  isTransferSourceStale,
  registryProblems,
} from '../../src/domain/transfer/registry';
import type { TransferSatisfaction } from '../../src/domain/transfer/types';
import { quarterToSemesterUnits } from '../../src/domain/transfer/types';
import {
  buildSnapshot,
  checkRequirement,
  evaluateProgram,
  evaluateEligibility,
} from '../../src/domain/transfer/evaluate';
import {
  applicationCyclesForProgram,
  deadlineRegistryProblems,
  evaluateApplicationCycle,
} from '../../src/domain/transfer/deadlines';
import type { ApplicationCycle } from '../../src/domain/transfer/deadlines';
import { buildTimeline } from '../../src/domain/terms/terms';

/**
 * The transfer dataset is research, not code, so most of these tests are
 * integrity checks on the data itself: every course the rules name has to exist
 * in the real UCI catalogue, every program has to cite a source, and the
 * schools whose published rules are unusually sharp (Cornell's closed CS major,
 * Yale's grade distribution, Brown's quarter windows) have to survive a
 * concrete plan.
 */

// The full 2026-27 snapshot, not the test fixture slice: transfer rules name
// courses across the whole catalogue.
const FULL_CATALOGUE = JSON.parse(
  readFileSync(path.join(process.cwd(), 'data/normalized/catalogue/2026-27/courses.json'), 'utf8'),
) as { courses: Array<{ normalizedCode: string }> };

const REAL_CODES = new Set(FULL_CATALOGUE.courses.map((c) => c.normalizedCode));

function codesIn(node: TransferSatisfaction, out: string[] = []): string[] {
  switch (node.kind) {
    case 'course':
      out.push(node.code);
      break;
    case 'all_of':
    case 'any_of':
    case 'n_of':
      node.children.forEach((child) => codesIn(child, out));
      break;
    case 'course_range':
      (node.filter.codes ?? []).forEach((code) => out.push(code));
      break;
    case 'external_evidence':
      break;
  }
  return out;
}

const TERM_SEQUENCE = new Map<string, number>([
  ['2026-summer-session_1', 0],
  ['2026-fall', 1],
  ['2027-winter', 2],
  ['2027-spring', 3],
  ['2027-summer-session_1', 4],
  ['2027-fall', 5],
  ['2028-winter', 6],
  ['2028-spring', 7],
  ['2028-fall', 8],
  ['2029-winter', 9],
  ['2029-spring', 10],
]);

let claimCounter = 0;
function claim(spec: {
  code: string;
  termId?: string;
  status?: Claim['status'];
  grade?: Claim['grade'];
  units?: number;
  external?: boolean;
  source?: Claim['source'];
  gradeBasis?: Claim['gradeBasis'];
  externalEquivalencyVerified?: boolean;
}): Claim {
  claimCounter += 1;
  return {
    id: `c${claimCounter}`,
    code: spec.code,
    units: spec.units ?? 4,
    status: spec.status ?? 'completed',
    grade: spec.grade,
    external: spec.external ?? false,
    source: spec.source,
    externalEquivalencyVerified: spec.externalEquivalencyVerified,
    gradeBasis: spec.gradeBasis,
    termId: spec.termId,
    department: spec.code.replace(/\s+\S+$/, ''),
    numericValue: Number(spec.code.replace(/^\D+/, '').replace(/\D+$/, '')) || 0,
    level: 'lower',
    geCategories: [],
    geExclusiveSets: [],
    title: spec.code,
  };
}

function snapshotOf(claims: Claim[], lastTermId = '2028-spring') {
  return buildSnapshot(claims, TERM_SEQUENCE, lastTermId, lastTermId);
}

const TIMELINE = buildTimeline().allTerms;

function cycleOf(programId: string, entryTerm: ApplicationCycle['entryTerm'], entryYear: number, round?: string) {
  const entry = findProgram(programId)!;
  return applicationCyclesForProgram(entry.institution, entry.program)
    .find((cycle) => cycle.entryTerm === entryTerm && cycle.entryYear === entryYear && cycle.round === round)!;
}

function deadlineAuditOf(programId: string, cycle: ApplicationCycle, claims: Claim[]) {
  const entry = findProgram(programId)!;
  return evaluateApplicationCycle(
    entry.institution,
    entry.program,
    cycle,
    TIMELINE,
    claims,
    COURSE_INDEX,
    { examQuarterUnits: 0, manualQuarterUnits: 0 },
  );
}

// ---------------------------------------------------------------------------
// Dataset integrity
// ---------------------------------------------------------------------------

describe('transfer registry integrity', () => {
  it('covers all 27 institutions the student named', () => {
    expect(TRANSFER_INSTITUTIONS).toHaveLength(27);
  });

  it('has no duplicate ids, orphan references, or uncited programs', () => {
    expect(registryProblems()).toEqual([]);
  });

  it('has a structured cycle for every advertised entry term of all 72 programs', () => {
    expect(deadlineRegistryProblems(TRANSFER_INSTITUTIONS)).toEqual([]);
  });

  it('names only UCI courses that exist in the 2026-27 catalogue', () => {
    const bad: string[] = [];
    for (const { program } of TRANSFER_PROGRAMS) {
      for (const requirement of program.requirements) {
        for (const code of codesIn(requirement.satisfiedBy)) {
          if (!REAL_CODES.has(code)) bad.push(`${requirement.id} -> ${code}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('gives every program at least one source URL and a retrieval date', () => {
    for (const { program } of TRANSFER_PROGRAMS) {
      expect(program.sourceUrls.length).toBeGreaterThan(0);
      expect(program.retrievedAt).toBe('2026-08-31');
    }
  });

  it('only calls a requirement "required" when the school actually published it', () => {
    // `required` is documented as "missing it makes the application ineligible
    // or unreviewable". A course inferred from a degree chart has never been
    // said by anyone to gate admission, so labelling it required would put a
    // hard badge on a soft fact — and `req()` defaults necessity to 'required',
    // which makes that easy to do by omission. CMU, Rice, Harvard, Stanford and
    // friends publish no transfer course list; their preparation belongs under
    // "recommended", and their coursework readiness should read
    // "No published course list".
    const overclaimed: string[] = [];
    for (const { institution, program } of TRANSFER_PROGRAMS) {
      for (const requirement of program.requirements) {
        if (requirement.necessity !== 'required') continue;
        if (requirement.confidence === 'published_requirement') continue;
        overclaimed.push(`${institution.shortName}/${program.id} [${requirement.confidence}] ${requirement.title}`);
      }
    }
    expect(overclaimed).toEqual([]);
  });

  it('marks every requirement with a confidence level, never silently claiming articulation', () => {
    for (const { program } of TRANSFER_PROGRAMS) {
      for (const requirement of program.requirements) {
        expect(requirement.confidence).toBeDefined();
      }
    }
  });

  it('flags transfer research after the six-month review interval', () => {
    const now = new Date('2027-03-10T00:00:00Z');
    expect(isTransferSourceStale('2026-08-31', now)).toBe(true);
    expect(isTransferSourceStale('2027-01-15', now)).toBe(false);
    expect(isTransferSourceStale('not-a-date', now)).toBe(true);
  });

  it('keeps current entry-term and deadline distinctions for the audited live pages', () => {
    const gatech = findProgram('gatech.cs_bs')!;
    expect(gatech.program.eligibility.entryTerms).toEqual(['fall', 'spring', 'summer']);
    expect(gatech.program.eligibility.deadlines).toContain(
      'Fall: apply January 18–March 1; documents due March 16; course requirements due May 30',
    );
    expect(gatech.institution.institutionSourceUrls).toContain(
      'https://admission.gatech.edu/transfer/deadlines-fees',
    );
    expect(gatech.program.sourceUrls.some((url) => url.includes('visits.gatech.edu'))).toBe(false);

    expect(findProgram('utaustin.cs_bs')!.program.eligibility.entryTerms).toEqual(['fall']);
    expect(findProgram('utaustin.math_bs')!.program.eligibility.entryTerms).toEqual([
      'fall',
      'spring',
      'summer',
    ]);

    for (const programId of ['cornell.cs_bs_eng', 'cornell.ece_bs', 'cornell.cs_ba', 'cornell.math_ba']) {
      expect(findProgram(programId)!.program.eligibility.deadlines.join(' ')).toContain('April 15');
    }

    expect(findProgram('uchicago.college')!.program.eligibility.deadlines[0]).toContain(
      'Historical planning placeholder: March 1',
    );
  });
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

describe('transfer snapshot', () => {
  it('ignores coursework after the chosen last UCI term', () => {
    const claims = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2029-spring', grade: 'A' }),
    ];
    const snapshot = snapshotOf(claims, '2027-spring');
    expect(snapshot.claims.map((c) => c.code)).toEqual(['MATH 2A']);
  });

  it('keeps external credit regardless of term', () => {
    const claims = [claim({ code: 'MATH 2A', external: true, status: 'waived' })];
    expect(snapshotOf(claims).claims).toHaveLength(1);
  });

  it('drops failed and not-taken placements', () => {
    const claims = [
      claim({ code: 'MATH 2A', termId: '2026-fall', status: 'failed', grade: 'F' }),
      claim({ code: 'MATH 2B', termId: '2026-fall', status: 'not_taken' }),
    ];
    expect(snapshotOf(claims).claims).toHaveLength(0);
  });

  it('counts regular quarters and summer terms separately', () => {
    const claims = [
      claim({ code: 'MATH 2A', termId: '2026-fall' }),
      claim({ code: 'MATH 2B', termId: '2027-winter' }),
      claim({ code: 'MATH 2D', termId: '2027-spring' }),
      claim({ code: 'MATH 3A', termId: '2027-summer-session_1' }),
    ];
    const snapshot = snapshotOf(claims);
    expect(snapshot.regularQuartersCompleted).toBe(3);
    expect(snapshot.summerTermsCompleted).toBe(1);
  });

  it('converts UCI quarter units to semester units at two thirds', () => {
    const claims = [claim({ code: 'MATH 2A', termId: '2026-fall', units: 12 })];
    const snapshot = snapshotOf(claims);
    expect(snapshot.quarterUnits).toBe(12);
    expect(snapshot.semesterUnitsEquivalent).toBeCloseTo(8, 5);
    expect(quarterToSemesterUnits(90)).toBeCloseTo(60, 5);
  });

  it('computes a unit-weighted GPA and the A-or-B fraction', () => {
    const claims = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A', units: 4 }),
      claim({ code: 'MATH 2B', termId: '2026-fall', grade: 'B', units: 4 }),
      claim({ code: 'MATH 2D', termId: '2027-winter', grade: 'C', units: 4 }),
    ];
    const snapshot = snapshotOf(claims);
    expect(snapshot.gpa).toBeCloseTo((4 + 3 + 2) / 3, 5);
    expect(snapshot.fractionAtAOrB).toBeCloseTo(2 / 3, 5);
    expect(snapshot.lowestLetterGrade).toBe('C');
  });

  it('excludes external credit from the GPA', () => {
    const claims = [
      claim({ code: 'MATH 2A', grade: 'A', external: true, status: 'waived' }),
      claim({ code: 'MATH 2B', termId: '2026-fall', grade: 'C', units: 4 }),
    ];
    expect(snapshotOf(claims).gpa).toBeCloseTo(2, 5);
  });

  it('keeps classroom and exam units separate', () => {
    const snapshot = snapshotOf([
      claim({ code: 'MATH 2A', units: 84, termId: '2027-spring', grade: 'A' }),
      claim({ code: 'MATH 2B', units: 8, external: true, source: 'ap' }),
    ]);
    expect(snapshot.courseworkQuarterUnits).toBe(84);
    expect(snapshot.examQuarterUnits).toBe(8);
    expect(snapshot.quarterUnits).toBe(92);
  });
});

// ---------------------------------------------------------------------------
// Exact application cycles and UCI calendar cutoffs
// ---------------------------------------------------------------------------

describe('deadline-aware transfer audit', () => {
  it('builds exact 2027 and clearly projected 2028 Cornell cycles', () => {
    const fall2027 = cycleOf('cornell.ece_bs', 'fall', 2027);
    const fall2028 = cycleOf('cornell.ece_bs', 'fall', 2028);
    expect(fall2027.applicationDeadline).toBe('2027-03-15');
    expect(fall2027.projected).toBe(false);
    expect(fall2028.applicationDeadline).toBe('2028-03-15');
    expect(fall2028.projected).toBe(true);
  });

  it('excludes UCI spring from Cornell because it starts after March 15', () => {
    const audit = deadlineAuditOf('cornell.ece_bs', cycleOf('cornell.ece_bs', 'fall', 2027), [
      claim({ code: 'MATH 2A', termId: '2026-fall' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', status: 'in_progress' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', status: 'planned' }),
      claim({ code: 'MATH 3A', termId: '2028-fall', status: 'planned' }),
    ]);
    expect(audit.atApplication?.claims.map((entry) => entry.code)).toEqual(['MATH 2A', 'MATH 2B']);
    expect(audit.byCourseworkCutoff?.claims.map((entry) => entry.code)).toEqual(['MATH 2A', 'MATH 2B']);
    expect(audit.excludedTerms[0]?.id).toBe('2027-spring');
  });

  it('includes spring after the UC application because UC allows completion through spring', () => {
    const cycle = cycleOf('ucsd.data_science_bs', 'fall', 2027);
    const audit = deadlineAuditOf('ucsd.data_science_bs', cycle, [
      claim({ code: 'MATH 2A', termId: '2026-fall', status: 'in_progress' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', status: 'planned' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', status: 'planned' }),
      claim({ code: 'MATH 3A', termId: '2027-fall', status: 'planned' }),
    ]);
    expect(cycle.applicationDeadline).toBe('2026-11-30');
    expect(audit.atApplication?.claims.map((entry) => entry.code)).toEqual(['MATH 2A']);
    expect(audit.byCourseworkCutoff?.claims.map((entry) => entry.code)).toEqual(['MATH 2A', 'MATH 2B', 'MATH 2D']);
    expect(audit.termsAllowedAfterApplication.map((term) => term.id)).toEqual(['2027-winter', '2027-spring']);
    expect(audit.excludedTerms[0]?.id).toBe('2027-summer-session_1');
  });

  it('does not count an in-progress UCI spring course where UIUC requires completion before applying', () => {
    const cycle = cycleOf('uiuc.cs_bs', 'fall', 2027, 'Regular');
    const audit = deadlineAuditOf('uiuc.cs_bs', cycle, [
      claim({ code: 'MATH 2A', termId: '2026-fall' }),
      claim({ code: 'MATH 2B', termId: '2027-winter' }),
      claim({ code: 'I&C SCI 31', termId: '2027-spring', status: 'in_progress' }),
    ]);
    expect(audit.atApplication?.claims.map((entry) => entry.code)).toContain('I&C SCI 31');
    expect(audit.byCourseworkCutoff?.claims.map((entry) => entry.code)).not.toContain('I&C SCI 31');
  });

  it('flags Brown spring entry as impossible for a first-year UCI plan', () => {
    const cycle = cycleOf('brown.university', 'spring', 2027);
    const audit = deadlineAuditOf('brown.university', cycle, [
      claim({ code: 'MATH 2A', termId: '2026-fall' }),
    ]);
    expect(cycle.applicationDeadline).toBe('2026-10-01');
    expect(audit.readiness).toBe('not_eligible');
    expect(audit.reasons.join(' ')).toContain('exactly 5');
  });

  it('labels UChicago March 1 planning dates as historical estimates', () => {
    const cycle = cycleOf('uchicago.college', 'fall', 2027, 'Transfer Early Decision');
    const audit = deadlineAuditOf('uchicago.college', cycle, []);
    expect(cycle.applicationDeadline).toBe('2027-03-01');
    expect(cycle.projected).toBe(false);
    expect(cycle.historicalEstimate).toBe(true);
    expect(audit.readiness).not.toBe('deadline_unpublished');
    expect(audit.termsAtApplication.map((term) => term.id)).toContain('2027-winter');
    expect(audit.termsAtApplication.map((term) => term.id)).not.toContain('2027-spring');

    const rounds = applicationCyclesForProgram(
      findProgram('uchicago.college')!.institution,
      findProgram('uchicago.college')!.program,
      [2027],
    ).map((entry) => entry.round);
    expect(rounds).toEqual(['Transfer Early Decision', 'Transfer Rolling Decision priority']);
  });

  it('offers all four Michigan entry terms shown for LSA and Engineering', () => {
    const entry = findProgram('umich.ce_bse')!;
    const terms = applicationCyclesForProgram(entry.institution, entry.program, [2027])
      .map((cycle) => cycle.entryTerm);
    expect(new Set(terms)).toEqual(new Set(['fall', 'winter', 'spring', 'summer']));
  });
});

// ---------------------------------------------------------------------------
// Requirement evaluation
// ---------------------------------------------------------------------------

describe('requirement evaluation', () => {
  const berkeleyEecs = findProgram('berkeley.eecs_bs');

  function requirementOf(programId: string, requirementId: string) {
    const entry = findProgram(programId);
    if (!entry) throw new Error(`no program ${programId}`);
    const found = entry.program.requirements.find((r) => r.id === requirementId);
    if (!found) throw new Error(`no requirement ${requirementId}`);
    return found;
  }

  it('resolves a two-course sequence only when both courses are present', () => {
    const requirement = requirementOf('berkeley.eecs_bs', 'berkeley.eecs.calc');
    const partial = checkRequirement(
      requirement,
      [claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' })],
      COURSE_INDEX,
    );
    expect(partial.state).toBe('unmet');
    expect(partial.missingCodes).toContain('MATH 2B');

    const full = checkRequirement(
      requirement,
      [
        claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
        claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
      ],
      COURSE_INDEX,
    );
    expect(full.state).toBe('complete');
  });

  it('reports "planned" when the courses are on the plan but unfinished', () => {
    const requirement = requirementOf('berkeley.eecs_bs', 'berkeley.eecs.calc');
    const result = checkRequirement(
      requirement,
      [
        claim({ code: 'MATH 2A', termId: '2026-fall', status: 'planned' }),
        claim({ code: 'MATH 2B', termId: '2027-winter', status: 'planned' }),
      ],
      COURSE_INDEX,
    );
    expect(result.state).toBe('planned');
  });

  it('flags a grade below the target school\'s minimum as at risk, not complete', () => {
    // UIUC Grainger demands a B in every required technical course.
    const requirement = requirementOf('uiuc.cs_bs', 'uiuc.cs.calc1');
    const result = checkRequirement(
      requirement,
      [claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'C+' })],
      COURSE_INDEX,
    );
    expect(result.state).toBe('at_risk');
    expect(result.detail).toContain('below the B');
  });

  it('treats an external-evidence rule as unknown rather than failed', () => {
    const requirement = requirementOf('princeton.university', 'princeton.graded_paper');
    const result = checkRequirement(requirement, [], COURSE_INDEX);
    expect(result.state).toBe('unknown');
    expect(result.detail).toContain('graded paper');
  });

  it('accepts either branch of an any_of rule', () => {
    const requirement = requirementOf('ucla.math_bs', 'ucla.math.linalg_or_ode');
    const viaLinearAlgebra = checkRequirement(
      requirement,
      [claim({ code: 'MATH 3A', termId: '2027-winter', grade: 'A' })],
      COURSE_INDEX,
    );
    const viaDifferentialEquations = checkRequirement(
      requirement,
      [claim({ code: 'MATH 3D', termId: '2027-winter', grade: 'A' })],
      COURSE_INDEX,
    );
    expect(viaLinearAlgebra.state).toBe('complete');
    expect(viaDifferentialEquations.state).toBe('complete');
  });

  it('does not let one course satisfy two branches of the same all_of', () => {
    // Berkeley MATH 54 covers linear algebra AND differential equations, so
    // MATH 3A alone must not clear it.
    const requirement = requirementOf('berkeley.eecs_bs', 'berkeley.eecs.linalg_ode');
    const result = checkRequirement(
      requirement,
      [claim({ code: 'MATH 3A', termId: '2027-winter', grade: 'A' })],
      COURSE_INDEX,
    );
    expect(result.state).toBe('unmet');
    expect(result.missingCodes).toContain('MATH 3D');
  });

  it('counts distinct courses for an open lab-science range', () => {
    const requirement = requirementOf('gatech.cs_bs', 'gatech.cs.lab_sequence');
    const one = checkRequirement(
      requirement,
      [claim({ code: 'PHYSICS 7C', termId: '2026-fall', grade: 'A' })],
      COURSE_INDEX,
    );
    expect(one.state).toBe('unmet');

    const two = checkRequirement(
      requirement,
      [
        claim({ code: 'PHYSICS 7C', termId: '2026-fall', grade: 'A' }),
        claim({ code: 'PHYSICS 7D', termId: '2027-winter', grade: 'A' }),
      ],
      COURSE_INDEX,
    );
    expect(two.state).toBe('complete');
  });

  it('does not reuse a named physics course for an "additional science" rule', () => {
    // Berkeley lists two calculus-based physics courses AND one additional
    // natural science, so the same physics course must not satisfy both. The
    // two-pass rule lives in evaluateProgram, which is where a program's
    // requirements can see each other.
    const entry = findProgram('berkeley.eecs_bs');
    const physicsOnly = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
      claim({ code: 'PHYSICS 7C', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'PHYSICS 7LC', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'PHYSICS 7D', termId: '2027-winter', grade: 'A' }),
      claim({ code: 'PHYSICS 7LD', termId: '2027-winter', grade: 'A' }),
    ];
    const withoutExtra = evaluateProgram(
      entry!.institution,
      entry!.program,
      snapshotOf(physicsOnly),
      COURSE_INDEX,
    );
    const science = withoutExtra.requirementChecks.find((c) => c.requirement.id === 'berkeley.eecs.science');
    expect(science?.state).toBe('unmet');

    const withExtra = evaluateProgram(
      entry!.institution,
      entry!.program,
      snapshotOf([...physicsOnly, claim({ code: 'BIO SCI 93', termId: '2027-spring', grade: 'A' })]),
      COURSE_INDEX,
    );
    const scienceNow = withExtra.requirementChecks.find((c) => c.requirement.id === 'berkeley.eecs.science');
    expect(scienceNow?.state).toBe('complete');
    expect(scienceNow?.satisfiedBy.map((c) => c.code)).toEqual(['BIO SCI 93']);

    // The physics requirements must still be satisfied by the physics courses.
    const physicsOne = withExtra.requirementChecks.find((c) => c.requirement.id === 'berkeley.eecs.physics1');
    expect(physicsOne?.state).toBe('complete');
  });

  it('keeps the requirement order the source page uses', () => {
    const entry = findProgram('berkeley.eecs_bs');
    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf([]), COURSE_INDEX);
    expect(result.requirementChecks.map((c) => c.requirement.id)).toEqual(
      entry!.program.requirements.map((r) => r.id),
    );
  });

  it('keeps Berkeley EECS required-count separate from recommended prep', () => {
    expect(berkeleyEecs).toBeDefined();
    const required = berkeleyEecs!.program.requirements.filter((r) => r.necessity === 'required');
    expect(required.length).toBeGreaterThan(0);
    expect(berkeleyEecs!.program.requirements.some((r) => r.necessity === 'competitive')).toBe(true);
  });

  it('does not treat a UCI AP equivalency as an automatic target equivalency', () => {
    const entry = findProgram('berkeley.eecs_bs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', external: true, source: 'ap' }),
      claim({ code: 'MATH 2B', external: true, source: 'ap' }),
    ]), COURSE_INDEX);
    const calculus = result.requirementChecks.find((check) => check.requirement.id === 'berkeley.eecs.calc');
    expect(calculus?.state).toBe('unknown');
    expect(calculus?.detail).toMatch(/target equivalency|destination/i);
  });

  it('holds an undocumented prior-college equivalency for manual review', () => {
    const requirement = requirementOf('berkeley.eecs_bs', 'berkeley.eecs.calc');
    const result = checkRequirement(
      requirement,
      [
        claim({ code: 'MATH 2A', external: true, source: 'transfer', externalEquivalencyVerified: false }),
        claim({ code: 'MATH 2B', external: true, source: 'transfer', externalEquivalencyVerified: false }),
      ],
      COURSE_INDEX,
    );

    expect(result.state).toBe('unknown');
    expect(result.detail).toMatch(/not yet documented|verification/i);
  });

  it('treats AP-derived coursework as unmet where the destination awards no exam credit', () => {
    const entry = findProgram('yale.eecs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', external: true, source: 'ap' }),
      claim({ code: 'MATH 2B', external: true, source: 'ap' }),
    ]), COURSE_INDEX);
    const calculus = result.requirementChecks.find((check) => check.requirement.id === 'yale.eecs.calc');
    expect(calculus?.state).toBe('unmet');
    expect(calculus?.detail).toContain('does not earn transfer credit');
  });

  it('enforces destination letter-grade rules against explicit P/NP work', () => {
    const entry = findProgram('ucla.math_bs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'P', gradeBasis: 'pass_no_pass' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A', gradeBasis: 'letter' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', grade: 'A', gradeBasis: 'letter' }),
      claim({ code: 'MATH 2E', termId: '2027-fall', grade: 'A', gradeBasis: 'letter' }),
    ]), COURSE_INDEX);
    expect(result.requirementChecks.find((check) => check.requirement.id === 'ucla.math.calc')?.state).toBe('at_risk');
  });

  it('limits USC letter-grade enforcement to its published math, lab/programming, and writing preparation', () => {
    const entry = findProgram('usc.cs_bs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'P', gradeBasis: 'pass_no_pass' }),
      claim({ code: 'I&C SCI 6D', termId: '2026-fall', grade: 'P', gradeBasis: 'pass_no_pass' }),
    ]), COURSE_INDEX);

    expect(result.requirementChecks.find((check) => check.requirement.id === 'usc.cs.calc1')?.state).toBe('at_risk');
    expect(result.requirementChecks.find((check) => check.requirement.id === 'usc.cs.discrete')?.state).toBe('complete');
  });

  it('activates Michigan Calculus III only when AP supplied Calculus I or II', () => {
    const entry = findProgram('umich.ce_bse')!;
    const classroom = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
    ]), COURSE_INDEX);
    const inactive = classroom.requirementChecks.find((check) => check.requirement.id === 'umich.ce.calc3');
    expect(inactive?.applicable).toBe(false);

    const withAp = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', external: true, source: 'ap' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
    ]), COURSE_INDEX);
    const active = withAp.requirementChecks.find((check) => check.requirement.id === 'umich.ce.calc3');
    expect(active?.applicable).toBe(true);
    expect(active?.state).toBe('unmet');
  });
});

// ---------------------------------------------------------------------------
// Eligibility rules that decide more than coursework does
// ---------------------------------------------------------------------------

describe('eligibility rules', () => {
  it('treats a nontransferable P/S course as a credit warning, not an application ban', () => {
    const entry = findProgram('northwestern.cs')!;
    const results = evaluateEligibility(entry.institution.institutionRules, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'P', gradeBasis: 'pass_no_pass' }),
    ]));
    const passRule = results.find((result) => result.rule.id === 'northwestern.credit_exclusions');
    expect(passRule?.status).toBe('not_met');
    expect(passRule?.rule.severity).toBe('advisory');
  });

  it('reports Cornell Engineering CS as closed to transfer applicants', () => {
    const entry = findProgram('cornell.cs_bs_eng');
    expect(entry).toBeDefined();
    expect(entry!.program.eligibility.closedToTransfer).toContain('not accepting transfer applications');

    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf([]), COURSE_INDEX);
    expect(result.readiness).toBe('closed');
  });

  it('fails Brown when the plan runs past its four-semester ceiling', () => {
    const entry = findProgram('brown.university');
    expect(entry).toBeDefined();

    const twoYears = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', grade: 'A' }),
      claim({ code: 'MATH 2E', termId: '2027-fall', grade: 'A' }),
      claim({ code: 'MATH 3A', termId: '2028-winter', grade: 'A' }),
      claim({ code: 'MATH 3D', termId: '2028-spring', grade: 'A' }),
    ];
    const withinWindow = evaluateProgram(
      entry!.institution,
      entry!.program,
      snapshotOf(twoYears, '2028-spring'),
      COURSE_INDEX,
    );
    const brownWindow = withinWindow.eligibilityResults.find((r) => r.rule.id === 'brown.quarter_windows');
    expect(brownWindow?.status).toBe('met');

    const threeYears = [...twoYears, claim({ code: 'MATH 13', termId: '2028-fall', grade: 'A' })];
    const past = evaluateProgram(
      entry!.institution,
      entry!.program,
      snapshotOf(threeYears, '2028-fall'),
      COURSE_INDEX,
    );
    expect(past.readiness).toBe('ineligible');
  });

  it('applies Yale\'s three-quarters-at-A-or-B rule to real grades', () => {
    const entry = findProgram('yale.college_non_engineering');
    expect(entry).toBeDefined();

    const strong = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2D', termId: '2027-winter', grade: 'B' }),
      claim({ code: 'MATH 3A', termId: '2027-winter', grade: 'C' }),
    ];
    const strongResult = evaluateEligibility(entry!.program.eligibility.rules, snapshotOf(strong));
    const strongCheck = strongResult.find((r) => r.rule.id === 'yale.grade_distribution');
    expect(strongCheck?.status).toBe('met');

    const weak = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2026-fall', grade: 'C' }),
      claim({ code: 'MATH 2D', termId: '2027-winter', grade: 'C' }),
      claim({ code: 'MATH 3A', termId: '2027-winter', grade: 'D' }),
    ];
    const weakResult = evaluateEligibility(entry!.program.eligibility.rules, snapshotOf(weak));
    const weakCheck = weakResult.find((r) => r.rule.id === 'yale.grade_distribution');
    expect(weakCheck?.status).toBe('not_met');
    expect(weakCheck?.detail).toContain('below C');
  });

  it('holds a GPA rule as unknown while no letter grades exist', () => {
    const entry = findProgram('ucla.cs_bs');
    const results = evaluateEligibility(entry!.program.eligibility.rules, snapshotOf([]));
    const gpa = results.find((r) => r.rule.id === 'ucla.samueli.gpa');
    expect(gpa?.status).toBe('unknown');
  });

  it('separates an advisory competitiveness miss from a blocking failure', () => {
    const entry = findProgram('uw.cs_bs');
    const claims = [claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'B' })];
    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf(claims), COURSE_INDEX);
    const competitive = result.eligibilityResults.find((r) => r.rule.id === 'uw.allen.gpa');
    expect(competitive?.status).toBe('not_met');
    expect(competitive?.rule.severity).toBe('advisory');
    expect(result.readiness).not.toBe('ineligible');
  });

  it('reads Berkeley\'s 60–80 semester unit window against UCI quarter units', () => {
    const entry = findProgram('berkeley.eecs_bs');
    // 90 UCI quarter units == 60 semester units, the bottom of the window.
    const claims = [claim({ code: 'MATH 2A', termId: '2027-spring', units: 90, grade: 'A' })];
    const results = evaluateEligibility(entry!.institution.institutionRules, snapshotOf(claims));
    expect(results.find((r) => r.rule.id === 'berkeley.junior_only')?.status).toBe('met');
    expect(results.find((r) => r.rule.id === 'berkeley.unit_ceiling')?.status).toBe('met');

    const tooMany = [claim({ code: 'MATH 2A', termId: '2027-spring', units: 130, grade: 'A' })];
    const overflow = evaluateEligibility(entry!.institution.institutionRules, snapshotOf(tooMany));
    expect(overflow.find((r) => r.rule.id === 'berkeley.unit_ceiling')?.status).toBe('not_met');
  });

  it('returns unknown when exam-credit review alone decides a unit threshold', () => {
    const entry = findProgram('berkeley.eecs_bs')!;
    const snapshot = snapshotOf([
      claim({ code: 'MATH 2A', termId: '2027-spring', units: 84, grade: 'A' }),
      claim({ code: 'MATH 2B', external: true, source: 'ap', units: 8 }),
    ]);
    const results = evaluateEligibility(entry.institution.institutionRules, snapshot);
    expect(results.find((result) => result.rule.id === 'berkeley.junior_only')?.status).toBe('unknown');

    const program = evaluateProgram(entry.institution, entry.program, snapshot, COURSE_INDEX);
    expect(program.eligibility).toBe('needs_review');
    expect(program.readiness).toBe('needs_review');
  });

  it('computes Columbia Engineering math/science GPA separately from overall GPA', () => {
    const entry = findProgram('columbia.seas')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'C' }),
      claim({ code: 'WRITING 50', termId: '2026-fall', grade: 'A' }),
    ]), COURSE_INDEX);
    const subject = result.eligibilityResults.find((check) => check.rule.id === 'columbia.seas.math_science_gpa');
    expect(subject?.status).toBe('not_met');
    expect(subject?.detail).toContain('2.00');
  });

  it('checks UT Austin\'s B- floor across every recorded math/science course', () => {
    const entry = findProgram('utaustin.cs_bs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'STATS 67', termId: '2027-winter', grade: 'C+' }),
    ]), COURSE_INDEX);
    const floor = result.eligibilityResults.find((check) => check.rule.id === 'ut.cns.b_minus');
    expect(floor?.status).toBe('not_met');
    expect(floor?.detail).toContain('STATS 67');
  });
});

// ---------------------------------------------------------------------------
// Program roll-up
// ---------------------------------------------------------------------------

describe('program roll-up', () => {
  it('still suggests courses for a school that publishes no required list', () => {
    // CMU publishes no external-transfer course requirements, so it has no
    // required gaps to mine. It is also the school where a student most needs
    // to be told what to take, so recommended gaps have to feed the suggestion
    // list — without letting them move the readiness badge.
    const entry = findProgram('cmu.scs')!;
    const result = evaluateProgram(entry.institution, entry.program, snapshotOf([]), COURSE_INDEX);
    expect(result.requiredTotal).toBe(0);
    expect(result.coursework).toBe('none_published');
    expect(result.suggestedCodes.length).toBeGreaterThan(0);
    expect(result.suggestedCodes.every((code) => COURSE_INDEX.has(code))).toBe(true);
  });


  it('moves a program from not_started to on_track as the coursework lands', () => {
    const entry = findProgram('ucsd.data_science_bs');
    expect(entry).toBeDefined();

    const empty = evaluateProgram(entry!.institution, entry!.program, snapshotOf([]), COURSE_INDEX);
    expect(empty.coursework).toBe('not_started');
    expect(empty.blockingGaps.length).toBe(empty.requiredTotal);

    const full = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', grade: 'A' }),
      claim({ code: 'MATH 3A', termId: '2027-fall', grade: 'A' }),
      claim({ code: 'I&C SCI 31', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'I&C SCI 32', termId: '2027-winter', grade: 'A' }),
    ];
    const ready = evaluateProgram(entry!.institution, entry!.program, snapshotOf(full), COURSE_INDEX);
    expect(ready.coursework).toBe('on_track');
    expect(ready.requiredSatisfied).toBe(ready.requiredTotal);
  });

  it('names the UCI courses that would close the remaining gaps', () => {
    const entry = findProgram('ucsd.ce_bs');
    const partial = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
    ];
    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf(partial), COURSE_INDEX);
    expect(result.coursework).toBe('gaps');
    expect(result.suggestedCodes).toContain('MATH 3A');
    expect(result.suggestedCodes).toContain('PHYSICS 7C');
    // Only real catalogue codes are offered as clickable courses — the prose
    // description of an open-ended rule stays in the requirement's own detail.
    for (const code of result.suggestedCodes) {
      expect(COURSE_INDEX.has(code)).toBe(true);
    }
  });

  it('never offers the prose form of an open-ended rule as a course', () => {
    const entry = findProgram('berkeley.eecs_bs');
    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf([]), COURSE_INDEX);
    expect(result.suggestedCodes.every((code) => COURSE_INDEX.has(code))).toBe(true);
    expect(result.suggestedCodes.some((code) => code.includes(' course'))).toBe(false);
  });

  it('does not count recommended or competitive prep against readiness', () => {
    const entry = findProgram('umich.cs_lsa');
    // Both CS-LSA requirements are "recommended", so an empty plan still has no
    // required gaps — readiness must reflect that, not invent a failure.
    const result = evaluateProgram(entry!.institution, entry!.program, snapshotOf([]), COURSE_INDEX);
    expect(result.requiredTotal).toBe(0);
    expect(result.coursework).toBe('none_published');
  });

  it('reports coursework and eligibility independently', () => {
    // UCSD needs 90 quarter units. A plan with the right courses but far too few
    // units is coursework-ready and eligibility-blocked at the same time, and
    // the UI has to be able to say so.
    const entry = findProgram('ucsd.data_science_bs');
    const courses = [
      claim({ code: 'MATH 2A', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'MATH 2B', termId: '2027-winter', grade: 'A' }),
      claim({ code: 'MATH 2D', termId: '2027-spring', grade: 'A' }),
      claim({ code: 'MATH 3A', termId: '2027-fall', grade: 'A' }),
      claim({ code: 'I&C SCI 31', termId: '2026-fall', grade: 'A' }),
      claim({ code: 'I&C SCI 32', termId: '2027-winter', grade: 'A' }),
    ];
    const thin = evaluateProgram(entry!.institution, entry!.program, snapshotOf(courses), COURSE_INDEX);
    expect(thin.coursework).toBe('on_track');
    expect(thin.eligibility).toBe('blocked');
    expect(thin.readiness).toBe('ineligible');
    expect(thin.failingRules.map((r) => r.rule.id)).toContain('ucsd.junior_only');

    // Same courses, but carrying a realistic 90 quarter units of total work.
    const withUnits = [...courses, claim({ code: 'WRITING 50', termId: '2028-winter', grade: 'A', units: 66 })];
    const full = evaluateProgram(entry!.institution, entry!.program, snapshotOf(withUnits), COURSE_INDEX);
    expect(full.eligibility).toBe('open');
    expect(full.readiness).toBe('on_track');
  });
});
