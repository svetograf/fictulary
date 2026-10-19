import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CefrLevel } from '@fictulary/shared/models';
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
import {
  LoadBooksSuccess,
  SetLevelFail,
  SetLevelSuccess,
} from '../books/books.actions';
import { BooksService } from '../books/books.service';
import { BooksState } from '../books/books.state';
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
  const books = { setLevel: vi.fn(), loadBooks: vi.fn() };
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
  const chooseLevel = async (level: CefrLevel) => {
    page()
      ?.querySelector('ion-radio-group')
      ?.dispatchEvent(
        new CustomEvent('ionChange', { detail: { value: level } }),
      );
    await harness.fixture.whenStable();
  };
  const levelList = {
    id: 9,
    name: 'B1 vocabulary',
    description: null,
    wordCount: 4169,
    uniqueWordCount: 4169,
    createdAt: '2026-10-19T10:00:00.000Z',
    level: CefrLevel.B1,
  };
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
        provideStore([AuthState, BooksState]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: BooksService, useValue: books },
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

    it('asks for the level once the name is set', async () => {
      await dispatch(
        new SignInSuccess({
          ...authResponse(),
          user: { ...ada, levelPrompted: false },
        }),
      );
      expect(TestBed.inject(Router).url).toBe('/welcome?returnUrl=%2Fbook%2F3');
      expect(text(page()?.querySelector('ion-card-subtitle'))).toBe(
        'How good is your English?',
      );
      expect(page()?.querySelector('app-name-form')).toBeNull();
    });

    it('continues to the requested page once the name and level are set', async () => {
      await dispatch(new SignInSuccess(authResponse()));
      expect(TestBed.inject(Router).url).toBe('/book/3');
    });
  });

  describe('WelcomePage level step', () => {
    beforeEach(async () => {
      await dispatch(
        new SignInSuccess({
          ...authResponse(),
          user: { ...ada, levelPrompted: false },
        }),
      );
      await harness.navigateByUrl('/welcome?returnUrl=%2Fbook%2F3');
    });

    it('sets the chosen level', async () => {
      expect(button('Continue')?.getAttribute('disabled')).not.toBeNull();
      await chooseLevel(CefrLevel.B1);
      button('Continue')?.click();
      expect(books.setLevel).toHaveBeenCalledWith(CefrLevel.B1);
    });

    it('can be skipped', async () => {
      button('Skip')?.click();
      expect(books.setLevel).toHaveBeenCalledWith(null);
    });

    it('shows why setting the level failed', async () => {
      await dispatch(new SetLevelFail('Server error'));
      await ionicUpdates();
      expect(text(page()?.querySelector('[role=alert]'))).toBe('Server error');
    });

    it('continues to the requested page once the level is answered', async () => {
      await dispatch(new SetLevelSuccess(levelList));
      expect(TestBed.inject(Router).url).toBe('/book/3');
    });
  });

  describe('AccountPage', () => {
    beforeEach(async () => {
      await dispatch(new SignInSuccess(authResponse()));
      await harness.navigateByUrl('/account');
      await harness.fixture.whenStable();
    });

    it('loads the books, which hold the level list', () => {
      expect(books.loadBooks).toHaveBeenCalled();
    });

    it('adds words for a level', async () => {
      await chooseLevel(CefrLevel.A2);
      button('Add words')?.click();
      expect(books.setLevel).toHaveBeenCalledWith(CefrLevel.A2);
      expect(button('Remove level')).toBeUndefined();
    });

    it('changes the current level', async () => {
      await dispatch(new LoadBooksSuccess([levelList]));
      expect(text(page()?.querySelectorAll('ion-card-subtitle')[1])).toBe(
        'The words up to B1 are known in your dictionary.',
      );
      // The current level is selected; choose another to change it.
      expect(button('Change level')?.getAttribute('disabled')).not.toBeNull();
      await chooseLevel(CefrLevel.B2);
      button('Change level')?.click();
      expect(books.setLevel).toHaveBeenCalledWith(CefrLevel.B2);
    });

    it('removes the level after confirmation', async () => {
      await dispatch(new LoadBooksSuccess([levelList]));
      button('Remove level')?.click();
      await harness.fixture.whenStable();
      expect(alerts.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Remove your level?' }),
      );
      expect(books.setLevel).toHaveBeenCalledWith(null);
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
