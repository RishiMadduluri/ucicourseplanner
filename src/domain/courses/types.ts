import { z } from 'zod';

/**
 * Normalized catalogue course model.
 * Mirrors the entity sketch in 04_PLANNING_AND_AUDIT_ENGINE.md while adding the
 * provenance fields required by 03_DATA_SOURCES_AND_PREDICTIONS.md.
 */

export const gradeSchema = z.enum([
  'A+', 'A', 'A-',
  'B+', 'B', 'B-',
  'C+', 'C', 'C-',
  'D+', 'D', 'D-',
  'F',
  'P', 'NP',
  'S', 'U',
  'I', 'IP', 'W',
]);
export type Grade = z.infer<typeof gradeSchema>;

/** Ordered best-to-worst; used for minimum-grade comparisons. */
export const GRADE_POINTS: Readonly<Record<string, number>> = Object.freeze({
  'A+': 4.0, A: 4.0, 'A-': 3.7,
  'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7,
  'D+': 1.3, D: 1.0, 'D-': 0.7,
  F: 0.0,
});

/** Grades that carry grade points and therefore participate in GPA. */
export function isGradedLetter(grade: Grade | undefined): boolean {
  return grade !== undefined && Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade);
}

/**
 * GE categories per 02_UCI_REQUIREMENTS_2026_27.md. Category V has the Va/Vb
 * split; a course approved for both may only be used for one of them.
 */
export const geCategorySchema = z.enum([
  'Ia', // Lower-Division Writing — two courses required
  'Ib', // Upper-Division Writing — one course, the approved `W` designation
  'I',  // unqualified writing designation, if the catalogue ever prints one
  'II', 'III', 'IV',
  'Va', 'Vb', 'V',
  'VI', 'VII', 'VIII',
]);
export type GeCategory = z.infer<typeof geCategorySchema>;

export const geDesignationSchema = z.object({
  category: geCategorySchema,
  catalogueYear: z.string(),
  /** Exactly as printed in the catalogue, e.g. "(II and (Va or Vb).)". */
  raw: z.string(),
  /**
   * True when the catalogue prints alternatives ("Va or Vb") — the course
   * carries the option but the allocator must pick at most one.
   */
  exclusiveWithin: z.array(geCategorySchema).optional(),
});
export type GeDesignation = z.infer<typeof geDesignationSchema>;

export const restrictionSchema = z.object({
  kind: z.enum([
    'first_consideration',
    'major_only',
    'school_only',
    'class_standing',
    'consent',
    'other',
  ]),
  raw: z.string(),
});
export type Restriction = z.infer<typeof restrictionSchema>;

export const repeatabilitySchema = z.object({
  raw: z.string(),
  /** Total times the course may be taken for credit, when stated. */
  maxTimes: z.number().int().positive().optional(),
  /** Total unit ceiling when the catalogue states one instead of a count. */
  maxUnits: z.number().positive().optional(),
  unlimited: z.boolean().default(false),
});
export type RepeatabilityRule = z.infer<typeof repeatabilitySchema>;

export const courseLevelSchema = z.enum(['lower', 'upper', 'graduate', 'professional']);
export type CourseLevel = z.infer<typeof courseLevelSchema>;

/** Recursive prerequisite expression; see domain/prerequisites. */
export type PrerequisiteExpr =
  | { op: 'course'; courseId: string; code: string; minGrade?: Grade }
  | { op: 'exam_or_placement'; key: string; raw: string }
  | { op: 'standing'; value: 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate'; raw: string }
  | { op: 'consent'; authority: string; raw: string }
  | { op: 'and'; children: PrerequisiteExpr[] }
  | { op: 'or'; children: PrerequisiteExpr[] }
  | { op: 'n_of'; n: number; children: PrerequisiteExpr[] }
  | { op: 'unknown'; raw: string };

export const prerequisiteExprSchema: z.ZodType<PrerequisiteExpr> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal('course'), courseId: z.string(), code: z.string(), minGrade: gradeSchema.optional() }),
    z.object({ op: z.literal('exam_or_placement'), key: z.string(), raw: z.string() }),
    z.object({
      op: z.literal('standing'),
      value: z.enum(['freshman', 'sophomore', 'junior', 'senior', 'graduate']),
      raw: z.string(),
    }),
    z.object({ op: z.literal('consent'), authority: z.string(), raw: z.string() }),
    z.object({ op: z.literal('and'), children: z.array(prerequisiteExprSchema) }),
    z.object({ op: z.literal('or'), children: z.array(prerequisiteExprSchema) }),
    z.object({ op: z.literal('n_of'), n: z.number().int().positive(), children: z.array(prerequisiteExprSchema) }),
    z.object({ op: z.literal('unknown'), raw: z.string() }),
  ]),
);

export const unitsSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  variable: z.boolean(),
});
export type Units = z.infer<typeof unitsSchema>;

export const courseSchema = z.object({
  /** Stable, catalogue-year-scoped id, e.g. "2026-27:COMPSCI-112". */
  id: z.string(),
  catalogueYear: z.string(),
  /** Official catalogue spelling, e.g. "I&C SCI 31". Never rewritten. */
  code: z.string(),
  /** Uppercased, single-spaced matching key, e.g. "I&C SCI 31". */
  normalizedCode: z.string(),
  /** Accepted user-facing spellings, e.g. ["ICS 31", "I&CSCI 31"]. */
  aliases: z.array(z.string()),
  department: z.string(),
  /** Course number as printed, including any letter suffix, e.g. "122A". */
  number: z.string(),
  /** Numeric component used for level and range rules, e.g. 122. */
  numericValue: z.number().int().nonnegative(),
  title: z.string(),
  description: z.string(),
  units: unitsSchema,
  level: courseLevelSchema,

  prerequisiteRaw: z.string().optional(),
  prerequisiteExpr: prerequisiteExprSchema.optional(),
  corequisiteRaw: z.string().optional(),
  corequisiteExpr: prerequisiteExprSchema.optional(),
  /**
   * The catalogue's "Concurrent:" field. Verified against the live 2026-27 data:
   * it names a co-taught cross-listed counterpart (an undergraduate course and
   * its graduate twin, in both directions), NOT a course the student must also
   * enroll in. It is therefore a duplicate-credit signal, never a requirement.
   */
  concurrentRaw: z.string().optional(),
  concurrentWith: z.array(z.string()).default([]),
  recommendedRaw: z.string().optional(),

  restrictions: z.array(restrictionSchema),
  sameAs: z.array(z.string()),
  overlapsWith: z.array(z.string()),
  repeatability: repeatabilitySchema.optional(),
  gradingOptions: z.array(z.string()),
  geCategories: z.array(geDesignationSchema),

  sourceUrl: z.string(),
  retrievedAt: z.string(),
  /** 0..1 — lowered when a rule was retained as raw text instead of parsed. */
  parserConfidence: z.number().min(0).max(1),
  /** Raw HTML-stripped source block, retained even when parsing succeeds. */
  rawSourceText: z.string(),
});
export type Course = z.infer<typeof courseSchema>;

export const parserErrorSchema = z.object({
  department: z.string(),
  sourceUrl: z.string(),
  code: z.string().optional(),
  stage: z.enum(['block', 'code', 'units', 'prerequisite', 'gened', 'other']),
  message: z.string(),
  rawExcerpt: z.string(),
});
export type ParserError = z.infer<typeof parserErrorSchema>;

export const catalogueSnapshotSchema = z.object({
  schemaVersion: z.number().int(),
  catalogueYear: z.string(),
  buildId: z.string(),
  retrievedAt: z.string(),
  sourceIndexUrl: z.string(),
  departmentCount: z.number().int(),
  courseCount: z.number().int(),
  courses: z.array(courseSchema),
  parserErrors: z.array(parserErrorSchema),
});
export type CatalogueSnapshot = z.infer<typeof catalogueSnapshotSchema>;
