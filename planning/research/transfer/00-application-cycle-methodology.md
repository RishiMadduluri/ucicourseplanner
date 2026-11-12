# Application-cycle and coursework-cutoff methodology

Last reviewed: 2026-08-31

This note documents the deadline-specific layer in `src/domain/transfer/deadlines.ts`. It answers a
different question from a generic “last term before transfer” snapshot:

1. What exact application/departmental deadline applies to this admitting program and entry term?
2. Which UCI terms have started by that date?
3. Which terms have actually ended by that date?
4. Does the official policy permit later coursework, and if so, through which cutoff?

## UCI term boundaries

Official Registrar sources:

- 2026–27: https://www.reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html
- 2027–28: https://reg.uci.edu/calendars/quarterly/2027-2028/quarterly27-28.html
- 2028–34 ten-year calendar: https://reg.uci.edu/calendars/academic/tenyr-24-34.html

The evaluator uses instruction start and quarter/session end, not the term-name order alone. This
matters in March: Winter 2027 is underway through March 19, while Spring 2027 does not begin until
March 29. A March 15 application can report Winter as in progress but cannot treat Spring as already
underway. Summer sessions retain separate boundaries because Session 1 and the ten-week session may
start together but end on different dates.

## Destination timing policies

| Institution / program distinction | Entry cycles represented | Coursework timing used | Primary official source |
|---|---|---|---|
| Berkeley, UCSD, UCLA | Fall | UC application Nov. 1–30; requirements through following spring | https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-transfer/dates-and-deadlines.html |
| Carnegie Mellon | Fall; limited spring | Started by deadline; at least one completed college term before applying | https://www.cmu.edu/admission/admission/transfer-applicants |
| Georgia Tech | Fall, spring, summer | Separate published course-requirement deadline | https://admission.gatech.edu/transfer/deadlines-fees |
| Cornell | Fall | Required college preparation complete or in progress at application | https://admissions.cornell.edu/how-to-apply/transfer-applicants |
| UIUC requested majors | Fall priority and regular | Required preparation completed before application | https://www.admissions.illinois.edu/transfer/ |
| UT Austin | ECE/CS fall; Math fall/spring/summer | Completed or in progress at application | https://admissions.utexas.edu/apply/transfer/ |
| Washington Allen School | Autumn and spring | Complete and numerically graded before departmental deadline | https://www.cs.washington.edu/academics/ugrad/admissions/transfer |
| Washington ACMS | Autumn | No prerequisite in progress at ACMS deadline | https://acms.washington.edu/acms-information-transfer-students |
| Maryland CS | Fall, spring | Gateway requirements complete before applying | https://admissions.umd.edu/apply/admission-requirements/transfer-applicant-requirements |
| Michigan LSA / Engineering | Fall, winter, Spring Half, Summer Half | Future courses reported; Engineering prerequisites finished before enrollment | https://admissions.umich.edu/apply/transfer-applicants/requirements-deadlines |
| NYU requested CAS/Tandon targets | Fall, spring | Current/future work reviewed; expected year completed by enrollment | https://www.nyu.edu/admissions/undergraduate-admissions/how-to-apply/transfer-applicants.html |
| USC Viterbi / Dornsife | Fall | Spring work may be requested; Viterbi prep finished by end of spring | https://admission.usc.edu/prospective-students/how-to-apply/transfer-students/ |
| UVA Engineering | Fall | Core preparation complete before applying; exceptions require school review | https://admission.virginia.edu/transfer/about-transfer |
| UVA College | Fall, spring | Fall-entry work through spring; spring requires 24 earned hours by end of fall | https://admission.virginia.edu/transfer/about-transfer |
| Penn | Fall | Full year completed by spring; immediately preceding summer normally excluded | https://admissions.upenn.edu/how-to-apply/transfer-applicants/eligibility-credit-guidelines |
| Columbia | Fall | 24 points earned or registered to complete by enrollment | https://undergrad.admissions.columbia.edu/apply/transfer |
| UChicago | Fall | March 1 historical placeholder for TED and rolling priority; spring work contingent through final transcript | https://collegeadmissions.uchicago.edu/files/documents/uchicago-glance.pdf |
| Duke | Fall | Current academic year reviewed; later spring work remains contingent | https://admissions.duke.edu/apply/ |
| Rice | Fall, spring | Work through the term before enrollment may be reviewed | https://admission.rice.edu/apply/transfer-applicants |
| Brown | Fall, spring | Exact final/midterm transcript dates plus exact quarter-count windows | https://admission.brown.edu/transfer/calendar |
| Dartmouth | Fall | Current academic year; final spring work contingent | https://admissions.dartmouth.edu/glossary-term/transfer-applicants |
| Yale | Fall | Current academic year; no AP/IB transfer credit | https://admissions.yale.edu/transfer-details |
| Harvard | Fall | Continuous academic year by enrollment; no AP/IB transfer credit | https://college.harvard.edu/admissions/apply/transfer-applicants |
| Princeton | Fall | Full-time year by spring; testing optional Fall 2027, required Fall 2028 | https://admission.princeton.edu/transfer-students |
| Northwestern | Fall Transfer ED and RD | Expected academic year by enrollment; ED is binding | https://admissions.northwestern.edu/apply/application-deadlines.html |
| Stanford | Fall | Spring preparation shown as contingent, not completed at application | https://admission.stanford.edu/apply/transfer/ |
| MIT | Fall; spring for U.S. citizens/PRs | Two-to-five term window measured before entry | https://mitadmissions.org/apply/transfer/deadlines/ |

## Exact versus projected cycles

When an official page publishes a 2027 date, 2027 is stored as exact. The 2028–2030 choices repeat
the current month/day only as a visibly labelled projection. Projections are useful for comparing a
first-year versus second-year plan, but they are not represented as confirmed dates. UChicago is a
deliberate exception requested for rough planning: both Fall rounds use March 1 from official
historical material and carry a distinct `historical estimate` label and verification warning.

## Interpretation guardrails

- “At application” includes a term that has started but labels its courses as in progress/planned.
- A `completed_by` policy excludes a term until its official end date, even if it started before the
  application. This is how UIUC, UW, and UMD avoid counting in-progress prerequisites.
- A later cutoff creates an “on track if completed” result, not an “already eligible” result.
- AP/IB claims stay external credit. The target's exam-credit policy, not UCI's local equivalency,
  decides whether they meet coursework or unit rules.
- The result covers machine-checkable eligibility and mapped preparation only. Citizenship,
  residency, syllabus equivalency, conduct, recommendations, essays, portfolio/audition, and actual
  admission selectivity remain manual-review factors.
