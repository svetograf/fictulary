import {
  AuthProvidersConfig,
  AuthResponse,
  User,
} from '@fictulary/shared/models';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { oauthConfig } from '../config/oauth.config';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { AppleSignInDto } from './dto/apple-sign-in.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthUser } from './jwt-payload';
import { Public } from './public.decorator';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(oauthConfig.KEY)
    private readonly oauth: ConfigType<typeof oauthConfig>,
  ) {}

  /** Client ids the sign-in page needs; none of them are secret. */
  @Public()
  @Get('auth/providers')
  providers(): AuthProvidersConfig {
    const { google, apple } = this.oauth;
    return {
      google: { webClientId: google.webClientId },
      apple: { servicesId: apple.servicesId, redirectUri: apple.redirectUri },
      // Mirrors how AppModule decides to load DevAuthModule.
      devSignIn: process.env.AUTH_DEV_LOGIN === 'true',
    };
  }

  /** Signs in (creating the account on first use) with a Google ID token. */
  @Public()
  @Post('auth/google')
  @HttpCode(HttpStatus.OK)
  signInWithGoogle(@Body() dto: GoogleSignInDto): Promise<AuthResponse> {
    return this.auth.signInWithGoogle(dto);
  }

  /** Signs in (creating the account on first use) with an Apple ID token. */
  @Public()
  @Post('auth/apple')
  @HttpCode(HttpStatus.OK)
  signInWithApple(@Body() dto: AppleSignInDto): Promise<AuthResponse> {
    return this.auth.signInWithApple(dto);
  }

  /** The signed-in user's profile. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.auth.me(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.auth.updateProfile(user.id, dto);
  }

  /** Deletes the account and all its data. */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.deleteAccount(user.id);
  }
}
