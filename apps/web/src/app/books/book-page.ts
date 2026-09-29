import {
  Component,
  effect,
  inject,
  input,
  numberAttribute,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { select } from '@ngxs/store';
import { BookDetailsCard } from './book-details-card';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

@Component({
  selector: 'app-book-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BookDetailsCard,
  ],
  templateUrl: './book-page.html',
  styleUrl: './book-page.scss',
})
export class BookPage {
  private readonly booksService = inject(BooksService);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly book = select(BooksState.currentBook);
  protected readonly loading = select(BooksState.currentBookLoading);
  protected readonly error = select(BooksState.currentBookError);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.booksService.loadBook(id));
    });
  }

  protected retry(): void {
    this.booksService.loadBook(this.id());
  }
}
