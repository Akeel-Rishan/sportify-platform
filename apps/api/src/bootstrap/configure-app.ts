import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import { ApiExceptionFilter } from '../common/filters/api-exception.filter.js';
import { SuccessEnvelopeInterceptor } from '../common/interceptors/success-envelope.interceptor.js';
import { RequestLogger, type LogSink } from '../common/logging/request-logger.js';
import { requestContext } from '../common/middleware/request-context.js';
import { DtoValidationPipe } from '../common/validation/dto-validation.pipe.js';
import { hostBoundary, type HostPolicy } from '../modules/tenancy/host-boundary.js';
import { TenantBoundaryInterceptor } from '../modules/tenancy/tenant.module.js';

export function configureApp(
  app: NestExpressApplication,
  sink: LogSink | undefined,
  hosts: HostPolicy,
): void {
  const logger = new RequestLogger(sink);
  // Must run before init/listen: Nest installs its default parsers during init.
  app.use(requestContext(logger));
  app.set('trust proxy', false);
  // Node's count cap can omit later raw fields before the middleware sees them.
  // Keep the parser's byte cap and enforce the count on the complete field list.
  app.getHttpServer().maxHeadersCount = 0;
  app.use(hostBoundary(hosts));
  app.useGlobalInterceptors(new TenantBoundaryInterceptor());
  const preventAuthCaching: RequestHandler = (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  };
  app.use('/api/v1/auth', preventAuthCaching);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.useGlobalInterceptors(new SuccessEnvelopeInterceptor());
  app.useGlobalPipes(new DtoValidationPipe());
}
