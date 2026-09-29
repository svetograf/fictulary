import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { BookDetails } from '@fictulary/shared/models';
import { BOOK_STATUS_ICONS, BOOK_STATUS_LABELS } from './book-status';

/** A book's details with a table of its most frequent words. */
@Component({
  selector: 'app-book-details-card',
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatIconModule,
    MatTableModule,
  ],
  templateUrl: './book-details-card.html',
  styleUrl: './book-details-card.scss',
})
export class BookDetailsCard {
  readonly book = input.required<BookDetails>();

  protected readonly statusLabels = BOOK_STATUS_LABELS;
  protected readonly statusIcons = BOOK_STATUS_ICONS;
  protected readonly wordColumns = ['rank', 'word', 'count'];
  protected readonly maxWordCount = computed(
    () => this.book().words[0]?.count ?? 1,
  );
}
