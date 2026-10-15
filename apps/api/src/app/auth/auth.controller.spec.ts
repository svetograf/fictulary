import { ConfigType } from '@nestjs/config';
import { oauthConfig } from '../config/oauth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController.providers', () => {
  const google = { webClientId: 'web', iosClientId: 'ios' };
  const controller = (apple: object | null) =>
    new AuthController(
      {} as AuthService,
      { google, apple } as ConfigType<typeof oauthConfig>,
    );

  it('offers only the public Apple settings when Apple is configured', () => {
    const providers = controller({
      servicesId: 'com.example.web',
      redirectUri: 'https://app.example.com/auth/callback',
      privateKey: 'secret',
      encryptionKey: Buffer.alloc(32),
    }).providers();

    expect(providers).toEqual({
      google: { webClientId: 'web' },
      apple: {
        servicesId: 'com.example.web',
        redirectUri: 'https://app.example.com/auth/callback',
      },
      devSignIn: expect.any(Boolean),
    });
  });

  it('reports Apple as unavailable when it is not configured', () => {
    expect(controller(null).providers().apple).toBeNull();
  });
});
