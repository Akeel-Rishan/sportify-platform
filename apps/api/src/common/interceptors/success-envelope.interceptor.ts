import {
  SetMetadata,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { REDIRECT_METADATA, SSE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import type { ApiSuccess } from '@sportify/api-contracts';
import { requestId, type ApiRequest } from '../middleware/request-context.js';

const bypassKey = 'sportify:non-json-response';
export const BypassEnvelope = () => SetMetadata(bypassKey, true);

export class SuccessEnvelopeInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly reflector = new Reflector();
  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];
    const bypass = [bypassKey, REDIRECT_METADATA, SSE_METADATA].some((key) =>
      Boolean(this.reflector.getAllAndOverride<unknown>(key, targets)),
    );
    if (bypass) return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (request.method === 'HEAD' || response.statusCode === 204 || response.statusCode === 304)
          return undefined;
        if (
          response.headersSent ||
          (response.statusCode >= 300 && response.statusCode < 400) ||
          data instanceof StreamableFile ||
          data instanceof Readable
        )
          return data;
        const contentType = response.getHeader('content-type');
        if (
          typeof contentType === 'string' &&
          !/^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(contentType)
        )
          return data;
        return {
          success: true,
          data: data === undefined ? null : data,
          requestId: requestId(request),
        } satisfies ApiSuccess<unknown>;
      }),
    );
  }
}
