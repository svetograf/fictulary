import { registerAs } from '@nestjs/config';

const ENCRYPTION_KEY_BYTES = 32;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to apps/api/.env (see .env.example).`,
    );
  }
  return value;
}

export const oauthConfig = registerAs('oauth', () => {
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
    google: {
      /** Used by the web app; Android also gets tokens issued to it. */
      webClientId: required('GOOGLE_WEB_CLIENT_ID'),
      /** Optional until the iOS app exists. */
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || null,
    },
    apple: {
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
    },
    /** AES-256-GCM key for provider tokens stored in the database. */
    encryptionKey,
  };
});
