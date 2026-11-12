import { useState } from 'react';
import { useStore, useAudit } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import type { MathProgram } from '../../domain/plan/types';

/**
 * Scenario selector and management.
 *
 * The seeded comparison is Pure Mathematics versus Applied and Computational
 * Mathematics with Computer Science fixed in both (06 — Scenarios).
 */

const MATH_LABEL: Record<MathProgram, string> = {
  pure_math: 'Pure Mathematics',
  applied_math: 'Applied and Computational Mathematics',
  none: 'Computer Science only',
};

export function ScenarioBar() {
  const plan = useStore((s) => s.plan);
  const switchScenario = useStore((s) => s.switchScenario);
  const [manageOpen, setManageOpen] = useState(false);

  if (!plan) return null;

  return (
    <>
      <label htmlFor="scenario-select" className="visually-hidden">
        Active scenario
      </label>
      <select
        id="scenario-select"
        value={plan.activeScenarioId}
        onChange={(e) => switchScenario(e.target.value)}
        title="Active scenario"
      >
        {plan.scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {MATH_LABEL[s.mathProgram]}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => setManageOpen(true)}>
        Scenarios
      </button>

      {manageOpen ? <ScenarioManager onClose={() => setManageOpen(false)} /> : null}
    </>
  );
}

function ScenarioManager({ onClose }: { onClose: () => void }) {
  const plan = useStore((s) => s.plan);
  const audit = useAudit();
  const duplicateScenario = useStore((s) => s.duplicateScenario);
  const createComparisonScenario = useStore((s) => s.createComparisonScenario);
  const renameScenario = useStore((s) => s.renameScenario);
  const deleteScenario = useStore((s) => s.deleteScenario);
  const switchScenario = useStore((s) => s.switchScenario);
  const setMathProgram = useStore((s) => s.setMathProgram);

  if (!plan) return null;
  const active = plan.scenarios.find((s) => s.id === plan.activeScenarioId);

  return (
    <Dialog open onClose={onClose} title="Scenarios" footer={<button type="button" onClick={onClose}>Done</button>}>
      <section>
        <h3>Compare paths</h3>
        <div className="callout info">
          <strong>Mathematics, B.S. and Applied and Computational Mathematics, B.S. are mutually exclusive.</strong>
          UCI does not permit both. Compare them as separate scenarios with Computer Science fixed in each.
        </div>
        <button type="button" className="primary" onClick={createComparisonScenario}>
          {active?.mathProgram === 'none'
            ? 'Create a comparison scenario that adds Pure Mathematics'
            : 'Create the opposite-Mathematics comparison scenario'}
        </button>
      </section>

      <section>
        <h3>Active scenario</h3>
        {active ? (
          <>
            <label htmlFor="scenario-name">Name</label>
            <input
              id="scenario-name"
              type="text"
              value={active.name}
              onChange={(e) => renameScenario(active.id, e.target.value)}
            />
            <div style={{ marginTop: 8 }}>
              <label htmlFor="scenario-math">Mathematics program audited in this scenario</label>
              <select
                id="scenario-math"
                value={active.mathProgram}
                onChange={(e) => setMathProgram(e.target.value as MathProgram)}
              >
                <option value="none">None — Computer Science only</option>
                <option value="pure_math">Mathematics, B.S. — Pure Mathematics</option>
                <option value="applied_math">Applied and Computational Mathematics, B.S.</option>
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Switching replaces the Mathematics audit in this scenario rather than adding a third major.
              </p>
            </div>
          </>
        ) : null}
      </section>

      <section>
        <h3>All scenarios ({plan.scenarios.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {plan.scenarios.map((scenario) => {
            const isActive = scenario.id === plan.activeScenarioId;
            return (
              <li key={scenario.id} className="course-card">
                <div className="row">
                  <span className="title">
                    {scenario.name}
                    {scenario.isPrimary ? <span className="badge shared" style={{ marginLeft: 6 }}>Primary</span> : null}
                    {isActive ? <span className="badge info" style={{ marginLeft: 6 }}>Active</span> : null}
                  </span>
                </div>
                <div className="badges">
                  <span className="badge neutral">{MATH_LABEL[scenario.mathProgram]}</span>
                  <span className="badge neutral">{scenario.plannedCourses.length} courses</span>
                  <span className="badge neutral">{scenario.externalExams.length} exams</span>
                  {isActive && audit ? (
                    <span className="badge neutral">{audit.units.projected} projected units</span>
                  ) : null}
                </div>
                <div className="actions">
                  {!isActive ? (
                    <button type="button" onClick={() => switchScenario(scenario.id)}>Switch to this</button>
                  ) : null}
                  <button type="button" onClick={() => duplicateScenario(scenario.id)}>Duplicate</button>
                  {plan.scenarios.length > 1 ? (
                    <button type="button" className="danger" onClick={() => deleteScenario(scenario.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </Dialog>
  );
}
