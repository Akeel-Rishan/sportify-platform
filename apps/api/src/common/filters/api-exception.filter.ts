import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorCode, ApiErrorResponse } from '@sportify/api-contracts';
import { DatabaseError } from '@sportify/database';
import { ApplicationError, publicErrors } from '../errors/application-error.js';
import type { RequestLogger } from '../logging/request-logger.js';
import { requestId, type ApiRequest } from '../middleware/request-context.js';
import { DtoValidationError } from '../validation/dto-validation.pipe.js';

const statusCodes: Readonly<Partial<Record<number, ApiErrorCode>>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'BUSINESS_RULE_VIOLATION',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

function parserStatus(error: unknown): number | undefined {
  if (!(error instanceof Error) || !('type' in error) || !('status' in error)) return;
  // Exact Express body-parser failure categories, never arbitrary error.status/body/message.
  if (error.type === 'entity.too.large' && error.status === 413) return 413;
  if (error.type === 'encoding.unsupported' && error.status === 415) return 415;
  if (
    ['entity.parse.failed', 'request.aborted', 'request.size.invalid'].includes(
      String(error.type),
    ) &&
    error.status === 400
  )
    return 400;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: RequestLogger) {}
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<Response>();
    const id = requestId(request);
    const candidate =
      error instanceof HttpException
        ? error.getStatus()
        : error instanceof DatabaseError && error.classification === 'unavailable'
          ? 503
          : parserStatus(error);
    const status =
      candidate !== undefined && Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
        ? candidate
        : 500;
    const code: ApiErrorCode =
      error instanceof DtoValidationError
        ? 'VALIDATION_ERROR'
        : error instanceof ApplicationError
          ? error.code
          : (statusCodes[status] ?? (status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR'));
    if (status >= 500 && !(error instanceof ApplicationError)) {
      this.logger.error(
        id,
        error instanceof HttpException ? 'http_server_error' : 'unexpected_exception',
      );
    }
    if (response.headersSent) return;
    response.setHeader('Cache-Control', 'no-store');
    if (error instanceof ApplicationError) {
      for (const [name, value] of Object.entries(error.protocolHeaders))
        response.setHeader(name, value);
    }
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message: publicErrors[code].message,
        ...(error instanceof DtoValidationError ? { details: error.details } : {}),
      },
      requestId: id,
    };
    response.status(status);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.type('application/json').json(body);
  }
}
