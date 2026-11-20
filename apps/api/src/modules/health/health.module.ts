import { Module, type DynamicModule } from '@nestjs/common';
import type { Database } from '@sportify/database';
import { HealthController } from './health.controller.js';
import { ReadinessService } from './readiness.service.js';
@Module({})
export class HealthModule {
  static register(database: Database): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [{ provide: ReadinessService, useFactory: () => new ReadinessService(database) }],
    };
  }
}
