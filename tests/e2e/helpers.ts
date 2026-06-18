import type { Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

/**
 * 解压 Playwright 下载的 zip, 返回 {filename: string|Buffer}
 */
export async function unzipDownload(zipPath: string): Promise<Record<string, string>> {
  const buffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const out: Record<string, string> = {};
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (name.endsWith('.json') || name.endsWith('.txt')) {
      out[name] = await file.async('string');
    }
  }
  return out;
}

/**
 * 等 App 启动完成 (TopBar 渲染)
 */
export async function exposeStore(page: Page) {
  await page.waitForSelector('[data-testid="top-bar"]');
}
