import { AuthProvider } from '@fictulary/shared/models';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createPublicKey, JsonWebKey } from 'crypto';
import { AppleConfig, oauthConfig } from '../../config/oauth.config';
import { ProviderProfile } from './provider-profile';

const APPLE_ISSUER = 'https://appleid.apple.com';
const KEYS_URL = `${APPLE_ISSUER}/auth/keys`;
const TOKEN_URL = `${APPLE_ISSUER}/auth/token`;
const REVOKE_URL = `${APPLE_ISSUER}/auth/revoke`;
/** Don't refetch Apple's keys more often than this for unknown key ids. */
const KEYS_REFRESH_MS = 60_000;

interface AppleIdTokenPayload {
  sub: string;
  aud: string;
  email?: string;
  /** Apple sends booleans as either booleans or strings. */
  email_verified?: boolean | 'true' | 'false';
  nonce?: string;
}

export interface AppleIdentity extends ProviderProfile {
  /** The client the token was issued to: bundle ID (native) or Services ID (web). */
  clientId: string;
}

/**
 * Talks to Sign in with Apple: verifies ID tokens, exchanges authorization
 * codes for refresh tokens and revokes them.
 */
@Injectable()
export class AppleClient {
  private readonly logger = new Logger(AppleClient.name);
  private readonly jwt = new JwtService();
  /** Apple's public keys as PEM, by key id. */
  private keys = new Map<string, string>();
  private keysFetchedAt = 0;

  constructor(
    @Inject(oauthConfig.KEY)
    private readonly config: ConfigType<typeof oauthConfig>,
  ) {}

  /** Whether Sign in with Apple is configured (see oauthConfig). */
  get enabled(): boolean {
    return this.config.apple !== null;
  }

  private get apple(): AppleConfig {
    if (!this.config.apple) {
      throw new NotFoundException('Sign in with Apple is not available');
    }
    return this.config.apple;
  }

  /**
   * Verifies an ID token. `nonce` is the raw nonce the client generated;
   * Apple received (and put in the token) its SHA-256 hex digest.
   */
  async verify(idToken: string, nonce: string): Promise<AppleIdentity> {
    const { bundleId, servicesId } = this.apple;
    let payload: AppleIdTokenPayload;
    try {
      const kid = this.jwt.decode<{ header?: { kid?: string } } | null>(
        idToken,
        { complete: true },
      )?.header?.kid;
      const publicKey = kid && (await this.publicKey(kid));
      if (!publicKey) {
        throw new Error('Unknown signing key');
      }
      payload = await this.jwt.verifyAsync<AppleIdTokenPayload>(idToken, {
        publicKey,
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: [bundleId, servicesId],
      });
    } catch {
      throw new UnauthorizedException('Invalid Apple sign-in');
    }

    if (payload.nonce !== sha256Hex(nonce)) {
      throw new UnauthorizedException('Invalid Apple sign-in');
    }
    if (!payload.email) {
      throw new UnauthorizedException('Apple account has no email');
    }
    return {
      provider: AuthProvider.APPLE,
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: String(payload.email_verified) === 'true',
      name: null,
      clientId: payload.aud,
    };
  }

  /** Exchanges a single-use authorization code for a refresh token. */
  async exchangeCode(code: string, clientId: string): Promise<string> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: await this.clientSecret(clientId),
      code,
      grant_type: 'authorization_code',
    });
    // Codes from the web flow are bound to the registered return URL.
    if (clientId === this.apple.servicesId) {
      body.set('redirect_uri', this.apple.redirectUri);
    }
    const response = await fetch(TOKEN_URL, { method: 'POST', body });
    const result = (await response.json().catch(() => ({}))) as {
      refresh_token?: string;
      error?: string;
    };
    if (!response.ok || !result.refresh_token) {
      this.logger.warn(
        `Apple code exchange failed: ${response.status} ${result.error ?? ''}`,
      );
      throw new UnauthorizedException('Apple sign-in could not be completed');
    }
    return result.refresh_token;
  }

  /** Revokes a refresh token, so the user's Apple ID no longer lists the app. */
  async revoke(refreshToken: string, clientId: string): Promise<void> {
    const response = await fetch(REVOKE_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: await this.clientSecret(clientId),
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
    });
    if (!response.ok) {
      throw new Error(`Apple token revocation failed: ${response.status}`);
    }
  }

  /** The short-lived ES256 JWT Apple accepts in place of a client secret. */
  private clientSecret(clientId: string): Promise<string> {
    const { teamId, keyId, privateKey } = this.apple;
    return this.jwt.signAsync(
      {},
      {
        privateKey,
        algorithm: 'ES256',
        keyid: keyId,
        issuer: teamId,
        subject: clientId,
        audience: APPLE_ISSUER,
        expiresIn: '5m',
      },
    );
  }

  private async publicKey(kid: string): Promise<string | undefined> {
    if (
      !this.keys.has(kid) &&
      Date.now() - this.keysFetchedAt > KEYS_REFRESH_MS
    ) {
      this.keysFetchedAt = Date.now();
      const response = await fetch(KEYS_URL);
      if (!response.ok) {
        throw new Error(`Fetching Apple keys failed: ${response.status}`);
      }
      const { keys } = (await response.json()) as {
        keys: (JsonWebKey & { kid: string })[];
      };
      this.keys = new Map(
        keys.map((jwk) => [
          jwk.kid,
          createPublicKey({ key: jwk, format: 'jwk' })
            .export({ type: 'spki', format: 'pem' })
            .toString(),
        ]),
      );
    }
    return this.keys.get(kid);
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
