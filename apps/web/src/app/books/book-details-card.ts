import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BookDetails, WordCount, WordStatus } from '@fictulary/shared/models';
import { BooksStateModel } from './books.state';
import { select } from '@ngxs/store';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DictionaryState } from '../dictionary/dictionary.state';
import { notifyWordStatusErrors } from '../dictionary/status-errors';
import { injectWordDialog } from '../dictionary/word-dialog';
import {
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
} from '../dictionary/word-status';

/** Page sizes for a book's words to learn; the book carries 100. */
export const BOOK_WORD_PAGE_SIZES = [25, 50, 100];

/** A book's details with its words still to learn, a page at a time. */
@Component({
  selector: 'app-book-details-card',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './book-details-card.html',
  styleUrl: './book-details-card.scss',
})
export class BookDetailsCard {
  private readonly dictionary = inject(DictionaryService);

  readonly book = input.required<BookDetails>();
  /** The shown page of the book's words to learn. */
  readonly words = input.required<BooksStateModel['current']['words']>();
  /** The user picked another page or page size. */
  readonly pageChange = output<PageEvent>();

  protected readonly pageSizes = BOOK_WORD_PAGE_SIZES;

  protected readonly wordColumns = [
    'rank',
    'word',
    'status',
    'count',
    'actions',
  ];
  protected readonly pending = select(DictionaryState.pendingWordIds);
  /** The same word dialog as on My dictionary; "Next" walks this page. */
  protected readonly openWord = injectWordDialog(() => this.words().items);
  protected readonly known = WordStatus.KNOWN;
  protected readonly learning = WordStatus.LEARNING;
  // Table rows are untyped in the template, hence functions over lookups.
  protected readonly statusLabel = (status: WordStatus) =>
    WORD_STATUS_LABELS[status];
  protected readonly statusIcon = (status: WordStatus) =>
    WORD_STATUS_ICONS[status];
  /** Bars scale to the book's most used word, so pages compare. */
  protected readonly maxWordCount = computed(
    () => this.book().words[0]?.count ?? this.words().items[0]?.count ?? 1,
  );

  protected rank(index: number): number {
    const { page, pageSize } = this.words();
    return (page - 1) * pageSize + index + 1;
  }

  constructor() {
    notifyWordStatusErrors();
  }

  protected move(word: WordCount, status: WordStatus): void {
    this.dictionary.changeStatus(word.wordId, status);
  }
}
