import {
  verificationEnvironment,
  withVerifiedTarget,
  requireCondition,
  reportFailure,
} from './oracle-verification-support.mjs';
import { createDatabase } from '@sportify/database';
import { setTimeout as wait } from 'node:timers/promises';

async function verifyHttpReadiness(entry) {
  // Deliberately load the built production factory, never a test controller.
  const { createApiApplication } = await import('../../apps/api/dist/application.js');
  let pool;
  const records = [];
  const app = await createApiApplication(
    { NODE_ENV: 'test', PORT: 4000, database: entry.config },
    (record) => records.push(record),
    async (config) => {
      pool = await createDatabase(config, 'api');
      return pool;
    },
  );
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    async function request(path, status) {
      const response = await fetch(`${url}/api/v1/${path}`, { signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      requireCondition(
        response.status === status &&
          response.headers.get('cache-control') === 'no-store' &&
          body.requestId === response.headers.get('x-request-id'),
      );
      return body;
    }
    await request('health', 200);
    const ready = await request('ready', 200);
    requireCondition(ready.data?.scope === 'application-and-oracle');
    // Safely fail OUR local runtime pool, never the ATP service or its grants.
    await pool.close();
    await wait(1100);
    const unavailable = await request('ready', 503);
    requireCondition(unavailable.error?.code === 'SERVICE_UNAVAILABLE');
    await request('health', 200);
    requireCondition(
      records.some(
        (record) =>
          record.event === 'http.request.completed' &&
          record.requestId === unavailable.requestId &&
          record.status === 503,
      ),
    );
    console.info(
      'PASS real-pool production HTTP readiness: 200, controlled local pool closure => safe 503, liveness 200, no-store and correlated request IDs.',
    );
  } finally {
    await app.close();
  }
}

try {
  const entries = verificationEnvironment();
  for (const entry of entries) {
    await withVerifiedTarget(entry, async (database) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        requireCondition(await database.check());
        const row = (
          await database.query(
            `SELECT :value AS BOUND_VALUE,
          TO_CHAR(TO_TIMESTAMP(:instant, 'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"'),
          'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"') AS INSTANT,
          TO_NUMBER(:precise) AS PRECISE FROM DUAL`,
            {
              value: 'parameterized-probe',
              instant: '2026-01-02T03:04:05.123456Z',
              precise: '9007199254740993',
            },
          )
        ).rows?.[0];
        requireCondition(
          row?.BOUND_VALUE === 'parameterized-probe' &&
            row.INSTANT === '2026-01-02T03:04:05.123456Z' &&
            row.PRECISE === '9007199254740993',
        );
      }
      // Change the SAME pooled session; next acquisition must reset it to UTC.
      await database.withConnection((c) => c.execute("ALTER SESSION SET TIME_ZONE = '+05:30'"));
      requireCondition(await database.check());
      let expectedFailure = false;
      try {
        await database.query('SELECT 1 / :zero AS INVALID FROM DUAL', { zero: 0 });
      } catch {
        expectedFailure = true;
      }
      requireCondition(expectedFailure && (await database.check())); // max=1 proves release after query error
      await database.close();
      requireCondition(!(await database.check())); // local dependency shutdown; no ATP outage induced
      console.info(
        `PASS ${entry.role}: actual identity/target, binds, exact NUMBER/timestamp projection, repeated UTC reset, release after error, closed-pool unavailability.`,
      );
    });
  }
  await verifyHttpReadiness(entries[0]);
  console.info(
    'PENDING: transaction persistence needs an explicitly designated owner-created disposable fixture. No business records or DDL were used. Remote outage/recovery still requires the operator gate; local pool closure does not prove it.',
  );
} catch (error) {
  reportFailure(error);
}
