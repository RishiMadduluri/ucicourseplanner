import { useState } from 'react';
import { useStore, useActiveScenario, useAudit } from '../../app/store';
import type { PlacementAssessment } from '../../domain/planner/warnings';
import { PrerequisiteBadge } from '../../components/StatusBadge';
import { PlacementMenu } from './PlacementMenu';

/**
 * A course chip inside a term card.
 *
 * Drag-and-drop is available, but *every* drag action also has a keyboard and
 * button equivalent through the placement menu (criterion 14).
 */

interface Props {
  assessment: PlacementAssessment;
  dragHandlers: {
    dragPlacementId: string | null;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
  };
}

const STATUS_LABEL: Record<string, { icon: string; label: string }> = {
  planned: { icon: '🗓', label: 'Planned' },
  in_progress: { icon: '◐', label: 'In progress' },
  completed: { icon: '✓', label: 'Completed' },
  waived: { icon: '⊘', label: 'Waived' },
  failed: { icon: '✗', label: 'Failed' },
  not_taken: { icon: '–', label: 'Not taken' },
};

export function CourseChip({ assessment, dragHandlers }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openDetail = useStore((s) => s.openDetail);
  const scenario = useActiveScenario();
  const auditResult = useAudit();

  const placement = scenario?.plannedCourses.find((p) => p.id === assessment.placementId);
  if (!placement) return null;

  const status = STATUS_LABEL[placement.status] ?? STATUS_LABEL.planned!;
  const errors = assessment.warnings.filter((w) => w.severity === 'error');
  const warnings = assessment.warnings.filter((w) => w.severity === 'warning');

  // Requirement ids this placement is allocated to, for "shared" badges.
  const usedBy = auditResult?.allocation.claimUsage.get(placement.id) ?? [];
  const programsTouched = new Set(
    usedBy.map((id) => (id.startsWith('cs.') ? 'CS' : id.startsWith('math.') ? 'Math' : id.startsWith('ge.') ? 'GE' : null)).filter(Boolean),
  );

  const chipClass = errors.length > 0 ? 'chip has-error' : warnings.length > 0 ? 'chip has-warning' : 'chip';
  const isDragging = dragHandlers.dragPlacementId === placement.id;

  return (
    <div
      className={`${chipClass}${isDragging ? ' dragging' : ''}`}
      draggable
      onDragStart={() => dragHandlers.onDragStart(placement.id)}
      onDragEnd={dragHandlers.onDragEnd}
    >
      <div className="chip-head">
        <span className="drag-handle" aria-hidden="true" title="Drag to move, or use the menu">⠿</span>
        <button
          type="button"
          className="subtle code chip-code"
          onClick={() => openDetail(placement.code)}
          style={{ padding: '0 2px', minHeight: 'auto', textAlign: 'left' }}
        >
          {placement.code}
        </button>
        <span className="chip-title">{assessment.course?.title ?? 'Unknown course'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {assessment.units}u
        </span>
        <button
          type="button"
          className="subtle icon"
          onClick={() => setMenuOpen(true)}
          aria-label={`Actions for ${placement.code}`}
        >
          ⋯
        </button>
      </div>

      <div className="chip-badges">
        <span className="badge neutral">
          <span aria-hidden="true">{status.icon}</span> {status.label}
          {placement.grade ? ` · ${placement.grade}` : ''}
        </span>

        {assessment.eligibility ? (
          <PrerequisiteBadge
            status={assessment.eligibility.prerequisite.status}
            conditional={assessment.eligibility.prerequisite.conditional}
            title={
              assessment.eligibility.prerequisite.missing.join(' ') ||
              assessment.eligibility.prerequisite.unresolved.join(' ') ||
              'Prerequisites satisfied by earlier terms.'
            }
          />
        ) : null}

        {Array.from(programsTouched).map((program) => (
          <span key={program as string} className={programsTouched.size > 1 ? 'badge shared' : 'badge neutral'}>
            {program as string}
          </span>
        ))}
        {programsTouched.size > 1 ? <span className="badge shared">Shared</span> : null}
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <ul style={{ margin: '5px 0 0', paddingLeft: 16, fontSize: 11.5 }}>
          {[...errors, ...warnings].slice(0, 3).map((w, i) => (
            <li key={i} style={{ color: w.severity === 'error' ? 'var(--error)' : 'var(--warn)' }}>
              <strong>{w.title}.</strong> {w.detail}
            </li>
          ))}
        </ul>
      )}

      {menuOpen ? (
        <PlacementMenu
          placementId={placement.id}
          assessment={assessment}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </div>
  );
}
