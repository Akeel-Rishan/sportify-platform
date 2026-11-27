import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '@sportify/database';
import { observedPoolFactory } from './pool-observer.mjs';

const root = new URL('../../../', import.meta.url);
const preload = fileURLToPath(new URL('observe-entrypoint.cjs', import.meta.url));
const localServer = async (host = '127.0.0.1') => {
  const server = createServer();
  server.listen(0, host);
  await once(server, 'listening');
  return server;
};
const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
const readyPath = '/api/v1/ready';

async function until(work, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  do {
    const result = await work();
    if (result) return result;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error('Step 10 application check timed out.');
}

async function http(url, path, status) {
  const response = await fetch(url + path, { signal: AbortSignal.timeout(5000) });
  const body = await response.json();
  if (response.status !== status) return null;
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  return body;
}

async function verifyCompiledFactories(entries, record) {
  const [api, worker] = entries;
  const { createApiApplication, listenApi } = await import(
    new URL('apps/api/dist/application.js', root)
  );
  const { startWorker } = await import(new URL('apps/worker/dist/worker.js', root));
  const observed = observedPoolFactory();
  // Match the production listener's wildcard bind, including dual stack.
  const occupied = await localServer('::');
  try {
    await assert.rejects(
      async () => {
        const unexpected = await listenApi(
          {
            NODE_ENV: 'production',
            PORT: occupied.address().port,
            database: { ...api.config, ORACLE_POOL_MIN: 1 },
          },
          (config) => createDatabase(config, 'api', observed.factory),
        );
        await unexpected.close();
      },
      { code: 'EADDRINUSE' },
    );
    assert.equal(observed.state.created, 1);
    assert.equal(observed.state.closed, 1);
    record('api.partial-startup-release', 'PASS', { failure: 'EADDRINUSE' });
  } finally {
    await closeServer(occupied);
  }

  const logs = [];
  const pool = observedPoolFactory();
  let database;
  const app = await createApiApplication(
    { NODE_ENV: 'production', PORT: 4000, database: api.config },
    (event) => logs.push(event),
    async (config) => {
      database = await createDatabase(config, 'api', pool.factory, (event) => logs.push(event));
      return database;
    },
  );
  try {
    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    assert.ok(await http(url, '/api/v1/health', 200));
    assert.equal((await http(url, readyPath, 200))?.data?.scope, 'application-and-oracle');
    assert.equal(pool.state.pool.connectionsInUse, 0);
    await database.close();
    const unavailable = await until(() => http(url, readyPath, 503), 8000);
    assert.equal(unavailable.error?.code, 'SERVICE_UNAVAILABLE');
    assert.ok(await http(url, '/api/v1/health', 200));
    assert.ok(
      logs.some((event) => event.requestId === unavailable.requestId && event.status === 503),
    );
    const captured = JSON.stringify({ unavailable, logs });
    for (const sensitive of [
      api.config.ORACLE_PASSWORD,
      api.config.ORACLE_CONNECT_STRING,
      api.config.ORACLE_WALLET_DIRECTORY,
      api.config.ORACLE_WALLET_PASSWORD,
    ]) {
      assert.ok(!captured.includes(JSON.stringify(sensitive).slice(1, -1)));
    }
    assert.doesNotMatch(captured, /(?:ORA|NJS|DPI)-\d+/);
    record('api.readiness-and-redaction', 'PASS', {
      dependencyFailure: 'isolated local Oracle pool closed',
    });
  } finally {
    await app.close();
  }
  assert.equal(pool.state.closed, 1);

  const workerPool = observedPoolFactory();
  const running = await startWorker(
    { NODE_ENV: 'production', database: worker.config },
    () => {},
    (config) => createDatabase(config, 'worker', workerPool.factory),
  );
  const first = running.shutdown('SIGINT');
  assert.equal(first, running.shutdown('SIGTERM'));
  await first;
  assert.equal(workerPool.state.closed, 1);
  record('worker.repeated-shutdown', 'PASS');
}

function childEnvironment(entry, port) {
  const system = {};
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH']) {
    if (process.env[key] !== undefined) system[key] = process.env[key];
  }
  return {
    ...system,
    ...Object.fromEntries(Object.entries(entry.config).map(([key, value]) => [key, String(value)])),
    ORACLE_POOL_MAX: entry.role === 'api' ? '8' : '2',
    NODE_ENV: 'production',
    PORT: String(port),
  };
}

export async function verifyEntrypoint(entry, record, { consoleSignal = false } = {}) {
  const placeholder = await localServer();
  const port = placeholder.address().port;
  await closeServer(placeholder);
  const environment = childEnvironment(entry, port);
  assert.ok(
    !Object.keys(environment).some((key) => /MIGRATION|ADMIN_PASSWORD|UPGRADE_PASSWORD/.test(key)),
  );
  let receivedConsoleInterrupt = false;
  const onInterrupt = () => {
    receivedConsoleInterrupt = true;
  };
  if (consoleSignal) process.on('SIGINT', onInterrupt);
  const child = spawn(
    process.execPath,
    ['--require', preload, fileURLToPath(new URL(`apps/${entry.role}/dist/main.js`, root))],
    {
      env: environment,
      windowsHide: true,
      stdio: consoleSignal ? ['inherit', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  );
  const ended = new Promise((resolve) => {
    child.once('error', () => resolve({ failed: true }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  let output = '';
  const append = (chunk) => {
    // Keep bounded local evidence in memory. Never print captured child output.
    output = (output + String(chunk)).slice(-32_768);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  try {
    const marker = entry.role === 'api' ? '[api] Listening' : '[worker] Idle.';
    await until(
      () =>
        output.includes(marker) &&
        output.includes(`STEP10_POOL_OPEN ${environment.ORACLE_POOL_MAX}`),
    );
    assert.equal((output.match(/STEP10_POOL_OPEN/g) ?? []).length, 1);
    if (entry.role === 'api') {
      assert.ok(await http(`http://127.0.0.1:${port}`, readyPath, 200));
    }
    assert.equal((output.match(/STEP10_TCP_LISTEN/g) ?? []).length, entry.role === 'api' ? 1 : 0);
    const windows = process.platform === 'win32';
    // Node's Windows kill(SIGINT) terminates forcibly. IPC delivers a JS signal
    // event there, while POSIX sends the actual SIGTERM to the owned child.
    if (consoleSignal)
      console.info(`Step 10 ${entry.role} ready. Press Ctrl+C once in this terminal.`);
    else if (windows) child.send('step10-shutdown');
    else assert.equal(child.kill('SIGTERM'), true);
    const result = await Promise.race([
      ended,
      delay(consoleSignal ? 45_000 : 15_000, { timeout: true }, { ref: false }),
    ]);
    assert.ok(!result.timeout && !result.failed);
    assert.equal((output.match(/STEP10_POOL_CLOSED/g) ?? []).length, 1);
    if (consoleSignal) assert.equal(receivedConsoleInterrupt, true);
    assert.doesNotMatch(output, /(?:ORA|NJS|DPI)-\d+/);
    for (const key of [
      'ORACLE_PASSWORD',
      'ORACLE_WALLET_PASSWORD',
      'ORACLE_WALLET_DIRECTORY',
      'ORACLE_CONNECT_STRING',
    ])
      assert.ok(!output.includes(environment[key]));
    record('application.compiled-entrypoint', 'PASS', {
      role: entry.role,
      signal: consoleSignal
        ? 'native console SIGINT'
        : windows
          ? 'IPC-delivered SIGINT event'
          : 'native SIGTERM',
      closed: 1,
    });
  } finally {
    if (consoleSignal) process.removeListener('SIGINT', onInterrupt);
    if (child.exitCode === null && child.signalCode === null && child.pid) child.kill('SIGKILL');
    await ended;
  }
}

export async function verifyApplicationLifecycle(entries, record) {
  await verifyCompiledFactories(entries, record);
  for (const entry of entries) await verifyEntrypoint(entry, record);
}
