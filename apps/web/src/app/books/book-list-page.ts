import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonProgressBar,
  IonRouterLink,
  ViewWillEnter,
} from '@ionic/angular';
import { select } from '@ngxs/store';
import { AuthState } from '../auth/auth.state';
import { Landing } from '../home/landing';
import { BooksService } from './books.service';
import { injectDeleteBook } from './delete-book';
import { BooksState } from './books.state';

@Component({
  selector: 'app-book-list-page',
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonProgressBar,
    IonRouterLink,
    DatePipe,
    DecimalPipe,
    Landing,
    RouterLink,
  ],
  templateUrl: './book-list-page.html',
  styleUrl: './book-list-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class BookListPage implements ViewWillEnter {
  protected readonly booksService = inject(BooksService);

  /** From the query string: a page that needed a session (see authGuard). */
  readonly returnUrl = input<string>();

  protected readonly signedIn = select(AuthState.isAuthenticated);
  protected readonly books = select(BooksState.books);
  protected readonly deleting = select(BooksState.deletingIds);
  protected readonly deleteBook = injectDeleteBook();
  protected readonly loading = select(BooksState.booksLoading);
  protected readonly error = select(BooksState.booksError);

  /** Ionic keeps this page alive under the pages opened from it. */
  private visited = false;

  constructor() {
    // The API requires signing in; load once a session exists.
    effect(() => {
      if (this.signedIn()) {
        untracked(() => this.booksService.loadBooks());
      }
    });
  }

  /** Back from another page: refresh, as a newly opened page would. */
  ionViewWillEnter(): void {
    if (this.visited && this.signedIn()) {
      this.booksService.loadBooks();
    }
    this.visited = true;
  }
}
