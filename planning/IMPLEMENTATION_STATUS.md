# Implementation Status

Last updated: 2026-08-31 · Build `catalogue-2026-27-2026-07-24-ee125b9d`

**Working outcome:** a running local-first ZotPath MVP. It ingests the real 2026–27 UCI Catalogue
(5,933 courses across 123 departments), evaluates prerequisites and restrictions, audits CS + the
selected Mathematics program against encoded 2026–27 rules, applies the full AP credit table,
persists to IndexedDB, exports/imports versioned JSON, and evaluates 72 outbound transfer targets
at the 27 requested universities.

**Verification:** `npm run verify` passes (strict typecheck → lint → **238 unit/domain tests** →
production build). `npm run test:e2e` passes **21 real-browser tests** across desktop and mobile.
The transfer coverage includes registry integrity, cutoff snapshots, course mappings, AP/IB policy,
conditional rules, letter grades, subject GPA/grade floors, source staleness, persistence, direct
course insertion, ambiguous-program disclosures, current entry/deadline display, and phone-width
search/sorting.

---

## Commands

```bash
npm install
npm run dev                    # stage data + Vite dev server
npm run verify                 # typecheck → lint → test → build
npm run test:e2e               # Playwright (builds and previews automatically)
npm run data:refresh           # re-ingest the live catalogue (needs network)
npm run data:refresh:offline   # re-parse the newest cached raw snapshot
```

First Playwright run also needs `npx playwright install chromium webkit`.

---

## Completed

### Phase 1 — foundation
- React 18 + TypeScript (strict, `noUncheckedIndexedAccess`) + Vite 6.
- Zustand store, Dexie/IndexedDB persistence, Zod runtime schemas.
- Vitest + Testing Library + `fake-indexeddb`; Playwright for e2e.
- Responsive three-region shell with collapsible rails; mobile tab views.
- All commands green: dev, typecheck, lint, test, e2e, build.

### Phase 2 — authoritative data
- **Live ingestion pipeline** (`scripts/data/refresh.ts`): discovers departments from the All Courses
  index (no hand-written list), fetches at ~0.7 s/request with a descriptive user agent, caches dated
  raw HTML, writes normalized JSON, a parser report, and a manifest with per-source SHA-256 hashes.
- **5,933 courses / 123 departments** ingested from the real catalogue.
- Course records carry code, aliases, units, level, description, prerequisite raw + parsed tree,
  corequisites, concurrent rules, recommended prep, restrictions, same-as, overlaps, repeatability,
  grading options, GE designations, source URL, catalogue year, retrieval date, parser confidence,
  and the raw source text.
- **Full 2026–27 AP table** encoded per exam-and-score with separate modelling of units, exact
  equivalence, alternate sequences, GE effects, ELWR / American History effects, elective-only
  status, cross-exam caps, duplicate relationships, and placement caveats.
- GE I–VIII, UC/UCI, CS B.S., Pure Mathematics, Applied and Computational Mathematics, and
  ICS/Physical-Sciences add-major rules encoded as versioned data with stable ids and source URLs.
- Seeded 2026–27 ICS and Mathematics department teaching plans as *tentative* evidence.

### Phase 3 — engines
- Recursive-descent prerequisite parser (AND tighter than OR, exam/standing/consent nodes,
  unparsed prose retained as `unknown` with reduced confidence).
- Three-valued evaluator with structured explanations and prerequisite-vs-concurrent timing.
- Separate restriction evaluation.
- Deterministic allocation solver with global precedence ordering and exclusion-group sharing;
  maximum bipartite matching for CS focus areas.
- Duplicate-credit handling; unit / GPA / residence tracking; offering assessment with the
  recency-weighted baseline; workload validation.

### Phase 4 — workflows
- Five-step onboarding with AP effect previews; starts with an empty plan.
- Course Explorer with immediate search, combinable filters, and a details drawer.
- Planning board with drag-and-drop **and** a full keyboard/button alternative.
- Live Degree Audit with per-requirement sources, pinning, and "add a course that satisfies this".
- Pure vs. Applied scenario comparison; local persistence; JSON export/import with preview.

### Phase 5 — hardening
- Unit/domain and e2e tests assert behaviour rather than implementation snapshots.
- Keyboard-only path and responsive layouts covered by e2e.
- Accessibility: focus trapping, visible focus, icon+text status, reduced-motion, 200 % zoom.

### Phase 6 — outbound transfer workspace
- Official-source research notes for all 27 requested universities, with URLs and retrieval dates.
- 72 exact program/admitting-unit targets; ambiguous user labels resolved to actual undergraduate
  degrees or explicitly identified as a minor/graduate-only path.
- Three-valued UCI-to-target course evaluation with confidence labels; no mapping is presented as an
  articulation agreement.
- Destination-specific exam-credit handling, separate classroom/exam unit ledgers, conditional AP
  rules, letter-grade/P/NP checks, subject GPA, and subject-grade floors.
- Transfer cutoff persisted with the plan and included in JSON export/import.
- Search, readiness sorting, visible entry/deadline/testing details, earliest eligible term, direct
  add-to-term, source-age warnings, and printable per-school gap reports.

---

## Original UCI-planner acceptance criteria — 67 of 67 implemented and covered

`U` = unit/domain test, `E` = Playwright e2e, `B` = build artifact.

### Catalogue coverage
| # | Criterion | Status | Where |
|---|---|---|---|
| 1 | Ingestion report shows every department link | ✅ | `U` `catalogueParser.test.ts`; `B` `data/normalized/.../parser-report.json` lists all 123 |
| 2 | Every `.courseblock` becomes a course or a recorded error | ✅ | `U` parser tests (8 blocks → 7 courses + recorded errors) |
| 3 | Graduate/professional indexed but hidden by default | ✅ | `U` `search.test.ts`, `catalogueParser.test.ts` |
| 4 | Result links official source and shows catalogue year | ✅ | `U` + `E` |

### Search and details
| # | Criterion | Status | Where |
|---|---|---|---|
| 5 | `COMPSCI 112` / `CS 112` / title words find the same course | ✅ | `U` `search.test.ts`; `E` |
| 6 | Filters work in combination | ✅ | `U` `search.test.ts` (11 filter tests) |
| 7 | COMPSCI 112 shows prerequisite alternatives and restriction separately | ✅ | `U` + `E` |
| 8 | Raw prerequisite text stays visible | ✅ | `U` + `E` |

### Planner
| # | Criterion | Status | Where |
|---|---|---|---|
| 9 | New plan creates Fall→Summer terms | ✅ | `U` `workload.test.ts` timeline |
| 10 | Adding a course updates term units immediately | ✅ | `U` `planner.test.ts`; `E` |
| 11 | Moving preserves status/notes and recalculates | ✅ | `U` + `E` |
| 12 | Duplicate course produces a warning | ✅ | `U` + `E` |
| 13 | Summer S1 / 10-week / S2 without three columns | ✅ | `U` + `E` |
| 14 | Every move possible without dragging | ✅ | `E` keyboard + placement menu |

### Prerequisites
| # | Criterion | Status | Where |
|---|---|---|---|
| 15 | Earlier-term prerequisite satisfies | ✅ | `U` `prerequisites.test.ts` |
| 16 | Same-term does not satisfy a prerequisite but may satisfy a corequisite | ✅ | `U` |
| 17 | Minimum-grade rules use recorded grades | ✅ | `U` |
| 18 | Missing grades produce conditional/unknown | ✅ | `U` |
| 19 | AND/OR explanations name every missing branch | ✅ | `U`; `E` |
| 20 | Moving MATH 3A later than COMPSCI 112 warns | ✅ | `U` `prerequisites.test.ts`, `planner.test.ts` |

### GE and UCI rules
| # | Criterion | Status | Where |
|---|---|---|---|
| 21 | GE I–VIII with correct counts and Va/Vb structure | ✅ | `U` `audit.test.ts` |
| 22 | One course cannot fill both Va and Vb | ✅ | `U` (I&C SCI 32 case) |
| 23 | A course can fill GE and a major rule at once | ✅ | `U` |
| 24 | I&C SCI 139W fills CS core and GE upper-division writing | ✅ | `U` (parsed as GE `Ib`) |
| 25 | 180 units, GPA categories, residence tracked separately | ✅ | `U` |
| 26 | Unknown modality prevents a false residence check | ✅ | `U` |

### Computer Science
| # | Criterion | Status | Where |
|---|---|---|---|
| 27 | Both programming-series paths supported | ✅ | `U` |
| 28 | MATH 3A satisfies CS alternative and Mathematics | ✅ | `U` |
| 29 | Four courses from three focus areas stays incomplete | ✅ | `U` |
| 30 | Four distinct areas completes the Flexible Core | ✅ | `U` |
| 31 | A Flexible Core course cannot also fill an elective slot | ✅ | `U` |
| 32 | COMPSCI 145 may fill Flexible Core **and** Project | ✅ | `U` |
| 33 | Project and nine-elective counts independent | ✅ | `U` |

### Mathematics
| # | Criterion | Status | Where |
|---|---|---|---|
| 34 | Core A requires every named course | ✅ | `U` |
| 35 | Science sequence accepts only one complete official path | ✅ | `U` (mixed path rejected) |
| 36 | MATH 2E, 120B, 121B, 147 in Pure additions | ✅ | `U` |
| 37 | Only 4-unit MATH 100–189 lecture courses fill the five electives | ✅ | `U` |
| 38 | Named courses not silently reused as electives | ✅ | `U` |

### Double-major behaviour
| # | Criterion | Status | Where |
|---|---|---|---|
| 39 | MATH 2A/2B/3A visibly satisfy both majors | ✅ | `U` via `claimUsage` |
| 40 | Physical Sciences courses serve CS science and Math sequence | ✅ | `U` |
| 41 | Audit includes ICS and Physical Sciences eligibility checks | ✅ | `U` |
| 42 | Never claims the checklist guarantees admission | ✅ | `U` (states "cannot verify") |

### Offerings
| # | Criterion | Status | Where |
|---|---|---|---|
| 43 | WebSoc evidence displays as Published | ✅ | `U` `offerings.test.ts` |
| 44 | Department plan displays as Tentative | ✅ | `U` |
| 45 | Historical inference never shown as Published | ✅ | `U` |
| 46 | Blank department cell does not disable the course | ✅ | `U` + `planner.test.ts` |
| 47 | Every prediction shows evidence years/source | ✅ | `U` |
| 48 | Summer predictions keep session-level evidence | ✅ | `U` |

### Persistence and migration
| # | Criterion | Status | Where |
|---|---|---|---|
| 49 | Reloading restores the plan | ✅ | `U` `persistence.test.ts`; `E` |
| 50 | Export/import round-trips everything | ✅ | `U` (placements, grades, exams, overrides, pins) |
| 51 | New data build presents a diff before reinterpreting | ✅ | `U` `buildCatalogueDiff`; `E` migration-review dialog |

### Timeline and course loads
| # | Criterion | Status | Where |
|---|---|---|---|
| 52 | Default plan starts Incoming Summer 2026 → Fall 2026 → Winter/Spring 2027 | ✅ | `U`; `E` |
| 53 | Summers expose three sessions without three columns | ✅ | `U`; `E` |
| 54 | 12–20 units not labelled invalid | ✅ | `U` (all values 12–20) |
| 55 | Below 12 / above 20 warns "dean authorization" but stays editable | ✅ | `U`; `E` |
| 56 | Summer 20 total / 12 per session, 10-week split across sessions | ✅ | `U` |
| 57 | Above 32 Summer units invalid even with an override | ✅ | `U` |

### AP credit
| # | Criterion | Status | Where |
|---|---|---|---|
| 58 | Record exam/score/year and preview all effects | ✅ | `U` `previewAward`; `E` |
| 59 | Calculus BC 4–5 satisfies MATH 2A and 2B | ✅ | `U`; `E` |
| 60 | CS A gives elective units, not I&C SCI 31/32/33 | ✅ | `U`; `E` |
| 61 | CS Principles gives I&C SCI 20, not the programming series | ✅ | `U` |
| 62 | Statistics may satisfy STATS 7, never STATS 67 | ✅ | `U` |
| 63 | Duplicate UCI course warns; exam never gets a fabricated grade | ✅ | `U` `audit.test.ts`, `planner.test.ts` |

### Applied and Computational Mathematics
| # | Criterion | Status | Where |
|---|---|---|---|
| 64 | Pure Mathematics selected by default | ↺ | Superseded: new plans now default to Computer Science only; Pure Mathematics is one click away in onboarding/Settings. `src/app/defaults.ts` |
| 65 | Selecting Applied **replaces** the Pure audit | ✅ | `U` `activeProgramsFor`; `E` |
| 66 | Applied audit evaluates all cores, 3 lower-division, 112A/112B/115, 3 Math electives, 2 outside | ✅ | `U` (7 tests) |
| 67 | Unlisted outside course needs a visible adviser substitution | ✅ | `U` |

## Transfer acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| All 27 requested universities appear in the original order | ✅ | Registry integrity test |
| 72 program/admitting-unit targets distinguish schools and degree paths | ✅ | Registry data + UI count |
| Every target and requirement carries official source URLs and a retrieval date | ✅ | Registry integrity test |
| Selected transfer term excludes later courses | ✅ | Snapshot tests |
| Coursework readiness and admission eligibility remain separate | ✅ | Program roll-up tests + UI |
| UCI-to-target mappings disclose confidence and never claim articulation | ✅ | Model labels + registry test |
| AP/IB credit follows the destination policy rather than UCI's award automatically | ✅ | Yale/Berkeley/exam-unit tests |
| Classroom and exam units are separated at unit thresholds | ✅ | Snapshot and threshold tests |
| Manual prior-college equivalencies require recorded verification | ✅ | Domain test + External Credit UI |
| Letter-grade, P/NP, minimum-grade, technical GPA, and subject-grade rules evaluate from plan data | ✅ | UCLA, Berkeley, Columbia, UT tests |
| Michigan Calculus III rule activates when AP supplied Calculus I/II | ✅ | Conditional-rule test |
| Earliest eligible transfer point is suggested | ✅ | Transfer audit hook + UI |
| Transfer point survives reload and JSON export/import | ✅ | Store/schema + persistence test |
| Search/sort and direct add-to-term cover all target cards | ✅ | Transfer UI |
| Entry terms, deadlines, and testing posture are visible and live-page distinctions are tested | ✅ | Registry + Playwright tests |
| Old research produces a visible six-month staleness warning | ✅ | Registry helper test + UI |
| One-school gap report prints without completed requirements or other schools | ✅ | Print state + print CSS |
| University, admitting program, and exact application cycle are selectable | ✅ | Deadline checker + structured cycle registry |
| Courses after a deadline are excluded unless the school permits a later cutoff | ✅ | UCI date-window evaluator + Cornell/UC/UIUC tests |
| Fall, spring, winter, summer, and named rounds are represented where offered | ✅ | 27-school cycle registry; Michigan/Northwestern/Brown tests |
| Published dates and future projections are visually distinct | ✅ | Cycle metadata + projection warning |
| Historical planning placeholders are distinct from published dates and projections | ✅ | UChicago metadata, warning, and cycle test |
| Brown quarter-count windows and CMU completed-term-at-application gate are cycle-aware | ✅ | Deadline policy checks + domain tests |

---

## Decisions and conflict resolutions

1. **GE category I is `Ia` / `Ib`, not "two lower + one upper" as free text.** The live catalogue
   prints `(Ia)` on 12 courses (Lower-Division Writing) and `(Ib)` on 158 (Upper-Division Writing).
   Encoded as two separate requirements: `ge.Ia` needing 2 courses, `ge.Ib` needing 1. This is what
   lets I&C SCI 139W satisfy criterion 24.
2. **Category V modelled as three leaves** (`ge.Va` ≥ 1, `ge.Vb` ≥ 1, `ge.V_third` either) sharing
   one exclusion group, which satisfies "three total, at least one of each, one course cannot be
   both" without a bespoke rule type.
3. **Permissive trailing sentences are not extra conditions.** Text like "In Progress (IP) grade for
   COMPSCI 180A is also accepted" *widens* eligibility; AND-ing it as `unknown` would wrongly make a
   decidable tree undecidable. Such sentences are skipped; requirement-bearing sentences
   ("Satisfactory completion of the Lower-Division Writing requirement") become evidence nodes.
4. **`Recommended:` and `Required:` clauses are advisory.** Split off before parsing and never
   enforced; `Recommended` is shown in the details drawer.
5. **Term ordering keys on the actual start month** (Winter < Spring < Summer < Fall within a
   calendar year). This is what makes Summer 2026 precede Fall 2026 while Summer 2027 still follows
   Spring 2027, with one monotonic key.
6. **Sharing via exclusion groups rather than a global "no reuse" flag.** File 04 requires both CS
   section non-reuse *and* free GE/major overlap; per-leaf groups express both, and
   `sharingExceptions` encodes the single COMPSCI 145 exception symmetrically.
7. **CS nine-elective rule uses an explicit allow-list.** A bare `COMPSCI/SWE/IN4MATX 103–189` filter
   would wrongly admit every SWE and IN4MATX course in range; only the listed SWE/IN4MATX codes plus
   all COMPSCI 103–189 are eligible.
8. **`any_of` branches are previewed on a sandbox ledger before committing.** Otherwise an unused
   alternative (e.g. the PHYSICS science path) would consume courses a different rule needs.
9. **Statistics MGMT 7 equivalence is a separate 0-unit row in cap group `statistics`,** so the
   documented "combined maximum of four units" holds without double-awarding.

---

## Known data gaps and items needing adviser verification

1. **Six LSCI courses have no unit value** — LSCI 43, 141, 145A, 145B, 145C, 158. Verified against
   the raw HTML: UCI's own catalogue prints an empty ` Units.` field. Recorded in the parser report
   as `units` errors; the courses remain searchable with 0 units rather than an invented value.
2. **219 courses have partially unparsed prerequisite prose** (3.7 %), e.g. "Prerequisites vary." or
   "Basic course in algorithm design and analysis." These retain their raw text, evaluate to
   `unknown` (never false), and are flagged "Needs manual review" in the details drawer.
3. **No WebSoc data is imported.** The offering model, evidence types, and the recency-weighted
   predictor are fully implemented and tested, but only the ICS and Mathematics 2026–27 *department
   plans* are seeded. Nothing is currently labelled "Published"; a WebSoc adapter is the next data
   task. Criterion 43 is verified against the implemented `scheduled` path in unit tests.
4. **Residence and modality always report "needs verification"** by design — future term modality is
   unpublished, and the spec forbids a green check based on assumptions.
5. **Requires adviser confirmation, never auto-approved:** official double-major approval; the ICS
   3.3 screening average (needs letter-graded UCI courses — AP does not count); Physical Sciences
   double-major review; any outside-Mathematics elective not on the official list; cross-listed
   course treatment across both majors; transfer equivalencies.
6. **The user's AP scores are not entered.** No score is assumed anywhere; the plan starts empty and
   recalculates once scores are entered in onboarding or External Credit.
7. **UCI-to-destination course matches are not articulations.** Four-year institutions generally
   review transfer credit after admission and may require syllabi, lab/contact-hour evidence, or a
   department decision. Unverified manual mappings stay `unknown`.
8. **Curriculum-inferred preparation remains inference.** Programs whose schools publish no external
   transfer course list are labelled `inferred_from_curriculum`; the courses improve preparation but
   are not presented as application requirements.
9. **Cycle dates need periodic review.** Georgia Tech, UT Austin, and Cornell were re-audited against
   their live deadline pages on 2026-08-31. UChicago uses a clearly labelled March 1 historical
   placeholder for Transfer Early Decision and rolling-transfer priority; it is not treated as a
   confirmed cycle date. The UI warns when any research is more than 183 days old.
10. **Application GPA is incomplete when prior transcript grades are absent.** Subject and overall
    calculations use recorded UCI letter-graded work and exclude exams/P/NP. They are planning
    checks, not a target university's official recalculation.
11. **IB and A-level score tables are not complete.** Manual entries are supported and correctly
    remain exam credit, but final course awards need the destination's own score table.
12. **Future application dates are projections until the school publishes the cycle.** The checker
    repeats a currently published recurring month/day only with a visible “projected” label. Exact
    dates, course-completion deadlines, testing policies, and entry-term availability still need an
    official-source refresh each cycle. Historical placeholders use a separate label and warning.

---

## Remaining work, by user impact

1. **WebSoc ingestion** — would populate real "Published" evidence, section times, and historical
   observations to drive the predictor. The adapter interface and evidence model already exist.
2. **Suggest-next-courses** — rank eligible courses by requirement urgency, downstream unlocks, and
   offering confidence (explicitly post-MVP in file 01).
3. **Side-by-side scenario comparison view** — scenarios exist and switch correctly, but the
   comparison is sequential rather than a diff table.
4. **Richer variable-unit UX** — units are selectable per placement; a bulk editor would help.
5. **Prerequisite graph visualisation** — post-MVP in file 01.
6. **IB / A-level award tables** — the schema is shared with AP and ready; the mappings are
   deliberately not fabricated.
7. **Print/PDF plan export** — print CSS exists; a dedicated layout would be better.

---

## Continuing from here

- Domain logic is in `src/domain/` and imports no React; add rules as data, not UI conditionals.
- To add a requirement rule, extend a file in `src/domain/requirements/programs/` — give it a stable
  id, source URL, catalogue year, sharing policy, and precedence.
- To add a data source, write an adapter that emits `OfferingEvidence` and register it alongside
  `src/data/offerings2026.ts`.
- Bump `APP_DATA_SCHEMA_VERSION`, `CATALOGUE_DATA_SCHEMA_VERSION`, or `PLAN_EXPORT_SCHEMA_VERSION` in
  `src/domain/schemaVersions.ts` on any breaking shape change, and add a migration path.
- `tests/fixtures/catalogue-subset.json` is a real 180-course slice of the ingested snapshot;
  regenerate it from `data/normalized/` if you need more courses.
