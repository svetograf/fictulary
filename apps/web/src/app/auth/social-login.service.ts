import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AppleSignInRequest,
  AuthProvidersConfig,
  GoogleSignInRequest,
} from '@fictulary/shared/models';
import { firstValueFrom } from 'rxjs';

/**
 * Where Google and Apple send their sign-in popup back to. The plugin,
 * loaded there by main.ts, hands the result to the opener.
 */
export const AUTH_CALLBACK_PATH = '/auth/callback';

/** The user closed the provider's popup or declined. Not worth reporting. */
export class SignInCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled');
  }
}

/**
 * Runs the Google and Apple sign-in flows through the social login plugin
 * and returns what the API needs to sign the user in.
 */
@Injectable({ providedIn: 'root' })
export class SocialLoginService {
  private readonly http = inject(HttpClient);
  private config?: Promise<AuthProvidersConfig>;
  private initialized?: Promise<void>;

  /** Client ids and options from the API, fetched once. */
  providers(): Promise<AuthProvidersConfig> {
    this.config ??= firstValueFrom(
      this.http.get<AuthProvidersConfig>('/api/auth/providers'),
    ).catch((error) => {
      // Let a later call retry.
      this.config = undefined;
      throw error;
    });
    return this.config;
  }

  /**
   * Loads the config and provider scripts ahead of a click. Browsers block
   * popups opened too long after the click, so this shouldn't happen then.
   */
  prepare(): void {
    this.initialize().catch((error) =>
      console.error('Preparing social sign-in failed', error),
    );
  }

  async google(): Promise<GoogleSignInRequest> {
    await this.initialize();
    const { SocialLogin } = await plugin();
    const { result } = await login(() =>
      SocialLogin.login({ provider: 'google', options: {} }),
    );
    if (!('idToken' in result) || !result.idToken) {
      throw new Error('Google sent no ID token.');
    }
    return { idToken: result.idToken };
  }

  async apple(): Promise<AppleSignInRequest> {
    await this.initialize();
    // Apple puts the nonce it's given into the ID token. Giving it a hash
    // and the API the original proves the token was issued for this request.
    const nonce = randomNonce();
    const hashedNonce = await sha256Hex(nonce);
    const { SocialLogin } = await plugin();
    const { result } = await login(() =>
      SocialLogin.login({
        provider: 'apple',
        options: { scopes: ['name', 'email'], nonce: hashedNonce },
      }),
    );
    if (
      !('idToken' in result) ||
      !result.idToken ||
      !result.authorizationCode
    ) {
      throw new Error('Apple sent an incomplete response.');
    }
    return {
      idToken: result.idToken,
      authorizationCode: result.authorizationCode,
      nonce,
      // Only sent the first time the user authorizes the app.
      givenName: result.profile.givenName ?? undefined,
      familyName: result.profile.familyName ?? undefined,
    };
  }

  /** Resolves at once when prepare() has already finished. */
  private initialize(): Promise<void> {
    this.initialized ??= this.providers()
      .then(async ({ google, apple }) => {
        const { SocialLogin } = await plugin();
        const redirectUrl = `${window.location.origin}${AUTH_CALLBACK_PATH}`;
        return SocialLogin.initialize({
          google: { webClientId: google.webClientId, redirectUrl },
          // Null when the API has no Apple config; the button is hidden then.
          ...(apple && {
            apple: {
              clientId: apple.servicesId,
              redirectUrl: apple.redirectUri,
              // Returns the authorization code as `authorizationCode`.
              useProperTokenExchange: true,
            },
          }),
        });
      })
      .catch((error) => {
        this.initialized = undefined;
        throw error;
      });
    return this.initialized;
  }
}

/** The plugin, loaded on first use to keep it out of the initial bundle. */
function plugin() {
  return import('@capgo/capacitor-social-login');
}

/** Runs a plugin login, turning cancellations into SignInCancelledError. */
async function login<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw isCancellation(error) ? new SignInCancelledError() : error;
  }
}

function isCancellation(error: unknown): boolean {
  const {
    code,
    message,
    error: reason,
  } = (error ?? {}) as {
    code?: string;
    message?: string;
    /** Apple JS rejects with `{ error: 'popup_closed_by_user' }`. */
    error?: string;
  };
  return (
    code === 'USER_CANCELLED' ||
    [message, reason].some((text) =>
      /popup_closed|user_cancel/i.test(text ?? ''),
    )
  );
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toHex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
