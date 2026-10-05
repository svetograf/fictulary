import { DecimalPipe } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WordCount, WordStatus } from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DictionaryState } from '../dictionary/dictionary.state';
import { notifyWordStatusErrors } from '../dictionary/status-errors';
import { injectWordDialog } from '../dictionary/word-dialog';
import {
  RESTORE_STATUS,
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
} from '../dictionary/word-status';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

/**
 * Step 2 of the upload wizard: the words of the new book that are names,
 * to check before moving on. Restored rows stay in the list as Unknown, so
 * a mistake can be undone.
 */
@Component({
  selector: 'app-names-review',
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './names-review.html',
  styleUrl: './names-review.scss',
})
export class NamesReview {
  private readonly books = inject(BooksService);
  private readonly dictionary = inject(DictionaryService);

  /** "Continue" was pressed. */
  readonly continue = output<void>();

  protected readonly book = select(BooksState.uploadedBook);
  protected readonly names = select(BooksState.reviewNames);
  protected readonly loading = select(BooksState.reviewLoading);
  protected readonly error = select(BooksState.reviewError);
  protected readonly pending = select(DictionaryState.pendingWordIds);

  protected readonly labels = WORD_STATUS_LABELS;
  protected readonly icons = WORD_STATUS_ICONS;
  /** Opens the word dialog; "Next" walks through these names. */
  protected readonly open = injectWordDialog(() => this.names());

  constructor() {
    notifyWordStatusErrors();
  }

  /**
   * One action per row: "Restore" a name the book was wrongly taken for,
   * or "Name" to undo that.
   */
  protected actionFor(word: WordCount) {
    return word.status === WordStatus.NAME
      ? { status: RESTORE_STATUS, label: 'Restore', icon: 'undo' }
      : {
          status: WordStatus.NAME,
          label: 'Name',
          icon: WORD_STATUS_ICONS[WordStatus.NAME],
        };
  }

  protected move(word: WordCount, status: WordStatus): void {
    this.dictionary.changeStatus(word.wordId, status);
  }

  protected retry(): void {
    const book = this.book();
    if (book) {
      this.books.loadBookNames(book.id);
    }
  }
}
