import { describe, expect, it } from 'vitest';
import {
  REGULAR_MAX_UNITS,
  REGULAR_MIN_UNITS,
  SUMMER_ABSOLUTE_MAX,
  validateRegularQuarter,
  validateSummer,
  worstSeverity,
} from '../../src/domain/workload/load';
import { buildTimeline, DEFAULT_TIMELINE, sequenceOfTermId } from '../../src/domain/terms/terms';

const prefs = { regularWarnAboveUnits: 16 };

describe('regular-quarter load', () => {
  it('does not call 12 through 20 units administratively invalid (criterion 54)', () => {
    for (let units = REGULAR_MIN_UNITS; units <= REGULAR_MAX_UNITS; units += 1) {
      const result = validateRegularQuarter({ termId: '2026-fall', units, courseCount: 4 }, prefs);
      expect(result.withinOfficialRange).toBe(true);
      expect(result.issues.some((i) => i.severity === 'warning' || i.severity === 'invalid')).toBe(false);
    }
  });

  it('warns that dean authorization is required below 12 or above 20, still editable (criterion 55)', () => {
    const low = validateRegularQuarter({ termId: '2026-fall', units: 8, courseCount: 2 }, prefs);
    expect(low.withinOfficialRange).toBe(false);
    expect(low.issues[0]!.severity).toBe('warning');
    expect(low.issues[0]!.resolution).toMatch(/authorization from your dean/i);

    const high = validateRegularQuarter({ termId: '2026-fall', units: 24, courseCount: 6 }, prefs);
    expect(high.withinOfficialRange).toBe(false);
    expect(high.issues[0]!.code).toBe('above_maximum');
    expect(high.issues[0]!.resolution).toMatch(/authorization from your dean/i);
    // Never blocked outright.
    expect(high.issues.some((i) => i.severity === 'invalid')).toBe(false);
  });

  it('treats a personal threshold as informational, not as illegal', () => {
    const result = validateRegularQuarter({ termId: '2026-fall', units: 18, courseCount: 5 }, prefs);
    const personal = result.issues.find((i) => i.code === 'personal_threshold')!;

    expect(personal.severity).toBe('info');
    expect(personal.resolution).toMatch(/normal, fully authorized load/i);
    expect(result.withinOfficialRange).toBe(true);
    expect(worstSeverity(result.issues)).toBe('info');
  });

  it('does not treat an empty term as an under-load', () => {
    const result = validateRegularQuarter({ termId: '2026-fall', units: 0, courseCount: 0 }, prefs);
    expect(result.issues).toHaveLength(0);
    expect(result.withinOfficialRange).toBe(true);
  });

  it('marks a warning as acknowledged when an override is recorded', () => {
    const result = validateRegularQuarter({ termId: '2026-fall', units: 22, courseCount: 6 }, prefs, true);
    expect(result.issues[0]!.overridden).toBe(true);
    expect(worstSeverity(result.issues)).not.toBe('warning');
  });
});

describe('Summer load', () => {
  it('splits a 10-week course half into each session (criterion 56)', () => {
    const result = validateSummer(2026, [{ session: 'ten_week', units: 8, code: 'MATH 2A' }]);

    expect(result.totalUnits).toBe(8);
    expect(result.sessionUnits.session_1).toBe(4);
    expect(result.sessionUnits.session_2).toBe(4);
    expect(result.sessionUnits.ten_week).toBe(8);
    expect(result.issues).toHaveLength(0);
  });

  it('warns above 20 total Summer units', () => {
    const result = validateSummer(2026, [
      { session: 'session_1', units: 12, code: 'A 1' },
      { session: 'session_2', units: 12, code: 'B 1' },
    ]);
    const issue = result.issues.find((i) => i.code === 'summer_total_above_normal')!;
    expect(issue.severity).toBe('warning');
    expect(issue.resolution).toMatch(/approved Summer exception/i);
    expect(result.valid).toBe(true);
  });

  it('warns above 12 units in one session, counting 10-week halves', () => {
    const result = validateSummer(2026, [
      { session: 'session_1', units: 8, code: 'A 1' },
      { session: 'ten_week', units: 10, code: 'B 1' }, // 5 units into session 1
    ]);
    const issue = result.issues.find((i) => i.code === 'summer_session_above_normal')!;
    expect(issue.message).toMatch(/13 units in session 1/);
    expect(issue.message).toMatch(/10-week courses count half in each session/);
  });

  it('rejects more than 32 total Summer units even with an override (criterion 57)', () => {
    const result = validateSummer(
      2026,
      [
        { session: 'session_1', units: 12, code: 'A 1' },
        { session: 'ten_week', units: 12, code: 'B 1' },
        { session: 'session_2', units: 12, code: 'C 1' },
      ],
      true, // override present
    );

    expect(result.totalUnits).toBe(36);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'summer_absolute_exceeded')!;
    expect(issue.severity).toBe('invalid');
    expect(issue.resolution).toMatch(/No approval can permit more than 32/);
    expect(worstSeverity(result.issues)).toBe('invalid');
  });

  it('allows exactly the 32-unit ceiling', () => {
    const result = validateSummer(2026, [
      { session: 'session_1', units: 16, code: 'A 1' },
      { session: 'session_2', units: 16, code: 'B 1' },
    ]);
    expect(result.totalUnits).toBe(SUMMER_ABSOLUTE_MAX);
    expect(result.valid).toBe(true);
  });

  it('hints when two compressed technical courses overlap a session', () => {
    const result = validateSummer(2026, [
      { session: 'session_1', units: 4, code: 'I&C SCI 46', intensive: true },
      { session: 'session_1', units: 4, code: 'COMPSCI 161', intensive: true },
    ]);
    const hint = result.issues.find((i) => i.code === 'summer_compressed_overlap')!;
    expect(hint.severity).toBe('info');
    expect(hint.message).toMatch(/I&C SCI 46 and COMPSCI 161/);
  });
});

describe('timeline', () => {
  it('starts with Incoming Summer 2026 then Fall 2026, Winter 2027, Spring 2027 (criterion 52)', () => {
    const timeline = buildTimeline(DEFAULT_TIMELINE);

    expect(timeline.incomingSummer.isIncomingSummer).toBe(true);
    expect(timeline.incomingSummer.label).toBe('Incoming Summer 2026');

    const year1 = timeline.years[0]!;
    expect(year1.fall.id).toBe('2026-fall');
    expect(year1.winter.id).toBe('2027-winter');
    expect(year1.spring.id).toBe('2027-spring');
    expect(year1.summer?.label).toBe('Summer 2027');

    // Incoming Summer sorts before Fall 2026.
    expect(sequenceOfTermId('2026-summer-session_1')).toBeLessThan(sequenceOfTermId('2026-fall'));
  });

  it('exposes three Summer session lanes without three board columns (criterion 53)', () => {
    const timeline = buildTimeline(DEFAULT_TIMELINE);
    expect(timeline.incomingSummer.sessions.map((s) => s.summerSession)).toEqual([
      'session_1', 'ten_week', 'session_2',
    ]);
    // One Summer group per year row, not three separate term columns.
    expect(timeline.years.every((y) => !y.summer || y.summer.sessions.length === 3)).toBe(true);
  });

  it('ends at Spring 2030 and omits Summer 2030 by default', () => {
    const timeline = buildTimeline(DEFAULT_TIMELINE);
    const last = timeline.allTerms.at(-1)!;

    expect(last.id).toBe('2030-spring');
    expect(timeline.years).toHaveLength(4);
    expect(timeline.years[3]!.summer).toBeUndefined();
    expect(timeline.allTerms.some((t) => t.id.startsWith('2030-summer'))).toBe(false);
  });

  it('adds Summer 2030 when the graduation target is extended', () => {
    const timeline = buildTimeline({ ...DEFAULT_TIMELINE, graduationTermId: '2030-summer-session_2' });
    expect(timeline.years[3]!.summer?.label).toBe('Summer 2030');
    expect(timeline.allTerms.some((t) => t.id === '2030-summer-session_2')).toBe(true);
  });

  it('orders Summer sessions before the following Fall', () => {
    expect(sequenceOfTermId('2027-summer-session_1')).toBeLessThan(sequenceOfTermId('2027-summer-ten_week'));
    expect(sequenceOfTermId('2027-summer-ten_week')).toBeLessThan(sequenceOfTermId('2027-summer-session_2'));
    expect(sequenceOfTermId('2027-summer-session_2')).toBeLessThan(sequenceOfTermId('2027-fall'));
    expect(sequenceOfTermId('2027-spring')).toBeLessThan(sequenceOfTermId('2027-summer-session_1'));
  });
});
