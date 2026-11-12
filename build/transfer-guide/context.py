# -*- coding: utf-8 -*-
"""
Editorial content for the transfer guide.

The typed dataset in src/domain/transfer supplies requirements, eligibility
rules, deadlines and cautions. This file supplies the things a dataset cannot:
admission statistics with their provenance, and the narrative that explains the
process to someone who has never applied as a transfer student.

PROVENANCE is stated on every statistic because the quality varies enormously:

  official_major        the school publishes the number for that exact major
  official_group        the school publishes it split by applicant group
  official_institution  the school publishes an institution-level figure or a
                        direct qualitative statement
  secondary             widely reported from the school's Common Data Set, but
                        not read from the primary document for this guide
  not_published         no figure exists publicly; say so rather than guess
"""

STUDENT = {
    "name": "A UCI undergraduate",
    "program": "Computer Science, B.S. plus a Mathematics second major",
    "entry": "Fall 2026",
    "catalogue": "2026-27",
}

PROVENANCE_LABEL = {
    "official_major": "Published by the school for this major",
    "official_group": "Published by the school, split by applicant group",
    "official_institution": "Published by the school at institution level",
    "secondary": "Widely reported from the school's Common Data Set - verify before relying on it",
    "not_published": "Not published",
}

# ---------------------------------------------------------------------------
# Admission statistics, keyed by institution id.
#   headline: the single number that matters most for this student
#   rows:     (label, value) pairs
#   note:     what the numbers do and do not mean
# ---------------------------------------------------------------------------

STATS = {
    "berkeley": {
        "provenance": "secondary",
        "headline": "About 24% of all transfer applicants are admitted campus-wide; engineering is far lower.",
        "rows": [
            ("Campus-wide transfer admit rate (Fall 2025)", "24.2%"),
            ("Share of admitted transfers from California community colleges", "about 94%"),
            ("College of Engineering transfer admit rate", "not published; widely reported in the high single digits"),
            ("Recommended GPA for EECS transfer applicants", "3.5 or above overall and in technical coursework"),
        ],
        "note": "Berkeley does not publish a transfer admit rate for EECS or for L&S/CDSS Computer Science. "
                "The campus-wide figure is dominated by California community college applicants, who receive "
                "first priority; it is not a fair estimate of the odds for a UC student applying to engineering. "
                "The UC Information Center publishes admit rates by campus and major and is the place to look "
                "for a current figure.",
    },
    "ucsd": {
        "provenance": "secondary",
        "headline": "Campus-wide transfer admission is comparatively open; the CSE and Data Science majors are not.",
        "rows": [
            ("Campus-wide transfer admit rate (Fall 2025)", "about 52%"),
            ("CSE and Data Science major admit rate", "not disclosed by the campus for the 2024-25 cycle"),
        ],
        "note": "The campus figure is misleading for this student. Computer Science, Computer Engineering and "
                "Data Science are selective majors with a separate screening step, and admission to UC San Diego "
                "without the major is a different and much less useful outcome, because a transfer student can "
                "never apply into those majors later.",
    },
    "ucla": {
        "provenance": "official_major",
        "headline": "UCLA publishes transfer admit rates by major. Computer Science admitted 5% of transfer applicants, and the middle half of admits had a 4.00 GPA.",
        "rows": [
            ("Computer Science", "1,652 applicants - 5% admitted - admit GPA 4.00 to 4.00"),
            ("Computer Science and Engineering", "369 applicants - 9% admitted - admit GPA 3.94 to 4.00"),
            ("Computer Engineering", "358 applicants - 6% admitted - admit GPA 3.93 to 4.00"),
            ("Electrical Engineering", "629 applicants - 18% admitted - admit GPA 3.93 to 4.00"),
            ("Statistics and Data Science", "780 applicants - 23% admitted - admit GPA 3.94 to 4.00"),
            ("Data Theory (pre)", "163 applicants - 46% admitted - admit GPA 3.79 to 3.93"),
            ("Mathematics (pre)", "268 applicants - 31% admitted - admit GPA 3.89 to 4.00"),
            ("Applied Mathematics (pre)", "379 applicants - 36% admitted - admit GPA 3.88 to 4.00"),
            ("Mathematics of Computation (pre)", "217 applicants - 48% admitted - admit GPA 3.87 to 4.00"),
            ("Campus-wide transfer admit rate", "22.7%"),
        ],
        "note": "Fall 2025 figures from UCLA's official transfer profile by major. The GPA columns are the 25th "
                "and 75th percentiles of admitted students, so a 4.00 at both ends of the Computer Science row "
                "means essentially every admitted transfer had a perfect record. Read the gap between Computer "
                "Science at 5% and Mathematics at 31% as the single clearest illustration of why the major you "
                "name matters more than the campus you name.",
        "source": "https://admission.ucla.edu/apply/transfer/transfer-profile/2025/major",
    },
    "cmu": {
        "provenance": "official_institution",
        "headline": "Carnegie Mellon states that extremely few external transfers are admitted to the School of Computer Science.",
        "rows": [
            ("SCS external transfer volume", "'Extremely few external transfers are admitted ... due to space limitations'"),
            ("Internal transfer bar into Computer Science", "3.6 QPA across six named courses plus a 3.0 overall QPA"),
        ],
        "note": "CMU publishes no transfer admit rate by college. The internal-transfer bar is the closest "
                "published signal of the standard the School of Computer Science applies.",
    },
    "gatech": {
        "provenance": "official_group",
        "headline": "Georgia Tech publishes separate admit rates for Georgia and non-Georgia applicants. As a California student you fall in the 17% group.",
        "rows": [
            ("Transfer applicants (spring, summer and fall 2025)", "6,383"),
            ("Georgia resident admit rate", "30%"),
            ("Non-Georgia admit rate", "17%"),
            ("Average admitted transfer GPA", "3.78"),
            ("Average credit hours at entry", "49"),
            ("Transfer students enrolled", "1,365"),
        ],
        "note": "From Georgia Tech's own 2025 Transfer Class Profile. 71% of incoming transfer students applied "
                "through a transfer pathway program, most of which are open only to Georgia institutions, so the "
                "non-Georgia pool is both smaller and admitted at a lower rate.",
        "source": "https://admission.gatech.edu/images/pdf/2025/Transfer-Class-Profile-Aug-2025(w).pdf",
    },
    "cornell": {
        "provenance": "official_institution",
        "headline": "The Engineering route into Computer Science is closed to transfer applicants outright.",
        "rows": [
            ("Computer Science, Engineering B.S.", "Not accepting transfer applications"),
            ("Computer Science, Arts and Sciences B.A.", "Open - the only transfer route into Cornell CS"),
        ],
        "note": "Cornell publishes the closure under the heading 'Transfer Course Requirements for 2025-26 "
                "Admissions', which makes it a per-cycle decision rather than permanent policy. Re-read that page "
                "in the autumn before you apply.",
    },
    "uiuc": {
        "provenance": "secondary",
        "headline": "The campus transfer rate is high, but the engineering programs on your list are the exceptions.",
        "rows": [
            ("Campus-wide transfer admit rate (Fall 2025)", "about 43%"),
            ("Grainger Engineering", "not published separately; admission is described as competitive"),
            ("Mathematics and Computer Science expectation", "3.5 GPA and a minimum grade of A- in every CS and Math course"),
        ],
        "note": "Do not read the campus figure as your odds. The A- floor on every mathematics and computer "
                "science course for the Mathematics and Computer Science degree is the strictest per-course "
                "grade rule of any target in this document.",
    },
    "utaustin": {
        "provenance": "official_institution",
        "headline": "Computer Science transfer seats are very limited and most go to internal UT transfers.",
        "rows": [
            ("Minimum grade in all math and science courses", "B-"),
            ("Expected semesters in residence after transferring (Cockrell)", "five minimum; most take six or seven"),
            ("Electrical engineering transfer credit cap (ECE)", "25 semester hours"),
        ],
        "note": "UT Austin does not publish a transfer admit rate by major. The College of Natural Sciences "
                "states its expectations qualitatively, and the Cockrell School warns openly about how long the "
                "degree takes after transferring.",
    },
    "uw": {
        "provenance": "official_group",
        "headline": "The Allen School published a 0.00% admit rate for non-residents from four-year institutions. That is the group you are in.",
        "rows": [
            ("Washington residents from a Washington community college", "161 considered - 62 admitted - 38.5%"),
            ("Non-residents from a Washington community college", "75 considered - 12 admitted - 16.0%"),
            ("Washington residents from four-year and out-of-state institutions", "33 considered - 2 admitted - 6.1%"),
            ("Non-residents from four-year and out-of-state institutions", "114 considered - 0 admitted - 0.00%"),
            ("Share of recent admits from Washington community colleges", "over 90%"),
        ],
        "note": "Spring 2025 and Autumn 2025 cycles combined, published by the Allen School itself. A California "
                "student at UC Irvine is in the final row. This is the most important single statistic in this "
                "document, and it is the reason the University of Washington should be treated as a reach with "
                "no realistic path rather than as a competitive target.",
        "source": "https://www.cs.washington.edu/academics/ugrad/admissions/transfer",
    },
    "umd": {
        "provenance": "official_institution",
        "headline": "Computer Science is a Limited Enrollment Program, and you get exactly one application to it, ever.",
        "rows": [
            ("Gateway GPA across all institutions attended", "3.0 minimum"),
            ("Gateway course grades", "B- minimum in each"),
            ("Applications permitted to a Limited Enrollment Program", "one, ever"),
        ],
        "note": "Meeting the Gateway bar does not guarantee admission to the major; a selective review follows. "
                "Being admitted to the university without the major places you in the department of Letters and "
                "Sciences instead.",
    },
    "umich": {
        "provenance": "secondary",
        "headline": "Institution-level transfer admission is comparatively open, but Computer Science requires advance selection you cannot request later.",
        "rows": [
            ("Institution-wide transfer admit rate (Fall 2025)", "about 35%"),
            ("Minimum GPA for Michigan Engineering", "3.0"),
            ("Computer Science", "advance selection must be requested on the application"),
        ],
        "note": "The headline rate covers all schools and colleges. Transfer students cannot apply for or switch "
                "into Computer Science after arriving, so the advance-selection box on the Common Application is "
                "the whole decision.",
    },
    "nyu": {
        "provenance": "not_published",
        "headline": "NYU publishes no transfer admit rate for the programs on your list.",
        "rows": [
            ("Most competitive applicants", "have completed at least one full-time year of college"),
            ("NYU scholarships for transfer applicants", "none awarded"),
        ],
        "note": "The financial point is easy to miss and matters: NYU does not award its own scholarships to "
                "transfer students, only federal and state aid.",
    },
    "usc": {
        "provenance": "official_institution",
        "headline": "USC sets no minimum GPA for Viterbi transfer applicants and accepts both sophomore and junior transfers.",
        "rows": [
            ("Minimum GPA to apply (Viterbi)", "none"),
            ("Expected units per academic year", "30 to 32 semester units, or 45 to 48 quarter units"),
            ("Entry points accepted", "sophomore and junior"),
        ],
        "note": "USC is one of the few targets on this list that genuinely welcomes a transfer after a single "
                "year, which changes the calculus if you decide early.",
    },
    "uva": {
        "provenance": "official_institution",
        "headline": "Successful applicants ordinarily hold a B or better cumulative average, and engineering admits to the school rather than the major.",
        "rows": [
            ("Cumulative GPA of successful applicants", "B or better, ordinarily"),
            ("Semesters in residence required at UVA", "four"),
        ],
        "note": "Because the School of Engineering admits to the school, Computer Science, Computer Engineering "
                "and Electrical Engineering are a single admission decision at UVA.",
    },
    "upenn": {
        "provenance": "official_institution",
        "headline": "Engineering and Wharton typically admit only students with one year of credit, entering as second-years.",
        "rows": [
            ("Engineering and Wharton entry point", "second year, one year of credit"),
            ("College of Arts and Sciences entry point", "second or third year, up to two years of credit"),
            ("Standardized testing", "SAT or ACT required of transfer applicants"),
        ],
        "note": "If you complete two full years at UC Irvine, the Penn engineering and Wharton routes are "
                "probably already closed to you. This is a timing constraint, not a coursework one, and it cannot "
                "be repaired by taking more classes.",
    },
    "columbia": {
        "provenance": "official_institution",
        "headline": "Fewer than 10% of transfer applicants are admitted, and more than four semesters elsewhere is actively discouraged.",
        "rows": [
            ("Transfer admit rate", "typically under 10%"),
            ("Transfer students welcomed each year", "over 125 across the College and Engineering"),
            ("Expected GPA", "3.5 overall; 3.5 in mathematics and science for Engineering"),
        ],
        "note": "Columbia states that candidates with more than four semesters of college coursework elsewhere "
                "'are not encouraged to apply', and recommends applying with first-year standing where possible "
                "because the Core Curriculum still has to fit.",
    },
    "uchicago": {
        "provenance": "not_published",
        "headline": "No transfer admit rate is published, and the application dates for your cycle are not yet fixed.",
        "rows": [
            ("Typical admitted GPA", "around 3.5 or above in rigorous coursework"),
            ("Residency", "six quarters minimum and at least half of any major completed in residence"),
        ],
        "note": "The deadline dates in this guide for UChicago are historical estimates rather than published "
                "dates. Treat them as placeholders and confirm before planning around them.",
    },
    "duke": {
        "provenance": "secondary",
        "headline": "A very small and variable number of transfer seats; recent admit rates around 2%.",
        "rows": [
            ("Transfer admit rate", "about 2% in recent cycles"),
            ("GPA of successful applicants", "about 3.7 or above"),
            ("Transfer seats", "'A limited number ... will vary from year to year'"),
        ],
        "note": "Duke's own Bulletin makes no promise about seat availability in any given year, which is itself "
                "a planning fact.",
    },
    "rice": {
        "provenance": "official_institution",
        "headline": "Rice publishes a hard GPA floor and, unusually, no coursework requirements at all.",
        "rows": [
            ("Minimum GPA in most recent college work", "3.2, required to be considered"),
            ("Typical admitted GPA", "3.5 or higher"),
            ("Major-specific coursework requirements", "none"),
        ],
        "note": "Rice is the clearest 'no course gate' target on your list. Coursework still matters, but as "
                "evidence of preparation rather than as a checklist.",
    },
    "brown": {
        "provenance": "official_institution",
        "headline": "Brown publishes its transfer statistics openly: roughly 4 to 7% admitted, with an average admitted GPA near 3.9.",
        "rows": [
            ("2021 cycle", "2,746 applied - 118 admitted - 4.3% - average GPA 3.91"),
            ("2022 cycle (includes spring 2023 entry)", "3,018 applied - 212 admitted - 7.0% - average GPA 3.91"),
            ("Fall 2023 cycle", "2,744 applied - 112 admitted - 4.1% - average GPA 3.86"),
            ("Middle 50% SAT Math of admits", "780 to 800"),
        ],
        "note": "Brown also publishes its eligibility windows in quarters, which is unusually helpful for a "
                "UC Irvine student: 3, 4 or 6 quarters for fall entry, and 5 quarters for spring entry only.",
        "source": "https://admission.brown.edu/transfer/admission-by-the-numbers",
    },
    "dartmouth": {
        "provenance": "secondary",
        "headline": "One of the smallest transfer programs on your list, with reported admit rates near 1.5%.",
        "rows": [
            ("Reported transfer admit rate", "about 1.5 to 2%"),
            ("Standardized testing", "required, with a waiver available"),
        ],
        "note": "Dartmouth runs on quarters like UC Irvine, which makes course mapping unusually clean if you "
                "do get in.",
    },
    "yale": {
        "provenance": "official_institution",
        "headline": "Yale admits a small group each year and publishes an exact grade-distribution rule instead of a rate.",
        "rows": [
            ("Transfer class size", "a small group entering as sophomores or juniors"),
            ("Grade distribution rule", "A or B in at least three quarters of transferable courses, nothing below C in the rest"),
            ("Transfer credit cap", "18 Yale course credits; at least 18 must be earned at Yale"),
        ],
        "note": "The grade-distribution rule is the most concrete, checkable admission standard of any school in "
                "this document, and this guide evaluates your plan against it directly.",
    },
    "harvard": {
        "provenance": "official_institution",
        "headline": "About 12 transfer students enrol each year out of more than 2,000 applications.",
        "rows": [
            ("Transfer students enrolled each autumn", "12 on average"),
            ("Recent transfer applications per year", "more than 2,000"),
            ("Transfer credit cap", "16 semester-long courses"),
        ],
        "note": "Harvard states both numbers itself. It works out to well under 1%, and Harvard explicitly "
                "encourages applicants to explore a variety of colleges in their transfer search.",
    },
    "princeton": {
        "provenance": "official_institution",
        "headline": "A deliberately small programme that particularly encourages community college and veteran applicants.",
        "rows": [
            ("Entry standing", "most enter as sophomores; junior entry is the ceiling"),
            ("Transfer credit toward the major", "generally not permitted"),
            ("Standardized testing", "required again from Fall 2028 entry onward"),
        ],
        "note": "The credit rule matters more than the rate here. Princeton prioritises general education "
                "requirements when awarding transfer credit and states that departmental major requirements "
                "generally may not be fulfilled with it.",
    },
    "northwestern": {
        "provenance": "not_published",
        "headline": "No transfer admit rate is published; the published expectation is one year of full-time coursework.",
        "rows": [
            ("Expected coursework at entry", "24 semester hours or 36 quarter hours"),
            ("Application rounds", "Transfer Early Decision on 1 March, Regular Decision on 1 April"),
            ("Standardized testing", "not required of transfer candidates"),
        ],
        "note": "Northwestern runs on quarters, so your UC Irvine course counts map across without conversion. "
                "It also offers a binding Transfer Early Decision round, which is rare.",
    },
    "stanford": {
        "provenance": "secondary",
        "headline": "Transfer admission is extremely small, and Stanford publishes no required courses at all.",
        "rows": [
            ("Reported transfer admit rate", "around 2% in recent cycles"),
            ("Required courses for admission", "none"),
            ("Lifetime cap on Stanford undergraduate applications", "three, first-year and transfer combined"),
        ],
        "note": "The application cap is easy to overlook and genuinely constrains strategy: applying twice as a "
                "first-year applicant leaves you one transfer attempt.",
    },
    "mit": {
        "provenance": "secondary",
        "headline": "Roughly 20 to 30 students admitted per year from over 1,200 applications.",
        "rows": [
            ("2024-25 cycle", "about 1,346 applicants - about 32 admitted - about 2.4%"),
            ("2023-24 cycle", "about 1,223 applicants - about 23 admitted - about 1.9%"),
            ("Entry standing", "most transfer students enter as sophomores regardless of prior coursework"),
        ],
        "note": "These figures are reported from MIT's Common Data Set by third parties rather than read from "
                "the primary document for this guide; treat them as approximate. MIT's own published guidance is "
                "clearer and more useful: competitive applicants have a 3.5 or above with mostly A grades in "
                "mathematics and science.",
    },
}
