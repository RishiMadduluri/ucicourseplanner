import { describe, expect, it } from 'vitest';
import { parsePrerequisiteText, collectCourseCodes } from '../../src/domain/prerequisites/parse';
import { assessEligibility, evaluatePrerequisite } from '../../src/domain/prerequisites/evaluate';
import type { CourseRecord, EvaluationContext } from '../../src/domain/prerequisites/evaluate';
import { course } from '../helpers';

const YEAR = '2026-27';

function ctx(records: CourseRecord[], targetTermId: string, extra: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    records,
    targetTermId,
    satisfiedEvidenceKeys: new Set<string>(),
    ...extra,
  };
}

describe('prerequisite parser', () => {
  it('parses AND of a course and a parenthesised OR, keeping minimum grades', () => {
    // Real COMPSCI 112 text from the ingested 2026-27 catalogue.
    const { expr, confidence } = parsePrerequisiteText(course('COMPSCI 112').prerequisiteRaw!, YEAR);

    expect(confidence).toBe(1);
    expect(expr).toMatchObject({
      op: 'and',
      children: [
        { op: 'course', code: 'I&C SCI 46', minGrade: 'C' },
        {
          op: 'or',
          children: [
            { op: 'course', code: 'MATH 3A', minGrade: 'C' },
            { op: 'course', code: 'I&C SCI 6N', minGrade: 'C' },
          ],
        },
      ],
    });
  });

  it('binds AND tighter than OR', () => {
    const { expr } = parsePrerequisiteText('Prerequisite: MATH 2A and MATH 2B or MATH 5A.', YEAR);
    expect(expr).toMatchObject({
      op: 'or',
      children: [
        { op: 'and', children: [{ code: 'MATH 2A' }, { code: 'MATH 2B' }] },
        { code: 'MATH 5A' },
      ],
    });
  });

  it('parses an exam node with a minimum score', () => {
    const { expr } = parsePrerequisiteText(
      'Prerequisite: I&C SCI 31 or AP Computer Science A with a minimum score of 3.',
      YEAR,
    );
    expect(expr).toMatchObject({
      op: 'or',
      children: [
        { op: 'course', code: 'I&C SCI 31' },
        { op: 'exam_or_placement', key: 'AP COMPUTER SCIENCE A>=3' },
      ],
    });
  });

  it('keeps unparseable prose as an unknown node and lowers confidence', () => {
    const { expr, confidence } = parsePrerequisiteText('Prerequisite: Prerequisites vary.', YEAR);
    expect(expr).toMatchObject({ op: 'unknown', raw: 'Prerequisites vary' });
    expect(confidence).toBe(0);
  });

  it('separates the advisory Recommended clause from enforced prerequisites', () => {
    const { expr, recommendedRaw } = parsePrerequisiteText(
      'Prerequisite: COMPSCI 161. Recommended: I&C SCI 45C.',
      YEAR,
    );
    expect(expr).toMatchObject({ op: 'course', code: 'COMPSCI 161' });
    expect(recommendedRaw).toBe('I&C SCI 45C');
    expect(collectCourseCodes(expr)).toEqual(['COMPSCI 161']);
  });

  it('ignores permissive trailing sentences instead of poisoning the tree', () => {
    // "is also accepted" widens eligibility; treating it as an extra AND-ed
    // unknown would wrongly make a decidable tree undecidable.
    const { expr, confidence } = parsePrerequisiteText(
      'Prerequisite: COMPSCI 180A. In Progress (IP) grade for COMPSCI 180A is also accepted.',
      YEAR,
    );
    expect(expr).toMatchObject({ op: 'course', code: 'COMPSCI 180A' });
    expect(confidence).toBe(1);
  });

  it('parses corequisite text', () => {
    const { expr } = parsePrerequisiteText('Corequisite: MATH 2D and MATH 3A.', YEAR);
    expect(expr).toMatchObject({
      op: 'and',
      children: [{ code: 'MATH 2D' }, { code: 'MATH 3A' }],
    });
  });
});

describe('three-valued evaluation', () => {
  const expr = course('COMPSCI 112').prerequisiteExpr!;

  it('satisfies a node from a strictly earlier term (criterion 15)', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'B' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(result.status).toBe('satisfied');
    expect(result.conditional).toBe(false);
  });

  it('does not satisfy a prerequisite planned in the same term (criterion 16)', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2028-winter', status: 'planned' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(result.status).toBe('unsatisfied');
    expect(result.missing.join(' ')).toMatch(/must finish earlier/);
  });

  it('accepts the same-term course for a concurrent node', () => {
    const result = evaluatePrerequisite(
      { op: 'course', courseId: 'x', code: 'MATH 105A' },
      ctx([{ code: 'MATH 105A', termId: '2028-winter', status: 'planned' }], '2028-winter'),
      'concurrent',
    );
    expect(result.status).toBe('satisfied');
  });

  it('reports planned prerequisites as conditional rather than complete', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'planned' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'planned' },
        ],
        '2028-winter',
      ),
    );
    expect(result.status).toBe('satisfied');
    expect(result.conditional).toBe(true);
  });

  it('rejects a grade below the stated minimum (criterion 17)', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'D' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(result.status).toBe('unsatisfied');
    expect(result.missing.join(' ')).toMatch(/below the required minimum of C/);
  });

  it('returns unknown when a completed course has no recorded grade (criterion 18)', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(result.status).toBe('unknown');
    expect(result.unresolved.join(' ')).toMatch(/no recorded grade/);
  });

  it('does not satisfy a node from a failed course', () => {
    const result = evaluatePrerequisite(
      { op: 'course', courseId: 'x', code: 'I&C SCI 46' },
      ctx([{ code: 'I&C SCI 46', termId: '2027-fall', status: 'failed', grade: 'F' }], '2028-winter'),
    );
    expect(result.status).toBe('unsatisfied');
    expect(result.missing.join(' ')).toMatch(/failed/);
  });

  it('names every missing branch of an AND (criterion 19)', () => {
    const result = evaluatePrerequisite(expr, ctx([], '2028-winter'));
    expect(result.status).toBe('unsatisfied');
    const text = result.missing.join(' ');
    expect(text).toMatch(/I&C SCI 46/);
    expect(text).toMatch(/MATH 3A/);
    expect(text).toMatch(/I&C SCI 6N/);
  });

  it('does not report the unused branch of a satisfied OR as missing', () => {
    const result = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'A' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(result.missing).toEqual([]);
  });

  it('warns when a prerequisite is moved later than its dependent (criterion 20)', () => {
    const before = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'A' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(before.status).toBe('satisfied');

    // Move MATH 3A after COMPSCI 112.
    const after = evaluatePrerequisite(
      expr,
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'A' },
          { code: 'MATH 3A', termId: '2028-spring', status: 'planned' },
        ],
        '2028-winter',
      ),
    );
    expect(after.status).toBe('unsatisfied');
    expect(after.missing.join(' ')).toMatch(/MATH 3A/);
  });

  it('returns unknown for consent and standing rather than guessing', () => {
    const consent = evaluatePrerequisite(
      { op: 'consent', authority: 'instructor', raw: 'Consent of instructor' },
      ctx([], '2028-winter'),
    );
    expect(consent.status).toBe('unknown');

    const standing = evaluatePrerequisite(
      { op: 'standing', value: 'senior', raw: 'Senior standing' },
      ctx([], '2028-winter'),
    );
    expect(standing.status).toBe('unknown');
  });

  it('satisfies a node from an exact external equivalency', () => {
    const result = evaluatePrerequisite(
      { op: 'course', courseId: 'x', code: 'MATH 2A' },
      ctx([{ code: 'MATH 2A', status: 'completed', external: true }], '2026-fall'),
    );
    expect(result.status).toBe('satisfied');
    expect(result.explanation?.detail).toMatch(/external credit/i);
  });

  it('never satisfies a course prerequisite from elective-only credit', () => {
    const result = evaluatePrerequisite(
      { op: 'course', courseId: 'x', code: 'I&C SCI 31' },
      ctx([{ code: 'I&C SCI 31', status: 'completed', external: true, electiveOnly: true }], '2026-fall'),
    );
    expect(result.status).toBe('unsatisfied');
    expect(result.missing.join(' ')).toMatch(/elective-only/);
  });

  it('resolves an exam node from recorded evidence', () => {
    const node = { op: 'exam_or_placement' as const, key: 'AP CALCULUS BC>=4', raw: 'AP Calculus BC with a minimum score of 4' };
    expect(evaluatePrerequisite(node, ctx([], '2026-fall')).status).toBe('unknown');
    expect(
      evaluatePrerequisite(
        node,
        ctx([], '2026-fall', { satisfiedEvidenceKeys: new Set(['AP CALCULUS BC>=4']) }),
      ).status,
    ).toBe('satisfied');
  });

  it('evaluates a restriction separately from prerequisites', () => {
    // COMPSCI 112 is "prerequisites satisfied, enrollment restricted".
    const assessment = assessEligibility(
      { prerequisiteExpr: expr },
      ctx(
        [
          { code: 'I&C SCI 46', termId: '2027-fall', status: 'completed', grade: 'A' },
          { code: 'MATH 3A', termId: '2027-fall', status: 'completed', grade: 'A' },
        ],
        '2028-winter',
      ),
    );
    expect(assessment.overall).toBe('satisfied');
    // The restriction lives on the course record, untouched by the evaluator.
    expect(course('COMPSCI 112').restrictions[0]).toMatchObject({ kind: 'first_consideration' });
  });
});
