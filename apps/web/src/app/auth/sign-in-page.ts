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
import { select } from '@ngxs/store';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';

@Component({
  selector: 'app-sign-in-page',
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
  templateUrl: './sign-in-page.html',
  styleUrl: './auth-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class SignInPage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);

  /** Where to go after signing in; bound from the query string. */
  readonly returnUrl = input<string>();

  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  private readonly signedIn = select(AuthState.isAuthenticated);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
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

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.auth.signIn({ email: email.trim(), password });
  }
}
