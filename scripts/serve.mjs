import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { publicPaths } from './build.mjs';

const mediaTypes = {
  '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.txt':'text/plain',
};
const assets = new Map(publicPaths.map(path => ['/' + path, [path, mediaTypes[extname(path)] ?? 'application/octet-stream']]));
assets.set('/', assets.get('/index.html'));
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  if (req.url === '/api/session' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ enabled: false }));
    return;
  }
  const asset = assets.get(req.url?.split('?')[0]);
  if (!asset || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(new URL(`../dist/${asset[0]}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`Mission Control: http://127.0.0.1:${port}`));
