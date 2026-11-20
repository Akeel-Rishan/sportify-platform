import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startWorker } from './worker.js';

let worker: ReturnType<typeof startWorker> | undefined;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  worker?.shutdown('SIGTERM');
  worker = undefined;
  vi.useRealTimers();
});

it('invalid configuration creates no timer, listeners or work', () => {
  const log = vi.fn();
  const initial = process.listenerCount('SIGTERM');
  expect(() => startWorker({ NODE_ENV: 'private-value' }, log)).toThrow(/NODE_ENV/);
  expect(vi.getTimerCount()).toBe(0);
  expect(log).not.toHaveBeenCalled();
  expect(process.listenerCount('SIGTERM')).toBe(initial);
});
it.each(['SIGINT', 'SIGTERM'] as const)(
  'cleans timers and both listeners on %s and is idempotent',
  (signal) => {
    const initialInterrupt = process.listenerCount('SIGINT');
    const initialTerminate = process.listenerCount('SIGTERM');
    const log = vi.fn();
    worker = startWorker({ NODE_ENV: 'test' }, log);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Idle. No jobs are configured'));
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2_147_483_647);
    expect(log).toHaveBeenCalledTimes(1);
    // Deliver only our installed handler, leaving the test runner's handlers alone.
    const listener = process.listeners(signal).at(-1);
    if (!listener) throw new Error('Worker signal handler missing');
    listener(signal);
    worker.shutdown(signal);
    expect(vi.getTimerCount()).toBe(0);
    expect(process.listenerCount('SIGINT')).toBe(initialInterrupt);
    expect(process.listenerCount('SIGTERM')).toBe(initialTerminate);
    expect(log).toHaveBeenCalledTimes(2);
  },
);
