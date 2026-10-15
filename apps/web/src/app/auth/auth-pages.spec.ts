import { TestBed } from '@angular/core/testing';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AlertController } from '@ionic/angular';
import { Store, provideStore } from '@ngxs/store';
import {
  ionicUpdates,
  shownErrors,
  text,
  typeInto,
} from '../shared/ionic-testing';
import { SignInFail, SignInSuccess, SignOut } from './auth.actions';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { AccountPage } from './account-page';
import { SignInPage } from './sign-in-page';
import { SocialLoginService } from './social-login.service';
import { ada, authResponse } from './testing';
import { WelcomePage } from './welcome-page';

describe('auth pages', () => {
  const auth = {
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    devSignIn: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
    clearError: vi.fn(),
  };
  const social = { prepare: vi.fn(), providers: vi.fn() };
  let confirmed = true;
  const alerts = {
    create: vi.fn(async () => ({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: confirmed ? 'confirm' : 'cancel' }),
    })),
  };
  let harness: RouterTestingHarness;

  const page = () => harness.routeNativeElement;
  const fill = (selector: string, value: string) =>
    typeInto(page()?.querySelector(selector), value);
  const submit = async () => {
    page()?.querySelector('form')?.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
  };
  const button = (label: string) =>
    [...(page()?.querySelectorAll<HTMLElement>('ion-button') ?? [])].find(
      (element) => text(element)?.includes(label),
    );
  const dispatch = async (action: object) => {
    TestBed.inject(Store).dispatch(action);
    await harness.fixture.whenStable();
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    localStorage.clear();
    confirmed = true;
    social.providers.mockResolvedValue({ devSignIn: false });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            { path: 'sign-in', component: SignInPage },
            { path: 'welcome', component: WelcomePage },
            { path: 'account', component: AccountPage },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        provideStore([AuthState]),
        { provide: AuthService, useValue: auth },
        { provide: SocialLoginService, useValue: social },
        { provide: AlertController, useValue: alerts },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  describe('SignInPage', () => {
    it('prepares the providers and signs in with each', async () => {
      await harness.navigateByUrl('/sign-in');
      expect(social.prepare).toHaveBeenCalled();

      button('Continue with Apple')?.click();
      button('Continue with Google')?.click();
      expect(auth.signInWithApple).toHaveBeenCalled();
      expect(auth.signInWithGoogle).toHaveBeenCalled();
    });

    it('clears a stale error each time it is shown', async () => {
      await harness.navigateByUrl('/sign-in');
      // Ionic's router outlet calls this; the plain one in tests doesn't.
      const instance = harness.routeDebugElement
        ?.componentInstance as SignInPage;
      instance.ionViewWillEnter();
      expect(auth.clearError).toHaveBeenCalled();
    });

    it('shows sign-in errors', async () => {
      await harness.navigateByUrl('/sign-in');
      await dispatch(new SignInFail('Invalid Google sign-in'));
      expect(text(page()?.querySelector('p.error[role=alert]'))).toBe(
        'Invalid Google sign-in',
      );
    });

    it('hides the dev form unless the API enables it', async () => {
      await harness.navigateByUrl('/sign-in');
      expect(page()?.querySelector('form.dev')).toBeNull();
    });

    it('signs in through the dev form when enabled', async () => {
      social.providers.mockResolvedValue({ devSignIn: true });
      await harness.navigateByUrl('/sign-in');
      await harness.fixture.whenStable();

      fill('ion-input[formcontrolname=email]', ' dev@example.com ');
      await submit();
      expect(auth.devSignIn).toHaveBeenCalledWith({
        email: 'dev@example.com',
        name: undefined,
      });
    });

    it('validates the dev form', async () => {
      social.providers.mockResolvedValue({ devSignIn: true });
      await harness.navigateByUrl('/sign-in');
      await harness.fixture.whenStable();

      fill('ion-input[formcontrolname=email]', 'not-an-email');
      await submit();
      expect(auth.devSignIn).not.toHaveBeenCalled();
      await ionicUpdates();
      expect(shownErrors(page())).toEqual(['Enter a valid email address.']);
    });

    it('returns to the requested page after signing in', async () => {
      await harness.navigateByUrl('/sign-in?returnUrl=%2Fbook%2F3');
      await dispatch(new SignInSuccess(authResponse()));
      expect(TestBed.inject(Router).url).toBe('/book/3');
    });

    it('asks new users without a name for one first', async () => {
      await harness.navigateByUrl('/sign-in?returnUrl=%2Fbook%2F3');
      await dispatch(
        new SignInSuccess({ ...authResponse(), user: { ...ada, name: null } }),
      );
      expect(TestBed.inject(Router).url).toBe('/welcome?returnUrl=%2Fbook%2F3');
    });

    it('ignores return URLs pointing to other sites', async () => {
      await harness.navigateByUrl('/sign-in?returnUrl=%2F%2Fevil.example');
      await dispatch(new SignInSuccess(authResponse()));
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });

  describe('WelcomePage', () => {
    beforeEach(async () => {
      await dispatch(
        new SignInSuccess({ ...authResponse(), user: { ...ada, name: null } }),
      );
      await harness.navigateByUrl('/welcome?returnUrl=%2Fbook%2F3');
    });

    it('requires a name', async () => {
      fill('ion-input[formcontrolname=name]', '   ');
      await submit();
      expect(auth.updateProfile).not.toHaveBeenCalled();
      await ionicUpdates();
      expect(shownErrors(page())).toEqual(['Name is required.']);
    });

    it('saves the trimmed name', async () => {
      fill('ion-input[formcontrolname=name]', '  Ada ');
      await submit();
      expect(auth.updateProfile).toHaveBeenCalledWith('Ada');
    });

    it('continues to the requested page once the name is set', async () => {
      await dispatch(new SignInSuccess(authResponse()));
      expect(TestBed.inject(Router).url).toBe('/book/3');
    });
  });

  describe('AccountPage', () => {
    beforeEach(async () => {
      await dispatch(new SignInSuccess(authResponse()));
      await harness.navigateByUrl('/account');
      await harness.fixture.whenStable();
    });

    it('shows the email and edits the current name', async () => {
      expect(text(page()?.querySelector('ion-card-subtitle'))).toBe(
        'ada@example.com',
      );
      fill('ion-input[formcontrolname=name]', 'Countess');
      await submit();
      expect(auth.updateProfile).toHaveBeenCalledWith('Countess');
    });

    it('deletes the account after confirmation', async () => {
      button('Delete account')?.click();
      await harness.fixture.whenStable();
      expect(alerts.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Delete your account?' }),
      );
      expect(auth.deleteAccount).toHaveBeenCalled();
    });

    it('keeps the account when not confirmed', async () => {
      confirmed = false;
      button('Delete account')?.click();
      await harness.fixture.whenStable();
      expect(auth.deleteAccount).not.toHaveBeenCalled();
    });

    it('goes home once signed out', async () => {
      await dispatch(new SignOut());
      expect(TestBed.inject(Router).url).toBe('/');
    });
  });
});
