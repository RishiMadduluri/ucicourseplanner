/**
 * Central version constants. Every persisted or exported artifact carries one of
 * these so a future build can detect and migrate older data instead of silently
 * reinterpreting it (04_PLANNING_AND_AUDIT_ENGINE.md — Persistence and migration).
 */

/** Shape of the IndexedDB application store. Bump on any breaking store change. */
export const APP_DATA_SCHEMA_VERSION = 1;

/** Shape of the normalized build-time catalogue artifacts under `data/normalized`. */
export const CATALOGUE_DATA_SCHEMA_VERSION = 1;

/** Shape of the JSON file produced by Export / consumed by Import. */
export const PLAN_EXPORT_SCHEMA_VERSION = 1;

/** The catalogue edition this build seeds by default. */
export const DEFAULT_CATALOGUE_YEAR = '2026-27';

/** Human-facing product name. */
export const APP_NAME = 'ZotPath';

/** Shown wherever the app could be mistaken for an official audit. */
export const UNOFFICIAL_NOTICE =
  'Unofficial planning aid. Not DegreeWorks, WebReg, or an enrollment system. Verify every result with UCI academic advising.';
