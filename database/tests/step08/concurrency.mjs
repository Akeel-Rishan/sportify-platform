// Real Oracle sessions and test-only transactions. No production booking logic.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import oracledb from 'oracledb';
import { withOwnerSession } from '@sportify/migrations';
import { assertTestOwner, requireOracle, slotStarts, timestamp, START, END } from './fixtures.mjs';

async function allocate(session, name) {
  // Allocation commits: this is always BEFORE any fixture transaction writes.
  const result = await session.execute('BEGIN DBMS_LOCK.ALLOCATE_UNIQUE(:name,:handle); END;', {
    name,
    handle: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 128 },
  });
  return result.outBinds.handle;
}
async function release(session, handle, allowUnowned = false) {
  const result = await session.execute('BEGIN :result:=DBMS_LOCK.RELEASE(:handle); END;', {
    handle,
    result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  });
  assert.ok(result.outBinds.result === 0 || (allowUnowned && result.outBinds.result === 4));
}
async function observeMarker(session, handle, completed) {
  const deadline = performance.now() + 10000;
  for (let attempt = 0; attempt < 80 && performance.now() < deadline; attempt++) {
    const result = await session.execute(
      'BEGIN :result:=DBMS_LOCK.REQUEST(:handle,DBMS_LOCK.X_MODE,0,FALSE); END;',
      {
        handle,
        result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    if (result.outBinds.result === 1) return; // Other real session owns its marker.
    assert.equal(result.outBinds.result, 0);
    await release(session, handle);
    assert.equal(completed(), false, 'Waiter ended before the database-side barrier was observed.');
  }
  throw new Error('Bounded Oracle barrier was not reached.');
}
function marked(body) {
  return `DECLARE r PLS_INTEGER; v NUMBER; BEGIN
    -- The observer may briefly own its probe lock. Wait boundedly for it to
    -- release rather than failing a zero-wait contender request spuriously.
    r:=DBMS_LOCK.REQUEST(:marker,DBMS_LOCK.X_MODE,5,FALSE);
    IF r<>0 THEN RAISE_APPLICATION_ERROR(-20081,'Fixture marker unavailable'); END IF;
    ${body}
  END;`;
}
async function protocol(session, tenant, item, isHold = false) {
  await session.execute('SELECT TENANT_ID FROM TENANTS WHERE TENANT_ID=:tenant FOR UPDATE WAIT 5', {
    tenant: tenant.tenant,
  });
  await session.execute(
    'SELECT LOCATION_ID FROM LOCATIONS WHERE TENANT_ID=:tenant AND LOCATION_ID=:location FOR UPDATE WAIT 5',
    { tenant: tenant.tenant, location: tenant.location },
  );
  await session.execute(
    'SELECT RESOURCE_ID FROM RESOURCES WHERE TENANT_ID=:tenant AND RESOURCE_ID=:resourceId ORDER BY RESOURCE_ID FOR UPDATE WAIT 5',
    { tenant: tenant.tenant, resourceId: item.resource },
  );
  if (isHold)
    await session.execute(
      'SELECT HOLD_ID FROM BOOKING_HOLDS WHERE TENANT_ID=:tenant AND HOLD_ID=:id FOR UPDATE WAIT 5',
      { tenant: tenant.tenant, id: item.id },
    );
  else
    await session.execute(
      'SELECT BOOKING_ID FROM BOOKINGS WHERE TENANT_ID=:tenant AND BOOKING_ID=:id FOR UPDATE WAIT 5',
      { tenant: tenant.tenant, id: item.id },
    );
}
const protocolBody = `
 SELECT TENANT_ID INTO v FROM TENANTS WHERE TENANT_ID=:tenant FOR UPDATE WAIT 5;
 SELECT LOCATION_ID INTO v FROM LOCATIONS WHERE TENANT_ID=:tenant AND LOCATION_ID=:location FOR UPDATE WAIT 5;
 SELECT RESOURCE_ID INTO v FROM RESOURCES WHERE TENANT_ID=:tenant AND RESOURCE_ID=:resourceId FOR UPDATE WAIT 5;
 SELECT BOOKING_ID INTO v FROM BOOKINGS WHERE TENANT_ID=:tenant AND BOOKING_ID=:booking FOR UPDATE WAIT 5;`;

export async function verifyConcurrency(config, coordinator, f) {
  assertTestOwner(config.ORACLE_MIGRATION_SCHEMA, f.expectedOwner);
  let stage = 'connection-setup';
  await withOwnerSession(config, async (a) =>
    withOwnerSession(config, async (b) => {
      try {
        const rows = async () =>
          (
            await coordinator.execute(
              'SELECT TO_CHAR(BOOKING_ITEM_ID) AS BOOKING,TO_CHAR(HOLD_ITEM_ID) AS HOLD,TO_CHAR(SLOT_START_UTC,\'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"\') AS SLOT FROM RESOURCE_SLOT_RESERVATIONS WHERE TENANT_ID=:tenant ORDER BY RESOURCE_ID,SLOT_START_UTC',
              { tenant: f.a.tenant },
              { outFormat: 4002 },
            )
          ).rows ?? [];
        async function clearSlots() {
          await coordinator.execute(
            'DELETE FROM RESOURCE_SLOT_RESERVATIONS WHERE TENANT_ID=:tenant',
            { tenant: f.a.tenant },
          );
          await coordinator.commit();
        }
        async function race(
          label,
          first,
          second,
          actionA,
          secondTimes,
          commitA,
          expectedError,
          useProtocol,
        ) {
          stage = label;
          const markerName = 'SPORTIFY_S8:' + label + ':' + randomUUID();
          const waiterHandle = await allocate(b, markerName);
          const observerHandle = await allocate(coordinator, markerName);
          let pending,
            finished = false,
            failure = false,
            cleanupFailed = false;
          try {
            stage = label + ':first-transaction';
            if (useProtocol) await protocol(a, f.a, first);
            await actionA(a);
            assert.equal(
              (await rows()).length,
              0,
              'Coordinator must not see the uncommitted first reservation.',
            );
            const firstInsert = f.slotSql(second, secondTimes[0]);
            pending = (async () => {
              try {
                // The database-side marker and first insert execute in ONE Oracle
                // call; same-slot contenders cannot finish this call before A ends.
                await b.execute(
                  marked((useProtocol ? protocolBody : '') + '\n' + firstInsert.sql + ';'),
                  {
                    marker: waiterHandle,
                    ...(useProtocol
                      ? {
                          tenant: f.a.tenant,
                          location: f.a.location,
                          resourceId: second.resource,
                          booking: second.id,
                        }
                      : {}),
                    ...firstInsert.binds,
                  },
                );
                await f.slots(b, second, secondTimes.slice(1));
                await b.commit();
                return null;
              } catch (error) {
                console.info(
                  JSON.stringify({
                    event: 'step08.race.contender_result',
                    label,
                    oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
                    driver: /^NJS-\d+$/.test(error?.code ?? '') ? error.code : null,
                  }),
                );
                await b.rollback();
                return error;
              }
            })();
            void pending.then(
              () => {
                finished = true;
              },
              () => {
                finished = true;
              },
            );
            stage = label + ':barrier';
            await observeMarker(coordinator, observerHandle, () => finished);
            stage = label + ':release-winner';
            if (commitA) await a.commit();
            else await a.rollback();
            const error = await pending;
            stage = label + ':contender-result';
            if (expectedError && error?.errorNum !== 1)
              console.error(
                JSON.stringify({
                  event: 'step08.race.expected_conflict_mismatch',
                  label,
                  oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
                  failed: !!error,
                }),
              );
            if (expectedError) requireOracle(error, 1, ['PK_RESOURCE_SLOT_RESERVATIONS']);
            else
              assert.equal(
                error,
                null,
                'Expected waiter to commit after the winning transaction released its locks.',
              );
          } catch (error) {
            failure = true;
            throw error;
          } finally {
            try {
              await a.rollback();
            } catch {
              cleanupFailed = true;
            }
            if (pending) await Promise.allSettled([pending]);
            try {
              await b.rollback();
              await release(b, waiterHandle, failure || !pending);
            } catch {
              cleanupFailed = true;
            }
            if (cleanupFailed)
              console.error('Step 08 race cleanup failed; inspect the disposable target.');
          }
          if (cleanupFailed && !failure) throw new Error('Race cleanup failed.');
        }
        const first = await f.booking(),
          second = await f.booking();
        await coordinator.commit();
        // A: final unique-index backstop with two transactions already doing work.
        await race(
          'same-slot',
          first,
          second,
          (c) => f.slots(c, first, [START]),
          [START],
          true,
          true,
          false,
        );
        assert.deepEqual(
          (await rows()).map((row) => row.BOOKING),
          [first.item],
        );
        await clearSlots();
        // B: a provisional owner rolls back and the waiter can then commit.
        await race(
          'rollback',
          first,
          second,
          (c) => f.slots(c, first, [START]),
          [START],
          false,
          false,
          false,
        );
        assert.deepEqual(
          (await rows()).map((row) => row.BOOKING),
          [second.item],
        );
        await clearSlots();
        // C: use the documented tenant/location/resource/header order. A distinct
        // first insert by the loser must disappear with its whole transaction.
        const early = '2035-01-02T07:45:00.000000Z',
          earlierEnd = '2035-01-02T08:45:00.000000Z';
        const overlapping = await f.booking(
          f.a,
          f.a.resources[0],
          {},
          {
            STARTS_AT_UTC: timestamp(early),
            ENDS_AT_UTC: timestamp(earlierEnd),
            OCCUPIED_START_UTC: timestamp(early),
            OCCUPIED_END_UTC: timestamp(earlierEnd),
          },
        );
        await coordinator.commit();
        await race(
          'overlap',
          first,
          overlapping,
          (c) => f.slots(c, first, slotStarts(START, END)),
          slotStarts(early, earlierEnd),
          true,
          true,
          true,
        );
        const overlap = await rows();
        stage = 'overlap:stored-rows';
        assert.equal(overlap.length, 4);
        assert.ok(overlap.every((row) => row.BOOKING === first.item));
        assert.ok(!overlap.some((row) => row.SLOT === early));
        await clearSlots();
        // D: resource is part of the key; direct simultaneous inserts for separate
        // resources do not contend. Domain writes under the coarse tenant protocol
        // intentionally serialize and must still both succeed.
        const independent = await f.booking(f.a, f.a.resources[1]);
        await coordinator.commit();
        stage = 'direct-independent';
        await Promise.all([f.slots(a, first, [START]), f.slots(b, independent, [START])]);
        await Promise.all([a.commit(), b.commit()]);
        assert.equal((await rows()).length, 2);
        await clearSlots();
        await race(
          'protocol-independent',
          first,
          independent,
          (c) => f.slots(c, first, slotStarts(START, END)),
          slotStarts(START, END),
          true,
          false,
          true,
        );
        assert.equal((await rows()).length, 8);
        await clearSlots();
        // E: a failing ownership conversion is rolled back without releasing slots.
        stage = 'ownership-conversion';
        const held = await f.hold(),
          booked = await f.booking(f.a, f.a.resources[0], { SOURCE_HOLD_ID: held.id });
        await f.slots(coordinator, held, slotStarts(START, END), 'hold');
        await coordinator.commit();
        const update = async () => {
          const result = await a.execute(
            'UPDATE RESOURCE_SLOT_RESERVATIONS SET BOOKING_ITEM_ID=:booking,HOLD_ITEM_ID=NULL WHERE TENANT_ID=:tenant AND RESOURCE_ID=:resourceId AND HOLD_ITEM_ID=:hold',
            {
              booking: booked.item,
              tenant: held.tenant,
              resourceId: held.resource,
              hold: held.item,
            },
          );
          assert.equal(result.rowsAffected, 4);
          await a.execute(
            "UPDATE BOOKING_HOLDS SET HOLD_STATUS='CONVERTED',CONVERTED_AT_UTC=LOCALTIMESTAMP WHERE TENANT_ID=:tenant AND HOLD_ID=:id",
            { tenant: held.tenant, id: held.id },
          );
        };
        await protocol(a, f.a, held, true);
        await a.execute(
          'SELECT BOOKING_ID FROM BOOKINGS WHERE TENANT_ID=:tenant AND BOOKING_ID=:id FOR UPDATE WAIT 5',
          { tenant: f.a.tenant, id: booked.id },
        );
        await update();
        assert.ok((await rows()).every((row) => row.HOLD === held.item));
        let conversionError;
        try {
          await a.execute(
            'INSERT INTO RESOURCE_SLOT_RESERVATIONS(TENANT_ID,RESOURCE_ID,SLOT_START_UTC) VALUES(:tenant,:resourceId,TO_TIMESTAMP(:slot,\'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"\'))',
            { tenant: held.tenant, resourceId: held.resource, slot: '2035-01-02T10:00:00.000000Z' },
          );
        } catch (error) {
          conversionError = error;
        }
        requireOracle(conversionError, 2290, ['CK_SLOT_RESERVATIONS_OWNER']);
        await a.rollback();
        assert.equal((await rows()).length, 4);
        assert.ok((await rows()).every((row) => row.HOLD === held.item));
        await protocol(a, f.a, held, true);
        await a.execute(
          'SELECT BOOKING_ID FROM BOOKINGS WHERE TENANT_ID=:tenant AND BOOKING_ID=:id FOR UPDATE WAIT 5',
          { tenant: f.a.tenant, id: booked.id },
        );
        await update();
        await a.commit();
        assert.equal((await rows()).length, 4);
        assert.ok((await rows()).every((row) => row.BOOKING === booked.item && row.HOLD === null));
        await clearSlots();
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'step08.concurrency.failed',
            stage,
            oracle: Number.isInteger(error?.errorNum) ? error.errorNum : null,
            assertion: error?.code === 'ERR_ASSERTION',
            expectedSmallInteger:
              Number.isInteger(error?.expected) && error.expected >= 0 && error.expected <= 65535
                ? error.expected
                : null,
            actualSmallInteger:
              Number.isInteger(error?.actual) && error.actual >= 0 && error.actual <= 65535
                ? error.actual
                : null,
          }),
        );
        throw error;
      }
    }),
  );
  console.info(
    'PASS real Oracle Step 08 A-E: same-slot winner, rollback/waiter, complete losing multi-slot rollback, independent resources and atomic ownership conversion/rollback. Database-side barriers; no arbitrary sleeps. Protocol harness and direct uniqueness backstop are distinct; production booking services are not implemented.',
  );
}
