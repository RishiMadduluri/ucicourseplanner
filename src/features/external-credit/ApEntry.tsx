import { useMemo, useState } from 'react';
import { useStore, useActiveScenario } from '../../app/store';
import { listApExams } from '../../domain/externalCredit/apAwards';
import { previewAward, resolveExternalCredit } from '../../domain/externalCredit/resolve';
import type { ExternalExam, ManualCredit } from '../../domain/plan/types';
import { normalizeCourseCode } from '../../domain/courses/codes';
import type { Grade } from '../../domain/courses/types';

/**
 * AP exam entry with a full effect preview before saving (criterion 58), plus
 * IB / transfer / manual credit that needs no invented UCI term.
 */

export function ApEntry() {
  const scenario = useActiveScenario();
  const addExam = useStore((s) => s.addExam);
  const removeExam = useStore((s) => s.removeExam);
  const addManualCredit = useStore((s) => s.addManualCredit);
  const removeManualCredit = useStore((s) => s.removeManualCredit);

  const exams = useMemo(() => listApExams(), []);
  const [examKey, setExamKey] = useState(exams[0]?.examKey ?? '');
  const [score, setScore] = useState('5');
  const [examYear, setExamYear] = useState('');

  const selectedExam = exams.find((e) => e.examKey === examKey);
  const preview = useMemo(
    () => (examKey ? previewAward(examKey, Number.parseInt(score, 10)) : []),
    [examKey, score],
  );

  const resolved = useMemo(
    () => (scenario ? resolveExternalCredit(scenario.externalExams, scenario.manualCredits) : null),
    [scenario],
  );

  if (!scenario) return null;

  function handleAdd() {
    if (!selectedExam) return;
    const exam: ExternalExam = {
      id: `exam-${Date.now().toString(36)}`,
      system: 'ap',
      examKey: selectedExam.examKey,
      examName: selectedExam.examName,
      score,
      manuallyVerified: false,
    };
    const year = Number.parseInt(examYear, 10);
    if (Number.isFinite(year)) exam.examYear = year;
    addExam(exam);
    setExamYear('');
  }

  return (
    <>
      <section>
        <h3>Add an AP exam</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Entry is exam-and-score driven. Every official 2026–27 effect is previewed below before you save.
          Exam credit never receives a letter grade.
        </p>

        <div className="filter-grid">
          <div>
            <label htmlFor="ap-exam">Exam</label>
            <select id="ap-exam" value={examKey} onChange={(e) => setExamKey(e.target.value)}>
              {exams.map((e) => (
                <option key={e.examKey} value={e.examKey}>{e.examName}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ap-score">Score</label>
            <select id="ap-score" value={score} onChange={(e) => setScore(e.target.value)}>
              {['1', '2', '3', '4', '5'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ap-year">Exam year (optional)</label>
            <input
              id="ap-year"
              type="number"
              min={2015}
              max={2030}
              value={examYear}
              placeholder="2026"
              onChange={(e) => setExamYear(e.target.value)}
            />
          </div>
        </div>

        <div className="callout info" style={{ marginTop: 8 }} role="status" aria-live="polite">
          <strong>Preview — {selectedExam?.examName} score {score}</strong>
          <ul style={{ marginTop: 4 }}>
            {preview.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <button type="button" className="primary" onClick={handleAdd} style={{ marginTop: 6 }}>
          Save this exam
        </button>
      </section>

      <section>
        <h3>Recorded exams ({scenario.externalExams.length})</h3>
        {scenario.externalExams.length === 0 ? (
          <p className="empty-state">No exams entered yet. Nothing is assumed on your behalf.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {scenario.externalExams.map((exam) => {
              const award = resolved?.awards.find((a) => a.examId === exam.id);
              return (
                <li key={exam.id} className="course-card">
                  <div className="row">
                    <span className="title">
                      {exam.examName} — score {exam.score}
                      {exam.examYear ? ` (${exam.examYear})` : ''}
                    </span>
                    <button type="button" className="subtle icon" onClick={() => removeExam(exam.id)} aria-label={`Remove ${exam.examName}`}>
                      ✕
                    </button>
                  </div>
                  {award?.status === 'unknown_needs_verification' ? (
                    <div className="callout unknown" style={{ marginTop: 6, marginBottom: 0 }}>
                      <strong>Needs verification</strong>
                      No 2026–27 rule matches this exam and score.
                    </div>
                  ) : award ? (
                    <div className="badges">
                      <span className="badge neutral">{award.unitsAwarded} units</span>
                      {award.electiveOnly ? <span className="badge warn">Elective only</span> : null}
                      {award.equivalence ? (
                        <span className="badge ok">
                          {award.equivalence.grantedCourseCodes.join(' + ')}
                        </span>
                      ) : null}
                      {award.geEffects.map((g, i) => (
                        <span key={i} className="badge info">GE {g.category}</span>
                      ))}
                      {award.universityRequirementEffects.map((k) => (
                        <span key={k} className="badge ok">{k === 'elwr' ? 'ELWR' : 'Am. History'}</span>
                      ))}
                      {award.capNote ? <span className="badge warn" title={award.capNote}>Unit cap applied</span> : null}
                    </div>
                  ) : null}
                  {award?.capNote ? (
                    <p style={{ fontSize: 11.5, color: 'var(--warn)', marginTop: 4 }}>{award.capNote}</p>
                  ) : null}
                  {award?.programUseLimitation ? (
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {award.programUseLimitation}
                    </p>
                  ) : null}
                  {award?.placementNote ? (
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{award.placementNote}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {resolved && resolved.combinationNotes.length > 0 ? (
          <div className="callout info">
            <strong>Combination rule applied</strong>
            {resolved.combinationNotes.join(' ')}
          </div>
        ) : null}

        {resolved && resolved.duplicateBarredCourseCodes.size > 0 ? (
          <div className="callout warn">
            <strong>Duplicate-credit bars</strong>
            You may no longer earn units or grade points in:{' '}
            {Array.from(resolved.duplicateBarredCourseCodes).join(', ')}.
          </div>
        ) : null}
      </section>

      <ManualCreditEntry
        credits={scenario.manualCredits}
        onAdd={addManualCredit}
        onRemove={removeManualCredit}
      />
    </>
  );
}

function ManualCreditEntry({
  credits,
  onAdd,
  onRemove,
}: {
  credits: ManualCredit[];
  onAdd: (credit: ManualCredit) => void;
  onRemove: (id: string) => void;
}) {
  const [institution, setInstitution] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [units, setUnits] = useState('4');
  const [unitSystem, setUnitSystem] = useState<'quarter' | 'semester'>('quarter');
  const [equivalents, setEquivalents] = useState('');
  const [source, setSource] = useState<ManualCredit['source']>('transfer');
  const [grade, setGrade] = useState<Grade | ''>('');
  const [verifiedBy, setVerifiedBy] = useState('');

  return (
    <section>
      <h3>IB, transfer, and dual-enrollment credit</h3>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
        External credit is recorded without inventing a UCI term. An equivalency without adviser evidence stays
        marked as needing verification.
      </p>

      <div className="filter-grid">
        <div>
          <label htmlFor="mc-institution">Institution or exam system</label>
          <input id="mc-institution" type="text" value={institution} onChange={(e) => setInstitution(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mc-title">Course or exam title</label>
          <input id="mc-title" type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mc-units">Units</label>
          <input id="mc-units" type="number" min={0} max={20} value={units} onChange={(e) => setUnits(e.target.value)} />
        </div>
        <div>
          <label htmlFor="mc-unit-system">Unit calendar</label>
          <select id="mc-unit-system" value={unitSystem} onChange={(e) => setUnitSystem(e.target.value as 'quarter' | 'semester')}>
            <option value="quarter">Quarter units</option>
            <option value="semester">Semester units</option>
          </select>
        </div>
        <div>
          <label htmlFor="mc-source">Source</label>
          <select id="mc-source" value={source} onChange={(e) => setSource(e.target.value as ManualCredit['source'])}>
            <option value="transfer">Transfer</option>
            <option value="dual_enrollment">Dual enrollment</option>
            <option value="ib">IB</option>
            <option value="manual">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="mc-grade">Grade (optional)</label>
          <select id="mc-grade" value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')}>
            <option value="">Not recorded</option>
            {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'P', 'NP', 'S', 'U'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <label htmlFor="mc-equivalents">UCI equivalents (comma separated, optional)</label>
        <input
          id="mc-equivalents"
          type="text"
          placeholder="e.g. MATH 2A, WRITING 50"
          value={equivalents}
          onChange={(e) => setEquivalents(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 6 }}>
        <label htmlFor="mc-verified-by">Equivalency verified by (optional)</label>
        <input
          id="mc-verified-by"
          type="text"
          placeholder="e.g. UCI transfer-credit evaluator"
          value={verifiedBy}
          onChange={(e) => setVerifiedBy(e.target.value)}
        />
        <p className="field-help">
          Name the adviser, evaluator, or official report that confirmed the UCI course mapping.
          Leave blank when the mapping is only your estimate.
        </p>
      </div>

      <button
        type="button"
        style={{ marginTop: 6 }}
        disabled={!institution.trim() || !courseTitle.trim()}
        onClick={() => {
          onAdd({
            id: `mc-${Date.now().toString(36)}`,
            institution: institution.trim(),
            courseTitle: courseTitle.trim(),
            units: Number(units) || 0,
            unitSystem,
            equivalentCourseCodes: equivalents
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map(normalizeCourseCode),
            source,
            ...(grade ? { grade } : {}),
            ...(verifiedBy.trim() ? { verifiedBy: verifiedBy.trim() } : {}),
          });
          setInstitution('');
          setCourseTitle('');
          setEquivalents('');
          setGrade('');
          setVerifiedBy('');
        }}
      >
        Add external credit
      </button>

      {credits.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
          {credits.map((credit) => (
            <li key={credit.id} className="course-card">
              <div className="row">
                <span className="title">
                  {credit.institution} — {credit.courseTitle}
                </span>
                <button type="button" className="subtle icon" onClick={() => onRemove(credit.id)} aria-label={`Remove ${credit.courseTitle}`}>
                  ✕
                </button>
              </div>
              <div className="badges">
                <span className="badge neutral">{credit.units} {credit.unitSystem ?? 'quarter'} units</span>
                <span className="badge neutral">{credit.source}</span>
                {credit.grade ? <span className="badge neutral">Grade {credit.grade}</span> : null}
                {credit.equivalentCourseCodes.map((c) => (
                  <span key={c} className="badge ok">{c}</span>
                ))}
                {credit.verifiedBy ? (
                  <span className="badge ok">Verified: {credit.verifiedBy}</span>
                ) : (
                  <span className="badge unknown">
                    <span aria-hidden="true">?</span> Needs adviser verification
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
