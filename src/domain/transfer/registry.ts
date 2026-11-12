import type { TransferInstitution, TransferProgram } from './types';
import { UC_INSTITUTIONS } from './targets/universityOfCalifornia';
import { PUBLIC_INSTITUTIONS } from './targets/publicUniversities';
import { PRIVATE_INSTITUTIONS_A } from './targets/privateUniversitiesA';
import { PRIVATE_INSTITUTIONS_B } from './targets/privateUniversitiesB';

/**
 * The transfer target registry.
 *
 * Ordering follows the list the student gave, so the UI can present the schools
 * in the order they think about them rather than alphabetically.
 */
const ORDER = [
  'berkeley', 'ucsd', 'ucla', 'cmu', 'gatech', 'cornell', 'uiuc', 'utaustin',
  'uw', 'umd', 'umich', 'nyu', 'usc', 'uva', 'upenn', 'columbia', 'uchicago',
  'duke', 'rice', 'brown', 'dartmouth', 'yale', 'harvard', 'princeton',
  'northwestern', 'stanford', 'mit',
];

const ALL = [
  ...UC_INSTITUTIONS,
  ...PUBLIC_INSTITUTIONS,
  ...PRIVATE_INSTITUTIONS_A,
  ...PRIVATE_INSTITUTIONS_B,
];

export const TRANSFER_INSTITUTIONS: TransferInstitution[] = ORDER
  .map((id) => ALL.find((inst) => inst.id === id))
  .filter((inst): inst is TransferInstitution => inst !== undefined);

/** Every program, flattened, with its institution attached. */
export interface ProgramEntry {
  institution: TransferInstitution;
  program: TransferProgram;
}

export const TRANSFER_PROGRAMS: ProgramEntry[] = TRANSFER_INSTITUTIONS.flatMap((institution) =>
  institution.programs.map((program) => ({ institution, program })),
);

export function findProgram(programId: string): ProgramEntry | undefined {
  return TRANSFER_PROGRAMS.find((entry) => entry.program.id === programId);
}

export function findInstitution(institutionId: string): TransferInstitution | undefined {
  return TRANSFER_INSTITUTIONS.find((inst) => inst.id === institutionId);
}

/** Age of a YYYY-MM-DD research retrieval stamp, clamped at zero. */
export function transferSourceAgeDays(retrievedAt: string, now = new Date()): number | undefined {
  const date = new Date(`${retrievedAt}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

/** Six months is the review interval for admissions rules and deadlines. */
export function isTransferSourceStale(retrievedAt: string, now = new Date(), maxAgeDays = 183): boolean {
  const age = transferSourceAgeDays(retrievedAt, now);
  return age === undefined || age > maxAgeDays;
}

/**
 * Sanity guard used by the tests: nothing in the registry may share an id, and
 * every `sharedAdmissionWith` reference must point at a real program.
 */
export function registryProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const { program } of TRANSFER_PROGRAMS) {
    if (seen.has(program.id)) problems.push(`duplicate program id: ${program.id}`);
    seen.add(program.id);

    const requirementIds = new Set<string>();
    for (const requirement of program.requirements) {
      if (requirementIds.has(requirement.id)) {
        problems.push(`duplicate requirement id in ${program.id}: ${requirement.id}`);
      }
      requirementIds.add(requirement.id);
    }
    if (program.sourceUrls.length === 0) problems.push(`${program.id} has no source URL`);
  }

  for (const { program } of TRANSFER_PROGRAMS) {
    for (const shared of program.sharedAdmissionWith ?? []) {
      if (!seen.has(shared)) {
        problems.push(`${program.id} references unknown shared program ${shared}`);
      }
    }
  }

  return problems;
}
