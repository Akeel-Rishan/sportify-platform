import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from '@sportify/api-contracts';

export const publicErrors = {
  BAD_REQUEST: { status: 400, message: 'The request could not be processed.' },
  VALIDATION_ERROR: { status: 400, message: 'The request contains invalid fields.' },
  UNAUTHENTICATED: { status: 401, message: 'Authentication is required.' },
  FORBIDDEN: { status: 403, message: 'You do not have permission to perform this action.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  METHOD_NOT_ALLOWED: { status: 405, message: 'This method is not allowed.' },
  CONFLICT: { status: 409, message: 'The request conflicts with the current resource state.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request body is too large.' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: 'This media type is not supported.' },
  BUSINESS_RULE_VIOLATION: {
    status: 422,
    message: 'The request does not satisfy the required rules.',
  },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Try again later.' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected error occurred.' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'The service is temporarily unavailable.' },
} as const satisfies Record<ApiErrorCode, { status: number; message: string }>;

export type ApplicationErrorCode = Exclude<ApiErrorCode, 'VALIDATION_ERROR'>;
export type ProtocolHeaders = Partial<Record<'Allow' | 'Retry-After' | 'WWW-Authenticate', string>>;

// Callers select a reviewed catalogue entry; arbitrary exception text is never public.
export class ApplicationError extends HttpException {
  readonly protocolHeaders: Readonly<ProtocolHeaders>;
  constructor(
    readonly code: ApplicationErrorCode,
    headers: ProtocolHeaders = {},
  ) {
    super(publicErrors[code].message, publicErrors[code].status);
    const safe: ProtocolHeaders = {};
    for (const name of ['Allow', 'Retry-After', 'WWW-Authenticate'] as const) {
      const value = headers[name];
      if (value !== undefined && value.length <= 256 && !/[\r\n]/.test(value)) safe[name] = value;
    }
    this.protocolHeaders = Object.freeze(safe);
  }
}
