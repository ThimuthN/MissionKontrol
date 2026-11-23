import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalProfile, isDemoLogin, passwordDigest, randomSalt, signInLocalProfile } from '../web/account.js';

test('public demo access accepts only the explicitly advertised sample credentials', () => {
  assert.equal(isDemoLogin('admin', 'admin'), true);
  assert.equal(isDemoLogin('  ADMIN ', 'admin'), true);
  assert.equal(isDemoLogin('admin', 'Admin'), false);
  assert.equal(isDemoLogin('admin', 'wrong'), false);
  assert.equal(isDemoLogin('someone@example.com', 'admin'), false);
});

test('local passwords have a distinct random salt and stable derived digest', async () => {
  const first = randomSalt();
  const second = randomSalt();
  assert.notEqual(first, second);
  assert.equal(atob(first).length, 16);

  const digest = await passwordDigest('correct horse battery staple', first);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(await passwordDigest('correct horse battery staple', first), digest);
  assert.notEqual(await passwordDigest('incorrect horse battery staple', first), digest);
  assert.notEqual(await passwordDigest('correct horse battery staple', second), digest);
});

test('local account creation, authentication and duplicate handling work without sending credentials', async () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const profile = await createLocalProfile('Jamie Rivera', 'jamie@example.test', 'strong-password-2026', storage, 'dark');
  assert.equal(profile.email, 'jamie@example.test');
  assert.equal(profile.name, 'Jamie Rivera');
  assert.equal(profile.appearance, 'dark');
  assert.ok(!JSON.stringify([...data.values()]).includes('strong-password-2026'));

  const signedIn = await signInLocalProfile('jamie@example.test', 'strong-password-2026', storage);
  assert.equal(signedIn.digest, profile.digest);
  assert.equal(signedIn.appearance, 'dark');
  await assert.rejects(signInLocalProfile('jamie@example.test', 'wrong-password', storage), /did not match/);
  await assert.rejects(createLocalProfile('Other Jamie', 'jamie@example.test', 'a-long-password', storage), /already exists/);
});
