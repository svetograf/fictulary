import { Component, DestroyRef, inject } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonSpinner,
  NavController,
  ViewWillEnter,
} from '@ionic/angular';
import { Actions, ofActionDispatched, select } from '@ngxs/store';
import { filter } from 'rxjs';
import { injectConfirm } from '../shared/confirm-dialog';
import { injectToast } from '../shared/toast';
import { DeleteAccountFail, SignOut } from './auth.actions';
import { AuthService } from './auth.service';
import { AuthState } from './auth.state';
import { NameForm } from './name-form';

@Component({
  selector: 'app-account-page',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonSpinner,
    NameForm,
  ],
  templateUrl: './account-page.html',
  styleUrls: ['./auth-page.scss', './account-page.scss'],
  host: { class: 'ion-page' },
})
export class AccountPage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly confirm = injectConfirm();

  protected readonly user = select(AuthState.user);
  protected readonly submitting = select(AuthState.submitting);
  protected readonly deleting = select(AuthState.deleting);
  protected readonly error = select(AuthState.error);

  constructor() {
    const toast = injectToast();
    const subscriptions = [
      inject(Actions)
        .pipe(ofActionDispatched(DeleteAccountFail))
        .subscribe(({ error }: DeleteAccountFail) => toast(error)),
      // Deleting the account signs out.
      inject(Actions)
        .pipe(ofActionDispatched(SignOut))
        .subscribe(() => this.nav.navigateRoot('/')),
    ];
    inject(DestroyRef).onDestroy(() =>
      subscriptions.forEach((subscription) => subscription.unsubscribe()),
    );
  }

  ionViewWillEnter(): void {
    this.auth.clearError();
  }

  protected deleteAccount(): void {
    this.confirm({
      title: 'Delete your account?',
      message:
        'Your books, dictionary and word statuses are deleted for good, ' +
        'and Fictulary loses access to your Apple or Google sign-in. ' +
        'This cannot be undone.',
      confirm: 'Delete account',
    })
      .pipe(filter(Boolean))
      .subscribe(() => this.auth.deleteAccount());
  }
}
