/**
 * Serve the demo locally: copies the fresh ESM build into demo/ and serves
 * the folder. No dependencies, node built-ins only.
 */
import { copyFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
copyFileSync(join(root, 'dist/index.js'), join(root, 'demo/real-shadows.js'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const port = Number(process.env.PORT) || 4180;

createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : (req.url ?? '/index.html').split('?')[0];
  try {
    const body = await readFile(join(root, 'demo', path));
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => {
  console.log(`demo at http://localhost:${port}`);
});
