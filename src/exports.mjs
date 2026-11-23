import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseExport } from './normalize.mjs';
import { extractExport } from './zip.mjs';

async function* walk(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(root, file);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      yield [path.relative(root, file).split(path.sep).join('/'), await readFile(file, 'utf8')];
    }
  }
}

export async function readExports(location) {
  const info = await stat(location);
  if (info.isDirectory()) return parseExport(walk(location));
  if (info.size > 30 * 1024 * 1024) throw new Error('ZIP exceeds the 30 MB limit.');
  return parseExport(extractExport(await readFile(location)));
}
