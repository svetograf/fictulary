import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UploadedBook, WordCount, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { of } from 'rxjs';
import { ChangeWordStatusSuccess } from '../dictionary/dictionary.actions';
import { DictionaryService } from '../dictionary/dictionary.service';
import { DictionaryState } from '../dictionary/dictionary.state';
import {
  LoadBookNamesFail,
  LoadBookNamesSuccess,
  UploadFileSuccess,
} from './books.actions';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { NamesReview } from './names-review';

const book: UploadedBook = {
  id: 9,
  name: 'Tom Sawyer',
  description: null,
  wordCount: 100,
  uniqueWordCount: 50,
  createdAt: '2026-10-01T10:00:00.000Z',
  words: [],
  wordsToLearnCount: 0,
  markedAsNames: ['tom', 'becky'],
};
const name = (wordId: string, word: string, count: number): WordCount => ({
  wordId,
  word,
  count,
  status: WordStatus.NAME,
});
const names = [name('1', 'tom', 40), name('2', 'becky', 1)];

describe('NamesReview', () => {
  const books = { loadBookNames: vi.fn() };
  const dictionary = {
    changeStatus: vi.fn(),
    openWord: vi.fn(),
    closeWord: vi.fn(),
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  let store: Store;

  const render = async () => {
    const fixture = TestBed.createComponent(NamesReview);
    await fixture.whenStable();
    return fixture;
  };
  const rows = (element: HTMLElement) => [
    ...element.querySelectorAll('.words li'),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideStore([BooksState, DictionaryState]),
        { provide: BooksService, useValue: books },
        { provide: DictionaryService, useValue: dictionary },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    store = TestBed.inject(Store);
    store.dispatch(new UploadFileSuccess(book));
    store.dispatch(new LoadBookNamesSuccess(names));
  });

  it("lists the book's names with their uses in it", async () => {
    const element: HTMLElement = (await render()).nativeElement;
    expect(element.querySelector('h2')?.textContent).toContain(
      'Names in “Tom Sawyer”',
    );
    expect(element.querySelector('.hint')?.textContent).toContain(
      '2 words are filed as names',
    );
    expect(
      rows(element).map((row) => [
        row.querySelector('.word')?.textContent?.trim(),
        row.querySelector('.status')?.textContent?.replace(/\s+/g, ' ').trim(),
        row.querySelector('.usage')?.textContent?.replace(/\s+/g, ' ').trim(),
      ]),
    ).toEqual([
      ['tom', 'badge Name', '40 uses'],
      ['becky', 'badge Name', '1 use'],
    ]);
  });

  it('offers one "Restore" per name, making it Unknown', async () => {
    const element: HTMLElement = (await render()).nativeElement;
    const buttons = rows(element).map((row) => [
      ...row.querySelectorAll<HTMLButtonElement>('.actions button'),
    ]);
    expect(
      buttons.map((b) => b.map((x) => x.getAttribute('aria-label'))),
    ).toEqual([['Restore: tom'], ['Restore: becky']]);

    buttons[0][0].click();
    expect(dictionary.changeStatus).toHaveBeenCalledWith(
      '1',
      WordStatus.UNKNOWN,
    );
  });

  it('keeps a restored word in the list, offering "Name" to undo', async () => {
    const fixture = await render();
    store.dispatch(
      new ChangeWordStatusSuccess({
        wordId: '1',
        word: 'tom',
        status: WordStatus.UNKNOWN,
        count: 40,
        bookCount: 1,
      }),
    );
    await fixture.whenStable();

    const row = rows(fixture.nativeElement)[0];
    expect(row.querySelector('.status')?.textContent).toContain('Unknown');
    const buttons = [
      ...row.querySelectorAll<HTMLButtonElement>('.actions button'),
    ];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Name: tom',
    ]);

    buttons[0].click();
    expect(dictionary.changeStatus).toHaveBeenCalledWith('1', WordStatus.NAME);
  });

  it('opens a name in the word dialog', async () => {
    const element: HTMLElement = (await render()).nativeElement;
    rows(element)[1].querySelector<HTMLButtonElement>('.word')?.click();
    expect(dictionary.openWord).toHaveBeenCalledWith(names[1]);
    expect(dialog.open).toHaveBeenCalled();
  });

  it('emits "continue" from the button in the corner', async () => {
    const fixture = await render();
    const spy = vi.fn();
    fixture.componentInstance.continue.subscribe(spy);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.review-header button.continue')
      ?.click();
    expect(spy).toHaveBeenCalled();
  });

  it('says so when the book has no names', async () => {
    store.dispatch(new LoadBookNamesSuccess([]));
    const element: HTMLElement = (await render()).nativeElement;
    expect(element.querySelector('.empty')?.textContent).toContain(
      'No names were found in this book.',
    );
    // Continue is still there.
    expect(element.querySelector('button.continue')).not.toBeNull();
  });

  it('retries a failed load', async () => {
    store.dispatch(new LoadBookNamesFail('Could not reach the server.'));
    const element: HTMLElement = (await render()).nativeElement;
    element.querySelector<HTMLButtonElement>('[role=alert] button')?.click();
    expect(books.loadBookNames).toHaveBeenCalledWith(9);
  });
});
