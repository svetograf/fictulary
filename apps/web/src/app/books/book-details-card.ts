import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BookDetails, WordCount, WordStatus } from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DictionaryState } from '../dictionary/dictionary.state';
import { notifyWordStatusErrors } from '../dictionary/status-errors';
import { injectWordDialog } from '../dictionary/word-dialog';
import {
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
} from '../dictionary/word-status';

/** A book's details with its most frequent words still to learn. */
@Component({
  selector: 'app-book-details-card',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './book-details-card.html',
  styleUrl: './book-details-card.scss',
})
export class BookDetailsCard {
  private readonly dictionary = inject(DictionaryService);

  readonly book = input.required<BookDetails>();

  protected readonly wordColumns = [
    'rank',
    'word',
    'status',
    'count',
    'actions',
  ];
  protected readonly pending = select(DictionaryState.pendingWordIds);
  /** The same word dialog as on My dictionary. */
  protected readonly openWord = injectWordDialog();
  protected readonly known = WordStatus.KNOWN;
  protected readonly learning = WordStatus.LEARNING;
  // Table rows are untyped in the template, hence functions over lookups.
  protected readonly statusLabel = (status: WordStatus) =>
    WORD_STATUS_LABELS[status];
  protected readonly statusIcon = (status: WordStatus) =>
    WORD_STATUS_ICONS[status];
  protected readonly maxWordCount = computed(
    () => this.book().words[0]?.count ?? 1,
  );

  constructor() {
    notifyWordStatusErrors();
  }

  protected move(word: WordCount, status: WordStatus): void {
    this.dictionary.changeStatus(word.wordId, status);
  }
}
