import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { EnvironmentError } from '@sportify/validation';
import type { DatabaseConfig } from './config.js';

// Inspect metadata/readability only. The driver loads and decrypts the PEM;
// neither wallet contents nor paths are included in our errors/log records.
export async function validateWallet(config: DatabaseConfig): Promise<void> {
  try {
    const filename = join(config.ORACLE_WALLET_DIRECTORY, 'ewallet.pem');
    const metadata = await stat(filename);
    if (!metadata.isFile() || metadata.size === 0) throw new Error('invalid wallet file');
    await access(filename, constants.R_OK);
  } catch {
    throw new EnvironmentError([
      'ORACLE_WALLET_DIRECTORY: expected a readable, nonempty regular ewallet.pem file; validate the protected instance-wallet extraction',
    ]);
  }
}
