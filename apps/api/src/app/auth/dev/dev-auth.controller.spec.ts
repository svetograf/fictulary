import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { DevAuthController } from './dev-auth.controller';

describe('DevAuthController', () => {
  const auth = { devSignIn: jest.fn().mockResolvedValue({}) };
  const controller = new DevAuthController(auth as unknown as AuthService);
  const from = (remoteAddress: string, headers = {}) =>
    ({ socket: { remoteAddress }, headers }) as unknown as Request;

  beforeEach(() => auth.devSignIn.mockClear());

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
    'signs in requests from %s',
    async (address) => {
      await controller.signIn({ email: 'dev@example.com' }, from(address));
      expect(auth.devSignIn).toHaveBeenCalledWith('dev@example.com', undefined);
    },
  );

  it('refuses other addresses, even with a spoofed forwarding header', () => {
    expect(() =>
      controller.signIn(
        { email: 'dev@example.com' },
        from('203.0.113.7', { 'x-forwarded-for': '127.0.0.1' }),
      ),
    ).toThrow(ForbiddenException);
    expect(auth.devSignIn).not.toHaveBeenCalled();
  });
});
