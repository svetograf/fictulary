import { AuthProvider, USER_NAME_MAX_LENGTH } from '@fictulary/shared/models';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { oauthConfig } from '../../config/oauth.config';
import { ProviderProfile } from './provider-profile';

/** Verifies Google ID tokens issued to one of our OAuth clients. */
@Injectable()
export class GoogleVerifier {
  private readonly client = new OAuth2Client();

  constructor(
    @Inject(oauthConfig.KEY)
    private readonly config: ConfigType<typeof oauthConfig>,
  ) {}

  async verify(idToken: string): Promise<ProviderProfile> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.google.clientIds,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in');
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google account has no email');
    }
    return {
      provider: AuthProvider.GOOGLE,
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name?.trim().slice(0, USER_NAME_MAX_LENGTH) || null,
    };
  }
}
