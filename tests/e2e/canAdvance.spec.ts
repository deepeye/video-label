import { test, expect } from '@playwright/test';

test.describe('next button disable / enable based on canAdvanceFromStep4', () => {
  test('step 4 with no review → next disabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });

  test('step 4 after all 3 focus reviewed → next enabled', async ({ page }) => {
    await page.goto('/?step=4&speed=instant');
    await page.waitForSelector('[data-testid="step4-review"]');
    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: {
          getState: () => {
            acceptBox: (id: string) => void;
            correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void;
            rejectBox: (id: string) => void;
          };
        };
      };
      const s = (window as W).__demoStore!.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
    });
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeEnabled();
  });

  test('step 5 → next disabled (no further step)', async ({ page }) => {
    await page.goto('/?step=5');
    await page.waitForSelector('[data-testid="step5-export"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeDisabled();
  });

  test('step 1 → next enabled (advances to 2)', async ({ page }) => {
    await page.goto('/?step=1');
    await page.waitForSelector('[data-testid="step1-upload"]');
    const nextBtn = page.locator('[data-testid="btn-next"]');
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await page.waitForSelector('[data-testid="step2-metadata"]', { timeout: 2000 });
  });
});
