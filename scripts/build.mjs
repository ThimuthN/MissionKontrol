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
// Preserve Three.js as an npm dependency and serve its unmodified, MIT-licensed
// browser modules from our own origin. There is no runtime CDN requirement.
for (const filename of ['three.module.js', 'three.core.js']) {
  await cp(new URL(`../node_modules/three/build/${filename}`, import.meta.url), new URL(filename, destination));
  publicPaths.push(filename);
}
await cp(new URL('../node_modules/three/LICENSE', import.meta.url), new URL('THREE-LICENSE.txt', destination));
publicPaths.push('THREE-LICENSE.txt');
// The source-grounded case walkthrough is self-hosted too.
await cp(new URL('../node_modules/gsap/dist/gsap.min.js', import.meta.url), new URL('gsap.min.js', destination));
publicPaths.push('gsap.min.js');
await cp(new URL('../node_modules/gsap/README.md', import.meta.url), new URL('GSAP-NOTICE.md', destination));
publicPaths.push('GSAP-NOTICE.md');
console.log('Built Mission Control in dist/');
