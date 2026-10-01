import { DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { WordStatus } from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { WordRef } from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import {
  SET_ASIDE_STATUSES,
  WORD_STATUSES,
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
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
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './word-dialog.html',
  styleUrl: './word-dialog.scss',
})
export class WordDialog {
  private readonly dictionary = inject(DictionaryService);
  private readonly data: WordDialogData = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<WordDialog>);
  private readonly content = viewChild(MatDialogContent, { read: ElementRef });

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
  protected readonly statuses = WORD_STATUSES;
  protected readonly setAside = SET_ASIDE_STATUSES;
  protected readonly learning = WordStatus.LEARNING;

  /** Where the open word is (or was) in the list it was opened from. */
  private readonly position = signal(this.indexOf(this.data.word));

  /** The word after the open one, if the list has one. */
  protected readonly nextWord = computed(() => {
    const list = this.data.list();
    const current = this.word();
    const index = current ? this.indexOf(current) : -1;
    // Viewing can move the word out of a filtered list (Unknown becomes
    // Learning); its successor then sits at the position it had.
    return list[index >= 0 ? index + 1 : this.position()] ?? null;
  });

  /**
   * Changes the word's status from the dropdown. The dialog stays open, so
   * the user can carry on with "Next".
   */
  protected setStatus(word: WordRef, status: WordStatus): void {
    if (status !== word.status) {
      this.dictionary.changeStatus(word.wordId, status);
    }
  }

  /**
   * "I know!" for a word being learned: marks it known and moves on, or
   * closes the dialog on the last word of the list.
   */
  protected markKnownAndNext(word: WordRef): void {
    // Pick the next word before the change can drop this one from the list.
    const hasNext = !!this.nextWord();
    this.dictionary.changeStatus(word.wordId, WordStatus.KNOWN);
    if (hasNext) {
      this.next();
    } else {
      this.dialogRef.close();
    }
  }

  protected next(): void {
    const word = this.nextWord();
    if (!word) {
      return;
    }
    this.position.set(this.indexOf(word));
    this.dictionary.openWord(word);
    // Start the new word's article from the top.
    const content = this.content()?.nativeElement;
    if (content) {
      content.scrollTop = 0;
    }
  }

  protected retryDetails(wordId: string): void {
    this.dictionary.retryDetails(wordId);
  }

  protected retryDefinition(word: string): void {
    this.dictionary.retryDefinition(word);
  }

  private indexOf(word: WordRef): number {
    return this.data.list().findIndex((w) => w.wordId === word.wordId);
  }
}

export interface WordDialogData {
  /** The word opened first. */
  word: WordRef;
  /** The list it was opened from, read live, for "Next". */
  list: () => readonly WordRef[];
}

/**
 * Returns a function that opens the word dialog for a word of `list`,
 * loading its details, and clears them when the dialog closes. "Next" walks
 * through `list`. Call in an injection context (constructor or field
 * initializer).
 */
export function injectWordDialog(
  list: () => readonly WordRef[],
): (word: WordRef) => void {
  const dialog = inject(MatDialog);
  const dictionary = inject(DictionaryService);
  return (word) => {
    dictionary.openWord(word);
    const data: WordDialogData = { word, list };
    dialog
      .open(WordDialog, {
        data,
        width: '640px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .subscribe(() => dictionary.closeWord());
  };
}
