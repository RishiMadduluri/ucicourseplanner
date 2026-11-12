import { useEffect, useMemo, useState } from 'react';
import { useStore, useActiveScenario, useAudit } from './store';
import { createDefaultPlan } from './defaults';
import { loadCatalogue } from '../data/loadCatalogue';
import { loadPlan, savePlan } from '../persistence/db';
import { DEFAULT_CATALOGUE_YEAR, UNOFFICIAL_NOTICE } from '../domain/schemaVersions';
import { buildTimeline } from '../domain/terms/terms';
import { assessPlanner } from '../domain/planner/warnings';
import { resolveExternalCredit } from '../domain/externalCredit/resolve';
import { OFFERING_INDEX } from '../data/offerings2026';
import { CourseExplorer } from '../features/course-explorer/CourseExplorer';
import { CourseDetailDrawer } from '../features/course-explorer/CourseDetailDrawer';
import { PlanBoard } from '../features/planner/PlanBoard';
import { DegreeAudit } from '../features/degree-audit/DegreeAudit';
import { Onboarding } from '../features/onboarding/Onboarding';
import { ScenarioBar } from '../features/scenarios/ScenarioBar';
import { DataMenu } from '../features/scenarios/DataMenu';
import { MigrationNotice } from '../features/scenarios/MigrationNotice';
import { TransferView } from '../features/transfer/TransferView';

/**
 * Application shell.
 *
 * Desktop uses the three-region layout (Explorer / board / Audit) with
 * collapsible side rails; below 900px it switches to separate Courses, Plan, and
 * Audit views rather than compressing three columns.
 */

type MobileView = 'courses' | 'plan' | 'audit';

/**
 * The shell has two workspaces. "Plan" is the three-region planner; "Transfer"
 * replaces it with the outbound-transfer readiness board, which needs the full
 * width to hold 27 universities without turning into a scroll of chips.
 */
type Workspace = 'plan' | 'transfer';

export function App() {
  const plan = useStore((s) => s.plan);
  const catalogue = useStore((s) => s.catalogue);
  const loading = useStore((s) => s.loading);
  const loadError = useStore((s) => s.loadError);
  const setPlan = useStore((s) => s.setPlan);
  const setCatalogue = useStore((s) => s.setCatalogue);
  const setLoading = useStore((s) => s.setLoading);
  const setLoadError = useStore((s) => s.setLoadError);
  const scenario = useActiveScenario();
  const auditResult = useAudit();
  const undo = useStore((s) => s.undo);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('plan');
  const [workspace, setWorkspace] = useState<Workspace>('plan');
  const [selectedTermId, setSelectedTermId] = useState('2026-fall');

  // ---- boot --------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const { catalogue: loaded } = await loadCatalogue(DEFAULT_CATALOGUE_YEAR);
        if (cancelled) return;
        setCatalogue(loaded);

        const existing = await loadPlan();
        if (cancelled) return;

        if (existing) {
          setPlan(existing);
        } else {
          const fresh = createDefaultPlan(loaded.buildId);
          setPlan(fresh);
          await savePlan(fresh);
        }
      } catch (error) {
        if (!cancelled) setLoadError((error as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setCatalogue, setPlan, setLoading, setLoadError]);

  // ---- global keyboard shortcuts ----------------------------------------
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        if (typing) return;
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.getElementById('course-search')?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  const timeline = useMemo(
    () =>
      buildTimeline({
        startYear: 2026,
        academicYears: 4,
        summersEnabled: plan?.profile.workload.summersEnabled ?? true,
        graduationTermId: plan?.profile.graduationTermId ?? '2030-spring',
      }),
    [plan?.profile.workload.summersEnabled, plan?.profile.graduationTermId],
  );

  const assessment = useMemo(() => {
    if (!scenario || !catalogue || !plan) return null;
    const external = resolveExternalCredit(scenario.externalExams, scenario.manualCredits);
    return assessPlanner({
      scenario,
      courseIndex: catalogue.index,
      offeringIndex: OFFERING_INDEX,
      external,
      workload: plan.profile.workload,
      termIds: timeline.allTerms.map((t) => t.id),
    });
  }, [scenario, catalogue, plan, timeline]);

  if (loading) {
    return (
      <div className="app">
        <TopBar />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Loading the 2026–27 catalogue snapshot…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app">
        <TopBar />
        <div style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
          <div className="callout error">
            <strong>Could not load the catalogue</strong>
            {loadError}
          </div>
          <p>
            Build the snapshot with <span className="code">npm run data:refresh</span> (needs network access),
            or <span className="code">npm run data:refresh:offline</span> if a raw snapshot is already cached,
            then reload.
          </p>
        </div>
      </div>
    );
  }

  if (!plan || !catalogue || !assessment) return null;

  const workspaceClass = [
    'workspace',
    leftCollapsed ? 'collapse-left' : '',
    rightCollapsed ? 'collapse-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <a className="skip-link" href="#plan-board">Skip to the plan board</a>

      <TopBar>
        <div className="workspace-switch" role="group" aria-label="Workspace">
          {(['plan', 'transfer'] as Workspace[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={workspace === value}
              className={workspace === value ? '' : 'subtle'}
              onClick={() => setWorkspace(value)}
            >
              {value === 'plan' ? 'Plan' : 'Transfer'}
            </button>
          ))}
        </div>
        <ScenarioBar />
        <span className="spacer" />
        <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', opacity: 0.9 }} title={`Build ${catalogue.buildId}`}>
          Catalogue {catalogue.catalogueYear} · data {new Date(catalogue.retrievedAt).toLocaleDateString()}
        </span>
        <button type="button" onClick={undo} title="Undo the last change (Ctrl/Cmd+Z)">
          Undo
        </button>
        <DataMenu />
      </TopBar>

      <p className="unofficial-banner" role="note">
        {UNOFFICIAL_NOTICE}
      </p>

      {workspace === 'transfer' ? (
        <main className="transfer-workspace" aria-label="Transfer readiness">
          <TransferView terms={timeline.allTerms} />
        </main>
      ) : (
      <div className={workspaceClass} data-mobile-view={mobileView}>
        <aside
          className={`rail left${leftCollapsed ? ' hidden' : ''}`}
          aria-label="Course Explorer"
        >
          <CourseExplorer
            terms={timeline.allTerms}
            selectedTermId={selectedTermId}
            onSelectTerm={setSelectedTermId}
          />
        </aside>

        <main aria-label="Four-year plan" style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px 0' }} className="desktop-only">
            <button type="button" className="subtle" onClick={() => setLeftCollapsed((v) => !v)}>
              {leftCollapsed ? '▸ Show Explorer' : '◂ Hide Explorer'}
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="subtle" onClick={() => setRightCollapsed((v) => !v)}>
              {rightCollapsed ? 'Show Audit ◂' : 'Hide Audit ▸'}
            </button>
          </div>
          <PlanBoard
            timeline={timeline}
            assessment={assessment}
            selectedTermId={selectedTermId}
            onSelectTerm={setSelectedTermId}
          />
        </main>

        <aside
          className={`rail right${rightCollapsed ? ' hidden' : ''}`}
          aria-label="Degree Audit"
        >
          <DegreeAudit audit={auditResult} assessment={assessment} />
        </aside>
      </div>
      )}

      {workspace === 'plan' ? (
      <nav className="mobile-tabs" aria-label="Main views">
        {(['courses', 'plan', 'audit'] as MobileView[]).map((view) => (
          <button
            key={view}
            type="button"
            aria-current={mobileView === view ? 'page' : undefined}
            onClick={() => setMobileView(view)}
          >
            {view === 'courses' ? 'Courses' : view === 'plan' ? 'Plan' : 'Audit'}
          </button>
        ))}
      </nav>
      ) : null}

      <CourseDetailDrawer terms={timeline.allTerms} selectedTermId={selectedTermId} />
      {!plan.onboardingComplete ? <Onboarding /> : <MigrationNotice />}
      <ToastRegion />
    </div>
  );
}

function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <h1>
        <span className="zot">Zot</span>Path
      </h1>
      {children}
    </header>
  );
}

function ToastRegion() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const undo = useStore((s) => s.undo);

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span>{toast.message}</span>
          {toast.undoable ? (
            <button type="button" onClick={() => { undo(); dismissToast(toast.id); }}>
              Undo
            </button>
          ) : null}
          <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
