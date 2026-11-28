import {
  Inject,
  Injectable,
  Module,
  type CanActivate,
  type CallHandler,
  type DynamicModule,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Database } from '@sportify/database';
import type { ApiRequest } from '../../common/middleware/request-context.js';
import { ApplicationError } from '../../common/errors/application-error.js';
import { AccountService } from '../auth/account.service.js';
import { BrowserAuth } from '../auth/browser-security.js';
import {
  TenantResolver,
  type MemberContext,
  type TenantOwner,
  type WebsiteContext,
} from './tenant-context.js';
import { TenantRepositories } from './tenant-repositories.js';
import { requestSurface } from './host-boundary.js';

const websiteContexts = new WeakMap<ApiRequest, WebsiteContext>();
const memberContexts = new WeakMap<ApiRequest, MemberContext>();

export function websiteScope(request: ApiRequest): WebsiteContext {
  const context = websiteContexts.get(request);
  if (!context) throw new ApplicationError('FORBIDDEN');
  return context;
}

export function memberScope(request: ApiRequest): MemberContext {
  const context = memberContexts.get(request);
  if (!context) throw new ApplicationError('FORBIDDEN');
  return context;
}

export class TenantBoundaryInterceptor implements NestInterceptor {
  intercept(execution: ExecutionContext, next: CallHandler) {
    const request = execution.switchToHttp().getRequest<ApiRequest>();
    const { namespace } = requestSurface(request);
    if (namespace === 'tenant') memberScope(request);
    if (namespace === 'website') websiteScope(request);
    return next.handle();
  }
}

@Injectable()
export class WebsiteTenantGuard implements CanActivate {
  constructor(@Inject(TenantResolver) private readonly resolver: TenantResolver) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<ApiRequest>();
    websiteContexts.set(request, await this.resolver.website(request));
    return true;
  }
}

@Injectable()
export class TenantMemberGuard implements CanActivate {
  constructor(@Inject(TenantResolver) private readonly resolver: TenantResolver) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<ApiRequest>();
    memberContexts.set(request, await this.resolver.member(request));
    return true;
  }
}

@Module({})
export class TenantModule {
  static register(
    database: Database,
    owner: TenantOwner,
    accountModule?: DynamicModule,
  ): DynamicModule {
    return {
      module: TenantModule,
      imports: accountModule ? [accountModule] : [],
      providers: [
        {
          provide: TenantResolver,
          inject: [
            { token: BrowserAuth, optional: true },
            { token: AccountService, optional: true },
          ],
          useFactory: (browser?: BrowserAuth, accounts?: AccountService) =>
            new TenantResolver(
              database,
              owner,
              browser && accounts ? { browser, accounts } : undefined,
            ),
        },
        { provide: TenantRepositories, useValue: new TenantRepositories(database, owner) },
        WebsiteTenantGuard,
        TenantMemberGuard,
      ],
      exports: [TenantResolver, TenantRepositories, WebsiteTenantGuard, TenantMemberGuard],
    };
  }
}
