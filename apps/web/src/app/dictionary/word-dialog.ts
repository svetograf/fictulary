import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { WordStatus } from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { WordRef } from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import {
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
  otherStatuses,
} from './word-status';

/**
 * Details for the word opened with DictionaryService.openWord: its
 * dictionary article, usage per book and status actions.
 */
@Component({
  selector: 'app-word-dialog',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './word-dialog.html',
  styleUrl: './word-dialog.scss',
})
export class WordDialog {
  private readonly dictionary = inject(DictionaryService);
  protected readonly dialogRef = inject(MatDialogRef<WordDialog>);

  protected readonly word = select(DictionaryState.currentWord);
  protected readonly details = select(DictionaryState.wordDetails);
  protected readonly detailsLoading = select(
    DictionaryState.wordDetailsLoading,
  );
  protected readonly detailsError = select(DictionaryState.wordDetailsError);
  protected readonly definition = select(DictionaryState.definition);
  protected readonly definitionLoading = select(
    DictionaryState.definitionLoading,
  );
  protected readonly definitionError = select(DictionaryState.definitionError);
  protected readonly pending = select(DictionaryState.pendingWordIds);

  protected readonly labels = WORD_STATUS_LABELS;
  protected readonly icons = WORD_STATUS_ICONS;
  protected readonly otherStatuses = otherStatuses;

  /**
   * Changes the word's status. That ends the lookup, so the dialog closes;
   * the list updates in the background.
   */
  protected move(wordId: string, status: WordStatus): void {
    this.dictionary.changeStatus(wordId, status);
    this.dialogRef.close();
  }

  protected retryDetails(wordId: string): void {
    this.dictionary.retryDetails(wordId);
  }

  protected retryDefinition(word: string): void {
    this.dictionary.retryDefinition(word);
  }
}

/**
 * Returns a function that opens the word dialog for a word, loading its
 * details, and clears them when the dialog closes. Call in an injection
 * context (constructor or field initializer).
 */
export function injectWordDialog(): (word: WordRef) => void {
  const dialog = inject(MatDialog);
  const dictionary = inject(DictionaryService);
  return (word) => {
    dictionary.openWord(word);
    dialog
      .open(WordDialog, {
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe(() => dictionary.closeWord());
  };
}
