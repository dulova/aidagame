import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
async function files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const entries = await Promise.all((await files('dist')).map(async file => ({ file, data: await fs.readFile(file) })));
// Count every JS/CSS file, including deferred chunks and the Service Worker: a conservative first-load bound.
const gzip = entries.filter(e => /\.(js|css)$/.test(e.file)).reduce((n, e) => n + gzipSync(e.data).length, 0);
// The complete output is an upper bound for the mandatory precache.
const raw = entries.reduce((n, e) => n + e.data.length, 0);
const passed = gzip <= 150 * 1024 && raw <= 1024 * 1024;
const report = { allJsCssGzipBytes: gzip, completeDistBytes: raw, limits: { gzipBytes: 150 * 1024, rawBytes: 1024 * 1024 }, passed };
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
