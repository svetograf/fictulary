import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { DevAuthController } from './dev-auth.controller';

/**
 * Password-less sign-in for local development and tests, since only Google
 * and Apple sign-in exist otherwise. AppModule imports it only when
 * `AUTH_DEV_LOGIN=true`, and it refuses to start when `NODE_ENV=production`.
 */
@Module({
  imports: [AuthModule],
  controllers: [DevAuthController],
})
export class DevAuthModule {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_DEV_LOGIN must not be enabled in production.');
    }
  }
}
