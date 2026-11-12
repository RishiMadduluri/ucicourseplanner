import { useEffect, useMemo, useState } from 'react';
import type { Term } from '../../domain/terms/terms';
import { useStore } from '../../app/store';
import {
  COURSEWORK_PRESENTATION,
  ELIGIBILITY_PRESENTATION,
  READINESS_PRESENTATION,
} from '../../domain/transfer/evaluate';
import type { ProgramResult, RequirementCheck, EligibilityCheckResult } from '../../domain/transfer/evaluate';
import type { ProgramReadiness } from '../../domain/transfer/evaluate';
import { CONFIDENCE_LABEL, NECESSITY_LABEL } from '../../domain/transfer/types';
import { requirementPresentation } from '../../components/StatusBadge';
import { useApplicationDeadlineAudit, useTransferAudit, transferPointOptions } from './useTransferAudit';
import { isTransferSourceStale, TRANSFER_INSTITUTIONS } from '../../domain/transfer/registry';
import {
  applicationCyclesForProgram,
  formatCycleDate,
  formatEntry,
  UCI_CALENDAR_SOURCES,
} from '../../domain/transfer/deadlines';
import type { ApplicationCycle, DeadlineAudit, DeadlineReadiness } from '../../domain/transfer/deadlines';
import type { TransferInstitution, TransferProgram } from '../../domain/transfer/types';

/**
 * Transfer Readiness.
 *
 * Two rules shape this screen:
 *
 *  1. **Never imply an articulation exists.** No target on this list publishes a
 *     UCI articulation — ASSIST is community-college-only, and Berkeley says
 *     flatly that UC keeps no agreements with any four-year school. Every
 *     mapping therefore shows its confidence level and its source URL.
 *  2. **Separate "wrong courses" from "wrong moment."** A coursework gap is
 *     fixed by adding a class; an eligibility failure is usually fixed by
 *     transferring a term earlier, or cannot be fixed at all. They get separate
 *     badges so the student can tell which lever to pull.
 */

const READINESS_ORDER: ProgramReadiness[] = ['on_track', 'none_published', 'gaps', 'not_started', 'needs_review', 'ineligible', 'closed'];

const TESTING_LABEL = {
  required: 'Required',
  required_with_waiver: 'Required unless a published waiver applies',
  optional: 'Optional',
  recommended: 'Recommended, not required',
  not_used: 'Not used',
} as const;

type Filter = 'all' | 'actionable' | 'blocked';
type Sort = 'list' | 'university' | 'readiness';

function transferPointFor(terms: Term[], stored?: string): string {
  if (stored && terms.some((term) => term.id === stored)) return stored;
  const springs = terms.filter((term) => term.season === 'spring');
  return springs[1]?.id ?? terms[terms.length - 1]?.id ?? '';
}

export function TransferView({ terms }: { terms: Term[] }) {
  const plan = useStore((s) => s.plan);
  const setTransferPoint = useStore((s) => s.setTransferPoint);
  const [lastTermId, setLastTermId] = useState(() => transferPointFor(terms, plan?.transfer?.lastTermId));
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('list');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printInstitutionId, setPrintInstitutionId] = useState<string | null>(null);
  const [deadlineInstitutionId, setDeadlineInstitutionId] = useState('cornell');
  const [deadlineProgramId, setDeadlineProgramId] = useState('cornell.ece_bs');
  const [deadlineCycleId, setDeadlineCycleId] = useState('');

  const audit = useTransferAudit(terms, lastTermId);
  const options = useMemo(() => transferPointOptions(terms), [terms]);
  const deadlineInstitution = TRANSFER_INSTITUTIONS.find((institution) => institution.id === deadlineInstitutionId)
    ?? TRANSFER_INSTITUTIONS[0]!;
  const deadlineProgram = deadlineInstitution.programs.find((program) => program.id === deadlineProgramId)
    ?? deadlineInstitution.programs[0]!;
  const deadlineCycles = useMemo(
    () => applicationCyclesForProgram(deadlineInstitution, deadlineProgram),
    [deadlineInstitution, deadlineProgram],
  );
  const deadlineCycle = deadlineCycles.find((cycle) => cycle.id === deadlineCycleId) ?? deadlineCycles[0];
  const deadlineAudit = useApplicationDeadlineAudit(terms, deadlineProgram.id, deadlineCycle);

  // Importing or replacing a plan while this workspace is open must update
  // the visible cutoff too; local component state must not outlive its plan.
  useEffect(() => {
    setLastTermId(transferPointFor(terms, plan?.transfer?.lastTermId));
  }, [plan?.id, plan?.transfer?.lastTermId, terms]);

  useEffect(() => {
    const clearPrintState = () => setPrintInstitutionId(null);
    window.addEventListener('afterprint', clearPrintState);
    return () => window.removeEventListener('afterprint', clearPrintState);
  }, []);

  if (!audit) {
    return (
      <div className="transfer-view">
        <p className="empty-state">Loading transfer targets…</p>
      </div>
    );
  }

  const { snapshot, results, earliestEligibleByProgram } = audit;

  const byInstitution = new Map<string, ProgramResult[]>();
  for (const result of results) {
    const list = byInstitution.get(result.institution.id) ?? [];
    list.push(result);
    byInstitution.set(result.institution.id, list);
  }

  const counts = READINESS_ORDER.map((readiness) => ({
    readiness,
    count: results.filter((result) => result.readiness === readiness).length,
  }));

  function visible(list: ProgramResult[]): ProgramResult[] {
    let shown = list;
    if (filter === 'actionable') shown = shown.filter((r) => r.readiness === 'gaps' || r.readiness === 'not_started');
    if (filter === 'blocked') shown = shown.filter((r) => r.readiness === 'ineligible' || r.readiness === 'closed');
    const normalized = query.trim().toLowerCase();
    if (normalized) {
      shown = shown.filter((result) =>
        [result.institution.name, result.institution.shortName, result.program.name, result.program.admittingUnit, result.program.degree]
          .some((value) => value.toLowerCase().includes(normalized))
      );
    }
    if (sort === 'readiness') {
      shown = [...shown].sort((a, b) => READINESS_ORDER.indexOf(a.readiness) - READINESS_ORDER.indexOf(b.readiness));
    }
    return shown;
  }

  function onSelectTerm(id: string) {
    setLastTermId(id);
    setTransferPoint(id);
  }

  function printSchool(institutionId: string) {
    setPrintInstitutionId(institutionId);
    window.setTimeout(() => window.print(), 50);
  }

  let institutionEntries = [...byInstitution.entries()];
  if (sort === 'university') {
    institutionEntries = institutionEntries.sort(([, a], [, b]) =>
      a[0]!.institution.name.localeCompare(b[0]!.institution.name)
    );
  }
  const staleCount = results.filter((result) => isTransferSourceStale(result.program.retrievedAt)).length;

  return (
    <div className={`transfer-view${printInstitutionId ? ' transfer-printing' : ''}`}>
      <div className="transfer-header">
        <div>
          <h2>Transfer Readiness</h2>
          <p className="transfer-sub">
            {results.length} programs across {byInstitution.size} universities, checked against the plan
            as it would stand at the end of {snapshot.lastTermLabel}.
          </p>
        </div>

        <label className="transfer-point">
          <span>Last UCI term before transferring</span>
          <select value={lastTermId} onChange={(event) => onSelectTerm(event.target.value)}>
            {options.map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DeadlineChecker
        institution={deadlineInstitution}
        program={deadlineProgram}
        cycles={deadlineCycles}
        selectedCycle={deadlineCycle}
        audit={deadlineAudit}
        onInstitutionChange={(institutionId) => {
          const institution = TRANSFER_INSTITUTIONS.find((entry) => entry.id === institutionId);
          const program = institution?.programs[0];
          setDeadlineInstitutionId(institutionId);
          if (program) setDeadlineProgramId(program.id);
          setDeadlineCycleId('');
        }}
        onProgramChange={(programId) => {
          setDeadlineProgramId(programId);
          setDeadlineCycleId('');
        }}
        onCycleChange={setDeadlineCycleId}
      />

      {staleCount > 0 ? (
        <div className="callout warn transfer-stale" role="status">
          <strong>{staleCount} program source record{staleCount === 1 ? ' is' : 's are'} more than six months old.</strong>
          Recheck the linked admissions pages before relying on deadlines or eligibility rules.
        </div>
      ) : null}

      <div className="callout warn transfer-disclaimer" role="note">
        <strong>
          <span aria-hidden="true">⚠</span> No school on this list has an articulation agreement with UCI.
        </strong>
        ASSIST covers California community colleges only, and UC Berkeley states outright that “UC does not
        maintain articulation agreements from any four-year institutions.” Every UCI-to-target course mapping
        below is this app’s reading of two catalogues, not an agreement. Each requirement shows how much
        authority stands behind it and links its source. Confirm everything with the target school before
        you rely on it.
      </div>

      <div className="summary-grid transfer-summary">
        <SummaryTile
          label="Regular quarters"
          value={String(snapshot.regularQuartersCompleted)}
          sub={
            snapshot.summerTermsCompleted > 0
              ? `+ ${snapshot.summerTermsCompleted} summer (often excluded)`
              : 'fall / winter / spring only'
          }
        />
        <SummaryTile
          label="Classroom quarter units"
          value={String(round(snapshot.courseworkQuarterUnits))}
          sub={snapshot.examQuarterUnits > 0
            ? `+ ${round(snapshot.examQuarterUnits)} exam units pending target review`
            : `≈ ${round(snapshot.semesterUnitsEquivalent)} semester units`}
        />
        <SummaryTile
          label="UCI GPA"
          value={snapshot.gpa !== undefined ? snapshot.gpa.toFixed(2) : '—'}
          sub={snapshot.gradedUnits > 0 ? `${round(snapshot.gradedUnits)} graded units` : 'no letter grades yet'}
        />
        <SummaryTile
          label="At A or B"
          value={snapshot.fractionAtAOrB !== undefined ? `${Math.round(snapshot.fractionAtAOrB * 100)}%` : '—'}
          sub={snapshot.lowestLetterGrade ? `lowest grade ${snapshot.lowestLetterGrade}` : 'Yale requires 75%'}
        />
      </div>

      <div className="transfer-controls">
        <div className="transfer-counts" role="status">
          {counts
            .filter((entry) => entry.count > 0)
            .map((entry) => {
              const presentation = READINESS_PRESENTATION[entry.readiness];
              return (
                <span key={entry.readiness} className={`badge ${presentation.tone}`}>
                  <span className="status-icon" aria-hidden="true">{presentation.icon}</span>
                  {entry.count} {presentation.label.toLowerCase()}
                </span>
              );
            })}
        </div>
        <div className="transfer-filters">
          <label className="transfer-search">
            <span className="visually-hidden">Search universities and programs</span>
            <input
              type="search"
              value={query}
              placeholder="Search school or major"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="transfer-sort">
            <span className="visually-hidden">Sort transfer programs</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="list">Your original list</option>
              <option value="university">University A–Z</option>
              <option value="readiness">Readiness</option>
            </select>
          </label>
          {(['all', 'actionable', 'blocked'] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? '' : 'subtle'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'actionable' ? 'Needs coursework' : 'Blocked or closed'}
            </button>
          ))}
        </div>
      </div>

      <div className="transfer-schools">
        {institutionEntries.map(([institutionId, list]) => {
          const shown = visible(list);
          if (shown.length === 0) return null;
          const institution = list[0]!.institution;
          return (
            <section
              key={institutionId}
              className={`card transfer-school${printInstitutionId === institutionId ? ' print-selected' : ''}`}
              aria-labelledby={`school-${institutionId}`}
            >
              <header className="transfer-school-header">
                <h3 id={`school-${institutionId}`}>{institution.name}</h3>
                <span className="transfer-school-actions">
                  <span className="badge neutral">{institution.calendar} calendar</span>
                  <button type="button" className="subtle print-school" onClick={() => printSchool(institutionId)}>
                    Print gap report
                  </button>
                </span>
              </header>
              <ul className="transfer-programs">
                {shown.map((result) => (
                  <ProgramRow
                    key={result.program.id}
                    result={result}
                    open={expanded === result.program.id || printInstitutionId === institutionId}
                    earliestEligible={earliestEligibleByProgram.get(result.program.id)}
                    terms={terms}
                    lastTermId={lastTermId}
                    onToggle={() =>
                      setExpanded((current) => (current === result.program.id ? null : result.program.id))
                    }
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const DEADLINE_PRESENTATION: Record<DeadlineReadiness, { tone: string; icon: string }> = {
  eligible: { tone: 'ok', icon: '✓' },
  on_track: { tone: 'info', icon: '↗' },
  gaps: { tone: 'warn', icon: '!' },
  not_eligible: { tone: 'error', icon: '✗' },
  needs_review: { tone: 'unknown', icon: '?' },
  closed: { tone: 'error', icon: '⛔' },
  deadline_unpublished: { tone: 'unknown', icon: '?' },
};

function DeadlineChecker({
  institution,
  program,
  cycles,
  selectedCycle,
  audit,
  onInstitutionChange,
  onProgramChange,
  onCycleChange,
}: {
  institution: TransferInstitution;
  program: TransferProgram;
  cycles: ApplicationCycle[];
  selectedCycle?: ApplicationCycle;
  audit: DeadlineAudit | null;
  onInstitutionChange: (institutionId: string) => void;
  onProgramChange: (programId: string) => void;
  onCycleChange: (cycleId: string) => void;
}) {
  const testing = institution.id === 'princeton' && selectedCycle
    ? selectedCycle.entryYear >= 2028 ? 'Required' : 'Optional for this entry year'
    : TESTING_LABEL[program.eligibility.testing];
  const presentation = audit ? DEADLINE_PRESENTATION[audit.readiness] : DEADLINE_PRESENTATION.needs_review;

  return (
    <section className="card deadline-checker" aria-labelledby="deadline-checker-title">
      <header className="deadline-checker-header">
        <div>
          <span className="eyebrow">Application deadline checker</span>
          <h3 id="deadline-checker-title">Can I apply for a specific cycle?</h3>
          <p>
            Choose the admitting program and entry cycle. ZotPath will ignore every planned course the school
            cannot see or does not permit by that cycle’s coursework cutoff.
          </p>
        </div>
        {audit ? (
          <span className={`badge ${presentation.tone} deadline-result-badge`}>
            <span className="status-icon" aria-hidden="true">{presentation.icon}</span>
            {audit.headline}
          </span>
        ) : null}
      </header>

      <div className="deadline-selectors">
        <label>
          <span>University</span>
          <select value={institution.id} onChange={(event) => onInstitutionChange(event.target.value)}>
            {TRANSFER_INSTITUTIONS.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Admitting program</span>
          <select value={program.id} onChange={(event) => onProgramChange(event.target.value)}>
            {institution.programs.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name} — {entry.admittingUnit}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Application cycle</span>
          <select
            value={selectedCycle?.id ?? ''}
            disabled={cycles.length === 0}
            onChange={(event) => onCycleChange(event.target.value)}
          >
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {formatEntry(cycle)} — {formatCycleDate(cycle.applicationDeadline)}
                {cycle.historicalEstimate ? ' (historical estimate)' : cycle.projected ? ' (projected)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedCycle?.historicalEstimate ? (
        <div className="callout warn deadline-projection" role="note">
          <strong>Historical placeholder date</strong>
          This date comes from UChicago’s official historical March 1 pattern, not a published date
          for this cycle. Use it to estimate readiness, but verify the actual deadline and round before applying.
        </div>
      ) : selectedCycle?.projected ? (
        <div className="callout warn deadline-projection" role="note">
          <strong>Future date projection</strong>
          The school has not published this cycle yet. The date repeats its currently published month and day;
          confirm it on the linked official page before planning around it.
        </div>
      ) : null}

      {audit && selectedCycle ? (
        <div className="deadline-result">
          <div className={`callout ${presentation.tone}`} role="status">
            <strong><span aria-hidden="true">{presentation.icon}</span> {audit.headline}</strong>
            <ul className="transfer-plain-list">
              {audit.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>

          <dl className="deadline-timeline" aria-label="Deadline and coursework timing">
            <div>
              <dt>Application due</dt>
              <dd>{formatCycleDate(selectedCycle.applicationDeadline)}</dd>
            </div>
            <div>
              <dt>At application</dt>
              <dd>{snapshotSummary(audit.atApplication)}</dd>
            </div>
            <div>
              <dt>Coursework allowed through</dt>
              <dd>{formatCycleDate(selectedCycle.courseworkCutoff)} · {selectedCycle.timingLabel}</dd>
            </div>
            <div>
              <dt>At allowed cutoff</dt>
              <dd>{snapshotSummary(audit.byCourseworkCutoff)}</dd>
            </div>
            <div>
              <dt>Transfer testing</dt>
              <dd>{testing}</dd>
            </div>
          </dl>

          <div className="deadline-course-window">
            <div>
              <strong>Terms included by the application date</strong>
              <span>{termList(audit.termsAtApplication)}</span>
            </div>
            <div>
              <strong>Later terms this school explicitly allows</strong>
              <span>{audit.termsAllowedAfterApplication.length > 0
                ? termList(audit.termsAllowedAfterApplication)
                : 'None — later planned terms do not count for this cycle.'}</span>
            </div>
            <div>
              <strong>First excluded term</strong>
              <span>{audit.excludedTerms[0]?.label ?? 'No later term exists in this plan.'}</span>
            </div>
          </div>

          <div className="callout info deadline-policy-note">
            <strong>Why this cutoff is used</strong>
            {selectedCycle.timingExplanation}
          </div>

          {selectedCycle.notes.length > 0 ? (
            <ul className="transfer-plain-list deadline-notes">
              {selectedCycle.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          ) : null}

          {audit.result ? (
            <details className="deadline-details">
              <summary>
                See the {audit.result.requiredSatisfied}/{audit.result.requiredTotal || 0} required-course audit
                and eligibility checks
              </summary>
              <div className="deadline-detail-body">
                {audit.result.failingRules.length > 0 ? (
                  <div className="callout error">
                    <strong>Blocking checks</strong>
                    <ul className="transfer-plain-list">
                      {audit.result.failingRules.map((entry) => (
                        <li key={entry.rule.id}><strong>{entry.rule.title}.</strong> {entry.detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <RequirementList checks={audit.result.requirementChecks} />
                <EligibilityList results={audit.result.eligibilityResults} />
              </div>
            </details>
          ) : null}

          <p className="transfer-sources deadline-sources">
            Deadline policy sources:{' '}
            {[...new Set([...selectedCycle.sourceUrls, ...UCI_CALENDAR_SOURCES])].map((url, index) => (
              <span key={url}>
                {index > 0 ? ' · ' : ''}
                <a href={url} target="_blank" rel="noreferrer noopener">{shortenUrl(url)}</a>
              </span>
            ))}
          </p>
        </div>
      ) : (
        <p className="empty-state">No deadline cycle is available for this program.</p>
      )}
    </section>
  );
}

function snapshotSummary(snapshot: DeadlineAudit['atApplication']): string {
  if (!snapshot) return 'Cannot calculate until the deadline is published';
  const units = round(snapshot.courseworkQuarterUnits);
  return `${snapshot.regularQuartersCompleted} regular quarters · ${units} classroom quarter units`;
}

function termList(terms: Term[]): string {
  if (terms.length === 0) return 'No UCI term in the plan';
  return terms.map((term) => term.label).join(', ');
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="summary-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function ProgramRow({
  result,
  open,
  onToggle,
  earliestEligible,
  terms,
  lastTermId,
}: {
  result: ProgramResult;
  open: boolean;
  onToggle: () => void;
  earliestEligible?: { termId: string; label: string };
  terms: Term[];
  lastTermId: string;
}) {
  const readiness = READINESS_PRESENTATION[result.readiness];
  const coursework = COURSEWORK_PRESENTATION[result.coursework];
  const eligibility = ELIGIBILITY_PRESENTATION[result.eligibility];
  const panelId = `program-${result.program.id.replace(/\W+/g, '-')}`;

  return (
    <li className="transfer-program">
      <button type="button" className="transfer-program-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="transfer-program-name">
          <strong>{result.program.name}</strong>
          <span className="transfer-unit">{result.program.admittingUnit} · {result.program.degree}</span>
        </span>
        <span className="transfer-badges">
          <span className={`badge ${coursework.tone}`} title={coursework.label}>
            <span className="status-icon" aria-hidden="true">{coursework.icon}</span>
            {result.requiredTotal > 0
              ? `${result.requiredSatisfied}/${result.requiredTotal} required`
              : coursework.label}
          </span>
          <span className={`badge ${eligibility.tone}`}>
            <span className="status-icon" aria-hidden="true">{eligibility.icon}</span>
            {eligibility.label}
          </span>
        </span>
        <span aria-hidden="true" className="transfer-chevron">{open ? '▾' : '▸'}</span>
        <span className="visually-hidden">{readiness.label}</span>
      </button>

      {open ? (
        <div className="transfer-detail" id={panelId}>
          {result.program.eligibility.closedToTransfer ? (
            <div className="callout error">
              <strong><span aria-hidden="true">⛔</span> Closed to transfer applicants</strong>
              {result.program.eligibility.closedToTransfer}
            </div>
          ) : null}

          {result.failingRules.length > 0 ? (
            <div className="callout error">
              <strong>
                <span aria-hidden="true">✗</span> {result.failingRules.length} blocking rule
                {result.failingRules.length === 1 ? '' : 's'} fail at this transfer point
              </strong>
              <ul className="transfer-plain-list">
                {result.failingRules.map((entry) => (
                  <li key={entry.rule.id}>
                    <strong>{entry.rule.title}.</strong> {entry.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.eligibility === 'blocked' && earliestEligible ? (
            <p className="transfer-note transfer-earliest">
              <strong>Earliest transfer point with no machine-checkable blocking failure:</strong>{' '}
              {earliestEligible.label}.
            </p>
          ) : null}

          <dl className="transfer-process-summary" aria-label="Application timing and testing">
            <div>
              <dt>Entry terms</dt>
              <dd>{result.program.eligibility.entryTerms.map(titleCase).join(', ')}</dd>
            </div>
            <div className="transfer-process-deadlines">
              <dt>Deadlines</dt>
              <dd>
                <ul>
                  {result.program.eligibility.deadlines.map((deadline) => (
                    <li key={deadline}>{deadline}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Transfer testing</dt>
              <dd>{TESTING_LABEL[result.program.eligibility.testing]}</dd>
            </div>
          </dl>

          <div className={`callout ${result.institution.examCreditPolicy?.coursework === 'not_accepted' ? 'warn' : 'info'} transfer-exam-policy`}>
            <strong>AP / IB treatment</strong>
            {result.institution.examCreditPolicy?.detail ??
              'This destination must apply its own exam-credit table. UCI exam equivalencies are shown as manual-review items, not automatic matches.'}
          </div>

          {result.program.cautions?.length ? (
            <div className="callout info">
              <strong>Worth knowing</strong>
              <ul className="transfer-plain-list">
                {result.program.cautions.map((caution) => (
                  <li key={caution}>{caution}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.program.sharedAdmissionWith?.length ? (
            <p className="transfer-note">
              Shares one admission decision with {result.program.sharedAdmissionWith.length} other program
              {result.program.sharedAdmissionWith.length === 1 ? '' : 's'} on your list — applying to both is
              the same decision, not two chances.
            </p>
          ) : null}

          <RequirementList checks={result.requirementChecks} />

          {result.suggestedCodes.length > 0 ? (
            <SuggestedCourses codes={result.suggestedCodes} terms={terms} defaultTermId={lastTermId} />
          ) : null}

          <EligibilityList results={result.eligibilityResults} />

          <p className="transfer-sources">
            Sources:{' '}
            {[...new Set([
              ...result.program.sourceUrls,
              ...result.institution.institutionSourceUrls,
              ...(result.institution.examCreditPolicy?.sourceUrls ?? []),
            ])].map((url, index) => (
              <span key={url}>
                {index > 0 ? ' · ' : ''}
                <a href={url} target="_blank" rel="noreferrer noopener">
                  {shortenUrl(url)}
                </a>
              </span>
            ))}
            {' · '}retrieved {result.program.retrievedAt}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function RequirementList({ checks }: { checks: RequirementCheck[] }) {
  if (checks.length === 0) {
    return (
      <p className="transfer-note">
        This school publishes no course requirements for transfer applicants into this program. Readiness here
        rests on your grades, the rigor of your UCI curriculum, and the eligibility rules below.
      </p>
    );
  }

  const groups: Array<[string, RequirementCheck[]]> = [
    ['Required', checks.filter((c) => c.requirement.necessity === 'required')],
    ['Recommended', checks.filter((c) => c.requirement.necessity === 'recommended')],
    ['Competitive edge', checks.filter((c) => c.requirement.necessity === 'competitive')],
  ];

  return (
    <>
      {groups.map(([label, list]) =>
        list.length === 0 ? null : (
          <section key={label} className="transfer-req-group">
            <h4>{label}</h4>
            <ul className="transfer-requirements">
              {list.map((check) => {
                const presentation = requirementPresentation(check.state);
                return (
                  <li key={check.requirement.id} className="transfer-requirement" data-state={check.applicable ? check.state : 'not-applicable'}>
                    <span className={`badge ${presentation.tone}`}>
                      <span className="status-icon" aria-hidden="true">{presentation.icon}</span>
                      <span className="visually-hidden">{presentation.label}</span>
                    </span>
                    <span className="transfer-requirement-body">
                      <span className="transfer-requirement-title">
                        {check.requirement.title}
                        {!check.applicable ? <span className="badge neutral">Not applicable</span> : null}
                        {check.requirement.targetCourses?.length ? (
                          <span className="code transfer-target-code">
                            {check.requirement.targetCourses.join(' / ')}
                          </span>
                        ) : null}
                      </span>
                      <span className="transfer-requirement-detail">{check.detail}</span>
                      {check.requirement.note ? (
                        <span className="transfer-requirement-note">{check.requirement.note}</span>
                      ) : null}
                      <span className="transfer-requirement-meta">
                        {NECESSITY_LABEL[check.requirement.necessity]}
                        {check.requirement.minGrade ? ` · minimum ${check.requirement.minGrade}` : ''}
                        {' · '}
                        {CONFIDENCE_LABEL[check.requirement.confidence]}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ),
      )}
    </>
  );
}

function SuggestedCourses({ codes, terms, defaultTermId }: { codes: string[]; terms: Term[]; defaultTermId: string }) {
  const setExplorerFilterCodes = useStore((s) => s.setExplorerFilterCodes);
  const openDetail = useStore((s) => s.openDetail);
  const addCourse = useStore((s) => s.addCourse);
  const scenario = useStore((s) => {
    const plan = s.plan;
    return plan?.scenarios.find((entry) => entry.id === plan.activeScenarioId) ?? null;
  });
  const [termId, setTermId] = useState(defaultTermId);
  useEffect(() => setTermId(defaultTermId), [defaultTermId]);
  return (
    <div className="transfer-suggested">
      <div className="transfer-add-term">
        <strong>Closes the remaining required gaps</strong>
        <label>
          <span>Add to term</span>
          <select value={termId} onChange={(event) => setTermId(event.target.value)}>
            {terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
        </label>
      </div>
      <ul className="transfer-suggested-list">
      {codes.map((code) => (
        <li key={code}>
          <button
            type="button"
            className="subtle"
            disabled={scenario?.plannedCourses.some((placement) => placement.code === code)}
            onClick={() => addCourse(code, termId)}
          >
            {scenario?.plannedCourses.some((placement) => placement.code === code) ? 'Already planned' : `Add ${code}`}
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setExplorerFilterCodes([code]);
              openDetail(code);
            }}
          >
            View <span className="code">{code}</span>
          </button>
        </li>
      ))}
      </ul>
    </div>
  );
}

function EligibilityList({ results }: { results: EligibilityCheckResult[] }) {
  const checked = results.filter((entry) => entry.status !== 'informational');
  const informational = results.filter((entry) => entry.status === 'informational');

  return (
    <section className="transfer-req-group">
      <h4>Eligibility and process</h4>
      {checked.length > 0 ? (
        <ul className="transfer-requirements">
          {checked.map((entry) => {
            const tone =
              entry.status === 'met' ? 'ok' : entry.status === 'not_met'
                ? entry.rule.severity === 'blocking' ? 'error' : 'warn'
                : 'unknown';
            const icon = entry.status === 'met' ? '✓' : entry.status === 'not_met' ? '✗' : '?';
            return (
              <li key={entry.rule.id} className="transfer-requirement" data-status={entry.status}>
                <span className={`badge ${tone}`}>
                  <span className="status-icon" aria-hidden="true">{icon}</span>
                  <span className="visually-hidden">{entry.status.replace('_', ' ')}</span>
                </span>
                <span className="transfer-requirement-body">
                  <span className="transfer-requirement-title">{entry.rule.title}</span>
                  <span className="transfer-requirement-detail">{entry.detail}</span>
                  <span className="transfer-requirement-meta">
                    {entry.rule.severity === 'blocking' ? 'Blocking rule' : 'Advisory'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {informational.length > 0 ? (
        <details className="transfer-rules-more">
          <summary>{informational.length} more published rules</summary>
          <ul className="transfer-plain-list">
            {informational.map((entry) => (
              <li key={entry.rule.id}>
                <strong>{entry.rule.title}.</strong> {entry.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
