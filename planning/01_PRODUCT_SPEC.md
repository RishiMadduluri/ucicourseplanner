# Product Specification

## Product statement

Build a local-first UCI four-year planner that lets one undergraduate search every UCI course, place courses into Summer/Fall/Winter/Spring terms, enter AP scores and other external credit, see prerequisite and likely-offering warnings, and continuously audit progress toward the Computer Science B.S., the selected Mathematics path, GE, UC, and UCI graduation requirements.

Working title: **ZotPath**.

## Product principles

1. **Explain, do not merely flag.** Every warning must say what is missing and how it could be resolved.
2. **Planning is not registration.** Current sections and availability may be shown, but the product does not enroll the user.
3. **Uncertainty is visible.** Department plans, historical predictions, and manual assumptions use distinct labels.
4. **Rules are versioned.** Course descriptions, GE designations, prerequisites, and degree requirements are tied to an academic catalogue year.
5. **One course or exam, many effects.** A course or external exam can visibly advance majors, prerequisites, units, and/or permitted GE categories without being counted twice.
6. **Manual control wins.** The user can override a warning, pin a requirement allocation, or enter an adviser-approved substitution, with a note.
7. **Personal use stays simple.** The MVP requires no account, social features, or enterprise backend.

## User and scope

### Primary user

One incoming Fall 2026 UCI undergraduate admitted to Computer Science and planning to add Mathematics over approximately four years. The plan begins with Incoming Summer 2026.

### Supported programs

- Computer Science, B.S.
- Mathematics, B.S. — Pure Mathematics, the default path
- Applied and Computational Mathematics, B.S. — alternate standard path
- Computer Science plus either Mathematics path simultaneously
- No other major audits in the MVP

UCI prohibits a student from double majoring in Mathematics and Applied and Computational Mathematics. The planner may compare those as separate scenarios but must never mark both Mathematics programs active in one scenario.

All UCI departments and courses remain searchable because electives and GE courses may come from anywhere.

### Catalogue scope

Ingest every course record in the selected UCI Catalogue edition. Default the explorer to undergraduate courses, while allowing a “Show graduate/professional and restricted courses” toggle. Restricted courses remain searchable and clearly labeled.

## Core user workflows

### 1. Initial setup

The user enters:

- starting term and expected graduation term, defaulting to Incoming Summer 2026 through Spring 2030;
- catalogue year;
- active major(s), defaulting to CS + Pure Mathematics;
- completed and in-progress courses;
- AP/IB exams with score and exam year, plus transfer and dual-enrollment credit;
- grades or credit status where known;
- preferred maximum units/courses per regular and Summer term;
- whether Summer enrollment is allowed;
- preferred CS areas and Mathematics electives, if known.

The app first creates an **Incoming Summer 2026** period, then four academic-year rows. Each row has Fall, Winter, Spring, and—when it occurs before the selected graduation term—Summer. A Summer card contains Session 1, 10-week, and Session 2 sublabels rather than pretending Summer is one undifferentiated quarter. With the default Spring 2030 graduation target, the primary board ends at Spring 2030 instead of adding Summer 2030.

#### AP-credit workflow

AP input is exam-and-score driven. Selecting an exam and score previews all official 2026–27 effects before saving:

- UCI units awarded;
- exact UCI course equivalence or exemption;
- GE, ELWR, or American History and Institutions effect;
- prerequisite effect;
- elective-only credit;
- duplicate-credit warning.

Examples the seed rules must represent exactly:

- AP Calculus AB 3–5: four units and MATH 2A or MATH 5A;
- AP Calculus BC 4–5: eight units and MATH 2A–2B or MATH 5A–5B;
- AP Computer Science A 3–5: eight elective units only, so it does not clear the ICS programming sequence;
- AP Computer Science Principles 3–5: eight units and I&C SCI 20;
- AP Statistics 3–5: STATS 7, STATS 8, SOCECOL 13, or EDUC 15, but not STATS 67.

External exam credit never receives an invented grade. The duplicate-credit rule prevents earning credit again for a UCI course covered by the exam, while still preserving any separate allowed effect.

### 2. Find a course

The Course Explorer searches by course code, title, keyword, or department and supports filters for:

- lower/upper/graduate level;
- units;
- GE category;
- CS requirement group or focus area;
- Mathematics requirement group;
- prerequisite status by a selected term;
- scheduled, department-planned, historically likely, or unknown availability;
- modality and time for a published term;
- open/waitlist/full status when current WebSoc data exists;
- enrollment restrictions or first-consideration rules.

Each result card shows:

- normalized course code and title;
- units;
- short description;
- GE and program-requirement badges;
- prerequisite summary;
- restrictions separately from prerequisites;
- likely quarters with evidence/confidence;
- a link to the official Catalogue record;
- “Add to…” and “View details” actions.

### 3. Add and move a course

The user can:

- drag a course into a term;
- use an accessible “Add to term” menu;
- move or copy a course into a sandbox scenario;
- mark it planned, in progress, completed, waived, or not taken;
- record a grade, P/NP status, or external credit.

Adding or moving a course immediately recalculates:

- term units and course count;
- prerequisite/corequisite status;
- predicted availability;
- duplicate/equivalent-course conflicts;
- GE and major progress;
- residency and total-unit progress;
- workload warnings;
- downstream courses affected by the move.

Warnings do not hard-block planning. An override requires a short note such as “advisor-approved substitution” or “expect equivalent transfer credit.”

For a regular quarter:

- 12–20 units is the standard official range;
- fewer than 12 or more than 20 remains plannable, but shows “Dean authorization required”;
- a separate user preference may warn above 16 units without presenting 17–20 as prohibited.

For all of Summer:

- warn above 20 total units;
- warn above 12 units in a single session;
- split a 10-week course’s units evenly across Session 1 and Session 2 for load checking;
- treat an approved exception as a manual override;
- reject a total above the stated absolute 32-unit Summer ceiling.

### 4. Understand “why”

Opening a course shows a human-readable prerequisite tree. Example:

> Eligible for COMPSCI 112 in Winter 2028 because I&C SCI 46 is completed by Fall 2027 and MATH 3A is completed by Fall 2027.

An ineligible example:

> Not yet eligible. Complete I&C SCI 46 with C or better before this term, and complete either MATH 3A or I&C SCI 6N with C or better.

Restrictions appear separately:

> Prerequisites appear satisfied, but Computer Science and Engineering majors and ICS students receive first consideration for enrollment.

### 5. Audit degree progress

The right-side Degree Audit displays:

- UC requirements;
- UCI requirements;
- GE categories I–VIII;
- Computer Science lower division, upper core, four distinct focus areas, nine electives, and two project requirements;
- Pure Mathematics core, science sequence, Pure Mathematics additions, and five electives;
- Applied and Computational Mathematics core, required applied courses, Mathematics electives, and approved outside-Mathematics electives when that alternate path is selected;
- total units, residence, and GPA rules;
- change/add-major eligibility tasks when relevant.

Each requirement has one of five states:

- complete;
- in progress;
- planned;
- at risk;
- unmet.

Expanding a requirement shows the courses satisfying it, alternatives, minimum grade, overlap behavior, and source/cataloque year.

### 6. Compare scenarios

The MVP should support at least one working plan and one duplicate scenario. A later version may add unlimited named scenarios. Comparison should call out:

- graduation term;
- overloaded terms;
- unmet requirements;
- low-confidence course placements;
- Summer usage;
- elective differences.

One seeded comparison should support **Pure Mathematics versus Applied and Computational Mathematics** while keeping Computer Science fixed.

### 7. Save and recover

The plan automatically persists locally. The user can export and import a human-readable JSON backup containing:

- profile assumptions;
- catalogue year;
- external exams and their score-derived awards;
- course placements and grades;
- overrides and notes;
- requirement-allocation pins;
- app data version.

## Information architecture

### Persistent top bar

- plan name;
- catalogue year;
- start/graduation terms;
- scenario selector;
- global search shortcut;
- data “last refreshed” indicator;
- import/export and settings.

### Desktop layout

1. **Left: Course Explorer** — searchable/filterable course list.
2. **Center: Four-Year Board** — academic-year rows and term cards.
3. **Right: Degree Audit** — collapsible requirement groups.

The side rails can collapse so the board remains usable on a laptop.

### Mobile/tablet layout

Use three top-level views: **Courses**, **Plan**, and **Audit**. Do not attempt to compress all three desktop columns into one screen.

## MVP feature boundary

### Included

- versioned 2026–27 catalogue snapshot;
- all Catalogue courses;
- CS + Pure Mathematics + Applied and Computational Mathematics + GE/UC/UCI rules;
- exam-and-score AP entry plus IB/transfer/manual external credit;
- Incoming Summer 2026 plus a four-year term board with Summer session detail;
- prerequisite/corequisite/restriction evaluation;
- degree audit with allowed overlap;
- current departmental plans and historical offering estimates;
- local persistence and JSON backup;
- keyboard-accessible non-drag alternative;
- automated tests for critical audit rules.

### Explicitly deferred

- UCI login, StudentAccess, DegreeWorks, or WebReg integration;
- registration or automated advising submissions;
- multi-user collaboration;
- unofficial grade-distribution or professor-rating data;
- official transcript import;
- other majors/minors;
- automatic schedule generation by meeting time;
- phone-native apps.

### Good post-MVP additions

- section-level calendar and time-conflict detection;
- automatic “suggest next courses” recommendations;
- a visual prerequisite graph;
- recurring manual data-refresh command or scheduled snapshot build;
- print/PDF plan;
- unlimited scenarios and side-by-side comparison.

## Non-functional requirements

- The product must be clearly labeled “Unofficial planning aid.”
- No external transmission of plan data in the local-first MVP.
- Search should feel immediate with the full catalogue loaded.
- All data records must expose source URL, catalogue year, and retrieved date.
- Every automated audit result must be traceable to a rule and course.
- Core operations must work without drag-and-drop and without color being the only status signal.
- A data update must not silently reinterpret an older plan under a newer catalogue year.

## Suggested implementation shape

Keep the architecture framework-agnostic but favor:

- a TypeScript single-page web application or installable PWA;
- a build-time/server-side ingestion script that produces versioned normalized JSON;
- IndexedDB for plan persistence and fast local search;
- no required backend for MVP;
- a small optional server-side refresh service only if live WebSoc access is later desired.

## Build sequence for a coding agent

1. Define the normalized schemas in file 04.
2. Write source adapters, AP-award ingestion, and fixture-based parser tests.
3. Encode 2026–27 requirement rules as data, not UI conditionals.
4. Implement the prerequisite evaluator and requirement solver with unit tests.
5. Build the three-pane shell, Incoming Summer period, and term board.
6. Connect course search, placement, warnings, and audit recalculation.
7. Add local persistence and JSON import/export.
8. Add offering evidence and confidence labels.
9. Run every acceptance scenario in file 05.
