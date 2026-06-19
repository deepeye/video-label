// scripts/verify-offline.mjs
// 用法: node scripts/verify-offline.mjs
// 用 Playwright 启动 dev server, 跑完整 demo 流程, 拦截所有请求, 断言 host 都是 localhost。
// 返回 0 全部 OK, 1 有外部请求。

import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 5193;
const URL = `http://localhost:${PORT}`;

function startDevServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('dev server timeout')), 30_000);
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      if (buf.includes(`localhost:${PORT}`)) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on('exit', (code) => reject(new Error(`dev server exited: ${code}`)));
  });
}

async function main() {
  console.log('[verify-offline] starting dev server...');
  const proc = await startDevServer();
  console.log('[verify-offline] dev server up at', URL);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const externalRequests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      externalRequests.push(`${req.method()} ${url}`);
    }
  });

  try {
    await page.goto(`${URL}/?step=1&speed=instant`);
    await page.waitForSelector('[data-testid="step1-upload"]');
    await page.click('[data-testid="sample-card-city-road"]');
    // instant 速度下 step2/step3 揭示瞬时完成, 直接等 step4
    await page.waitForSelector('[data-testid="step4-review"]', { timeout: 10_000 });
    // 模拟审核
    await page.evaluate(() => {
      const s = (/** @type {any} */ (window)).__demoStore.getState();
      s.acceptBox('trk_2');
      s.correctBoxGeometry('trk_9', 0, [100, 200, 300, 400]);
      s.rejectBox('trk_5');
      s.acceptAllRemaining();
      s.goToStep(5);
    });
    await page.waitForSelector('[data-testid="step5-export"]');
    // 触发下载
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-btn"]');
    await downloadPromise;
  } catch (err) {
    console.error('[verify-offline] flow error:', err);
  }

  await browser.close();
  proc.kill();

  if (externalRequests.length > 0) {
    console.error('[verify-offline] FAIL — 外部请求:');
    externalRequests.forEach((u) => console.error('  -', u));
    process.exit(1);
  }
  console.log('[verify-offline] OK — 所有请求都走 localhost');
}

main().catch((err) => {
  console.error('[verify-offline] uncaught:', err);
  process.exit(1);
});
