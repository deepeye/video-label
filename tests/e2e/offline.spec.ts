import { test, expect } from '@playwright/test';

test.describe('offline guarantees', () => {
  test('no external host requests during full demo flow', async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        !url.startsWith('http://localhost') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')
      ) {
        externalRequests.push(`${req.method()} ${url}`);
      }
    });

    await page.goto('/?step=1&speed=instant');
    await page.waitForSelector('[data-testid="step1-upload"]');
    await page.click('[data-testid="sample-card-city-road"]');
    await page.waitForSelector('[data-testid="step2-metadata"]');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="step-view-2"]')).toBeVisible();
    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step3-autoannotate"]');
    await page.waitForTimeout(2500);
    await expect(page.locator('[data-testid="step-view-3"]')).toBeVisible();
    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step4-review"]');

    await page.getByRole('button', { name: '新增事件' }).click();
    await expect(page.locator('[data-testid^="event-row-"]')).toHaveCount(1);

    await page.getByLabel('事件类型').selectOption('sudden_brake');
    await page.getByLabel('严重程度').selectOption('high');
    await page.getByLabel('标签').fill('风险, 夜间');
    await page.getByLabel('描述').fill('夜间车辆急刹，需要人工复核。');
    await page.getByLabel('时间(ms)').fill('4200');

    await page.click('[data-testid="btn-next"]');
    await page.waitForSelector('[data-testid="step5-export"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;

    expect(externalRequests, '外部请求被检出: ' + externalRequests.join('\n')).toEqual([]);
  });
});
