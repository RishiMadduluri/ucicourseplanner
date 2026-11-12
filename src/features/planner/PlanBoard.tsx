import { useState } from 'react';
import { useStore } from '../../app/store';
import type { PlannerAssessment } from '../../domain/planner/warnings';
import type { AcademicYearRow, SummerGroup, Term, Timeline } from '../../domain/terms/terms';
import { SUMMER_2026_DATES, SUMMER_SESSION_LABEL } from '../../domain/terms/terms';
import { REGULAR_MAX_UNITS, REGULAR_MIN_UNITS } from '../../domain/workload/load';
import { CourseChip } from './CourseChip';

/**
 * Centre region — the planning board.
 *
 * Scrolls vertically by academic year rather than horizontally across sixteen
 * equal columns. Incoming Summer 2026 is a distinct pre-Year-1 card, and each
 * Summer holds Session 1 / 10-week / Session 2 lanes instead of three separate
 * board columns (criteria 13, 52, 53).
 */

interface Props {
  timeline: Timeline;
  assessment: PlannerAssessment;
  selectedTermId: string;
  onSelectTerm: (termId: string) => void;
}

export function PlanBoard({ timeline, assessment, selectedTermId, onSelectTerm }: Props) {
  const [dragPlacementId, setDragPlacementId] = useState<string | null>(null);
  const moveCourse = useStore((s) => s.moveCourse);

  const dragHandlers = {
    dragPlacementId,
    onDragStart: setDragPlacementId,
    onDragEnd: () => setDragPlacementId(null),
    onDropTerm: (termId: string) => {
      if (dragPlacementId) moveCourse(dragPlacementId, termId);
      setDragPlacementId(null);
    },
  };

  return (
    <div className="board" id="plan-board">
      <h2 className="visually-hidden">Four-year plan</h2>

      <section className="year-row" aria-labelledby="incoming-summer-heading">
        <h3 id="incoming-summer-heading">Before Year 1</h3>
        <div className="term-grid">
          <SummerCard
            group={timeline.incomingSummer}
            assessment={assessment}
            selectedTermId={selectedTermId}
            onSelectTerm={onSelectTerm}
            dragHandlers={dragHandlers}
            isIncoming
          />
        </div>
      </section>

      {timeline.years.map((year) => (
        <YearRow
          key={year.academicYear}
          year={year}
          assessment={assessment}
          selectedTermId={selectedTermId}
          onSelectTerm={onSelectTerm}
          dragHandlers={dragHandlers}
        />
      ))}
    </div>
  );
}

interface DragHandlers {
  dragPlacementId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTerm: (termId: string) => void;
}

function YearRow({
  year,
  assessment,
  selectedTermId,
  onSelectTerm,
  dragHandlers,
}: {
  year: AcademicYearRow;
  assessment: PlannerAssessment;
  selectedTermId: string;
  onSelectTerm: (id: string) => void;
  dragHandlers: DragHandlers;
}) {
  const headingId = `year-${year.academicYear}`;
  return (
    <section className="year-row" aria-labelledby={headingId}>
      <h3 id={headingId}>{year.label}</h3>
      <div className="term-grid">
        {[year.fall, year.winter, year.spring].map((term) => (
          <TermCard
            key={term.id}
            term={term}
            assessment={assessment}
            selectedTermId={selectedTermId}
            onSelectTerm={onSelectTerm}
            dragHandlers={dragHandlers}
          />
        ))}
        {year.summer ? (
          <SummerCard
            group={year.summer}
            assessment={assessment}
            selectedTermId={selectedTermId}
            onSelectTerm={onSelectTerm}
            dragHandlers={dragHandlers}
          />
        ) : null}
      </div>
    </section>
  );
}

function TermCard({
  term,
  assessment,
  selectedTermId,
  onSelectTerm,
  dragHandlers,
}: {
  term: Term;
  assessment: PlannerAssessment;
  selectedTermId: string;
  onSelectTerm: (id: string) => void;
  dragHandlers: DragHandlers;
}) {
  const [isOver, setIsOver] = useState(false);
  const termAssessment = assessment.byTerm.get(term.id);
  const placements = termAssessment?.placements ?? [];
  const units = termAssessment?.units ?? 0;
  const issues = termAssessment?.loadIssues ?? [];
  const headingId = `term-${term.id}`;

  const blocking = issues.filter((i) => i.severity === 'warning' && !i.overridden);
  const informational = issues.filter((i) => i.severity === 'info');

  return (
    <section
      className={`term-card${isOver ? ' drop-target' : ''}`}
      aria-labelledby={headingId}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        dragHandlers.onDropTerm(term.id);
      }}
    >
      <header>
        <div className="term-title">
          <h4 id={headingId}>{term.label}</h4>
          {selectedTermId === term.id ? <span className="badge info">Selected</span> : null}
        </div>
        <div className="meta">
          <span>
            <strong>{units}</strong> units
          </span>
          <span>{placements.length} {placements.length === 1 ? 'course' : 'courses'}</span>
          <LoadBadge units={units} issues={blocking.length + informational.length} termIssues={issues} />
        </div>
      </header>

      <div className="term-body">
        {placements.length === 0 ? (
          <p className="empty-state">Add courses from the Explorer.</p>
        ) : (
          placements.map((p) => (
            <CourseChip key={p.placementId} assessment={p} dragHandlers={dragHandlers} />
          ))
        )}

        {issues.map((issue, i) => (
          <div
            key={i}
            className={`callout ${issue.severity === 'invalid' ? 'error' : issue.severity === 'warning' ? 'warn' : 'info'}`}
          >
            <strong>
              {issue.severity === 'info' ? 'Note' : 'Load warning'}
              {issue.overridden ? ' (override recorded)' : ''}
            </strong>
            {issue.message} {issue.resolution}
          </div>
        ))}
      </div>

      <div className="term-footer">
        <button type="button" className="subtle" onClick={() => onSelectTerm(term.id)}>
          Add course here
        </button>
      </div>
    </section>
  );
}

function LoadBadge({
  units,
  issues,
  termIssues,
}: {
  units: number;
  issues: number;
  termIssues: Array<{ severity: string; overridden?: boolean }>;
}) {
  if (units === 0) return <span className="badge neutral">Empty</span>;

  const hasWarning = termIssues.some((i) => i.severity === 'warning' && !i.overridden);
  if (hasWarning) {
    return (
      <span className="badge warn">
        <span aria-hidden="true">⚠</span> Outside 12–20
      </span>
    );
  }
  if (units >= REGULAR_MIN_UNITS && units <= REGULAR_MAX_UNITS) {
    return (
      <span className="badge ok">
        <span aria-hidden="true">✓</span> Standard load
      </span>
    );
  }
  return <span className="badge neutral">{issues > 0 ? 'See notes' : 'Partial'}</span>;
}

function SummerCard({
  group,
  assessment,
  selectedTermId,
  onSelectTerm,
  dragHandlers,
  isIncoming = false,
}: {
  group: SummerGroup;
  assessment: PlannerAssessment;
  selectedTermId: string;
  onSelectTerm: (id: string) => void;
  dragHandlers: DragHandlers;
  isIncoming?: boolean;
}) {
  const summer = assessment.bySummer.get(group.calendarYear);
  const headingId = `summer-${group.calendarYear}`;
  const [openLane, setOpenLane] = useState<string | null>(null);

  const totalCourses = group.sessions.reduce(
    (n, s) => n + (assessment.byTerm.get(s.id)?.placements.length ?? 0),
    0,
  );

  return (
    <section className={`term-card summer${isIncoming ? ' incoming' : ''}`} aria-labelledby={headingId}>
      <header>
        <div className="term-title">
          <h4 id={headingId}>{group.label}</h4>
          {isIncoming ? <span className="badge shared">Before Year 1</span> : null}
        </div>
        <div className="meta">
          <span>
            <strong>{summer?.totalUnits ?? 0}</strong> units total
          </span>
          <span>{totalCourses} {totalCourses === 1 ? 'course' : 'courses'}</span>
          {summer && !summer.valid ? (
            <span className="badge error">
              <span aria-hidden="true">⛔</span> Over 32-unit ceiling
            </span>
          ) : summer && summer.totalUnits > 0 ? (
            <span className="badge ok">
              <span aria-hidden="true">✓</span> Within Summer limits
            </span>
          ) : null}
        </div>
      </header>

      <div className="term-body">
        {group.sessions.map((session) => {
          const lane = assessment.byTerm.get(session.id);
          const sessionKey = session.summerSession!;
          const effective = summer?.sessionUnits[sessionKey] ?? 0;
          const dates = isIncoming ? SUMMER_2026_DATES[sessionKey] : null;

          return (
            <div
              key={session.id}
              className="summer-lane"
              onDragOver={(e) => {
                e.preventDefault();
                setOpenLane(session.id);
              }}
              onDragLeave={() => setOpenLane(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOpenLane(null);
                dragHandlers.onDropTerm(session.id);
              }}
              style={openLane === session.id ? { background: 'var(--info-bg)' } : undefined}
            >
              <div className="lane-label">
                <span>
                  {SUMMER_SESSION_LABEL[sessionKey]}
                  {selectedTermId === session.id ? ' • selected' : ''}
                </span>
                <span>
                  {lane?.units ?? 0}u
                  {sessionKey !== 'ten_week' && effective !== (lane?.units ?? 0)
                    ? ` (${effective}u w/ 10-week)`
                    : ''}
                </span>
              </div>
              {dates ? (
                <p style={{ fontSize: 10.5, color: 'var(--text-subtle)', margin: '2px 0' }}>
                  {dates.start} – {dates.end}
                </p>
              ) : null}

              {(lane?.placements.length ?? 0) === 0 ? (
                <p className="empty-state" style={{ padding: '4px 0' }}>
                  <button type="button" className="subtle" onClick={() => onSelectTerm(session.id)}>
                    Add to {SUMMER_SESSION_LABEL[sessionKey]}
                  </button>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  {lane!.placements.map((p) => (
                    <CourseChip key={p.placementId} assessment={p} dragHandlers={dragHandlers} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {summer?.loadIssues.map((issue, i) => (
          <div
            key={i}
            className={`callout ${issue.severity === 'invalid' ? 'error' : issue.severity === 'warning' ? 'warn' : 'info'}`}
          >
            <strong>
              {issue.severity === 'invalid'
                ? 'Invalid Summer load'
                : issue.severity === 'warning'
                  ? 'Summer load warning'
                  : 'Note'}
              {issue.overridden ? ' (override recorded)' : ''}
            </strong>
            {issue.message} {issue.resolution}
          </div>
        ))}
      </div>
    </section>
  );
}
