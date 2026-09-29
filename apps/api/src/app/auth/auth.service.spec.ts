import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

describe('AuthService', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');
  const users = {
    existsBy: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (user) => ({ id: 42, createdAt, ...user })),
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AuthService(users as unknown as Repository<User>, jwt);
  const publicUser = {
    id: 42,
    name: 'Ada',
    email: 'ada@example.com',
    createdAt: '2026-09-01T10:00:00.000Z',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('signUp', () => {
    const dto = {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    };

    it('stores a password hash and returns a token for the new user', async () => {
      users.existsBy.mockResolvedValue(false);

      const result = await service.signUp(dto);

      const saved = users.save.mock.calls[0][0];
      expect(saved.passwordHash).toMatch(/^scrypt\$/);
      expect(saved).not.toHaveProperty('password');
      expect(result.user).toEqual(publicUser);
      expect(result.user).not.toHaveProperty('passwordHash');
      await expect(jwt.verifyAsync(result.accessToken)).resolves.toMatchObject({
        sub: '42',
        email: 'ada@example.com',
      });
    });

    it('rejects an email that is already registered', async () => {
      users.existsBy.mockResolvedValue(true);
      await expect(service.signUp(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(users.save).not.toHaveBeenCalled();
    });

    it('maps a concurrent duplicate insert to a conflict', async () => {
      users.existsBy.mockResolvedValue(false);
      users.save.mockRejectedValueOnce(
        new QueryFailedError(
          'INSERT',
          [],
          Object.assign(new Error('dup'), { code: '23505' }),
        ),
      );
      await expect(service.signUp(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('signIn', () => {
    it('returns a token for the right password', async () => {
      users.findOneBy.mockResolvedValue({
        ...publicUser,
        createdAt,
        passwordHash: await hashPassword('secret123'),
      });

      const result = await service.signIn({
        email: 'ada@example.com',
        password: 'secret123',
      });

      expect(result.user).toEqual(publicUser);
      await expect(jwt.verifyAsync(result.accessToken)).resolves.toMatchObject({
        sub: '42',
      });
    });

    it('rejects a wrong password', async () => {
      users.findOneBy.mockResolvedValue({
        ...publicUser,
        createdAt,
        passwordHash: await hashPassword('secret123'),
      });
      await expect(
        service.signIn({ email: 'ada@example.com', password: 'nope-nope' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });

    it('gives the same error for an unknown email', async () => {
      users.findOneBy.mockResolvedValue(null);
      await expect(
        service.signIn({ email: 'who@example.com', password: 'secret123' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('me', () => {
    it('returns the user without the password hash', async () => {
      users.findOneBy.mockResolvedValue({
        ...publicUser,
        createdAt,
        passwordHash: 'scrypt$…',
      });
      await expect(service.me(42)).resolves.toEqual(publicUser);
    });

    it('rejects tokens for deleted accounts', async () => {
      users.findOneBy.mockResolvedValue(null);
      await expect(service.me(42)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
