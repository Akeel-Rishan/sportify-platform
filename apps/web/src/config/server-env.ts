import 'server-only';

// Next.js owns NODE_ENV and its framework variables. Add application-owned
// server variables here only when used; do not introduce a second dotenv loader.
export const serverEnv: Readonly<Record<string, never>> = Object.freeze({});
