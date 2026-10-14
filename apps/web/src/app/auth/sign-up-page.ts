import { Component, effect, inject, input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonSpinner,
  NavController,
  ViewWillEnter,
} from '@ionic/angular';
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
} from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { notBlank } from '../shared/validators';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';

@Component({
  selector: 'app-sign-up-page',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './sign-up-page.html',
  styleUrl: './auth-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class SignUpPage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);

  /** Where to go after signing up; bound from the query string. */
  readonly returnUrl = input<string>();

  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  private readonly signedIn = select(AuthState.isAuthenticated);

  protected readonly limits = {
    name: USER_NAME_MAX_LENGTH,
    passwordMin: USER_PASSWORD_MIN_LENGTH,
    passwordMax: USER_PASSWORD_MAX_LENGTH,
  };

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        notBlank,
        Validators.maxLength(USER_NAME_MAX_LENGTH),
      ],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
        Validators.maxLength(USER_EMAIL_MAX_LENGTH),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(USER_PASSWORD_MIN_LENGTH),
        Validators.maxLength(USER_PASSWORD_MAX_LENGTH),
      ],
    }),
  });
  protected readonly controls = this.form.controls;

  constructor() {
    effect(() => {
      if (this.signedIn()) {
        // As the root, so Back doesn't return to this form.
        this.nav.navigateRoot(safeReturnUrl(this.returnUrl()));
      }
    });
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  // Also when coming back from the other auth page, which Ionic keeps alive.
  ionViewWillEnter(): void {
    this.auth.clearError();
  }

  protected passwordError(): string {
    const { password } = this.controls;
    if (password.hasError('minlength')) {
      return `Password must be at least ${this.limits.passwordMin} characters.`;
    }
    if (password.hasError('maxlength')) {
      return `Password must be at most ${this.limits.passwordMax} characters.`;
    }
    return 'Password is required.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, password } = this.form.getRawValue();
    this.auth.signUp({ name: name.trim(), email: email.trim(), password });
  }
}
