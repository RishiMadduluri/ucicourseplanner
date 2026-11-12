import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

/** Critical outbound-transfer paths, exercised against the production bundle. */

test('shows all targets and exposes exact program-name resolutions', async ({ page }) => {
  await openApp(page);
  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();

  await expect(page.getByRole('heading', { name: 'Transfer Readiness' })).toBeVisible();
  await expect(page.locator('.transfer-sub')).toContainText('72 programs across 27 universities');
  await expect(page.locator('.transfer-disclaimer')).toContainText('No school on this list has an articulation agreement with UCI');

  await page.getByPlaceholder('Search school or major').fill('NYU');
  await expect(page.getByRole('heading', { name: 'New York University' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'University of California, Berkeley' })).toHaveCount(0);

  await page.getByRole('button', { name: /Data Science, or Data Science and Mathematics/ }).click();
  await expect(page.locator('.transfer-detail')).toContainText('NO standalone undergraduate Statistics major');

  await page.getByRole('button', { name: /Mathematics and Computer Science/ }).click();
  await expect(page.locator('.transfer-detail')).toContainText('NOT a Tandon program');
});

test('persists the transfer point and adds a missing course directly to that term', async ({ page }) => {
  await openApp(page);
  const workspace = page.getByRole('group', { name: 'Workspace' });
  await workspace.getByRole('button', { name: 'Transfer' }).click();

  const transferPoint = page.getByLabel('Last UCI term before transferring');
  await transferPoint.selectOption('2027-spring');
  await expect(transferPoint).toHaveValue('2027-spring');

  await page.getByPlaceholder('Search school or major').fill('UC Berkeley');
  await page.getByRole('button', { name: /Electrical Engineering and Computer Sciences/ }).click();
  await page.getByRole('button', { name: 'Add MATH 2A' }).click();
  // The audit recalculates immediately, so this course disappears from the
  // remaining-gap actions once it has been placed.
  await expect(page.getByRole('button', { name: 'Add MATH 2A' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByPlaceholder(/Search: COMPSCI 112/)).toBeVisible({ timeout: 30_000 });
  await workspace.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByLabel('Last UCI term before transferring')).toHaveValue('2027-spring');

  await workspace.getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('.term-card', { hasText: 'Spring 2027' }).first()).toContainText('MATH 2A');
});

test('uses Yale exam-credit policy instead of carrying over UCI AP equivalency', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'External credit' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Exam', { exact: true }).selectOption({ label: 'Calculus BC' });
  await dialog.getByLabel('Score', { exact: true }).selectOption('5');
  await dialog.getByRole('button', { name: 'Save this exam' }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();
  await page.getByPlaceholder('Search school or major').fill('Yale');
  await page.getByRole('button', { name: /Electrical Engineering and Computer Science/ }).click();

  const detail = page.locator('.transfer-detail');
  await expect(detail.locator('.transfer-exam-policy')).toContainText('no transfer course credit for AP, IB');
  await expect(detail).toContainText('Exam-derived UCI credit (MATH 2A, MATH 2B) does not earn transfer credit here');
});

test('shows current entry terms, deadlines, and transfer-testing posture', async ({ page }) => {
  await openApp(page);
  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();

  await page.getByPlaceholder('Search school or major').fill('Georgia Tech');
  await page.getByRole('button', { name: /Computer Science/ }).click();

  const process = page.locator('.transfer-process-summary');
  await expect(process).toContainText('Fall, Spring, Summer');
  await expect(process).toContainText('January 18–March 1');
  await expect(process).toContainText('course requirements due May 30');
  await expect(process).toContainText('Transfer testing');
  await expect(process).toContainText('Optional');
});

test('uses a clearly labelled historical placeholder for UChicago cycles', async ({ page }) => {
  await openApp(page);
  await page.getByRole('group', { name: 'Workspace' }).getByRole('button', { name: 'Transfer' }).click();

  const checker = page.locator('.deadline-checker');
  const selectors = checker.locator('.deadline-selectors select');
  await selectors.nth(0).selectOption('uchicago');
  const cycle = selectors.nth(2);
  await expect(cycle.locator('option')).toContainText([
    'Transfer Early Decision — March 1, 2027 (historical estimate)',
    'Transfer Rolling Decision priority — March 1, 2027 (historical estimate)',
  ]);
  await cycle.selectOption('uchicago.college:uchicago.fall_ted:2027');

  await expect(checker.getByRole('note')).toContainText('Historical placeholder date');
  await expect(checker.getByRole('note')).toContainText('not a published date for this cycle');
  await expect(checker.locator('.deadline-timeline')).toContainText('March 1, 2027');
});
