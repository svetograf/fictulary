import { AuthProvider } from '@fictulary/shared/models';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync, KeyObject } from 'crypto';
import { oauthConfig } from '../../config/oauth.config';
import { AppleClient, sha256Hex } from './apple-client';

describe('AppleClient', () => {
  const signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const clientKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const config = {
    apple: {
      teamId: 'TEAM123',
      keyId: 'KEY123',
      privateKey: clientKey.privateKey
        .export({ type: 'pkcs8', format: 'pem' })
        .toString(),
      bundleId: 'com.example.fictulary',
      servicesId: 'com.example.fictulary.web',
      redirectUri: 'https://app.example.com/auth/callback',
    },
  } as ConfigType<typeof oauthConfig>;
  const jwt = new JwtService();
  const fetchMock = jest.fn();
  let client: AppleClient;

  const pem = (key: KeyObject) =>
    key.export({ type: 'pkcs1', format: 'pem' }).toString();
  const json = (body: unknown, status = 200) =>
    ({ ok: status < 400, status, json: async () => body }) as Response;

  const idToken = (claims: Record<string, unknown> = {}, kid = 'k1') =>
    jwt.signAsync(
      {
        sub: 'apple-1',
        email: 'Ada@Example.com',
        email_verified: 'true',
        nonce: sha256Hex('raw-nonce'),
        ...claims,
      },
      {
        privateKey: pem(signingKey.privateKey),
        algorithm: 'RS256',
        keyid: kid,
        issuer: 'https://appleid.apple.com',
        audience: config.apple.servicesId,
        expiresIn: '5m',
      },
    );

  beforeAll(() => {
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth/keys')
        ? json({
            keys: [
              {
                ...signingKey.publicKey.export({ format: 'jwk' }),
                kid: 'k1',
              },
            ],
          })
        : json({}),
    );
    client = new AppleClient(config);
  });

  describe('verify', () => {
    it('returns the identity for a valid token', async () => {
      await expect(
        client.verify(await idToken(), 'raw-nonce'),
      ).resolves.toEqual({
        provider: AuthProvider.APPLE,
        subject: 'apple-1',
        email: 'ada@example.com',
        emailVerified: true,
        name: null,
        clientId: 'com.example.fictulary.web',
      });
    });

    it('caches the keys', async () => {
      await client.verify(await idToken(), 'raw-nonce');
      await client.verify(await idToken(), 'raw-nonce');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a wrong nonce', {}, 'other-nonce'],
      ['another audience', { aud: 'com.evil.app' }, 'raw-nonce'],
      ['another issuer', { iss: 'https://evil.example.com' }, 'raw-nonce'],
      ['no email', { email: undefined }, 'raw-nonce'],
    ])('rejects %s', async (_case, claims, nonce) => {
      // `aud`/`iss` in the payload clash with the sign options, so build
      // these tokens by hand.
      const token =
        'aud' in claims || 'iss' in claims
          ? await jwt.signAsync(
              {
                sub: 'apple-1',
                email: 'ada@example.com',
                nonce: sha256Hex('raw-nonce'),
                iss: 'https://appleid.apple.com',
                aud: config.apple.servicesId,
                ...claims,
              },
              {
                privateKey: pem(signingKey.privateKey),
                algorithm: 'RS256',
                keyid: 'k1',
              },
            )
          : await idToken(claims);
      await expect(client.verify(token, nonce)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects tokens signed with an unknown key', async () => {
      await expect(
        client.verify(await idToken({}, 'unknown'), 'raw-nonce'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('exchangeCode', () => {
    it('sends a signed client secret and the redirect URI for web codes', async () => {
      fetchMock.mockResolvedValue(json({ refresh_token: 'refresh-1' }));

      await expect(
        client.exchangeCode('code-1', config.apple.servicesId),
      ).resolves.toBe('refresh-1');

      const [url, init] = fetchMock.mock.calls[0];
      const body = init.body as URLSearchParams;
      expect(url).toBe('https://appleid.apple.com/auth/token');
      expect(body.get('code')).toBe('code-1');
      expect(body.get('redirect_uri')).toBe(config.apple.redirectUri);
      await expect(
        jwt.verifyAsync(body.get('client_secret') as string, {
          publicKey: clientKey.publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString(),
          algorithms: ['ES256'],
        }),
      ).resolves.toMatchObject({
        iss: 'TEAM123',
        sub: config.apple.servicesId,
        aud: 'https://appleid.apple.com',
      });
    });

    it('omits the redirect URI for native codes', async () => {
      fetchMock.mockResolvedValue(json({ refresh_token: 'refresh-1' }));
      await client.exchangeCode('code-1', config.apple.bundleId);
      const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(body.has('redirect_uri')).toBe(false);
    });

    it('rejects codes Apple refuses', async () => {
      fetchMock.mockResolvedValue(json({ error: 'invalid_grant' }, 400));
      await expect(
        client.exchangeCode('code-1', config.apple.servicesId),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('revoke', () => {
    it('revokes the refresh token', async () => {
      fetchMock.mockResolvedValue(json({}));
      await client.revoke('refresh-1', config.apple.bundleId);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://appleid.apple.com/auth/revoke');
      expect((init.body as URLSearchParams).get('token')).toBe('refresh-1');
    });

    it('throws when Apple refuses', async () => {
      fetchMock.mockResolvedValue(json({}, 400));
      await expect(
        client.revoke('refresh-1', config.apple.bundleId),
      ).rejects.toThrow();
    });
  });
});
