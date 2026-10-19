import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonProgressBar,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonToggle,
  SegmentValue,
  ViewWillEnter,
} from '@ionic/angular';
import {
  DICTIONARY_DEFAULT_PAGE_SIZE,
  DictionaryWord,
  WordStatus,
} from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { PageChange, Paginator } from '../shared/paginator';
import { DictionaryQuery } from './dictionary.actions';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import { notifyWordStatusErrors } from './status-errors';
import { injectWordDialog } from './word-dialog';
import {
  RESTORE_STATUS,
  WORD_STATUSES,
  WORD_STATUS_ICONS,
  WORD_STATUS_LABELS,
  otherStatuses,
} from './word-status';

export const PAGE_SIZES = [25, 50, 100];

/** Row button labels: what the user says about the word. */
const MOVE_LABELS: Record<WordStatus, string> = {
  [WordStatus.KNOWN]: 'I know',
  [WordStatus.LEARNING]: 'Learn',
  [WordStatus.UNKNOWN]: 'Unknown',
  // Not offered as quick buttons (see otherStatuses).
  [WordStatus.NAME]: 'Name',
  [WordStatus.TRASH]: 'Trash',
};

const EMPTY_MESSAGES: Record<WordStatus, string> = {
  [WordStatus.KNOWN]:
    'No known words yet. Upload a book you have read, or mark words as known.',
  [WordStatus.LEARNING]:
    'Nothing to learn yet. Words you look up or mark as learning show up here.',
  [WordStatus.UNKNOWN]:
    'No unknown words. Upload a book you have not read yet.',
  [WordStatus.NAME]:
    'No names yet. Open a word and set its status to Name if it names a person or place.',
  [WordStatus.TRASH]:
    'Trash is empty. Open a word and set its status to Trash if it is a typo or cut off.',
};

@Component({
  selector: 'app-dictionary-page',
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonLabel,
    IonProgressBar,
    IonRouterLink,
    IonSegment,
    IonSegmentButton,
    IonToggle,
    DecimalPipe,
    RouterLink,
    Paginator,
  ],
  templateUrl: './dictionary-page.html',
  styleUrl: './dictionary-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class DictionaryPage implements ViewWillEnter {
  private readonly dictionary = inject(DictionaryService);
  private readonly router = inject(Router);
  /** "Next" in the dialog walks through the words on this page. */
  protected readonly open = injectWordDialog(() => this.items());

  // Bound from the query string, so filters survive reloads and back/forward.
  readonly status = input<string>();
  readonly page = input<string>();
  readonly pageSize = input<string>();
  /** On unless "false". */
  readonly bookWordsOnly = input<string>();

  protected readonly query = computed<DictionaryQuery>(() => {
    const status = this.status() as WordStatus;
    const page = Number(this.page());
    const pageSize = Number(this.pageSize());
    return {
      status: WORD_STATUSES.includes(status) ? status : WordStatus.KNOWN,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: PAGE_SIZES.includes(pageSize)
        ? pageSize
        : DICTIONARY_DEFAULT_PAGE_SIZE,
      bookWordsOnly: this.bookWordsOnly() !== 'false',
    };
  });

  protected readonly items = select(DictionaryState.items);
  protected readonly total = select(DictionaryState.total);
  protected readonly loading = select(DictionaryState.loading);
  protected readonly error = select(DictionaryState.error);
  protected readonly pending = select(DictionaryState.pendingWordIds);
  /** The page actually shown; the state may step back past an emptied page. */
  protected readonly shownQuery = select(DictionaryState.query);

  protected readonly statuses = WORD_STATUSES;
  protected readonly labels = WORD_STATUS_LABELS;
  protected readonly moveLabels = MOVE_LABELS;
  protected readonly learning = WordStatus.LEARNING;
  protected readonly name = WordStatus.NAME;
  protected readonly restore = RESTORE_STATUS;
  protected readonly icons = WORD_STATUS_ICONS;
  protected readonly otherStatuses = otherStatuses;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly emptyMessages = EMPTY_MESSAGES;

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => this.dictionary.load(query));
    });
    notifyWordStatusErrors();
  }

  /** Ionic keeps this page alive under the pages opened from it. */
  private visited = false;

  /** Back from another page (e.g. a book): statuses may have changed. */
  ionViewWillEnter(): void {
    if (this.visited) {
      this.dictionary.load(this.query());
    }
    this.visited = true;
  }

  /** A status picked in the filter; `query` checks it is one. */
  protected setStatus(status: SegmentValue | undefined): void {
    this.navigate({ status: status ?? null, page: null });
  }

  /** Off is kept in the URL; on is the default, so it leaves no trace. */
  protected setBookWordsOnly(on: boolean): void {
    this.navigate({ bookWordsOnly: on ? null : 'false', page: null });
  }

  protected changePage({ page, pageSize }: PageChange): void {
    this.navigate({ page, pageSize });
  }

  protected retry(): void {
    this.dictionary.load(this.query());
  }

  protected move(word: DictionaryWord, status: WordStatus): void {
    this.dictionary.changeStatus(word.wordId, status);
  }

  protected rank(index: number): number {
    const { page, pageSize } = this.shownQuery();
    return (page - 1) * pageSize + index + 1;
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }
}
