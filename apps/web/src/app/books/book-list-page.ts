import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { select } from '@ngxs/store';
import { AuthState } from '../auth/auth.state';
import { BooksService } from './books.service';
import { injectDeleteBook } from './delete-book';
import { BooksState } from './books.state';

@Component({
  selector: 'app-book-list-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './book-list-page.html',
  styleUrl: './book-list-page.scss',
})
export class BookListPage {
  protected readonly booksService = inject(BooksService);

  protected readonly signedIn = select(AuthState.isAuthenticated);
  protected readonly books = select(BooksState.books);
  protected readonly deleting = select(BooksState.deletingIds);
  protected readonly deleteBook = injectDeleteBook();
  protected readonly loading = select(BooksState.booksLoading);
  protected readonly error = select(BooksState.booksError);

  constructor() {
    // The API requires signing in; load once a session exists.
    effect(() => {
      if (this.signedIn()) {
        untracked(() => this.booksService.loadBooks());
      }
    });
  }
}
