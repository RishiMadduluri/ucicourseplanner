import { expect, type Page } from '@playwright/test';

/** Shared helpers for the end-to-end specs. */

/** Dismiss onboarding so the board is reachable. */
export async function skipOnboarding(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip setup' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Open the app and wait for the catalogue snapshot to finish loading. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ZotPath' })).toBeVisible();
  await expect(page.getByPlaceholder(/Search: COMPSCI 112/)).toBeVisible({ timeout: 30_000 });
  await skipOnboarding(page);
}

/**
 * Playwright already gives each test a fresh browser context, so IndexedDB
 * starts empty. An `addInitScript` delete would also fire on every in-test
 * reload, which would wrongly wipe the data a persistence test is checking.
 */
