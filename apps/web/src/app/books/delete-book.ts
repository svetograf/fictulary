import { DestroyRef, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BookSummary } from '@fictulary/shared/models';
import { Actions, ofActionDispatched } from '@ngxs/store';
import { filter } from 'rxjs';
import { injectConfirm } from '../shared/confirm-dialog';
import { DeleteBookFail } from './books.actions';
import { BooksService } from './books.service';

/**
 * Returns a function that asks to confirm deleting a book, then deletes
 * it. Failures are shown as notifications while the caller lives. Call in
 * an injection context.
 */
export function injectDeleteBook(): (
  book: Pick<BookSummary, 'id' | 'name'>,
) => void {
  const books = inject(BooksService);
  const confirm = injectConfirm();
  const snackBar = inject(MatSnackBar);
  const subscription = inject(Actions)
    .pipe(ofActionDispatched(DeleteBookFail))
    .subscribe(({ error }: DeleteBookFail) =>
      snackBar.open(error, 'Dismiss', { duration: 5000 }),
    );
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());

  return (book) =>
    confirm({
      title: `Delete “${book.name}”?`,
      message:
        'Words that are in none of your other books leave your dictionary, ' +
        'together with their status. This cannot be undone.',
      confirm: 'Delete',
    })
      .pipe(filter(Boolean))
      .subscribe(() => books.deleteBook(book.id));
}
