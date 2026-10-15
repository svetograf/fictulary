import { Component, effect, inject, input } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  NavController,
  ViewWillEnter,
} from '@ionic/angular';
import { select } from '@ngxs/store';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { NameForm } from './name-form';

/** Asks for a name after the first sign-in, when the provider sent none. */
@Component({
  selector: 'app-welcome-page',
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    NameForm,
  ],
  template: `
    <ion-content>
      <div class="page-content">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Welcome to Fictulary</ion-card-title>
            <ion-card-subtitle>What should we call you?</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <app-name-form
              submitLabel="Continue"
              [submitting]="submitting()"
              [error]="error()"
              (save)="auth.updateProfile($event)"
            />
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  `,
  styleUrl: './auth-page.scss',
  host: { class: 'ion-page' },
})
export class WelcomePage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);

  /** Where to go once the name is set; bound from the query string. */
  readonly returnUrl = input<string>();

  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  private readonly user = select(AuthState.user);

  constructor() {
    effect(() => {
      if (this.user()?.name) {
        this.nav.navigateRoot(safeReturnUrl(this.returnUrl()));
      }
    });
  }

  ionViewWillEnter(): void {
    this.auth.clearError();
  }
}
