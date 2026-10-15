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
    social.providers.mockResolvedValue({
      apple: { servicesId: 'web', redirectUri: 'https://x/auth/callback' },
      devSignIn: false,
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
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
