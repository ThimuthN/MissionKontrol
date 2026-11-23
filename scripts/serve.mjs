import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import './build.mjs';

const assets = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/welcome.js', ['welcome.js', 'text/javascript']],
  ['/workspace.js', ['workspace.js', 'text/javascript']],
  ['/src/normalize.mjs', ['src/normalize.mjs', 'text/javascript']],
  ['/src/pipeline.mjs', ['src/pipeline.mjs', 'text/javascript']],
  ['/src/zip.mjs', ['src/zip.mjs', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
  ['/report.json', ['report.json', 'application/json']],
]);
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
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
