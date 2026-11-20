import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { Database } from '@sportify/database';
import { HealthModule } from './modules/health/health.module.js';
@Module({})
export class AppModule {
  static register(database: Database): DynamicModule {
    const lifecycle: OnApplicationShutdown = { onApplicationShutdown: () => database.close() };
    return {
      module: AppModule,
      imports: [HealthModule.register(database)],
      providers: [{ provide: 'ORACLE_POOL_LIFECYCLE', useValue: lifecycle }],
    };
  }
}
