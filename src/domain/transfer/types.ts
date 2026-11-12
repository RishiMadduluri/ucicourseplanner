import type { Grade } from '../courses/types';

/**
 * Outbound-transfer model.
 *
 * ZotPath's degree audit answers "does this plan finish a UCI degree?".
 * This module answers a different question: "if I left UCI after term X, would
 * the UCI courses I actually took satisfy another university's published
 * transfer requirements?"
 *
 * Two facts shape the whole model:
 *
 *  1. **Nobody publishes a UCI articulation.** ASSIST covers California
 *     community college -> UC/CSU only. Berkeley states outright that "UC does
 *     not maintain articulation agreements from any four-year institution."
 *     Every UCI-to-target course equivalence here is therefore *our* reading of
 *     two catalogues, never an agreement. Each one carries an explicit
 *     {@link EquivalenceConfidence} and the requirement carries its source URL.
 *
 *  2. **Course lists are only half the gate.** Unit windows, terms-completed
 *     windows, residency minimums, testing rules, and "this major is closed to
 *     transfers" decide more outcomes than coursework does. Those live in
 *     {@link TransferEligibility} and are evaluated separately, so a target can
 *     be coursework-ready and still be ineligible — and the UI must say which.
 */

/** How much authority stands behind a stated requirement or mapping. */
export type EquivalenceConfidence =
  /** The target publishes an explicit transfer requirement list. */
  | 'published_requirement'
  /** Published requirement, but the UCI equivalent is our reading of catalogues. */
  | 'mapped_from_catalogue'
  /** No transfer list exists; taken from the target's own degree curriculum. */
  | 'inferred_from_curriculum'
  /** Stated loosely by the target ("strong preparation in math and science"). */
  | 'stated_informally';

export const CONFIDENCE_LABEL: Record<EquivalenceConfidence, string> = {
  published_requirement: 'Published transfer requirement',
  mapped_from_catalogue: 'Mapped from catalogues — verify',
  inferred_from_curriculum: 'Inferred from the degree curriculum',
  stated_informally: 'Stated informally by the school',
};

/** Whether a requirement gates admission or merely strengthens it. */
export type Necessity =
  /** Missing it makes the application ineligible or unreviewable. */
  | 'required'
  /** The school names it as expected preparation. */
  | 'recommended'
  /** Not named, but competitive applicants have it. */
  | 'competitive';

export const NECESSITY_LABEL: Record<Necessity, string> = {
  required: 'Required',
  recommended: 'Recommended',
  competitive: 'Competitive edge',
};

/** Filter for open requirements such as "two lab sciences". */
export interface TransferCourseFilter {
  departments?: string[];
  excludeDepartments?: string[];
  minNumber?: number;
  maxNumber?: number;
  /** Restrict to an explicit allow-list of normalized UCI codes. */
  codes?: string[];
  /** Codes this filter must never match. */
  excludeCodes?: string[];
  /** Requirement text shown when nothing matches. */
  description: string;
}

/**
 * How a UCI plan can satisfy one target requirement.
 *
 * Deliberately three-valued at evaluation time: `unknown` is a real answer when
 * a rule depends on evidence the planner does not hold (a test score, an
 * adviser's syllabus review, a placement exam).
 */
export type TransferSatisfaction =
  /** One UCI course. */
  | { kind: 'course'; code: string }
  /** Every branch must be satisfied. */
  | { kind: 'all_of'; children: TransferSatisfaction[] }
  /** At least one branch. */
  | { kind: 'any_of'; children: TransferSatisfaction[] }
  /** `n` distinct satisfied branches. */
  | { kind: 'n_of'; n: number; children: TransferSatisfaction[] }
  /** `n` distinct courses matching a filter. */
  | { kind: 'course_range'; n: number; filter: TransferCourseFilter }
  /**
   * Evidence the planner cannot see — SAT/ACT, a graded paper, a syllabus
   * review. Always evaluates to `unknown`, never to false.
   */
  | { kind: 'external_evidence'; key: string; prompt: string };

/** One line item in a target's coursework expectations. */
export interface TransferRequirement {
  /** Stable id, e.g. "berkeley.eecs.multivariable". */
  id: string;
  /** What the target calls it. */
  title: string;
  /** The target's own course numbers, verbatim, e.g. ["MATH 1551"]. */
  targetCourses?: string[];
  necessity: Necessity;
  confidence: EquivalenceConfidence;
  /** Minimum grade the TARGET demands in the equivalent work. */
  minGrade?: Grade;
  /** Destination requires an actual letter grade, not P/NP, S/U, or exam credit. */
  letterGradeRequired?: boolean;
  /** A rule that only becomes active for a particular kind of plan evidence. */
  appliesWhen?: TransferRequirementApplicability;
  satisfiedBy: TransferSatisfaction;
  /**
   * True for "one ADDITIONAL natural science" style rules, where the school
   * lists the course *on top of* its named physics or chemistry requirements.
   * The engine evaluates these last, after the named requirements have claimed
   * their courses, so one physics course cannot satisfy both.
   */
  additional?: boolean;
  /** Anything the audit must not silently swallow. */
  note?: string;
}

export type TransferRequirementApplicability = {
  /** Example: Michigan requires Calculus III only when AP supplied Calc I/II. */
  kind: 'exam_credit_for';
  courseCodes: string[];
};

/** A non-course admission gate. */
export type EligibilityRuleKind =
  | 'closed_to_transfer'
  | 'terms_window'
  | 'unit_window'
  | 'gpa'
  | 'testing'
  | 'residency'
  | 'credit_cap'
  | 'direct_admit_only'
  | 'grade_distribution'
  | 'other';

export interface EligibilityRule {
  id: string;
  kind: EligibilityRuleKind;
  title: string;
  detail: string;
  /**
   * `blocking` rules can make a target impossible for this plan;
   * `advisory` rules shape competitiveness only.
   */
  severity: 'blocking' | 'advisory';
  /** Machine-checkable bounds, when the rule is numeric. */
  check?: EligibilityCheck;
}

/**
 * Numeric bounds the engine can actually test against a plan.
 * All unit values are stored in the target's own unit system; the engine
 * converts UCI quarter units before comparing.
 */
export type EligibilityCheck =
  | { kind: 'min_quarters_completed'; quarters: number }
  | { kind: 'max_quarters_completed'; quarters: number }
  | { kind: 'min_semester_units'; units: number }
  | { kind: 'max_semester_units'; units: number }
  | { kind: 'min_gpa'; gpa: number }
  | { kind: 'competitive_gpa'; gpa: number }
  | { kind: 'subject_gpa'; gpa: number; departments: string[]; label: string; competitive?: boolean }
  | { kind: 'minimum_subject_grade'; grade: Grade; departments: string[]; label: string }
  | { kind: 'no_pass_no_pass'; departments?: string[]; label?: string }
  /** Fraction of transferable courses that must be at A or B (Yale). */
  | { kind: 'grade_distribution'; minFractionAB: number; floorGrade: Grade };

/** Which terms a target accepts transfers into. */
export type EntryTerm = 'fall' | 'spring' | 'summer' | 'winter';

export interface TransferEligibility {
  entryTerms: EntryTerm[];
  /** Human-readable deadline text, e.g. "March 1 (fall entry)". */
  deadlines: string[];
  /** Standardized testing posture for TRANSFER applicants specifically. */
  testing: 'required' | 'required_with_waiver' | 'optional' | 'recommended' | 'not_used';
  /**
   * True when the target admits you into the named major, so being admitted to
   * the university without the major is not the same outcome.
   */
  admitsDirectlyToMajor: boolean;
  /** Set when the program does not accept external transfers at all. */
  closedToTransfer?: string;
  rules: EligibilityRule[];
}

/** One admission target: a university, a school inside it, and a program. */
export interface TransferProgram {
  /** Stable id, e.g. "berkeley.eecs_bs". */
  id: string;
  /** Program name as the target prints it. */
  name: string;
  /**
   * The school/college that actually admits you. This is the level at which
   * most decisions are made, and several of the user's "different majors" turn
   * out to share one admitting unit.
   */
  admittingUnit: string;
  degree: string;
  /**
   * Set when two entries in the user's list resolve to the same admission
   * decision, so the UI can group them instead of double-counting.
   */
  sharedAdmissionWith?: string[];
  sourceUrls: string[];
  retrievedAt: string;
  eligibility: TransferEligibility;
  requirements: TransferRequirement[];
  /** Applies a letter-grade rule to every listed preparation requirement. */
  requirementsMustBeLetterGraded?: boolean;
  /** Caveats that belong on the program card, not buried in a rule list. */
  cautions?: string[];
}

/**
 * A UCI AP equivalency is not automatically an equivalency at another school.
 * `manual_review` therefore never auto-checks a target requirement; it surfaces
 * a review item and a range for unit-window calculations.
 */
export interface TransferExamCreditPolicy {
  coursework: 'not_accepted' | 'manual_review';
  units: 'excluded' | 'manual_review';
  detail: string;
  sourceUrls: string[];
}

export interface TransferInstitution {
  id: string;
  name: string;
  shortName: string;
  /** 'quarter' targets need no unit conversion from UCI. */
  calendar: 'semester' | 'quarter';
  /** Rules that apply to every program at the institution. */
  institutionRules: EligibilityRule[];
  institutionSourceUrls: string[];
  examCreditPolicy?: TransferExamCreditPolicy;
  programs: TransferProgram[];
}

/** UCI quarter units -> semester units. */
export function quarterToSemesterUnits(quarterUnits: number): number {
  return quarterUnits * (2 / 3);
}

/** Semester units -> UCI quarter units. */
export function semesterToQuarterUnits(semesterUnits: number): number {
  return semesterUnits * 1.5;
}
