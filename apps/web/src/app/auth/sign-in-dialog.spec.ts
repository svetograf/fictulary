import { Component, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController, NavController } from '@ionic/angular';
import { Store, provideStore } from '@ngxs/store';
import {
  ionicUpdates,
  shownErrors,
  text,
  typeInto,
} from '../shared/ionic-testing';
import { SignInFail, SignInSuccess } from './auth.actions';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import {
  SIGN_IN_DIALOG_DATA,
  SignInDialog,
  SignInDialogData,
  injectSignInDialog,
} from './sign-in-dialog';
import { SocialLoginService } from './social-login.service';
import { ada, authResponse } from './testing';

describe('SignInDialog', () => {
  const auth = {
    signInWithGoogle: vi.fn(),
    signInWithApple: vi.fn(),
    devSignIn: vi.fn(),
    clearError: vi.fn(),
  };
  const social = { prepare: vi.fn(), providers: vi.fn() };
  const modals = { dismiss: vi.fn(), create: vi.fn() };
  const nav = { navigateRoot: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    social.providers.mockResolvedValue({
      apple: { servicesId: 'web', redirectUri: 'https://x/auth/callback' },
      devSignIn: false,
    });
    modals.dismiss.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideStore([AuthState]),
        { provide: AuthService, useValue: auth },
        { provide: SocialLoginService, useValue: social },
        { provide: ModalController, useValue: modals },
        { provide: NavController, useValue: nav },
      ],
    });
  });

  const render = async (data: Partial<SignInDialogData> = {}) => {
    TestBed.overrideProvider(SIGN_IN_DIALOG_DATA, {
      useValue: { mode: 'sign-in', ...data },
    });
    const fixture = TestBed.createComponent(SignInDialog);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLElement>('ion-button')].find((b) =>
        text(b)?.includes(label),
      );
    const dispatch = async (action: object) => {
      TestBed.inject(Store).dispatch(action);
      await fixture.whenStable();
    };
    const submit = async () => {
      element.querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { element, button, dispatch, submit };
  };

  it('prepares the providers, clears old errors and signs in with each', async () => {
    const { button } = await render();
    expect(social.prepare).toHaveBeenCalled();
    expect(auth.clearError).toHaveBeenCalled();

    button('Continue with Apple')?.click();
    button('Continue with Google')?.click();
    expect(auth.signInWithApple).toHaveBeenCalled();
    expect(auth.signInWithGoogle).toHaveBeenCalled();
  });

  it('is titled for signing in', async () => {
    const { element } = await render();
    expect(text(element.querySelector('.title'))).toBe('Sign in');
  });

  it('is titled "Create your account" for signing up', async () => {
    const { element } = await render({ mode: 'sign-up' });
    expect(text(element.querySelector('.title'))).toBe('Create your account');
  });

  it('names Apple in the sign-up intro only when Apple is on', async () => {
    const withApple = await render({ mode: 'sign-up' });
    expect(text(withApple.element.querySelector('.intro'))).toContain(
      'Continue with Apple or Google;',
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideStore([AuthState]),
        { provide: AuthService, useValue: auth },
        { provide: SocialLoginService, useValue: social },
        { provide: ModalController, useValue: modals },
        { provide: NavController, useValue: nav },
      ],
    });
    social.providers.mockResolvedValue({ apple: null, devSignIn: false });
    const googleOnly = await render({ mode: 'sign-up' });
    expect(text(googleOnly.element.querySelector('.intro'))).toContain(
      'Continue with Google;',
    );
  });

  it('closes on the close button', async () => {
    const { element } = await render();
    element.querySelector<HTMLElement>('ion-buttons ion-button')?.click();
    expect(modals.dismiss).toHaveBeenCalled();
  });

  it('hides Apple when the API has no Apple config', async () => {
    social.providers.mockResolvedValue({ apple: null, devSignIn: false });
    const { button } = await render();
    expect(button('Continue with Apple')).toBeUndefined();
    expect(button('Continue with Google')).toBeDefined();
  });

  it('keeps Google when the provider config fails to load', async () => {
    social.providers.mockRejectedValue(new Error('offline'));
    const { button } = await render();
    expect(button('Continue with Apple')).toBeUndefined();
    expect(button('Continue with Google')).toBeDefined();
  });

  it('shows sign-in errors', async () => {
    const { element, dispatch } = await render();
    await dispatch(new SignInFail('Invalid Google sign-in'));
    expect(text(element.querySelector('p.error[role=alert]'))).toBe(
      'Invalid Google sign-in',
    );
  });

  it('hides the dev form unless the API enables it', async () => {
    const { element } = await render();
    expect(element.querySelector('form.dev')).toBeNull();
  });

  it('signs in through the dev form when enabled', async () => {
    social.providers.mockResolvedValue({ apple: null, devSignIn: true });
    const { element, submit } = await render();
    typeInto(
      element.querySelector('ion-input[formcontrolname=email]'),
      ' dev@example.com ',
    );
    await submit();
    expect(auth.devSignIn).toHaveBeenCalledWith({
      email: 'dev@example.com',
      name: undefined,
    });
  });

  it('validates the dev form', async () => {
    social.providers.mockResolvedValue({ apple: null, devSignIn: true });
    const { element, submit } = await render();
    typeInto(
      element.querySelector('ion-input[formcontrolname=email]'),
      'not-an-email',
    );
    await submit();
    expect(auth.devSignIn).not.toHaveBeenCalled();
    await ionicUpdates();
    expect(shownErrors(element)).toEqual(['Enter a valid email address.']);
  });

  it('closes and returns to the requested page after signing in', async () => {
    const { dispatch } = await render({ returnUrl: '/book/3' });
    await dispatch(new SignInSuccess(authResponse()));
    expect(modals.dismiss).toHaveBeenCalled();
    expect(nav.navigateRoot).toHaveBeenCalledWith('/book/3');
  });

  it('asks new users without a name for one first', async () => {
    const { dispatch } = await render({ returnUrl: '/book/3' });
    await dispatch(
      new SignInSuccess({ ...authResponse(), user: { ...ada, name: null } }),
    );
    expect(nav.navigateRoot).toHaveBeenCalledWith(['/welcome'], {
      queryParams: { returnUrl: '/book/3' },
    });
  });

  it('ignores return URLs pointing to other sites', async () => {
    const { dispatch } = await render({ returnUrl: '//evil.example' });
    await dispatch(new SignInSuccess(authResponse()));
    expect(nav.navigateRoot).toHaveBeenCalledWith('/');
  });
});

describe('injectSignInDialog', () => {
  const present = vi.fn();
  const modals = { create: vi.fn(async () => ({ present })) };

  @Component({ template: '' })
  class Host {
    readonly open = injectSignInDialog();
  }

  const open = async (wide: boolean) => {
    vi.stubGlobal('matchMedia', () => ({ matches: wide }));
    TestBed.configureTestingModule({
      providers: [{ provide: ModalController, useValue: modals }],
    });
    TestBed.createComponent(Host).componentInstance.open({
      mode: 'sign-up',
      returnUrl: '/upload',
    });
    await new Promise((resolve) => setTimeout(resolve));
    const [options] = modals.create.mock.calls.at(-1) as unknown as [
      { cssClass: string; breakpoints?: number[]; injector: Injector },
    ];
    return options;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('opens a centered dialog on wide screens, with the data', async () => {
    const options = await open(true);
    expect(options.cssClass).toBe('sign-in-dialog');
    expect(options.breakpoints).toBeUndefined();
    expect(options.injector.get(SIGN_IN_DIALOG_DATA)).toEqual({
      mode: 'sign-up',
      returnUrl: '/upload',
    });
    expect(present).toHaveBeenCalled();
  });

  it('opens a bottom sheet on phones', async () => {
    const options = await open(false);
    expect(options.cssClass).toBe('sign-in-sheet');
    expect(options.breakpoints).toEqual([0, 1]);
  });
});
