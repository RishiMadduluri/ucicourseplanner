# Data Sources, Ingestion, and Offering Predictions

## Source hierarchy

When sources disagree, use this order:

1. the selected official UCI Catalogue year for degree rules, course descriptions, prerequisites, units, restrictions, and GE designations;
2. the Registrar’s published Schedule of Classes for an actual term;
3. a department’s current tentative teaching plan;
4. historical Schedule of Classes observations;
5. a model-generated inference.

Never replace a higher-authority value with a lower-authority guess. Store both when they describe different concepts, such as “catalogue course exists” and “course is scheduled this quarter.”

## Source register

| Source | Use | Refresh | Important limitation |
|---|---|---|---|
| [UCI Catalogue home](https://catalogue.uci.edu/) | Edition metadata | At least annually | Current site changes editions |
| [All Courses](https://catalogue.uci.edu/allcourses/) | Department index and all catalogue courses | At least annually | Existence does not imply a term offering |
| [Bachelor’s requirements](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/) | UC, UCI, GE, residence, GPA | At least annually | Requirements depend on catalogue rights |
| [CS B.S.](https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/) | CS audit | At least annually | Elective/focus lists can change |
| [Mathematics B.S.](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/mathematics_bs/) | Pure Mathematics audit | At least annually | Track/specialization rules differ |
| [Applied and Computational Mathematics B.S.](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/appliedandcomputationalmathematics_bs/) | Alternate Applied Mathematics audit | At least annually | Cannot be active with Mathematics B.S. |
| [AP and IB Credit](https://catalogue.uci.edu/informationforprospectivestudents/undergraduateadmissions/#advancedplacementandinternationalbaccalaureatecredittext) | Score-specific external-credit awards | At least annually | Duplicate-credit rules require exact mappings |
| [Academic Regulations](https://catalogue.uci.edu/informationforadmittedstudents/academicregulationsandprocedures/) | Regular-quarter course-load limits | At least annually | Outside-range plans may need authorization |
| [Summer Academic Information](https://summer.uci.edu/academic-information/) | Session dates and Summer load limits | Before each Summer | Dates and policies can change |
| [WebSoc](https://www.reg.uci.edu/perl/WebSoc) | Published sections and historical offerings | Before each term and periodic manual refresh | Sections can change or cancel |
| [ICS offerings](https://courselisting.ics.uci.edu/ugrad_courses/) | Current/future tentative ICS plan and history by year | Monthly during planning season | Explicitly not guaranteed |
| [Mathematics offerings](https://www.math.uci.edu/undergrad-courses/plan-math-course-offerings) | Current tentative Mathematics plan and cadence notes | Monthly during planning season | Explicitly subject to change/cancellation |
| [ICS add-major rules](https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/) | CS eligibility checklist | Each quarter | Capacity and policy can change |
| [Physical Sciences rules](https://changeofmajor.uci.edu/school-of-physical-sciences/) | Mathematics eligibility checklist | Each quarter | Double-major cases require adviser review |
| [2025–26 Catalogue PDF](https://catalogue.uci.edu/pdf/UCI%20Full%20CAT%202025-26.pdf) | Archived alternate ruleset | Immutable archive | Use only when 2025–26 rights apply |

Every imported record must contain `sourceUrl`, `retrievedAt`, `catalogueYear` or `term`, and a hash/version of the source snapshot.

## Catalogue ingestion

### Department index

The All Courses page links to department pages such as:

- `/allcourses/compsci/`
- `/allcourses/i_c_sci/`
- `/allcourses/math/`
- `/allcourses/writing/`

Do not maintain a hand-written department list. Parse the index each time so renamed and new departments appear automatically.

### Course block fields

Current course pages expose structured classes including:

- `courseblock`
- `detail-code`
- `detail-title`
- `detail-hours_html`
- `detail-prereqs`
- `detail-coreqs`
- `detail-concurrent`
- `detail-restrictions`
- `detail-same_as`
- `detail-overlaps_with`
- `detail-repeatability`
- `detail-grading_option`

Capture:

- raw code and normalized code;
- title;
- unit minimum/maximum or variable units;
- description;
- raw prerequisites;
- raw corequisites and concurrent-enrollment rules;
- recommended preparation separately;
- restrictions/first consideration;
- same-as, overlap, and cross-list relationships;
- repeatability;
- grading options;
- level inferred from the numeric component but overridable;
- official URL and catalogue year.

Retain the raw human text even when parsing succeeds. A parser error must reduce confidence, not discard the rule.

### Course identity

Use an internal stable ID scoped to catalogue year. Normalize spacing and aliases for matching:

- `I&C SCI 31` and `ICS 31` may be display aliases but must map to the official catalogue code;
- `COMPSCI 161` and the ICS teaching-plan abbreviation `CS 161` must map to the same course;
- `IN4MATX 131` and teaching-plan `INF 131` must map;
- sequences such as `MATH 2A-2B` expand into individual courses;
- combined lab notation such as `MATH 105A/105LA` creates two related records.

Never destroy the source spelling.

## AP and IB award ingestion

Do not store AP as an unstructured note. Import each official score row into a versioned award table:

```text
exam system
official exam name
minimum and maximum score
UCI units
course-equivalence/exemption options
GE category effects
UC/UCI requirement effects
prerequisite effects
elective-only flag
duplicate-credit relationships
source URL, catalogue year, and retrieval date
```

An exam may have more than one possible equivalent, such as AP Calculus using the MATH 2 or MATH 5 sequence. Preserve that as an official alternative and let the active program determine the useful path. An elective-only award never satisfies a course prerequisite.

The importer must test boundary scores and multi-exam rules, including the combined cap/effect for both AP English exams. IB and A-level mappings can use the same schema even if they are populated later.

Use `07_AP_CREDIT_MAPPING_2026_27.md` as the reviewed human-readable seed reference and the official page snapshot as the machine-ingestion authority.

## WebSoc ingestion

WebSoc currently exposes historical and current terms in one public form. The form submits to:

`https://www.reg.uci.edu/perl/WebSoc`

Relevant form fields observed in July 2026 include:

- `YearTerm`
- `Dept`
- `CourseNum`
- `Division`
- `Breadth`
- `CourseCodes`
- `CourseTitle`
- `ClassType`
- `Units`
- `Modality`
- `Days`
- `StartTime`
- `EndTime`
- `FullCourses`
- `CancelledCourses`
- `Submit=Display Text Results`

Implementation guidance:

- fetch in a controlled build/update script, not from every user keystroke;
- cache raw snapshots and parse fixtures in tests;
- query by term and department rather than issuing one giant request;
- use a conservative rate and clear user agent;
- do not treat an empty result as proof the course will never be offered;
- preserve Summer Session 1, 10-week, and Session 2 separately even if the UI groups them under Summer;
- distinguish lecture, discussion, lab, and linked enrollment components;
- retain status, section code, instructor, meeting time, modality, capacity, and cancellation state when available.

## Incoming Summer 2026 modeling

Create a distinct pre-Year-1 Summer period with:

- Session 1: June 22–July 29, 2026;
- 10-week: June 22–August 28, 2026;
- Session 2: August 3–September 9, 2026.

Store the section’s real session, not just `Summer 2026`. Load validation uses 20 units total and 12 units per session. A 10-week course contributes half its units to each session for that validation. The data record should also preserve incoming-student or program restrictions because “scheduled” does not imply an incoming student can enroll.

## Department teaching plans

### Mathematics 2026–27

The Mathematics page was last marked updated May 14, 2026 and explicitly calls the plan tentative.

Key Pure Mathematics courses:

| Course | Fall | Winter | Spring | Notes |
|---|---:|---:|---:|---|
| MATH 2A, 2B, 2D, 2E, 3A, 3D, 9, 13 | Yes | Yes | Yes | High flexibility |
| MATH 120A, 120B | Yes | Yes | Yes | |
| MATH 121A, 121B | Yes | Yes | Yes | |
| MATH 130A | Yes | Yes | Yes | |
| MATH 140A, 140B | Yes | Yes | Yes | |
| MATH 147 | Yes | Yes | Yes | |
| MATH 105A/105LA | Yes | No | No | |
| MATH 110A | No | Yes | No | |
| MATH 110B | No | No | Yes | |
| MATH 112A | Yes | No | No | |
| MATH 112B | No | Yes | No | |
| MATH 112C | No | No | Yes in listed cadence | Every-other-year note |
| MATH 120C | No | No | Spring 2027 | Listed S25/S27 cadence |
| MATH 130B | Yes | Yes | Yes | |
| MATH 130C | No | No | Yes | |
| MATH 140C | No | No | Yes | |
| MATH 141 | No | No | Yes | |
| MATH 150 | Yes | No | No | |
| MATH 161 | No | No | Yes | |
| MATH 162A | No | Yes | No | |
| MATH 162B | No | No | Tentative Spring 2027 | |
| MATH 173A, 173B, 175 | Summer only | Summer only | Summer only | Keep Summer evidence distinct |
| MATH 178 | No | Yes | No | |
| MATH 180A | No | Yes | No | |
| MATH 180B | No | No | Spring 2027 | Listed S25/S27 cadence |
| MATH 195W | No | No | No | Expected back 2027–28 |

The full source table, not only this subset, should be imported.

### ICS 2026–27

The ICS plan contains Fall 2026, Winter 2027, Spring 2027, and Summer 2027 columns and covers CS, CSE, DATA, GDIM, ICS, Informatics, Statistics, and SWE. It is explicitly tentative.

Examples that influence the required CS path:

- ICS 31, 32, 33, 45C, 46, and 51 are planned in all three regular quarters.
- ICS 53 is planned Fall and Winter.
- ICS 6B and 6D are planned in all three regular quarters.
- ICS 6N is currently planned Winter.
- STATS 67 is planned in all three regular quarters.
- SWE 43 is planned in all three regular quarters.
- ICS 139W is planned in all three regular quarters.
- CS 161 is planned in all three regular quarters.

Import the full table, including `TENTATIVE`, `TBD`, `CANCELED`, instructor, and multiple-section annotations. A blank cell means “not present in this tentative plan,” not “impossible.”

## Offering evidence model

Each course/term pair has one or more evidence records:

```text
scheduled          Published in WebSoc for that exact term
department_plan    Present in a current tentative department plan
historical         Observed in an older WebSoc or teaching-plan snapshot
cadence_note       Explicit annual/every-other-year/Summer-only note
inferred           Generated from historical observations
unknown            Insufficient data
```

The UI label always includes the evidence type. Do not convert “department planned” into “scheduled.”

## Historical prediction

Use prediction only when the exact future term is not scheduled or department-planned.

### Baseline

For each course and season (Fall/Winter/Spring/Summer):

1. collect the four most recent comparable academic years;
2. mark `1` if at least one non-cancelled section was offered, otherwise `0`;
3. apply recency weights `0.40, 0.30, 0.20, 0.10`;
4. compute a seasonal score from 0 to 1;
5. reduce confidence if the course was renumbered, newly created, or has fewer than two comparable years.

Suggested labels:

| Score | Label |
|---:|---|
| 0.75–1.00 | Historically likely |
| 0.40–0.74 | Historically possible |
| 0.15–0.39 | Historically uncommon |
| 0.00–0.14 | Not recently observed |
| Insufficient evidence | Unknown |

### Overrides and cadence

- Exact published WebSoc data overrides inference.
- A current department plan overrides inference but remains “tentative.”
- An explicit every-other-year note uses the documented parity instead of the baseline.
- “Summer only” is a strong season rule until contradicted by newer official data.
- A new course without history is “unknown,” not “unlikely.”
- A renamed/replaced course may inherit history only through an explicit equivalency mapping.

### Planner behavior

- High-confidence placement: no warning.
- Tentative/possible placement: informational badge.
- Uncommon/not observed: warning with suggested quarters.
- Unknown: neutral uncertainty badge.
- Any future placement: tooltip states that offerings are not guaranteed.

## Refresh and reproducibility

The data pipeline should produce:

```text
data/
  raw/<source>/<retrieval-date>/...
  normalized/catalogue/2026-27/courses.json
  normalized/catalogue/2026-27/ge.json
  normalized/external-credit/2026-27/ap-awards.json
  normalized/requirements/2026-27/*.json
  normalized/offerings/<academic-year>/*.json
  manifests/<build-id>.json
```

A plan stores the manifest/build ID it last used. On data update:

1. calculate differences;
2. show courses/rules that changed;
3. preserve the old interpretation;
4. let the user accept a migration after review.
