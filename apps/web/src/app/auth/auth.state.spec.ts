import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Store, provideStore } from '@ngxs/store';
import { RestoreSession, SignIn, SignOut, SignUp } from './auth.actions';
import { AuthState } from './auth.state';
import { ada, authResponse, fakeJwt } from './testing';

const TOKEN_KEY = 'fictulary.accessToken';

describe('AuthState', () => {
  let store: Store;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideStore([AuthState]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('signs up, keeping the token in the store and localStorage', () => {
    const payload = {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret123',
    };
    store.dispatch(new SignUp(payload));
    expect(store.selectSnapshot(AuthState.submitting)).toBe(true);

    const req = http.expectOne('/api/sign-up');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    const response = authResponse();
    req.flush(response);

    expect(store.selectSnapshot(AuthState.token)).toBe(response.accessToken);
    expect(store.selectSnapshot(AuthState.user)).toEqual(ada);
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(true);
    expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(response.accessToken);
  });

  it('reports an email that is already registered', () => {
    store.dispatch(
      new SignUp({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret123',
      }),
    );
    http
      .expectOne('/api/sign-up')
      .flush(
        { message: 'An account with this email already exists' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(store.selectSnapshot(AuthState.error)).toBe(
      'An account with this email already exists',
    );
    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('signs in', () => {
    store.dispatch(
      new SignIn({ email: 'ada@example.com', password: 'secret123' }),
    );
    const response = authResponse();
    http.expectOne('/api/sign-in').flush(response);

    expect(store.selectSnapshot(AuthState.token)).toBe(response.accessToken);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(response.accessToken);
  });

  it('reports wrong credentials', () => {
    store.dispatch(new SignIn({ email: 'ada@example.com', password: 'nope' }));
    http
      .expectOne('/api/sign-in')
      .flush(
        { message: 'Invalid email or password' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(store.selectSnapshot(AuthState.error)).toBe(
      'Invalid email or password',
    );
    expect(store.selectSnapshot(AuthState.submitting)).toBe(false);
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

  it('signs out, clearing the store and localStorage', () => {
    store.dispatch(
      new SignIn({ email: 'ada@example.com', password: 'secret123' }),
    );
    http.expectOne('/api/sign-in').flush(authResponse());

    store.dispatch(new SignOut());

    expect(store.selectSnapshot(AuthState.token)).toBeNull();
    expect(store.selectSnapshot(AuthState.user)).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
