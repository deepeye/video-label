// scripts/check-size.mjs
// 用法: node scripts/check-size.mjs
// 检查 dist/ 总大小是否在 30MB 红线内。

import { statSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const LIMIT_BYTES = 30 * 1024 * 1024; // 30 MB
const DIST = resolve(process.cwd(), 'dist');

function dirSize(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(full);
    } else if (entry.isFile()) {
      total += statSync(full).size;
    }
  }
  return total;
}

const size = dirSize(DIST);
const sizeMB = (size / 1024 / 1024).toFixed(2);
const limitMB = (LIMIT_BYTES / 1024 / 1024).toFixed(0);

if (size > LIMIT_BYTES) {
  console.error(`❌ dist size ${sizeMB} MB exceeds limit ${limitMB} MB`);
  process.exit(1);
}
console.log(`✓ dist size ${sizeMB} MB (limit ${limitMB} MB)`);
