import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { Database } from '@sportify/database';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import type { RegistrationConfig } from './modules/auth/auth-config.js';
import type { RegistrationOwner } from './modules/auth/registration.service.js';
import { AccountModule } from './modules/auth/account.module.js';
import type { AccountOwner } from './modules/auth/account.service.js';
import type { SessionConfig } from './modules/auth/session-config.js';
import { TenantModule } from './modules/tenancy/tenant.module.js';
@Module({})
export class AppModule {
  static register(
    database: Database,
    config?: RegistrationConfig,
    owner: RegistrationOwner = 'SPORTIFY_SCHEMA_OWNER',
    account?: SessionConfig,
    accountOwner: AccountOwner = 'SPORTIFY_SCHEMA_OWNER',
  ): DynamicModule {
    const lifecycle: OnApplicationShutdown = { onApplicationShutdown: () => database.close() };
    const accountModule = account
      ? AccountModule.register(database, accountOwner, account)
      : undefined;
    return {
      module: AppModule,
      imports: [
        HealthModule.register(database),
        ...(config ? [AuthModule.register(database, owner, config)] : []),
        TenantModule.register(database, 'SPORTIFY_SCHEMA_OWNER', accountModule),
      ],
      providers: [{ provide: 'ORACLE_POOL_LIFECYCLE', useValue: lifecycle }],
    };
  }
}
