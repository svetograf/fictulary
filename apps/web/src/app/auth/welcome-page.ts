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
import { BooksService } from '../books/books.service';
import { BooksState } from '../books/books.state';
import { LevelPicker } from '../books/level-picker';
import { safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { NameForm } from './name-form';

/**
 * Onboarding after the first sign-in: asks for a name when the provider sent
 * none, then for the user's English level.
 */
@Component({
  selector: 'app-welcome-page',
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    LevelPicker,
    NameForm,
  ],
  template: `
    <ion-content>
      <div class="page-content">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Welcome to Fictulary</ion-card-title>
            <ion-card-subtitle>
              @if (needsName()) {
                What should we call you?
              } @else {
                How good is your English?
              }
            </ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            @if (needsName()) {
              <app-name-form
                submitLabel="Continue"
                [submitting]="submitting()"
                [error]="error()"
                (save)="auth.updateProfile($event)"
              />
            } @else {
              <p class="intro">
                We'll add the words up to your level to your dictionary as
                known, so books show you only the words worth learning. You can
                change it later in Account.
              </p>
              <app-level-picker
                submitLabel="Continue"
                noneLabel="Skip"
                [saving]="levelSaving()"
                [error]="levelError()"
                (choose)="books.setLevel($event)"
              />
            }
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
  protected readonly books = inject(BooksService);
  private readonly nav = inject(NavController);

  /** Where to go once the name is set; bound from the query string. */
  readonly returnUrl = input<string>();

  protected readonly submitting = select(AuthState.submitting);
  protected readonly error = select(AuthState.error);
  protected readonly needsName = select(AuthState.needsName);
  protected readonly levelSaving = select(BooksState.levelSaving);
  protected readonly levelError = select(BooksState.levelError);
  private readonly user = select(AuthState.user);
  private readonly needsOnboarding = select(AuthState.needsOnboarding);

  constructor() {
    effect(() => {
      if (this.user() && !this.needsOnboarding()) {
        this.nav.navigateRoot(safeReturnUrl(this.returnUrl()));
      }
    });
  }

  ionViewWillEnter(): void {
    this.auth.clearError();
  }
}
