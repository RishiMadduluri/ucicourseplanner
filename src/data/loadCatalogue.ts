import type { CatalogueSnapshot } from '../domain/courses/types';
import type { CatalogueState } from '../app/store';
import { cacheCatalogue, loadCachedCatalogue, newestCachedCatalogue } from '../persistence/db';

/**
 * Load the committed catalogue snapshot.
 *
 * Fetched once from a static asset, then cached in IndexedDB so the planner
 * stays usable without network access — the snapshot is a build artifact, not a
 * live query, so no scraping happens per search or per session.
 */

export interface ManifestPointer {
  buildId: string;
  catalogueYear: string;
  retrievedAt: string;
}

function toState(snapshot: CatalogueSnapshot): CatalogueState {
  const index = new Map(snapshot.courses.map((c) => [c.normalizedCode, c]));
  return {
    courses: snapshot.courses,
    index,
    allCodes: snapshot.courses.map((c) => c.normalizedCode),
    buildId: snapshot.buildId,
    catalogueYear: snapshot.catalogueYear,
    retrievedAt: snapshot.retrievedAt,
    parserErrorCount: snapshot.parserErrors.length,
  };
}

export interface LoadResult {
  catalogue: CatalogueState;
  /** True when served from the local IndexedDB cache rather than the network. */
  fromCache: boolean;
}

export async function loadCatalogue(catalogueYear: string, baseUrl = import.meta.env.BASE_URL || '/'): Promise<LoadResult> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  // 1. Find out which build we should have.
  let pointer: ManifestPointer | null = null;
  try {
    const response = await fetch(`${base}data/manifests/latest.json`);
    if (response.ok) pointer = (await response.json()) as ManifestPointer;
  } catch {
    // Offline is fine — fall through to the cache.
  }

  // 2. Serve from cache when it already matches.
  if (pointer) {
    const cached = await loadCachedCatalogue(pointer.buildId);
    if (cached) {
      return { catalogue: toState(cached.payload as CatalogueSnapshot), fromCache: true };
    }
  }

  // 3. Fetch the snapshot.
  try {
    const response = await fetch(`${base}data/catalogue/${catalogueYear}/courses.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = (await response.json()) as CatalogueSnapshot;

    await cacheCatalogue({
      buildId: snapshot.buildId,
      catalogueYear: snapshot.catalogueYear,
      retrievedAt: snapshot.retrievedAt,
      payload: snapshot,
    });
    return { catalogue: toState(snapshot), fromCache: false };
  } catch (error) {
    // 4. Keep the last good snapshot rather than showing an empty explorer.
    const fallback = await newestCachedCatalogue();
    if (fallback) {
      return { catalogue: toState(fallback.payload as CatalogueSnapshot), fromCache: true };
    }
    throw new Error(
      `Could not load the catalogue snapshot and no cached copy exists. Run \`npm run data:refresh\` to build one. (${(error as Error).message})`,
    );
  }
}
