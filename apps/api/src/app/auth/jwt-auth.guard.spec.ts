import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const users = { existsBy: jest.fn() };
  const guard = new JwtAuthGuard(
    jwt,
    new Reflector(),
    users as unknown as Repository<User>,
  );

  beforeEach(() => users.existsBy.mockReset().mockResolvedValue(true));

  class Routes {
    protected() {
      return;
    }

    @Public()
    open() {
      return;
    }
  }

  const contextFor = (
    authorization?: string,
    handler = Routes.prototype.protected,
  ) => {
    const request: Record<string, unknown> = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => Routes,
    } as unknown as ExecutionContext;
    return { context, request };
  };

  it('lets @Public() routes through without a token', async () => {
    const { context, request } = contextFor(undefined, Routes.prototype.open);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches the user for a valid token', async () => {
    const token = await jwt.signAsync({ sub: '42', email: 'ada@example.com' });
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 42, email: 'ada@example.com' });
    expect(users.existsBy).toHaveBeenCalledWith({ id: 42 });
  });

  it('rejects valid tokens for deleted accounts', async () => {
    users.existsBy.mockResolvedValue(false);
    const token = await jwt.signAsync({ sub: '42', email: 'ada@example.com' });
    const { context, request } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Account not found'),
    );
    expect(request.user).toBeUndefined();
  });

  it.each([
    ['no header', undefined],
    ['another scheme', 'Basic abc'],
    ['a malformed token', 'Bearer not-a-jwt'],
  ])('rejects %s', async (_case, header) => {
    await expect(
      guard.canActivate(contextFor(header).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens signed with another secret', async () => {
    const token = await new JwtService({ secret: 'other' }).signAsync({
      sub: '1',
      email: 'x@example.com',
    });
    await expect(
      guard.canActivate(contextFor(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired tokens', async () => {
    const token = await jwt.signAsync(
      { sub: '1', email: 'x@example.com' },
      { expiresIn: -10 },
    );
    await expect(
      guard.canActivate(contextFor(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
