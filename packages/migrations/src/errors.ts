export type MigrationErrorCode =
  | 'INVALID_ARTIFACT'
  | 'ARTIFACT_CHANGED'
  | 'DESIGN_REVIEW_REQUIRED'
  | 'UNKNOWN_HISTORY'
  | 'INCOMPLETE_HISTORY'
  | 'TARGET_MISMATCH'
  | 'OWNER_CONNECTION_FAILED'
  | 'POPULATED_UNKNOWN_SCHEMA'
  | 'LOCK_UNAVAILABLE'
  | 'LOCK_RELEASE_FAILED'
  | 'CATALOG_MISMATCH'
  | 'CAPABILITY_MISMATCH'
  | 'MIGRATION_FAILED'
  | 'HISTORY_WRITE_FAILED'
  | 'CLEANUP_FAILED';

export class MigrationError extends Error {
  constructor(readonly code: MigrationErrorCode) {
    super(
      `Migration command failed (${code}). Consult the operator runbook; raw database diagnostics are suppressed.`,
    );
    this.name = 'MigrationError';
  }
}
