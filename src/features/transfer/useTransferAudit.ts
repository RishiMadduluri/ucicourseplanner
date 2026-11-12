import { useMemo } from 'react';
import { useStore, useAudit } from '../../app/store';
import type { Term } from '../../domain/terms/terms';
import { TRANSFER_INSTITUTIONS, findProgram } from '../../domain/transfer/registry';
import { buildSnapshot, evaluateProgram } from '../../domain/transfer/evaluate';
import type { ProgramResult, TransferSnapshot } from '../../domain/transfer/evaluate';
import type { ApplicationCycle, DeadlineAudit } from '../../domain/transfer/deadlines';
import { evaluateApplicationCycle } from '../../domain/transfer/deadlines';

/**
 * Runs every transfer target against the active plan at one chosen moment.
 *
 * The moment matters more than anything else here. "Would Berkeley take these
 * courses?" has no answer until you say *when* you would leave — Berkeley wants
 * 60–80 semester units, Brown refuses anyone past four semesters, and MIT stops
 * at five terms. So the whole view hangs off a single `lastTermId`.
 */

export interface TransferAudit {
  snapshot: TransferSnapshot;
  results: ProgramResult[];
  /** First plan term at which no machine-checkable blocking rule fails. */
  earliestEligibleByProgram: Map<string, { termId: string; label: string }>;
}

export function useTransferAudit(terms: Term[], lastTermId: string): TransferAudit | null {
  const catalogue = useStore((s) => s.catalogue);
  const auditResult = useAudit();

  return useMemo(() => {
    if (!catalogue || !auditResult) return null;

    const sequence = new Map(terms.map((term) => [term.id, term.sequence]));
    const lastTerm = terms.find((term) => term.id === lastTermId) ?? terms[terms.length - 1];
    if (!lastTerm) return null;

    const creditTotals = {
      examQuarterUnits: auditResult.externalCredit.examUnits,
      manualQuarterUnits: auditResult.externalCredit.manualQuarterUnits,
    };
    const snapshot = buildSnapshot(
      auditResult.claims,
      sequence,
      lastTerm.id,
      lastTerm.label,
      creditTotals,
    );

    const results = TRANSFER_INSTITUTIONS.flatMap((institution) =>
      institution.programs.map((program) =>
        evaluateProgram(institution, program, snapshot, catalogue.index),
      ),
    );

    const earliestEligibleByProgram = new Map<string, { termId: string; label: string }>();
    const candidates = transferPointOptions(terms);
    for (const institution of TRANSFER_INSTITUTIONS) {
      for (const program of institution.programs) {
        for (const term of candidates) {
          const candidateSnapshot = buildSnapshot(
            auditResult.claims,
            sequence,
            term.id,
            term.label,
            creditTotals,
          );
          const candidate = evaluateProgram(institution, program, candidateSnapshot, catalogue.index);
          if (candidate.eligibility === 'open') {
            earliestEligibleByProgram.set(program.id, { termId: term.id, label: term.label });
            break;
          }
        }
      }
    }

    return { snapshot, results, earliestEligibleByProgram };
  }, [catalogue, auditResult, terms, lastTermId]);
}

/** Evaluate one named program against one real application cycle. */
export function useApplicationDeadlineAudit(
  terms: Term[],
  programId: string,
  cycle: ApplicationCycle | undefined,
): DeadlineAudit | null {
  const catalogue = useStore((s) => s.catalogue);
  const auditResult = useAudit();

  return useMemo(() => {
    if (!catalogue || !auditResult || !cycle) return null;
    const entry = findProgram(programId);
    if (!entry) return null;
    return evaluateApplicationCycle(
      entry.institution,
      entry.program,
      cycle,
      terms,
      auditResult.claims,
      catalogue.index,
      {
        examQuarterUnits: auditResult.externalCredit.examUnits,
        manualQuarterUnits: auditResult.externalCredit.manualQuarterUnits,
      },
    );
  }, [catalogue, auditResult, terms, programId, cycle]);
}

/** Regular (non-summer) terms are the only sensible transfer points. */
export function transferPointOptions(terms: Term[]): Term[] {
  return terms.filter((term) => term.season !== 'summer');
}

/**
 * Default transfer point: the end of the second academic year, which is the
 * junior-standing moment most of these targets are built around.
 */
export function defaultTransferPoint(terms: Term[]): string {
  const springs = terms.filter((term) => term.season === 'spring');
  return springs[1]?.id ?? springs[0]?.id ?? terms[terms.length - 1]?.id ?? '';
}
