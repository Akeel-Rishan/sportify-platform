import { createHmac, randomInt } from 'node:crypto';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import type { Database } from '@sportify/database';
import { ApplicationError } from '../../common/errors/application-error.js';
import type { RegistrationAccepted } from '@sportify/api-contracts';

export type AuthOwner =
  'SPORTIFY_SCHEMA_OWNER' | 'SPORTIFY_STEP11_TEST_OWNER' | 'SPORTIFY_STEP12_TEST_OWNER';
type CounterScope =
  'ISSUE' | 'CONFIRM' | 'LOGIN' | 'LOGIN_PAIR' | 'SESSION' | 'RESET_REQ' | 'RESET_OK';

export function uniqueViolation(error: unknown, owner: string, constraint: string): boolean {
  if (!(error instanceof Error) || !('errorNum' in error) || error.errorNum !== 1) return false;
  return (
    error.message.includes(`(${owner}.${constraint})`) ||
    error.message.includes(`("${owner}"."${constraint}")`)
  );
}

function sourceIdentity(address: string | undefined): string {
  if (!address || !isIP(address)) throw new ApplicationError('SERVICE_UNAVAILABLE');
  const ip = isIP(address) === 4 ? `::ffff:${address}` : address.split('%')[0];
  return new URL(`http://[${ip}]`).hostname;
}

export function createAbuseControls(db: Database, owner: AuthOwner, key: Buffer) {
  return async (
    address: string | undefined,
    scope: CounterScope,
    limit: number,
    email?: string,
  ) => {
    const identity = sourceIdentity(address);
    const input = email === undefined ? identity : JSON.stringify([identity, email]);
    const source = createHmac('sha256', key)
      .update('sportify.auth-source.v1\0' + input)
      .digest('hex');
    const accepted = await db.transaction(async (connection) => {
      const update = () =>
        connection.execute(
          `UPDATE ${owner}.AUTH_SOURCE_WINDOWS SET
          REQUEST_COUNT=CASE WHEN WINDOW_END_UTC<=LOCALTIMESTAMP THEN 1 ELSE REQUEST_COUNT+1 END,
          WINDOW_END_UTC=CASE WHEN WINDOW_END_UTC<=LOCALTIMESTAMP THEN LOCALTIMESTAMP+INTERVAL '15' MINUTE ELSE WINDOW_END_UTC END
         WHERE SOURCE_HASH=:source AND ACTION_SCOPE=:scope
           AND (WINDOW_END_UTC<=LOCALTIMESTAMP OR REQUEST_COUNT<:limit)`,
          { source, scope, limit },
        );
      if ((await update()).rowsAffected === 1) return true;
      try {
        await connection.execute(
          `INSERT INTO ${owner}.AUTH_SOURCE_WINDOWS (SOURCE_HASH,ACTION_SCOPE,WINDOW_END_UTC,REQUEST_COUNT)
           VALUES (:source,:scope,LOCALTIMESTAMP+INTERVAL '15' MINUTE,1)`,
          { source, scope },
        );
        return true;
      } catch (error) {
        if (!uniqueViolation(error, owner, 'PK_AUTH_SOURCE_WINDOWS')) throw error;
      }
      return (await update()).rowsAffected === 1;
    });
    if (!accepted) throw new ApplicationError('RATE_LIMITED', { 'Retry-After': '900' });
  };
}

export async function acknowledge(work: () => Promise<void>): Promise<RegistrationAccepted> {
  const deadline = performance.now() + 250 + randomInt(50);
  await work();
  const remaining = deadline - performance.now();
  if (remaining > 0) await delay(remaining);
  return { status: 'accepted' };
}
