import { cp, mkdir, readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const destination = new URL('../dist/', import.meta.url);
await mkdir(destination, { recursive: true });
const web = new URL('../web/', import.meta.url);
await cp(web, destination, { recursive: true });
export const publicPaths = (await readdir(web, { recursive:true }))
  .filter(name => extname(name)).map(name => name.replaceAll('\\', '/'));
await mkdir(new URL('src/', destination), { recursive: true });
for (const filename of ['normalize.mjs', 'pipeline.mjs', 'recruitment.mjs', 'zip.mjs']) {
  await cp(new URL(`../src/${filename}`, import.meta.url), new URL(`src/${filename}`, destination));
  publicPaths.push(`src/${filename}`);
}
await cp(new URL('../fixtures/assessment-demo.json', import.meta.url), new URL('report.json', destination));
publicPaths.push('report.json');
console.log('Built Mission Control in dist/');
