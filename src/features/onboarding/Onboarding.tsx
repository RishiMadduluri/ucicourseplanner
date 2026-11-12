import { useState } from 'react';
import { useStore } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import { ApEntry } from '../external-credit/ApEntry';
import { UNOFFICIAL_NOTICE } from '../../domain/schemaVersions';
import type { MathProgram, Profile } from '../../domain/plan/types';

/**
 * Short setup flow.
 *
 * Preloads the profile defaults, lets the user choose Computer Science only or
 * CS plus a Mathematics second major, accepts AP and other external credit with previews, and
 * finishes with an *empty* plan — no invented personal schedule.
 */

const STEPS = ['Welcome', 'Programs', 'External credit', 'Workload', 'Finish'] as const;

export function Onboarding() {
  const plan = useStore((s) => s.plan);
  const updateProfile = useStore((s) => s.updateProfile);
  const setMathProgram = useStore((s) => s.setMathProgram);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const createComparisonScenario = useStore((s) => s.createComparisonScenario);

  const [step, setStep] = useState(0);
  const [seedComparison, setSeedComparison] = useState(true);

  if (!plan) return null;
  const profile = plan.profile;

  function finish() {
    // A comparison scenario only makes sense when a Mathematics path is chosen.
    if (seedComparison && profile.mathProgram !== 'none') createComparisonScenario();
    completeOnboarding();
  }

  return (
    <Dialog
      open
      onClose={completeOnboarding}
      title={`Set up your plan — ${STEPS[step]} (${step + 1} of ${STEPS.length})`}
      footer={
        <>
          <button type="button" onClick={completeOnboarding}>Skip setup</button>
          <span style={{ flex: 1 }} />
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="primary" onClick={finish}>
              Start planning
            </button>
          )}
        </>
      }
    >
      {step === 0 ? <WelcomeStep /> : null}
      {step === 1 ? (
        <ProgramsStep profile={profile} onMathProgram={setMathProgram} onProfile={updateProfile} />
      ) : null}
      {step === 2 ? <ApEntry /> : null}
      {step === 3 ? <WorkloadStep profile={profile} onProfile={updateProfile} /> : null}
      {step === 4 ? (
        <FinishStep
          seedComparison={seedComparison}
          onSeedComparison={setSeedComparison}
          mathProgram={profile.mathProgram}
        />
      ) : null}
    </Dialog>
  );
}

function WelcomeStep() {
  return (
    <section>
      <h3>Welcome to ZotPath</h3>
      <p>
        ZotPath plans Incoming Summer 2026 through your graduation target against the{' '}
        <strong>2026–27 UCI Catalogue</strong>, auditing Computer Science, B.S. — on its own or with an optional
        Mathematics second major.
      </p>
      <div className="callout warn">
        <strong>Unofficial planning aid</strong>
        {UNOFFICIAL_NOTICE}
      </div>
      <p>Setup takes about a minute. You can change everything later in Settings.</p>
      <ul>
        <li>Choose Computer Science only, or add a Mathematics second major.</li>
        <li>Enter AP exams and scores — every official effect is previewed before saving.</li>
        <li>Choose your workload preferences and graduation target.</li>
      </ul>
      <p style={{ color: 'var(--text-muted)' }}>
        Your plan starts empty. Nothing is scheduled on your behalf, and no AP score is assumed.
      </p>
    </section>
  );
}

function ProgramsStep({
  profile,
  onMathProgram,
  onProfile,
}: {
  profile: Profile;
  onMathProgram: (p: MathProgram) => void;
  onProfile: (patch: Partial<Profile>) => void;
}) {
  return (
    <>
      <section>
        <h3>Programs</h3>
        <p>
          Admitted major: <strong>Computer Science, B.S.</strong> (2026–27 catalogue)
        </p>

        <fieldset>
          <legend>Second major (optional)</legend>

          {(
            [
              { value: 'none', label: 'None — Computer Science only (default)' },
              { value: 'pure_math', label: 'Mathematics, B.S. — Pure Mathematics' },
              { value: 'applied_math', label: 'Applied and Computational Mathematics, B.S.' },
            ] as Array<{ value: MathProgram; label: string }>
          ).map((option) => (
            <div className="filter-row" key={option.value}>
              <input
                id={`math-${option.value}`}
                type="radio"
                name="math-program"
                checked={profile.mathProgram === option.value}
                onChange={() => onMathProgram(option.value)}
              />
              <label htmlFor={`math-${option.value}`}>{option.label}</label>
            </div>
          ))}

          {profile.mathProgram !== 'none' ? (
            <div className="callout info" style={{ marginTop: 8 }}>
              <strong>The two Mathematics majors are mutually exclusive.</strong>
              UCI prohibits double majoring in Mathematics, B.S. and Applied and Computational Mathematics, B.S.
              Selecting one replaces the other in this scenario — you can compare them side by side using a
              second scenario.
            </div>
          ) : null}
        </fieldset>
      </section>

      <section>
        <h3>University requirements already satisfied?</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          ELWR and American History and Institutions are often satisfied before entrance. ZotPath stores your
          evidence rather than guessing from planned coursework.
        </p>

        <div className="filter-grid">
          <div>
            <label htmlFor="elwr-status">Entry Level Writing (ELWR)</label>
            <select
              id="elwr-status"
              value={profile.elwrStatus}
              onChange={(e) => onProfile({ elwrStatus: e.target.value as Profile['elwrStatus'] })}
            >
              <option value="unknown_needs_input">Not sure yet</option>
              <option value="satisfied">Satisfied</option>
              <option value="not_satisfied">Not satisfied</option>
              <option value="in_progress">In progress</option>
              <option value="waived_or_external_evidence">Waived / external evidence</option>
            </select>
          </div>
          <div>
            <label htmlFor="ahi-status">American History and Institutions</label>
            <select
              id="ahi-status"
              value={profile.americanHistoryStatus}
              onChange={(e) =>
                onProfile({ americanHistoryStatus: e.target.value as Profile['americanHistoryStatus'] })
              }
            >
              <option value="unknown_needs_input">Not sure yet</option>
              <option value="satisfied">Satisfied</option>
              <option value="not_satisfied">Not satisfied</option>
            </select>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>
          A qualifying AP award entered in the next step sets these automatically.
        </p>
      </section>
    </>
  );
}

function WorkloadStep({ profile, onProfile }: { profile: Profile; onProfile: (patch: Partial<Profile>) => void }) {
  const workload = profile.workload;

  return (
    <>
      <section>
        <h3>Course load</h3>
        <div className="callout info">
          <strong>12–20 units is the official range for a regular quarter.</strong>
          Anything outside it needs authorization from your dean. Your personal target below only changes when
          ZotPath adds a soft note — it never marks a legal load as invalid.
        </div>

        <div className="filter-grid">
          <div>
            <label htmlFor="target-units">Personal target units per quarter</label>
            <input
              id="target-units"
              type="number"
              min={12}
              max={20}
              value={workload.regularWarnAboveUnits}
              onChange={(e) =>
                onProfile({
                  workload: {
                    ...workload,
                    regularWarnAboveUnits: Number(e.target.value),
                    regularTargetUnits: Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <label htmlFor="intensity">Planning intensity</label>
            <select
              id="intensity"
              value={workload.intensity}
              onChange={(e) =>
                onProfile({ workload: { ...workload, intensity: e.target.value as typeof workload.intensity } })
              }
            >
              <option value="balanced">Balanced — about 16 units, use Summer to relieve bottlenecks</option>
              <option value="adaptive">Adaptive — target 16, use up to 20 when useful (recommended)</option>
              <option value="aggressive">Aggressive — routinely up to 20</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3>Summer</h3>
        <div className="filter-row">
          <input
            id="summers-enabled"
            type="checkbox"
            checked={workload.summersEnabled}
            onChange={(e) => onProfile({ workload: { ...workload, summersEnabled: e.target.checked } })}
          />
          <label htmlFor="summers-enabled">Include Summer terms in my plan</label>
        </div>

        <div style={{ marginTop: 6 }}>
          <label htmlFor="summer-style">Summer intensity</label>
          <select
            id="summer-style"
            value={workload.summerStyle}
            onChange={(e) =>
              onProfile({ workload: { ...workload, summerStyle: e.target.value as typeof workload.summerStyle } })
            }
          >
            <option value="one_course">One course at a time</option>
            <option value="up_to_two">Up to two when sessions and workload fit (recommended)</option>
            <option value="maximum">Use the maximum normal load when it accelerates graduation</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 6 }}>
          Summer allows 20 units total and normally 12 per session. A 10-week course counts half in each
          session. More than 32 total Summer units is never valid.
        </p>
      </section>

      <section>
        <h3>Graduation target</h3>
        <label htmlFor="grad-term">Final term</label>
        <select
          id="grad-term"
          value={profile.graduationTermId}
          onChange={(e) => onProfile({ graduationTermId: e.target.value })}
        >
          <option value="2029-spring">Spring 2029 (accelerated)</option>
          <option value="2030-winter">Winter 2030</option>
          <option value="2030-spring">Spring 2030 (default)</option>
          <option value="2030-summer-session_2">Summer 2030 (adds a final Summer)</option>
        </select>
      </section>
    </>
  );
}

function FinishStep({
  seedComparison,
  onSeedComparison,
  mathProgram,
}: {
  seedComparison: boolean;
  onSeedComparison: (v: boolean) => void;
  mathProgram: MathProgram;
}) {
  const other =
    mathProgram === 'pure_math' ? 'Applied and Computational Mathematics' : 'Pure Mathematics';

  return (
    <section>
      <h3>Ready to plan</h3>
      <p>Your board starts at Incoming Summer 2026 and runs to your graduation target.</p>

      {mathProgram !== 'none' ? (
        <div className="filter-row">
          <input
            id="seed-comparison"
            type="checkbox"
            checked={seedComparison}
            onChange={(e) => onSeedComparison(e.target.checked)}
          />
          <label htmlFor="seed-comparison">
            Also create a comparison scenario using <strong>{other}</strong>, with Computer Science fixed
          </label>
        </div>
      ) : null}

      <div className="callout info">
        <strong>What happens next</strong>
        Search any UCI course in the left rail, add it to a term, and the Degree Audit on the right
        recalculates immediately. Warnings explain what is missing rather than blocking you.
      </div>

      <div className="callout warn">
        <strong>Always verify with an adviser</strong>
        {UNOFFICIAL_NOTICE}
      </div>
    </section>
  );
}
