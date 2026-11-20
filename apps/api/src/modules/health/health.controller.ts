import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@sportify/api-contracts';
import { ApplicationError } from '../../common/errors/application-error.js';
import { ReadinessService } from './readiness.service.js';

@Controller()
export class HealthController {
  constructor(@Inject(ReadinessService) private readonly readiness: ReadinessService) {}
  @Get('health')
  @Header('Cache-Control', 'no-store')
  health(): HealthResponse {
    return { status: 'ok', service: 'sportify-api' };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async ready(): Promise<ReadinessResponse> {
    if (!(await this.readiness.isReady())) throw new ApplicationError('SERVICE_UNAVAILABLE');
    return { status: 'ready', scope: 'application-and-oracle' };
  }
}
