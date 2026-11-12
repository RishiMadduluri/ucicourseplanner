import { useMemo } from 'react';
import { create } from 'zustand';
import type { Course, Grade } from '../domain/courses/types';
import { normalizeCourseCode } from '../domain/courses/codes';
import type {
  CourseStatus,
  ExternalExam,
  GradeBasis,
  ManualCredit,
  MathProgram,
  Plan,
  PlannedCourse,
  PlanOverride,
  Profile,
  Scenario,
} from '../domain/plan/types';
import { runAudit } from '../domain/audit/audit';
import type { AuditResult } from '../domain/audit/audit';
import { savePlan } from '../persistence/db';
import { buildComparisonScenario, newScenario } from './defaults';

/**
 * Application state.
 *
 * Every mutation records the previous plan on an undo stack and autosaves to
 * IndexedDB. The audit is recomputed from the plan on demand rather than being
 * stored, so it can never drift from the placements that produced it.
 */

const UNDO_LIMIT = 50;

export interface CatalogueState {
  courses: Course[];
  index: Map<string, Course>;
  allCodes: string[];
  buildId: string;
  catalogueYear: string;
  retrievedAt: string;
  parserErrorCount: number;
}

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  /** Optional undo affordance. */
  undoable?: boolean;
}

interface AppState {
  plan: Plan | null;
  catalogue: CatalogueState | null;
  loading: boolean;
  loadError: string | null;
  undoStack: Plan[];
  toasts: Toast[];
  /** Course code currently open in the details drawer. */
  detailCode: string | null;
  /** Explorer prefilter set by clicking a requirement badge. */
  explorerFilterCodes: string[] | null;

  // --- lifecycle
  setCatalogue: (catalogue: CatalogueState) => void;
  setPlan: (plan: Plan) => void;
  setLoading: (loading: boolean) => void;
  setLoadError: (message: string | null) => void;

  // --- derived
  activeScenario: () => Scenario | null;
  audit: () => AuditResult | null;

  // --- plan mutations
  addCourse: (code: string, termId: string | undefined, status?: CourseStatus) => void;
  moveCourse: (placementId: string, termId: string | undefined) => void;
  removeCourse: (placementId: string) => void;
  updatePlacement: (placementId: string, patch: Partial<PlannedCourse>) => void;
  setGrade: (placementId: string, grade: Grade | undefined, basis: GradeBasis | undefined) => void;

  addExam: (exam: ExternalExam) => void;
  removeExam: (examId: string) => void;
  addManualCredit: (credit: ManualCredit) => void;
  removeManualCredit: (creditId: string) => void;

  addOverride: (override: PlanOverride) => void;
  removeOverride: (overrideId: string) => void;
  pinAllocation: (requirementId: string, claimIds: string[]) => void;
  unpinAllocation: (requirementId: string) => void;

  updateProfile: (patch: Partial<Profile>) => void;
  setTransferPoint: (termId: string) => void;
  setMathProgram: (program: MathProgram) => void;
  completeOnboarding: () => void;

  // --- scenarios
  switchScenario: (scenarioId: string) => void;
  duplicateScenario: (scenarioId: string) => void;
  createComparisonScenario: () => void;
  renameScenario: (scenarioId: string, name: string) => void;
  deleteScenario: (scenarioId: string) => void;

  // --- ui
  undo: () => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  openDetail: (code: string | null) => void;
  setExplorerFilterCodes: (codes: string[] | null) => void;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const useStore = create<AppState>((set, get) => {
  /**
   * Apply a change to the active scenario, pushing the previous plan onto the
   * undo stack and autosaving the result.
   */
  function mutateScenario(mutator: (scenario: Scenario) => Scenario, toast?: Omit<Toast, 'id'>): void {
    const { plan } = get();
    if (!plan) return;

    const previous = structuredClone(plan);
    const now = new Date().toISOString();
    const next: Plan = {
      ...plan,
      updatedAt: now,
      scenarios: plan.scenarios.map((s) =>
        s.id === plan.activeScenarioId ? { ...mutator(s), updatedAt: now } : s,
      ),
    };

    set((state) => ({
      plan: next,
      undoStack: [...state.undoStack, previous].slice(-UNDO_LIMIT),
    }));
    void savePlan(next);
    if (toast) get().pushToast(toast);
  }

  function mutatePlan(mutator: (plan: Plan) => Plan, toast?: Omit<Toast, 'id'>): void {
    const { plan } = get();
    if (!plan) return;

    const previous = structuredClone(plan);
    const next = { ...mutator(plan), updatedAt: new Date().toISOString() };

    set((state) => ({
      plan: next,
      undoStack: [...state.undoStack, previous].slice(-UNDO_LIMIT),
    }));
    void savePlan(next);
    if (toast) get().pushToast(toast);
  }

  return {
    plan: null,
    catalogue: null,
    loading: true,
    loadError: null,
    undoStack: [],
    toasts: [],
    detailCode: null,
    explorerFilterCodes: null,

    setCatalogue: (catalogue) => set({ catalogue }),
    setPlan: (plan) => set({ plan }),
    setLoading: (loading) => set({ loading }),
    setLoadError: (loadError) => set({ loadError }),

    activeScenario: () => {
      const { plan } = get();
      if (!plan) return null;
      return plan.scenarios.find((s) => s.id === plan.activeScenarioId) ?? plan.scenarios[0] ?? null;
    },

    audit: () => {
      const { plan, catalogue } = get();
      const scenario = get().activeScenario();
      if (!plan || !scenario || !catalogue) return null;
      return runAudit({
        plan,
        scenario,
        courseIndex: catalogue.index,
        allCourseCodes: catalogue.allCodes,
      });
    },

    // ---- placements -------------------------------------------------------

    addCourse: (rawCode, termId, status = 'planned') => {
      const code = normalizeCourseCode(rawCode);
      const course = get().catalogue?.index.get(code);
      const placement: PlannedCourse = {
        id: nextId('pc'),
        courseId: course?.id ?? `unknown:${code}`,
        code,
        status,
        source: 'uci',
        overrideIds: [],
        createdAt: new Date().toISOString(),
      };
      if (termId) placement.termId = termId;
      // A variable-unit course needs an explicit planned value.
      if (course?.units.variable) placement.plannedUnits = course.units.min;

      mutateScenario(
        (s) => ({ ...s, plannedCourses: [...s.plannedCourses, placement] }),
        { message: `Added ${code}`, tone: 'success', undoable: true },
      );
    },

    moveCourse: (placementId, termId) => {
      mutateScenario(
        (s) => ({
          ...s,
          plannedCourses: s.plannedCourses.map((p) => {
            if (p.id !== placementId) return p;
            // Status, grade, and notes are preserved across a move.
            const next = { ...p };
            if (termId) next.termId = termId;
            else delete next.termId;
            return next;
          }),
        }),
        { message: 'Moved course', tone: 'success', undoable: true },
      );
    },

    removeCourse: (placementId) => {
      const code = get().activeScenario()?.plannedCourses.find((p) => p.id === placementId)?.code;
      mutateScenario(
        (s) => ({ ...s, plannedCourses: s.plannedCourses.filter((p) => p.id !== placementId) }),
        { message: `Removed ${code ?? 'course'}`, tone: 'info', undoable: true },
      );
    },

    updatePlacement: (placementId, patch) => {
      mutateScenario((s) => ({
        ...s,
        plannedCourses: s.plannedCourses.map((p) => (p.id === placementId ? { ...p, ...patch } : p)),
      }));
    },

    setGrade: (placementId, grade, basis) => {
      mutateScenario((s) => ({
        ...s,
        plannedCourses: s.plannedCourses.map((p) => {
          if (p.id !== placementId) return p;
          const next = { ...p };
          if (grade) next.grade = grade;
          else delete next.grade;
          if (basis) next.gradeBasis = basis;
          else delete next.gradeBasis;
          return next;
        }),
      }));
    },

    // ---- external credit --------------------------------------------------

    addExam: (exam) =>
      mutateScenario(
        (s) => ({ ...s, externalExams: [...s.externalExams, exam] }),
        { message: `Added ${exam.examName} (score ${exam.score})`, tone: 'success', undoable: true },
      ),

    removeExam: (examId) =>
      mutateScenario(
        (s) => ({ ...s, externalExams: s.externalExams.filter((e) => e.id !== examId) }),
        { message: 'Removed exam', tone: 'info', undoable: true },
      ),

    addManualCredit: (credit) =>
      mutateScenario(
        (s) => ({ ...s, manualCredits: [...s.manualCredits, credit] }),
        { message: `Added credit from ${credit.institution}`, tone: 'success', undoable: true },
      ),

    removeManualCredit: (creditId) =>
      mutateScenario((s) => ({ ...s, manualCredits: s.manualCredits.filter((c) => c.id !== creditId) })),

    // ---- overrides and pins ----------------------------------------------

    addOverride: (override) =>
      mutateScenario(
        (s) => ({ ...s, overrides: [...s.overrides, override] }),
        { message: 'Override recorded', tone: 'success', undoable: true },
      ),

    removeOverride: (overrideId) =>
      mutateScenario((s) => ({ ...s, overrides: s.overrides.filter((o) => o.id !== overrideId) })),

    pinAllocation: (requirementId, claimIds) =>
      mutateScenario(
        (s) => ({
          ...s,
          pinnedAllocations: [
            ...s.pinnedAllocations.filter((p) => p.requirementId !== requirementId),
            { requirementId, claimIds },
          ],
        }),
        { message: 'Allocation pinned', tone: 'success', undoable: true },
      ),

    unpinAllocation: (requirementId) =>
      mutateScenario((s) => ({
        ...s,
        pinnedAllocations: s.pinnedAllocations.filter((p) => p.requirementId !== requirementId),
      })),

    // ---- profile ----------------------------------------------------------

    updateProfile: (patch) => mutatePlan((p) => ({ ...p, profile: { ...p.profile, ...patch } })),

    setTransferPoint: (termId) =>
      mutatePlan((p) => ({ ...p, transfer: { ...p.transfer, lastTermId: termId } })),

    setMathProgram: (program) =>
      mutatePlan(
        (p) => ({
          ...p,
          profile: { ...p.profile, mathProgram: program },
          scenarios: p.scenarios.map((s) => (s.id === p.activeScenarioId ? { ...s, mathProgram: program } : s)),
        }),
        {
          message:
            program === 'pure_math'
              ? 'Switched this scenario to Pure Mathematics'
              : program === 'applied_math'
                ? 'Switched this scenario to Applied and Computational Mathematics'
                : 'Switched this scenario to Computer Science only',
          tone: 'info',
          undoable: true,
        },
      ),

    completeOnboarding: () => mutatePlan((p) => ({ ...p, onboardingComplete: true })),

    // ---- scenarios --------------------------------------------------------

    switchScenario: (scenarioId) => mutatePlan((p) => ({ ...p, activeScenarioId: scenarioId })),

    duplicateScenario: (scenarioId) =>
      mutatePlan((p) => {
        const source = p.scenarios.find((s) => s.id === scenarioId);
        if (!source) return p;
        const copy: Scenario = {
          ...structuredClone(source),
          id: nextId('scenario'),
          name: `${source.name} (copy)`,
          isPrimary: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return { ...p, scenarios: [...p.scenarios, copy], activeScenarioId: copy.id };
      }, { message: 'Scenario duplicated', tone: 'success', undoable: true }),

    createComparisonScenario: () =>
      mutatePlan((p) => {
        const source = p.scenarios.find((s) => s.id === p.activeScenarioId);
        if (!source) return p;
        const comparison = buildComparisonScenario(source);
        return { ...p, scenarios: [...p.scenarios, comparison], activeScenarioId: comparison.id };
      }, { message: 'Comparison scenario created', tone: 'success', undoable: true }),

    renameScenario: (scenarioId, name) =>
      mutatePlan((p) => ({
        ...p,
        scenarios: p.scenarios.map((s) => (s.id === scenarioId ? { ...s, name } : s)),
      })),

    deleteScenario: (scenarioId) =>
      mutatePlan((p) => {
        if (p.scenarios.length <= 1) return p;
        const remaining = p.scenarios.filter((s) => s.id !== scenarioId);
        return {
          ...p,
          scenarios: remaining,
          activeScenarioId: p.activeScenarioId === scenarioId ? remaining[0]!.id : p.activeScenarioId,
        };
      }, { message: 'Scenario deleted', tone: 'info', undoable: true }),

    // ---- ui ---------------------------------------------------------------

    undo: () => {
      const { undoStack } = get();
      const previous = undoStack.at(-1);
      if (!previous) {
        get().pushToast({ message: 'Nothing to undo', tone: 'info' });
        return;
      }
      set({ plan: previous, undoStack: undoStack.slice(0, -1) });
      void savePlan(previous);
      get().pushToast({ message: 'Undid last change', tone: 'info' });
    },

    pushToast: (toast) => {
      const entry: Toast = { ...toast, id: nextId('toast') };
      set((state) => ({ toasts: [...state.toasts, entry].slice(-4) }));
      // Toasts are also rendered into an aria-live region, so auto-dismiss is
      // purely visual.
      setTimeout(() => get().dismissToast(entry.id), 6000);
    },

    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

    openDetail: (detailCode) => set({ detailCode }),

    setExplorerFilterCodes: (explorerFilterCodes) => set({ explorerFilterCodes }),
  };
});

/** Create a scenario without touching the store, for tests and onboarding. */
export { newScenario };

/**
 * Memoized selectors.
 *
 * `activeScenario()` and `audit()` build fresh objects on every call, so
 * selecting them directly through `useStore` would hand React a new snapshot
 * each render and loop forever. Components must use these hooks instead.
 */

export function useActiveScenario(): Scenario | null {
  const plan = useStore((s) => s.plan);
  return useMemo(() => {
    if (!plan) return null;
    return plan.scenarios.find((s) => s.id === plan.activeScenarioId) ?? plan.scenarios[0] ?? null;
  }, [plan]);
}

export function useAudit(): AuditResult | null {
  const plan = useStore((s) => s.plan);
  const catalogue = useStore((s) => s.catalogue);
  const scenario = useActiveScenario();

  return useMemo(() => {
    if (!plan || !scenario || !catalogue) return null;
    return runAudit({
      plan,
      scenario,
      courseIndex: catalogue.index,
      allCourseCodes: catalogue.allCodes,
    });
  }, [plan, scenario, catalogue]);
}
