import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { Database } from '@sportify/database';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import type { RegistrationConfig } from './modules/auth/auth-config.js';
import type { RegistrationOwner } from './modules/auth/registration.service.js';
@Module({})
export class AppModule {
  static register(
    database: Database,
    config?: RegistrationConfig,
    owner: RegistrationOwner = 'SPORTIFY_SCHEMA_OWNER',
  ): DynamicModule {
    const lifecycle: OnApplicationShutdown = { onApplicationShutdown: () => database.close() };
    return {
      module: AppModule,
      imports: [
        HealthModule.register(database),
        ...(config ? [AuthModule.register(database, owner, config)] : []),
      ],
      providers: [{ provide: 'ORACLE_POOL_LIFECYCLE', useValue: lifecycle }],
    };
  }
}
