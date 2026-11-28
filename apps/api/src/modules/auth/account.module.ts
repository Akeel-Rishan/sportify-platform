import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UseGuards,
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Database } from '@sportify/database';
import { z } from 'zod';
import { tokenPattern } from '@sportify/verification-email';
import type {
  AccountProfile,
  CsrfResponse,
  LoginRequest,
  PasswordResetCompleted,
  PasswordResetConfirmation,
  PasswordResetRequest,
  RegistrationAccepted,
  SessionAccount,
} from '@sportify/api-contracts';
import { requestId, type ApiRequest } from '../../common/middleware/request-context.js';
import { ApplicationError } from '../../common/errors/application-error.js';
import { acknowledge } from './abuse-controls.js';
import { AccountService, type AccountOwner } from './account.service.js';
import { authEmail } from './auth.dto.js';
import { BrowserAuth } from './browser-security.js';
import { createPasswordVerifier, passwordIsValid } from './password.js';
import type { SessionConfig } from './session-config.js';

class LoginDto implements LoginRequest {
  static readonly schema = z.strictObject({
    email: authEmail,
    password: z
      .string()
      .min(1)
      .max(256)
      .refine(
        (password) =>
          Buffer.byteLength(password, 'utf8') <= 512 && !/\p{Surrogate}/u.test(password),
      ),
  });
  declare email: string;
  declare password: string;
}

class ResetRequestDto implements PasswordResetRequest {
  static readonly schema = z.strictObject({ email: authEmail });
  declare email: string;
}

class ResetConfirmDto implements PasswordResetConfirmation {
  static readonly schema = z.strictObject({
    token: z.string().length(43).regex(tokenPattern),
    password: z.string().refine(passwordIsValid),
  });
  declare token: string;
  declare password: string;
}

interface AccountRequest extends ApiRequest {
  browserSession?: string | undefined;
  principal?: { readonly audience: 'DASHBOARD'; readonly account: AccountProfile };
}

@Injectable()
class BrowserBoundaryGuard implements CanActivate {
  constructor(@Inject(BrowserAuth) private readonly browser: BrowserAuth) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    if (request.method === 'POST') request.browserSession = this.browser.checkMutation(request);
    else {
      this.browser.checkOrigin(request, false);
      request.browserSession = this.browser.session(request);
    }
    return true;
  }
}

@Injectable()
class CurrentSessionGuard implements CanActivate {
  constructor(@Inject(AccountService) private readonly accounts: AccountService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccountRequest>();
    request.principal = {
      audience: 'DASHBOARD',
      account: await this.accounts.me(request.browserSession, request.socket.remoteAddress),
    };
    return true;
  }
}

@Controller('auth')
@UseGuards(BrowserBoundaryGuard)
class AccountController {
  constructor(
    @Inject(AccountService) private readonly accounts: AccountService,
    @Inject(BrowserAuth) private readonly browser: BrowserAuth,
  ) {}

  @Get('csrf')
  csrf(
    @Req() request: AccountRequest,
    @Res({ passthrough: true }) response: Response,
  ): CsrfResponse {
    return { csrfToken: this.browser.bootstrap(request, response) };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: AccountRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionAccount> {
    const result = await this.accounts.login(
      input,
      request.socket.remoteAddress,
      request.browserSession,
      requestId(request),
    );
    this.browser.setSession(response, result.token, result.expires);
    return { account: result.account };
  }

  @Get('me')
  @UseGuards(CurrentSessionGuard)
  me(@Req() request: AccountRequest): SessionAccount {
    if (!request.principal) throw new ApplicationError('UNAUTHENTICATED');
    return { account: request.principal.account };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AccountRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.accounts.logout(
        request.browserSession,
        request.socket.remoteAddress,
        requestId(request),
      );
    } finally {
      this.browser.clearSession(response);
    }
  }

  @Post('forgot-password')
  @HttpCode(202)
  async requestReset(
    @Body() input: ResetRequestDto,
    @Req() request: AccountRequest,
  ): Promise<RegistrationAccepted> {
    await this.accounts.admitResetRequest(request.socket.remoteAddress);
    return acknowledge(() => this.accounts.requestReset(input.email, requestId(request)));
  }

  @Post('reset-password')
  @HttpCode(200)
  async confirmReset(
    @Body() input: ResetConfirmDto,
    @Req() request: AccountRequest,
  ): Promise<PasswordResetCompleted> {
    await this.accounts.confirmReset(input, request.socket.remoteAddress, requestId(request));
    return { status: 'reset' };
  }
}

@Module({})
export class AccountModule {
  static register(database: Database, owner: AccountOwner, config: SessionConfig): DynamicModule {
    return {
      module: AccountModule,
      controllers: [AccountController],
      providers: [
        { provide: BrowserAuth, useValue: new BrowserAuth(config) },
        {
          provide: AccountService,
          useFactory: async () =>
            new AccountService(database, owner, config, await createPasswordVerifier()),
        },
        BrowserBoundaryGuard,
        CurrentSessionGuard,
      ],
      exports: [BrowserAuth, AccountService],
    };
  }
}
