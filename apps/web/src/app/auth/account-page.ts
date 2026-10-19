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
import { CefrLevel } from '@fictulary/shared/models';
import { Actions, ofActionDispatched, select } from '@ngxs/store';
import { filter } from 'rxjs';
import { BooksService } from '../books/books.service';
import { BooksState } from '../books/books.state';
import { LevelPicker } from '../books/level-picker';
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
    LevelPicker,
    NameForm,
  ],
  templateUrl: './account-page.html',
  styleUrls: ['./auth-page.scss', './account-page.scss'],
  host: { class: 'ion-page' },
})
export class AccountPage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  private readonly books = inject(BooksService);
  private readonly nav = inject(NavController);
  private readonly confirm = injectConfirm();

  protected readonly user = select(AuthState.user);
  protected readonly submitting = select(AuthState.submitting);
  protected readonly deleting = select(AuthState.deleting);
  protected readonly error = select(AuthState.error);
  protected readonly level = select(BooksState.level);
  protected readonly levelSaving = select(BooksState.levelSaving);
  protected readonly levelError = select(BooksState.levelError);

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
    // The level is the user's word list, one of their books.
    this.books.loadBooks();
  }

  /** Ionic keeps this page alive under the pages opened from it. */
  private visited = false;

  ionViewWillEnter(): void {
    this.auth.clearError();
    if (this.visited) {
      this.books.loadBooks();
    }
    this.visited = true;
  }

  protected chooseLevel(level: CefrLevel | null): void {
    if (level) {
      this.books.setLevel(level);
      return;
    }
    this.confirm({
      title: 'Remove your level?',
      message:
        'Its words that are in none of your books leave your dictionary, ' +
        'together with their status. This cannot be undone.',
      confirm: 'Remove',
    })
      .pipe(filter(Boolean))
      .subscribe(() => this.books.setLevel(null));
  }

  protected deleteAccount(): void {
    this.confirm({
      title: 'Delete your account?',
      message:
        'Your books, dictionary and word statuses are deleted for good, ' +
        'and Fictulary loses access to the account you signed in with. ' +
        'This cannot be undone.',
      confirm: 'Delete account',
    })
      .pipe(filter(Boolean))
      .subscribe(() => this.auth.deleteAccount());
  }
}
