import type { RequirementState } from '../domain/requirements/types';
import type { OfferingState } from '../domain/offerings/types';
import type { Trivalent } from '../domain/prerequisites/evaluate';

/**
 * Status presentation.
 *
 * 05_UI_UX_AND_ACCEPTANCE_CRITERIA.md requires an icon *and* text alongside
 * colour, so nothing here is ever colour-only.
 */

export type Tone = 'ok' | 'info' | 'warn' | 'error' | 'unknown' | 'neutral' | 'shared';

const REQUIREMENT_PRESENTATION: Record<RequirementState, { icon: string; label: string; tone: Tone }> = {
  complete: { icon: '✓', label: 'Complete', tone: 'ok' },
  in_progress: { icon: '◐', label: 'In progress', tone: 'info' },
  planned: { icon: '🗓', label: 'Planned', tone: 'info' },
  at_risk: { icon: '⚠', label: 'At risk', tone: 'warn' },
  unmet: { icon: '○', label: 'Unmet', tone: 'neutral' },
  unknown: { icon: '?', label: 'Needs verification', tone: 'unknown' },
};

export function requirementPresentation(state: RequirementState) {
  return REQUIREMENT_PRESENTATION[state];
}

export function StatusBadge({ state, compact = false }: { state: RequirementState; compact?: boolean }) {
  const { icon, label, tone } = REQUIREMENT_PRESENTATION[state];
  return (
    <span className={`badge ${tone}`}>
      <span className="status-icon" aria-hidden="true">{icon}</span>
      {compact ? <span className="visually-hidden">{label}</span> : <span>{label}</span>}
    </span>
  );
}

const OFFERING_PRESENTATION: Record<OfferingState, { icon: string; label: string; tone: Tone }> = {
  scheduled: { icon: '📅', label: 'Published', tone: 'ok' },
  planned: { icon: '📝', label: 'Dept. planned — tentative', tone: 'info' },
  likely: { icon: '📈', label: 'Historically likely', tone: 'info' },
  possible: { icon: '📊', label: 'Historically possible', tone: 'neutral' },
  uncommon: { icon: '📉', label: 'Historically uncommon', tone: 'warn' },
  not_observed: { icon: '∅', label: 'Not recently observed', tone: 'warn' },
  unknown: { icon: '?', label: 'Offering unknown', tone: 'unknown' },
};

export function OfferingBadge({ state, title }: { state: OfferingState; title?: string }) {
  const { icon, label, tone } = OFFERING_PRESENTATION[state];
  return (
    <span className={`badge ${tone}`} title={title}>
      <span className="status-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

const PREREQ_PRESENTATION: Record<Trivalent, { icon: string; label: string; tone: Tone }> = {
  satisfied: { icon: '✓', label: 'Prerequisites satisfied', tone: 'ok' },
  unsatisfied: { icon: '✗', label: 'Prerequisites not met', tone: 'error' },
  unknown: { icon: '?', label: 'Prerequisites need review', tone: 'unknown' },
};

export function PrerequisiteBadge({
  status,
  conditional = false,
  title,
}: {
  status: Trivalent;
  conditional?: boolean;
  title?: string;
}) {
  const base = PREREQ_PRESENTATION[status];
  const label = conditional && status === 'satisfied' ? 'Prerequisites planned' : base.label;
  const tone: Tone = conditional && status === 'satisfied' ? 'info' : base.tone;
  return (
    <span className={`badge ${tone}`} title={title}>
      <span className="status-icon" aria-hidden="true">{base.icon}</span>
      <span>{label}</span>
    </span>
  );
}
