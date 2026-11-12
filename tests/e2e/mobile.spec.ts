import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

/** Responsive behaviour: separate Courses, Plan, and Audit views on small screens. */


  test('uses separate Courses, Plan, and Audit views', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ZotPath' })).toBeVisible();
    await page.waitForTimeout(2000);
    await skipOnboarding(page);

    const tabs = page.getByRole('navigation', { name: 'Main views' });
    await expect(tabs).toBeVisible();

    // Plan is the default view.
    await expect(page.getByRole('heading', { name: 'Incoming Summer 2026' })).toBeVisible();

    await tabs.getByRole('button', { name: 'Courses' }).click();
    await expect(page.getByPlaceholder(/Search: COMPSCI 112/)).toBeVisible();

    await tabs.getByRole('button', { name: 'Audit' }).click();
    await expect(page.getByRole('heading', { name: 'Degree Audit' })).toBeVisible();
  });

  test('keeps transfer search and sorting usable at phone width', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ZotPath' })).toBeVisible();
    await page.waitForTimeout(2000);
    await skipOnboarding(page);

    await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();
    await expect(page.locator('.transfer-sub')).toContainText('72 programs across 27 universities');

    const search = page.getByPlaceholder('Search school or major');
    const sort = page.getByLabel('Sort transfer programs');
    await expect(search).toBeVisible();
    await expect(sort).toBeVisible();
    expect((await search.boundingBox())?.width).toBeGreaterThan(250);
    expect((await sort.boundingBox())?.width).toBeGreaterThan(250);

    const overflow = await page.locator('.transfer-workspace').evaluate((element) =>
      element.scrollWidth - element.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
