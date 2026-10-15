import { AuthResponse } from '@fictulary/shared/models';
import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { Public } from '../public.decorator';
import { DevSignInDto } from './dev-sign-in.dto';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Registered only by DevAuthModule; see there. */
@Controller()
export class DevAuthController {
  constructor(private readonly auth: AuthService) {}

  /** Signs in as any email, creating the account if needed. */
  @Public()
  @Post('auth/dev')
  @HttpCode(HttpStatus.OK)
  signIn(
    @Body() dto: DevSignInDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    // The socket address, not `req.ip`, which proxies can set via headers.
    if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) {
      throw new ForbiddenException('Dev sign-in is only available locally');
    }
    return this.auth.devSignIn(dto.email, dto.name);
  }
}
