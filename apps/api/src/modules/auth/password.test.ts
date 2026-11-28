import { createHash } from 'node:crypto';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify } from 'argon2';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createPasswordEncoder, passwordIsValid, verifyPasswordCorpus } from './password.js';

const compromised = 'common synthetic phrase';
let folder: string;
let corpus: string;

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'sportify-password-'));
  corpus = join(folder, 'hashes.txt');
  const lookup = createHash('sha1').update(compromised).digest('hex').toUpperCase();
  await writeFile(corpus, `${'0'.repeat(40)}\n${lookup}\n${'F'.repeat(40)}\n`);
});
afterAll(async () => {
  await rm(corpus, { force: true });
  await rmdir(folder);
});

it('uses Unicode code point limits and rejects unpaired surrogates', () => {
  expect(passwordIsValid('🙂'.repeat(15))).toBe(true);
  expect(passwordIsValid('🙂'.repeat(128))).toBe(true);
  expect(passwordIsValid('🙂'.repeat(129))).toBe(false);
  expect(passwordIsValid('🙂'.repeat(14))).toBe(false);
  expect(passwordIsValid('a'.repeat(20) + '\uD800')).toBe(false);
});

it('screens compromised passwords and fails closed when the corpus is unavailable', async () => {
  await expect(verifyPasswordCorpus(corpus)).resolves.toBeUndefined();
  const encoder = createPasswordEncoder(corpus);
  await expect(encoder(compromised)).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  await expect(encoder('short')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  const missing = join(folder, 'missing.txt');
  await expect(createPasswordEncoder(missing)(compromised)).rejects.toMatchObject({
    code: 'SERVICE_UNAVAILABLE',
  });
  await expect(verifyPasswordCorpus(missing)).rejects.toThrow('corpus is unavailable or invalid');
});

it('encodes the exact password with distinct salts and bounds concurrent Argon2 work', async () => {
  const encoder = createPasswordEncoder(corpus);
  const input = '  Case sensitive synthetic passphrase  ';
  const first = encoder(input);
  const second = encoder(input);
  await expect(encoder(input)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  const [a, b] = await Promise.all([first, second]);
  expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(a).not.toBe(b);
  expect(await verify(a, input)).toBe(true);
  expect(await verify(b, input.trim())).toBe(false);
});
