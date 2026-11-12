import type { Grade, GeCategory } from '../courses/types';

/**
 * Requirement rule model (04_PLANNING_AND_AUDIT_ENGINE.md).
 *
 * Rules are *data*, never UI conditionals. Every node carries its own stable id,
 * catalogue year, source URL, sharing policy, and grade policy so the audit can
 * always explain where a result came from.
 */

export type RequirementState =
  | 'complete'
  | 'in_progress'
  | 'planned'
  | 'at_risk'
  | 'unmet'
  | 'unknown';

/**
 * Controls whether one course may be claimed by two requirements.
 *
 * Leaves that share an `exclusionGroup` are mutually exclusive for the same
 * course. Leaves in different groups may both claim it — which is how a major
 * course also satisfies GE.
 *
 * Encoded cases:
 *   - `cs_sections`      CS A/B/C/D do not share courses …
 *   - `sharingExceptions`  … except COMPSCI 145 across Flexible Core and Project.
 *   - `ge_v_subcategory` one course cannot be both Va and Vb.
 *   - `math_pure`        named Pure Math courses are not reusable as electives.
 */
export interface SharingPolicy {
  exclusionGroups: string[];
  /** Normalized course codes exempt from this leaf's exclusion groups. */
  sharingExceptions?: string[];
}

/** Which grade bases may satisfy a requirement. */
export interface GradePolicy {
  /** Minimum passing grade, when the catalogue states one. */
  minGrade?: Grade;
  /**
   * UCI: unless a course is P/NP-only or the dean authorizes it, P/NP work may
   * not satisfy specific school/major course requirements.
   */
  allowPassNoPass: boolean;
  /** Whether ungraded exam/transfer credit may satisfy this requirement. */
  allowExternalCredit: boolean;
}

export const DEFAULT_GRADE_POLICY: GradePolicy = {
  allowPassNoPass: false,
  allowExternalCredit: true,
};

/** Filter used by unit, GPA, and open-ended elective rules. */
export interface CourseFilter {
  departments?: string[];
  excludeDepartments?: string[];
  /** Inclusive numeric range on the course number. */
  minNumber?: number;
  maxNumber?: number;
  /** Exact unit value each course must carry. */
  unitsExactly?: number;
  levels?: Array<'lower' | 'upper' | 'graduate' | 'professional'>;
  geCategories?: GeCategory[];
  /** Explicit normalized codes that are never eligible. */
  excludeCodes?: string[];
  /**
   * Schools/offering units excluded by a program rule, matched against course
   * department. CS science requirement excludes Engineering, ICS, Economics,
   * and Mathematics.
   */
  excludeOfferedBy?: string[];
}

export type RequirementRule =
  /** Every child must be satisfied. */
  | { kind: 'all_of'; children: Requirement[] }
  /** At least one child must be satisfied. */
  | { kind: 'any_of'; children: Requirement[] }
  /** Exactly `n` children must be satisfied. */
  | { kind: 'choose_n'; n: number; children: Requirement[] }
  /** One named course. */
  | { kind: 'course'; code: string }
  /** `n` courses drawn from an explicit list of options. */
  | { kind: 'choose_n_courses'; n: number; options: string[] }
  /**
   * `n` courses that must come from `n` *distinct* groups.
   * CS Flexible Core: four courses from four distinct focus areas.
   */
  | { kind: 'choose_n_distinct_groups'; n: number; groups: RequirementGroup[] }
  /** `n` courses matching an open filter, e.g. five MATH 100-189 lecture courses. */
  | { kind: 'course_range'; n: number; filter: CourseFilter }
  /** `n` courses carrying a GE designation. */
  | { kind: 'ge_category'; category: GeCategory; n: number }
  /** A minimum unit total across matching work. */
  | { kind: 'min_units'; units: number; filter?: CourseFilter }
  /** A minimum GPA across matching graded work. */
  | { kind: 'gpa'; minimum: number; filter: CourseFilter }
  /** A residence/modality rule the planner can only evaluate with real data. */
  | { kind: 'residence'; rule: string }
  /** Evidence the user must supply, e.g. ELWR or American History. */
  | { kind: 'external_evidence'; key: string }
  /** A non-course task, e.g. Physical Sciences double-major adviser review. */
  | { kind: 'advisor_confirmation'; key: string }
  /**
   * Paired courses that must be taken together, e.g. MATH 107 with MATH 107L.
   * Counts as one selection.
   */
  | { kind: 'course_pair'; codes: string[] };

export interface RequirementGroup {
  id: string;
  title: string;
  courses: string[];
}

export interface Requirement {
  /** Stable id, e.g. "cs.upper.flexible_core". */
  id: string;
  title: string;
  description?: string;
  catalogueYear: string;
  sourceUrl: string;
  rule: RequirementRule;
  sharing: SharingPolicy;
  grade: GradePolicy;
  /** Whether an adviser-approved substitution override may satisfy this rule. */
  allowSubstitution: boolean;
  /**
   * Allocation precedence. Lower runs first, so a strictly named requirement
   * claims a course before a broad elective bucket can absorb it.
   */
  precedence: number;
  /** Shown when the rule cannot be fully automated. */
  verificationNote?: string;
}

export interface RequirementProgram {
  id: string;
  title: string;
  /** Grouping shown in the Degree Audit rail. */
  category: 'uc' | 'uci' | 'ge' | 'cs' | 'math' | 'gpa' | 'eligibility' | 'advising';
  catalogueYear: string;
  sourceUrl: string;
  requirements: Requirement[];
}

/** Precedence bands used consistently across program definitions. */
export const PRECEDENCE = {
  /** A single explicitly named course. */
  NAMED_COURSE: 10,
  /** A pinned pair, e.g. MATH 107 + 107L. */
  PAIRED_COURSE: 15,
  /** A choice among a short explicit list. */
  SHORT_LIST: 20,
  /** Distinct-group selections such as CS focus areas. */
  DISTINCT_GROUPS: 30,
  /** A choice among a long explicit list. */
  LONG_LIST: 40,
  /** GE category buckets. */
  GE_CATEGORY: 50,
  /** Open-ended elective ranges. */
  ELECTIVE_RANGE: 60,
  /** Unit/GPA/residence aggregates evaluated after allocation. */
  AGGREGATE: 90,
} as const;
