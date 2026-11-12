# -*- coding: utf-8 -*-
"""
Part I of the guide: the transfer process explained from zero, then applied to
this student's actual situation.

Written as structured data so the generator can lay it out consistently.
Each section is (heading, [blocks]) where a block is one of:
  ("p", text)              paragraph
  ("bullets", [str, ...])  bulleted list
  ("table", header, rows)  simple table
  ("callout", title, text) boxed emphasis
  ("sub", text)            sub-heading
"""

INTRO = [
    ("p",
     "This document exists because transfer admission is not a smaller version of freshman admission. "
     "It runs on different deadlines, judges different evidence, and is governed by rules that most "
     "applicants never discover until they have already lost a year to them. Almost none of those rules "
     "are secret. They are simply spread across twenty-seven admissions websites, written in "
     "institutional language, and easy to skim past."),
    ("p",
     "Everything here was read from the schools' own pages. Every requirement carries the URL it came "
     "from and a label saying how much authority stands behind it. Where a school publishes nothing, "
     "this document says so instead of filling the gap with a guess. Where a number comes from a "
     "third-party summary rather than the school, it is labelled that way too."),
    ("callout", "The one thing to understand before anything else",
     "No university on your list has an articulation agreement with UC Irvine. ASSIST, the California "
     "system that tells community college students exactly which course transfers as what, covers "
     "community colleges only. UC Berkeley states the position flatly: 'UC does not maintain articulation "
     "agreements from any four-year institutions.' Every course equivalence in this document is a careful "
     "reading of two catalogues. It is a well-founded expectation, not a promise, and the receiving "
     "department makes the real decision after you are admitted, usually from your syllabus."),
]

SECTIONS = [
    ("Your situation, specifically", [
        ("p",
         "You started at UC Irvine in Fall 2026 in Computer Science, B.S., with Mathematics as a second "
         "major, working from the 2026-27 catalogue. UC Irvine runs on quarters. Most of the schools on "
         "your list run on semesters. That single fact drives more of what follows than anything else."),
        ("sub", "What your position gives you"),
        ("bullets", [
            "Your coursework is unusually well aligned with what these schools ask for. The calculus "
            "sequence, multivariable calculus, linear algebra, differential equations, calculus-based "
            "physics with labs, and a real programming sequence are exactly the preparation almost every "
            "target names.",
            "You are at a research university with a rigorous curriculum, so your grades are read in a "
            "favourable context.",
            "UC coursework transfers cleanly between UC campuses. Grades and units follow you.",
        ]),
        ("sub", "What your position costs you"),
        ("bullets", [
            "At every UC campus, California community college transfer applicants receive first priority. "
            "As a UC student you compete after that pool.",
            "Quarter units convert to semester units at two thirds. Your 12-unit UCI quarter is 8 semester "
            "units to a semester school. Reaching a 60-semester-unit junior-standing bar takes 90 UCI "
            "quarter units.",
            "Several schools cap how much outside work they will accept, or how early you must leave. "
            "Penn's engineering school and Wharton typically admit only students with one year of credit. "
            "Brown cannot consider anyone past four semesters' equivalent. MIT stops at five terms.",
            "The University of Washington's Allen School published a 0.00% admit rate for non-residents "
            "from four-year institutions. That is precisely your category.",
        ]),
    ]),

    ("What a transfer application actually is", [
        ("p",
         "A transfer application is an argument that you are academically ready to step into the middle of "
         "someone else's curriculum and finish it on time. That is why the components differ from a "
         "freshman application."),
        ("sub", "The parts you will be asked for"),
        ("bullets", [
            "An application form, usually the Common Application for Transfer. Some schools use their own: "
            "Dartmouth and MIT have their own forms, Columbia uses the Coalition Application on Scoir, and "
            "Duke accepts the Coalition or its own transfer application. The UC campuses use the single UC "
            "application.",
            "Official transcripts from every college you have attended - and, at most schools, your high "
            "school transcript as well. Transfer admission does not erase your secondary record.",
            "A College Report or Dean's Certification, completed and sent directly by an official at UC "
            "Irvine, confirming you are in good standing and eligible to return.",
            "A Mid-Term Report listing your in-progress grades, because your most recent quarter usually "
            "has not been graded when you apply.",
            "Two recommendations, and at these schools they must come from college instructors who taught "
            "you in credit-bearing courses. MIT requires that one come from a mathematics or science "
            "instructor. A high school teacher's letter does not satisfy this.",
            "Essays, including one nearly universal prompt: why are you leaving, and what specifically "
            "does the new school offer that your current one does not.",
            "Standardized test scores at several schools - see the testing section below.",
        ]),
        ("callout", "The 'why transfer' essay is a real filter",
         "Harvard lists 'a clearly defined academic need to transfer' as the first thing it looks for. "
         "Princeton, UChicago and Penn all ask a version of the same question. An answer that amounts to "
         "wanting a more prestigious name reads badly. An answer built on a specific programme, laboratory, "
         "faculty member or curricular structure that UC Irvine genuinely does not have reads well."),
    ]),

    ("The three gates", [
        ("p",
         "Every target applies three separate tests, and they fail in different ways. Confusing them is "
         "the most common planning mistake."),
        ("sub", "Gate one: eligibility"),
        ("p",
         "Structural rules about who may apply at all: how many terms you have completed, how many units "
         "you hold, whether the major accepts transfers, whether testing is required. These are usually "
         "binary and cannot be fixed with more coursework. Transferring a term earlier or later is often "
         "the only lever. Cornell's Computer Science B.S. in Engineering is simply closed. Penn's "
         "engineering window closes after one year. These are eligibility failures."),
        ("sub", "Gate two: required coursework"),
        ("p",
         "The named courses a school expects you to have finished. This is the gate this document maps "
         "most precisely, and the one you have the most control over. Note that only about three quarters "
         "of the programmes here publish a course list at all."),
        ("sub", "Gate three: competitiveness"),
        ("p",
         "Grades, rigour, essays, recommendations, and how many seats exist that year. No document can "
         "make this deterministic. What it can do is tell you the published bar: UCLA's admitted Computer "
         "Science transfers had a 4.00 GPA at both the 25th and 75th percentile."),
        ("callout", "Why this matters for reading the rest of the document",
         "A programme can be perfectly on track on coursework and still be impossible on eligibility. The "
         "planner in ZotPath reports those two separately for exactly this reason, and so does every "
         "school chapter below."),
    ]),

    ("Your timeline, quarter by quarter", [
        ("p",
         "There are only two realistic exits, and they are very different applications."),
        ("sub", "Exit A: transfer after one year, entering Fall 2027"),
        ("p",
         "You would apply between November 2026 and March 2027. At the UC deadline of 30 November 2026 "
         "you would have no completed college grades at all - your first UCI quarter ends on 11 December "
         "2026. At the March private-school deadlines you would have one completed quarter. Almost every "
         "school on this list requires more than that, and the ones that do not would be judging you "
         "almost entirely on your high school record. This exit is viable mainly for USC, which explicitly "
         "accepts sophomore transfers, and for Penn's engineering school and Wharton, whose windows are "
         "open only at this point."),
        ("sub", "Exit B: transfer after two years, entering Fall 2028"),
        ("p",
         "You would apply between November 2027 and March 2028. This is the realistic path for the "
         "majority of your list, and it is the one the planner defaults to. By the March 2028 deadlines "
         "you would have five completed quarters - Fall 2026 through Winter 2028 - with Spring 2028 not "
         "yet begun."),
        ("callout", "The detail almost everyone misses",
         "UC Irvine's Spring 2028 quarter begins on 3 April 2028. Every school whose deadline falls before "
         "that date cannot see any Spring 2028 course, even as work in progress. Cornell expects its "
         "preparation to be complete or under way at application, and its deadline is 15 March, so a "
         "course you planned for Spring 2028 does not exist as far as Cornell is concerned. Schools differ "
         "on this: the UCs allow coursework through the following spring via the Transfer Academic Update, "
         "Georgia Tech publishes a separate course-requirement deadline of 30 May, and Michigan lets "
         "prerequisites finish any time before you enrol. The application-cycle checker in ZotPath models "
         "each school's rule individually."),
        ("sub", "Where the deadlines actually fall"),
        ("table", ["When", "What is due"], [
            ["30 November", "UC application closes for Berkeley, UCLA and UC San Diego. This is by far the earliest deadline and it is a hard cutoff."],
            ["Mid-January", "Georgia Tech summer application closes; UIUC application opens on 15 January."],
            ["1 February", "Michigan fall deadline; UIUC priority deadline."],
            ["15 February", "USC deadline; UW's university application closes."],
            ["16 February", "Carnegie Mellon fall deadline."],
            ["1 March", "The single busiest date: Georgia Tech, UT Austin, UVA, Columbia, Brown, Dartmouth, Yale, Harvard, Princeton, Northwestern Early Decision, MIT and UMD."],
            ["15 March", "Cornell, NYU, Penn, Duke, Rice and Stanford."],
            ["1 April", "Northwestern Regular Decision; UIUC final deadline."],
            ["5 April", "The Allen School's separate departmental application at UW, and the ACMS application window closes."],
        ]),
        ("p",
         "Two of these deserve separate attention. The University of Washington requires two applications, "
         "and missing the 15 February university deadline makes you ineligible for the departmental one "
         "regardless of merit. And the UC deadline of 30 November falls roughly three months before "
         "everything else, which means the UC portion of your work has to be finished in the autumn."),
    ]),

    ("Credit: the part that costs people a year", [
        ("sub", "Quarter to semester conversion"),
        ("p",
         "One UCI quarter unit is worth two thirds of a semester unit. Ninety UCI quarter units is sixty "
         "semester units, which is the standard definition of junior standing. Cornell states outright "
         "that quarter credits 'will be reduced when converted to semester credits'. The quarter-system "
         "targets - UCLA, UC San Diego, UChicago, Dartmouth, Northwestern and Stanford - need no "
         "conversion at all."),
        ("sub", "Caps on what transfers"),
        ("table", ["School", "Limit"], [
            ["Harvard", "16 semester-long courses maximum, and half the degree must be done at Harvard"],
            ["Yale", "18 course credits maximum; at least 18 must be earned at Yale"],
            ["Stanford", "90 quarter units maximum; at least two years must be completed at Stanford"],
            ["Cornell Engineering", "33 credits per year elsewhere, 66 total including AP; 60 must be earned at Cornell"],
            ["UC San Diego", "105 quarter units of lower-division credit maximum"],
            ["Brown", "You may not forfeit credit, and more than four semesters' equivalent makes you ineligible"],
            ["UChicago", "1,200 units per academic year and 400 per term; six quarters in residence"],
            ["Northwestern", "Six quarters in residence for a four-year degree"],
        ]),
        ("sub", "Exam credit does not travel"),
        ("p",
         "This surprises people. Yale, Harvard and Princeton award no transfer credit at all for AP, IB or "
         "CLEP results - and crucially, that holds even when UC Irvine already granted you credit for the "
         "exam. Cornell will not honour credit your current school gave you from an exam score below "
         "Cornell's own threshold, using an AP Calculus BC score of 4 as its example. Michigan applies the "
         "opposite trap: if AP credit covered your Calculus I or II, then Calculus III becomes a "
         "requirement you must satisfy with real coursework."),
        ("callout", "The practical rule",
         "Where an exam gave you credit at UC Irvine, take the next real course in the sequence anyway. "
         "MIT says this directly: if you received college credit through advanced exams, 'you should enrol "
         "at the appropriate level for each of the disciplines mentioned'. A transcript full of exam "
         "credit and thin on classroom coursework is the weakest possible transfer application."),
        ("sub", "Credit is not the same as counting toward the major"),
        ("p",
         "Princeton states that transfer credit is prioritised toward general education requirements and "
         "that 'departmental requirements for majors and certificate programs may not be fulfilled through "
         "transfer credit'. UT Austin warns that a course 'may be accepted for transfer credit but not be "
         "applicable toward an engineering degree'. Cornell requires that CS 2110 and CS 2800 be taken at "
         "Cornell to affiliate with the major no matter what you took elsewhere. Expect to repeat work."),
    ]),

    ("Grades", [
        ("p",
         "Transfer admission weighs college grades far more heavily than freshman admission weighs high "
         "school grades, because there is less of everything else to go on."),
        ("bullets", [
            "UIUC's Mathematics and Computer Science degree requires a minimum grade of A- in every "
            "computer science and mathematics course you take, alongside a 3.5 GPA. That is the strictest "
            "per-course rule on your list.",
            "Grainger Engineering at UIUC requires a B or better in each required technical course and "
            "advises repeating anything below a B before applying.",
            "Yale requires an A or B in at least three quarters of your transferable courses, with nothing "
            "below a C in the remainder.",
            "UT Austin's College of Natural Sciences expects a B- minimum in every mathematics and science "
            "course.",
            "UMD's gateway requires a B- in each gateway course and a 3.0 across every institution you "
            "have attended - and you may apply to a Limited Enrollment Program only once, ever.",
            "UCLA counts both the original and the repeated grade when a major-preparation course is "
            "retaken.",
        ]),
        ("callout", "Pass/No Pass is dangerous here",
         "UCLA requires all major-preparation coursework to be letter graded. Northwestern will not "
         "transfer any course graded P or S at all. Yale says Pass/Fail courses do not typically transfer. "
         "USC will not let a Pass/No Pass writing course satisfy its writing requirement. If you are "
         "seriously considering transferring, take everything for a letter grade."),
    ]),

    ("Standardized testing", [
        ("p",
         "Testing policy for transfer applicants often differs from the freshman policy at the same school, "
         "and several of these schools are moving back toward requiring scores."),
        ("table", ["Posture", "Schools"], [
            ["Required", "Yale, Harvard, Stanford, MIT, Columbia (2027-28 cycle onward), Penn"],
            ["Required with a waiver available", "Dartmouth, Princeton (required again from Fall 2028 entry)"],
            ["Recommended", "Rice"],
            ["Optional", "Georgia Tech, UIUC, UT Austin, UMD, Michigan, NYU, USC, UVA, UChicago, Duke, Brown, Northwestern, Cornell"],
            ["Not used", "Berkeley, UCLA, UC San Diego, University of Washington"],
        ]),
        ("p",
         "Princeton's timing matters for you specifically. Testing is optional for Fall 2026 and Fall 2027 "
         "entry and required again from Fall 2028 entry. Since Fall 2028 is your realistic exit, plan on "
         "needing a score. MIT additionally imposes a hard test date: before 31 March for fall entry."),
    ]),

    ("Money", [
        ("bullets", [
            "NYU does not award its own scholarships to transfer applicants at all. Only federal and state "
            "aid is available.",
            "Financial aid deadlines are frequently earlier than admission deadlines. MIT's aid application "
            "is due 15 February against a 1 March admission deadline. Harvard requires all financial aid "
            "materials by the 1 March deadline itself.",
            "Housing is not guaranteed for transfer students at Carnegie Mellon. Northwestern requires "
            "transfers to live on campus for their first year unless entering as a third-year or older "
            "than 21.",
            "Leaving the UC system means leaving UC tuition. For a California resident this is usually the "
            "single largest financial consequence of transferring, and it is worth pricing before the "
            "essays get written.",
        ]),
    ]),

    ("What the numbers actually say about your odds", [
        ("p",
         "Reading the statistics in this document honestly leads to an uncomfortable but useful conclusion: "
         "the schools sort into tiers that have little to do with their general reputation."),
        ("sub", "Effectively closed to you"),
        ("bullets", [
            "Cornell Computer Science through Engineering - not accepting transfer applications at all. "
            "The Arts and Sciences B.A. is the only route.",
            "University of Washington Computer Science and Computer Engineering - the Allen School "
            "published zero admits from 114 non-resident four-year applicants across two cycles.",
            "Penn Engineering and Wharton, if you complete two years - the window is one year of credit.",
        ]),
        ("sub", "Very long odds, but real"),
        ("bullets", [
            "Harvard (about 12 enrol per year), MIT (about 2%), Stanford (about 2%), Dartmouth (about "
            "1.5%), Duke (about 2%), Columbia (under 10%), Brown (4 to 7%), Yale (a small group).",
            "UCLA Computer Science at 5%, Computer Engineering at 6%, Computer Science and Engineering at "
            "9% - with admitted GPAs at 3.93 to 4.00.",
        ]),
        ("sub", "Genuinely competitive"),
        ("bullets", [
            "UCLA Mathematics at 31%, Applied Mathematics at 36%, Mathematics of Computation at 48%, "
            "Statistics and Data Science at 23%, Data Theory at 46%.",
            "Georgia Tech at 17% for non-Georgia applicants, with an average admitted GPA of 3.78.",
            "USC, which sets no minimum GPA and accepts sophomore transfers.",
            "UT Austin Mathematics and UVA, both of which admit to a school rather than a major.",
        ]),
        ("callout", "The most actionable pattern in this entire document",
         "At the same university, the mathematics-side majors admit transfers at five to ten times the "
         "rate of the computer science majors. UCLA admitted 5% of Computer Science transfer applicants "
         "and 48% of Mathematics of Computation applicants in the same cycle. You are already a "
         "mathematics double major. If your goal is to attend a particular university, the major you name "
         "on the application will move your odds far more than any additional course will."),
    ]),

    ("Mistakes that cost people the cycle", [
        ("bullets", [
            "Assuming the campus admit rate applies to your major. At UCLA the campus rate is 22.7% and "
            "Computer Science is 5%.",
            "Missing that admission to the university is not admission to the major. At UC San Diego, a "
            "transfer admitted without the CSE major can never apply into it - there are no exceptions. "
            "The same is true of Berkeley Computer Science, UCLA engineering, Michigan Computer Science "
            "and UIUC's Grainger college.",
            "Letting a required course land in Spring quarter when the deadline is in March. The course "
            "will not exist for schools that judge on work completed or under way at application.",
            "Taking a major-preparation course Pass/No Pass.",
            "Relying on AP credit UC Irvine already honoured. Several schools will not, and one will "
            "penalise you for it.",
            "Applying to a Limited Enrollment Program at Maryland before the gateway courses are finished. "
            "You get one attempt, ever.",
            "Forgetting the second application. The Allen School at UW and the ACMS programme both require "
            "a separate departmental application after the university one.",
            "Waiting past the eligibility ceiling. Brown, MIT, Harvard, Penn, Columbia and Princeton all "
            "cap how much college you may have completed. Too much coursework is disqualifying at six of "
            "your targets.",
        ]),
    ]),

    ("What to do with this document", [
        ("bullets", [
            "Decide your exit term first - after one year or after two. It changes which schools are even "
            "possible, and it is the input the ZotPath transfer workspace asks for.",
            "For each school you are serious about, read the eligibility section before the coursework "
            "section. Eligibility failures cannot be fixed by studying harder.",
            "Take everything for a letter grade, and take the real course even where an exam gave you "
            "credit.",
            "Re-verify before you apply. Every page in this document was read on 31 August 2026. "
            "Admissions requirements change annually, deadlines shift, and at least one closure in here - "
            "Cornell's - is published per cycle rather than as permanent policy.",
            "Treat this as preparation for a conversation with an adviser, not a substitute for one. No "
            "part of it is binding on any university.",
        ]),
    ]),
]
