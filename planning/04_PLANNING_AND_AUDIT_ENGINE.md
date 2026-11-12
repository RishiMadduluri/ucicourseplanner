# Planning and Degree-Audit Engine

## Design goal

Rules must be encoded as versioned data and evaluated by reusable engines. Do not scatter course-code checks through UI components.

## Core entities

The exact syntax may change, but the implementation needs the following concepts.

```ts
type Course = {
  id: string;
  catalogueYear: string;
  code: string;
  aliases: string[];
  department: string;
  number: string;
  title: string;
  description: string;
  units: { min: number; max: number; variable: boolean };
  level: "lower" | "upper" | "graduate" | "professional";
  prerequisiteRaw?: string;
  prerequisiteExpr?: PrerequisiteExpr;
  corequisiteExpr?: PrerequisiteExpr;
  concurrentExpr?: PrerequisiteExpr;
  recommendedRaw?: string;
  restrictions: Restriction[];
  sameAs: string[];
  overlapsWith: string[];
  repeatability?: RepeatabilityRule;
  gradingOptions: string[];
  geCategories: GeDesignation[];
  sourceUrl: string;
  retrievedAt: string;
};
```

```ts
type PrerequisiteExpr =
  | { op: "course"; courseId: string; minGrade?: Grade }
  | { op: "exam_or_placement"; key: string }
  | { op: "standing"; value: "sophomore" | "junior" | "senior" }
  | { op: "consent"; authority: string }
  | { op: "and"; children: PrerequisiteExpr[] }
  | { op: "or"; children: PrerequisiteExpr[] }
  | { op: "n_of"; n: number; children: PrerequisiteExpr[] }
  | { op: "unknown"; raw: string };
```

```ts
type PlannedCourse = {
  courseId: string;
  termId?: string;
  status: "planned" | "in_progress" | "completed" | "waived" | "failed";
  grade?: Grade;
  gradeBasis?: "letter" | "pass_no_pass" | "credit" | "external";
  source?: "uci" | "ap" | "ib" | "transfer" | "dual_enrollment" | "manual";
  equivalentCourseIds?: string[];
  unitsEarned?: number;
  notes?: string;
  overrideIds?: string[];
};
```

```ts
type ExternalExam = {
  id: string;
  system: "ap" | "ib" | "a_level" | "other";
  examKey: string;
  score: string;
  examYear?: number;
  awardRuleId?: string;
  manuallyVerified?: boolean;
  notes?: string;
};

type ExamAward = {
  id: string;
  catalogueYear: string;
  system: ExternalExam["system"];
  examKey: string;
  scoreMin: number;
  scoreMax: number;
  units: number;
  equivalentCourseOptionIds: string[][];
  geEffects: string[];
  universityRequirementEffects: string[];
  electiveOnly: boolean;
  duplicateWithCourseIds: string[];
  sourceUrl: string;
};
```

```ts
type Term = {
  id: string;
  academicYear: string;
  season: "fall" | "winter" | "spring" | "summer";
  summerSession?: "session_1" | "ten_week" | "session_2";
  isIncomingSummer?: boolean;
  sequence: number;
  status: "past" | "current" | "future";
};
```

## Requirement rule types

```ts
type Requirement =
  | { kind: "all_of"; children: Requirement[] }
  | { kind: "any_of"; children: Requirement[] }
  | { kind: "choose_n"; n: number; children: Requirement[]; distinct?: boolean }
  | { kind: "choose_n_groups"; n: number; groups: RequirementGroup[] }
  | { kind: "course"; courseId: string; minGrade?: Grade }
  | { kind: "course_range"; department: string; min: number; max: number;
      unitsPerCourse?: number; exclusions?: string[] }
  | { kind: "min_units"; units: number; filter?: CourseFilter }
  | { kind: "gpa"; minimum: number; filter: CourseFilter }
  | { kind: "residence"; rule: string }
  | { kind: "external_evidence"; key: string }
  | { kind: "advisor_confirmation"; key: string };
```

Each requirement also needs:

- stable ID;
- title and description;
- catalogue year;
- source URL;
- sharing policy;
- grade-basis policy;
- whether manual substitution is allowed;
- precedence/specificity used by allocation.

## Prerequisite evaluation

### Time ordering

- A prerequisite course must be successfully completed in a term earlier than the target term.
- A corequisite or concurrent requirement may be in the same term.
- A planned prerequisite with no grade is conditionally satisfied and produces “planned,” not “complete.”
- A failed or insufficient grade does not satisfy the node.
- External equivalency can satisfy a node only when explicitly mapped.
- An AP award satisfies a course prerequisite only through an exact official course equivalence/exemption or an exam/placement node that explicitly names it.
- Elective-only AP credit supplies units but never satisfies an unrelated course prerequisite.

### Three-valued result

Every expression returns:

- `satisfied`;
- `unsatisfied`;
- `unknown`.

`unknown` is important for consent, standing, placement, unparsed text, or missing transfer equivalency. Do not treat unknown as false or true.

### Explanation

Return a structured explanation with:

- satisfied branch(es);
- missing branch(es);
- minimum grade;
- planned course and term that supplies a branch;
- earliest currently feasible term;
- raw source text;
- parser confidence.

### Restrictions

Enrollment restrictions are not prerequisites. Evaluate them in a separate advisory engine:

- first consideration;
- major-only;
- school-only;
- class standing;
- instructor/department consent;
- duplicate/same-as/overlap;
- repeatability.

A course can be “prerequisites satisfied, enrollment restricted.”

### External-exam evaluation

1. Match the exam name and score to the selected catalogue-year award rule.
2. Emit distinct effects for units, course equivalence, GE, ELWR/American Institutions, and prerequisite clearance.
3. If the award offers alternate sequences, retain the alternatives until the user or requirement solver selects a valid interpretation.
4. Detect duplicate UCI, AP, IB, transfer, or college-course credit and award units only once.
5. Keep exam credit out of GPA calculations and any add-major rule that requires a graded UCI course.
6. If the score is missing or no rule exists for the selected year, return `unknown_needs_verification`.

## Requirement allocation

### General behavior

The same planned/completed course record may be presented under multiple requirements, but the solver must respect sharing rules.

Use an allocation model that:

1. finds all eligible requirement claims for each course;
2. applies required named courses before broad elective ranges;
3. maximizes completed requirements without violating sharing policies;
4. avoids consuming a course in an elective bucket when it is needed for a stricter requirement;
5. stores a deterministic result;
6. lets the user pin a different valid allocation.

### Important UCI rules

- Major courses may also satisfy permitted GE.
- Category V can overlap another GE category.
- One course cannot count as both Va and Vb.
- VII and VIII can overlap another approved category.
- CS sections do not share courses, except COMPSCI 145 may count in Flexible Core and Project.
- Four CS Flexible Core courses must represent four distinct focus areas.
- The nine CS electives must not reuse courses consumed by another CS section unless the rule explicitly allows it.
- Mathematics’s five additional electives must be four-unit MATH lecture courses 100–189 and should not silently reuse named required courses.
- Same-as and overlapping courses cannot both earn duplicate credit when the catalogue forbids it.
- Mathematics B.S. and Applied and Computational Mathematics B.S. are mutually exclusive active programs.

### Shared double-major courses

Model a course as capable of satisfying a CS node and a Mathematics node unless an explicit school/program rule forbids that overlap. Show a “shared” badge. Because Physical Sciences requires adviser review for double majors, the audit should display such allocations as:

- valid under encoded catalogue rules; and
- pending adviser confirmation where appropriate.

## CS-specific evaluation

### Focus areas

Track:

```text
selectedCourses = 4
distinctFocusAreas = 4
```

If the user selects COMPSCI 112 and 116, both are FA1 and only one focus area is complete.

### Project rule

Track two project requirement slots. COMPSCI 145 can additionally satisfy one Flexible Core slot under the explicit exception.

If COMPSCI 180A or 180B is used, show their paired sequence rule and the official note that both must be passed for course credit.

## Mathematics-specific evaluation

### Science sequence

Treat the three options as atomic paths. Mixed paths such as CHEM 1A + PHYSICS 7D + PHYSICS 7E do not satisfy the requirement.

### Additional electives

Validate:

- MATH department;
- number 100–189;
- four units;
- lecture classification;
- no prohibited duplicate or overlap;
- no reuse where the requirement semantics disallow it.

## Applied and Computational Mathematics-specific evaluation

This evaluator is active only in the alternate Mathematics scenario.

- Require every named lower- and upper-division core course, including each 105-series lab.
- Count exactly three eligible additional lower-division selections.
- Require MATH 112A, 112B, and 115.
- Count three choices from the official Mathematics-elective list, preserving paired-course semantics such as MATH 107 with MATH 107L.
- Count two four-unit upper-division courses from the official outside-Mathematics list.
- Treat any unlisted outside course as ineligible unless an adviser-approved substitution override exists.
- Permit an eligible COMPSCI course to appear under both programs only when the encoded sharing policies allow it, and show that allocation explicitly.

## Unit, GPA, and residence tracking

### Units

Display:

- completed units;
- in-progress units;
- planned units;
- projected total against 180;
- AP/IB/transfer units separately;
- per-term total.

Variable-unit courses require a user-selected planned unit value within the official range.

### GPA

Only calculate a GPA when enough graded data exists. Track:

- overall UC GPA;
- CS major GPA;
- CS upper-division major GPA;
- Mathematics major GPA;
- Mathematics upper-division major GPA;
- Applied and Computational Mathematics major and upper-division GPA when that alternate is active;
- add-major GPA subsets.

P/NP and external credit must follow UCI’s grade-basis rules and must not be assigned an invented grade.

### Residence and modality

Track the final 45 units as a rolling window. If future course origin/modality is unknown, report:

> Projected residence status cannot yet be verified.

Do not present a green check based on assumptions.

## Offering evaluator

For each course/term pair return:

```ts
type OfferingAssessment = {
  state: "scheduled" | "planned" | "likely" | "possible" |
         "uncommon" | "not_observed" | "unknown";
  confidence?: number;
  evidence: OfferingEvidence[];
  suggestedTerms: string[];
  lastObserved?: string;
};
```

Prerequisite eligibility and likely offering are independent:

- eligible + likely;
- eligible + unlikely;
- ineligible + likely;
- unknown eligibility + unknown offering.

The UI must not collapse these into one “available” field.

## Workload risk

The app should separate official enrollment limits from user-configurable difficulty preferences.

Official validation:

- regular quarter: 12–20 units is standard; outside that range warns that dean authorization is required;
- full Summer: 20 units normally, with no more than 12 in a session;
- 10-week Summer units count half in Session 1 and half in Session 2;
- approved Summer exceptions are recorded as overrides, but more than 32 total Summer units is invalid.

Default personal-risk thresholds:

- regular term: warn above 16 units or four major-intensive courses;
- Summer: warn when two compressed technical courses overlap;
- sequence bottleneck: warn when moving a course delays multiple downstream requirements;
- final-year risk: warn about any required course with low/unknown offering confidence and no backup.

Allow per-course personal workload weights later. The MVP can mark technical major courses and writing/project courses with simple tags.

## Suggestions

A post-MVP “Suggest next courses” function should rank only courses whose prerequisite state is satisfied or conditionally satisfied. Suggested score can combine:

- degree requirement urgency;
- number of downstream courses unlocked;
- offering confidence;
- graduation bottleneck risk;
- GE/major overlap benefit;
- user interest;
- workload balance.

Always explain the top reasons and allow the user to ignore the suggestion.

## Overrides and adviser notes

An override contains:

- affected rule;
- type: substitution, equivalency, prerequisite waiver, overlap approval, other;
- note;
- optional adviser/date evidence;
- created/updated timestamps.

Overrides are visually distinct and never alter the source rule itself.

## Persistence and migration

- Autosave plan mutations locally.
- Keep a small append-only undo history for the current session.
- Export a schema-versioned JSON backup.
- Persist external exams, scores, award-rule IDs, derived effects, and manual verification separately from planned UCI courses.
- Validate imported files and show a preview.
- On catalogue/data update, retain prior data until the user reviews the diff.
- Never silently delete a planned course that disappears from a newer catalogue.

## Test strategy

Use fixture-based tests for:

- source parsing;
- AP score-boundary and duplicate-credit mappings;
- AP Calculus course equivalence, AP CSA elective-only behavior, AP CSP I&C SCI 20, and AP Statistics not satisfying STATS 67;
- prerequisite AND/OR/minimum-grade trees;
- term ordering and corequisites;
- every CS focus-area combination;
- COMPSCI 145’s explicit double use;
- CS section non-reuse;
- Mathematics science-sequence alternatives;
- Mathematics elective range/unit filtering;
- Applied and Computational Mathematics core, elective lists, paired lab rules, and mutual exclusion from Mathematics B.S.;
- regular-quarter 12–20 warnings and Summer total/session calculations;
- GE Va/Vb conflict;
- GE/major sharing;
- repeat/same-as conflicts;
- AP/IB/transfer unknown evidence;
- residence with unknown future modality;
- catalogue-year migration.
