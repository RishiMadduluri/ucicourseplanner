# UI/UX Specification and Acceptance Criteria

## Reference-site lessons

The McGill AcaMapa reference uses several useful patterns:

- always-visible course search;
- compact course cards with credits and official links;
- program and plan-stat panels;
- term cards with credit totals;
- courses moved into terms;
- selectable program audits.

For UCI, retain those strengths but improve:

- true Fall/Winter/Spring/Summer academic-year grouping;
- explicit prerequisite explanations;
- restrictions separated from prerequisites;
- catalogue-year versioning;
- multiple requirement badges for shared CS/Math/GE courses;
- confidence labels for future offerings;
- an always-visible degree-audit rail;
- accessible actions that do not depend on drag-and-drop.

## Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ZotPath | Plan | Catalogue 2026–27 | Scenario | Data status | Export       │
├───────────────────┬──────────────────────────────────┬───────────────────────┤
│ COURSE EXPLORER   │ FOUR-YEAR PLAN                   │ DEGREE AUDIT          │
│ Search            │ Incoming Summer 2026            │ Overall               │
│ Filters           │ Year 1: F26 | W27 | S27 | Su27  │ UC/UCI                │
│                   │ Year 2: F27 | W28 | S28 | Su28  │ GE I–VIII              │
│ Course cards      │ Year 3: F28 | W29 | S29 | Su29  │ Computer Science      │
│                   │ Year 4: F29 | W30 | S30          │ Mathematics           │
│                   │                                  │ Eligibility/tasks     │
└───────────────────┴──────────────────────────────────┴───────────────────────┘
```

Recommended behavior:

- left and right panels are resizable/collapsible;
- the center board scrolls vertically by academic year, not horizontally across 16 equal-width columns;
- Incoming Summer 2026 is a distinct pre-Year-1 card rather than the Summer at the end of Year 1;
- each academic-year row contains four term cards;
- Summer contains compact Session 1, 10-week, and Session 2 lanes and can collapse when unused;
- the selected course opens a detail drawer without losing board position.

## Term card

Header:

- term and year;
- total units;
- course count;
- regular-quarter official-range state or Summer total/session load state;
- published/tentative data state;
- overflow menu.

Course chip/card:

- course code and title;
- units;
- status icon and text;
- requirement badges such as `CS Core`, `Math`, `GE Vb`;
- prerequisite icon;
- offering-confidence icon;
- drag handle;
- accessible move/remove menu.

Footer:

- Add course;
- workload summary;
- unresolved warning count.

## Course details

Use clear sections:

1. Summary and official Catalogue link.
2. Description and units.
3. Prerequisites — parsed expression plus original source text.
4. Corequisites/concurrent requirements.
5. Restrictions/first consideration.
6. Requirements this course can satisfy.
7. Offering evidence by quarter and year.
8. Same-as/overlap/repeatability.
9. Add/move action.

## Degree Audit rail

Top summary:

- projected completion percentage;
- projected units;
- projected graduation term;
- high-risk issue count.

Groups:

- UC Requirements;
- UCI Degree Requirements;
- GE I–VIII;
- Computer Science;
- Mathematics;
- Add/Double-Major Eligibility;
- Adviser Confirmations.

Each group has:

- progress fraction or units;
- state icon plus text;
- expandable child rules;
- satisfying course(s);
- source year/link;
- “pin allocation” or “add one of these courses” action.

Do not reduce audit status to one percentage. A projected 95% plan with one impossible prerequisite bottleneck still needs a visible risk state.

## Status language and color

Use icons/text in addition to color:

- Complete — green check.
- In progress — blue progress circle.
- Planned — neutral/blue calendar.
- At risk — amber triangle.
- Unmet — gray empty circle.
- Error/conflict — red octagon.
- Unknown/needs verification — purple question mark.

Offering labels:

- Published;
- Department planned — tentative;
- Historically likely;
- Historically possible;
- Not recently observed;
- Unknown.

## Required interactions

- Search results update as text/filters change.
- Clicking a GE or requirement badge filters the Explorer to matching courses.
- “Eligible by Winter 2028” evaluates the plan as it exists before that term.
- Moving a prerequisite later updates all dependent-course warnings.
- A warning links directly to the missing course/rule.
- Clicking “Add a course that satisfies this” opens a pre-filtered Explorer.
- A completed course can record grade/equivalency.
- AP credit is entered by exam and score, with its official effects previewed before saving.
- IB/transfer/manual external credit can be entered without inventing a UCI term.
- Settings can switch the Mathematics audit between Pure Mathematics and Applied and Computational Mathematics, after explaining that they cannot both be active.
- Undo restores the previous placement.
- Export produces a local JSON file; import previews changes.

## Accessibility

- Full keyboard navigation.
- Every drag action has a menu/button equivalent.
- Visible focus styles.
- Semantic headings, regions, lists, buttons, and progress labels.
- Status is never color-only.
- Tooltips are also available by focus/click.
- Course-code typography remains readable at 200% zoom.
- Mobile controls have appropriate touch targets.
- Reduced-motion preference disables animated reordering.

## Empty and error states

Examples:

- No courses in a term: “Add courses from the Explorer.”
- No search matches: show active filters and a one-click reset.
- Data source failed: keep the last good snapshot and show its date.
- Prerequisite parser uncertain: show raw text and “Needs manual review.”
- Future offering unknown: do not show a red error; suggest checking later.
- Requirement allocation ambiguous: show both valid choices and let the user pin one.

## Acceptance criteria

### Catalogue coverage

1. The ingestion report shows every department link found on the selected All Courses index.
2. Every parsed `.courseblock` becomes a searchable course or a recorded parser error.
3. Graduate/professional courses are indexed but hidden by default.
4. A course result links to its official source and shows catalogue year.

### Search and details

5. Searching `COMPSCI 112`, `CS 112`, or title words finds the same official course.
6. Filtering by GE, department, level, units, and selected-term eligibility works in combination.
7. COMPSCI 112 shows the current prerequisite alternatives and first-consideration restriction separately.
8. Raw prerequisite text remains visible.

### Planner

9. A new plan creates the requested Fall through Summer terms.
10. Adding a course updates term units immediately.
11. Moving a course preserves status/notes and recalculates dependent warnings.
12. Adding the same non-repeatable course twice creates a duplicate warning.
13. Summer Session 1, 10-week, and Session 2 can be represented without showing three separate year columns.
14. The user can perform every course move without dragging.

### Prerequisites

15. A prerequisite in an earlier term satisfies the relevant node.
16. A prerequisite planned in the same term does not satisfy a “prerequisite” node but may satisfy a corequisite/concurrent node.
17. Minimum-grade rules use recorded grades.
18. Missing grades produce conditional/unknown status where appropriate.
19. AND/OR explanations name every missing branch.
20. Moving MATH 3A later than COMPSCI 112 creates a clear warning.

### GE and UCI rules

21. GE displays I–VIII with correct course counts and Va/Vb structure.
22. One course may not fill both Va and Vb.
23. An approved course can fill GE and a major rule simultaneously.
24. I&C SCI 139W can fill CS core and GE upper-division writing under the selected year’s designation.
25. The audit tracks 180 units, GPA categories, and residence separately.
26. Unknown future modality prevents a false residence checkmark.

### Computer Science

27. Both allowed programming-series paths are supported.
28. MATH 3A can satisfy the CS linear-algebra alternative and the Mathematics requirement.
29. Four Flexible Core courses from only three focus areas remain incomplete.
30. Four courses from four distinct areas complete the Flexible Core.
31. A course used in Flexible Core cannot also fill a CS elective slot unless an explicit exception allows it.
32. COMPSCI 145 may fill one Flexible Core and one Project slot.
33. Project and nine-elective counts are independently correct.

### Mathematics

34. Core A requires every named course.
35. The science sequence accepts only one complete official three-course path.
36. MATH 2E, 120B, 121B, and 147 appear in Pure Mathematics additions.
37. Only eligible four-unit MATH 100–189 lecture courses fill the five additional-elective slots.
38. Required named Mathematics courses are not silently reused as additional electives.

### Double-major behavior

39. MATH 2A, 2B, and 3A visibly satisfy both majors where applicable.
40. Eligible Physical Sciences courses can also satisfy CS science and Mathematics science-sequence nodes when the selected GE year permits it.
41. The audit includes ICS and Physical Sciences add/double-major eligibility checks.
42. The app never claims that completing the checklist guarantees admission to a second major.

### Offerings

43. Exact WebSoc evidence displays as Published.
44. Department teaching-plan evidence displays as Tentative.
45. Historical inference never displays as Published or guaranteed.
46. A blank department-plan cell does not permanently disable the course.
47. Every prediction shows its evidence years/source.
48. Summer predictions preserve session-level evidence.

### Persistence and migration

49. Reloading restores the plan locally.
50. Export/import round-trips course placement, grades, external credit, overrides, and pinned allocations.
51. Opening a plan against a new data build presents a diff before changing its interpretation.

### Confirmed timeline and course loads

52. A new default plan starts with Incoming Summer 2026, followed by Fall 2026, Winter 2027, and Spring 2027.
53. Incoming Summer and later Summers expose Session 1, 10-week, and Session 2 without requiring three full-width board columns.
54. A regular-quarter total from 12 through 20 units is not labeled administratively invalid.
55. A regular-quarter total below 12 or above 20 warns that dean authorization is required but remains editable.
56. Summer load checking enforces 20 units total and normally 12 units in a session, with 10-week units divided across both sessions.
57. A Summer total above 32 units is invalid even when an override is entered.

### AP credit

58. Setup can record each AP exam, score, and exam year and preview units, equivalence, GE/UC effects, prerequisite effects, and duplicates.
59. AP Calculus BC score 4 or 5 can satisfy MATH 2A and MATH 2B under the 2026–27 rule.
60. AP Computer Science A produces elective units but does not satisfy I&C SCI 31, 32, or 33.
61. AP Computer Science Principles can produce the I&C SCI 20 award but does not silently substitute for the CS major programming series.
62. AP Statistics may satisfy STATS 7 but never STATS 67 under the official mapping.
63. A UCI course that duplicates an exam award creates a duplicate-credit warning, and the exam never receives a fabricated grade.

### Applied and Computational Mathematics alternate

64. Pure Mathematics is selected by default.
65. Selecting Applied and Computational Mathematics replaces, rather than adds to, the Pure Mathematics audit.
66. The Applied audit correctly evaluates all core courses, three additional lower-division courses, MATH 112A/112B/115, three Mathematics electives, and two approved outside-Mathematics upper-division electives.
67. An unlisted outside-Mathematics course requires a visible adviser-approved substitution before it counts.

## Definition of done

The MVP is done when:

- all 67 acceptance criteria pass or have documented, approved exceptions;
- parser errors are summarized rather than silently ignored;
- the 2026–27 AP, CS, Pure Mathematics, Applied and Computational Mathematics, and GE fixtures have rule-level tests;
- the app is usable with keyboard only;
- the UI clearly distinguishes official data, tentative plans, historical inference, and manual overrides;
- a fresh user can create, save, export, and restore a complete four-year scenario.
