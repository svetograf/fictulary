import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { UploadedBook, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import {
  ChangeWordStatusSuccess,
  MarkWordViewedSuccess,
} from '../dictionary/dictionary.actions';
import { DictionaryState } from '../dictionary/dictionary.state';
import { LoadBookNamesSuccess, UploadFileSuccess } from './books.actions';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { UploadPage } from './upload-page';

const uploaded: UploadedBook = {
  id: 9,
  name: 'Tom Sawyer',
  description: null,
  wordCount: 100,
  uniqueWordCount: 50,
  createdAt: '2026-10-01T10:00:00.000Z',
  words: [{ wordId: '5', word: 'river', count: 3, status: WordStatus.UNKNOWN }],
  wordsToLearnCount: 0,
  markedAsNames: [],
};

describe('UploadPage (wizard)', () => {
  const books = {
    upload: vi.fn(),
    reset: vi.fn(),
    loadBookNames: vi.fn(),
  };
  let store: Store;

  const render = async () => {
    const fixture = TestBed.createComponent(UploadPage);
    await fixture.whenStable();
    return fixture;
  };
  const activeStep = (element: HTMLElement) =>
    element
      .querySelector('.mat-step-header[aria-selected=true] .mat-step-label')
      ?.textContent?.trim();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore([BooksState, DictionaryState]),
        { provide: BooksService, useValue: books },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    store = TestBed.inject(Store);
  });

  it('starts a fresh upload on the first step', async () => {
    const element: HTMLElement = (await render()).nativeElement;
    expect(books.reset).toHaveBeenCalled();
    expect(
      [...element.querySelectorAll('.mat-step-label')].map((l) =>
        l.textContent?.trim(),
      ),
    ).toEqual(['Upload', 'Review names', 'Book']);
    expect(activeStep(element)).toBe('Upload');
    expect(element.querySelector('app-upload-form')).not.toBeNull();
  });

  it('moves on to reviewing names once the book is uploaded', async () => {
    const fixture = await render();
    store.dispatch(new UploadFileSuccess(uploaded));
    await fixture.whenStable();
    await fixture.whenStable();

    expect(books.loadBookNames).toHaveBeenCalledWith(9);
    expect(activeStep(fixture.nativeElement)).toBe('Review names');
  });

  it('ends with a message and a link to the book page', async () => {
    const fixture = await render();
    store.dispatch(new UploadFileSuccess(uploaded));
    store.dispatch(new LoadBookNamesSuccess([]));
    await fixture.whenStable();
    await fixture.whenStable();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('app-names-review button.continue')
      ?.click();
    await fixture.whenStable();
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    expect(activeStep(element)).toBe('Book');
    const done = element.querySelector('.done');
    expect(done?.querySelector('p')?.textContent?.trim()).toBe(
      "You're all set. Discover the book words now →",
    );
    const link = done?.querySelector('a');
    expect(link?.textContent?.trim()).toBe('Lead me there!');
    expect(link?.getAttribute('href')).toBe('/book/9');
    // Only the message and the button: no book card here.
    expect(element.querySelector('app-book-details-card')).toBeNull();
  });

  describe('on the Book step', () => {
    const toBookStep = async () => {
      const fixture = await render();
      store.dispatch(new UploadFileSuccess(uploaded));
      await fixture.whenStable();
      await fixture.whenStable();
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('app-names-review button.continue')
        ?.click();
      await fixture.whenStable();
      await fixture.whenStable();
      books.loadBookNames.mockClear();
      return fixture;
    };
    const river = (status: WordStatus) => ({
      wordId: '5',
      word: 'river',
      status,
      count: 3,
      bookCount: 1,
    });

    // Opening an Unknown word marks it viewed (it becomes Learning), which
    // updates the uploaded book's words.
    it('stays put when opening a word changes its status', async () => {
      const fixture = await toBookStep();
      store.dispatch(new MarkWordViewedSuccess(river(WordStatus.LEARNING)));
      await fixture.whenStable();
      await fixture.whenStable();

      expect(activeStep(fixture.nativeElement)).toBe('Book');
      expect(books.loadBookNames).not.toHaveBeenCalled();
    });

    it('stays put when a word is marked from the table', async () => {
      const fixture = await toBookStep();
      store.dispatch(new ChangeWordStatusSuccess(river(WordStatus.KNOWN)));
      await fixture.whenStable();
      await fixture.whenStable();

      expect(activeStep(fixture.nativeElement)).toBe('Book');
    });
  });
});
