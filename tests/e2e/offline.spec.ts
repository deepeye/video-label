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
    await page.waitForSelector('[data-testid="step4-review"]', { timeout: 10_000 });

    await page.evaluate(() => {
      type W = typeof window & {
        __demoStore?: {
          getState: () => {
            acceptBox: (id: string) => void;
            correctBoxGeometry: (id: string, idx: number, c: [number, number, number, number]) => void;
            rejectBox: (id: string) => void;
            acceptAllRemaining: () => void;
            goToStep: (n: 5) => void;
          };
        };
      };
      const s = (window as W).__demoStore!.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
      s.acceptAllRemaining();
      s.goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;

    expect(externalRequests, '外部请求被检出: ' + externalRequests.join('\n')).toEqual([]);
  });
});
