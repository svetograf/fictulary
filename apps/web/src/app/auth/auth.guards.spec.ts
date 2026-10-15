import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Store, provideStore } from '@ngxs/store';
import { SignInSuccess } from './auth.actions';
import { authGuard, safeReturnUrl } from './auth.guards';
import { AuthState } from './auth.state';
import { authResponse } from './testing';

describe('auth guards', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/book/3' } as RouterStateSnapshot;
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard(route, state));
  const signIn = () =>
    TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideStore([AuthState])],
    });
  });

  it('authGuard sends signed-out users home to sign in, with a return URL', () => {
    const result = run(authGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      '/?returnUrl=%2Fbook%2F3',
    );
  });

  it('authGuard lets signed-in users through', () => {
    signIn();
    expect(run(authGuard)).toBe(true);
  });

  it.each([
    ['/book/3', '/book/3'],
    [undefined, '/'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
  ])('safeReturnUrl(%s) -> %s', (url, expected) => {
    expect(safeReturnUrl(url)).toBe(expected);
  });
});
