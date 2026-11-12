import Dexie, { type Table } from 'dexie';
import type { Plan } from '../domain/plan/types';
import { APP_DATA_SCHEMA_VERSION } from '../domain/schemaVersions';

/**
 * Local-first persistence. Nothing leaves the browser — there is no backend,
 * no account, and no network write path in the MVP.
 */

export interface StoredPlan {
  id: string;
  plan: Plan;
  updatedAt: string;
}

/** Cached catalogue snapshot so search works offline after the first load. */
export interface StoredCatalogue {
  buildId: string;
  catalogueYear: string;
  retrievedAt: string;
  payload: unknown;
}

export interface StoredSetting {
  key: string;
  value: unknown;
}

export class ZotPathDatabase extends Dexie {
  plans!: Table<StoredPlan, string>;
  catalogues!: Table<StoredCatalogue, string>;
  settings!: Table<StoredSetting, string>;

  constructor(name = 'zotpath') {
    super(name);
    // Dexie's version number tracks the *store* shape. Bump alongside
    // APP_DATA_SCHEMA_VERSION when the object stores change.
    this.version(APP_DATA_SCHEMA_VERSION).stores({
      plans: 'id, updatedAt',
      catalogues: 'buildId, catalogueYear',
      settings: 'key',
    });
  }
}

export const db = new ZotPathDatabase();

export const ACTIVE_PLAN_ID = 'primary';

export async function savePlan(plan: Plan): Promise<void> {
  await db.plans.put({ id: plan.id, plan, updatedAt: new Date().toISOString() });
}

export async function loadPlan(id = ACTIVE_PLAN_ID): Promise<Plan | undefined> {
  const stored = await db.plans.get(id);
  return stored?.plan;
}

export async function deletePlan(id = ACTIVE_PLAN_ID): Promise<void> {
  await db.plans.delete(id);
}

export async function cacheCatalogue(entry: StoredCatalogue): Promise<void> {
  await db.catalogues.put(entry);
}

export async function loadCachedCatalogue(buildId: string): Promise<StoredCatalogue | undefined> {
  return db.catalogues.get(buildId);
}

export async function newestCachedCatalogue(): Promise<StoredCatalogue | undefined> {
  const all = await db.catalogues.toArray();
  return all.sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))[0];
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
