export interface RequestCompletionRecord {
  timestamp: string;
  severity: 'info' | 'warn' | 'error';
  service: 'sportify-api';
  event: 'http.request.completed';
  requestId: string;
  tenantPublicId?: string;
  method: string;
  route: string;
  status: number | null;
  durationMs: number;
  outcome: 'completed' | 'aborted';
}

export interface RequestErrorRecord {
  timestamp: string;
  severity: 'error';
  service: 'sportify-api';
  event: 'http.request.error';
  requestId: string;
  classification: 'unexpected_exception' | 'http_server_error';
}

export type RequestLogRecord = RequestCompletionRecord | RequestErrorRecord;
export type LogSink = (record: RequestLogRecord) => void;

export class RequestLogger {
  constructor(
    private readonly sink: LogSink = (record) => {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    },
  ) {}

  write(record: RequestLogRecord): void {
    // A failed output transport must not change an HTTP response or recurse.
    try {
      this.sink(record);
    } catch {
      /* No unsafe exception fallback logging. */
    }
  }

  error(requestId: string, classification: RequestErrorRecord['classification']): void {
    this.write({
      timestamp: new Date().toISOString(),
      severity: 'error',
      service: 'sportify-api',
      event: 'http.request.error',
      requestId,
      classification,
    });
  }
}
