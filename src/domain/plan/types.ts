import { z } from 'zod';
import { gradeSchema } from '../courses/types';

/**
 * Plan, scenario, and profile model. These are the user-owned records that get
 * persisted to IndexedDB and round-tripped through JSON export/import.
 */

export const courseStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'waived',
  'failed',
  'not_taken',
]);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

export const gradeBasisSchema = z.enum(['letter', 'pass_no_pass', 'credit', 'external']);
export type GradeBasis = z.infer<typeof gradeBasisSchema>;

export const creditSourceSchema = z.enum(['uci', 'ap', 'ib', 'transfer', 'dual_enrollment', 'manual']);
export type CreditSource = z.infer<typeof creditSourceSchema>;

export const plannedCourseSchema = z.object({
  /** Unique per placement so the same course can appear twice (repeatable). */
  id: z.string(),
  courseId: z.string(),
  /** Normalized code, denormalized for fast display and matching. */
  code: z.string(),
  termId: z.string().optional(),
  status: courseStatusSchema,
  grade: gradeSchema.optional(),
  gradeBasis: gradeBasisSchema.optional(),
  source: creditSourceSchema.default('uci'),
  /** Chosen unit value for a variable-unit course. */
  plannedUnits: z.number().nonnegative().optional(),
  unitsEarned: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  overrideIds: z.array(z.string()).default([]),
  /** Set when this placement came from an external award rather than enrollment. */
  externalExamId: z.string().optional(),
  createdAt: z.string(),
});
export type PlannedCourse = z.infer<typeof plannedCourseSchema>;

export const externalExamSchema = z.object({
  id: z.string(),
  system: z.enum(['ap', 'ib', 'a_level', 'other']),
  /** Stable key into the award table, e.g. "calculus_bc". */
  examKey: z.string(),
  /** Official exam name as displayed. */
  examName: z.string(),
  score: z.string(),
  examYear: z.number().int().optional(),
  manuallyVerified: z.boolean().default(false),
  notes: z.string().optional(),
});
export type ExternalExam = z.infer<typeof externalExamSchema>;

/** Transfer / dual-enrollment / adviser-entered equivalency. */
export const manualCreditSchema = z.object({
  id: z.string(),
  institution: z.string(),
  courseTitle: z.string(),
  units: z.number().nonnegative(),
  /** Calendar of the source institution; older records default to UCI quarter units. */
  unitSystem: z.enum(['quarter', 'semester']).optional(),
  grade: gradeSchema.optional(),
  /** Normalized UCI codes this external course is accepted as. */
  equivalentCourseCodes: z.array(z.string()).default([]),
  source: creditSourceSchema.default('transfer'),
  /** Adviser evidence; without it the audit shows "needs verification". */
  verifiedBy: z.string().optional(),
  notes: z.string().optional(),
});
export type ManualCredit = z.infer<typeof manualCreditSchema>;

export const transferSettingsSchema = z.object({
  /** Last UCI term completed before the intended transfer. */
  lastTermId: z.string().optional(),
});
export type TransferSettings = z.infer<typeof transferSettingsSchema>;

export const overrideSchema = z.object({
  id: z.string(),
  type: z.enum(['substitution', 'equivalency', 'prerequisite_waiver', 'overlap_approval', 'load_exception', 'other']),
  /** Requirement id, course code, or term id the override applies to. */
  targetId: z.string(),
  /** Required. An override without a reason is not recorded. */
  note: z.string().min(1),
  adviser: z.string().optional(),
  adviserDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanOverride = z.infer<typeof overrideSchema>;

/** A user-pinned requirement allocation that the solver must honor. */
export const pinnedAllocationSchema = z.object({
  requirementId: z.string(),
  /** Planned-course ids (or award ids) locked onto this requirement. */
  claimIds: z.array(z.string()),
});
export type PinnedAllocation = z.infer<typeof pinnedAllocationSchema>;

export const mathProgramSchema = z.enum(['pure_math', 'applied_math', 'none']);
export type MathProgram = z.infer<typeof mathProgramSchema>;

export const workloadPreferenceSchema = z.object({
  /** Personal warning threshold; 17–20 stays legal, just flagged. */
  regularTargetUnits: z.number().default(16),
  regularWarnAboveUnits: z.number().default(16),
  summerStyle: z.enum(['one_course', 'up_to_two', 'maximum']).default('up_to_two'),
  intensity: z.enum(['balanced', 'aggressive', 'adaptive']).default('adaptive'),
  summersEnabled: z.boolean().default(true),
});
export type WorkloadPreference = z.infer<typeof workloadPreferenceSchema>;

export const profileSchema = z.object({
  catalogueYear: z.string(),
  entranceTermId: z.string(),
  graduationTermId: z.string(),
  primaryMajor: z.literal('computer_science_bs'),
  mathProgram: mathProgramSchema,
  workload: workloadPreferenceSchema,
  /** Evidence-backed state; never inferred from planned UCI courses alone. */
  elwrStatus: z.enum(['satisfied', 'not_satisfied', 'in_progress', 'unknown_needs_input', 'waived_or_external_evidence']),
  americanHistoryStatus: z.enum(['satisfied', 'not_satisfied', 'unknown_needs_input']),
  /** Free-text note on how ELWR / AH&I evidence was established. */
  universityRequirementNotes: z.string().optional(),
});
export type Profile = z.infer<typeof profileSchema>;

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  isPrimary: z.boolean().default(false),
  mathProgram: mathProgramSchema,
  plannedCourses: z.array(plannedCourseSchema).default([]),
  externalExams: z.array(externalExamSchema).default([]),
  manualCredits: z.array(manualCreditSchema).default([]),
  overrides: z.array(overrideSchema).default([]),
  pinnedAllocations: z.array(pinnedAllocationSchema).default([]),
  /** Chosen unit values keyed by planned-course id for variable-unit courses. */
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  appDataSchemaVersion: z.number().int(),
  /** Manifest/build id of the catalogue snapshot this plan was last read against. */
  dataBuildId: z.string(),
  profile: profileSchema,
  scenarios: z.array(scenarioSchema),
  activeScenarioId: z.string(),
  /** Transfer-workspace choices belong in backups, not browser-only storage. */
  transfer: transferSettingsSchema.optional(),
  onboardingComplete: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Plan = z.infer<typeof planSchema>;

export const planExportSchema = z.object({
  format: z.literal('zotpath-plan'),
  exportSchemaVersion: z.number().int(),
  exportedAt: z.string(),
  appVersion: z.string(),
  plan: planSchema,
});
export type PlanExport = z.infer<typeof planExportSchema>;
