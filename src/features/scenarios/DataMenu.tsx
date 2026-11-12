import { useRef, useState } from 'react';
import { useStore } from '../../app/store';
import { Dialog } from '../../components/Dialog';
import { exportFilename, parseImport, serializePlan, type ImportResult } from '../../persistence/exportImport';
import { savePlan } from '../../persistence/db';
import { UNOFFICIAL_NOTICE } from '../../domain/schemaVersions';
import { ApEntry } from '../external-credit/ApEntry';
import type { Profile } from '../../domain/plan/types';

/** Export / import, data provenance, and settings. */

export function DataMenu() {
  const [open, setOpen] = useState<'none' | 'data' | 'settings' | 'credit'>('none');

  return (
    <>
      <button type="button" onClick={() => setOpen('credit')}>External credit</button>
      <button type="button" onClick={() => setOpen('settings')}>Settings</button>
      <button type="button" onClick={() => setOpen('data')}>Export / Import</button>

      {open === 'data' ? <DataDialog onClose={() => setOpen('none')} /> : null}
      {open === 'settings' ? <SettingsDialog onClose={() => setOpen('none')} /> : null}
      {open === 'credit' ? (
        <Dialog open onClose={() => setOpen('none')} title="External credit" footer={<button type="button" onClick={() => setOpen('none')}>Done</button>}>
          <ApEntry />
        </Dialog>
      ) : null}
    </>
  );
}

function DataDialog({ onClose }: { onClose: () => void }) {
  const plan = useStore((s) => s.plan);
  const catalogue = useStore((s) => s.catalogue);
  const setPlan = useStore((s) => s.setPlan);
  const pushToast = useStore((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  if (!plan) return null;

  function handleExport() {
    const blob = new Blob([serializePlan(plan!)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(plan!);
    link.click();
    URL.revokeObjectURL(url);
    pushToast({ message: 'Plan exported', tone: 'success' });
  }

  async function handleFile(file: File) {
    const text = await file.text();
    // Parsed into a preview only — local state is untouched until confirmed.
    setPreview(parseImport(text));
  }

  function applyImport() {
    if (!preview?.ok) return;
    setPlan(preview.plan);
    void savePlan(preview.plan);
    pushToast({ message: 'Plan imported', tone: 'success' });
    setPreview(null);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Export and import"
      footer={<button type="button" onClick={onClose}>Close</button>}
    >
      <section>
        <h3>Export</h3>
        <p>
          Downloads a versioned JSON backup containing your profile, scenarios, course placements, grades,
          external credit, overrides, and pinned allocations.
        </p>
        <button type="button" className="primary" onClick={handleExport}>
          Export plan as JSON
        </button>
      </section>

      <section>
        <h3>Import</h3>
        <div className="callout info">
          <strong>Nothing is replaced until you confirm.</strong>
          An invalid or incompatible file is rejected without touching your current plan.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a ZotPath backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {preview ? (
          preview.ok ? (
            <div style={{ marginTop: 10 }}>
              <div className="callout ok">
                <strong>Valid backup — review before applying</strong>
                This will replace your current plan.
              </div>
              <ul style={{ fontSize: 12.5 }}>
                <li>Plan name: <strong>{preview.summary.planName}</strong></li>
                <li>Catalogue year: {preview.summary.catalogueYear}</li>
                <li>Data build: <span className="code">{preview.summary.dataBuildId}</span></li>
                <li>Scenarios: {preview.summary.scenarioCount} ({preview.summary.scenarioNames.join(', ')})</li>
                <li>Course placements: {preview.summary.plannedCourseCount}</li>
                <li>External exams: {preview.summary.externalExamCount}</li>
                <li>Manual credits: {preview.summary.manualCreditCount}</li>
                <li>Overrides: {preview.summary.overrideCount}</li>
                <li>Pinned allocations: {preview.summary.pinnedAllocationCount}</li>
                <li>Graduation target: {preview.summary.graduationTermId}</li>
              </ul>
              {preview.warnings.length > 0 ? (
                <div className="callout warn">
                  <strong>Notes</strong>
                  <ul>{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              ) : null}
              {preview.summary.dataBuildId !== catalogue?.buildId ? (
                <div className="callout warn">
                  <strong>Different catalogue build</strong>
                  This plan was last read against <span className="code">{preview.summary.dataBuildId}</span>,
                  but this app has <span className="code">{catalogue?.buildId}</span>. Course rules may have
                  changed. Placements are preserved exactly; re-check any affected requirement.
                </div>
              ) : null}
              <button type="button" className="primary" onClick={applyImport}>
                Replace my plan with this backup
              </button>
            </div>
          ) : (
            <div className="callout error" style={{ marginTop: 10 }}>
              <strong>Import rejected — your current plan is unchanged</strong>
              <ul>{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )
        ) : null}
      </section>

      <section>
        <h3>Data provenance</h3>
        {catalogue ? (
          <ul style={{ fontSize: 12.5 }}>
            <li>Catalogue year: <strong>{catalogue.catalogueYear}</strong></li>
            <li>Build id: <span className="code">{catalogue.buildId}</span></li>
            <li>Retrieved: {new Date(catalogue.retrievedAt).toLocaleString()}</li>
            <li>Courses indexed: {catalogue.courses.length.toLocaleString()}</li>
            <li>Parser notes recorded: {catalogue.parserErrorCount}</li>
          </ul>
        ) : null}
        <p style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          Refresh the snapshot with <span className="code">npm run data:refresh</span>. The planner runs from a
          committed snapshot and never scrapes during normal use.
        </p>
      </section>
    </Dialog>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const plan = useStore((s) => s.plan);
  const updateProfile = useStore((s) => s.updateProfile);
  const setMathProgram = useStore((s) => s.setMathProgram);

  if (!plan) return null;
  const profile = plan.profile;
  const workload = profile.workload;

  return (
    <Dialog open onClose={onClose} title="Settings" footer={<button type="button" onClick={onClose}>Done</button>}>
      <section>
        <h3>Programs</h3>
        <label htmlFor="settings-math">Mathematics second major for this scenario (optional)</label>
        <select
          id="settings-math"
          value={profile.mathProgram}
          onChange={(e) => setMathProgram(e.target.value as Profile['mathProgram'])}
        >
          <option value="none">None — Computer Science only</option>
          <option value="pure_math">Mathematics, B.S. — Pure Mathematics</option>
          <option value="applied_math">Applied and Computational Mathematics, B.S.</option>
        </select>
        <div className="callout info" style={{ marginTop: 6 }}>
          <strong>Only one Mathematics program can be active.</strong>
          UCI prohibits double majoring in Mathematics and Applied and Computational Mathematics. Selecting one
          replaces the other's audit rather than adding to it.
        </div>
      </section>

      <section>
        <h3>University requirement evidence</h3>
        <div className="filter-grid">
          <div>
            <label htmlFor="settings-elwr">Entry Level Writing</label>
            <select
              id="settings-elwr"
              value={profile.elwrStatus}
              onChange={(e) => updateProfile({ elwrStatus: e.target.value as Profile['elwrStatus'] })}
            >
              <option value="unknown_needs_input">Not sure yet</option>
              <option value="satisfied">Satisfied</option>
              <option value="not_satisfied">Not satisfied</option>
              <option value="in_progress">In progress</option>
              <option value="waived_or_external_evidence">Waived / external evidence</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-ahi">American History and Institutions</label>
            <select
              id="settings-ahi"
              value={profile.americanHistoryStatus}
              onChange={(e) =>
                updateProfile({ americanHistoryStatus: e.target.value as Profile['americanHistoryStatus'] })
              }
            >
              <option value="unknown_needs_input">Not sure yet</option>
              <option value="satisfied">Satisfied</option>
              <option value="not_satisfied">Not satisfied</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3>Workload and timeline</h3>
        <div className="filter-grid">
          <div>
            <label htmlFor="settings-target">Personal warning threshold (units)</label>
            <input
              id="settings-target"
              type="number"
              min={12}
              max={20}
              value={workload.regularWarnAboveUnits}
              onChange={(e) =>
                updateProfile({ workload: { ...workload, regularWarnAboveUnits: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label htmlFor="settings-grad">Graduation target</label>
            <select
              id="settings-grad"
              value={profile.graduationTermId}
              onChange={(e) => updateProfile({ graduationTermId: e.target.value })}
            >
              <option value="2029-spring">Spring 2029</option>
              <option value="2030-winter">Winter 2030</option>
              <option value="2030-spring">Spring 2030</option>
              <option value="2030-summer-session_2">Summer 2030</option>
            </select>
          </div>
        </div>
        <div className="filter-row">
          <input
            id="settings-summers"
            type="checkbox"
            checked={workload.summersEnabled}
            onChange={(e) => updateProfile({ workload: { ...workload, summersEnabled: e.target.checked } })}
          />
          <label htmlFor="settings-summers">Include Summer terms</label>
        </div>
      </section>

      <section>
        <h3>About</h3>
        <div className="callout warn">
          <strong>Unofficial planning aid</strong>
          {UNOFFICIAL_NOTICE}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          All data stays in this browser. There is no account and no server.
        </p>
      </section>
    </Dialog>
  );
}
