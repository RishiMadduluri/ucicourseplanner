/**
 * Source-link check for the transfer dataset.
 *
 * Every claim in `src/domain/transfer` carries a source URL, and the whole
 * point of that promise is that a reader can open the page and check the claim
 * themselves. A URL that 404s quietly turns a cited fact into an unsourced one,
 * so this script fetches each distinct URL and reports anything that does not
 * resolve.
 *
 * Deliberately a script and not a Vitest case: it needs the network, and the
 * unit suite must stay offline and deterministic. Run it after editing the
 * dataset, and whenever a school reorganises its admissions site.
 *
 *   npx tsx scripts/data/checkTransferLinks.ts
 *
 * Some admissions sites block non-browser traffic. Those answer 403/406/202
 * rather than 404; they are reported separately as "blocked, verify by hand"
 * instead of being called failures.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src', 'domain', 'transfer');
const URL_PATTERN = /https?:\/\/[^\s'"`)]+/g;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Codes that mean "a bot filter answered", not "the page is gone". */
const BLOCKED = new Set([202, 401, 403, 405, 406, 429]);

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full)));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

async function main(): Promise<void> {
  const files = await collectFiles(ROOT);
  const urls = new Map<string, Set<string>>();

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,]+$/, '');
      const seenIn = urls.get(url) ?? new Set<string>();
      seenIn.add(path.relative(process.cwd(), file));
      urls.set(url, seenIn);
    }
  }

  console.log(`Checking ${urls.size} distinct source URLs across ${files.length} files…\n`);

  const dead: string[] = [];
  const blocked: string[] = [];

  for (const [url, seenIn] of urls) {
    let status = 0;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = response.status;
    } catch {
      status = 0;
    }

    if (status === 200) continue;
    const line = `${status || 'ERR'}  ${url}\n      cited in ${[...seenIn].join(', ')}`;
    if (BLOCKED.has(status)) blocked.push(line);
    else dead.push(line);
  }

  if (blocked.length > 0) {
    console.log(`${blocked.length} URL(s) blocked a non-browser request — verify these by hand:\n`);
    console.log(blocked.join('\n') + '\n');
  }

  if (dead.length === 0) {
    console.log('No dead source URLs.');
    return;
  }

  console.error(`${dead.length} source URL(s) did not resolve:\n`);
  console.error(dead.join('\n'));
  process.exitCode = 1;
}

void main();
