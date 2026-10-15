import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([960, 540]);
    page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.1 * i, 0.3, 0.6) });
    page.drawText(`Slide ${i}`, { x: 330, y: 240, size: 72, font, color: rgb(1, 1, 1) });
  }
  return Buffer.from(await doc.save());
}

const cell = (page: Page, x: number, y: number) => page.locator(`[data-cell="${x},${y}"]`);
const current = (page: Page) => page.getByTestId('current-slide');

async function dragCell(page: Page, from: [number, number], to: [number, number]) {
  const a = (await cell(page, ...from).boundingBox())!;
  const b = (await cell(page, ...to).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('import a PDF, arrange on the grid, present in four directions, export/import', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New deck' }).click();
  await expect(page.getByLabel('Deck name')).toHaveValue('Untitled deck');

  await page.getByTestId('pdf-input').setInputFiles({
    name: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(3),
  });

  // Pages land left-to-right in the first row.
  await expect(page.locator('.cell.filled')).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(cell(page, i, 0)).toHaveClass(/filled/);
  await expect(cell(page, 0, 0).locator('.start-badge')).toBeVisible();

  // Drag page 3 under page 1.
  const p3 = await cell(page, 2, 0).getAttribute('data-slide');
  await dragCell(page, [2, 0], [0, 1]);
  await expect(cell(page, 0, 1)).toHaveAttribute('data-slide', p3!);
  await expect(cell(page, 2, 0)).toHaveClass(/empty/);

  await page.getByRole('button', { name: '▶ Present' }).click();
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p1');
  await page.keyboard.press('ArrowRight');
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p2');
  await page.keyboard.press('ArrowRight'); // nothing to the right of p2 any more
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p2');
  await page.keyboard.press('ArrowDown'); // nothing below p2 either
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p2');
  await page.keyboard.press('ArrowLeft');
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p1');
  await page.keyboard.press('ArrowDown');
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p3');
  await page.keyboard.press('ArrowUp');
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p1');

  // Position survives a reload, and the minimap jumps.
  await page.keyboard.press('ArrowDown');
  await page.reload();
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p3');
  await page.keyboard.press('m');
  await page.getByRole('button', { name: 'Go to slide at column 2, row 1' }).click();
  await expect(current(page)).toHaveAttribute('data-source', 'test.pdf p2');

  // Esc returns to the editor; the layout was persisted.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('grid')).toBeVisible();
  await page.reload();
  await expect(cell(page, 0, 1)).toHaveAttribute('data-slide', p3!);

  // Export, then import as a second deck.
  await page.getByRole('link', { name: 'All decks' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Untitled deck.omni');
  await page.getByTestId('omni-input').setInputFiles({
    name: 'deck.omni',
    mimeType: 'application/zip',
    buffer: await readFile(await download.path()),
  });
  await expect(page.locator('.deck-card')).toHaveCount(2);
  await page.locator('.deck-card').first().getByRole('link').first().click();
  await expect(page.locator('.cell.filled')).toHaveCount(3);
  await expect(page.locator('.cell.filled img').first()).toBeVisible();
});

test('editor keyboard: select, move with shift+arrows, delete', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-pdf-input').setInputFiles({
    name: 'two.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(2),
  });
  await expect(page.getByLabel('Deck name')).toHaveValue('two');
  await expect(page.locator('.cell.filled')).toHaveCount(2);

  await cell(page, 1, 0).click();
  await expect(cell(page, 1, 0)).toHaveClass(/selected/);
  await page.keyboard.press('Shift+ArrowDown');
  await expect(cell(page, 1, 1)).toHaveClass(/selected/);
  await expect(cell(page, 1, 0)).toHaveClass(/empty/);

  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.cell.filled')).toHaveCount(1);
});

test('editor undo/redo: moves, deletes (with images), and renames', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-pdf-input').setInputFiles({
    name: 'three.pdf',
    mimeType: 'application/pdf',
    buffer: await makePdf(3),
  });
  await expect(page.locator('.cell.filled')).toHaveCount(3);
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  const p2 = (await cell(page, 1, 0).getAttribute('data-slide'))!;
  const p3 = (await cell(page, 2, 0).getAttribute('data-slide'))!;

  // Undo a drag.
  await dragCell(page, [2, 0], [0, 1]);
  await expect(cell(page, 0, 1)).toHaveAttribute('data-slide', p3);
  await undo.click();
  await expect(cell(page, 2, 0)).toHaveAttribute('data-slide', p3);
  await expect(redo).toBeEnabled();

  // Delete p2, then bring it back with the keyboard shortcut.
  await cell(page, 1, 0).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.cell.filled')).toHaveCount(2);
  await expect(redo).toBeDisabled(); // a new change clears redo
  await page.keyboard.press('ControlOrMeta+z');
  await expect(cell(page, 1, 0)).toHaveAttribute('data-slide', p2);
  await expect(cell(page, 1, 0).locator('img')).toBeVisible();

  // The restored image is back in storage, not just in memory.
  await page.reload();
  await expect(page.locator('.cell.filled')).toHaveCount(3);
  await expect(cell(page, 1, 0).locator('img')).toBeVisible();
  await expect(undo).toBeDisabled(); // history doesn't survive a reload

  // Redo re-applies a delete.
  await cell(page, 1, 0).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await undo.click();
  await expect(page.locator('.cell.filled')).toHaveCount(3);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.locator('.cell.filled')).toHaveCount(2);
  await undo.click();

  // Typing a name is one undo step; a later edit after leaving the field is another.
  const name = page.getByLabel('Deck name');
  await name.selectText();
  await name.pressSequentially('Talk');
  await name.blur();
  await name.press('End');
  await name.pressSequentially('!');
  await name.blur();
  await expect(name).toHaveValue('Talk!');
  await undo.click();
  await expect(name).toHaveValue('Talk');
  await undo.click();
  await expect(name).toHaveValue('three');
});
