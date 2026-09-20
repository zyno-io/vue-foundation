import { expect, test, type Locator, type Page } from '@playwright/test';

import { demoSection, gotoDocsPage, screenshotDir } from './helpers';

/** Helper: get the smart-select input within a section */
function selectInput(page: Page, testid: string): Locator {
    return demoSection(page, testid).locator('.vf-smart-select input');
}

/** Helper: get the smart-select field (the input's wrapper) within a section */
function field(page: Page, testid: string): Locator {
    return demoSection(page, testid).locator('.vf-smart-select');
}

/** Helper: get the result text within a section */
function result(page: Page, testid: string): Locator {
    return demoSection(page, testid).locator('.result');
}

test.describe('Smart Select', () => {
    test.beforeEach(async ({ page }) => {
        await gotoDocsPage(page, 'components/vf-smart-select');
    });

    test.describe('Basic (label-field + value-field)', () => {
        test('opens dropdown and shows options', async ({ page }) => {
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            const options = page.locator('.vf-smart-select-options .option');
            await expect(options).toHaveCount(6);
            await expect(options.nth(0)).toContainText('Apple');
            await expect(options.nth(1)).toContainText('Banana');
            await expect(options.nth(2)).toContainText('Cherry');

            await page.screenshot({ path: `${screenshotDir}/smart-select-basic-open.png` });
        });

        test('selects option and emits value-field value', async ({ page }) => {
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            await page.locator('.vf-smart-select-options .option:has-text("Banana")').click();
            await expect(page.locator('.vf-smart-select-options')).toHaveCount(0);
            await expect(selectInput(page, 'demo-ss-basic')).toHaveValue('Banana');
            await expect(result(page, 'demo-ss-basic')).toContainText('2');

            await page.screenshot({ path: `${screenshotDir}/smart-select-selected.png` });
        });

        test('filters options when typing', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-basic');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await input.pressSequentially('cher');

            const options = page.locator('.vf-smart-select-options .option');
            await expect(options).toHaveCount(1);
            await expect(options.first()).toContainText('Cherry');

            await page.screenshot({ path: `${screenshotDir}/smart-select-filtered.png` });
        });

        test('highlights the search term and clears the highlights when the search is cleared', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-basic');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            const marks = page.locator('.vf-smart-select-options mark');

            await input.pressSequentially('a');
            await expect(marks.first()).toBeVisible();
            await expect(input).toHaveValue('a');

            // refining the search re-marks against the new term instead of stacking onto the old marks
            await input.pressSequentially('n');
            await expect(input).toHaveValue('an');
            await expect.poll(async () => (await marks.allTextContents()).map(text => text.toLowerCase())).toEqual(['an', 'an']);

            await input.press('Backspace');
            await input.press('Backspace');
            await expect(input).toHaveValue('');
            await expect(page.locator('.vf-smart-select-options .option')).toHaveCount(6);
            await expect(marks).toHaveCount(0);
        });

        test('navigates with arrow keys and selects with Enter', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-basic');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowDown');
            await expect(page.locator('.vf-smart-select-options .option.highlighted')).toHaveCount(1);

            await page.keyboard.press('Enter');
            await expect(page.locator('.vf-smart-select-options')).toHaveCount(0);
            await expect(input).not.toHaveValue('');
        });

        test('closes dropdown on Escape', async ({ page }) => {
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            await page.keyboard.press('Escape');
            await expect(page.locator('.vf-smart-select-options')).toHaveCount(0);
        });
    });

    test.describe('Grouped + null-title', () => {
        test('shows group headers', async ({ page }) => {
            await selectInput(page, 'demo-ss-grouped').click();
            await page.waitForSelector('.vf-smart-select-options');

            // The null-title option creates a group with empty title (no .group-title rendered)
            // so we check .group-title elements for the real group headers
            const groupTitles = page.locator('.vf-smart-select-options .group-title');
            await expect(groupTitles).toHaveCount(2);
            await expect(groupTitles.nth(0)).toContainText('Fruits');
            await expect(groupTitles.nth(1)).toContainText('Vegetables');

            await page.screenshot({ path: `${screenshotDir}/smart-select-grouped.png` });
        });

        test('shows null-title option for deselect', async ({ page }) => {
            await selectInput(page, 'demo-ss-grouped').click();
            await page.waitForSelector('.vf-smart-select-options');

            const nullOption = page.locator('.vf-smart-select-options .option:has-text("Clear selection")');
            await expect(nullOption).toBeVisible();

            await page.screenshot({ path: `${screenshotDir}/smart-select-null-title.png` });
        });

        test('deselects via null-title option', async ({ page }) => {
            // First select something
            await selectInput(page, 'demo-ss-grouped').click();
            await page.waitForSelector('.vf-smart-select-options');
            await page.locator('.vf-smart-select-options .option:has-text("Cherry")').click();
            await expect(result(page, 'demo-ss-grouped')).toContainText('3');

            // Now deselect via null-title option
            await selectInput(page, 'demo-ss-grouped').click();
            await page.waitForSelector('.vf-smart-select-options');
            await page.locator('.vf-smart-select-options .option:has-text("Clear selection")').click();
            await expect(result(page, 'demo-ss-grouped')).toContainText('none');
        });
    });

    test.describe('Object value (no value-field)', () => {
        test('emits full object when no value-field', async ({ page }) => {
            await selectInput(page, 'demo-ss-object').click();
            await page.waitForSelector('.vf-smart-select-options');

            await page.locator('.vf-smart-select-options .option:has-text("Cherry")').click();
            await expect(result(page, 'demo-ss-object')).toContainText('Cherry');
            await expect(selectInput(page, 'demo-ss-object')).toHaveValue('Cherry');
        });
    });

    test.describe('Formatter + value-extractor', () => {
        test('displays formatted option text', async ({ page }) => {
            await selectInput(page, 'demo-ss-formatter').click();
            await page.waitForSelector('.vf-smart-select-options');

            const firstOption = page.locator('.vf-smart-select-options .option').first();
            await expect(firstOption).toContainText('Apple (Fruits)');

            await page.screenshot({ path: `${screenshotDir}/smart-select-formatter.png` });
        });

        test('selects and emits extracted value', async ({ page }) => {
            await selectInput(page, 'demo-ss-formatter').click();
            await page.waitForSelector('.vf-smart-select-options');

            await page.locator('.vf-smart-select-options .option').first().click();
            await expect(result(page, 'demo-ss-formatter')).toContainText('1');
        });
    });

    test.describe('Preselected value', () => {
        test('shows preselected value in input on mount', async ({ page }) => {
            await expect(selectInput(page, 'demo-ss-preselected')).toHaveValue('Banana');
            await expect(result(page, 'demo-ss-preselected')).toContainText('2');

            await page.screenshot({ path: `${screenshotDir}/smart-select-preselected.png` });
        });
    });

    test.describe('Delayed options (loading state)', () => {
        test('shows loading text before options arrive', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-delayed');
            await expect(input).toHaveAttribute('placeholder', 'Loading options...');

            await page.screenshot({ path: `${screenshotDir}/smart-select-loading.png` });
        });

        test('shows options after delay', async ({ page }) => {
            // Wait for delayed options to load (1.5s) by polling for placeholder change
            const input = selectInput(page, 'demo-ss-delayed');
            await expect(input).not.toHaveAttribute('placeholder', 'Loading options...', { timeout: 5000 });

            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await expect(page.locator('.vf-smart-select-options .option:has-text("Apple")')).toBeVisible();
        });
    });

    test.describe('Async with preload', () => {
        test('loads options on mount and shows them', async ({ page }) => {
            const input = selectInput(page, 'async-preload');
            // Initially shows loading text
            await expect(input).toHaveAttribute('placeholder', 'Fetching...');

            // Wait for async load (800ms) by polling for placeholder change
            await expect(input).not.toHaveAttribute('placeholder', 'Fetching...', { timeout: 5000 });

            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await expect(page.locator('.vf-smart-select-options .option:has-text("Async Option A")')).toBeVisible();
            await expect(page.locator('.vf-smart-select-options .option:has-text("Async Option B")')).toBeVisible();
            await expect(page.locator('.vf-smart-select-options .option:has-text("Async Option C")')).toBeVisible();

            await page.screenshot({ path: `${screenshotDir}/smart-select-async-preload.png` });
        });
    });

    test.describe('Async lazy (no preload)', () => {
        test('shows placeholder and loads on first open', async ({ page }) => {
            const input = selectInput(page, 'async-lazy');
            await expect(input).toHaveAttribute('placeholder', 'Click to load...');

            // Click to trigger lazy load
            await input.click();

            // Wait for async load (800ms) + options to appear
            await page.waitForSelector('.vf-smart-select-options', { timeout: 3000 });

            await expect(page.locator('.vf-smart-select-options .option:has-text("Async Option A")')).toBeVisible();

            await page.screenshot({ path: `${screenshotDir}/smart-select-async-lazy.png` });
        });
    });

    test.describe('Create item', () => {
        test('shows create option when no match', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-create');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            // Type something that doesn't match any existing option
            await input.pressSequentially('Mango');

            // Wait for debounced filtering (150ms) to apply and show the create option
            const createOption = page.locator('.vf-smart-select-options .option:has-text("Create")');
            await expect(createOption).toBeVisible();
            await expect(createOption).toContainText('Mango');

            await page.screenshot({ path: `${screenshotDir}/smart-select-create.png` });
        });

        test('creates item and selects it', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-create');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await input.pressSequentially('Mango');

            // Wait for debounced filtering then click the create option
            const createOption = page.locator('.vf-smart-select-options .option:has-text("Create")');
            await expect(createOption).toBeVisible();
            await createOption.click();

            await expect(result(page, 'demo-ss-create')).toContainText('new');
        });
    });

    test.describe('Disabled', () => {
        test('shows preselected value but input is disabled', async ({ page }) => {
            const input = selectInput(page, 'demo-ss-disabled');
            await expect(input).toBeDisabled();
            await expect(input).toHaveValue('Banana');
            await expect(result(page, 'demo-ss-disabled')).toContainText('2');

            await page.screenshot({ path: `${screenshotDir}/smart-select-disabled.png` });
        });

        test('does not open dropdown when clicked', async ({ page }) => {
            await selectInput(page, 'demo-ss-disabled').dispatchEvent('click');
            // Verify no dropdown appeared
            await expect(page.locator('.vf-smart-select-options')).toHaveCount(0);
        });
    });

    test.describe('Placement', () => {
        /** Scrolls the field so its bottom edge sits `gap` px above the bottom of the viewport. */
        async function parkFieldAboveViewportBottom(page: Page, testid: string, gap: number) {
            await field(page, testid).scrollIntoViewIfNeeded();
            await page.evaluate(
                ({ testid, gap }) => {
                    const el = document.querySelector(`[data-testid="${testid}"] .vf-smart-select`)!;
                    window.scrollBy(0, el.getBoundingClientRect().bottom - (window.innerHeight - gap));
                },
                { testid, gap }
            );
        }

        test('opens above the field when there is no room below it', async ({ page }) => {
            await parkFieldAboveViewportBottom(page, 'demo-ss-basic', 30);
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            const fieldBox = (await field(page, 'demo-ss-basic').boundingBox())!;
            const listBox = (await page.locator('.vf-smart-select-options').boundingBox())!;
            const viewportHeight = page.viewportSize()!.height;

            // guard the premise: below-placement only has to give way when below is genuinely cramped
            expect(viewportHeight - (fieldBox.y + fieldBox.height)).toBeLessThan(60);

            expect(listBox.y + listBox.height).toBeLessThanOrEqual(fieldBox.y);
            expect(listBox.y).toBeGreaterThanOrEqual(0);

            // and it flipped to escape the squeeze, so every option is on screen rather than
            // clamped behind a scrollbar
            await expect(page.locator('.vf-smart-select-options .option')).toHaveCount(6);
            const isClamped = await page.locator('.vf-smart-select-options').evaluate(el => el.scrollHeight > el.clientHeight);
            expect(isClamped).toBe(false);

            await page.screenshot({ path: `${screenshotDir}/smart-select-flipped-above.png` });
        });

        test('stays below rather than open above into space it cannot fit', async ({ page }) => {
            // too little room either side: above would have to overhang the top of the viewport,
            // burying the field under the list where it can't be seen or clicked
            await page.setViewportSize({ width: 1280, height: 160 });
            await parkFieldAboveViewportBottom(page, 'demo-ss-basic', 30);
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            const fieldBox = (await field(page, 'demo-ss-basic').boundingBox())!;
            const listBox = (await page.locator('.vf-smart-select-options').boundingBox())!;

            // guard the premise: neither side has room for the full list
            expect(fieldBox.y).toBeLessThan(100);
            expect(160 - (fieldBox.y + fieldBox.height)).toBeLessThan(60);

            expect(listBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
            await expect(selectInput(page, 'demo-ss-basic')).toBeVisible();
        });

        test('opens below the field when it fits', async ({ page }) => {
            await parkFieldAboveViewportBottom(page, 'demo-ss-basic', 400);
            await selectInput(page, 'demo-ss-basic').click();
            await page.waitForSelector('.vf-smart-select-options');

            const fieldBox = (await field(page, 'demo-ss-basic').boundingBox())!;
            const listBox = (await page.locator('.vf-smart-select-options').boundingBox())!;

            expect(listBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
            await expect(page.locator('.vf-smart-select-options .option')).toHaveCount(6);
        });

        test('keeps the side it opened on when searching shrinks the list', async ({ page }) => {
            // parked so the full list can't fit below but a filtered one could: re-deciding the
            // side per keystroke would fling the list across the field mid-search
            await parkFieldAboveViewportBottom(page, 'demo-ss-basic', 134);
            const input = selectInput(page, 'demo-ss-basic');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            const list = page.locator('.vf-smart-select-options');
            const fieldBox = (await field(page, 'demo-ss-basic').boundingBox())!;
            const openedBox = (await list.boundingBox())!;
            expect(openedBox.y + openedBox.height).toBeLessThanOrEqual(fieldBox.y);

            await input.pressSequentially('app');
            await expect(list.locator('.option')).toHaveCount(1);

            // guard the premise: the filtered list is small enough that below is once again an
            // option, which is exactly when the flapping would show up
            const filteredBox = (await list.boundingBox())!;
            const viewportHeight = page.viewportSize()!.height;
            expect(filteredBox.height).toBeLessThan(viewportHeight - (fieldBox.y + fieldBox.height));

            expect(filteredBox.y + filteredBox.height).toBeLessThanOrEqual(fieldBox.y);
        });

        test('stays anchored to the field as searching resizes the list', async ({ page }) => {
            await parkFieldAboveViewportBottom(page, 'demo-ss-basic', 30);
            const input = selectInput(page, 'demo-ss-basic');
            await input.click();
            await page.waitForSelector('.vf-smart-select-options');

            await input.pressSequentially('cher');
            await expect(page.locator('.vf-smart-select-options .option')).toHaveCount(1);

            const fieldBox = (await field(page, 'demo-ss-basic').boundingBox())!;
            const listBox = (await page.locator('.vf-smart-select-options').boundingBox())!;

            // the list shrank to one row: it should have followed the field down, not left a gap
            expect(fieldBox.y - (listBox.y + listBox.height)).toBeLessThan(8);
            expect(listBox.y + listBox.height).toBeLessThanOrEqual(fieldBox.y);
        });
    });
});
