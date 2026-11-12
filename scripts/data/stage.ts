/**
 * Copy the committed normalized snapshot into `public/` so Vite serves it as a
 * static asset instead of inlining ~7.6 MB into the JS bundle.
 *
 * Runs automatically before `dev` and `build`.
 */

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOGUE_YEAR } from '../../src/domain/schemaVersions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function main(): Promise<void> {
  const year = process.argv[2] ?? DEFAULT_CATALOGUE_YEAR;
  const sourceDir = path.join(ROOT, 'data', 'normalized', 'catalogue', year);
  const targetDir = path.join(ROOT, 'public', 'data', 'catalogue', year);
  const manifestDir = path.join(ROOT, 'data', 'manifests');
  const targetManifestDir = path.join(ROOT, 'public', 'data', 'manifests');

  if (!existsSync(path.join(sourceDir, 'courses.json'))) {
    console.error(
      `No normalized snapshot at ${path.relative(ROOT, sourceDir)}.\n` +
        'Run `npm run data:refresh` (needs network) or `npm run data:refresh:offline` (needs a cached raw snapshot).',
    );
    process.exit(1);
  }

  await mkdir(targetDir, { recursive: true });
  await mkdir(targetManifestDir, { recursive: true });

  for (const file of await readdir(sourceDir)) {
    if (!file.endsWith('.json')) continue;
    await copyFile(path.join(sourceDir, file), path.join(targetDir, file));
  }

  if (existsSync(path.join(manifestDir, 'latest.json'))) {
    await copyFile(path.join(manifestDir, 'latest.json'), path.join(targetManifestDir, 'latest.json'));
  } else {
    // Derive a pointer from the snapshot itself when no manifest exists.
    const snapshot = JSON.parse(await readFile(path.join(sourceDir, 'courses.json'), 'utf8')) as {
      buildId: string;
      catalogueYear: string;
      retrievedAt: string;
    };
    await writeFile(
      path.join(targetManifestDir, 'latest.json'),
      JSON.stringify(
        { buildId: snapshot.buildId, catalogueYear: snapshot.catalogueYear, retrievedAt: snapshot.retrievedAt },
        null,
        2,
      ),
      'utf8',
    );
  }

  console.log(`Staged catalogue ${year} into public/data.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
