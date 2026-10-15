import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Store, provideStore } from '@ngxs/store';
import { SignInSuccess } from './auth.actions';
import { authGuard } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { AuthState } from './auth.state';
import { authResponse } from './testing';

@Component({ template: '' })
class Blank {}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let store: Store;
  let router: Router;
  const response = authResponse();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'upload', component: Blank, canActivate: [authGuard] },
        ]),
        provideStore([AuthState]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  const signIn = () => store.dispatch(new SignInSuccess(response));

  it('adds the bearer token to API requests', () => {
    signIn();
    http.get('/api/books').subscribe();
    expect(
      backend.expectOne('/api/books').request.headers.get('Authorization'),
    ).toBe(`Bearer ${response.accessToken}`);
  });

  it('sends requests unchanged when signed out', () => {
    http.get('/api/books').subscribe();
    expect(
      backend.expectOne('/api/books').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('never sends the token to sign-in endpoints or other hosts', () => {
    signIn();
    http.post('/api/auth/google', {}).subscribe();
    http.get('https://example.com/api/x').subscribe();
    expect(
      backend
        .expectOne('/api/auth/google')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      backend
        .expectOne('https://example.com/api/x')
        .request.headers.has('Authorization'),
    ).toBe(false);
  });

  const reject = () => {
    http.get('/api/me').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
  };

  it('signs out and sends restricted pages home to sign in', async () => {
    signIn();
    await router.navigateByUrl('/upload');

    reject();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
    expect(router.url).toBe('/?returnUrl=%2Fupload');
  });

  it('signs out but stays put on public pages', async () => {
    signIn();
    await router.navigateByUrl('/');

    reject();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(store.selectSnapshot(AuthState.isAuthenticated)).toBe(false);
    expect(router.url).toBe('/');
  });

  it('redirects once a navigation in progress lands on a restricted page', async () => {
    signIn();
    // The 401 arrives while the app is still navigating to /upload.
    const navigation = router.navigateByUrl('/upload');
    reject();
    await navigation;
    await TestBed.inject(ApplicationRef).whenStable();

    expect(router.url).toBe('/?returnUrl=%2Fupload');
  });
});
