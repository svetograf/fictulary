import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Router } from '@angular/router';
import { withComponentInputBinding } from '@angular/router';
import { BookDetails, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { ChangeWordStatusFail } from '../dictionary/dictionary.actions';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DictionaryState } from '../dictionary/dictionary.state';
import {
  DeleteBookSuccess,
  LoadBookFail,
  LoadBookSuccess,
  LoadBookWordsSuccess,
} from './books.actions';
import { BookPage } from './book-page';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

const book: BookDetails = {
  id: 3,
  name: 'Tale',
  description: 'A classic',
  wordCount: 10,
  uniqueWordCount: 2,
  createdAt: '2026-09-01T10:00:00.000Z',
  words: [
    { wordId: '1', word: 'be', count: 6, status: WordStatus.LEARNING },
    { wordId: '2', word: 'cat', count: 4, status: WordStatus.UNKNOWN },
  ],
  wordsToLearnCount: 2,
};

describe('BookPage', () => {
  const booksService = {
    loadBook: vi.fn(),
    deleteBook: vi.fn(),
    loadBookWords: vi.fn(),
  };
  const dictionary = {
    changeStatus: vi.fn(),
    openWord: vi.fn(),
    closeWord: vi.fn(),
  };
  /** Answers both the word dialog (ignored) and delete confirmations. */
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  const snackBar = { open: vi.fn() };
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'book/:id', component: BookPage }],
          withComponentInputBinding(),
        ),
        provideStore([BooksState, DictionaryState]),
        { provide: BooksService, useValue: booksService },
        { provide: DictionaryService, useValue: dictionary },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('loads the book from the route id', async () => {
    await harness.navigateByUrl('/book/3', BookPage);
    expect(booksService.loadBook).toHaveBeenCalledWith(3);

    await harness.navigateByUrl('/book/4', BookPage);
    expect(booksService.loadBook).toHaveBeenLastCalledWith(4);
  });

  it('shows the book details and the words left to learn', async () => {
    await harness.navigateByUrl('/book/3', BookPage);
    TestBed.inject(Store).dispatch(new LoadBookSuccess(book));
    await harness.fixture.whenStable();

    const element = harness.routeNativeElement as HTMLElement;
    expect(element.textContent).toContain('Tale');
    expect(element.textContent).toContain('A classic');
    const rows = [...element.querySelectorAll('tr[mat-row]')].map((row) =>
      // Rank, word, status and count; the actions column is tested below.
      [...row.querySelectorAll('td:not(.actions)')].map((td) =>
        td.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    );
    expect(rows).toEqual([
      ['1', 'be', 'school Learning', '6'],
      ['2', 'cat', 'help_outline Unknown', '4'],
    ]);
  });

  it('says so when every word in the book is known', async () => {
    await harness.navigateByUrl('/book/3', BookPage);
    TestBed.inject(Store).dispatch(
      new LoadBookSuccess({ ...book, words: [], wordsToLearnCount: 0 }),
    );
    await harness.fixture.whenStable();

    const element = harness.routeNativeElement as HTMLElement;
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.all-known')?.textContent).toContain(
      'You know every word in this book.',
    );
  });

  it('shows load errors', async () => {
    await harness.navigateByUrl('/book/404', BookPage);
    TestBed.inject(Store).dispatch(new LoadBookFail('Book 404 not found'));
    await harness.fixture.whenStable();

    expect(
      harness.routeNativeElement?.querySelector('[role=alert]')?.textContent,
    ).toContain('Book 404 not found');
  });

  describe('word actions', () => {
    const showBook = async () => {
      await harness.navigateByUrl('/book/3', BookPage);
      TestBed.inject(Store).dispatch(new LoadBookSuccess(book));
      await harness.fixture.whenStable();
      return [
        ...(harness.routeNativeElement as HTMLElement).querySelectorAll(
          'tr[mat-row]',
        ),
      ].map((row) => [
        ...row.querySelectorAll<HTMLButtonElement>('td.actions button'),
      ]);
    };

    it('offers "I know" and "Learn" icon buttons with hover hints', async () => {
      const [, cat] = await showBook();
      expect(cat.map((b) => b.getAttribute('aria-label'))).toEqual([
        'I know: cat',
        'Learn: cat',
      ]);
      // Hover hints.
      const tooltips = harness.fixture.debugElement
        .queryAll(By.directive(MatTooltip))
        .filter((el) => cat.includes(el.nativeElement))
        .map((el) => el.injector.get(MatTooltip).message);
      expect(tooltips).toEqual(['I know', 'Learn']);
      expect(
        cat.every((b) => b.classList.contains('mat-mdc-icon-button')),
      ).toBe(true);
      expect(cat[1].classList).toContain('learn');
    });

    it('hides "Learn" for words already being learned', async () => {
      const [be, cat] = await showBook();
      expect(be[1].classList).toContain('hidden');
      expect(cat[1].classList).not.toContain('hidden');
    });

    it('changes the status through the dictionary', async () => {
      const [be, cat] = await showBook();
      be[0].click();
      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '1',
        WordStatus.KNOWN,
      );
      cat[1].click();
      expect(dictionary.changeStatus).toHaveBeenCalledWith(
        '2',
        WordStatus.LEARNING,
      );
    });

    it('opens the word dialog when a word is clicked', async () => {
      await showBook();
      const words = [
        ...(
          harness.routeNativeElement as HTMLElement
        ).querySelectorAll<HTMLButtonElement>('td button.word'),
      ];
      expect(words.map((w) => w.getAttribute('aria-label'))).toEqual([
        'Show details for be',
        'Show details for cat',
      ]);

      words[1].click();

      expect(dictionary.openWord).toHaveBeenCalledWith(
        expect.objectContaining({
          wordId: '2',
          word: 'cat',
          status: WordStatus.UNKNOWN,
        }),
      );
      expect(dialog.open).toHaveBeenCalled();
      expect(dictionary.closeWord).toHaveBeenCalled(); // our fake closes at once
    });

    it('shows failed changes as a notification', async () => {
      await showBook();
      TestBed.inject(Store).dispatch(
        new ChangeWordStatusFail(
          '2',
          'Could not reach the server. Please try again.',
        ),
      );
      expect(snackBar.open).toHaveBeenCalledWith(
        'Could not reach the server. Please try again.',
        'Dismiss',
        { duration: 5000 },
      );
    });
  });

  describe('deleting', () => {
    it('deletes the book after confirmation', async () => {
      await harness.navigateByUrl('/book/3', BookPage);
      TestBed.inject(Store).dispatch(new LoadBookSuccess(book));
      await harness.fixture.whenStable();

      const button = [
        ...(
          harness.routeNativeElement as HTMLElement
        ).querySelectorAll<HTMLButtonElement>('.toolbar button'),
      ].find((b) => b.textContent?.includes('Delete book'));
      button?.click();

      expect(booksService.deleteBook).toHaveBeenCalledWith(3);
    });

    it('goes back to the list once the book is deleted', async () => {
      await harness.navigateByUrl('/book/3', BookPage);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

      TestBed.inject(Store).dispatch(new DeleteBookSuccess(4)); // another book
      expect(navigate).not.toHaveBeenCalledWith('/');

      TestBed.inject(Store).dispatch(new DeleteBookSuccess(3));
      expect(navigate).toHaveBeenCalledWith('/');
    });
  });

  describe('paging the words', () => {
    const open = async (url: string, total = 250) => {
      await harness.navigateByUrl(url, BookPage);
      TestBed.inject(Store).dispatch(
        new LoadBookSuccess({ ...book, wordsToLearnCount: total }),
      );
      await harness.fixture.whenStable();
    };

    it('shows the first 100 that come with the book, without a request', async () => {
      await open('/book/3');
      expect(booksService.loadBookWords).not.toHaveBeenCalled();
      expect(
        harness.routeNativeElement
          ?.querySelector('.mat-mdc-paginator-range-label')
          ?.textContent?.trim(),
      ).toBe('1 – 100 of 250');
    });

    it('loads the page in the URL', async () => {
      await open('/book/3?page=3&pageSize=50');
      expect(booksService.loadBookWords).toHaveBeenCalledTimes(1);
      expect(booksService.loadBookWords).toHaveBeenCalledWith(3, 3, 50);
    });

    it('asks once for a page past the end, letting the state settle', async () => {
      await open('/book/3?page=999');
      // The state steps back to the last page (another request it makes
      // itself); the page must not ask for 999 again.
      TestBed.inject(Store).dispatch(
        new LoadBookWordsSuccess({
          items: [],
          total: 250,
          page: 3,
          pageSize: 100,
        }),
      );
      await harness.fixture.whenStable();
      expect(booksService.loadBookWords).toHaveBeenCalledTimes(1);
    });

    it('puts the chosen page in the URL', async () => {
      await open('/book/3');
      const next = harness.routeNativeElement?.querySelector<HTMLButtonElement>(
        '.mat-mdc-paginator-navigation-next',
      );
      next?.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/book/3?page=2&pageSize=100');
    });
  });
});
