import {
  Component,
  computed,
  effect,
  inject,
  input,
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
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonSpinner,
  NavController,
  ViewWillEnter,
} from '@ionic/angular';
import { select } from '@ngxs/store';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { SocialLoginService } from './social-login.service';

@Component({
  selector: 'app-sign-in-page',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonInput,
    IonSpinner,
    ReactiveFormsModule,
  ],
  templateUrl: './sign-in-page.html',
  styleUrls: ['./auth-page.scss', './sign-in-page.scss'],
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class SignInPage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly social = inject(SocialLoginService);

  /** Where to go after signing in; bound from the query string. */
  readonly returnUrl = input<string>();

  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  private readonly signedIn = select(AuthState.isAuthenticated);
  private readonly needsName = select(AuthState.needsName);

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
    this.social.prepare();
    effect(() => {
      if (!this.signedIn()) {
        return;
      }
      const returnUrl = safeReturnUrl(this.returnUrl());
      // As the root, so Back doesn't return to this page.
      if (this.needsName()) {
        this.nav.navigateRoot(['/welcome'], { queryParams: { returnUrl } });
      } else {
        this.nav.navigateRoot(returnUrl);
      }
    });
  }

  // Ionic keeps this page alive, so a stale error could still be showing.
  ionViewWillEnter(): void {
    this.auth.clearError();
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
