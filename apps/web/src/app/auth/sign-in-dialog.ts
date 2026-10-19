import {
  Component,
  InjectionToken,
  Injector,
  computed,
  effect,
  inject,
  resource,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonToolbar,
  ModalController,
  NavController,
} from '@ionic/angular';
import { select } from '@ngxs/store';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { SocialLoginService } from './social-login.service';

export interface SignInDialogData {
  /** `sign-up` retitles the dialog; signing up is signing in. */
  mode: 'sign-in' | 'sign-up';
  /** Where to go after signing in. */
  returnUrl?: string;
}

export const SIGN_IN_DIALOG_DATA = new InjectionToken<SignInDialogData>(
  'SIGN_IN_DIALOG_DATA',
);

/** Matches the word dialog: a centered dialog from here, a sheet below. */
const DESKTOP = '(min-width: 768px) and (min-height: 600px)';

@Component({
  selector: 'app-sign-in-dialog',
  imports: [
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonInput,
    IonSpinner,
    IonToolbar,
    ReactiveFormsModule,
  ],
  templateUrl: './sign-in-dialog.html',
  styleUrl: './sign-in-dialog.scss',
})
export class SignInDialog {
  protected readonly auth = inject(AuthService);
  private readonly data = inject(SIGN_IN_DIALOG_DATA);
  private readonly modals = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly social = inject(SocialLoginService);

  protected readonly signingUp = this.data.mode === 'sign-up';
  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  private readonly signedIn = select(AuthState.isAuthenticated);
  private readonly needsOnboarding = select(AuthState.needsOnboarding);

  /**
   * Which optional sign-ins the API offers: Apple (when configured) and dev
   * sign-in (local development only). Google is always there.
   */
  private readonly providers = resource({
    // A failed request just leaves the optional ones hidden.
    loader: () => this.social.providers().catch(() => null),
  });
  protected readonly appleEnabled = computed(
    () => !!this.providers.value()?.apple,
  );
  protected readonly devSignIn = computed(
    () => !!this.providers.value()?.devSignIn,
  );

  protected readonly devForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    name: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    // An error from an earlier attempt would otherwise still be showing.
    this.auth.clearError();
    this.social.prepare();
    effect(() => {
      if (!this.signedIn()) {
        return;
      }
      const returnUrl = safeReturnUrl(this.data.returnUrl);
      void this.modals.dismiss();
      // Right away, as the root, so Back doesn't return to the landing page.
      // Navigating only once the dialog has faded out would let App's own
      // onboarding redirect (for restored sessions) go first, with the wrong
      // return URL; this later navigation replaces that one.
      if (this.needsOnboarding()) {
        this.nav.navigateRoot(['/welcome'], { queryParams: { returnUrl } });
      } else {
        this.nav.navigateRoot(returnUrl);
      }
    });
  }

  protected close(): void {
    void this.modals.dismiss();
  }

  protected submitDev(): void {
    if (this.devForm.invalid) {
      this.devForm.markAllAsTouched();
      return;
    }
    const { email, name } = this.devForm.getRawValue();
    this.auth.devSignIn({
      email: email.trim(),
      name: name.trim() || undefined,
    });
  }
}

/**
 * Returns a function that opens the sign-in dialog: centered on wide
 * screens, a bottom sheet on phones. Call in an injection context
 * (constructor or field initializer).
 */
export function injectSignInDialog(): (data: SignInDialogData) => void {
  const modals = inject(ModalController);
  const injector = inject(Injector);
  return (data) => {
    const desktop = matchMedia(DESKTOP).matches;
    void modals
      .create({
        component: SignInDialog,
        cssClass: desktop ? 'form-dialog' : 'form-sheet',
        ...(!desktop && { breakpoints: [0, 1], initialBreakpoint: 1 }),
        injector: Injector.create({
          providers: [{ provide: SIGN_IN_DIALOG_DATA, useValue: data }],
          parent: injector,
        }),
      })
      .then((modal) => modal.present());
  };
}
