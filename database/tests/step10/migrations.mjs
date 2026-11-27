import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import oracledb from 'oracledb';
import {
  migrateSession,
  migrationChecksum,
  statusSession,
  verifySession,
  withMigrationLock,
  withOwnerSession,
} from '@sportify/migrations';
import { createFixtures, cleanupFixtures, money, timestamp, START } from '../step08/fixtures.mjs';
import { failureFixtureManifest, verifyFailureRecovery } from '../support/failure-recovery.mjs';
import { verifySeedRepeat } from '../support/seed-repeat.mjs';
import { CLEAN_OWNER, UPGRADE_OWNER, verifyEmptyOwner } from './config.mjs';

const quiet = () => {};
const names = (manifest) => manifest.migrations.map((entry) => entry.version);

export async function verifyEmptyBaseline(config, manifest, record) {
  await withOwnerSession(config, async (session) => {
    await verifyEmptyOwner(session, CLEAN_OWNER);
    const table = 'S10_BASE_' + randomUUID().replaceAll('-', '').slice(0, 18).toUpperCase();
    await session.execute(`CREATE TABLE ${table} (ID NUMBER)`);
    try {
      await session.execute(`INSERT INTO ${table} VALUES (1)`);
      await session.commit();
      await assert.rejects(migrateSession(session, CLEAN_OWNER, manifest, quiet), {
        code: 'POPULATED_UNKNOWN_SCHEMA',
      });
      assert.deepEqual((await session.execute(`SELECT ID FROM ${table}`)).rows, [[1]]);
      assert.deepEqual(
        (await session.execute('SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME')).rows,
        [[table]],
      );
      record('migration.unknown-populated-refused', 'PASS');
    } finally {
      await session.execute(`DROP TABLE ${table} PURGE`);
    }
  });
}

export async function verifyInstalledCleanOwner(session, manifest) {
  await verifySession(session, CLEAN_OWNER, manifest);
  const baseline = await statusSession(session, manifest);
  assert.deepEqual(baseline.pending, []);
  assert.deepEqual(
    baseline.history,
    manifest.migrations.map((entry) => ({
      VERSION: entry.version,
      CHECKSUM: entry.checksum,
      EXECUTION_STATUS: 'APPLIED',
      REPAIR_VERSION: null,
    })),
  );
  for (const { name } of manifest.migrations.flatMap((entry) => entry.tables)) {
    if (name === 'SCHEMA_MIGRATIONS') continue;
    const expected = { SPORTS: 8, PERMISSIONS: 20 }[name] ?? 0;
    assert.deepEqual((await session.execute(`SELECT COUNT(*) FROM ${name}`)).rows, [[expected]]);
  }
  return baseline;
}

export async function verifyCleanInstall(session, manifest, record, { installed = false } = {}) {
  if (!installed) {
    await verifyEmptyOwner(session, CLEAN_OWNER);
    assert.deepEqual(await migrateSession(session, CLEAN_OWNER, manifest, quiet), names(manifest));
  }
  const baseline = await verifyInstalledCleanOwner(session, manifest);
  record(
    installed ? 'migration.clean-catalog-reconfirmed' : 'migration.clean-and-catalog',
    'PASS',
    {
      versions: baseline.history.length,
    },
  );
  const changed = structuredClone(manifest);
  changed.migrations[0].name += '_tampered';
  changed.migrations[0].checksum = migrationChecksum(
    changed.migrations[0],
    changed.migrations[0].statements,
  );
  await assert.rejects(migrateSession(session, CLEAN_OWNER, changed, quiet), {
    code: 'ARTIFACT_CHANGED',
  });
  for (const operation of [
    "DELETE FROM SCHEMA_MIGRATIONS WHERE VERSION='000002'",
    "UPDATE SCHEMA_MIGRATIONS SET VERSION='999999' WHERE VERSION='000026'",
  ]) {
    try {
      assert.equal((await session.execute(operation, {}, { autoCommit: false })).rowsAffected, 1);
      await assert.rejects(statusSession(session, manifest), { code: 'UNKNOWN_HISTORY' });
    } finally {
      await session.rollback();
    }
  }
  assert.deepEqual(await statusSession(session, manifest), baseline);
  record('migration.history-protection', 'PASS', { cases: 3 });
  await verifySeedRepeat(session, CLEAN_OWNER, manifest);
  record('seeds.repeat-and-customization', 'PASS', { sports: 8, permissions: 20 });
}

export async function snapshotFixtures(session, manifest) {
  const state = {};
  for (const table of manifest.migrations.flatMap((entry) => entry.tables)) {
    if (table.name === 'SCHEMA_MIGRATIONS') continue;
    const projection = table.columns.map(({ name, type }) => {
      if (type.startsWith('TIMESTAMP')) return `TO_CHAR(${name},'YYYY-MM-DD HH24:MI:SS.FF6')`;
      if (type === 'DATE') return `TO_CHAR(${name},'YYYY-MM-DD HH24:MI:SS')`;
      if (type.startsWith('NUMBER'))
        return `TO_CHAR(${name},'TM9','NLS_NUMERIC_CHARACTERS=''.,''')`;
      // These CLOBs contain only short, controlled synthetic fixture text.
      if (type === 'CLOB') return `DBMS_LOB.SUBSTR(${name},2000,1)`;
      return name;
    });
    const { rows } = await session.execute(
      `SELECT ${projection.join(',')} FROM ${table.name}`,
      {},
      { maxRows: 100 },
    );
    assert.ok(rows.length < 100, 'Only small disposable snapshots are allowed.');
    state[table.name] = rows.map((row) => JSON.stringify(row)).sort();
  }
  return state;
}

export async function verifyUpgrade(session, manifest, record) {
  await verifyEmptyOwner(session, UPGRADE_OWNER);
  const prefix = { ...manifest, migrations: manifest.migrations.slice(0, 17) };
  assert.deepEqual(await migrateSession(session, UPGRADE_OWNER, prefix, quiet), names(prefix));
  const f = await createFixtures(session, UPGRADE_OWNER, prefix, { expectedOwner: UPGRADE_OWNER });
  let failed = false;
  try {
    for (const tenant of f.tenants) {
      const booking = await f.booking(tenant);
      const hold = await f.hold(tenant);
      await f.slots(session, booking, [START]);
      const payment = f.id();
      await f.insert('PAYMENTS', {
        PAYMENT_ID: payment,
        TENANT_ID: tenant.tenant,
        BOOKING_ID: booking.id,
        PAYMENT_METHOD: 'CASH',
        AMOUNT: money('1000.00'),
        CURRENCY_CODE: 'LKR',
        RECEIVED_AT_UTC: timestamp(START),
        RECORDED_BY_MEMBERSHIP_ID: tenant.member,
        PUBLIC_ID: randomUUID(),
      });
      await f.insert('REFUNDS', {
        TENANT_ID: tenant.tenant,
        PAYMENT_ID: payment,
        AMOUNT: money('1000.00'),
        CURRENCY_CODE: 'LKR',
        REFUND_REASON: 'Synthetic upgrade fixture',
        PROCESSED_AT_UTC: timestamp(START),
        RECORDED_BY_MEMBERSHIP_ID: tenant.member,
        PUBLIC_ID: randomUUID(),
      });
      assert.ok(hold.item);
    }
    await session.commit();
    const before = await snapshotFixtures(session, prefix);
    const history = (await statusSession(session, prefix)).history;
    assert.deepEqual(
      await migrateSession(session, UPGRADE_OWNER, manifest, quiet),
      names(manifest).slice(17),
    );
    await verifySession(session, UPGRADE_OWNER, manifest);
    assert.deepEqual(await snapshotFixtures(session, prefix), before);
    assert.deepEqual((await statusSession(session, manifest)).history.slice(0, 17), history);
    assert.deepEqual(await migrateSession(session, UPGRADE_OWNER, manifest, quiet), []);
    assert.deepEqual(await snapshotFixtures(session, prefix), before);
    record('migration.upgrade-and-repeat-preservation', 'PASS', {
      prefix: 17,
      delta: 9,
      tenants: 2,
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    await session
      .rollback()
      .then(() => cleanupFixtures(session, UPGRADE_OWNER, manifest, f))
      .catch((error) => {
        record('migration.upgrade-fixture-cleanup', 'FAIL');
        if (!failed) throw error;
      });
  }
}

export async function verifyRunnerLock(config, session, manifest, record) {
  const table = 'S10_LOCK_' + randomUUID().replaceAll('-', '').slice(0, 18).toUpperCase();
  await withMigrationLock(session, CLEAN_OWNER, async () => {
    await session.execute(`CREATE TABLE ${table} (ID NUMBER)`);
    try {
      await withOwnerSession(config, (second) =>
        assert.rejects(migrateSession(second, CLEAN_OWNER, manifest, quiet), {
          code: 'LOCK_UNAVAILABLE',
        }),
      );
    } finally {
      await session.execute(`DROP TABLE ${table} PURGE`);
    }
  });
  await withOwnerSession(config, async (abandoned) => {
    const result = await abandoned.execute(
      `DECLARE h VARCHAR2(128); BEGIN DBMS_LOCK.ALLOCATE_UNIQUE(:name,h);
       :result := DBMS_LOCK.REQUEST(h,DBMS_LOCK.X_MODE,0,FALSE); END;`,
      {
        name: `SPORTIFY_MIGRATIONS:${CLEAN_OWNER}`,
        result: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    assert.equal(result.outBinds.result, 0);
    // Close the suite-owned session while the lock is still held.
  });
  assert.deepEqual(await migrateSession(session, CLEAN_OWNER, manifest, quiet), []);
  record('migration.lock-ddl-and-session-close', 'PASS', { concurrentRunners: 2 });
}

export async function verifyInjectedFailures(session, manifest, record) {
  await verifyFailureRecovery(session, CLEAN_OWNER, manifest);
  record('migration.ddl-failure-and-forward-repair', 'PASS');
  const repaired = failureFixtureManifest(manifest).manifest;
  const version = String(Number(repaired.migrations.at(-1).version) + 1).padStart(6, '0');
  const name = 'controlled_seed_rollback';
  const statements = [2, 1].map((id, index) => ({
    path: `migrations/${version}_${name}/00${index + 1}_fixture.sql`,
    sql: `INSERT INTO S7_RUNNER_FAILURE (ID) VALUES (${id})\n`,
  }));
  const metadata = {
    version,
    name,
    kind: 'seed',
    repairOf: null,
    files: statements.map(({ path }) => ({ path, format: 'sql' })),
    tables: [],
    constraints: [],
    indexes: [],
    seeds: [],
  };
  const entry = { ...metadata, statements, checksum: migrationChecksum(metadata, statements) };
  let actualCode;
  const observer = {
    async execute(...args) {
      try {
        return await session.execute(...args);
      } catch (error) {
        if (args[0] === statements[1].sql) actualCode = error.errorNum;
        throw error;
      }
    },
    commit: () => session.commit(),
    rollback: () => session.rollback(),
  };
  await assert.rejects(
    migrateSession(
      observer,
      CLEAN_OWNER,
      { ...repaired, migrations: [...repaired.migrations, entry] },
      quiet,
    ),
    { code: 'MIGRATION_FAILED' },
  );
  assert.equal(actualCode, 1);
  assert.deepEqual((await session.execute('SELECT ID FROM S7_RUNNER_FAILURE ORDER BY ID')).rows, [
    [1],
  ]);
  assert.deepEqual(
    (
      await session.execute(
        'SELECT EXECUTION_STATUS,CHECKSUM,REPAIR_VERSION FROM SCHEMA_MIGRATIONS WHERE VERSION=:version',
        { version },
      )
    ).rows,
    [['FAILED', entry.checksum, null]],
  );
  record('seeds.failure-atomicity', 'PASS', { oracle: 1, retainedFailedVersion: version });
}
