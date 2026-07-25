/** Report the built bundle sizes, raw and gzipped. */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

for (const file of ['dist/index.js', 'dist/index.cjs', 'dist/real-shadows.global.js']) {
  const buf = readFileSync(join(root, file));
  const gz = gzipSync(buf, { level: 9 });
  console.log(
    `${file.padEnd(32)} ${(buf.length / 1024).toFixed(2).padStart(7)} kB   gzip ${(gz.length / 1024).toFixed(2).padStart(6)} kB`,
  );
}
