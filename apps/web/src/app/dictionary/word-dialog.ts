import { DecimalPipe } from '@angular/common';
import {
  Component,
  InjectionToken,
  Injector,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSpinner,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { WordStatus } from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { WordRef } from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import {
  NAME_KIND_LABELS,
  SET_ASIDE_STATUSES,
  WORD_STATUSES,
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
} from './word-status';

export interface WordDialogData {
  /** The word opened first. */
  word: WordRef;
  /** The list it was opened from, read live, for "Next". */
  list: () => readonly WordRef[];
}

export const WORD_DIALOG_DATA = new InjectionToken<WordDialogData>(
  'WORD_DIALOG_DATA',
);

let nextMenuId = 0;

/**
 * Details for the word opened with DictionaryService.openWord: its
 * dictionary article, usage per book and status actions.
 */
@Component({
  selector: 'app-word-dialog',
  imports: [
    DecimalPipe,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonSpinner,
    IonToolbar,
  ],
  templateUrl: './word-dialog.html',
  styleUrl: './word-dialog.scss',
})
export class WordDialog {
  private readonly dictionary = inject(DictionaryService);
  private readonly data = inject(WORD_DIALOG_DATA);
  private readonly modal = inject(ModalController);
  private readonly content = viewChild(IonContent);

  /** Opens the status menu; ids must be unique in the document. */
  protected readonly statusMenuId = `word-status-menu-${nextMenuId++}`;

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

  /**
   * "person, city" when the word is in the names list, whatever its status:
   * it helps decide whether to file a word under Name, and shows what a
   * Name word names when browsing the Name list.
   */
  protected readonly nameHint = computed(() => {
    const kinds = this.details()?.nameKinds ?? [];
    return kinds.length
      ? kinds.map((kind) => NAME_KIND_LABELS[kind]).join(', ')
      : null;
  });

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
      this.close();
    }
  }

  protected close(): void {
    this.modal.dismiss();
  }

  protected next(): void {
    const word = this.nextWord();
    if (!word) {
      return;
    }
    this.position.set(this.indexOf(word));
    this.dictionary.openWord(word);
    // Start the new word's article from the top.
    this.content()?.scrollToTop();
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

/**
 * Returns a function that opens the word dialog for a word of `list`,
 * loading its details, and clears them when the dialog closes. "Next" walks
 * through `list`. Call in an injection context (constructor or field
 * initializer).
 */
export function injectWordDialog(
  list: () => readonly WordRef[],
): (word: WordRef) => void {
  const modals = inject(ModalController);
  const dictionary = inject(DictionaryService);
  const injector = inject(Injector);
  return (word) => {
    dictionary.openWord(word);
    const data: WordDialogData = { word, list };
    void modals
      .create({
        component: WordDialog,
        cssClass: 'word-dialog',
        injector: Injector.create({
          providers: [{ provide: WORD_DIALOG_DATA, useValue: data }],
          parent: injector,
        }),
      })
      .then((modal) => {
        modal.onDidDismiss().then(() => dictionary.closeWord());
        return modal.present();
      });
  };
}
