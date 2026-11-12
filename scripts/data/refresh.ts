/**
 * Build-time catalogue ingestion.
 *
 *   npm run data:refresh            # fetch live, write raw + normalized + manifest
 *   npm run data:refresh -- --offline   # re-parse the newest cached raw snapshot
 *   npm run data:refresh -- --limit 5   # fetch only the first N departments
 *
 * Conservative request rate and a descriptive user agent, per
 * 03_DATA_SOURCES_AND_PREDICTIONS.md. Raw responses are cached under
 * data/raw/<source>/<retrieval-date>/ so a re-parse never needs the network.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDepartmentIndex, parseDepartmentPage } from '../../src/domain/courses/parseCatalogueHtml';
import type { CatalogueSnapshot, Course, ParserError } from '../../src/domain/courses/types';
import { CATALOGUE_DATA_SCHEMA_VERSION, DEFAULT_CATALOGUE_YEAR } from '../../src/domain/schemaVersions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOGUE_BASE = 'https://catalogue.uci.edu';
const INDEX_URL = `${CATALOGUE_BASE}/allcourses/`;
const USER_AGENT =
  'ZotPath/0.1 (personal UCI course-planning project; build-time catalogue snapshot; contact: local user)';
/** Politeness delay between department requests. */
const REQUEST_DELAY_MS = 700;
const MAX_RETRIES = 3;

interface Args {
  offline: boolean;
  limit: number | null;
  catalogueYear: string;
}

function parseArgs(argv: string[]): Args {
  const limitIndex = argv.indexOf('--limit');
  const yearIndex = argv.indexOf('--catalogue-year');
  return {
    offline: argv.includes('--offline'),
    limit: limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1] ?? '', 10) || null : null,
    catalogueYear: yearIndex >= 0 ? (argv[yearIndex + 1] ?? DEFAULT_CATALOGUE_YEAR) : DEFAULT_CATALOGUE_YEAR,
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(REQUEST_DELAY_MS * attempt * 2);
    }
  }
  throw new Error(`Failed after ${MAX_RETRIES} attempts: ${url} — ${String(lastError)}`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Newest dated directory under data/raw/catalogue, or null when none exists. */
async function newestRawDir(): Promise<string | null> {
  const base = path.join(ROOT, 'data', 'raw', 'catalogue');
  if (!existsSync(base)) return null;
  const entries = (await readdir(base, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const newest = entries.at(-1);
  return newest ? path.join(base, newest) : null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const retrievalDate = today();
  const retrievedAt = new Date().toISOString();
  const rawDir = path.join(ROOT, 'data', 'raw', 'catalogue', retrievalDate);
  const normalizedDir = path.join(ROOT, 'data', 'normalized', 'catalogue', args.catalogueYear);
  const manifestDir = path.join(ROOT, 'data', 'manifests');

  let sourceDir = rawDir;
  if (args.offline) {
    const cached = await newestRawDir();
    if (!cached) {
      console.error('No cached raw snapshot found. Run `npm run data:refresh` once with network access.');
      process.exit(1);
    }
    sourceDir = cached;
    console.log(`Offline mode — re-parsing cached snapshot at ${path.relative(ROOT, cached)}`);
  } else {
    await mkdir(rawDir, { recursive: true });
  }

  // ---- Department index -----------------------------------------------------
  let indexHtml: string;
  const indexPath = path.join(sourceDir, '_index.html');
  if (args.offline) {
    indexHtml = await readFile(indexPath, 'utf8');
  } else {
    console.log(`Fetching department index: ${INDEX_URL}`);
    indexHtml = await fetchText(INDEX_URL);
    await writeFile(indexPath, indexHtml, 'utf8');
  }

  let slugs = parseDepartmentIndex(indexHtml).filter((s) => s !== 'allcourses');
  if (args.limit) slugs = slugs.slice(0, args.limit);
  console.log(`Discovered ${slugs.length} department pages.`);

  // ---- Department pages -----------------------------------------------------
  const allCourses: Course[] = [];
  const allErrors: ParserError[] = [];
  const sourceHashes: Record<string, string> = { '_index.html': sha256(indexHtml) };
  const departmentReport: Array<{ slug: string; courses: number; errors: number }> = [];

  for (const [i, slug] of slugs.entries()) {
    const url = `${CATALOGUE_BASE}/allcourses/${slug}/`;
    const filePath = path.join(sourceDir, `${slug}.html`);
    let html: string;

    if (args.offline) {
      if (!existsSync(filePath)) {
        allErrors.push({
          department: slug,
          sourceUrl: url,
          stage: 'block',
          message: 'No cached page for this department in the offline snapshot.',
          rawExcerpt: '',
        });
        continue;
      }
      html = await readFile(filePath, 'utf8');
    } else {
      process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug} … `);
      try {
        html = await fetchText(url);
        await writeFile(filePath, html, 'utf8');
      } catch (error) {
        console.log('FAILED');
        allErrors.push({
          department: slug,
          sourceUrl: url,
          stage: 'block',
          message: `Fetch failed: ${String(error)}`,
          rawExcerpt: '',
        });
        continue;
      }
      await sleep(REQUEST_DELAY_MS);
    }

    sourceHashes[`${slug}.html`] = sha256(html);
    const { courses, errors } = parseDepartmentPage({
      html,
      departmentSlug: slug,
      sourceUrl: url,
      catalogueYear: args.catalogueYear,
      retrievedAt,
    });

    // De-duplicate: a cross-listed course can appear on two department pages.
    for (const course of courses) {
      if (!allCourses.some((c) => c.id === course.id)) allCourses.push(course);
    }
    allErrors.push(...errors);
    departmentReport.push({ slug, courses: courses.length, errors: errors.length });
    if (!args.offline) console.log(`${courses.length} courses`);
  }

  allCourses.sort((a, b) =>
    a.department === b.department
      ? a.numericValue - b.numericValue || a.number.localeCompare(b.number)
      : a.department.localeCompare(b.department),
  );

  // ---- Write normalized artifacts ------------------------------------------
  const buildId = `catalogue-${args.catalogueYear}-${retrievalDate}-${sha256(JSON.stringify(sourceHashes)).slice(0, 8)}`;

  const snapshot: CatalogueSnapshot = {
    schemaVersion: CATALOGUE_DATA_SCHEMA_VERSION,
    catalogueYear: args.catalogueYear,
    buildId,
    retrievedAt,
    sourceIndexUrl: INDEX_URL,
    departmentCount: slugs.length,
    courseCount: allCourses.length,
    courses: allCourses,
    parserErrors: allErrors,
  };

  await mkdir(normalizedDir, { recursive: true });
  await mkdir(manifestDir, { recursive: true });

  await writeFile(path.join(normalizedDir, 'courses.json'), JSON.stringify(snapshot), 'utf8');

  // Parser report is a separate, readable artifact so failures are visible
  // rather than silently dropped (acceptance criterion 2).
  const errorsByStage = allErrors.reduce<Record<string, number>>((acc, e) => {
    acc[e.stage] = (acc[e.stage] ?? 0) + 1;
    return acc;
  }, {});
  await writeFile(
    path.join(normalizedDir, 'parser-report.json'),
    JSON.stringify(
      {
        buildId,
        retrievedAt,
        departmentCount: slugs.length,
        departmentsParsed: departmentReport.length,
        courseCount: allCourses.length,
        errorCount: allErrors.length,
        errorsByStage,
        departments: departmentReport,
        errors: allErrors,
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    path.join(manifestDir, `${buildId}.json`),
    JSON.stringify(
      {
        buildId,
        schemaVersion: CATALOGUE_DATA_SCHEMA_VERSION,
        catalogueYear: args.catalogueYear,
        retrievedAt,
        retrievalDate,
        offline: args.offline,
        sources: [
          { url: INDEX_URL, kind: 'catalogue_index' },
          ...slugs.map((s) => ({ url: `${CATALOGUE_BASE}/allcourses/${s}/`, kind: 'catalogue_department' })),
        ],
        sourceHashes,
        courseCount: allCourses.length,
        departmentCount: slugs.length,
        parserErrorCount: allErrors.length,
      },
      null,
      2,
    ),
    'utf8',
  );

  // Pointer file the app imports so it always loads the newest build.
  await writeFile(
    path.join(ROOT, 'data', 'manifests', 'latest.json'),
    JSON.stringify({ buildId, catalogueYear: args.catalogueYear, retrievedAt }, null, 2),
    'utf8',
  );

  console.log('');
  console.log(`Build ${buildId}`);
  console.log(`  departments : ${slugs.length}`);
  console.log(`  courses     : ${allCourses.length}`);
  console.log(`  parser notes: ${allErrors.length} (${JSON.stringify(errorsByStage)})`);
  console.log(`  normalized  : ${path.relative(ROOT, normalizedDir)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
