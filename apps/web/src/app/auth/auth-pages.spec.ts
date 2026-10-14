import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Store, provideStore } from '@ngxs/store';
import { SignInSuccess, SignUpFail } from './auth.actions';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { SignInPage } from './sign-in-page';
import { SignUpPage } from './sign-up-page';
import { ionicUpdates, shownErrors, typeInto } from '../shared/ionic-testing';
import { authResponse } from './testing';

describe('auth pages', () => {
  const auth = { signUp: vi.fn(), signIn: vi.fn(), clearError: vi.fn() };
  let harness: RouterTestingHarness;

  const fill = (selector: string, value: string) =>
    typeInto(harness.routeNativeElement?.querySelector(selector), value);
  const submit = async () => {
    harness.routeNativeElement
      ?.querySelector('form')
      ?.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'sign-up', component: SignUpPage },
            { path: 'sign-in', component: SignInPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideStore([AuthState]),
        { provide: AuthService, useValue: auth },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  describe('SignUpPage', () => {
    beforeEach(() => harness.navigateByUrl('/sign-up'));

    it('clears a stale error each time it is shown', () => {
      // Ionic's router outlet calls this; the plain one in tests doesn't.
      const page = harness.routeDebugElement?.componentInstance as SignUpPage;
      page.ionViewWillEnter();
      page.ionViewWillEnter();
      expect(auth.clearError).toHaveBeenCalledTimes(2);
    });

    it('validates before sending anything', async () => {
      fill('ion-input[formcontrolname=name]', '   ');
      fill('ion-input[formcontrolname=email]', 'not-an-email');
      fill('ion-input[formcontrolname=password]', 'short');
      await submit();

      expect(auth.signUp).not.toHaveBeenCalled();
      await ionicUpdates();
      expect(shownErrors(harness.routeNativeElement)).toEqual([
        'Name is required.',
        'Enter a valid email address.',
        'Password must be at least 8 characters.',
      ]);
    });

    it('signs up with trimmed values', async () => {
      fill('ion-input[formcontrolname=name]', '  Ada ');
      fill('ion-input[formcontrolname=email]', ' ada@example.com ');
      fill('ion-input[formcontrolname=password]', 'secret123');
      await submit();

      expect(auth.signUp).toHaveBeenCalledWith({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'secret123',
      });
    });

    it('shows server errors', async () => {
      TestBed.inject(Store).dispatch(
        new SignUpFail('An account with this email already exists'),
      );
      await harness.fixture.whenStable();
      expect(
        harness.routeNativeElement?.querySelector('p.error[role=alert]')
          ?.textContent,
      ).toContain('An account with this email already exists');
    });
  });

  describe('SignInPage', () => {
    it('signs in and returns to the requested page', async () => {
      await harness.navigateByUrl('/sign-in?returnUrl=%2Fbook%2F3');
      fill('ion-input[formcontrolname=email]', 'ada@example.com');
      fill('ion-input[formcontrolname=password]', 'secret123');
      await submit();
      expect(auth.signIn).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'secret123',
      });

      TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/book/3');
    });

    it('ignores return URLs pointing to other sites', async () => {
      await harness.navigateByUrl('/sign-in?returnUrl=%2F%2Fevil.example');
      TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });
});
