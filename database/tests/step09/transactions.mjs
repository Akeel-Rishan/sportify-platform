// Explicitly test-only Oracle protocols. These are not application processors.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import oracledb from 'oracledb';
import { withOwnerSession } from '@sportify/migrations';
import {
  assertTestOwner,
  fixtureSql,
  requireOracle,
  PAST,
  fingerprint,
  fixtureReplay,
} from './fixtures.mjs';

async function allocate(session, name) {
  // ALLOCATE_UNIQUE commits; call only before starting either contender's DML.
  return (
    await session.execute('BEGIN DBMS_LOCK.ALLOCATE_UNIQUE(:p_name,:p_handle); END;', {
      p_name: name,
      p_handle: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 128 },
    })
  ).outBinds.p_handle;
}
async function lockResult(session, handle, release = false) {
  return (
    await session.execute(
      release
        ? 'BEGIN :p_result:=DBMS_LOCK.RELEASE(:p_handle); END;'
        : 'BEGIN :p_result:=DBMS_LOCK.REQUEST(:p_handle,DBMS_LOCK.X_MODE,0,FALSE); END;',
      {
        p_handle: handle,
        p_result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    )
  ).outBinds.p_result;
}
async function barrier(session, handle, finished) {
  const deadline = performance.now() + 10000;
  for (let i = 0; i < 80 && performance.now() < deadline; i++) {
    const result = await lockResult(session, handle);
    if (result === 1) return;
    assert.equal(result, 0);
    assert.equal(await lockResult(session, handle, true), 0);
    assert.equal(finished(), false, 'Contender ended before its database marker was observed.');
  }
  throw new Error('Bounded Step 09 Oracle barrier not reached.');
}

export async function verifyTransactions(config, coordinator, manifest, f) {
  assertTestOwner(config.ORACLE_MIGRATION_SCHEMA);
  await withOwnerSession(config, async (a) =>
    withOwnerSession(config, async (b) => {
      const query = async (session, sql, binds = {}) =>
        (await session.execute(sql, binds, { outFormat: 4002 })).rows ?? [];
      const insert = async (session, table, values) => {
        const statement = fixtureSql(manifest, table, values);
        return session.execute(statement.sql, statement.binds, { autoCommit: false });
      };
      const customer = async (session) =>
        (
          await query(
            session,
            'SELECT FULL_NAME FROM CUSTOMERS WHERE TENANT_ID=:p_tenant AND CUSTOMER_ID=:p_id',
            { p_tenant: f.a.tenant, p_id: f.a.customer },
          )
        )[0].FULL_NAME;
      const changeCustomer = async (session, name) =>
        session.execute(
          'UPDATE CUSTOMERS SET FULL_NAME=:p_name WHERE TENANT_ID=:p_tenant AND CUSTOMER_ID=:p_id',
          { p_name: name, p_tenant: f.a.tenant, p_id: f.a.customer },
          { autoCommit: false },
        );
      const rowCount = async (table, column, id) =>
        (
          await query(coordinator, `SELECT COUNT(*) AS TOTAL FROM ${table} WHERE ${column}=:p_id`, {
            p_id: id,
          })
        )[0].TOTAL;
      let failed = false,
        cleanupFailed = false;
      try {
        const original = await customer(coordinator);
        const event = f.eventValues();
        await changeCustomer(a, 'Synthetic atomic outbox ' + f.nonce);
        await insert(a, 'OUTBOX_EVENTS', event);
        assert.equal(await customer(coordinator), original);
        assert.equal(await rowCount('OUTBOX_EVENTS', 'OUTBOX_EVENT_ID', event.OUTBOX_EVENT_ID), 0);
        await a.commit();
        assert.equal(await customer(coordinator), 'Synthetic atomic outbox ' + f.nonce);
        assert.equal(await rowCount('OUTBOX_EVENTS', 'OUTBOX_EVENT_ID', event.OUTBOX_EVENT_ID), 1);
        const rolled = f.eventValues();
        await changeCustomer(a, 'Synthetic rolled back');
        await insert(a, 'OUTBOX_EVENTS', rolled);
        await a.rollback();
        assert.equal(await customer(coordinator), 'Synthetic atomic outbox ' + f.nonce);
        assert.equal(await rowCount('OUTBOX_EVENTS', 'OUTBOX_EVENT_ID', rolled.OUTBOX_EVENT_ID), 0);

        // One event may fan out; source-state transition and both jobs commit together.
        const jobs = ['fixture.consumer.a', 'fixture.consumer.b'].map((consumer) =>
          f.jobValues(f.a, {
            SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
            CONSUMER_CODE: consumer,
          }),
        );
        for (const job of jobs) await insert(a, 'JOB_QUEUE', job);
        await a.execute(
          "UPDATE OUTBOX_EVENTS SET EVENT_STATUS='PROCESSED',PROCESSED_AT_UTC=SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE OUTBOX_EVENT_ID=:p_id",
          { p_id: event.OUTBOX_EVENT_ID },
          { autoCommit: false },
        );
        assert.equal(await rowCount('JOB_QUEUE', 'JOB_ID', jobs[0].JOB_ID), 0);
        await a.rollback();
        assert.equal(
          (
            await query(
              coordinator,
              'SELECT EVENT_STATUS FROM OUTBOX_EVENTS WHERE OUTBOX_EVENT_ID=:p_id',
              { p_id: event.OUTBOX_EVENT_ID },
            )
          )[0].EVENT_STATUS,
          'PENDING',
        );
        for (const job of jobs) await insert(a, 'JOB_QUEUE', job);
        await a.execute(
          "UPDATE OUTBOX_EVENTS SET EVENT_STATUS='PROCESSED',PROCESSED_AT_UTC=SYS_EXTRACT_UTC(SYSTIMESTAMP) WHERE OUTBOX_EVENT_ID=:p_id",
          { p_id: event.OUTBOX_EVENT_ID },
          { autoCommit: false },
        );
        await a.commit();
        assert.equal(await rowCount('JOB_QUEUE', 'JOB_ID', jobs[1].JOB_ID), 1);
        let duplicate;
        try {
          await insert(
            b,
            'JOB_QUEUE',
            f.jobValues(f.a, {
              SOURCE_OUTBOX_EVENT_ID: event.OUTBOX_EVENT_ID,
              CONSUMER_CODE: 'fixture.consumer.a',
            }),
          );
        } catch (error) {
          duplicate = error;
        } finally {
          await b.rollback();
        }
        requireOracle(duplicate, 1, ['UQ_JOB_EVENT_CONSUMER']);

        // Separate sessions: B skips A's locked row instead of receiving its lease.
        const job = jobs[0];
        const pending =
          "SELECT JOB_ID FROM JOB_QUEUE WHERE JOB_ID=:p_id AND JOB_STATUS='PENDING' FOR UPDATE SKIP LOCKED";
        assert.equal((await query(a, pending, { p_id: job.JOB_ID })).length, 1);
        assert.equal((await query(b, pending, { p_id: job.JOB_ID })).length, 0);
        const oldToken = randomUUID(),
          newToken = randomUUID();
        await a.execute(
          "UPDATE JOB_QUEUE SET JOB_STATUS='RUNNING',ATTEMPT_COUNT=1,LOCKED_BY='fixture-a',LOCKED_AT_UTC=TO_TIMESTAMP(:p_start,'YYYY-MM-DD\"T\"HH24:MI:SS.FF6\"Z\"'),LEASE_EXPIRES_AT_UTC=TO_TIMESTAMP('2001-01-01','YYYY-MM-DD'),LEASE_TOKEN=:p_token WHERE JOB_ID=:p_id",
          { p_id: job.JOB_ID, p_token: oldToken, p_start: PAST },
          { autoCommit: false },
        );
        await a.commit();
        assert.equal((await query(b, pending, { p_id: job.JOB_ID })).length, 0);
        const reclaim = await b.execute(
          "UPDATE JOB_QUEUE SET ATTEMPT_COUNT=ATTEMPT_COUNT+1,LOCKED_BY='fixture-b',LOCKED_AT_UTC=SYS_EXTRACT_UTC(SYSTIMESTAMP),LEASE_EXPIRES_AT_UTC=SYS_EXTRACT_UTC(SYSTIMESTAMP)+INTERVAL '1' MINUTE,LEASE_TOKEN=:p_new WHERE JOB_ID=:p_id AND JOB_STATUS='RUNNING' AND LEASE_EXPIRES_AT_UTC<SYS_EXTRACT_UTC(SYSTIMESTAMP) AND ATTEMPT_COUNT<MAX_ATTEMPTS",
          { p_id: job.JOB_ID, p_new: newToken },
          { autoCommit: false },
        );
        assert.equal(reclaim.rowsAffected, 1);
        await b.commit();
        const complete =
          "UPDATE JOB_QUEUE SET JOB_STATUS='COMPLETED',COMPLETED_AT_UTC=SYS_EXTRACT_UTC(SYSTIMESTAMP),LOCKED_BY=NULL,LOCKED_AT_UTC=NULL,LEASE_EXPIRES_AT_UTC=NULL,LEASE_TOKEN=NULL WHERE JOB_ID=:p_id AND JOB_STATUS='RUNNING' AND LEASE_TOKEN=:p_token AND LEASE_EXPIRES_AT_UTC>SYS_EXTRACT_UTC(SYSTIMESTAMP)";
        assert.equal(
          (
            await a.execute(
              complete,
              { p_id: job.JOB_ID, p_token: oldToken },
              { autoCommit: false },
            )
          ).rowsAffected,
          0,
        );
        await a.rollback();
        assert.equal(
          (
            await b.execute(
              complete,
              { p_id: job.JOB_ID, p_token: newToken },
              { autoCommit: false },
            )
          ).rowsAffected,
          1,
        );
        await b.commit();

        async function race(tenant, commitFirst) {
          const marker = 'SPORTIFY_S9:' + randomUUID();
          const waiterHandle = await allocate(b, marker),
            observerHandle = await allocate(coordinator, marker);
          const first = f.idemValues(tenant),
            second = f.idemValues(tenant, { IDEMPOTENCY_KEY: first.IDEMPOTENCY_KEY });
          let pendingResult,
            finished = false,
            raceFailed = false,
            cleanupError = false;
          try {
            await insert(a, 'IDEMPOTENCY_KEYS', first);
            assert.equal(
              await rowCount('IDEMPOTENCY_KEYS', 'IDEMPOTENCY_ID', first.IDEMPOTENCY_ID),
              0,
            );
            const statement = fixtureSql(manifest, 'IDEMPOTENCY_KEYS', second);
            pendingResult = (async () => {
              try {
                await b.execute(
                  `DECLARE r PLS_INTEGER; BEGIN r:=DBMS_LOCK.REQUEST(:p_marker,DBMS_LOCK.X_MODE,5,FALSE); IF r<>0 THEN RAISE_APPLICATION_ERROR(-20081,'Fixture barrier unavailable'); END IF; ${statement.sql}; END;`,
                  { p_marker: waiterHandle, ...statement.binds },
                  { autoCommit: false },
                );
                await b.commit();
                return null;
              } catch (error) {
                await b.rollback();
                return error;
              }
            })();
            void pendingResult.then(
              () => {
                finished = true;
              },
              () => {
                finished = true;
              },
            );
            await barrier(coordinator, observerHandle, () => finished);
            if (commitFirst) await a.commit();
            else await a.rollback();
            const error = await pendingResult;
            if (commitFirst) requireOracle(error, 1, ['UQ_IDEMPOTENCY_OWNER_KEY']);
            else assert.equal(error, null);
            assert.equal(
              await rowCount('IDEMPOTENCY_KEYS', 'IDEMPOTENCY_ID', first.IDEMPOTENCY_ID),
              commitFirst ? 1 : 0,
            );
            assert.equal(
              await rowCount('IDEMPOTENCY_KEYS', 'IDEMPOTENCY_ID', second.IDEMPOTENCY_ID),
              commitFirst ? 0 : 1,
            );
          } catch (error) {
            raceFailed = true;
            throw error;
          } finally {
            try {
              await a.rollback();
            } catch {
              cleanupError = true;
            }
            if (pendingResult) await Promise.allSettled([pendingResult]);
            try {
              await b.rollback();
              assert.ok([0, 4].includes(await lockResult(b, waiterHandle, true)));
            } catch {
              cleanupError = true;
            }
            if (cleanupError) {
              console.error('Step 09 barrier cleanup failed; inspect disposable state.');
            }
          }
          if (cleanupError && !raceFailed) throw new Error('Barrier cleanup failed.');
        }
        // Same key blocks/conflicts for BOTH tenant and partially-null platform UK.
        await race(f.a, true);
        await race(null, true);
        await race(f.a, false);

        const claim = f.idemValues();
        await insert(a, 'IDEMPOTENCY_KEYS', claim);
        await a.commit();
        const beforeCompletion = await customer(coordinator);
        const completeIdem =
          "UPDATE IDEMPOTENCY_KEYS SET EXECUTION_STATUS='COMPLETED',LEASE_TOKEN=NULL,LEASE_EXPIRES_AT_UTC=NULL,RESPONSE_STATUS=200,RESPONSE_BODY=:p_payload WHERE IDEMPOTENCY_ID=:p_id AND LEASE_TOKEN=:p_token AND EXECUTION_STATUS='PROCESSING' AND LEASE_EXPIRES_AT_UTC>SYS_EXTRACT_UTC(SYSTIMESTAMP) AND EXPIRES_AT_UTC>SYS_EXTRACT_UTC(SYSTIMESTAMP)";
        await changeCustomer(a, 'Synthetic idempotent ' + f.nonce);
        assert.equal(
          (
            await a.execute(
              completeIdem,
              {
                p_id: claim.IDEMPOTENCY_ID,
                p_token: claim.LEASE_TOKEN,
                p_payload: JSON.stringify({ fixture: 'safe-result' }),
              },
              { autoCommit: false },
            )
          ).rowsAffected,
          1,
        );
        assert.equal(await customer(coordinator), beforeCompletion);
        assert.equal(
          (
            await query(
              coordinator,
              'SELECT EXECUTION_STATUS FROM IDEMPOTENCY_KEYS WHERE IDEMPOTENCY_ID=:p_id',
              { p_id: claim.IDEMPOTENCY_ID },
            )
          )[0].EXECUTION_STATUS,
          'PROCESSING',
        );
        await a.rollback();
        assert.equal(await customer(coordinator), beforeCompletion);
        assert.equal(
          (
            await query(
              coordinator,
              'SELECT RESPONSE_STATUS FROM IDEMPOTENCY_KEYS WHERE IDEMPOTENCY_ID=:p_id',
              { p_id: claim.IDEMPOTENCY_ID },
            )
          )[0].RESPONSE_STATUS,
          null,
        );
        await changeCustomer(a, 'Synthetic idempotent ' + f.nonce);
        await a.execute(
          completeIdem,
          {
            p_id: claim.IDEMPOTENCY_ID,
            p_token: claim.LEASE_TOKEN,
            p_payload: JSON.stringify({ fixture: 'safe-result' }),
          },
          { autoCommit: false },
        );
        await a.commit();
        assert.equal(await customer(coordinator), 'Synthetic idempotent ' + f.nonce);
        assert.equal(
          (
            await query(
              coordinator,
              'SELECT EXECUTION_STATUS FROM IDEMPOTENCY_KEYS WHERE IDEMPOTENCY_ID=:p_id',
              { p_id: claim.IDEMPOTENCY_ID },
            )
          )[0].EXECUTION_STATUS,
          'COMPLETED',
        );
        const record = {
          scope: 'fixture-tenant-operation',
          owner: claim.OWNER_SCOPE,
          fingerprint: claim.REQUEST_HASH,
          state: 'COMPLETED',
          payload: { fixture: 'safe-result' },
        };
        assert.deepEqual(
          fixtureReplay(record, {
            scope: record.scope,
            owner: record.owner,
            fingerprint: record.fingerprint,
          }),
          { kind: 'replay', payload: record.payload },
        );
        assert.deepEqual(
          fixtureReplay(record, {
            scope: record.scope,
            owner: record.owner,
            fingerprint: fingerprint({ different: 'request' }),
          }),
          { kind: 'conflict' },
        );
        console.info(
          'PASS real Oracle test-only outbox atomic commit/rollback/fanout, job skip-locked claim/reclaim/fencing, tenant/platform idempotency commit/rollback contenders and atomic fixture completion. No production processing implemented.',
        );
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        for (const session of [a, b])
          try {
            await session.rollback();
          } catch {
            cleanupFailed = true;
          }
        if (cleanupFailed) {
          console.error('Step 09 transaction cleanup failed; inspect disposable state.');
        }
      }
      if (cleanupFailed && !failed) throw new Error('Transaction cleanup failed.');
    }),
  );
}
