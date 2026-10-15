import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Actions, Store, ofActionDispatched, provideStore } from '@ngxs/store';
import { firstValueFrom } from 'rxjs';
import {
  DeleteAccount,
  DeleteAccountFail,
  DevSignIn,
  RestoreSession,
  SignInWithApple,
  SignInWithGoogle,
  SignOut,
  UpdateProfile,
} from './auth.actions';
import { AuthState } from './auth.state';
import {
  SignInCancelledError,
  SocialLoginService,
} from './social-login.service';
import { ada, authResponse, fakeJwt } from './testing';

const TOKEN_KEY = 'fictulary.accessToken';

describe('AuthState', () => {
  const social = { google: vi.fn(), apple: vi.fn() };
  let store: Store;
  let http: HttpTestingController;

  /** Lets the provider promise settle so the API request goes out. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideStore([AuthState]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SocialLoginService, useValue: social },
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const signIn = () => {
    store.dispatch(new DevSignIn({ email: 'ada@example.com' }));
    return settle().then(() =>
      http.expectOne('/api/auth/dev').flush(authResponse()),
    );
  };

  describe('sign-in', () => {
    it('signs in with Google, keeping the token in the store and localStorage', async () => {
      social.google.mockResolvedValue({ idToken: 'google-token' });
      store.dispatch(new SignInWithGoogle());
      expect(store.selectSnapshot(AuthState.submitting)).toBe(true);
      await settle();

      const req = http.expectOne('/api/auth/google');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ idToken: 'google-token' });
      const response = authResponse();
      req.flush(response);

      expect(store.selectSnapshot(AuthState.token)).toBe(response.accessToken);
      expect(store.selectSnapshot(AuthState.user)).toEqual(ada);
      expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBe(response.accessToken);
    });

    it('signs in with Apple', async () => {
      const body = {
        idToken: 'apple-token',
        authorizationCode: 'code',
        nonce: 'nonce',
      };
      social.apple.mockResolvedValue(body);
      store.dispatch(new SignInWithApple());
      await settle();

      const req = http.expectOne('/api/auth/apple');
      expect(req.request.body).toEqual(body);
      req.flush(authResponse());
      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
    });

    it('signs in with the dev endpoint', async () => {
      await signIn();
      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
    });

    it('shows the API error when the API rejects the token', async () => {
      social.google.mockResolvedValue({ idToken: 'google-token' });
      store.dispatch(new SignInWithGoogle());
      await settle();
      http
        .expectOne('/api/auth/google')
        .flush(
          { message: 'Invalid Google sign-in' },
          { status: 401, statusText: 'Unauthorized' },
        );

      expect(store.selectSnapshot(AuthState.error)).toBe(
        'Invalid Google sign-in',
      );
      expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
    });

    it('stays quiet when the user cancels the popup', async () => {
      social.apple.mockRejectedValue(new SignInCancelledError());
      store.dispatch(new SignInWithApple());
      await settle();

      http.expectNone('/api/auth/apple');
      expect(store.selectSnapshot(AuthState.error)).toBeNull();
      expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
    });

    it('shows a generic error when the provider popup fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      social.google.mockRejectedValue(new Error('Failed to open popup'));
      store.dispatch(new SignInWithGoogle());
      await settle();

      expect(store.selectSnapshot(AuthState.error)).toBe(
        'Sign-in failed. Please try again.',
      );
    });
  });

  it('knows when a signed-in user still needs a name', async () => {
    store.dispatch(new DevSignIn({ email: 'ada@example.com' }));
    await settle();
    http
      .expectOne('/api/auth/dev')
      .flush({ ...authResponse(), user: { ...ada, name: null } });
    expect(store.selectSnapshot(AuthState.needsName)).toBe(true);

    store.dispatch(new UpdateProfile('Ada'));
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Ada' });
    req.flush(ada);

    expect(store.selectSnapshot(AuthState.needsName)).toBe(false);
    expect(store.selectSnapshot(AuthState.user)).toEqual(ada);
  });

  it('reports a failed profile update', async () => {
    await signIn();
    store.dispatch(new UpdateProfile('Ada'));
    http
      .expectOne('/api/me')
      .flush(
        { message: ['name should not be empty'] },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(store.selectSnapshot(AuthState.error)).toBe(
      'name should not be empty',
    );
    expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
  });

  describe('DeleteAccount', () => {
    it('deletes the account and signs out', async () => {
      await signIn();
      store.dispatch(new DeleteAccount());
      expect(store.selectSnapshot(AuthState.deleting)).toBe(true);

      const req = http.expectOne('/api/me');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
      expect(store.selectSnapshot(AuthState.deleting)).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('keeps the session and reports a failure', async () => {
      await signIn();
      const failed = firstValueFrom(
        TestBed.inject(Actions).pipe(ofActionDispatched(DeleteAccountFail)),
      );
      store.dispatch(new DeleteAccount());
      http
        .expectOne('/api/me')
        .flush(
          { message: 'Something broke' },
          { status: 500, statusText: 'Server Error' },
        );

      await expect(failed).resolves.toEqual(
        new DeleteAccountFail('Something broke'),
      );
      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
      expect(store.selectSnapshot(AuthState.deleting)).toBe(false);
    });
  });

  describe('RestoreSession', () => {
    it('copies a saved token into the store and loads the profile', () => {
      const token = fakeJwt();
      localStorage.setItem(TOKEN_KEY, token);

      store.dispatch(new RestoreSession());

      expect(store.selectSnapshot(AuthState.token)).toBe(token);
      http.expectOne('/api/me').flush(ada);
      expect(store.selectSnapshot(AuthState.user)).toEqual(ada);
    });

    it('drops an expired token without calling the API', () => {
      localStorage.setItem(TOKEN_KEY, fakeJwt(-60));

      store.dispatch(new RestoreSession());

      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      http.expectNone('/api/me');
    });

    it('does nothing without a saved token', () => {
      store.dispatch(new RestoreSession());
      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
      http.expectNone('/api/me');
    });

    it('keeps the session when the profile fails to load for other reasons', () => {
      localStorage.setItem(TOKEN_KEY, fakeJwt());
      store.dispatch(new RestoreSession());
      http.expectOne('/api/me').error(new ProgressEvent('error'));
      expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
    });
  });

  it('signs out, clearing the store and localStorage', async () => {
    await signIn();

    store.dispatch(new SignOut());

    expect(store.selectSnapshot(AuthState.token)).toBeNull();
    expect(store.selectSnapshot(AuthState.user)).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
