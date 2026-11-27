import assert from 'node:assert/strict';

export async function verifySeedRepeat(session, owner, manifest) {
  assert.ok(['SPORTIFY_TEST_OWNER', 'SPORTIFY_STEP10_CLEAN_OWNER'].includes(owner));
  const entries = manifest.migrations.filter((entry) => entry.kind === 'seed');
  assert.equal(entries.length, 2);
  async function snapshot() {
    return {
      sports: (
        await session.execute(
          'SELECT TO_CHAR(SPORT_ID) AS ID, SPORT_CODE, SPORT_NAME, RESOURCE_LABEL, DISPLAY_ORDER, IS_ACTIVE FROM SPORTS ORDER BY SPORT_CODE',
          {},
          { outFormat: 4002 },
        )
      ).rows,
      permissions: (
        await session.execute(
          'SELECT TO_CHAR(PERMISSION_ID) AS ID, PERMISSION_CODE, PERMISSION_NAME, DESCRIPTION FROM PERMISSIONS ORDER BY PERMISSION_CODE',
          {},
          { outFormat: 4002 },
        )
      ).rows,
    };
  }
  let cleanupFailed = false;
  try {
    await session.execute(
      "UPDATE SPORTS SET SPORT_NAME='Synthetic customized name', RESOURCE_LABEL='Synthetic label', DISPLAY_ORDER=777, IS_ACTIVE='N' WHERE SPORT_CODE='FUTSAL'",
      {},
      { autoCommit: false },
    );
    await session.execute(
      "UPDATE PERMISSIONS SET PERMISSION_NAME='Synthetic customized permission', DESCRIPTION='Synthetic customization' WHERE PERMISSION_CODE='business.read'",
      {},
      { autoCommit: false },
    );
    const before = await snapshot();
    for (let repetition = 0; repetition < 2; repetition++)
      for (const entry of entries)
        for (const statement of entry.statements) {
          assert.match(statement.sql, /^MERGE INTO (?:SPORTS|PERMISSIONS)\b/i);
          await session.execute(statement.sql, {}, { autoCommit: false });
        }
    assert.deepEqual(
      await snapshot(),
      before,
      'Seed reruns must preserve identity IDs and customized reference values.',
    );
    for (const entry of entries)
      for (const seed of entry.seeds) {
        const count = (
          await session.execute(
            `SELECT COUNT(*) AS TOTAL FROM ${seed.table}`,
            {},
            { outFormat: 4002 },
          )
        ).rows?.[0]?.TOTAL;
        assert.equal(count, seed.values.length);
      }
  } finally {
    try {
      await session.rollback();
    } catch {
      cleanupFailed = true;
      console.error('Seed fixture rollback failed; inspect disposable target.');
    }
  }
  if (cleanupFailed) throw new Error('Seed fixture rollback failed.');
  console.info(
    'PASS actual seed SQL executed twice: stable IDs, exact reference cardinality and existing customization preserved. Custom fixture changes rolled back.',
  );
}
