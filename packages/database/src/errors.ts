export type DatabaseEvent =
  | 'oracle.pool.initialization_failed'
  | 'oracle.rollback.failed'
  | 'oracle.release.failed'
  | 'oracle.pool.close_failed'
  | 'oracle.probe.unavailable';
export type DatabaseLog = (record: {
  timestamp: string;
  severity: 'warn';
  service: 'sportify-api' | 'sportify-worker';
  event: DatabaseEvent;
}) => void;

export class DatabaseError extends Error {
  constructor(
    readonly classification:
      | 'unavailable'
      | 'scope_closed'
      | 'parallel_operation'
      | 'nested_scope'
      | 'temporal_projection_required'
      | 'invalid_bind',
  ) {
    super(`Database operation failed (${classification}).`);
    this.name = 'DatabaseError';
  }
}
