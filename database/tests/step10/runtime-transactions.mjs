import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@sportify/database';
import { CLEAN_OWNER, TARGET } from './config.mjs';
import { observedPoolFactory } from './pool-observer.mjs';

export async function verifyRuntimeTransactions(session, entries, record) {
  const table = 'S10_TX_' + randomUUID().replaceAll('-', '').slice(0, 18).toUpperCase();
  await session.execute(
    `CREATE TABLE ${table} (ID NUMBER PRIMARY KEY, AMOUNT NUMBER(12,2), INSTANT_UTC TIMESTAMP(6))`,
  );
  const qualified = `${CLEAN_OWNER}.${table}`;
  let operationFailed = false;
  try {
    for (const entry of entries) {
      const identity = { api: 'SPORTIFY_API', worker: 'SPORTIFY_WORKER' }[entry.role];
      assert.equal(entry.config.ORACLE_USER, identity);
      assert.ok(identity);
      const observed = observedPoolFactory();
      const database = await createDatabase(entry.config, entry.role, observed.factory);
      let failed = false;
      try {
        const context = (
          await database.query(
            "SELECT SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') AS TARGET,SYS_CONTEXT('USERENV','SESSION_USER') AS IDENTITY FROM DUAL",
          )
        ).rows[0];
        assert.deepEqual(context, { TARGET, IDENTITY: identity });
        await session.execute(`GRANT SELECT, INSERT ON ${table} TO ${identity}`);
        const base = entry.role === 'api' ? 9007199254740993n : 9007199254741003n;
        const instant = '2035-01-02T08:00:00.123456Z';
        const add = (connection, offset) =>
          connection.execute(
            `INSERT INTO ${qualified} VALUES (TO_NUMBER(:id), TO_NUMBER(:amount,'9999999990D99','NLS_NUMERIC_CHARACTERS=''.,'''),TO_TIMESTAMP(:instant,'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"'))`,
            { id: String(base + BigInt(offset)), amount: '9999999999.99', instant },
          );
        const inspect = () =>
          database.query(
            `SELECT ID, TO_CHAR(AMOUNT,'FM9999999990D00','NLS_NUMERIC_CHARACTERS=''.,''') AS AMOUNT, TO_CHAR(INSTANT_UTC,'YYYY-MM-DD"T"HH24:MI:SS.FF6"Z"') AS INSTANT FROM ${qualified} WHERE ID BETWEEN :first AND :last ORDER BY ID`,
            { first: String(base), last: String(base + 9n) },
          );
        const noBorrowers = () => assert.equal(observed.state.pool.connectionsInUse, 0);
        await database.transaction(async (connection) => {
          await add(connection, 0);
          await add(connection, 1); // explicit reuse of the caller-owned connection
          await assert.rejects(
            database.transaction(() => Promise.resolve()),
            { classification: 'nested_scope' },
          );
        });
        noBorrowers();
        const expected = [0n, 1n].map((offset) => ({
          ID: String(base + offset),
          AMOUNT: '9999999999.99',
          INSTANT: instant,
        }));
        assert.deepEqual((await inspect()).rows, expected);
        // Validate persistence from a separate transaction/read view.
        assert.equal(
          (
            await session.execute(
              `SELECT COUNT(*) FROM ${table} WHERE ID BETWEEN :first AND :last`,
              { first: String(base), last: String(base + 9n) },
            )
          ).rows[0][0],
          2,
        );
        const sentinel = new Error('STEP10_SYNTHETIC_TRANSACTION_TOKEN');
        await assert.rejects(
          database.transaction(async (connection) => {
            await add(connection, 2);
            await add(connection, 3);
            throw sentinel;
          }),
          (error) => error === sentinel,
        );
        noBorrowers();
        await database.withConnection((connection) => add(connection, 4));
        noBorrowers();
        await database.transaction((connection) => add(connection, 5));
        noBorrowers();
        assert.deepEqual((await inspect()).rows, [
          ...expected,
          { ID: String(base + 5n), AMOUNT: '9999999999.99', INSTANT: instant },
        ]);
        noBorrowers();
        record('transactions.persist-and-cleanup', 'PASS', { role: entry.role, borrowedAfter: 0 });
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        await database.close().catch((error) => {
          record('transactions.pool-cleanup', 'FAIL', { role: entry.role });
          if (!failed) throw error;
        });
      }
    }
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    // Dropping this invocation's uniquely named fixture removes its narrow grants.
    await session.execute(`DROP TABLE ${table} PURGE`).catch((error) => {
      record('transactions.fixture-cleanup', 'FAIL');
      if (!operationFailed) throw error;
    });
  }
}
