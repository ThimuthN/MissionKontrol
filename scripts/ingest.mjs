import { mkdir, writeFile } from 'node:fs/promises';
import { readExports } from '../src/exports.mjs';
import { assemble } from '../src/pipeline.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run ingest -- <export-zip-or-data-directory>');
  process.exitCode = 1;
} else {
  try {
    const { events, rejected, counts } = await readExports(input);
    const { links: primaryLinks, processes, ...primary } = assemble(events, 'assessment');
    const links = primaryLinks.map(link => ({ process: primary.process, ...link }));
    const secondary = (processes ?? []).map(({ links: processLinks, ...report }) => {
      links.push(...processLinks.map(link => ({ process: report.process, ...link })));
      return report;
    });
    const report = { ...primary, ...(secondary.length && { processes: secondary }) };
    const output = new URL('../private/', import.meta.url);
    await mkdir(output, { recursive: true });
    for (const [name, data] of Object.entries({ normalized: events, rejected, links, report, counts })) {
      await writeFile(new URL(`${name}.json`, output), JSON.stringify(data, null, 2) + '\n');
    }
    console.log({ ...counts, normalized: events.length,
      processes: [report, ...secondary].map(item => ({ name: item.process, cases: item.cases.length, linked: item.stats.linked })) });
    console.log('Full outputs written to private/. Use the separate redaction script to prepare public data.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
