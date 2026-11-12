# UCI CS + Mathematics Four-Year Planner

Research and product specification prepared July 24, 2026.

## What this package is

This package turns the initial planner idea into an implementation-ready specification for a personal-use UCI course-planning website. It is intentionally limited to:

- the Computer Science, B.S.;
- the Mathematics, B.S., with Pure Mathematics as the default;
- the Applied and Computational Mathematics, B.S., as an alternate comparison path;
- UC, UCI, and General Education graduation requirements;
- every course in the UCI General Catalogue as a searchable option;
- UCI Fall, Winter, Spring, and Summer planning;
- prerequisite, restriction, requirement, and likely-offering checks.

It is a planning aid, not an official degree audit. The application must always show that final decisions should be checked against DegreeWorks and the relevant UCI academic advising offices.

## Default assumptions

- Catalogue year: **2026–27**, because that is the current UCI Catalogue as of the research date.
- Student type: incoming Fall 2026 first-year student, already admitted to Computer Science and intending to add Mathematics.
- Programs: Computer Science, B.S. + Mathematics, B.S. (Pure Mathematics) by default; Applied and Computational Mathematics, B.S. is an alternate, mutually exclusive Mathematics scenario.
- First planning period: **Incoming Summer 2026**, before Year 1 Fall 2026.
- Summer: enabled, with Session 1, 10-week, and Session 2 represented inside each Summer period.
- Course load: 12–20 units is the standard regular-quarter range; the app may plan outside it only with an authorization warning. Summer is limited to 20 units total and normally 12 units per session.
- External credit: AP exam and score entry uses official score-specific unit, course-equivalency, GE, and prerequisite effects.
- Persistence: local-first; no login or cloud service is required for the MVP.
- Future availability: shown as a confidence estimate, never as a promise.

The application must let the user change the catalogue year. UCI catalogue rights can make an earlier catalogue, such as the supplied 2025–26 PDF, the correct rule source for a particular student.

## Important feasibility finding

The two majors are unusually course-heavy together. From the 2026–27 requirements, the combination contains roughly **50 or more distinct major course slots before remaining GE courses**, even after obvious overlap such as MATH 2A, MATH 2B, MATH 3A, and two Physical Sciences courses that can also satisfy the CS science requirement. The exact total depends on:

- AP/IB/dual-enrollment credit;
- approved cross-listed or equivalent courses;
- the chosen Mathematics science sequence;
- how UCI advisers approve overlap between the two majors;
- whether the accelerated I&C SCI H32 route is available;
- the chosen CS and Mathematics electives.

This makes the student’s existing credit, desired quarterly load, and willingness to take Summer courses essential inputs before producing a realistic personal four-year plan.

## Files

1. [01_PRODUCT_SPEC.md](01_PRODUCT_SPEC.md) — product goals, workflows, scope, and implementation sequence.
2. [02_UCI_REQUIREMENTS_2026_27.md](02_UCI_REQUIREMENTS_2026_27.md) — researched AP, UC/UCI, GE, CS, Mathematics, Applied Mathematics, and double-major rules.
3. [03_DATA_SOURCES_AND_PREDICTIONS.md](03_DATA_SOURCES_AND_PREDICTIONS.md) — official sources, ingestion rules, versioning, and future-offering inference.
4. [04_PLANNING_AND_AUDIT_ENGINE.md](04_PLANNING_AND_AUDIT_ENGINE.md) — normalized data model, prerequisite evaluation, and degree-audit logic.
5. [05_UI_UX_AND_ACCEPTANCE_CRITERIA.md](05_UI_UX_AND_ACCEPTANCE_CRITERIA.md) — layout, interactions, visual behavior, accessibility, and testable completion criteria.
6. [06_DECISIONS_NEEDED.md](06_DECISIONS_NEEDED.md) — confirmed student profile, fixed defaults, and the remaining questions for a personalized first plan.
7. [07_AP_CREDIT_MAPPING_2026_27.md](07_AP_CREDIT_MAPPING_2026_27.md) — complete 2026–27 AP score, unit, course, GE, and duplicate-credit seed reference.
8. [08_CLAUDE_CODE_IMPLEMENTATION_PROMPT.md](08_CLAUDE_CODE_IMPLEMENTATION_PROMPT.md) — copy-ready execution prompt for Claude Code to implement and verify the local-first MVP.

## Recommended handoff order

A coding agent should read the files in numerical order, then:

1. build the versioned data-ingestion pipeline;
2. seed the 2026–27 catalogue, AP-credit table, GE, CS, Pure Mathematics, and Applied Mathematics rules;
3. implement the requirement and prerequisite engines with tests;
4. build the local-first planner UI;
5. import current and historical offering data;
6. verify the acceptance scenarios in file 05.

## Primary official sources

- [UCI 2026–27 General Catalogue](https://catalogue.uci.edu/)
- [All UCI courses](https://catalogue.uci.edu/allcourses/)
- [Requirements for a Bachelor’s Degree](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/)
- [Computer Science, B.S.](https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/)
- [Mathematics, B.S.](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/mathematics_bs/)
- [Applied and Computational Mathematics, B.S.](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/appliedandcomputationalmathematics_bs/)
- [AP and IB Credit](https://catalogue.uci.edu/informationforprospectivestudents/undergraduateadmissions/#advancedplacementandinternationalbaccalaureatecredittext)
- [Academic Regulations and Course-Load Limits](https://catalogue.uci.edu/informationforadmittedstudents/academicregulationsandprocedures/)
- [Summer Session Academic Information](https://summer.uci.edu/academic-information/)
- [UCI Schedule of Classes / WebSoc](https://www.reg.uci.edu/perl/WebSoc)
- [ICS planned course offerings](https://courselisting.ics.uci.edu/ugrad_courses/)
- [Mathematics planned course offerings](https://www.math.uci.edu/undergrad-courses/plan-math-course-offerings)
- [ICS change/add-major criteria](https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/)
- [Physical Sciences change/add-major criteria](https://changeofmajor.uci.edu/school-of-physical-sciences/)
- [Archived 2025–26 Catalogue PDF supplied by the user](https://catalogue.uci.edu/pdf/UCI%20Full%20CAT%202025-26.pdf)
