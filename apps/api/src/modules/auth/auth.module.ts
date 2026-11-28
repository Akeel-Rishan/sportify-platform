import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  SetMetadata,
  UseGuards,
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Database } from '@sportify/database';
import type { RegistrationAccepted, RegistrationVerified } from '@sportify/api-contracts';
import type { Response } from 'express';
import { requestId, type ApiRequest } from '../../common/middleware/request-context.js';
import type { RegistrationConfig } from './auth-config.js';
import { ConfirmDto, RegisterDto, ResendDto } from './auth.dto.js';
import { acknowledge } from './abuse-controls.js';
import {
  RegistrationService,
  type RegistrationOwner,
  type RegistrationSourceScope,
} from './registration.service.js';

const sourceScope = Symbol('auth-source-scope');

@Injectable()
class RegistrationRateGuard implements CanActivate {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    const scope = this.reflector.get<RegistrationSourceScope | undefined>(
      sourceScope,
      context.getHandler(),
    );
    if (!scope) throw new Error('Registration route lacks a source scope.');
    await this.registration.admit(http.getRequest<ApiRequest>().socket.remoteAddress, scope);
    return true;
  }
}

@Controller('auth')
@UseGuards(RegistrationRateGuard)
class AuthController {
  constructor(@Inject(RegistrationService) private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(202)
  @SetMetadata(sourceScope, 'ISSUE')
  async register(
    @Body() body: RegisterDto,
    @Req() request: ApiRequest,
  ): Promise<RegistrationAccepted> {
    return acknowledge(() => this.registration.register(body, requestId(request)));
  }

  @Post('verification/resend')
  @HttpCode(202)
  @SetMetadata(sourceScope, 'ISSUE')
  async resend(@Body() body: ResendDto): Promise<RegistrationAccepted> {
    return acknowledge(() => this.registration.resend(body.email));
  }

  @Post('verify-email')
  @HttpCode(200)
  @SetMetadata(sourceScope, 'CONFIRM')
  async confirm(
    @Body() body: ConfirmDto,
    @Req() request: ApiRequest,
  ): Promise<RegistrationVerified> {
    await this.registration.confirm(body, requestId(request));
    return { status: 'verified' };
  }
}

@Module({})
export class AuthModule {
  static register(
    database: Database,
    owner: RegistrationOwner,
    config: RegistrationConfig,
  ): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        {
          provide: RegistrationService,
          useFactory: () => new RegistrationService(database, owner, config),
        },
        RegistrationRateGuard,
      ],
    };
  }
}
