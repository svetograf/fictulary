import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { select } from '@ngxs/store';
import { AuthState } from '../auth/auth.state';
import { BOOK_STATUS_ICONS, BOOK_STATUS_LABELS } from './book-status';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

@Component({
  selector: 'app-book-list-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
  ],
  templateUrl: './book-list-page.html',
  styleUrl: './book-list-page.scss',
})
export class BookListPage {
  protected readonly booksService = inject(BooksService);

  protected readonly signedIn = select(AuthState.isAuthenticated);
  protected readonly books = select(BooksState.books);
  protected readonly loading = select(BooksState.booksLoading);
  protected readonly error = select(BooksState.booksError);

  protected readonly statusLabels = BOOK_STATUS_LABELS;
  protected readonly statusIcons = BOOK_STATUS_ICONS;

  constructor() {
    // The API requires signing in; load once a session exists.
    effect(() => {
      if (this.signedIn()) {
        untracked(() => this.booksService.loadBooks());
      }
    });
  }
}
