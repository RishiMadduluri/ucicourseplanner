# UCI Requirements Research — 2026–27

Research date: July 24, 2026.

## Authority and catalogue rights

UCI identifies four groups of bachelor’s-degree requirements: general UC requirements, UCI requirements including GE, school/program requirements, and degree-specific requirements.

For a student enrolled from freshman year, UCI says the student may generally elect the graduation requirements in effect at entrance or requirements established later. Therefore:

- every plan has a selected `catalogueYear`;
- requirements and GE designations are loaded from that year;
- changing the year is an explicit migration preview, not a silent update;
- the 2025–26 PDF supplied by the user should become a second ruleset if 2025–26 is the correct entrance year.

Source: [Requirements for a Bachelor’s Degree — Catalogue Rights](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/)

## University of California requirements

### Entry Level Writing Requirement

The app tracks ELWR as a separately satisfied requirement. The official page lists several pre-entry methods, including qualifying AP/IB/SAT/ACT results and a transferable English composition course. A student who enters without ELWR must satisfy it before the beginning of the fourth UCI quarter or becomes ineligible to enroll for a fourth quarter.

Because score and placement rules are detailed and may change, model ELWR as:

- `satisfied`;
- `not_satisfied`;
- `unknown_needs_input`;
- `in_progress`;
- `waived_or_external_evidence`.

Store the evidence rather than trying to infer it only from planned UCI courses.

### American History and Institutions

Track American History and Institutions separately. Common fulfillment methods include qualifying high-school coursework, AP/IB/SAT evidence, certification from another California institution, or approved college coursework. The current Catalogue identifies:

- U.S. History: HISTORY 40A, 40B, 40C;
- U.S. Government: qualifying AP U.S. Government and Politics or POL SCI 21A.

The requirement may already be satisfied before UCI, so setup must ask for it.

Source: [University Requirements](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#universityrequirementstext)

## Advanced Placement credit

Source: [AP and IB Credit — 2026–27](https://catalogue.uci.edu/informationforprospectivestudents/undergraduateadmissions/#advancedplacementandinternationalbaccalaureatecredittext)

The planner must ask for the AP exam and score, then apply the corresponding row of the official table. An AP record can independently produce:

- UCI units;
- exact course equivalence or exemption;
- GE credit;
- ELWR or American History and Institutions fulfillment;
- prerequisite clearance;
- elective-only credit.

The official duplicate-credit rule is essential: AP, IB, and college courses may duplicate, but credit is awarded only once. A student may not earn units or grade points in a UCI course from which AP or IB credit has exempted them. The planner must warn before adding a duplicative UCI course and must not assign an artificial letter grade to exam credit.

High-impact mappings for this CS + Mathematics planner include:

| AP exam and score | Units | Official effect |
|---|---:|---|
| Calculus AB, 3–5 | 4 | MATH 2A or MATH 5A |
| Calculus BC, 3 | 8 | MATH 2A or MATH 5A |
| Calculus BC, 4–5 | 8 | MATH 2A–2B or MATH 5A–5B |
| Computer Science A, 3–5 | 8 | Elective units only; does not clear I&C SCI 31–33 |
| Computer Science Principles, 3–5 | 8 | I&C SCI 20 |
| Statistics, 3–5 | 4 | STATS 7, STATS 8, SOCECOL 13, or EDUC 15; not STATS 67 |
| English Language or Literature, 3 | 8 | Elective units and ELWR |
| One English exam, 4–5 | 8 | WRITING 50 plus one English course toward GE IV |
| Both English exams, 4–5 | 8 total | WRITING 50 plus two English courses toward GE IV |
| Chemistry, 4–5 | 8 | CHEM 1A or ENGR 1A plus four elective units |
| U.S. Government, 4–5 | 4 | American Institutions plus POL SCI 21A |
| U.S. History, 3–4 | 8 | American History and Institutions |
| Biology, 3–5 | 8 | One Biological Sciences course toward GE II for a non-Biological Sciences major |

The complete human-readable seed table is preserved in `07_AP_CREDIT_MAPPING_2026_27.md`. In particular, AP Physics awards do not automatically map to the PHYSICS 7 sequence required in many STEM plans.

## UCI-wide requirements

### Units

- Minimum 180 quarter units.
- A typical course is four quarter units.

### GPA

Minimum 2.0:

- overall;
- across courses required for the major;
- across upper-division courses required for the major.

For two majors, display a separate major GPA and upper-division major GPA for CS and Mathematics, plus the overall GPA.

### Residence

- At least 36 of the final 45 units must be earned in residence at UCI, subject to listed exceptions.
- At least 50 percent of total UCI units before graduation must be through courses not designated online or mixed modality, unless the degree program has an exception.

The planner cannot know future modality reliably. It should display the rule and evaluate it only when modality/equivalency data is known; otherwise mark it “needs verification.”

### Major declaration and grade basis

- Students must declare a major by junior status, defined on the official page as 90 units excluding college work completed before high-school graduation.
- Unless a course is P/NP-only or the dean authorizes it, P/NP courses may not satisfy specific school/major course requirements.

Source: [UCI Requirements](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#ucirequirementstext) and [School, Departmental, and Major Requirements](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#schooldepartmentalandmajorrequirementstext)

### Regular-quarter and Summer course loads

For a regular quarter, an undergraduate may enroll in as few as 12 or as many as 20 units. Fewer than 12 or more than 20 requires authorization from the student’s dean. Therefore the app warns but does not hard-block an outside-range plan.

For Summer 2026:

- Session 1 is June 22–July 29;
- the 10-week session is June 22–August 28;
- Session 2 is August 3–September 9;
- the normal maximum is 20 units for all of Summer and 12 units in any one session;
- a 10-week course is split evenly between Session 1 and Session 2 when calculating session load;
- exceptions need the appropriate approval;
- no approval can permit more than 32 total units for the full Summer.

Incoming Summer 2026 must appear before Fall 2026. Course eligibility may still depend on the incoming-student program and course restrictions, so placement is allowed with a verification warning when necessary.

Sources: [Academic Regulations and Procedures](https://catalogue.uci.edu/informationforadmittedstudents/academicregulationsandprocedures/) and [Summer Session Academic Information](https://summer.uci.edu/academic-information/)

## General Education

GE course eligibility is academic-year-specific. The app must import the approved list for the selected catalogue year and retain the year in each designation.

| Category | Requirement |
|---|---|
| I. Writing | Two lower-division writing courses plus one upper-division writing course |
| II. Science and Technology | Three courses |
| III. Social and Behavioral Sciences | Three courses |
| IV. Arts and Humanities | Three courses |
| V. Quantitative, Symbolic, and Computational Reasoning | Three courses total: at least one Va and at least one Vb; the third may be either |
| VI. Language Other Than English | Demonstrated competency, commonly one course equivalent to the third quarter, or approved external evidence |
| VII. Multicultural Studies | One course |
| VIII. International/Global Issues | One course |

### Writing details

- Lower division: two approved courses beyond ELWR.
- Current common route: WRITING 50 and WRITING 60.
- Current alternatives include the approved WRITING 45 route, Humanities Core combinations, and the conditional creative-writing substitution described in the Catalogue.
- Lower-division courses require C- or better, or equivalent Pass/Credit.
- The lower-division requirement must be completed before the beginning of the seventh UCI quarter to avoid academic notice.
- Upper-division writing must follow completion of lower-division writing and requires C- or better.
- Students enrolled at UCI may use only UCI courses for UCI lower- and upper-division writing; the page specifically warns that continuing UCI students may not use another institution’s Summer course for those requirements.
- An approved upper-division course offered without its required `W` suffix does not satisfy the requirement.
- I&C SCI 139W is a CS major core and can satisfy the upper-division writing requirement when it retains the approved designation.

### GE overlap rules to encode

- A Category V course may simultaneously satisfy another GE category.
- A course approved for both Va and Vb may only be used for one of those two subcategories.
- Categories VII and VIII are designed to overlap with other approved GE categories.
- Major/school courses may also satisfy GE when the catalogue permits it.
- Because UCI warns students to understand program-specific overlap limits, automated allocation must remain inspectable and manually pinnable.

Source: [General Education Requirement](https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#generaleducationrequirementtext)

## Computer Science, B.S.

Source: [Computer Science, B.S. — 2026–27](https://catalogue.uci.edu/donaldbrenschoolofinformationandcomputersciences/departmentofcomputerscience/computerscience_bs/#requirementstext)

### Lower division

#### Programming series — choose one

- I&C SCI 31, 32, 33; or
- I&C SCI H32, 33.

#### Complete all

- I&C SCI 45C
- I&C SCI 46
- I&C SCI 51
- I&C SCI 53
- SWE 43
- MATH 2A
- MATH 2B
- I&C SCI 6B
- I&C SCI 6D
- I&C SCI 6N **or** MATH 3A
- STATS 67

#### Science

Two GE Category II courses, excluding courses offered by:

- the School of Engineering;
- the School of Information and Computer Sciences;
- the Department of Economics;
- the Department of Mathematics.

The current Catalogue notes that University Studies courses require approval from the CS Vice Chair for Undergraduate Studies.

### Upper division — sections A through D

The Catalogue labels this as 17 courses. Courses used in one section do not apply to another, except COMPSCI 145 may apply to both the Flexible Core and Project sections.

#### A. Core — two

- COMPSCI 161
- I&C SCI 139W

#### B. Flexible Core — four courses from four distinct focus areas

| Focus area | Eligible courses |
|---|---|
| FA1 Vision and Graphics | COMPSCI 112, 116 |
| FA2 Information Management | COMPSCI 121, 122A |
| FA3 Networks and Cybersecurity | COMPSCI 130, 132, 134 |
| FA4 Systems and Software | COMPSCI 141, 142A, 143A |
| FA5 Architecture and Embedded Systems | COMPSCI 145, 151, 152 |
| FA6 Algorithms | COMPSCI 162, 163, 164, 167 |
| FA7 Artificial Intelligence and ML | COMPSCI 171, 178, 184A |

The audit must count distinct focus areas, not merely four list courses.

#### C. Upper-division electives — nine

- COMPSCI 103–189;
- SWE 113, 115, 117, 121, 122, 124;
- IN4MATX 131, 133, 134.

Courses already consumed by another CS section do not count here unless an explicit exception exists.

#### D. Project courses — two

- COMPSCI 114
- COMPSCI 117
- COMPSCI 118
- COMPSCI 122B
- COMPSCI 122C
- COMPSCI 122D
- COMPSCI 125
- COMPSCI 133
- COMPSCI 142B
- COMPSCI 143B
- COMPSCI 145
- COMPSCI 147
- COMPSCI 154
- COMPSCI 165
- COMPSCI 175
- COMPSCI 180A
- COMPSCI 180B
- COMPSCI 189
- SWE 117
- IN4MATX 134

COMPSCI 180A and 180B both must be completed and passed to receive course credit. Encode that relationship explicitly.

## Mathematics, B.S. — Pure Mathematics

Source: [Mathematics, B.S. — 2026–27](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/mathematics_bs/#requirementstext)

### Core A — complete all

- MATH 2A
- MATH 2B
- MATH 2D
- MATH 3A
- MATH 3D
- MATH 9
- MATH 13
- MATH 120A
- MATH 121A
- MATH 130A
- MATH 140A
- MATH 140B

### Core B — choose one three-course lecture sequence

1. CHEM 1A, 1B, 1C; or
2. PHYSICS 7C, 7D, 7E; or
3. STATS 7, MATH 10, PHYSICS 7C.

### Pure Mathematics additions

Lower division:

- MATH 2E.

Upper division:

- MATH 120B;
- MATH 121B;
- MATH 147;
- five additional four-unit MATH lecture courses numbered 100–189.

The requirement solver must exclude courses outside the specified number/unit/type rules and avoid using a required named course again as one of the five additional electives unless the official rule explicitly permits it.

### Other Mathematics restrictions

The Catalogue says a Mathematics major may not double major in Applied and Computational Mathematics and may not minor in Mathematics or Mathematics for Biology. It does **not** list Computer Science as a prohibited second major.

## Applied and Computational Mathematics, B.S. — alternate path

Source: [Applied and Computational Mathematics, B.S. — 2026–27](https://catalogue.uci.edu/schoolofphysicalsciences/departmentofmathematics/appliedandcomputationalmathematics_bs/#requirementstext)

This is an alternate scenario, not an additional third major. Pure Mathematics remains the user’s default. The application must enforce that Mathematics, B.S. and Applied and Computational Mathematics, B.S. cannot both be active in the same scenario.

### Lower-division core — complete all

- MATH 2A
- MATH 2B
- MATH 2D
- MATH 2E
- MATH 3A
- MATH 3D
- MATH 9
- MATH 13

### Upper-division core — complete all

- MATH 105A and MATH 105LA
- MATH 105B and MATH 105LB
- MATH 121A
- MATH 121B
- MATH 130A
- MATH 140A
- MATH 140B

### Additional lower-division courses — choose three

- BIO SCI 93, 94, or 97
- CHEM 1A, 1B, or 1C
- MATH 10
- PHYSICS 7C, 7D, or 7E
- STATS 7

Each course is one selection; the rule is not “choose one three-course sequence.”

### Applied sequence — complete all

- MATH 112A
- MATH 112B
- MATH 115

### Mathematics electives — choose three

- MATH 107 and MATH 107L
- MATH 110A
- MATH 110B
- MATH 112C
- MATH 113A
- MATH 113B
- MATH 117
- MATH 118
- MATH 120A
- MATH 130B
- MATH 130C
- MATH 134A
- MATH 134B
- MATH 140C
- MATH 147
- MATH 176
- MATH 178

The paired MATH 107/MATH 107L option must be encoded as the official rule specifies, not flattened carelessly.

### Outside-Mathematics upper-division electives — choose two four-unit courses

Official listed options:

- COMPSCI 122A, 161, 171, 172B, 178, 183
- ECON 100A, 105A, 105B
- MGMT 101, 105, 107
- PHILOS 104, 105A, 105B
- PHYSICS 100, 111A, 111B, 116, 125A, 125B
- STATS 110, 111, 112, 120B

Other upper-division courses may be used only with advance approval from the Applied Mathematics adviser. Such a course is a manual substitution with evidence, not an automatically eligible elective.

## Adding the two majors

### ICS rules effective Fall 2026

The current ICS policy explicitly says its guidelines apply both to changing into an ICS major and adding an ICS major as a double major.

For Computer Science:

- minimum 3.0 overall UC GPA;
- minimum 3.0 GPA in the immediately preceding quarter;
- minimum 3.0 GPA across all CS-major-required courses;
- average 3.3 or higher, with no grade below C, across:
  - I&C SCI 33; and
  - three from MATH 2B, I&C SCI 6B, I&C SCI 6D, I&C SCI 6N or MATH 3A, STATS 67.

ICS school-wide policy also states:

- major requirements must be completed before applying;
- required courses use letter grades;
- AP is not a grade for change/add-major review, so students with AP credit need additional listed courses;
- first-year entrants in their first six full-time UCI quarters may apply through StudentAccess;
- quarters seven through nine require an appeal;
- later first-year students and transfer students beyond the stated window are not eligible under the standard process;
- at most two repeats total and one repeat per course.

Source: [ICS change/add-major criteria](https://changeofmajor.uci.edu/school-of-information-and-computer-sciences/)

### Mathematics / Physical Sciences rules

Current Physical Sciences criteria for adding Mathematics or Applied and Computational Mathematics list:

- minimum 2.0 cumulative UC GPA;
- minimum 2.0 most recent-quarter GPA;
- minimum 3.0 GPA across all lower-division Mathematics courses that count toward the major;
- minimum 3.0 GPA across lower-division UCI Mathematics courses that count toward the major;
- at least two UCI Mathematics courses that count toward the major.

Physical Sciences additionally says students declaring a double major have additional requirements and should contact its academic advising office. Therefore the app must show “Physical Sciences double-major adviser confirmation” as a non-course task rather than pretending course completion guarantees approval. The same eligibility checklist applies when the alternate Applied and Computational Mathematics path is selected.

Source: [Physical Sciences change/add-major criteria](https://changeofmajor.uci.edu/school-of-physical-sciences/)

## Known efficient overlap for this combination

Subject to adviser confirmation:

- MATH 2A satisfies both majors.
- MATH 2B satisfies both majors.
- Choosing MATH 3A instead of I&C SCI 6N satisfies both majors.
- Choosing CHEM 1A–1C or PHYSICS 7C–7E for the Mathematics science sequence can likely supply the two CS Category II science courses because Physical Sciences is not one of the excluded offering units and the courses carry the needed GE designation for the applicable year.
- I&C SCI 139W satisfies the CS core and can satisfy GE upper-division writing.
- Many CS/Mathematics courses satisfy GE V and some science courses satisfy GE II.
- In the Applied and Computational Mathematics alternate, approved outside-Mathematics options such as COMPSCI 122A, 161, 171, 178, and 183 may overlap with CS requirements only when each program’s sharing rules permit it; the solver must expose the allocation rather than assume unrestricted double use.

The app should call these “planned overlaps” until verified against the selected catalogue year and adviser guidance.

## Rules that must not be guessed

- official approval of the double major;
- adviser-approved substitutions;
- the treatment of a specific cross-listed course across both majors;
- transfer-course equivalencies;
- whether an ungraded AP/IB award meets an add-major grade requirement;
- future course availability;
- residence/modalities not yet published.
