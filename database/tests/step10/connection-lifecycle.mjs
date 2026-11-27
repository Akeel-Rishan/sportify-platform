import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createDatabase, DatabaseError } from '@sportify/database';
import { observedPoolFactory } from './pool-observer.mjs';
import { TARGET } from './config.mjs';

export async function verifyConnectionLifecycle(entries, record) {
  for (const entry of entries) {
    const events = [],
      observed = observedPoolFactory();
    const config = {
      ...entry.config,
      ORACLE_POOL_MIN: 0,
      ORACLE_POOL_MAX: 1,
      ORACLE_POOL_INCREMENT: 1,
      ORACLE_QUEUE_TIMEOUT_MS: 5000,
      ORACLE_CALL_TIMEOUT_MS: 5000,
    };
    const database = await createDatabase(config, entry.role, observed.factory, (event) =>
      events.push(event),
    );
    let failed = false,
      cleanupFailed = false;
    try {
      const row = (
        await database.query(
          "SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY,SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL",
        )
      ).rows?.[0];
      assert.equal(row.TARGET, TARGET);
      assert.equal(row.IDENTITY, entry.config.ORACLE_USER);
      assert.equal(await database.check(), true);
      const available = () => {
        assert.equal(observed.state.pool.connectionsInUse, 0);
        assert.ok(observed.state.pool.connectionsOpen <= 1);
      };
      available();
      const baselineOpen = observed.state.pool.connectionsOpen;
      for (let i = 0; i < 8; i++) {
        assert.equal(await database.check(), true);
        available();
      }
      record('pool.acquire-release', 'PASS', {
        role: entry.role,
        cycles: 8,
        borrowed: 0,
        idleOpen: baselineOpen,
      });
      await assert.rejects(
        database.query('SELECT 1/:p_zero AS VALUE FROM DUAL', { p_zero: 0 }),
        (error) => error.errorNum === 1476,
      );
      available();
      assert.equal(await database.check(), true);
      const sentinel = new Error('STEP10_SYNTHETIC_CALLBACK_SECRET');
      await assert.rejects(
        database.withConnection(async () => {
          throw sentinel;
        }),
        (error) => error === sentinel,
      );
      available();
      assert.ok(!JSON.stringify(events).includes(sentinel.message));
      record('pool.query-callback-failure', 'PASS', { role: entry.role, borrowed: 0 });
      let retained;
      await database.withConnection(async (c) => {
        retained = c;
        await c.execute('SELECT :p_value AS VALUE FROM DUAL', { p_value: 'safe' });
      });
      await assert.rejects(
        retained.execute('SELECT 1 FROM DUAL'),
        (error) => error instanceof DatabaseError && error.classification === 'scope_closed',
      );
      await assert.rejects(
        database.transaction(async () => database.transaction(async () => {})),
        (error) => error instanceof DatabaseError && error.classification === 'nested_scope',
      );
      available();
      const beforeCommits = observed.state.commits;
      await database.transaction(async (c) => {
        await c.execute('SELECT 1 FROM DUAL');
        await c.execute('SELECT 2 FROM DUAL');
      });
      assert.equal(observed.state.commits, beforeCommits + 1);
      available();
      await assert.rejects(
        database.transaction(async (c) => {
          await c.execute('SELECT 1 FROM DUAL');
          throw sentinel;
        }),
        (error) => error === sentinel,
      );
      available();
      assert.equal(observed.state.commits, beforeCommits + 1);
      record('pool.transaction-ownership', 'PASS', {
        role: entry.role,
        scope: 'real read-only transactions; persistent DML verified separately',
      });
      await database.withConnection(async (c) => {
        await c.execute("ALTER SESSION SET TIME_ZONE = '+05:30'");
        assert.equal(
          (await c.execute('SELECT SESSIONTIMEZONE AS ZONE FROM DUAL')).rows[0].ZONE,
          '+05:30',
        );
      });
      const reset = (
        await database.query(
          "SELECT SESSIONTIMEZONE AS ZONE,SYS_CONTEXT('USERENV','SID') AS SID FROM DUAL",
        )
      ).rows[0];
      assert.equal(reset.ZONE, 'UTC');
      assert.equal(reset.SID, row.SID);
      available();
      const precise = (
        await database.query(
          `SELECT TO_NUMBER(:p_id) AS BIG_ID,TO_NUMBER(:p_money,'9999999990D99','NLS_NUMERIC_CHARACTERS=''.,''') AS MONEY,TO_CHAR(TO_TIMESTAMP(:p_time,'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"'),'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"') AS INSTANT FROM DUAL`,
          { p_id: '9007199254740993', p_money: '1234.50', p_time: '2026-01-02T03:04:05.123456Z' },
        )
      ).rows[0];
      assert.equal(precise.BIG_ID, '9007199254740993');
      assert.equal(precise.MONEY, '1234.5');
      assert.equal(precise.INSTANT, '2026-01-02T03:04:05.123456Z');
      await assert.rejects(
        database.query("SELECT TO_TIMESTAMP('2026-01-02','YYYY-MM-DD') AS RAW_TIME FROM DUAL"),
        (error) =>
          error instanceof DatabaseError && error.classification === 'temporal_projection_required',
      );
      await assert.rejects(
        database.query('SELECT :p_amount FROM DUAL', { p_amount: 1.25 }),
        (error) => error instanceof DatabaseError && error.classification === 'invalid_bind',
      );
      available();
      assert.equal(await database.check(), true);
      assert.notEqual(
        new Date('2026-01-01T00:00:00Z').getTimezoneOffset(),
        0,
        'Explicit non-UTC test process required.',
      );
      record('pool.utc-and-exact-values', 'PASS', {
        role: entry.role,
        sameSessionReinitialized: true,
        fractionalDigits: 6,
        nodeTimezone: 'Asia/Colombo',
      });
      await observed.state.pool.reconfigure({ queueTimeout: 200 });
      const held = await observed.state.pool.getConnection();
      try {
        assert.equal(observed.state.pool.connectionsInUse, 1);
        const started = performance.now();
        await assert.rejects(
          database.query('SELECT 1 FROM DUAL'),
          (error) => error.code === 'NJS-040',
        );
        assert.ok(
          performance.now() - started < 10000,
          'Dedicated-pool acquisition must be bounded.',
        );
      } finally {
        await held.close();
        await observed.state.pool.reconfigure({ queueTimeout: 5000 });
      }
      available();
      assert.equal(await database.check(), true);
      record('pool.controlled-exhaustion', 'PASS', {
        role: entry.role,
        dedicatedMaximum: 1,
        borrowedAfter: 0,
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      try {
        const first = database.close();
        assert.equal(first, database.close());
        await first;
        assert.equal(observed.state.closed, 1);
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed && !failed) throw new Error('Pool cleanup failed.');
    record('pool.repeated-shutdown', 'PASS', {
      role: entry.role,
      poolsCreated: observed.state.created,
      poolsClosed: observed.state.closed,
    });
    const failing = observedPoolFactory({ failInitializationOnce: true });
    const resetDb = await createDatabase(config, entry.role, failing.factory, () => {});
    try {
      await assert.rejects(resetDb.query('SELECT 1 FROM DUAL'), (error) => error.errorNum === 1882);
      assert.equal(failing.state.pool.connectionsInUse, 0);
      assert.equal(await resetDb.check(), true);
      assert.equal(failing.state.pool.connectionsInUse, 0);
      record('pool.failed-session-initialization', 'PASS', {
        role: entry.role,
        method: 'test-only invalid timezone issued to actual Oracle; next checkout recovered',
      });
    } finally {
      await resetDb.close();
    }
  }
}
