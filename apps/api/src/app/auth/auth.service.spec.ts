import { AuthProvider } from '@fictulary/shared/models';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, FindOperator, QueryFailedError } from 'typeorm';
import { AuthIdentity } from '../users/auth-identity.entity';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { AppleClient, AppleIdentity } from './providers/apple-client';
import { GoogleVerifier } from './providers/google-verifier';
import { ProviderProfile } from './providers/provider-profile';
import { TokenCipher } from './token-cipher';

type Row = Record<string, unknown> & { id: number };

/**
 * In-memory stand-in for a TypeORM repository, enough for AuthService.
 * `Not(IsNull())` is the only find operator it needs to understand.
 */
function fakeRepository(defaults: () => Record<string, unknown> = () => ({})) {
  const rows: Row[] = [];
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) =>
      value instanceof FindOperator ? row[key] != null : row[key] === value,
    );
  return {
    rows,
    create: (data: Record<string, unknown>) => ({ ...data }),
    findOneBy: jest.fn(
      async (where: Record<string, unknown>) =>
        rows.find((row) => matches(row, where)) ?? null,
    ),
    findBy: async (where: Record<string, unknown>) =>
      rows.filter((row) => matches(row, where)),
    existsBy: async (where: Record<string, unknown>) =>
      rows.some((row) => matches(row, where)),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      const existing = rows.find((row) => row.id === entity.id);
      if (existing) {
        return Object.assign(existing, entity);
      }
      const row = { ...defaults(), ...entity, id: rows.length + 1 };
      rows.push(row);
      return row;
    }),
    update: async (where: Record<string, unknown>, data: object) => {
      rows
        .filter((row) => matches(row, where))
        .forEach((row) => Object.assign(row, data));
    },
    delete: jest.fn(async (where: Record<string, unknown>) => {
      rows.splice(
        0,
        rows.length,
        ...rows.filter((row) => !matches(row, where)),
      );
    }),
  };
}

describe('AuthService', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');
  let users: ReturnType<typeof fakeRepository>;
  let identities: ReturnType<typeof fakeRepository>;
  let google: { verify: jest.Mock };
  let apple: {
    enabled: boolean;
    verify: jest.Mock;
    exchangeCode: jest.Mock;
    revoke: jest.Mock;
  };
  let service: AuthService;
  const jwt = new JwtService({ secret: 'test-secret' });
  const cipher = new TokenCipher({
    apple: { encryptionKey: Buffer.alloc(32, 7) },
  });

  const googleProfile: ProviderProfile = {
    provider: AuthProvider.GOOGLE,
    subject: 'google-1',
    email: 'ada@example.com',
    emailVerified: true,
    name: 'Ada Lovelace',
  };
  const appleIdentity: AppleIdentity = {
    provider: AuthProvider.APPLE,
    subject: 'apple-1',
    email: 'ada@example.com',
    emailVerified: true,
    name: null,
    clientId: 'com.example.fictulary.web',
  };
  const appleDto = {
    idToken: 'apple.id.token',
    authorizationCode: 'code-1',
    nonce: 'raw-nonce',
  };

  beforeEach(() => {
    users = fakeRepository(() => ({ createdAt, name: null }));
    identities = fakeRepository();
    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? users : entity === AuthIdentity ? identities : null,
    };
    const dataSource = {
      manager,
      getRepository: manager.getRepository,
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    };
    google = { verify: jest.fn().mockResolvedValue(googleProfile) };
    apple = {
      enabled: true,
      verify: jest.fn().mockResolvedValue(appleIdentity),
      exchangeCode: jest.fn().mockResolvedValue('apple-refresh-token'),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(
      dataSource as unknown as DataSource,
      jwt,
      google as unknown as GoogleVerifier,
      apple as unknown as AppleClient,
      cipher,
    );
  });

  describe('signInWithGoogle', () => {
    it('creates a user and identity on first sign-in', async () => {
      const result = await service.signInWithGoogle({ idToken: 't' });

      expect(result.user).toEqual({
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        createdAt: createdAt.toISOString(),
        levelPrompted: false,
      });
      expect(identities.rows).toEqual([
        expect.objectContaining({
          userId: 1,
          provider: AuthProvider.GOOGLE,
          subject: 'google-1',
        }),
      ]);
      await expect(jwt.verifyAsync(result.accessToken)).resolves.toMatchObject({
        sub: '1',
        email: 'ada@example.com',
      });
    });

    it('signs a returning user into the same account', async () => {
      await service.signInWithGoogle({ idToken: 't' });
      const result = await service.signInWithGoogle({ idToken: 't' });

      expect(result.user.id).toBe(1);
      expect(users.rows).toHaveLength(1);
      expect(identities.rows).toHaveLength(1);
    });

    it('finds returning users by identity even if their email changed', async () => {
      await service.signInWithGoogle({ idToken: 't' });
      google.verify.mockResolvedValue({
        ...googleProfile,
        email: 'new@example.com',
      });

      const result = await service.signInWithGoogle({ idToken: 't' });
      expect(result.user.id).toBe(1);
    });

    it('leaves the name empty when the provider sends none', async () => {
      google.verify.mockResolvedValue({ ...googleProfile, name: null });
      const result = await service.signInWithGoogle({ idToken: 't' });
      expect(result.user.name).toBeNull();
    });

    it('refuses to link an unverified email to an existing account', async () => {
      await service.signInWithGoogle({ idToken: 't' });
      google.verify.mockResolvedValue({
        ...googleProfile,
        subject: 'google-2',
        emailVerified: false,
      });

      await expect(
        service.signInWithGoogle({ idToken: 't' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(identities.rows).toHaveLength(1);
    });

    it('retries after losing a race with a concurrent first sign-in', async () => {
      const duplicate = new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('dup'), { code: '23505' }),
      );
      identities.save.mockRejectedValueOnce(duplicate);
      // The other request's rows, visible once the first attempt fails.
      identities.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 9, userId: 1 });

      const result = await service.signInWithGoogle({ idToken: 't' });
      expect(result.user.id).toBe(1);
    });

    it('propagates invalid tokens', async () => {
      google.verify.mockRejectedValue(new UnauthorizedException());
      await expect(
        service.signInWithGoogle({ idToken: 't' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signInWithApple', () => {
    it('uses the name sent by the client and stores the encrypted refresh token', async () => {
      const result = await service.signInWithApple({
        ...appleDto,
        givenName: 'Ada',
        familyName: 'Lovelace',
      });

      expect(apple.verify).toHaveBeenCalledWith('apple.id.token', 'raw-nonce');
      expect(apple.exchangeCode).toHaveBeenCalledWith(
        'code-1',
        'com.example.fictulary.web',
      );
      expect(result.user.name).toBe('Ada Lovelace');
      const [identity] = identities.rows;
      expect(identity.appleClientId).toBe('com.example.fictulary.web');
      expect(identity.appleRefreshToken).not.toBe('apple-refresh-token');
      expect(cipher.decrypt(identity.appleRefreshToken as string)).toBe(
        'apple-refresh-token',
      );
    });

    it('exchanges the code only until a refresh token is stored', async () => {
      await service.signInWithApple(appleDto);
      await service.signInWithApple(appleDto);
      expect(apple.exchangeCode).toHaveBeenCalledTimes(1);
    });

    it('links to the Google account with the same verified email', async () => {
      await service.signInWithGoogle({ idToken: 't' });
      const result = await service.signInWithApple(appleDto);

      expect(result.user.id).toBe(1);
      expect(users.rows).toHaveLength(1);
      expect(identities.rows.map((i) => i.provider)).toEqual([
        AuthProvider.GOOGLE,
        AuthProvider.APPLE,
      ]);
    });

    it('fills in a missing name on a later sign-in', async () => {
      await service.signInWithApple(appleDto);
      const result = await service.signInWithApple({
        ...appleDto,
        givenName: 'Ada',
      });
      expect(result.user.name).toBe('Ada');
    });

    it("doesn't overwrite a name the user already has", async () => {
      await service.signInWithApple({ ...appleDto, givenName: 'Ada' });
      const result = await service.signInWithApple({
        ...appleDto,
        givenName: 'Eve',
      });
      expect(result.user.name).toBe('Ada');
    });

    it('fails without creating anything when the code exchange fails', async () => {
      apple.exchangeCode.mockRejectedValue(new UnauthorizedException());
      await expect(service.signInWithApple(appleDto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(users.rows).toHaveLength(0);
    });
  });

  describe('devSignIn', () => {
    it('creates the account once, then signs into it', async () => {
      const first = await service.devSignIn('dev@example.com', 'Dev');
      const second = await service.devSignIn('dev@example.com');

      expect(first.user).toMatchObject({ id: 1, name: 'Dev' });
      expect(second.user.id).toBe(1);
      expect(identities.rows).toHaveLength(0);
    });

    it('leaves the name empty when none is given', async () => {
      const result = await service.devSignIn('dev@example.com');
      expect(result.user.name).toBeNull();
    });
  });

  describe('me and updateProfile', () => {
    it('returns and renames the user', async () => {
      await service.signInWithGoogle({ idToken: 't' });

      await expect(
        service.updateProfile(1, { name: 'Countess' }),
      ).resolves.toMatchObject({
        name: 'Countess',
      });
      await expect(service.me(1)).resolves.toMatchObject({ name: 'Countess' });
    });

    it('rejects deleted accounts', async () => {
      await expect(service.me(42)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('deleteAccount', () => {
    it('revokes Apple access, then deletes the user', async () => {
      await service.signInWithApple(appleDto);

      await service.deleteAccount(1);

      expect(apple.revoke).toHaveBeenCalledWith(
        'apple-refresh-token',
        'com.example.fictulary.web',
      );
      expect(users.rows).toHaveLength(0);
    });

    it('still deletes the user when revocation fails', async () => {
      await service.signInWithApple(appleDto);
      apple.revoke.mockRejectedValue(new Error('Apple is down'));

      await service.deleteAccount(1);
      expect(users.rows).toHaveLength(0);
    });

    it('deletes without revoking when Apple is no longer configured', async () => {
      await service.signInWithApple(appleDto);
      apple.enabled = false;

      await service.deleteAccount(1);
      expect(apple.revoke).not.toHaveBeenCalled();
      expect(users.rows).toHaveLength(0);
    });

    it('skips revocation for Google-only accounts', async () => {
      await service.signInWithGoogle({ idToken: 't' });
      await service.deleteAccount(1);
      expect(apple.revoke).not.toHaveBeenCalled();
      expect(users.delete).toHaveBeenCalledWith({ id: 1 });
    });
  });
});
