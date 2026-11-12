# Confirmed Profile and Remaining Decisions

This file is the implementation handoff for personal defaults. The confirmed answers below are requirements, not tentative suggestions.

## Confirmed student profile

- Entrance term: **Fall 2026**.
- Catalogue rights/default ruleset: **2026–27**.
- Entering major: **Computer Science, B.S.**
- Intended second major: **Mathematics**.
- Default Mathematics path: **Mathematics, B.S. — Pure Mathematics**.
- Alternate comparison path: **Applied and Computational Mathematics, B.S.**
- Pure Mathematics and Applied and Computational Mathematics may be compared in separate scenarios but cannot both be active in one scenario.
- First visible planning period: **Incoming Summer 2026**, before Fall 2026.
- Summer enrollment: enabled.
- Summer representation: Session 1, 10-week, and Session 2 inside each Summer card.
- Regular-quarter load: allow the full standard **12–20 unit** range.
- Outside 12–20 regular-quarter units: permit planning but warn that dean authorization is required.
- External credit: provide direct AP exam-and-score entry and apply official score-specific effects.
- Course explorer: retain every UCI department and every Catalogue course, even though only CS and the two Mathematics paths receive full major audits.

## Remaining questions for the first personal schedule

These do not block building the application shell or rules engine. They do affect which courses the first recommended four-year plan should contain.

### 1. Exact AP exams and scores

Please list every exam and score. The most consequential are:

- Calculus AB or BC;
- Computer Science A and/or Computer Science Principles;
- English Language and/or Literature;
- Statistics;
- Biology;
- Chemistry;
- Physics 1, 2, C: Mechanics, or C: Electricity and Magnetism;
- U.S. History;
- U.S. Government;
- a language exam;
- Research or Seminar.

Also list any IB, A-level, dual-enrollment, or community-college course, with grade and institution when known.

Why this matters: UCI’s effects differ sharply by exam and score. For example, AP Calculus BC 4–5 can clear MATH 2A–2B, AP Computer Science A is elective credit only, and AP Statistics does not clear STATS 67.

### 2. Preferred regular-quarter intensity

The legal standard range is already fixed at 12–20 units. Choose a planning preference:

- balanced: target about 16 units and use Summer to reduce bottlenecks;
- aggressive: routinely use up to 20 units;
- adaptive: target 16, but use 20 when the prerequisite chain or course cadence makes it useful.

Recommended default: **adaptive**.

### 3. Preferred Summer intensity

Choose a default:

- one course at a time;
- up to two courses when their sessions/workloads fit;
- use the maximum normal load when it accelerates graduation.

Recommended default: **up to two courses, avoiding two overlapping compressed technical courses**.

### 4. Graduation target

Should the primary plan end in:

- Spring 2030;
- an earlier term if AP credit makes it realistic;
- Summer 2030 if that produces a safer workload?

Recommended default: **Spring 2030**, while showing an earlier-completion scenario if the entered AP credit supports it.

### 5. Pure Mathematics science sequence

The Pure Mathematics B.S. requires one complete path:

1. CHEM 1A, 1B, 1C;
2. PHYSICS 7C, 7D, 7E;
3. STATS 7, MATH 10, PHYSICS 7C.

The planner can compare them automatically after AP credit is entered. Recommended behavior: select the path that maximizes valid CS/GE overlap and minimizes duplicated external credit, then let you override it.

## Product preferences that can wait

### Current sections

Should the first version show exact meeting times, instructors, and open/waitlist/full status, or begin with course-level quarter availability?

Recommended: course-level availability first; section schedule building second.

### Storage

Should it remain local-only with JSON backup, or eventually sync privately across devices?

Recommended MVP: local-only.

### CS interests

Rank any that should influence elective suggestions:

- Vision and Graphics;
- Information Management;
- Networks and Cybersecurity;
- Systems and Software;
- Architecture and Embedded Systems;
- Algorithms;
- Artificial Intelligence and Machine Learning.

Default until answered: AI/ML and Algorithms.

### Mathematics interests

Choose any that should influence electives:

- analysis or topology;
- algebra;
- probability or stochastic processes;
- number theory or cryptology;
- combinatorics;
- differential equations or PDEs;
- optimization or numerical analysis;
- geometry;
- logic;
- mathematical finance;
- mathematical machine learning.

Default until answered: algebra, analysis, probability, and number theory.

### Scenarios

The first build will support a primary plan plus one duplicate comparison. Useful seeded comparisons are:

- Pure Mathematics versus Applied and Computational Mathematics;
- balanced versus aggressive load;
- one Pure Mathematics science sequence versus another;
- Summer-heavy versus Summer-light.

Recommended first comparison: **Pure Mathematics versus Applied and Computational Mathematics**, with CS fixed in both.

## Defaults a coding agent may use immediately

- Start: Incoming Summer 2026.
- Primary range: Incoming Summer 2026 through Spring 2030.
- Catalogue: 2026–27.
- Programs: Computer Science + Pure Mathematics.
- Alternate scenario: Computer Science + Applied and Computational Mathematics.
- Regular-quarter preference: adaptive 16-unit target, up to 20 normally.
- Summer preference: enabled, up to two courses when sessions and workload fit.
- External-credit setup: AP exam and score table shown during onboarding.
- Data storage: local browser database plus versioned JSON import/export.
- Course availability: official published data first, then department plan, then explicitly labeled historical inference.

No schedule should be presented as personally optimized until the exact external-credit list is entered.
