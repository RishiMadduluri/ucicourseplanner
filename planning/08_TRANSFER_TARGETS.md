# Outbound Transfer Targets

Last reviewed: 2026-08-31

ZotPath's **Transfer** workspace asks a different question from its UCI degree audit:
if the student leaves UCI after a selected term, which published admission gates and preparation
requirements appear covered, which remain open, and which still require a target-school evaluation?

This is an unofficial planning aid. It does not predict admission or make a binding transfer-credit
decision. UCI-to-destination equivalencies are catalogue comparisons because the destination schools
do not publish articulation agreements for every UCI course. Each program card therefore links the
primary source and labels the strength of every mapping.

## Scope

- 27 universities and 72 distinct admission/program targets from the requested list.
- Research notes with official-source excerpts and URLs live in `research/transfer/01-*.md` through
  `research/transfer/27-*.md`.
- A transfer snapshot includes only courses finished, in progress, or planned by the selected final
  UCI term. Later courses do not leak into the evaluation.
- Course preparation and admission eligibility are evaluated separately. A student can cover every
  named course while still missing a unit, term, GPA, testing, or residency gate.
- A missing published transfer course list is not silently replaced with an invented one. Curriculum
  comparisons are labelled `inferred_from_curriculum`; open-ended or adviser-reviewed questions stay
  `unknown`.

## How mappings are interpreted

1. Use an explicit transfer-preparation list when the target publishes one.
2. Match the target course to the 2026–27 UCI catalogue by content and sequence, never by title alone.
3. Keep one-to-many mappings intact (for example, a target's combined linear algebra/differential
   equations course can require both UCI MATH 3A and MATH 3D).
4. Treat a student-entered prior-college equivalency as provisional until an adviser or evaluator is
   recorded. Provisional mappings produce `Needs verification`, not a green check.
5. Never carry a UCI AP/IB equivalency automatically to another university. The target's own exam
   policy decides whether the exam can cover coursework or units.
6. Do not use exam credit or P/NP work in GPA calculations. Destination-specific letter-grade rules
   are checked against the recorded grade basis.

## Requested-program resolutions

Several labels in the original list are not undergraduate majors at the named school. The registry
uses the closest exact undergraduate target and explains the substitution on the program card.

| Requested label | Implemented target | Reason |
|---|---|---|
| NYU Statistics | CAS Data Science B.A. and Data Science and Mathematics B.A. | NYU has no standalone undergraduate Statistics major. A Stern statistics concentration is a different business-school target and is not assumed. |
| NYU Math and CS (Tandon) | CAS/Courant Mathematics and Computer Science B.A. | The joint major belongs to CAS/Courant, not Tandon. Tandon's separate Math and CS degrees are not the named joint program. |
| Penn Applied Math | Penn CAS Mathematics B.A. | Penn does not publish an undergraduate Applied Mathematics major or concentration. The card does not claim that Penn offers one. |
| Penn CSE | Computer Science BSE (CIS) and Computer Engineering BSE (ESE) | Penn has no undergraduate degree literally named CSE; these are the two exact engineering degrees the label could mean. |
| Princeton Applied and Computational Math | Mathematics A.B. with the PACM minor noted | PACM is an undergraduate minor, not a major. Princeton also warns that major requirements generally may not be completed with transfer credit. |
| MIT Computational Science and Engineering | Course 6-3 and Course 18-C context | MIT's CSE unit is graduate-level. The closest undergraduate routes are Computer Science and Engineering (6-3) and Mathematics with Computer Science (18-C). |

Other important admitting-unit distinctions are preserved: Berkeley CS versus EECS; Cornell CS in
Arts & Sciences versus Engineering; Michigan CS-LSA versus CS-Engineering; Columbia College versus
SEAS; Northwestern CS in Weinberg versus McCormick; and Yale's non-engineering majors versus EECS.
Programs that share one application decision are grouped rather than presented as independent odds.

## Exam-credit and grade findings that change the plan

- **Yale:** AP, IB, CLEP, and college credit earned while in high school do not receive transfer
  course credit. Transferable work normally needs a letter grade; at least three quarters of the
  courses must be A/B and none may be below C.
- **Harvard:** credit by examination, including AP and IB even when another college awarded credit,
  is not transferable.
- **Princeton:** eligible credit is based on postsecondary courses, and pre-high-school-graduation
  college credit does not transfer. Major requirements generally cannot be fulfilled by transfer
  work, so mapped UCI courses are preparation, not promised concentration credit.
- **Northwestern:** contrary to an earlier project note, eligible AP and higher-level IB scores can
  earn test credit. School- and degree-level use still varies. P/S coursework itself is not
  transferable.
- **Michigan Engineering:** when AP supplies Calculus I or II, the preparation plan adds Calculus III
  as a conditional requirement instead of treating the exam as the end of the calculus sequence.
- **UCLA:** recorded major preparation must be letter graded; P/NP coverage is shown at risk.
- **Berkeley Engineering, Columbia Engineering, and UT Austin Natural Sciences:** the evaluator keeps
  math/science or technical performance separate from overall GPA where the official source does.
  UT's B-minus floor is checked across every recorded math/science course, not only the courses that
  happen to satisfy a named card.

## Transfer workspace behavior

- Select a university, admitting program, and dated application cycle. Published Fall/Spring/Summer/
  Winter entry opportunities are kept separate, including Northwestern's binding early round and
  Michigan's Spring Half and Summer Half terms.
- Compare the plan visible on the application date with the plan at the school's actual coursework
  cutoff. Future plan terms are excluded unless the official source permits them.
- Use exact UCI Registrar quarter boundaries: for Fall 2027 Cornell, Winter 2027 is in progress on
  March 15 but Spring 2027 has not started and does not count; for Fall 2027 UC entry, the November
  2026 application can still be supported by work completed through Spring 2027.
- See exact published 2027 dates separately from later projected cycles. A projection repeats the
  currently published month/day and is never presented as a confirmed deadline. UChicago instead
  uses a clearly marked March 1 historical placeholder for its Early Decision and rolling-priority
  rounds; it is not presented as a confirmed cycle date.
- Select the last UCI term before transfer; the choice is saved with the plan and survives JSON
  export/import.
- See classroom units and exam-derived units separately. If a destination's exam treatment alone
  determines a unit threshold, the result is `Needs verification`.
- Search and sort all programs by university/name or readiness.
- See the program's published entry terms, application/material deadlines, and transfer-testing
  posture directly on the expanded card.
- See the earliest term at which the current plan clears the program's machine-checkable eligibility
  gates.
- Add a missing UCI course directly to a selected term or open its course detail first.
- Print a gap-only report for one university.
- Receive a source-age warning after 183 days so deadlines and policies are rechecked for the next
  admission cycle.

## Invariants the tests enforce

These are guarded by `tests/domain/transfer.test.ts` so a later edit cannot quietly reintroduce them:

- **`required` means the school published it.** A requirement may only carry `necessity: 'required'`
  when its confidence is `published_requirement`. Anything read off a degree chart is at most
  `recommended`, because no school has said that missing it makes an application unreviewable. This
  matters because `req()` defaults necessity to `required`, so the honest label has to be explicit.
- **A school that publishes no course list gets its own readiness bucket.** `none_published` is not
  folded into "coursework on track". 18 of the 72 targets publish nothing, and counting them as
  satisfied would let the summary claim 62 programs were on track when 44 actually were.
- **Suggestions still come from those schools.** Recommended gaps feed the "closes the remaining
  gaps" course list even though they never move the readiness badge — a school with no published
  list is exactly where a student most needs to be told what to take.
- **Every source URL resolves.** `npm run transfer:check-links` fetches all 108 distinct URLs in the
  dataset. It is a script rather than a unit test because it needs the network; the unit suite stays
  offline and deterministic. Sites that answer 403/406 to non-browser traffic are reported
  separately as "verify by hand" rather than treated as failures.

## Known limits

- A catalogue comparison is not an official articulation. Final equivalency often depends on a
  syllabus, contact hours, lab content, and the admitting college's post-admission review.
- The planner calculates GPA from recorded UCI letter-graded coursework. It cannot reconstruct an
  official application GPA across every prior transcript unless all source courses and grades are
  entered without double-counting.
- It does not yet contain complete IB or A-level score tables. Manually entered exam credit stays in
  the exam bucket and follows the target's exam policy.
- Some schools publish no external-transfer preparation list. Those cards use clearly labelled
  degree-curriculum comparisons and must not be read as admission requirements.
- A "closed to transfers" finding can itself be cycle-scoped. Cornell publishes its Computer Science
  closure under the heading "Transfer Course Requirements for 2025-26 Admissions", so it is a
  per-cycle decision, not a permanent policy, and the card says so.
- Yale's "A or B" distribution rule does not say whether B- counts. The engine reads B- as inside the
  B range and states that reading in the rule detail rather than presenting the percentage as fact.
  Yale also counts course credits where the engine counts courses; UCI courses are almost all four
  units, so the two track closely but are not identical.
- Admission deadlines and testing rules are cycle-sensitive. Exact published dates are encoded
  through the cycle identified in the checker; later years are visibly projected and must be
  rechecked. UChicago’s March 1 dates are historical estimates rather than ordinary projections and
  must be verified against the actual application cycle.
- “On track” means later planned coursework is allowed by the published timing rule and still must
  be completed with the required grade. It is not a prediction of admission or a promise that the
  destination will articulate the UCI course.

## Maintenance checklist

Before each application cycle:

1. Revisit every program and institutional URL and update `retrievedAt` only after review.
2. Reconfirm external-transfer availability, admitting school, entry term, deadline, testing policy,
   unit/term window, residency minimum, and grade rules.
3. Compare the new UCI catalogue with every named mapping and recheck any changed course description.
4. Preserve historical notes instead of silently replacing a disputed interpretation.
5. Run the registry integrity, transfer-domain, persistence, and Playwright transfer-workspace tests.
6. Run `npm run transfer:check-links` and repair anything that no longer resolves. A source URL that
   404s turns a cited fact into an unsourced one, which is the failure this dataset most needs to
   avoid.
