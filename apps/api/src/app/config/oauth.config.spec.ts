import { oauthConfig } from './oauth.config';

describe('oauthConfig', () => {
  const env = process.env;
  const apple = {
    APPLE_TEAM_ID: 'TEAM123',
    APPLE_KEY_ID: 'KEY123',
    APPLE_PRIVATE_KEY: 'line1\\nline2',
    APPLE_BUNDLE_ID: 'com.example.fictulary',
    APPLE_SERVICES_ID: 'com.example.fictulary.web',
    APPLE_REDIRECT_URI: 'https://app.example.com/auth/callback',
  };
  const key = Buffer.alloc(32, 1).toString('base64url');

  const load = (vars: Record<string, string | undefined>) => {
    process.env = { GOOGLE_WEB_CLIENT_ID: 'web', ...vars };
    return oauthConfig();
  };

  afterEach(() => {
    process.env = env;
  });

  it('requires the Google web client id', () => {
    expect(() => load({ GOOGLE_WEB_CLIENT_ID: undefined })).toThrow(
      /GOOGLE_WEB_CLIENT_ID/,
    );
  });

  it('turns Apple off when no Apple setting is present', () => {
    expect(load({}).apple).toBeNull();
  });

  it('ignores an encryption key on its own', () => {
    expect(load({ TOKEN_ENCRYPTION_KEY: key }).apple).toBeNull();
  });

  it('turns Apple on when every setting is present', () => {
    const config = load({ ...apple, TOKEN_ENCRYPTION_KEY: key });
    expect(config.apple).toMatchObject({
      servicesId: 'com.example.fictulary.web',
      privateKey: 'line1\nline2',
    });
    expect(config.apple?.encryptionKey).toHaveLength(32);
  });

  it('names the missing settings when Apple is partly configured', () => {
    expect(() =>
      load({
        APPLE_TEAM_ID: 'TEAM123',
        APPLE_KEY_ID: 'KEY123',
        TOKEN_ENCRYPTION_KEY: key,
      }),
    ).toThrow(
      'also set APPLE_PRIVATE_KEY, APPLE_BUNDLE_ID, APPLE_SERVICES_ID, APPLE_REDIRECT_URI',
    );
  });

  it('requires a 32-byte encryption key with Apple', () => {
    expect(() => load(apple)).toThrow(/TOKEN_ENCRYPTION_KEY is not set/);
    expect(() => load({ ...apple, TOKEN_ENCRYPTION_KEY: 'c2hvcnQ' })).toThrow(
      /must be 32 bytes/,
    );
  });
});
