import { useMemo } from 'react';
import { useStore, useActiveScenario } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import { OfferingBadge, PrerequisiteBadge } from '../../components/StatusBadge';
import type { NodeExplanation } from '../../domain/prerequisites/evaluate';
import { assessEligibility } from '../../domain/prerequisites/evaluate';
import { assessOffering } from '../../domain/offerings/assess';
import { OFFERING_INDEX } from '../../data/offerings2026';
import { resolveExternalCredit } from '../../domain/externalCredit/resolve';
import { academicYearForTerm, calendarYearOfTermId, type Term } from '../../domain/terms/terms';
import type { CourseRecord } from '../../domain/prerequisites/evaluate';

/**
 * Course details drawer.
 *
 * Shows the parsed prerequisite tree *and* the original catalogue text, keeps
 * restrictions in their own section, and links to the official source
 * (05 — Course details; criteria 7 and 8).
 */

export function CourseDetailDrawer({ terms, selectedTermId }: { terms: Term[]; selectedTermId: string }) {
  const detailCode = useStore((s) => s.detailCode);
  const openDetail = useStore((s) => s.openDetail);
  const catalogue = useStore((s) => s.catalogue);
  const addCourse = useStore((s) => s.addCourse);
  const scenario = useActiveScenario();

  const course = detailCode ? catalogue?.index.get(detailCode) : undefined;

  const external = useMemo(
    () => (scenario ? resolveExternalCredit(scenario.externalExams, scenario.manualCredits) : null),
    [scenario],
  );

  const eligibility = useMemo(() => {
    if (!course || !scenario || !external) return null;
    const records: CourseRecord[] = scenario.plannedCourses.map((p) => {
      const r: CourseRecord = { code: p.code, status: p.status };
      if (p.termId) r.termId = p.termId;
      if (p.grade) r.grade = p.grade;
      return r;
    });
    for (const code of external.equivalentCourseCodes) records.push({ code, status: 'completed', external: true });
    for (const code of external.electiveOnlyCourseCodes) {
      records.push({ code, status: 'completed', external: true, electiveOnly: true });
    }

    return assessEligibility(
      {
        ...(course.prerequisiteExpr ? { prerequisiteExpr: course.prerequisiteExpr } : {}),
        ...(course.corequisiteExpr ? { corequisiteExpr: course.corequisiteExpr } : {}),
      },
      { records, targetTermId: selectedTermId, satisfiedEvidenceKeys: external.prerequisiteEvidenceKeys },
    );
  }, [course, scenario, external, selectedTermId]);

  const offering = useMemo(() => {
    if (!course) return null;
    const year = calendarYearOfTermId(selectedTermId);
    const season = /-(fall|winter|spring|summer)/.exec(selectedTermId)?.[1];
    if (year === null || !season) return null;
    return assessOffering({
      record: OFFERING_INDEX.get(course.normalizedCode),
      termId: selectedTermId,
      academicYear: academicYearForTerm(year, season as 'fall'),
    });
  }, [course, selectedTermId]);

  if (!course) return null;

  const selectedTerm = terms.find((t) => t.id === selectedTermId);
  const offeringRecord = OFFERING_INDEX.get(course.normalizedCode);

  return (
    <Dialog
      open
      onClose={() => openDetail(null)}
      title={`${course.code} — ${course.title}`}
      variant="drawer"
      footer={
        <>
          <button type="button" onClick={() => openDetail(null)}>Close</button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              addCourse(course.normalizedCode, selectedTermId);
              openDetail(null);
            }}
          >
            Add to {selectedTerm?.label ?? 'term'}
          </button>
        </>
      }
    >
      <section>
        <h3>Summary</h3>
        <p>
          <strong className="code">{course.code}</strong> · {course.department} ·{' '}
          {course.units.variable
            ? `${course.units.min}–${course.units.max} units (choose a value when planning)`
            : `${course.units.max} units`}{' '}
          · {course.level} division
        </p>
        <p>{course.description || <em>No description in the catalogue.</em>}</p>
        <p>
          <a href={course.sourceUrl} target="_blank" rel="noreferrer noopener">
            Official {course.catalogueYear} Catalogue record ↗
          </a>{' '}
          <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>
            Retrieved {new Date(course.retrievedAt).toLocaleDateString()}
          </span>
        </p>
        {course.aliases.length > 1 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Also searchable as: {course.aliases.filter((a) => a !== course.normalizedCode).join(', ')}
          </p>
        ) : null}
        {course.parserConfidence < 1 ? (
          <div className="callout unknown">
            <strong>Needs manual review</strong>
            Some rules for this course could not be fully parsed (confidence{' '}
            {(course.parserConfidence * 100).toFixed(0)}%). The original catalogue text below is authoritative.
          </div>
        ) : null}
      </section>

      <section>
        <h3>Prerequisites</h3>
        {course.prerequisiteExpr ? (
          <>
            <p>
              <PrerequisiteBadge
                status={eligibility?.prerequisite.status ?? 'unknown'}
                conditional={eligibility?.prerequisite.conditional ?? false}
              />{' '}
              evaluated as of <strong>{selectedTerm?.label ?? selectedTermId}</strong>, using the plan as it
              exists <em>before</em> that term.
            </p>
            {eligibility?.prerequisite.explanation ? (
              <ExplanationTree node={eligibility.prerequisite.explanation} />
            ) : null}
          </>
        ) : (
          <p>No prerequisites listed.</p>
        )}
        {course.prerequisiteRaw ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Original catalogue text:</p>
            <div className="raw-text">{course.prerequisiteRaw}</div>
          </>
        ) : null}
        {course.recommendedRaw ? (
          <div className="callout info" style={{ marginTop: 8 }}>
            <strong>Recommended (not required)</strong>
            {course.recommendedRaw}
          </div>
        ) : null}
      </section>

      {course.corequisiteRaw || course.concurrentRaw ? (
        <section>
          <h3>Corequisites and concurrent enrollment</h3>
          {course.corequisiteRaw ? (
            <>
              <p>
                Corequisite —{' '}
                <PrerequisiteBadge status={eligibility?.corequisite.status ?? 'unknown'} />{' '}
                may be taken in the same term.
              </p>
              <div className="raw-text">{course.corequisiteRaw}</div>
            </>
          ) : null}
          {course.concurrentRaw ? (
            <>
              <p style={{ marginTop: 8 }}>
                <strong>Taught concurrently with</strong> {course.concurrentRaw} — a co-scheduled
                cross-listing, not a course you must also enroll in. You cannot earn credit for both.
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      <section>
        <h3>Enrollment restrictions</h3>
        {course.restrictions.length === 0 ? (
          <p>No enrollment restrictions listed.</p>
        ) : (
          <>
            <div className="callout warn">
              <strong>Restrictions are separate from prerequisites.</strong>
              You may have prerequisites satisfied and still be restricted from enrolling.
            </div>
            {course.restrictions.map((r, i) => (
              <div className="raw-text" key={i}>{r.raw}</div>
            ))}
          </>
        )}
      </section>

      <section>
        <h3>Offering evidence</h3>
        {offering ? (
          <>
            <p>
              <OfferingBadge state={offering.state} /> for {selectedTerm?.label ?? selectedTermId}
            </p>
            <p style={{ color: 'var(--text-muted)' }}>{offering.explanation}</p>
            {offering.suggestedTerms.length > 0 ? (
              <p style={{ fontSize: 12 }}>
                Stronger evidence exists for: {offering.suggestedTerms.join(', ')}.
              </p>
            ) : null}
          </>
        ) : (
          <p>No offering data for this term.</p>
        )}
        {offeringRecord ? (
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5 }}>
              All recorded evidence ({offeringRecord.evidence.length})
            </summary>
            <ul style={{ fontSize: 12.5, marginTop: 6 }}>
              {offeringRecord.evidence.map((e, i) => (
                <li key={i}>
                  {e.academicYear} {e.season}
                  {e.summerSession ? ` (${e.summerSession.replace('_', ' ')})` : ''} —{' '}
                  <strong>{e.offered ? 'listed' : 'not listed'}</strong> · {e.type.replace('_', ' ')} ·{' '}
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer noopener">{e.sourceLabel} ↗</a>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
            No department-plan or historical evidence has been imported for this course.
          </p>
        )}
      </section>

      {course.sameAs.length > 0 || course.overlapsWith.length > 0 || course.repeatability ? (
        <section>
          <h3>Same-as, overlap, and repeatability</h3>
          {course.sameAs.length > 0 ? <p>Same as: {course.sameAs.join(', ')}</p> : null}
          {course.overlapsWith.length > 0 ? <p>Overlaps with: {course.overlapsWith.join(', ')}</p> : null}
          {course.repeatability ? <p>Repeatability: {course.repeatability.raw}</p> : null}
        </section>
      ) : null}

      {course.gradingOptions.length > 0 ? (
        <section>
          <h3>Grading</h3>
          <p>{course.gradingOptions.join('; ')}</p>
        </section>
      ) : null}
    </Dialog>
  );
}

/** Render the structured prerequisite explanation as a nested list. */
function ExplanationTree({ node, depth = 0 }: { node: NodeExplanation; depth?: number }) {
  const icon = node.status === 'satisfied' ? '✓' : node.status === 'unsatisfied' ? '✗' : '?';
  const tone =
    node.status === 'satisfied'
      ? node.conditional
        ? 'var(--info)'
        : 'var(--ok)'
      : node.status === 'unsatisfied'
        ? 'var(--error)'
        : 'var(--unknown)';

  const content = (
    <>
      <span aria-hidden="true" style={{ color: tone, fontWeight: 700 }}>{icon}</span>{' '}
      <span className="visually-hidden">
        {node.status === 'satisfied' ? 'Satisfied: ' : node.status === 'unsatisfied' ? 'Not satisfied: ' : 'Unknown: '}
      </span>
      <span>{node.label}</span>
      {node.detail ? <span style={{ color: 'var(--text-muted)' }}> — {node.detail}</span> : null}
      {node.children && node.children.length > 0 ? (
        <ul>
          {node.children.map((child, i) => (
            <ExplanationTree key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </>
  );

  return depth === 0 ? (
    <ul className="expr-tree">
      <li>{content}</li>
    </ul>
  ) : (
    <li>{content}</li>
  );
}
