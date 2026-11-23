import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('production pages use external scripts allowed by the deployed content policy', async () => {
  const config = JSON.parse(await source('vercel.json'));
  const policy = config.headers[0].headers.find(header => header.key === 'Content-Security-Policy')?.value;
  const scriptDirective = policy.split(';').find(item => item.trim().startsWith('script-src'));
  assert.match(scriptDirective, /script-src 'self'/);
  assert.doesNotMatch(scriptDirective, /'unsafe-inline'/);
  for (const page of ['web/index.html', 'web/demo.html']) {
    const html = await source(page);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length > 0, `${page} has a script entry point`);
    for (const [, attributes, body] of scripts) {
      assert.match(attributes, /\bsrc="\/[^"]+"/, `${page} script is hosted on the same origin`);
      assert.equal(body.trim(), '', `${page} does not depend on blocked inline code`);
    }
  }
  assert.equal(config.installCommand, 'npm ci');
});

test('mobile navigation is removed from keyboard focus until opened', async () => {
  const navigation = await source('web/sidebar.js');
  assert.match(navigation, /sidebar\.inert\s*=\s*smallScreen\.matches\s*&&\s*!active/);
  assert.match(navigation, /setMobileOpen\(false\);\s*sync\(\)/);
  const page = await source('web/index.html');
  assert.match(page, /<h1 id="process" tabindex="-1">/);
  assert.match(page, /<h2 id="lab-title" tabindex="-1">/);
});

test('walkthrough offers mobile-readable chapters alongside accessible playback', async () => {
  const page = await source('web/demo.html');
  const player = await source('web/demo.js');
  assert.match(page, /id="mobile-story"[^>]*aria-label="Current walkthrough chapter"/);
  assert.match(page, /aria-label="Seek walkthrough"/);
  assert.match(page, /@media\(max-width:700px\) and \(orientation:portrait\)/);
  assert.match(player, /chapterTitle\.textContent\s*=/);
  assert.match(player, /root\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(player, /root\.removeAttribute\('aria-hidden'\)/);
});
