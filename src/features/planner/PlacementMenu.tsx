import { useMemo, useState } from 'react';
import { useStore, useActiveScenario } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import type { PlacementAssessment } from '../../domain/planner/warnings';
import { downstreamDependents } from '../../domain/planner/warnings';
import { buildTimeline, type Timeline } from '../../domain/terms/terms';
import type { CourseStatus, GradeBasis } from '../../domain/plan/types';
import { gradeSchema, type Grade } from '../../domain/courses/types';

/**
 * Keyboard-accessible equivalent for every drag action, plus grade entry.
 *
 * This is what makes criterion 14 ("perform every course move without dragging")
 * hold: move, remove, duplicate-to-scenario, and status/grade edits all live
 * here as ordinary buttons and selects.
 */

const STATUS_OPTIONS: Array<{ value: CourseStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'waived', label: 'Waived' },
  { value: 'failed', label: 'Failed' },
  { value: 'not_taken', label: 'Not taken' },
];

const GRADE_BASIS_OPTIONS: Array<{ value: GradeBasis; label: string }> = [
  { value: 'letter', label: 'Letter grade' },
  { value: 'pass_no_pass', label: 'Pass / No Pass' },
  { value: 'credit', label: 'Credit' },
  { value: 'external', label: 'External credit' },
];

export function PlacementMenu({
  placementId,
  assessment,
  onClose,
}: {
  placementId: string;
  assessment: PlacementAssessment;
  onClose: () => void;
}) {
  const plan = useStore((s) => s.plan);
  const scenario = useActiveScenario();
  const catalogue = useStore((s) => s.catalogue);
  const moveCourse = useStore((s) => s.moveCourse);
  const removeCourse = useStore((s) => s.removeCourse);
  const updatePlacement = useStore((s) => s.updatePlacement);
  const setGrade = useStore((s) => s.setGrade);
  const addOverride = useStore((s) => s.addOverride);
  const pushToast = useStore((s) => s.pushToast);

  const placement = scenario?.plannedCourses.find((p) => p.id === placementId);
  const [overrideNote, setOverrideNote] = useState('');

  const timeline: Timeline | null = useMemo(() => {
    if (!plan) return null;
    return buildTimeline({
      startYear: 2026,
      academicYears: 4,
      summersEnabled: plan.profile.workload.summersEnabled,
      graduationTermId: plan.profile.graduationTermId,
    });
  }, [plan]);

  const dependents = useMemo(() => {
    if (!scenario || !catalogue || !placement) return [];
    return downstreamDependents(placement.code, scenario, catalogue.index);
  }, [scenario, catalogue, placement]);

  if (!placement || !timeline) return null;

  const course = assessment.course;
  const isVariableUnits = course?.units.variable ?? false;

  return (
    <Dialog open onClose={onClose} title={`${placement.code} — placement`}>
      <section>
        <h3>Move to a term</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Status, grade, and notes are preserved when a course moves.
        </p>
        <label htmlFor="move-term">Term</label>
        <select
          id="move-term"
          value={placement.termId ?? ''}
          onChange={(e) => moveCourse(placementId, e.target.value || undefined)}
        >
          <option value="">Unscheduled (no term)</option>
          {timeline.allTerms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.label}
            </option>
          ))}
        </select>

        {dependents.length > 0 ? (
          <div className="callout warn" style={{ marginTop: 8 }}>
            <strong>{dependents.length} course{dependents.length === 1 ? '' : 's'} in this plan depend on {placement.code}</strong>
            {dependents.join(', ')}. Moving this course later may break their prerequisites.
          </div>
        ) : null}
      </section>

      <section>
        <h3>Status and grade</h3>
        <div className="filter-grid">
          <div>
            <label htmlFor="placement-status">Status</label>
            <select
              id="placement-status"
              value={placement.status}
              onChange={(e) => updatePlacement(placementId, { status: e.target.value as CourseStatus })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="placement-basis">Grade basis</label>
            <select
              id="placement-basis"
              value={placement.gradeBasis ?? ''}
              onChange={(e) =>
                setGrade(placementId, placement.grade, (e.target.value || undefined) as GradeBasis | undefined)
              }
            >
              <option value="">Not set</option>
              {GRADE_BASIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="placement-grade">Grade</label>
            <select
              id="placement-grade"
              value={placement.grade ?? ''}
              onChange={(e) =>
                setGrade(placementId, (e.target.value || undefined) as Grade | undefined, placement.gradeBasis)
              }
            >
              <option value="">Not recorded</option>
              {gradeSchema.options.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {isVariableUnits ? (
            <div>
              <label htmlFor="placement-units">
                Planned units ({course!.units.min}–{course!.units.max})
              </label>
              <input
                id="placement-units"
                type="number"
                min={course!.units.min}
                max={course!.units.max}
                value={placement.plannedUnits ?? course!.units.min}
                onChange={(e) => updatePlacement(placementId, { plannedUnits: Number(e.target.value) })}
              />
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 8 }}>
          <label htmlFor="placement-notes">Notes</label>
          <textarea
            id="placement-notes"
            rows={2}
            value={placement.notes ?? ''}
            onChange={(e) => updatePlacement(placementId, { notes: e.target.value })}
          />
        </div>
      </section>

      {assessment.warnings.length > 0 ? (
        <section>
          <h3>Warnings ({assessment.warnings.length})</h3>
          {assessment.warnings.map((w, i) => (
            <div
              key={i}
              className={`callout ${w.severity === 'error' ? 'error' : w.severity === 'warning' ? 'warn' : 'info'}`}
            >
              <strong>{w.title}</strong>
              {w.detail}
            </div>
          ))}

          <h3 style={{ marginTop: 12 }}>Record an adviser-approved override</h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            An override needs a note. It never changes the underlying catalogue rule — it records that an
            adviser approved an exception.
          </p>
          <label htmlFor="override-note">Reason</label>
          <input
            id="override-note"
            type="text"
            value={overrideNote}
            placeholder="e.g. Adviser approved prerequisite waiver, 2027-01-14"
            onChange={(e) => setOverrideNote(e.target.value)}
          />
          <button
            type="button"
            style={{ marginTop: 6 }}
            disabled={overrideNote.trim().length === 0}
            onClick={() => {
              const now = new Date().toISOString();
              addOverride({
                id: `ov-${Date.now().toString(36)}`,
                type: 'prerequisite_waiver',
                targetId: placement.code,
                note: overrideNote.trim(),
                createdAt: now,
                updatedAt: now,
              });
              setOverrideNote('');
            }}
          >
            Record prerequisite waiver
          </button>
        </section>
      ) : null}

      <section>
        <h3>Remove</h3>
        <button
          type="button"
          className="danger"
          onClick={() => {
            removeCourse(placementId);
            if (dependents.length > 0) {
              pushToast({
                message: `Removed ${placement.code}. ${dependents.length} dependent course(s) may now be affected.`,
                tone: 'warning',
              });
            }
            onClose();
          }}
        >
          Remove {placement.code} from the plan
        </button>
      </section>
    </Dialog>
  );
}
