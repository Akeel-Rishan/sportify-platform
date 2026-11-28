import { createHash, randomBytes } from 'node:crypto';
import { open } from 'node:fs/promises';
import { argon2id, hash, verify } from 'argon2';
import { ApplicationError } from '../../common/errors/application-error.js';

const stride = 41;
const settings = { type: argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 };
const storedHashPattern =
  /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;
let inProgress = 0;

async function bounded<T>(work: () => Promise<T>): Promise<T> {
  if (inProgress >= 2) throw new ApplicationError('RATE_LIMITED', { 'Retry-After': '1' });
  inProgress++;
  try {
    return await work();
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError('SERVICE_UNAVAILABLE');
  } finally {
    inProgress--;
  }
}

export function passwordIsValid(password: string): boolean {
  if (password.length < 15 || password.length > 256 || /\p{Surrogate}/u.test(password))
    return false;
  const points = [...password].length;
  return points >= 15 && points <= 128 && Buffer.byteLength(password, 'utf8') <= 512;
}

// SHA1 only indexes the local compromised-password corpus. It never stores a credential.
async function containsCompromisedPassword(path: string, password?: string): Promise<boolean> {
  const file = await open(path, 'r');
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size < stride || metadata.size % stride !== 0)
      throw new Error('Invalid compromised-password corpus.');
    const entry = Buffer.alloc(stride);
    async function readHash(index: number): Promise<string> {
      const { bytesRead } = await file.read(entry, 0, stride, index * stride);
      const line = entry.toString('latin1');
      if (bytesRead !== stride || !/^[0-9A-F]{40}\n$/.test(line))
        throw new Error('Invalid compromised-password corpus entry.');
      return line.slice(0, 40);
    }
    let low = 0;
    let high = metadata.size / stride - 1;
    if (password === undefined) {
      if ((await readHash(low)) > (await readHash(high))) throw new Error('Unsorted corpus.');
      return false;
    }
    const target = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      const candidate = await readHash(midpoint);
      if (candidate === target) return true;
      if (candidate < target) low = midpoint + 1;
      else high = midpoint - 1;
    }
    return false;
  } finally {
    await file.close();
  }
}

export function createPasswordEncoder(path: string): (password: string) => Promise<string> {
  return async (password) => {
    if (!passwordIsValid(password)) throw new ApplicationError('BAD_REQUEST');
    return bounded(async () => {
      if (await containsCompromisedPassword(path, password))
        throw new ApplicationError('BUSINESS_RULE_VIOLATION');
      return await hash(password, settings);
    });
  };
}

export async function createPasswordVerifier() {
  const dummy = await bounded(() => hash(randomBytes(32), settings));
  return async (password: string, encoded: string | null): Promise<boolean> => {
    const usable = encoded !== null && storedHashPattern.test(encoded);
    return bounded(async () => {
      // Restrict the stored format to the approved work factor before invoking native code.
      const matches = await verify(usable ? encoded : dummy, password);
      return usable && matches;
    });
  };
}

export async function verifyPasswordCorpus(path: string): Promise<void> {
  try {
    await containsCompromisedPassword(path);
  } catch {
    throw new Error('The configured compromised-password corpus is unavailable or invalid.');
  }
}
