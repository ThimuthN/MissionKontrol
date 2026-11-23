import { cp, mkdir } from 'node:fs/promises';

const destination = new URL('../dist/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL('../web/', import.meta.url), destination, { recursive: true });
await mkdir(new URL('src/', destination), { recursive: true });
for (const filename of ['normalize.mjs', 'pipeline.mjs', 'zip.mjs']) {
  await cp(new URL(`../src/${filename}`, import.meta.url), new URL(`src/${filename}`, destination));
}
await cp(new URL('../fixtures/assessment-demo.json', import.meta.url), new URL('report.json', destination));
console.log('Built Mission Control in dist/');
