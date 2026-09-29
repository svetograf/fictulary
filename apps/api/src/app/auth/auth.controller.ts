import { AuthResponse, User } from '@fictulary/shared/models';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { AuthUser } from './jwt-payload';
import { Public } from './public.decorator';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Registers a new account and signs it in. */
  @Public()
  @Post('sign-up')
  signUp(@Body() dto: SignUpDto): Promise<AuthResponse> {
    return this.auth.signUp(dto);
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(@Body() dto: SignInDto): Promise<AuthResponse> {
    return this.auth.signIn(dto);
  }

  /** The signed-in user's profile. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.auth.me(user.id);
  }
}
