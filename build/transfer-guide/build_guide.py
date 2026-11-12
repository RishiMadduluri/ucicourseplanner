# -*- coding: utf-8 -*-
"""
Builds the transfer guide PDF.

Content comes from three places:
  dataset.json  - exported from src/domain/transfer, the verified requirement,
                  eligibility, deadline and caution data
  context.py    - admission statistics with explicit provenance
  narrative.py  - Part I, the process explained from zero

Everything the dataset supplies is rendered mechanically so the PDF cannot
drift from the app. Anything editorial lives in the two Python modules.
"""

import json
import os
import re
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, ListFlowable, ListItem, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import context  # noqa: E402
import narrative  # noqa: E402

DATA = json.load(open(os.path.join(HERE, "dataset.json")))
OUT = os.path.join(HERE, "UCI-Transfer-Guide.pdf")

INK = colors.HexColor("#14202f")
MUTED = colors.HexColor("#4d5b70")
SUBTLE = colors.HexColor("#6b7789")
ACCENT = colors.HexColor("#1b3d6d")
GOLD = colors.HexColor("#b8820f")
RULE = colors.HexColor("#cbd3e0")
BAND = colors.HexColor("#eef1f6")
WARN_BG = colors.HexColor("#fdf1d9")
WARN_EDGE = colors.HexColor("#b8820f")
STOP_BG = colors.HexColor("#fbe9e9")
STOP_EDGE = colors.HexColor("#a51c1c")

# reportlab's built-in fonts are WinAnsi; anything outside it renders as a black
# box. Everything below is either transliterated or replaced with words.
GLYPHS = {
    "✓": "Yes", "✗": "No", "◐": "Partial", "○": "-",
    "⛔": "CLOSED", "⚠": "!", "→": "->", "≥": ">=",
    "≤": "<=", "≈": "approx. ", "×": "x", "‑": "-",
    "ı": "i", "ğ": "g", "İ": "I",
}


def _winansi(s):
    """Keep what WinAnsi can draw; anything else becomes a black box, so drop it."""
    for bad, good in GLYPHS.items():
        s = s.replace(bad, good)
    return "".join(ch if ord(ch) < 0x100 or ch in "‘’“”–—•" else "?" for ch in s)


def clean(text):
    """Escape a piece of DATA for reportlab's mini-XML parser.

    Anything that came out of the dataset or the editorial modules goes through
    here, so an ampersand in 'I&C SCI 31' or a stray angle bracket cannot be
    read as markup.
    """
    if text is None:
        return ""
    s = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return _winansi(s)


def rich(markup):
    """Pass through markup this file composed itself.

    The caller is responsible for having escaped every data fragment with
    clean() first. Escaping again here would turn the <b> and <br/> tags we
    deliberately added into visible text, which is exactly the bug this split
    exists to prevent.
    """
    return _winansi(str(markup))


# --------------------------------------------------------------------------- styles

ss = getSampleStyleSheet()


def style(name, **kw):
    base = kw.pop("parent", ss["BodyText"])
    return ParagraphStyle(name, parent=base, **kw)


S = {
    "title": style("gTitle", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=30,
                   leading=35, textColor=ACCENT, spaceAfter=6),
    "subtitle": style("gSub", fontName="Helvetica", fontSize=13, leading=18,
                      textColor=MUTED, alignment=TA_CENTER),
    "part": style("gPart", fontName="Helvetica-Bold", fontSize=24, leading=28,
                  textColor=ACCENT, spaceBefore=0, spaceAfter=10),
    "h1": style("gH1", fontName="Helvetica-Bold", fontSize=17, leading=21,
                textColor=ACCENT, spaceBefore=14, spaceAfter=7),
    "h2": style("gH2", fontName="Helvetica-Bold", fontSize=13, leading=17,
                textColor=INK, spaceBefore=12, spaceAfter=5),
    "h3": style("gH3", fontName="Helvetica-Bold", fontSize=10.5, leading=14,
                textColor=MUTED, spaceBefore=9, spaceAfter=3),
    "body": style("gBody", fontName="Helvetica", fontSize=9.7, leading=13.8,
                  textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6),
    "small": style("gSmall", fontName="Helvetica", fontSize=8.3, leading=11.4,
                   textColor=MUTED, spaceAfter=4),
    "tiny": style("gTiny", fontName="Helvetica", fontSize=7.2, leading=9.6,
                  textColor=SUBTLE, spaceAfter=3),
    "bullet": style("gBul", fontName="Helvetica", fontSize=9.5, leading=13.2,
                    textColor=INK, spaceAfter=2.5),
    "cell": style("gCell", fontName="Helvetica", fontSize=8.4, leading=11.4, textColor=INK),
    "cellb": style("gCellB", fontName="Helvetica-Bold", fontSize=8.4, leading=11.4, textColor=INK),
    "callout": style("gCall", fontName="Helvetica", fontSize=9.2, leading=12.8, textColor=INK),
    "calloutTitle": style("gCallT", fontName="Helvetica-Bold", fontSize=9.6, leading=13,
                          textColor=ACCENT, spaceAfter=3),
    "toc1": style("gToc1", fontName="Helvetica-Bold", fontSize=10.5, leading=16, textColor=ACCENT),
    "toc2": style("gToc2", fontName="Helvetica", fontSize=9.3, leading=13.4,
                  textColor=INK, leftIndent=14),
}


def P(text, s="body"):
    """Paragraph from DATA - escaped."""
    return Paragraph(clean(text), S[s])


def PR(markup, s="body"):
    """Paragraph from markup this file composed - not escaped again.

    Every data fragment inside `markup` must already have been through clean().
    """
    return Paragraph(rich(markup), S[s])


def bullets(items, s="bullet"):
    return ListFlowable(
        [ListItem(Paragraph(clean(i), S[s]), leftIndent=12) for i in items],
        bulletType="bullet", bulletFontSize=6, bulletOffsetY=1.5,
        leftIndent=13, start="circle", spaceAfter=6,
    )


def kv_table(rows, widths=(2.05 * inch, 4.35 * inch), header=None, rich_values=False):
    render = rich if rich_values else clean
    data = []
    if header:
        data.append([Paragraph(clean(h), S["cellb"]) for h in header])
    for k, v in rows:
        data.append([Paragraph(clean(k), S["cellb"]), Paragraph(render(v), S["cell"])])
    t = Table(data, colWidths=list(widths), hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), BAND), ("LEFTPADDING", (0, 0), (-1, 0), 4)]
    t.setStyle(TableStyle(cmds))
    return t


def wide_table(header, rows, widths):
    data = [[Paragraph(clean(h), S["cellb"]) for h in header]]
    for r in rows:
        data.append([Paragraph(clean(c), S["cell"]) for c in r])
    t = Table(data, colWidths=list(widths), hAlign="LEFT", repeatRows=1)
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, 0), BAND),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def callout(title, text, tone="info"):
    bg, edge = (WARN_BG, WARN_EDGE) if tone == "warn" else (
        (STOP_BG, STOP_EDGE) if tone == "stop" else (BAND, ACCENT))
    inner = [Paragraph(clean(title), S["calloutTitle"])] if title else []
    inner.append(Paragraph(clean(text), S["callout"]))
    t = Table([[inner]], colWidths=[6.4 * inch], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, edge),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return [Spacer(1, 3), t, Spacer(1, 8)]


# --------------------------------------------------------------- dataset rendering

NECESSITY = {"required": "Required", "recommended": "Recommended", "competitive": "Competitive edge"}
CONFIDENCE = {
    "published_requirement": "the school publishes this as a transfer requirement",
    "mapped_from_catalogue": "published requirement, UCI equivalent mapped from catalogues",
    "inferred_from_curriculum": "read from the degree curriculum, not a published transfer rule",
    "stated_informally": "stated informally by the school",
}
TESTING = {
    "required": "Required",
    "required_with_waiver": "Required, waiver available",
    "optional": "Optional",
    "recommended": "Recommended",
    "not_used": "Not used",
}


def describe(node, top=True):
    """Render a satisfaction tree as the UCI coursework it asks for.

    Groups are parenthesised when nested, because "A + B or C" is ambiguous and
    the difference between "(A + B) or C" and "A + (B or C)" changes which
    classes a student actually has to take. Long alternative lists are trimmed
    with an explicit count rather than a vague "or equivalent", so the reader
    knows something was elided and how much.
    """
    kind = node["kind"]
    if kind == "course":
        return node["code"]
    if kind == "all_of":
        parts = [describe(c, False) for c in node["children"]]
        joined = " + ".join(parts)
        return joined if top or len(parts) == 1 else "(" + joined + ")"
    if kind == "any_of":
        parts = []
        for child in node["children"]:
            d = describe(child, False)
            if d not in parts:
                parts.append(d)
        if len(parts) > 4:
            joined = ", ".join(parts[:3]) + ", or %d other UCI options" % (len(parts) - 3)
        elif len(parts) == 1:
            return parts[0]
        else:
            joined = " or ".join(parts)
        return joined if top else "(" + joined + ")"
    if kind == "n_of":
        return "%d of: %s" % (node["n"], "; ".join(describe(c, False) for c in node["children"]))
    if kind == "course_range":
        return node["filter"]["description"]
    if kind == "external_evidence":
        return "Evidence you supply - " + node["prompt"]
    return "?"


def requirement_rows(reqs, necessity):
    rows = []
    for r in reqs:
        if r["necessity"] != necessity:
            continue
        target = " / ".join(r.get("targetCourses") or [])
        left = r["title"] + (" [%s]" % target if target else "")
        detail = "<b>At UCI:</b> " + clean(describe(r["satisfiedBy"]))
        if r.get("minGrade"):
            detail += "<br/><b>Minimum grade:</b> " + clean(r["minGrade"])
        if r.get("letterGradeRequired"):
            detail += "<br/>Must be letter graded."
        if r.get("additional"):
            detail += "<br/>Must be additional to the named science courses above."
        if r.get("note"):
            detail += "<br/><i>" + clean(r["note"]) + "</i>"
        detail += "<br/><font size=7 color=\'#6b7789\'>Source basis: %s</font>" % clean(
            CONFIDENCE.get(r["confidence"], r["confidence"]))
        rows.append((left, detail))
    return rows


def program_flow(inst, prog, h2, h3):
    """One programme section."""
    flow = []
    heading = "%s - %s" % (prog["name"], prog["degree"])
    flow.append(Paragraph(clean(heading), h2))
    flow.append(PR("<b>Admitting unit:</b> " + clean(prog["admittingUnit"]), "small"))

    elig = prog["eligibility"]
    if elig.get("closedToTransfer"):
        flow += callout("Closed to external transfer applicants", elig["closedToTransfer"], "stop")

    facts = [
        ("Entry terms", ", ".join(t.capitalize() for t in elig["entryTerms"]) or "Not stated"),
        ("Deadlines", "; ".join(elig["deadlines"]) or "See the school"),
        ("Standardized testing", TESTING.get(elig["testing"], elig["testing"])),
        ("Admits directly to this major", "Yes" if elig["admitsDirectlyToMajor"]
         else "No - you are admitted to the school or college, then declare"),
    ]
    if prog.get("sharedAdmissionWith"):
        facts.append(("Shares one admission decision with",
                      "%d other programme(s) on your list - applying to both is the same decision, "
                      "not two chances" % len(prog["sharedAdmissionWith"])))
    flow.append(kv_table(facts))
    flow.append(Spacer(1, 7))

    if prog.get("cautions"):
        flow.append(Paragraph("Things to know before you apply", h3))
        flow.append(bullets(prog["cautions"]))

    for nec, label, blurb in [
        ("required", "Required coursework",
         "The school publishes these as transfer requirements."),
        ("recommended", "Recommended preparation",
         "Named by the school as expected preparation, or read from the degree curriculum."),
        ("competitive", "What competitive applicants have",
         "Not named by the school, but characteristic of successful applicants."),
    ]:
        rows = requirement_rows(prog["requirements"], nec)
        if not rows:
            continue
        flow.append(Paragraph(label, h3))
        flow.append(P(blurb, "tiny"))
        flow.append(kv_table(rows, widths=(2.15 * inch, 4.25 * inch), rich_values=True))
        flow.append(Spacer(1, 6))

    if not any(r["necessity"] == "required" for r in prog["requirements"]):
        flow += callout(
            "This school publishes no required transfer course list",
            "Nothing here is a checklist you can complete. Readiness rests on your grades, the rigour of "
            "your UC Irvine curriculum, and the eligibility rules below. The preparation listed above is "
            "the closest published signal of what the programme expects.")

    prog_rules = [r for r in elig["rules"]]
    if prog_rules:
        flow.append(Paragraph("Programme-specific rules", h3))
        block = [(r["title"] + (" [blocking]" if r["severity"] == "blocking" else ""), r["detail"])
                 for r in prog_rules]
        flow.append(kv_table(block, widths=(2.15 * inch, 4.25 * inch)))
        flow.append(Spacer(1, 6))

    cycles = [c for c in prog.get("cycles", []) if c["entryYear"] == 2028]
    if cycles:
        flow.append(Paragraph("Application cycle for Fall 2028 entry", h3))
        rows = []
        for c in cycles:
            when = c.get("applicationDeadline") or "not yet published"
            label = c["entryTerm"].capitalize() + (" - " + c["round"] if c.get("round") else "")
            note = c["timingLabel"] + " (" + (c.get("courseworkCutoff") or "-") + ")"
            if c.get("historicalEstimate"):
                note += " - historical estimate, not a published date"
            elif c.get("projected"):
                note += " - projected from the school's recurring date"
            rows.append([label, when, note])
        flow.append(wide_table(["Entry", "Apply by", "Coursework counted through"],
                               rows, [1.05 * inch, 1.15 * inch, 4.2 * inch]))
        flow.append(Spacer(1, 5))
        flow.append(P(cycles[0]["timingExplanation"], "tiny"))

    srcs = list(dict.fromkeys(prog["sourceUrls"]))
    flow.append(Spacer(1, 4))
    flow.append(P("Sources: " + " | ".join(srcs) + "  -  read on " + prog["retrievedAt"], "tiny"))
    flow.append(Spacer(1, 12))
    return flow


# ------------------------------------------------------------------- document shell

class Guide(BaseDocTemplate):
    """Adds outline entries and a table of contents."""

    def __init__(self, path, **kw):
        BaseDocTemplate.__init__(self, path, **kw)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates([
            PageTemplate(id="cover", frames=[frame], onPage=self._cover_page),
            PageTemplate(id="body", frames=[frame], onPage=self._body_page),
        ])

    def _cover_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(ACCENT)
        canvas.rect(0, letter[1] - 1.15 * inch, letter[0], 1.15 * inch, stroke=0, fill=1)
        canvas.setFillColor(GOLD)
        canvas.rect(0, letter[1] - 1.22 * inch, letter[0], 0.07 * inch, stroke=0, fill=1)
        canvas.restoreState()

    def _body_page(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, letter[1] - 0.72 * inch,
                    letter[0] - doc.rightMargin, letter[1] - 0.72 * inch)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(SUBTLE)
        canvas.drawString(doc.leftMargin, letter[1] - 0.62 * inch,
                          "Transfer Guide for a UC Irvine Computer Science and Mathematics student")
        canvas.drawRightString(letter[0] - doc.rightMargin, letter[1] - 0.62 * inch,
                               "Sources read 31 August 2026")
        canvas.line(doc.leftMargin, 0.68 * inch, letter[0] - doc.rightMargin, 0.68 * inch)
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(letter[0] / 2.0, 0.5 * inch, str(canvas.getPageNumber()))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(doc.leftMargin, 0.5 * inch, "Unofficial planning aid - verify with each school")
        canvas.restoreState()

    _outline_seq = 0

    def _outline(self, text, level, closed):
        """A PDF outline entry needs a destination that actually exists, so the
        page has to be bookmarked under the same key before it is referenced."""
        Guide._outline_seq += 1
        key = "sec%d" % Guide._outline_seq
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text[:110], key, level, closed)

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        name = flowable.style.name
        text = flowable.getPlainText()
        if name in ("gPart", "gSchool"):
            if text.strip() != "Contents":
                self.notify("TOCEntry", (0, text, self.page))
            self._outline(text, 0, True)
        elif name == "gProgH":
            self.notify("TOCEntry", (1, text, self.page))
            self._outline(text, 1, False)
        elif name == "gH1":
            self.notify("TOCEntry", (1, text, self.page))
            self._outline(text, 1, False)


S["school"] = style("gSchool", fontName="Helvetica-Bold", fontSize=20, leading=24,
                    textColor=ACCENT, spaceBefore=0, spaceAfter=4)
S["progH"] = style("gProgH", fontName="Helvetica-Bold", fontSize=13, leading=17,
                   textColor=INK, spaceBefore=13, spaceAfter=5)


def build():
    doc = Guide(OUT, pagesize=letter,
                leftMargin=0.85 * inch, rightMargin=0.85 * inch,
                topMargin=0.95 * inch, bottomMargin=0.9 * inch,
                title="Transfer Guide - 27 Universities",
                author="ZotPath", subject="Undergraduate transfer admission")
    story = []

    # ---- cover
    story.append(Spacer(1, 1.4 * inch))
    story.append(Paragraph("Transferring Out of UC Irvine", S["title"]))
    story.append(Spacer(1, 6))
    story.append(PR(
        "A complete guide to twenty-seven universities and seventy-two programmes<br/>"
        "for a Computer Science and Mathematics student", "subtitle"))
    story.append(Spacer(1, 30))
    story.append(callout(
        "How to read this document",
        "Part I explains the transfer process from nothing, then applies it to your situation. Part II "
        "gives every university a chapter and every programme its own section: admission statistics, "
        "required and recommended coursework mapped onto real UC Irvine courses, the rules that decide "
        "eligibility, deadlines, and the warnings that matter. Part III holds the reference tables.")[1])
    story.append(Spacer(1, 20))
    story.append(kv_table([
        ("Prepared for", "A UC Irvine undergraduate in Computer Science, B.S. with a Mathematics second major"),
        ("Entering", "Fall 2026, 2026-27 catalogue"),
        ("Covers", "27 universities, 72 programme targets, %d requirements"
                   % sum(len(p["requirements"]) for i in DATA for p in i["programs"])),
        ("Sources read", "31 August 2026 - every claim links the page it came from"),
        ("Status", "Unofficial planning aid. Not advice from any university. Verify before you rely on it."),
    ], widths=(1.5 * inch, 4.9 * inch)))
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ---- contents
    toc = TableOfContents()
    toc.levelStyles = [S["toc1"], S["toc2"]]
    story.append(Paragraph("Contents", S["part"]))
    story.append(Spacer(1, 6))
    story.append(toc)
    story.append(PageBreak())

    # ---- Part I
    story.append(Paragraph("Part I - How transferring works, and what it means for you", S["part"]))
    for kind, *rest in narrative.INTRO:
        if kind == "p":
            story.append(P(rest[0]))
        elif kind == "callout":
            story += callout(rest[0], rest[1], "warn")
    for heading, blocks in narrative.SECTIONS:
        story.append(Paragraph(clean(heading), S["h1"]))
        for block in blocks:
            kind = block[0]
            if kind == "p":
                story.append(P(block[1]))
            elif kind == "sub":
                story.append(Paragraph(clean(block[1]), S["h3"]))
            elif kind == "bullets":
                story.append(bullets(block[1]))
            elif kind == "callout":
                story += callout(block[1], block[2], "warn")
            elif kind == "table":
                story.append(wide_table(block[1], block[2], [1.45 * inch, 4.95 * inch]))
                story.append(Spacer(1, 8))
    story.append(PageBreak())

    # ---- Part II
    story.append(Paragraph("Part II - The universities", S["part"]))
    story.append(P(
        "Each chapter opens with the admission statistics and the rules that apply to every programme at "
        "that university, then takes the programmes one at a time. Where a school shares one admission "
        "decision across several of your chosen majors, that is stated - applying to both is one decision, "
        "not two chances."))
    story.append(PageBreak())

    for inst in DATA:
        story += school_flow(inst)

    # ---- Part III
    story.append(Paragraph("Part III - Reference", S["part"]))
    story += appendices()

    doc.multiBuild(story)
    return OUT


def school_flow(inst):
    flow = [Paragraph(clean(inst["name"]), S["school"])]
    flow.append(P("%s calendar%s" % (
        inst["calendar"].capitalize(),
        " - the same as UC Irvine, so course counts map across without conversion"
        if inst["calendar"] == "quarter"
        else " - one UCI quarter unit is worth two thirds of a semester unit here"), "small"))

    st = context.STATS[inst["id"]]
    flow.append(Paragraph("Admission statistics", S["h2"]))
    flow += callout(None, st["headline"])
    flow.append(kv_table(st["rows"], widths=(2.6 * inch, 3.8 * inch)))
    flow.append(Spacer(1, 6))
    flow.append(P(st["note"], "small"))
    prov = context.PROVENANCE_LABEL[st["provenance"]]
    line = "Provenance: " + prov + "."
    if st.get("source"):
        line += " " + st["source"]
    flow.append(P(line, "tiny"))

    policy = inst.get("examCreditPolicy")
    if policy:
        flow.append(Paragraph("How this school treats your AP and exam credit", S["h2"]))
        tone = "stop" if policy["coursework"] == "not_accepted" else "warn"
        flow += callout(
            "Exam credit: " + ("not accepted for coursework" if policy["coursework"] == "not_accepted"
                               else "decided case by case"),
            policy["detail"] + "  In practice: take the real course at UC Irvine even where an exam "
            "already gave you credit, because this school will not carry that exam across.", tone)

    rules = inst["institutionRules"]
    if rules:
        flow.append(Paragraph("Rules that apply to every programme here", S["h2"]))
        flow.append(kv_table(
            [(r["title"] + (" [blocking]" if r["severity"] == "blocking" else ""), r["detail"])
             for r in rules], widths=(2.15 * inch, 4.25 * inch)))
        flow.append(Spacer(1, 8))

    flow.append(Paragraph("Programmes on your list", S["h2"]))
    names = ", ".join("%s (%s)" % (p["name"], p["degree"]) for p in inst["programs"])
    flow.append(P(names, "small"))

    for prog in inst["programs"]:
        flow.append(Spacer(1, 4))
        flow += program_flow(inst, prog, S["progH"], S["h3"])

    flow.append(P("University-wide sources: " + " | ".join(inst["institutionSourceUrls"]), "tiny"))
    flow.append(PageBreak())
    return flow


def appendices():
    flow = []

    # A - course mapping
    flow.append(Paragraph("Appendix A - What your UC Irvine courses stand in for", S["h1"]))
    flow.append(P(
        "Every requirement in this document resolves to real UC Irvine courses. This table counts the "
        "programmes where each UCI course can satisfy something, so you can see which classes do the most "
        "work for you. A course near the top earns its place in your plan several times over. Note that a "
        "course listed as one of several accepted alternatives still counts here, which is why the "
        "chemistry and Humanities Core options appear: they are the second route to a requirement whose "
        "first route is another course."))
    counts = {}
    for inst in DATA:
        for prog in inst["programs"]:
            for r in prog["requirements"]:
                for code in codes_in(r["satisfiedBy"]):
                    counts.setdefault(code, set()).add(prog["id"])
    rows = sorted(counts.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    flow.append(wide_table(
        ["UCI course", "Programmes where it can count", "Share of the 72"],
        [[c, str(len(p)), "%d%%" % round(100.0 * len(p) / 72) ] for c, p in rows[:34]],
        [1.7 * inch, 2.6 * inch, 2.1 * inch]))
    flow.append(Spacer(1, 10))

    # B - deadline calendar
    flow.append(PageBreak())
    flow.append(Paragraph("Appendix B - Deadline calendar for Fall 2028 entry", S["h1"]))
    flow.append(P(
        "Sorted by date. 'Coursework counted through' is the last moment work can be finished and still "
        "count for that school, which is often later than the application deadline and occasionally "
        "earlier than you would expect."))
    cyc = []
    seen = set()
    for inst in DATA:
        for prog in inst["programs"]:
            for c in prog.get("cycles", []):
                if c["entryYear"] != 2028 or c["entryTerm"] != "fall":
                    continue
                key = (inst["id"], c.get("round"))
                if key in seen:
                    continue
                seen.add(key)
                cyc.append((c.get("applicationDeadline") or "9999-99-99", inst["shortName"],
                            c.get("round") or "", c.get("courseworkCutoff") or "-",
                            c["timingLabel"]))
    cyc.sort()
    flow.append(wide_table(
        ["Apply by", "University", "Round", "Coursework counted through"],
        [[d if d != "9999-99-99" else "not published", n, r, "%s - %s" % (cut, lab)]
         for d, n, r, cut, lab in cyc],
        [0.95 * inch, 1.25 * inch, 0.8 * inch, 3.4 * inch]))
    flow.append(Spacer(1, 10))

    # C - glossary
    flow.append(PageBreak())
    flow.append(Paragraph("Appendix C - Glossary", S["h1"]))
    flow.append(kv_table([
        ("Articulation agreement",
         "A formal, published contract saying course X at one school equals course Y at another. "
         "None exists between UC Irvine and any school in this document."),
        ("ASSIST",
         "California's official articulation system. It covers California community colleges only, which "
         "is why it cannot help you."),
        ("Junior standing",
         "Usually 60 semester units, which is 90 UC Irvine quarter units."),
        ("Impacted or capped or selective major",
         "A major with more qualified applicants than seats, admitting through a separate screen. At "
         "several schools you can never enter one after arriving."),
        ("Direct admission to the major",
         "Being admitted to the major itself rather than to the university. Where a school admits "
         "directly, being admitted without the major is a materially worse outcome."),
        ("Residency requirement",
         "The minimum amount of the degree that must be earned at the new school. It sets a floor on how "
         "long you will be there regardless of what you transfer in."),
        ("Common Data Set",
         "A standard statistical report most US universities publish. Section D covers transfer admission "
         "and is where the institution-level numbers in this guide come from."),
        ("Transfer Academic Update",
         "The January form UC applicants use to report autumn grades and planned spring coursework."),
        ("College Report or Dean's Certification",
         "A form an official at your current school completes confirming you are in good standing and "
         "eligible to return. It is sent by them, not by you."),
    ], widths=(1.75 * inch, 4.65 * inch)))

    # D - verification
    flow.append(PageBreak())
    flow.append(Paragraph("Appendix D - Before you rely on any of this", S["h1"]))
    flow.append(P(
        "This document was assembled by reading each school's own admissions pages on 31 August 2026. "
        "That is its strength and its expiry date. Admissions requirements change every year."))
    flow.append(bullets([
        "Re-read every programme page in the autumn before you apply. Deadlines move, testing policies "
        "reverse, and majors open and close.",
        "Cornell's closure of Computer Science to transfer applicants is published under a heading naming "
        "a single admissions cycle. Check whether it still holds for yours.",
        "Princeton's testing requirement returns for Fall 2028 entry, which is the cycle you would most "
        "likely use.",
        "Anything marked as read from a degree curriculum rather than a published transfer requirement is "
        "an inference. Treat it as preparation advice, not a checklist.",
        "Statistics marked as widely reported rather than published by the school should be confirmed in "
        "that school's own Common Data Set before you make a decision with them.",
        "Course equivalence is decided by the receiving department after you are admitted, usually from a "
        "syllabus. Keep your UC Irvine syllabi.",
    ]))
    flow += callout(
        "This is not advice from any university",
        "No university has reviewed this document. It cannot bind an admissions office, guarantee that a "
        "course will transfer, or predict a decision. Use it to prepare for conversations with UC Irvine "
        "academic advising and with the admissions offices themselves.", "warn")
    return flow


def codes_in(node, out=None):
    if out is None:
        out = []
    kind = node["kind"]
    if kind == "course":
        out.append(node["code"])
    elif kind in ("all_of", "any_of", "n_of"):
        for c in node["children"]:
            codes_in(c, out)
    elif kind == "course_range":
        for c in node["filter"].get("codes") or []:
            out.append(c)
    return out


if __name__ == "__main__":
    path = build()
    print("wrote", path, os.path.getsize(path), "bytes")
