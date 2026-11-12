import { useStore, useActiveScenario } from '../../app/store';
import type { AuditResult } from '../../domain/audit/audit';
import type { ProgramResult, RequirementResult } from '../../domain/requirements/allocate';
import { StatusBadge, requirementPresentation } from '../../components/StatusBadge';
import type { PlannerAssessment } from '../../domain/planner/warnings';

/**
 * Degree Audit — the right rail.
 *
 * 05_UI_UX_AND_ACCEPTANCE_CRITERIA.md: do not reduce status to one percentage.
 * Blocking and high-risk requirements are surfaced above the groups, and every
 * requirement exposes its source and reason.
 */

const CATEGORY_TITLES: Record<ProgramResult['category'], string> = {
  uc: 'UC Requirements',
  uci: 'UCI Degree Requirements',
  ge: 'General Education I–VIII',
  cs: 'Computer Science',
  math: 'Mathematics',
  gpa: 'Major GPA',
  eligibility: 'Add / Double-Major Eligibility',
  advising: 'Adviser Confirmations',
};

export function DegreeAudit({
  audit,
  assessment,
}: {
  audit: AuditResult | null;
  assessment: PlannerAssessment;
}) {
  const plan = useStore((s) => s.plan);

  if (!audit || !plan) {
    return (
      <>
        <div className="rail-header">
          <h2>Degree Audit</h2>
        </div>
        <div className="rail-body">
          <p className="empty-state">Loading audit…</p>
        </div>
      </>
    );
  }

  const { units, gpas } = audit;
  const unresolvedWarnings = assessment.allWarnings.filter((w) => w.severity !== 'info').length;

  // Requirements that need attention first — never collapsed into one number.
  const atRisk = audit.allocation.programs
    .flatMap((p) => p.requirements.map((r) => ({ program: p, requirement: r })))
    .filter(({ requirement }) => requirement.state === 'at_risk');

  return (
    <>
      <div className="rail-header">
        <h2 id="audit-heading">Degree Audit</h2>
        <span className="badge neutral">{plan.profile.catalogueYear}</span>
      </div>

      <div className="rail-body">
        <div className="summary-grid">
          <div className="summary-tile">
            <div className="label">Projected units</div>
            <div className="value">{units.projected}</div>
            <div className="sub">of 180 required</div>
          </div>
          <div className="summary-tile">
            <div className="label">Completed</div>
            <div className="value">{units.completed}</div>
            <div className="sub">
              {units.inProgress > 0 ? `${units.inProgress} in progress · ` : ''}
              {units.external} external
            </div>
          </div>
          <div className="summary-tile">
            <div className="label">Graduation target</div>
            <div className="value" style={{ fontSize: 14 }}>
              {formatTermId(plan.profile.graduationTermId)}
            </div>
            <div className="sub">{units.planned} units planned</div>
          </div>
          <div className="summary-tile">
            <div className="label">Open warnings</div>
            <div className="value" style={{ color: unresolvedWarnings > 0 ? 'var(--warn)' : 'var(--ok)' }}>
              {unresolvedWarnings}
            </div>
            <div className="sub">on placed courses</div>
          </div>
        </div>

        {atRisk.length > 0 ? (
          <div className="callout warn">
            <strong>
              <span aria-hidden="true">⚠</span> {atRisk.length} requirement
              {atRisk.length === 1 ? '' : 's'} at risk
            </strong>
            {atRisk.slice(0, 3).map(({ requirement }) => requirement.title).join('; ')}
            {atRisk.length > 3 ? ` and ${atRisk.length - 3} more.` : '.'}
          </div>
        ) : null}

        <section aria-labelledby="gpa-heading" style={{ marginBottom: 12 }}>
          <h3 id="gpa-heading" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>
            GPA tracking
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12.5 }}>
            {gpas.map((gpa) => (
              <li key={gpa.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--surface-3)' }}>
                <span>{gpa.label}</span>
                <span>
                  {gpa.gpa !== undefined ? (
                    <strong>{gpa.gpa.toFixed(2)}</strong>
                  ) : (
                    <span className="badge unknown" title={gpa.note}>
                      <span aria-hidden="true">?</span> Not yet
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 4 }}>
            Exam credit and P/NP work are excluded from every GPA.
          </p>
        </section>

        {audit.allocation.programs.map((program) => (
          <ProgramGroup key={program.programId} program={program} />
        ))}
      </div>
    </>
  );
}

function ProgramGroup({ program }: { program: ProgramResult }) {
  const complete = program.requirements.filter((r) => r.state === 'complete').length;

  return (
    <details className="audit-group" open={program.category === 'cs' || program.category === 'math'}>
      <summary>
        <span className="grow">
          {CATEGORY_TITLES[program.category]}
          {program.category === 'math' || program.category === 'cs' ? (
            <span style={{ display: 'block', fontWeight: 400, fontSize: 11.5, color: 'var(--text-muted)' }}>
              {program.title}
            </span>
          ) : null}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {complete}/{program.requirements.length}
        </span>
        <span className="progress-track" aria-hidden="true">
          <span className="progress-fill" style={{ width: `${Math.round(program.progress * 100)}%` }} />
        </span>
        <StatusBadge state={program.state} compact />
      </summary>

      <div className="card" style={{ borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        {program.requirements.map((requirement) => (
          <RequirementRow key={requirement.requirementId} requirement={requirement} />
        ))}
      </div>
    </details>
  );
}

function RequirementRow({ requirement, depth = 0 }: { requirement: RequirementResult; depth?: number }) {
  const setExplorerFilterCodes = useStore((s) => s.setExplorerFilterCodes);
  const pinAllocation = useStore((s) => s.pinAllocation);
  const scenario = useActiveScenario();
  const presentation = requirementPresentation(requirement.state);

  const isPinned = scenario?.pinnedAllocations.some((p) => p.requirementId === requirement.requirementId);
  const hasSuggestions = (requirement.suggestedCodes?.length ?? 0) > 0;

  return (
    <div className="requirement" style={depth > 0 ? { paddingLeft: 8 } : undefined}>
      <div className="req-head">
        <span className="badge" style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <span className="status-icon" aria-hidden="true">{presentation.icon}</span>
          <span className="visually-hidden">{presentation.label}:</span>
        </span>
        <span className="req-title">{requirement.title}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {requirement.satisfied}/{requirement.needed}
        </span>
      </div>

      <div className="req-detail">{requirement.detail}</div>

      {requirement.satisfiedBy.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
          {requirement.satisfiedBy.map((claim) => (
            <span key={claim.id} className="badge neutral code" title={claim.title}>
              {claim.code}
              {claim.external ? ' (external)' : ''}
            </span>
          ))}
        </div>
      ) : null}

      {requirement.verificationNote ? (
        <div className="callout unknown" style={{ marginTop: 5, marginBottom: 0 }}>
          <strong>Needs verification</strong>
          {requirement.verificationNote}
        </div>
      ) : null}

      {requirement.viaOverride ? (
        <div className="badge warn" style={{ marginTop: 4 }}>
          <span aria-hidden="true">✎</span> Counted via a recorded override
        </div>
      ) : null}

      <div className="req-source">
        <a href={requirement.sourceUrl} target="_blank" rel="noreferrer noopener">
          Source · {requirement.catalogueYear} ↗
        </a>
        {hasSuggestions && requirement.state !== 'complete' ? (
          <>
            {' · '}
            <button
              type="button"
              className="subtle"
              style={{ minHeight: 'auto', padding: '0 2px', fontSize: 11.5 }}
              onClick={() => setExplorerFilterCodes(requirement.suggestedCodes!)}
            >
              Add a course that satisfies this
            </button>
          </>
        ) : null}
        {requirement.satisfiedBy.length > 0 ? (
          <>
            {' · '}
            <button
              type="button"
              className="subtle"
              style={{ minHeight: 'auto', padding: '0 2px', fontSize: 11.5 }}
              onClick={() =>
                pinAllocation(
                  requirement.requirementId,
                  requirement.satisfiedBy.map((c) => c.id),
                )
              }
            >
              {isPinned ? 'Re-pin allocation' : 'Pin allocation'}
            </button>
          </>
        ) : null}
      </div>

      {requirement.children && requirement.children.length > 0 ? (
        <details style={{ marginTop: 5 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
            {requirement.children.length} sub-requirement{requirement.children.length === 1 ? '' : 's'}
          </summary>
          <div className="req-children">
            {requirement.children.map((child) => (
              <RequirementRow key={child.requirementId} requirement={child} depth={depth + 1} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function formatTermId(termId: string): string {
  const match = /^(\d{4})-(fall|winter|spring|summer)/.exec(termId);
  if (!match) return termId;
  const season = match[2]!;
  return `${season.charAt(0).toUpperCase()}${season.slice(1)} ${match[1]}`;
}
