// Explicitly empty allowlist: the foundation has no application-owned public
// environment variables. Never spread process.env into browser configuration.
export const publicEnv: Readonly<Record<string, never>> = Object.freeze({});
