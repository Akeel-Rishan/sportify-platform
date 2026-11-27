// Loaded only by the Step 10 child-process harness.
const oracledb = require('oracledb');
const { Server } = require('node:net');

const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  process.stdout.write('STEP10_TCP_LISTEN\n');
  return listen.apply(this, args);
};

const createPool = oracledb.createPool.bind(oracledb);
const shutdown = (signal) => process.emit(signal);

process.on('message', (message) => {
  if (message === 'step10-shutdown') shutdown('SIGINT');
});
process.channel?.unref();

oracledb.createPool = async (attributes) => {
  const pool = await createPool(attributes);
  const close = pool.close.bind(pool);
  pool.close = async (...args) => {
    const result = await close(...args);
    process.stdout.write('STEP10_POOL_CLOSED\n');
    return result;
  };
  try {
    // Observe the actual authenticated identity on this specific child pool.
    const connection = await pool.getConnection();
    try {
      connection.callTimeout = 5000;
      const { rows } = await connection.execute(
        "SELECT SYS_CONTEXT('USERENV','SESSION_USER'),SYS_CONTEXT('USERENV','DB_UNIQUE_NAME') FROM DUAL",
      );
      if (rows[0][0] !== process.env.ORACLE_USER || rows[0][1] !== 'fce953xa')
        throw new Error('Unexpected Step 10 child-pool identity or target.');
    } finally {
      await connection.close();
    }
    process.stdout.write(`STEP10_POOL_OPEN ${pool.poolMax}\n`);
    return pool;
  } catch (error) {
    await pool.close().catch(() => {});
    throw error;
  }
};
