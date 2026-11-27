// Disposable test-owner fixtures only. Never imported by application bootstrap.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  migrationChecksum,
  migrateSession,
  withMigrationLock,
  verifyCatalog,
  verifySession,
  MigrationError,
} from '@sportify/migrations';

const table = 'S7_RUNNER_FAILURE';
const primary = {
  name: 'PK_S7_RUNNER_FAILURE',
  table,
  type: 'P',
  columns: ['ID'],
  referencedTable: null,
  referencedColumns: [],
  expression: null,
};
const positive = {
  name: 'CK_S7_RUNNER_FAILURE',
  table,
  type: 'C',
  columns: [],
  referencedTable: null,
  referencedColumns: [],
  expression: 'ID > 0',
};

export function failureFixtureManifest(base) {
  const first = Number(base.migrations.at(-1).version) + 1;
  assert.ok(Number.isSafeInteger(first) && first + 2 <= 999999);
  function entry(offset, name, kind, sql, additions = {}) {
    const version = String(first + offset).padStart(6, '0');
    const statements = sql.map((text, index) => ({
      path: `migrations/${version}_${name}/${String(index + 1).padStart(3, '0')}_fixture.sql`,
      sql: text + '\n',
    }));
    const metadata = {
      version,
      name,
      kind,
      repairOf: null,
      files: statements.map(({ path }) => ({ path, format: 'sql' })),
      tables: [],
      constraints: [],
      indexes: [],
      seeds: [],
      ...additions,
    };
    return { ...metadata, statements, checksum: migrationChecksum(metadata, statements) };
  }
  const failed = entry(
    0,
    'controlled_failure_fixture',
    'schema',
    [
      `CREATE TABLE ${table} (ID NUMBER NOT NULL, CONSTRAINT ${primary.name} PRIMARY KEY (ID))`,
      // Intentionally invalid only in the expressly disposable test schema.
      `ALTER TABLE ${table} ADD CONSTRAINT ${positive.name} CHECK (MISSING_FIELD > 0)`,
    ],
    {
      tables: [
        {
          name: table,
          columns: [
            { name: 'ID', type: 'NUMBER', nullable: false, default: null, identity: false },
          ],
        },
      ],
      constraints: [primary, positive],
    },
  );
  const later = entry(1, 'after_repair_fixture', 'seed', [`INSERT INTO ${table} (ID) VALUES (1)`], {
    seeds: [{ table, key: 'ID', values: ['1'] }],
  });
  const repair = entry(
    2,
    'explicit_forward_repair_fixture',
    'schema',
    [`ALTER TABLE ${table} ADD CONSTRAINT ${positive.name} CHECK (ID > 0)`],
    { repairOf: failed.version, constraints: [positive] },
  );
  return {
    manifest: { ...base, migrations: [...base.migrations, failed, later, repair] },
    failed,
    later,
    repair,
  };
}

export async function verifyFailureRecovery(session, owner, base) {
  assert.ok(['SPORTIFY_TEST_OWNER', 'SPORTIFY_STEP10_CLEAN_OWNER'].includes(owner));
  const { manifest, failed, later, repair } = failureFixtureManifest(base);
  let actualInvalidColumn = false;
  const observing = {
    execute: async (...args) => {
      try {
        return await session.execute(...args);
      } catch (error) {
        if (args[0] === failed.statements[1].sql) actualInvalidColumn = error.errorNum === 904;
        throw error;
      }
    },
    commit: () => session.commit(),
    rollback: () => session.rollback(),
    close: () => session.close(),
  };
  const events = [];
  await assert.rejects(
    migrateSession(observing, owner, manifest, (event) => events.push(event)),
    (error) => error instanceof MigrationError && error.code === 'MIGRATION_FAILED',
  );
  assert.equal(actualInvalidColumn, true, 'Expected actual ORA-00904 from controlled fixture.');
  assert.equal(events.find((event) => event.event === 'migration.failed')?.failureRecorded, true);
  const history = (
    await session.execute(
      'SELECT VERSION, CHECKSUM, EXECUTION_STATUS, REPAIR_VERSION FROM SCHEMA_MIGRATIONS WHERE VERSION IN (:failed, :later, :repair)',
      { failed: failed.version, later: later.version, repair: repair.version },
      { outFormat: 4002 },
    )
  ).rows;
  assert.deepEqual(
    history.map((row) => row.VERSION),
    [failed.version],
  );
  assert.equal(history[0].EXECUTION_STATUS, 'FAILED');
  assert.equal(history[0].CHECKSUM, failed.checksum);
  assert.equal(history[0].REPAIR_VERSION, null);
  await assert.rejects(
    migrateSession(session, owner, manifest),
    (error) => error instanceof MigrationError && error.code === 'INCOMPLETE_HISTORY',
  );

  // Explicit reviewed fixture recovery: same advisory lock, exact partial-state
  // catalog check, distinct repair row, retained FAILED original. No generic
  // production repair command or automatic object-exists suppression.
  await withMigrationLock(session, owner, async () => {
    const partial = { ...failed, constraints: [primary] };
    await verifyCatalog(session, [...base.migrations, partial], owner);
    const current = (
      await session.execute(
        "SELECT CHECKSUM FROM SCHEMA_MIGRATIONS WHERE VERSION=:version AND EXECUTION_STATUS='FAILED' AND REPAIR_VERSION IS NULL",
        { version: failed.version },
        { outFormat: 4002 },
      )
    ).rows;
    assert.equal(current?.length, 1);
    assert.equal(current[0].CHECKSUM, failed.checksum);
    await session.execute(
      "INSERT INTO SCHEMA_MIGRATIONS (VERSION,DESCRIPTION,CHECKSUM,RUNNER_ID,EXECUTION_STATUS) VALUES (:version,:name,:checksum,:runner,'RUNNING')",
      {
        version: repair.version,
        name: repair.name,
        checksum: repair.checksum,
        runner: randomUUID(),
      },
      { autoCommit: false },
    );
    await session.commit();
    await session.execute(repair.statements[0].sql, {}, { autoCommit: false });
    await verifyCatalog(session, [...base.migrations, failed, repair], owner);
    const applied = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET EXECUTION_STATUS='APPLIED',INSTALLED_AT_UTC=LOCALTIMESTAMP,FINISHED_AT_UTC=LOCALTIMESTAMP,EXECUTION_MS=0 WHERE VERSION=:version AND EXECUTION_STATUS='RUNNING'",
      { version: repair.version },
      { autoCommit: false },
    );
    assert.equal(applied.rowsAffected, 1);
    await session.commit();
    const linked = await session.execute(
      "UPDATE SCHEMA_MIGRATIONS SET REPAIR_VERSION=:repair WHERE VERSION=:version AND CHECKSUM=:checksum AND EXECUTION_STATUS='FAILED' AND REPAIR_VERSION IS NULL",
      { repair: repair.version, version: failed.version, checksum: failed.checksum },
      { autoCommit: false },
    );
    assert.equal(linked.rowsAffected, 1);
    await session.commit();
  });
  assert.deepEqual(await migrateSession(session, owner, manifest), [later.version]);
  await verifySession(session, owner, manifest);
  console.info(
    'PASS Oracle controlled ORA-00904, retained FAILED state, later-step refusal, explicit partial-state-verified forward repair and resumed seed. Disposable fixture history retained.',
  );
}
