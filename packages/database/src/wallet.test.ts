import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from './pool.js';
import { parseDatabaseConfig } from './config.js';
import { validateWallet } from './wallet.js';

const directories: string[] = [];
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'sportify-wallet-metadata-unit-'));
  directories.push(directory);
  const config = parseDatabaseConfig(
    {
      ORACLE_USER: 'SPORTIFY_API',
      ORACLE_PASSWORD: 'PRIVATE_DATABASE_SENTINEL',
      ORACLE_CONNECT_STRING: 'tcps://unit.invalid:1522/unit',
      ORACLE_WALLET_DIRECTORY: directory,
      ORACLE_WALLET_PASSWORD: 'PRIVATE_WALLET_SENTINEL',
    },
    'api',
  );
  return { config, directory, file: join(directory, 'ewallet.pem') };
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
describe('mTLS wallet metadata preflight (unit only; no certificate or Oracle connection)', () => {
  it('checks a readable nonempty regular file without parsing or printing its contents', async () => {
    const f = fixture();
    writeFileSync(f.file, 'UNIT DUMMY FILE - NOT A CERTIFICATE');
    await expect(validateWallet(f.config)).resolves.toBeUndefined();
  });
  it.each(['missing', 'empty', 'directory'] as const)(
    'rejects %s wallet before allocating any pool, without leaking configuration',
    async (kind) => {
      const f = fixture();
      if (kind === 'empty') writeFileSync(f.file, '');
      if (kind === 'directory') mkdirSync(f.file);
      const factory = vi.fn();
      const records: unknown[] = [];
      let failure: unknown;
      try {
        await createDatabase(f.config, 'api', factory, (record) => records.push(record));
      } catch (error) {
        failure = error;
      }
      expect(factory).not.toHaveBeenCalled();
      const output = String(failure) + JSON.stringify(records);
      expect(output).toContain('ORACLE_WALLET_DIRECTORY');
      for (const secret of [
        f.directory,
        'PRIVATE_DATABASE_SENTINEL',
        'PRIVATE_WALLET_SENTINEL',
        'unit.invalid',
      ])
        expect(output).not.toContain(secret);
      expect(records).toEqual([]);
    },
  );
});
