import { registerAs } from '@nestjs/config';

const ENCRYPTION_KEY_BYTES = 32;

/** Sign in with Apple is enabled only when all of these are set. */
const APPLE_VARS = [
  'APPLE_TEAM_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'APPLE_BUNDLE_ID',
  'APPLE_SERVICES_ID',
  'APPLE_REDIRECT_URI',
] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/api/.env (see .env.example).`,
    );
  }
  return value;
}

/** The Apple settings, or null when none are set (Apple sign-in is off). */
function appleConfig() {
  const missing = APPLE_VARS.filter((name) => !process.env[name]);
  if (missing.length === APPLE_VARS.length) {
    return null;
  }
  if (missing.length) {
    // Half-configured is almost certainly a mistake; don't silently hide it.
    throw new Error(
      `Sign in with Apple is partly configured; also set ${missing.join(', ')} ` +
        `in apps/api/.env, or remove the other APPLE_* settings.`,
    );
  }

  const encryptionKey = Buffer.from(
    required('TOKEN_ENCRYPTION_KEY'),
    'base64url',
  );
  if (encryptionKey.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${ENCRYPTION_KEY_BYTES} bytes, base64url-encoded.`,
    );
  }

  return {
    teamId: required('APPLE_TEAM_ID'),
    keyId: required('APPLE_KEY_ID'),
    /** PKCS#8 PEM of the .p8 key; `\n` escapes allowed for one-line env values. */
    privateKey: required('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    /** Audience of ID tokens from the native iOS app. */
    bundleId: required('APPLE_BUNDLE_ID'),
    /** Audience of ID tokens from the web flow. */
    servicesId: required('APPLE_SERVICES_ID'),
    /**
     * Return URL registered on the Services ID: the web app's
     * `/auth/callback`. Sent when exchanging codes from the web flow.
     */
    redirectUri: required('APPLE_REDIRECT_URI'),
    /** AES-256-GCM key for the Apple refresh tokens stored in the database. */
    encryptionKey,
  };
}

export type AppleConfig = NonNullable<ReturnType<typeof appleConfig>>;

export const oauthConfig = registerAs('oauth', () => ({
  google: {
    /** Used by the web app; Android also gets tokens issued to it. */
    webClientId: required('GOOGLE_WEB_CLIENT_ID'),
    /** Optional until the iOS app exists. */
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || null,
  },
  /** Null when Sign in with Apple isn't configured. */
  apple: appleConfig(),
}));
