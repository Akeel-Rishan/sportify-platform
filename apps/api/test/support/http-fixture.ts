import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Module,
  Param,
  Post,
  Redirect,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { EventEmitter } from 'node:events';
import { configureApp } from '../../src/bootstrap/configure-app.js';
import { ApplicationError } from '../../src/common/errors/application-error.js';
import { BypassEnvelope } from '../../src/common/interceptors/success-envelope.interceptor.js';
import type { RequestLogRecord } from '../../src/common/logging/request-logger.js';
import { HealthController } from '../../src/modules/health/health.controller.js';
import { ReadinessService } from '../../src/modules/health/readiness.service.js';

export const SENTINEL = 'PRIVATE_SENTINEL_password_sql_connection_path';
export class ProofDto {
  static schema = z.strictObject({
    label: z.string().min(1),
    enabled: z.boolean(),
    nested: z.strictObject({ count: z.number().int().min(1) }),
  });
  declare label: string;
  declare enabled: boolean;
  declare nested: { count: number };
}

// This module is imported only by tests; the production build excludes test/.
@Controller('proof')
class ProofController {
  @Get('data')
  data() {
    return { success: true, data: 'payload', requestId: 'payload-value' };
  }

  @Post('dto')
  dto(@Body() payload: ProofDto) {
    return payload;
  }

  @Get('undefined')
  nothing(): undefined {
    return undefined;
  }

  @Get('no-content')
  @HttpCode(204)
  noContent() {
    return { ignored: true };
  }

  @Get('not-modified')
  @HttpCode(304)
  notModified() {
    return { ignored: true };
  }

  @Get('redirect')
  @Redirect('/api/v1/health', 302)
  redirect() {
    return { url: '/api/v1/health' };
  }

  @Get('file')
  file() {
    return new StreamableFile(Buffer.from('test-only-file'), { type: 'text/plain' });
  }

  @Get('raw')
  @BypassEnvelope()
  raw(@Res() response: Response): void {
    response.type('text/plain').send('test-only-raw');
  }

  @Get('aborted')
  @BypassEnvelope()
  aborted(@Res() response: Response): void {
    response.flushHeaders();
  }

  @Get('sent')
  @BypassEnvelope()
  sent(@Res() response: Response): never {
    response.type('text/plain').send('already-sent');
    throw new Error(SENTINEL);
  }

  @Get('conflict')
  conflict(): never {
    throw new ApplicationError('CONFLICT');
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error(SENTINEL);
  }

  @Get('framework/:status')
  framework(@Param('status') status: string): never {
    throw new HttpException(
      { message: SENTINEL, details: SENTINEL, secret: SENTINEL },
      Number(status),
    );
  }

  @Get('challenge')
  challenge(): never {
    throw new ApplicationError('UNAUTHENTICATED', { 'WWW-Authenticate': 'Bearer' });
  }

  @Get('retry')
  @Header('Vary', 'Accept')
  retry(): never {
    throw new ApplicationError('RATE_LIMITED', { 'Retry-After': '30' });
  }

  @Get('method')
  method(): never {
    throw new ApplicationError('METHOD_NOT_ALLOWED', { Allow: 'GET' });
  }

  @Get('parallel/:value')
  async parallel(@Param('value') value: string) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    return { value };
  }
}

@Module({})
class HttpTestModule {}

export async function httpFixture(readiness: ReadinessService = new ReadinessService()) {
  const records: RequestLogRecord[] = [];
  const events = new EventEmitter();
  const app = await NestFactory.create<NestExpressApplication>(
    {
      module: HttpTestModule,
      controllers: [HealthController, ProofController],
      providers: [{ provide: ReadinessService, useValue: readiness }],
    },
    { logger: false },
  );
  configureApp(app, (record) => {
    records.push(record);
    events.emit('record', record);
  });
  try {
    await app.listen(0, '127.0.0.1');
  } catch (error) {
    await app.close();
    throw error;
  }
  const url = await app.getUrl();
  function completion(id: string): Promise<RequestLogRecord> {
    const existing = records.find(
      (r) => r.requestId === id && r.event === 'http.request.completed',
    );
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        events.removeListener('record', listener);
        reject(new Error('Timed out waiting for request completion'));
      }, 2000);
      const listener = (record: RequestLogRecord): void => {
        if (record.requestId !== id || record.event !== 'http.request.completed') return;
        clearTimeout(timeout);
        events.removeListener('record', listener);
        resolve(record);
      };
      events.on('record', listener);
    });
  }
  return { app, records, url, readiness, completion };
}
