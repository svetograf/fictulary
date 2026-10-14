import {
  Component,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonRouterLink,
  IonSpinner,
  NavController,
  ViewWillEnter,
} from '@ionic/angular';
import { Actions, ofActionSuccessful, select } from '@ngxs/store';
import { filter } from 'rxjs';
import { DeleteBookSuccess } from './books.actions';
import { injectDeleteBook } from './delete-book';
import { BOOK_WORD_PAGE_SIZES, BookDetailsCard } from './book-details-card';
import { BOOK_TOP_WORDS_LIMIT } from '@fictulary/shared/models';
import { PageChange } from '../shared/paginator';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

@Component({
  selector: 'app-book-page',
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    IonRouterLink,
    IonSpinner,
    RouterLink,
    BookDetailsCard,
  ],
  templateUrl: './book-page.html',
  styleUrl: './book-page.scss',
  // Pages in ion-router-outlet need this class for layout and transitions.
  host: { class: 'ion-page' },
})
export class BookPage implements ViewWillEnter {
  private readonly booksService = inject(BooksService);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly book = select(BooksState.currentBook);
  protected readonly loading = select(BooksState.currentBookLoading);
  protected readonly error = select(BooksState.currentBookError);
  protected readonly words = select(BooksState.currentWords);

  // Bound from the query string, like the dictionary page's paging.
  readonly page = input<string>();
  readonly pageSize = input<string>();

  /** The open book, once loaded; not its words, which change with statuses. */
  private readonly loadedBookId = computed(() => {
    const id = this.book()?.id;
    return id === this.id() ? id : null;
  });

  /** The words page asked for in the URL; page 1 of 100 comes with the book. */
  private readonly wordsQuery = computed(() => {
    const page = Number(this.page());
    const pageSize = Number(this.pageSize());
    return {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: BOOK_WORD_PAGE_SIZES.includes(pageSize)
        ? pageSize
        : BOOK_TOP_WORDS_LIMIT,
    };
  });
  protected readonly deleting = select(BooksState.deletingIds);
  protected readonly deleteBook = injectDeleteBook();

  constructor() {
    // Load the page in the URL once the book is here. This reacts only to
    // the book and the URL: the state may settle on another page (e.g. the
    // last one when the URL asks for too high a page), which must not
    // trigger another request, as the dictionary page does.
    effect(() => {
      const bookId = this.loadedBookId();
      const { page, pageSize } = this.wordsQuery();
      if (bookId === null) {
        return;
      }
      untracked(() => {
        const { requested } = this.words();
        if (requested.page !== page || requested.pageSize !== pageSize) {
          this.booksService.loadBookWords(bookId, page, pageSize);
        }
      });
    });
    // Back to the list once this book is gone.
    const nav = this.nav;
    inject(Actions)
      .pipe(
        ofActionSuccessful(DeleteBookSuccess),
        filter(({ id }: DeleteBookSuccess) => id === this.id()),
        takeUntilDestroyed(),
      )
      .subscribe(() => nav.navigateBack('/'));
    effect(() => {
      const id = this.id();
      untracked(() => this.booksService.loadBook(id));
    });
  }

  /** Ionic keeps this page alive under the pages opened from it. */
  private visited = false;

  /** Back from another page: refresh, as a newly opened page would. */
  ionViewWillEnter(): void {
    if (this.visited) {
      this.booksService.loadBook(this.id());
    }
    this.visited = true;
  }

  protected changePage({ page, pageSize }: PageChange): void {
    this.router.navigate([], {
      queryParams: { page, pageSize },
      queryParamsHandling: 'merge',
    });
  }

  protected retry(): void {
    this.booksService.loadBook(this.id());
  }
}
