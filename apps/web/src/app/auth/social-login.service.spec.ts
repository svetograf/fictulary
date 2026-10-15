import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  SignInCancelledError,
  SocialLoginService,
} from './social-login.service';

const plugin = vi.hoisted(() => ({
  initialize: vi.fn(),
  login: vi.fn(),
}));
vi.mock('@capgo/capacitor-social-login', () => ({ SocialLogin: plugin }));

describe('SocialLoginService', () => {
  const config = {
    google: { webClientId: 'google-web' },
    apple: {
      servicesId: 'com.example.web',
      redirectUri: 'https://app.example.com/auth/callback',
    },
    devSignIn: false,
  };
  let service: SocialLoginService;
  let http: HttpTestingController;

  const sha256Hex = async (value: string) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
      ),
      (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');

  /** Answers the config request once the service has made it. */
  const flushConfig = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/auth/providers').flush(config);
  };

  beforeEach(() => {
    vi.resetAllMocks();
    plugin.initialize.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SocialLoginService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('initializes the plugin once with the API config', async () => {
    plugin.login.mockResolvedValue({ result: { idToken: 'g' } });
    const first = service.google();
    await flushConfig();
    await first;
    await service.google();

    expect(plugin.initialize).toHaveBeenCalledTimes(1);
    expect(plugin.initialize).toHaveBeenCalledWith({
      google: {
        webClientId: 'google-web',
        redirectUrl: `${window.location.origin}/auth/callback`,
      },
      apple: {
        clientId: 'com.example.web',
        redirectUrl: 'https://app.example.com/auth/callback',
        useProperTokenExchange: true,
      },
    });
  });

  it('leaves Apple out of the plugin when the API has no Apple config', async () => {
    plugin.login.mockResolvedValue({ result: { idToken: 'g' } });
    const result = service.google();
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/auth/providers').flush({ ...config, apple: null });
    await result;

    expect(plugin.initialize).toHaveBeenCalledWith({
      google: {
        webClientId: 'google-web',
        redirectUrl: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it('returns the Google ID token', async () => {
    plugin.login.mockResolvedValue({ result: { idToken: 'google-token' } });
    const result = service.google();
    await flushConfig();
    await expect(result).resolves.toEqual({ idToken: 'google-token' });
  });

  it('gives Apple a hash of the nonce and the API the nonce itself', async () => {
    plugin.login.mockResolvedValue({
      result: {
        idToken: 'apple-token',
        authorizationCode: 'code',
        profile: { givenName: 'Ada', familyName: null },
      },
    });
    const pending = service.apple();
    await flushConfig();
    const result = await pending;

    const sent = plugin.login.mock.calls[0][0].options.nonce;
    expect(result.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(sent).toBe(await sha256Hex(result.nonce));
    expect(result).toMatchObject({
      idToken: 'apple-token',
      authorizationCode: 'code',
      givenName: 'Ada',
      familyName: undefined,
    });
  });

  it.each([
    ['the plugin cancel code', { code: 'USER_CANCELLED', message: 'x' }],
    ['a closed Apple popup', { error: 'popup_closed_by_user' }],
  ])('reports %s as a cancellation', async (_case, error) => {
    plugin.login.mockRejectedValue(error);
    const result = service.apple();
    await flushConfig();
    await expect(result).rejects.toBeInstanceOf(SignInCancelledError);
  });

  it('passes other failures through', async () => {
    plugin.login.mockRejectedValue(new Error('Failed to open popup'));
    const result = service.google();
    await flushConfig();
    await expect(result).rejects.toThrow('Failed to open popup');
  });

  it('retries the config after a failed request', async () => {
    const first = service.providers();
    http
      .expectOne('/api/auth/providers')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await expect(first).rejects.toBeTruthy();

    const second = service.providers();
    http.expectOne('/api/auth/providers').flush(config);
    await expect(second).resolves.toEqual(config);
  });
});
