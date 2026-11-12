/**
 * Offline plan review.
 *
 *   npm run plan:review -- ~/Downloads/zotpath-my-uci-plan-2026-08-31.json
 *
 * Validates an exported ZotPath backup and runs every domain engine over it,
 * then prints what is actually broken, what merely needs authorization, and what
 * the planner cannot decide on its own.
 *
 * Read-only: it never writes to the file or to any local database.
 *
 * Exit code 1 when a hard blocker is found, so it can gate a script.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseImport } from '../../src/persistence/exportImport';
import { runAudit } from '../../src/domain/audit/audit';
import { assessPlanner } from '../../src/domain/planner/warnings';
import { resolveExternalCredit } from '../../src/domain/externalCredit/resolve';
import { OFFERING_INDEX } from '../../src/data/offerings2026';
import { buildTimeline } from '../../src/domain/terms/terms';
import type { CatalogueSnapshot } from '../../src/domain/courses/types';
import { DEFAULT_CATALOGUE_YEAR } from '../../src/domain/schemaVersions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

interface Finding {
  severity: 'blocker' | 'violation' | 'authorization' | 'unmet' | 'verify';
  where: string;
  message: string;
}

function loadCatalogue(catalogueYear: string): CatalogueSnapshot {
  const file = path.join(ROOT, 'data', 'normalized', 'catalogue', catalogueYear, 'courses.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CatalogueSnapshot;
  } catch {
    console.error(
      `Could not read the ${catalogueYear} catalogue snapshot at ${path.relative(ROOT, file)}.\n` +
        'Run `npm run data:refresh` (or `npm run data:refresh:offline`) first.',
    );
    process.exit(2);
  }
}

/** Collect every finding from an already-computed audit and assessment. */
function collectFindings(
  audit: ReturnType<typeof runAudit>,
  assessment: ReturnType<typeof assessPlanner>,
  termOfPlacement: Map<string, string>,
): Finding[] {
  const findings: Finding[] = [];
  const scenarioTermOf = (id: string) => termOfPlacement.get(id);

  // ---- placement-level problems -------------------------------------------
  /** Repeated clauses (e.g. two unknown branches) read as noise; collapse them. */
  const tidy = (text: string) =>
    Array.from(new Set(text.split(/(?<=\.)\s+/).map((t) => t.trim()).filter(Boolean))).join(' ');

  for (const [, placement] of assessment.byPlacement) {
    const termId = scenarioTermOf(placement.placementId);
    const term = termId ? `${placement.code} (${termId})` : placement.code;
    for (const w of placement.warnings) {
      if (w.kind === 'prerequisite' && w.severity === 'warning') {
        findings.push({ severity: 'violation', where: term, message: `Prerequisites not met — ${tidy(w.detail)}` });
      } else if (w.kind === 'corequisite') {
        findings.push({ severity: 'violation', where: term, message: `Corequisite not met — ${tidy(w.detail)}` });
      } else if (w.kind === 'duplicate' || w.kind === 'duplicate_external') {
        findings.push({ severity: 'violation', where: term, message: `${w.title} — ${tidy(w.detail)}` });
      } else if (w.kind === 'prerequisite' && w.severity === 'info') {
        findings.push({ severity: 'verify', where: term, message: `Prerequisites need review — ${tidy(w.detail)}` });
      } else if (w.kind === 'offering') {
        findings.push({ severity: 'verify', where: term, message: `${w.title} — ${tidy(w.detail)}` });
      }
    }
  }

  // ---- term loads ----------------------------------------------------------
  for (const [termId, term] of assessment.byTerm) {
    for (const issue of term.loadIssues) {
      if (issue.severity === 'invalid') {
        findings.push({ severity: 'blocker', where: termId, message: `${issue.message} ${issue.resolution}` });
      } else if (issue.severity === 'warning' && !issue.overridden) {
        findings.push({ severity: 'authorization', where: termId, message: `${issue.message} ${issue.resolution}` });
      }
    }
  }
  for (const [year, summer] of assessment.bySummer) {
    for (const issue of summer.loadIssues) {
      if (issue.severity === 'invalid') {
        findings.push({ severity: 'blocker', where: `Summer ${year}`, message: `${issue.message} ${issue.resolution}` });
      } else if (issue.severity === 'warning' && !issue.overridden) {
        findings.push({ severity: 'authorization', where: `Summer ${year}`, message: `${issue.message} ${issue.resolution}` });
      }
    }
  }

  // ---- degree requirements -------------------------------------------------
  const walk = (nodes: typeof audit.allocation.programs[number]['requirements'], programTitle: string) => {
    for (const r of nodes) {
      if (r.state === 'unmet') {
        findings.push({ severity: 'unmet', where: programTitle, message: `${r.title} — ${r.detail}` });
      } else if (r.state === 'at_risk') {
        findings.push({ severity: 'violation', where: programTitle, message: `At risk: ${r.title} — ${r.detail}` });
      } else if (r.state === 'unknown') {
        findings.push({ severity: 'verify', where: programTitle, message: `${r.title} — ${r.detail}` });
      }
    }
  };
  for (const program of audit.allocation.programs) walk(program.requirements, program.title);

  // ---- units ---------------------------------------------------------------
  if (audit.units.projected < 180) {
    findings.push({
      severity: 'unmet',
      where: 'UCI Degree Requirements',
      message: `Projected ${audit.units.projected} units is below the 180-unit minimum (short by ${(180 - audit.units.projected).toFixed(1)}).`,
    });
  }

  return findings;
}

function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npm run plan:review -- <path-to-exported-plan.json>');
    process.exit(2);
  }

  let raw: string;
  try {
    raw = readFileSync(file.replace(/^~/, process.env.HOME ?? '~'), 'utf8');
  } catch (error) {
    console.error(`Could not read ${file}: ${(error as Error).message}`);
    process.exit(2);
  }

  const parsed = parseImport(raw);
  if (!parsed.ok) {
    console.error(`${RED}${BOLD}This file is not a valid ZotPath export.${RESET}`);
    for (const e of parsed.errors) console.error(`  • ${e}`);
    process.exit(2);
  }

  const plan = parsed.plan;
  const snapshot = loadCatalogue(plan.profile.catalogueYear || DEFAULT_CATALOGUE_YEAR);
  const courseIndex = new Map(snapshot.courses.map((c) => [c.normalizedCode, c]));
  const allCourseCodes = snapshot.courses.map((c) => c.normalizedCode);

  console.log(`\n${BOLD}ZotPath plan review${RESET}`);
  console.log(`${DIM}Unofficial. Verify anything that matters with UCI academic advising.${RESET}\n`);
  console.log(`  Plan            ${plan.name}`);
  console.log(`  Catalogue year  ${plan.profile.catalogueYear}`);
  console.log(`  Graduation      ${plan.profile.graduationTermId}`);
  console.log(`  Scenarios       ${plan.scenarios.length}`);
  if (plan.dataBuildId !== snapshot.buildId) {
    console.log(`  ${YELLOW}Data build      plan read against ${plan.dataBuildId}, snapshot is ${snapshot.buildId}${RESET}`);
  }
  for (const w of parsed.warnings) console.log(`  ${YELLOW}Note            ${w}${RESET}`);

  let hardBlockers = 0;

  for (const scenario of plan.scenarios) {
    const timeline = buildTimeline({
      startYear: 2026,
      academicYears: 4,
      summersEnabled: plan.profile.workload.summersEnabled,
      graduationTermId: plan.profile.graduationTermId,
    });
    const external = resolveExternalCredit(scenario.externalExams, scenario.manualCredits);
    const assessment = assessPlanner({
      scenario,
      courseIndex,
      offeringIndex: OFFERING_INDEX,
      external,
      workload: plan.profile.workload,
      termIds: timeline.allTerms.map((t) => t.id),
    });
    const audit = runAudit({ plan, scenario, courseIndex, allCourseCodes });
    const termOfPlacement = new Map(
      scenario.plannedCourses.filter((p) => p.termId).map((p) => [p.id, p.termId!]),
    );
    const findings = collectFindings(audit, assessment, termOfPlacement);

    console.log(`\n${BOLD}${'─'.repeat(72)}${RESET}`);
    console.log(`${BOLD}Scenario: ${scenario.name}${RESET}  ${DIM}(${scenario.mathProgram})${RESET}`);
    console.log(
      `  ${scenario.plannedCourses.length} placements · ` +
        `${audit.units.completed} completed + ${audit.units.inProgress} in progress + ` +
        `${audit.units.planned} planned + ${audit.units.external} external = ` +
        `${BOLD}${audit.units.projected}${RESET} of 180 units`,
    );
    const gpas = audit.gpas.filter((g) => g.gpa !== undefined);
    if (gpas.length > 0) {
      console.log('  GPA: ' + gpas.map((g) => `${g.label} ${g.gpa!.toFixed(2)}`).join(' · '));
    }

    const groups: Array<[Finding['severity'], string, string]> = [
      ['blocker', `${RED}${BOLD}HARD BLOCKERS — invalid, no override can fix${RESET}`, RED],
      ['violation', `${RED}RULE PROBLEMS — the plan breaks a rule as written${RESET}`, RED],
      ['authorization', `${YELLOW}NEEDS AUTHORIZATION — legal, but requires approval${RESET}`, YELLOW],
      ['unmet', `${YELLOW}NOT YET SATISFIED — degree requirements still open${RESET}`, YELLOW],
      ['verify', `${MAGENTA}NEEDS VERIFICATION — the planner cannot decide these${RESET}`, MAGENTA],
    ];

    for (const [severity, heading, colour] of groups) {
      const items = findings.filter((f) => f.severity === severity);
      if (items.length === 0) continue;
      if (severity === 'blocker') hardBlockers += items.length;

      console.log(`\n  ${heading}  ${DIM}(${items.length})${RESET}`);
      const shown = severity === 'unmet' || severity === 'verify' ? items.slice(0, 15) : items;
      for (const f of shown) {
        console.log(`    ${colour}•${RESET} ${BOLD}${f.where}${RESET}: ${f.message}`);
      }
      if (items.length > shown.length) {
        console.log(`    ${DIM}… and ${items.length - shown.length} more${RESET}`);
      }
    }

    const clean =
      findings.filter((f) => f.severity === 'blocker' || f.severity === 'violation').length === 0;
    if (clean) {
      console.log(`\n  ${GREEN}✓ No rule violations found in this scenario.${RESET}`);
    }
  }

  console.log(`\n${BOLD}${'─'.repeat(72)}${RESET}`);
  if (hardBlockers > 0) {
    console.log(`${RED}${BOLD}${hardBlockers} hard blocker(s) found.${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}No hard blockers.${RESET} ${DIM}Review the sections above before enrolling.${RESET}\n`);
}

main();
