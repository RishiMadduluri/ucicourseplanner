import { describe, expect, it } from 'vitest';
import { assessOffering, seasonalScore } from '../../src/domain/offerings/assess';
import type { CourseOfferingRecord, OfferingEvidence } from '../../src/domain/offerings/types';
import { OFFERING_INDEX } from '../../src/data/offerings2026';

function evidence(partial: Partial<OfferingEvidence> & Pick<OfferingEvidence, 'type' | 'season' | 'academicYear' | 'offered'>): OfferingEvidence {
  return {
    sourceUrl: 'https://example.test/source',
    sourceLabel: 'Test source',
    retrievedAt: '2026-07-24T00:00:00.000Z',
    ...partial,
  };
}

function record(evidenceList: OfferingEvidence[], cadenceNote?: string): CourseOfferingRecord {
  const r: CourseOfferingRecord = { normalizedCode: 'TEST 1', evidence: evidenceList };
  if (cadenceNote) r.cadenceNote = cadenceNote;
  return r;
}

describe('offering evidence labelling', () => {
  it('shows exact WebSoc evidence as Published (criterion 43)', () => {
    const result = assessOffering({
      record: record([
        evidence({ type: 'scheduled', season: 'fall', academicYear: '2026-27', offered: true, sourceLabel: 'WebSoc' }),
      ]),
      termId: '2026-fall',
      academicYear: '2026-27',
    });

    expect(result.state).toBe('scheduled');
    expect(result.label).toBe('Published');
    expect(result.explanation).toMatch(/Sections can still change or be cancelled/);
  });

  it('shows department teaching-plan evidence as Tentative, never Published (criterion 44)', () => {
    const result = assessOffering({
      record: record([
        evidence({
          type: 'department_plan',
          season: 'fall',
          academicYear: '2026-27',
          offered: true,
          sourceLabel: 'ICS tentative course offerings',
        }),
      ]),
      termId: '2026-fall',
      academicYear: '2026-27',
    });

    expect(result.state).toBe('planned');
    expect(result.label).toBe('Department planned — tentative');
    expect(result.label).not.toMatch(/Published/);
    expect(result.explanation).toMatch(/subject to change and are not a schedule/);
  });

  it('never labels historical inference as Published or guaranteed (criterion 45)', () => {
    const historical = ['2025-26', '2024-25', '2023-24', '2022-23'].map((year) =>
      evidence({ type: 'historical', season: 'winter', academicYear: year, offered: true }),
    );
    const result = assessOffering({
      record: record(historical),
      termId: '2028-winter',
      academicYear: '2027-28',
    });

    expect(result.state).toBe('likely');
    expect(result.label).toBe('Historically likely');
    expect(result.explanation).toMatch(/Historical inference only/);
    expect(result.explanation).toMatch(/not a schedule and not a guarantee/);
  });

  it('does not permanently disable a course from a blank department-plan cell (criterion 46)', () => {
    const result = assessOffering({
      record: record([
        evidence({
          type: 'department_plan',
          season: 'winter',
          academicYear: '2026-27',
          offered: false,
          sourceLabel: 'ICS tentative course offerings',
        }),
      ]),
      termId: '2027-winter',
      academicYear: '2026-27',
    });

    expect(result.explanation).toMatch(/A blank cell means "not in this plan", not "impossible"/);
    // Other seasons remain assessable rather than being zeroed out.
    expect(result.state).not.toBe('unknown');
  });

  it('shows the evidence years and source behind every prediction (criterion 47)', () => {
    const historical = ['2025-26', '2024-25'].map((year) =>
      evidence({ type: 'historical', season: 'spring', academicYear: year, offered: true }),
    );
    const result = assessOffering({ record: record(historical), termId: '2028-spring', academicYear: '2027-28' });

    expect(result.explanation).toMatch(/2025-26/);
    expect(result.explanation).toMatch(/2024-25/);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.lastObserved).toBe('2025-26');
  });

  it('preserves Summer session-level evidence (criterion 48)', () => {
    const result = assessOffering({
      record: record([
        evidence({
          type: 'scheduled',
          season: 'summer',
          academicYear: '2026-27',
          summerSession: 'session_1',
          offered: true,
          sourceLabel: 'WebSoc',
        }),
      ]),
      termId: '2026-summer-session_1',
      academicYear: '2026-27',
    });

    expect(result.state).toBe('scheduled');
    expect(result.evidence[0]!.summerSession).toBe('session_1');
    expect(result.explanation).toMatch(/session 1/);
  });

  it('does not match Session 1 evidence to a Session 2 placement', () => {
    const result = assessOffering({
      record: record([
        evidence({
          type: 'scheduled',
          season: 'summer',
          academicYear: '2026-27',
          summerSession: 'session_1',
          offered: true,
        }),
      ]),
      termId: '2026-summer-session_2',
      academicYear: '2026-27',
    });
    expect(result.state).not.toBe('scheduled');
  });
});

describe('historical prediction baseline', () => {
  it('applies recency weights 0.40 / 0.30 / 0.20 / 0.10', () => {
    // Offered only in the most recent year.
    const recentOnly = ['2025-26', '2024-25', '2023-24', '2022-23'].map((year, i) =>
      evidence({ type: 'historical', season: 'fall', academicYear: year, offered: i === 0 }),
    );
    expect(seasonalScore(recentOnly, 'fall')!.score).toBeCloseTo(0.4, 5);

    // Offered only in the oldest year.
    const oldestOnly = ['2025-26', '2024-25', '2023-24', '2022-23'].map((year, i) =>
      evidence({ type: 'historical', season: 'fall', academicYear: year, offered: i === 3 }),
    );
    expect(seasonalScore(oldestOnly, 'fall')!.score).toBeCloseTo(0.1, 5);
  });

  it('bands scores into the documented labels', () => {
    const build = (offeredYears: number[]) =>
      record(
        ['2025-26', '2024-25', '2023-24', '2022-23'].map((year, i) =>
          evidence({ type: 'historical', season: 'fall', academicYear: year, offered: offeredYears.includes(i) }),
        ),
      );

    const stateFor = (years: number[]) =>
      assessOffering({ record: build(years), termId: '2028-fall', academicYear: '2028-29' }).state;

    // Weights are 0.40 / 0.30 / 0.20 / 0.10 from most to least recent.
    expect(stateFor([0, 1, 2, 3])).toBe('likely'); //         1.00 → 0.75-1.00
    expect(stateFor([0, 2])).toBe('possible'); //             0.60 → 0.40-0.74
    expect(stateFor([2])).toBe('uncommon'); //                0.20 → 0.15-0.39
    expect(stateFor([3])).toBe('not_observed'); //            0.10 → 0.00-0.14
    expect(stateFor([])).toBe('not_observed'); //             0.00 → 0.00-0.14
  });

  it('treats a new course with no history as unknown, not unlikely', () => {
    const result = assessOffering({ record: undefined, termId: '2028-fall', academicYear: '2028-29' });
    expect(result.state).toBe('unknown');
    expect(result.explanation).toMatch(/Offerings are never guaranteed/);
  });

  it('treats a single comparable year as insufficient evidence', () => {
    const result = assessOffering({
      record: record([evidence({ type: 'historical', season: 'fall', academicYear: '2025-26', offered: true })]),
      termId: '2028-fall',
      academicYear: '2028-29',
    });
    expect(result.state).toBe('unknown');
    expect(result.explanation).toMatch(/not enough to predict/);
    expect(result.explanation).toMatch(/not unlikely/);
  });

  it('lets a published term override inference', () => {
    const mixed = record([
      evidence({ type: 'historical', season: 'fall', academicYear: '2024-25', offered: false }),
      evidence({ type: 'historical', season: 'fall', academicYear: '2023-24', offered: false }),
      evidence({ type: 'scheduled', season: 'fall', academicYear: '2026-27', offered: true, sourceLabel: 'WebSoc' }),
    ]);
    expect(assessOffering({ record: mixed, termId: '2026-fall', academicYear: '2026-27' }).state).toBe('scheduled');
  });
});

describe('seeded 2026-27 department plans', () => {
  it('marks ICS core courses as tentative department plans, not schedules', () => {
    const result = assessOffering({
      record: OFFERING_INDEX.get('I&C SCI 31'),
      termId: '2026-fall',
      academicYear: '2026-27',
    });
    expect(result.state).toBe('planned');
    expect(result.label).toBe('Department planned — tentative');
    expect(result.evidence[0]!.sourceLabel).toMatch(/ICS tentative/);
  });

  it('reflects that I&C SCI 6N is planned only in Winter', () => {
    const winter = assessOffering({
      record: OFFERING_INDEX.get('I&C SCI 6N'),
      termId: '2027-winter',
      academicYear: '2026-27',
    });
    expect(winter.state).toBe('planned');

    // Fall is simply absent from the plan, which yields no positive evidence.
    const fall = assessOffering({
      record: OFFERING_INDEX.get('I&C SCI 6N'),
      termId: '2026-fall',
      academicYear: '2026-27',
    });
    expect(fall.state).not.toBe('planned');
    expect(fall.suggestedTerms.some((t) => t.includes('winter'))).toBe(true);
  });

  it('applies the Summer-only cadence note to MATH 173A', () => {
    const summer = assessOffering({
      record: OFFERING_INDEX.get('MATH 173A'),
      termId: '2027-summer-session_1',
      academicYear: '2026-27',
    });
    expect(summer.state).toBe('likely');
    expect(summer.explanation).toMatch(/Summer only/);

    const fall = assessOffering({
      record: OFFERING_INDEX.get('MATH 173A'),
      termId: '2026-fall',
      academicYear: '2026-27',
    });
    expect(fall.state).toBe('uncommon');
  });

  it('applies the every-other-year cadence to MATH 120C', () => {
    const result = assessOffering({
      record: OFFERING_INDEX.get('MATH 120C'),
      termId: '2027-spring',
      academicYear: '2026-27',
    });
    expect(result.explanation).toMatch(/every-other-year/);
    expect(result.state).toBe('likely');
  });

  it('reports MATH 195W as not offered in 2026-27 with the reason', () => {
    const result = assessOffering({
      record: OFFERING_INDEX.get('MATH 195W'),
      termId: '2027-spring',
      academicYear: '2026-27',
    });
    expect(result.state).toBe('uncommon');
    expect(result.explanation).toMatch(/expected to return in 2027-28/);
  });
});
