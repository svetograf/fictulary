import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { authConfig } from '../config/auth.config';
import { AuthIdentity } from '../users/auth-identity.entity';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AppleClient } from './providers/apple-client';
import { GoogleVerifier } from './providers/google-verifier';
import { TokenCipher } from './token-cipher';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthIdentity]),
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: ({ secret, expiresIn }: ConfigType<typeof authConfig>) => ({
        secret,
        signOptions: {
          // Validated as an `ms` duration string by jsonwebtoken at runtime.
          expiresIn: expiresIn as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleVerifier,
    AppleClient,
    TokenCipher,
    // Every route requires a token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
