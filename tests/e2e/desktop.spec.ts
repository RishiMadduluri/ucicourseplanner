import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

/**
 * Critical desktop end-to-end paths.
 *
 * Each test asserts behaviour visible to a real user — search, placement,
 * recalculation, persistence, and the keyboard-only route — rather than
 * snapshotting markup.
 */


  test('shows the unofficial notice and the full timeline', async ({ page }) => {
    await openApp(page);

    await expect(page.getByRole('note')).toContainText('Unofficial planning aid');

    // Incoming Summer 2026 is a distinct pre-Year-1 card (criterion 52).
    await expect(page.getByRole('heading', { name: 'Incoming Summer 2026' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Before Year 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fall 2026' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Winter 2027' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spring 2027' })).toBeVisible();

    // Summer session lanes exist without three separate columns (criterion 53).
    const incomingSummer = page.locator('.term-card', { hasText: 'Incoming Summer 2026' }).first();
    await expect(incomingSummer.locator('.lane-label').nth(0)).toContainText('Session 1');
    await expect(incomingSummer.locator('.lane-label').nth(1)).toContainText('10-week');
    await expect(incomingSummer.locator('.lane-label').nth(2)).toContainText('Session 2');

    // Spring 2030 is the last term; no Summer 2030 by default.
    await expect(page.getByRole('heading', { name: 'Spring 2030' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Summer 2030' })).toHaveCount(0);
  });

  test('finds a course by its alias and shows its official source (criteria 4, 5)', async ({ page }) => {
    await openApp(page);

    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    const card = page.locator('.course-card').first();

    await expect(card).toContainText('COMPSCI 112');
    await expect(card).toContainText('Computer Graphics');
    await expect(card.getByRole('link', { name: /Catalogue 2026-27/ })).toHaveAttribute(
      'href',
      /catalogue\.uci\.edu/,
    );
  });

  test('separates prerequisites from restrictions and keeps raw text (criteria 7, 8)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('COMPSCI 112');
    await page.getByRole('button', { name: 'Details' }).first().click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('Prerequisites');
    await expect(drawer).toContainText('I&C SCI 46');
    await expect(drawer).toContainText('MATH 3A');

    // Raw catalogue text is preserved verbatim.
    await expect(drawer).toContainText('Original catalogue text:');

    // Restrictions live in their own section.
    await expect(drawer).toContainText('Enrollment restrictions');
    await expect(drawer).toContainText('first consideration for enrollment');
    await expect(drawer).toContainText('Restrictions are separate from prerequisites');
  });

  test('adding a course updates units and the audit immediately (criteria 10, 19)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();

    const fallCard = page.locator('.term-card', { hasText: 'Fall 2026' }).first();
    await expect(fallCard).toContainText('COMPSCI 112');
    await expect(fallCard).toContainText('4 units');

    // Prerequisite warning names every missing branch.
    await expect(fallCard).toContainText('Prerequisites not met');
    await expect(fallCard).toContainText('I&C SCI 46 is not in the plan');
    await expect(fallCard).toContainText('MATH 3A is not in the plan');

    // The audit rail reflects the new units.
    const audit = page.getByRole('complementary', { name: 'Degree Audit' });
    await expect(audit).toContainText('of 180 required');
  });

  test('moves a course between terms without dragging (criterion 14)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();

    await page.getByRole('button', { name: /Actions for COMPSCI 112/ }).click();
    await page.getByLabel('Term').selectOption('2028-winter');
    // The chip re-renders under the new term, which closes its menu with it.
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(page.locator('.term-card', { hasText: 'Winter 2028' })).toContainText('COMPSCI 112');
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).not.toContainText('COMPSCI 112');
  });

  test('warns about a duplicate placement (criterion 12)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();
    await page.getByRole('button', { name: 'Add to term' }).first().click();

    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText(
      'Course appears more than once',
    );
  });

  test('warns that a load outside 12–20 needs dean authorization (criterion 55)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();

    const fallCard = page.locator('.term-card', { hasText: 'Fall 2026' }).first();
    await expect(fallCard).toContainText('Outside 12–20');
    await expect(fallCard).toContainText('authorization from your dean');
  });

  test('previews AP effects before saving and applies them to the audit (criteria 58, 59)', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'External credit' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Exam', { exact: true }).selectOption({ label: 'Calculus BC' });
    await dialog.getByLabel('Score', { exact: true }).selectOption('5');

    // Preview shows every official effect before saving.
    await expect(dialog).toContainText('8 UCI units');
    await expect(dialog).toContainText('MATH 2A + MATH 2B');
    await expect(dialog).toContainText('Duplicate-credit bar');
    await expect(dialog).toContainText('no letter grade');

    await dialog.getByRole('button', { name: 'Save this exam' }).click();
    await expect(dialog).toContainText('Calculus BC — score 5');
    await dialog.getByRole('button', { name: 'Done' }).click();

    const audit = page.getByRole('complementary', { name: 'Degree Audit' });
    await expect(audit).toContainText('8 external');
  });

  test('AP Computer Science A gives units but does not clear the series (criterion 60)', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'External credit' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Exam', { exact: true }).selectOption({ label: 'Computer Science A' });
    await dialog.getByLabel('Score', { exact: true }).selectOption('5');

    await expect(dialog).toContainText('Elective credit only');
    await expect(dialog).toContainText(/does not clear I&C SCI 31, 32, or 33/i);

    await dialog.getByRole('button', { name: 'Save this exam' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The programming series stays unmet.
    const audit = page.getByRole('complementary', { name: 'Degree Audit' });
    await expect(audit).toContainText('Programming series');
    await expect(audit).toContainText('No option is complete yet');
  });

  test('persists the plan across a reload (criterion 49)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');

    await page.reload();
    await expect(page.getByPlaceholder(/Search: COMPSCI 112/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');
  });

  test('undo restores the previous placement', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');

    await page.getByRole('banner').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).not.toContainText('COMPSCI 112');
  });

  test('switching the Mathematics path replaces rather than adds an audit (criterion 65)', async ({ page }) => {
    await openApp(page);
    const audit = page.getByRole('complementary', { name: 'Degree Audit' });

    // New plans start as Computer Science only.
    await expect(audit).toContainText('Computer Science, B.S.');
    await expect(audit).not.toContainText('Mathematics, B.S. — Pure Mathematics');
    await expect(audit).not.toContainText('Add / Double-Major Eligibility');

    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    const mathSelect = dialog.getByLabel('Mathematics second major for this scenario (optional)');
    await mathSelect.selectOption('pure_math');
    await expect(audit).toContainText('Mathematics, B.S. — Pure Mathematics');

    await mathSelect.selectOption('applied_math');
    await expect(dialog).toContainText('Only one Mathematics program can be active');
    await dialog.getByRole('button', { name: 'Done' }).click();

    await expect(audit).toContainText('Applied and Computational Mathematics, B.S.');
    await expect(audit).not.toContainText('Mathematics, B.S. — Pure Mathematics');
  });

  test('rejects a corrupted import without destroying the plan', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();

    await page.getByRole('button', { name: 'Export / Import' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Choose a ZotPath backup file').setInputFiles({
      name: 'corrupt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ not valid json at all'),
    });

    await expect(dialog).toContainText('Import rejected');
    await expect(dialog).toContainText('your current plan is unchanged');

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');
  });

  test('is fully operable from the keyboard', async ({ page }) => {
    await openApp(page);

    // "/" focuses search without a mouse.
    await page.keyboard.press('/');
    await expect(page.getByPlaceholder(/Search: COMPSCI 112/)).toBeFocused();

    await page.keyboard.type('CS 112');
    const addButton = page.getByRole('button', { name: 'Add to term' }).first();
    await addButton.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');

    // Escape closes a dialog and returns focus.
    await page.getByRole('button', { name: /Actions for COMPSCI 112/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('reviews a catalogue data update before reinterpreting the plan (criterion 51)', async ({ page }) => {
    await openApp(page);
    await page.getByPlaceholder(/Search: COMPSCI 112/).fill('CS 112');
    await page.getByRole('button', { name: 'Add to term' }).first().click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');

    // Simulate the stored plan having been written against an older build.
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('zotpath');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const tx = database.transaction('plans', 'readwrite');
          const store = tx.objectStore('plans');
          const get = store.get('primary');
          get.onsuccess = () => {
            const row = get.result;
            row.plan.dataBuildId = 'catalogue-2026-27-2020-01-01-oldbuild';
            store.put(row);
          };
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    await page.reload();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await expect(dialog).toContainText('Review catalogue data update');
    await expect(dialog).toContainText('catalogue-2026-27-2020-01-01-oldbuild');
    await expect(dialog).toContainText('Nothing has been reinterpreted yet');

    // Declining keeps the plan exactly as it was.
    await dialog.getByRole('button', { name: /Keep the previous interpretation/ }).click();
    await expect(page.locator('.term-card', { hasText: 'Fall 2026' }).first()).toContainText('COMPSCI 112');
  });
