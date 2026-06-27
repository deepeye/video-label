import { test, expect } from '@playwright/test';

test.describe('next button disable / enable based on canAdvanceFromStep4', () => {
  test('step 4 with no timestamp event → next disabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');

    await expect(page.getByText('暂无事件，请先新增一个时间点事件。')).toBeVisible();
    await expect(page.locator('[data-testid="btn-next"]')).toBeDisabled();
  });

  test('step 4 after creating one timestamp event → next enabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');

    await page.getByRole('button', { name: '新增事件' }).click();

    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="btn-next"]')).toBeEnabled();
  });
});
