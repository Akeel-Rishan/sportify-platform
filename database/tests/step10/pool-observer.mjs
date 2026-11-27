// Test-only observation/fault routing around real driver pools. No app imports.
import oracledb from 'oracledb';

export function observedPoolFactory({
  createPool = (attributes) => oracledb.createPool(attributes),
  failInitializationOnce = false,
} = {}) {
  const state = {
    pool: undefined,
    created: 0,
    closed: 0,
    commits: 0,
    rollbacks: 0,
    releases: 0,
    initializationFailure: false,
  };
  const factory = async (attributes) => {
    const pool = await createPool({ ...attributes, enableStatistics: true });
    state.pool = pool;
    state.created++;
    return new Proxy(pool, {
      get(target, key) {
        if (key === 'getConnection')
          return async () => {
            const connection = await target.getConnection();
            return new Proxy(connection, {
              get(real, property) {
                if (property === 'execute')
                  return async (...args) => {
                    if (
                      failInitializationOnce &&
                      !state.initializationFailure &&
                      args[0] === "ALTER SESSION SET TIME_ZONE = 'UTC'"
                    ) {
                      state.initializationFailure = true;
                      // Real server error on OUR borrowed session, never network disruption.
                      return real.execute("ALTER SESSION SET TIME_ZONE = 'Not/A_Real_Zone'");
                    }
                    return real.execute(...args);
                  };
                if (property === 'commit')
                  return async (...args) => {
                    state.commits++;
                    return real.commit(...args);
                  };
                if (property === 'rollback')
                  return async (...args) => {
                    state.rollbacks++;
                    return real.rollback(...args);
                  };
                if (property === 'close')
                  return async (...args) => {
                    const result = await real.close(...args);
                    state.releases++;
                    return result;
                  };
                const value = Reflect.get(real, property, real);
                return typeof value === 'function' ? value.bind(real) : value;
              },
              set(real, property, value) {
                return Reflect.set(real, property, value, real);
              },
            });
          };
        if (key === 'close')
          return async (...args) => {
            const result = await target.close(...args);
            state.closed++;
            return result;
          };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  return { factory, state };
}
