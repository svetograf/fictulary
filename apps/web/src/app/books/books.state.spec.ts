import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BookDetails, BookSummary, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import {
  DeleteBook,
  LoadBook,
  LoadBookWords,
  LoadBookNames,
  LoadBooks,
  ResetUpload,
  UploadFile,
} from './books.actions';
import { SignOut } from '../auth/auth.actions';
import {
  ChangeWordStatusSuccess,
  MarkWordViewedSuccess,
} from '../dictionary/dictionary.actions';
import { BooksState } from './books.state';

const summary: BookSummary = {
  id: 1,
  name: 'Tale',
  description: null,
  wordCount: 3,
  uniqueWordCount: 2,
  createdAt: '2026-09-01T10:00:00.000Z',
};

const book: BookDetails = {
  ...summary,
  words: [
    { wordId: '1', word: 'be', count: 2, status: WordStatus.LEARNING },
    { wordId: '2', word: 'cat', count: 1, status: WordStatus.UNKNOWN },
  ],
  wordsToLearnCount: 2,
};

describe('BooksState', () => {
  let store: Store;
  let http: HttpTestingController;

  const upload = (description = '') =>
    store.dispatch(
      new UploadFile({
        file: new File(['I was a cat'], 'tale.txt', { type: 'text/plain' }),
        name: 'Tale',
        description,
        wordStatus: WordStatus.KNOWN,
      }),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideStore([BooksState]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    store = TestBed.inject(Store);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the form as multipart data and stores the result', () => {
    upload('A classic');
    expect(store.selectSnapshot(BooksState.uploading)).toBe(true);

    const req = http.expectOne('/api/book');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('file') as File).name).toBe('tale.txt');
    expect(body.get('name')).toBe('Tale');
    expect(body.get('description')).toBe('A classic');
    expect(body.get('wordStatus')).toBe(WordStatus.KNOWN);

    req.flush(book);

    expect(store.selectSnapshot(BooksState.uploadedBook)).toEqual(book);
    expect(store.selectSnapshot(BooksState.uploading)).toBe(false);
    expect(store.selectSnapshot(BooksState.uploadError)).toBeNull();
  });

  it('omits an empty description', () => {
    upload();
    const req = http.expectOne('/api/book');
    expect((req.request.body as FormData).has('description')).toBe(false);
    req.flush(book);
  });

  it('tracks upload progress, then waits for processing', () => {
    upload();
    const req = http.expectOne('/api/book');

    req.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    expect(store.selectSnapshot(BooksState.uploadProgress)).toBe(40);

    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    expect(store.selectSnapshot(BooksState.uploadProgress)).toBeNull();
    expect(store.selectSnapshot(BooksState.uploading)).toBe(true);

    req.flush(book);
  });

  it('stores the server error message on failure', () => {
    upload();
    http
      .expectOne('/api/book')
      .flush(
        { message: ['name should not be empty', 'status is invalid'] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.selectSnapshot(BooksState.uploadError)).toBe(
      'name should not be empty. status is invalid',
    );
    expect(store.selectSnapshot(BooksState.uploading)).toBe(false);
    expect(store.selectSnapshot(BooksState.uploadedBook)).toBeNull();
  });

  it('reports network errors', () => {
    upload();
    http.expectOne('/api/book').error(new ProgressEvent('error'));
    expect(store.selectSnapshot(BooksState.uploadError)).toMatch(
      /reach the server/,
    );
  });

  it('clears a previous result when uploading again, and on reset', () => {
    upload();
    http.expectOne('/api/book').flush(book);

    upload();
    expect(store.selectSnapshot(BooksState.uploadedBook)).toBeNull();
    http.expectOne('/api/book').flush(book);

    store.dispatch(new ResetUpload());
    expect(store.selectSnapshot(BooksState.uploadedBook)).toBeNull();
  });

  it('adds an uploaded book to the top of the list', () => {
    store.dispatch(new LoadBooks());
    http.expectOne('/api/books').flush([{ ...summary, id: 9 }]);

    upload();
    http.expectOne('/api/book').flush(book);

    expect(store.selectSnapshot(BooksState.books).map((b) => b.id)).toEqual([
      1, 9,
    ]);
  });

  describe('LoadBooks', () => {
    it('loads the book list', () => {
      store.dispatch(new LoadBooks());
      expect(store.selectSnapshot(BooksState.booksLoading)).toBe(true);

      http.expectOne('/api/books').flush([summary]);

      expect(store.selectSnapshot(BooksState.books)).toEqual([summary]);
      expect(store.selectSnapshot(BooksState.booksLoading)).toBe(false);
    });

    it('keeps the current list and records the error on failure', () => {
      store.dispatch(new LoadBooks());
      http.expectOne('/api/books').flush([summary]);

      store.dispatch(new LoadBooks());
      http
        .expectOne('/api/books')
        .flush(
          { message: 'Database unavailable' },
          { status: 500, statusText: 'Server Error' },
        );

      expect(store.selectSnapshot(BooksState.books)).toEqual([summary]);
      expect(store.selectSnapshot(BooksState.booksError)).toBe(
        'Database unavailable',
      );
      expect(store.selectSnapshot(BooksState.booksLoading)).toBe(false);
    });
  });

  describe('LoadBook', () => {
    it('loads a single book with its words', () => {
      store.dispatch(new LoadBook(1));
      expect(store.selectSnapshot(BooksState.currentBookLoading)).toBe(true);

      http.expectOne('/api/book/1').flush(book);

      expect(store.selectSnapshot(BooksState.currentBook)).toEqual(book);
      expect(store.selectSnapshot(BooksState.currentBookLoading)).toBe(false);
    });

    it('clears the previous book while loading another one', () => {
      store.dispatch(new LoadBook(1));
      http.expectOne('/api/book/1').flush(book);

      store.dispatch(new LoadBook(2));
      expect(store.selectSnapshot(BooksState.currentBook)).toBeNull();
      http.expectOne('/api/book/2').flush({ ...book, id: 2 });
    });

    it('reports a missing book', () => {
      store.dispatch(new LoadBook(404));
      http
        .expectOne('/api/book/404')
        .flush(
          { message: 'Book 404 not found' },
          { status: 404, statusText: 'Not Found' },
        );

      expect(store.selectSnapshot(BooksState.currentBook)).toBeNull();
      expect(store.selectSnapshot(BooksState.currentBookError)).toBe(
        'Book 404 not found',
      );
    });

    it('rejects invalid ids without calling the API', () => {
      store.dispatch(new LoadBook(Number.NaN));
      http.expectNone(() => true);
      expect(store.selectSnapshot(BooksState.currentBookError)).toBe(
        'Book not found',
      );
      expect(store.selectSnapshot(BooksState.currentBookLoading)).toBe(false);
    });
  });

  describe('when a word status changes', () => {
    const dictionaryWord = (wordId: string, status: WordStatus) => ({
      wordId,
      word: wordId === '1' ? 'be' : 'cat',
      status,
      count: 1,
      bookCount: 1,
    });

    /** The shown page is reloaded after a word leaves it. */
    const expectRefill = (items = [book.words[1]], total = 1) =>
      http
        .expectOne((r) => r.url === '/api/book/1/words-to-learn')
        .flush({ items, total, page: 1, pageSize: 100 });

    beforeEach(() => {
      store.dispatch(new LoadBook(1));
      http.expectOne('/api/book/1').flush(book);
      upload();
      http.expectOne('/api/book').flush(book);
    });

    it('drops words marked known from the shown books', () => {
      store.dispatch(
        new ChangeWordStatusSuccess(dictionaryWord('1', WordStatus.KNOWN)),
      );
      expectRefill();

      for (const shown of [
        store.selectSnapshot(BooksState.currentBook),
        store.selectSnapshot(BooksState.uploadedBook),
      ]) {
        expect(shown?.words.map((w) => w.wordId)).toEqual(['2']);
      }
    });

    it('updates the status of other changes', () => {
      store.dispatch(
        new ChangeWordStatusSuccess(dictionaryWord('2', WordStatus.LEARNING)),
      );

      expect(
        store
          .selectSnapshot(BooksState.currentBook)
          ?.words.map((w) => w.status),
      ).toEqual([WordStatus.LEARNING, WordStatus.LEARNING]);
    });

    it('shows an unknown word opened from the book as learning', () => {
      store.dispatch(
        new MarkWordViewedSuccess(dictionaryWord('2', WordStatus.LEARNING)),
      );
      expect(
        store
          .selectSnapshot(BooksState.currentBook)
          ?.words.find((w) => w.wordId === '2')?.status,
      ).toBe(WordStatus.LEARNING);
    });

    it.each([WordStatus.NAME, WordStatus.TRASH])(
      'drops words set to %s from the shown books',
      (status) => {
        store.dispatch(
          new ChangeWordStatusSuccess(dictionaryWord('2', status)),
        );
        expectRefill([book.words[0]]);
        expect(
          store
            .selectSnapshot(BooksState.currentBook)
            ?.words.map((w) => w.wordId),
        ).toEqual(['1']);
      },
    );

    it('ignores words that are not in the shown books', () => {
      const before = store.selectSnapshot(BooksState.currentBook);
      store.dispatch(
        new ChangeWordStatusSuccess(dictionaryWord('99', WordStatus.KNOWN)),
      );
      expect(store.selectSnapshot(BooksState.currentBook)).toBe(before);
    });
  });

  describe('paging the words to learn', () => {
    const wordsPage = (
      page: number,
      pageSize: number,
      ids: string[],
      total = 250,
    ) => ({
      items: ids.map((id) => ({
        wordId: id,
        word: `w${id}`,
        count: 1,
        status: WordStatus.UNKNOWN,
      })),
      total,
      page,
      pageSize,
    });
    const pageRequest = () =>
      http.expectOne((r) => r.url === '/api/book/1/words-to-learn');

    beforeEach(() => {
      store.dispatch(new LoadBook(1));
      http.expectOne('/api/book/1').flush({ ...book, wordsToLearnCount: 250 });
    });

    it('starts with the words that come with the book', () => {
      expect(store.selectSnapshot(BooksState.currentWords)).toMatchObject({
        items: book.words,
        total: 250,
        page: 1,
        pageSize: 100,
      });
    });

    it('loads another page, keeping the shown one until it arrives', () => {
      store.dispatch(new LoadBookWords(1, 2, 100));
      expect(store.selectSnapshot(BooksState.currentWords)).toMatchObject({
        items: book.words,
        page: 1,
        requested: { page: 2, pageSize: 100 },
        loading: true,
      });

      const req = pageRequest();
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('100');
      req.flush(wordsPage(2, 100, ['101', '102']));

      expect(store.selectSnapshot(BooksState.currentWords)).toMatchObject({
        page: 2,
        total: 250,
        loading: false,
      });
      expect(
        store
          .selectSnapshot(BooksState.currentWords)
          .items.map((w) => w.wordId),
      ).toEqual(['101', '102']);
    });

    it('steps back from a page past the end', () => {
      store.dispatch(new LoadBookWords(1, 9, 100));
      pageRequest().flush(wordsPage(9, 100, []));

      const back = pageRequest();
      expect(back.request.params.get('page')).toBe('3');
      back.flush(wordsPage(3, 100, ['201']));
      expect(store.selectSnapshot(BooksState.currentWords).page).toBe(3);
    });

    it('keeps the request it failed on, so it is not retried in a loop', () => {
      store.dispatch(new LoadBookWords(1, 2, 100));
      pageRequest().flush(
        { message: 'Boom' },
        { status: 500, statusText: 'Error' },
      );

      expect(store.selectSnapshot(BooksState.currentWords)).toMatchObject({
        page: 1,
        requested: { page: 2, pageSize: 100 },
        error: 'Boom',
        loading: false,
      });
    });

    it('refills the page when a word leaves it, with one fewer in total', () => {
      store.dispatch(
        new ChangeWordStatusSuccess({
          wordId: '1',
          word: 'be',
          status: WordStatus.KNOWN,
          count: 2,
          bookCount: 1,
        }),
      );
      expect(store.selectSnapshot(BooksState.currentWords).total).toBe(249);

      const refill = pageRequest();
      expect(refill.request.params.get('page')).toBe('1');
      refill.flush(wordsPage(1, 100, ['2', '3'], 249));
      expect(
        store
          .selectSnapshot(BooksState.currentWords)
          .items.map((w) => w.wordId),
      ).toEqual(['2', '3']);
    });
  });

  describe('reviewing names', () => {
    const names = [
      { wordId: '1', word: 'tom', count: 40, status: WordStatus.NAME },
      { wordId: '2', word: 'becky', count: 12, status: WordStatus.NAME },
    ];

    it("loads the book's names", () => {
      store.dispatch(new LoadBookNames(9));
      expect(store.selectSnapshot(BooksState.reviewLoading)).toBe(true);

      const req = http.expectOne((r) => r.url === '/api/book/9/words');
      expect(req.request.params.get('status')).toBe('NAME');
      req.flush(names);

      expect(store.selectSnapshot(BooksState.reviewNames)).toEqual(names);
      expect(store.selectSnapshot(BooksState.reviewLoading)).toBe(false);
    });

    it('records load errors', () => {
      store.dispatch(new LoadBookNames(9));
      http
        .expectOne((r) => r.url === '/api/book/9/words')
        .flush(
          { message: 'Book 9 not found' },
          { status: 404, statusText: 'Not Found' },
        );
      expect(store.selectSnapshot(BooksState.reviewError)).toBe(
        'Book 9 not found',
      );
    });

    it('keeps changed names in the list with their new status', () => {
      store.dispatch(new LoadBookNames(9));
      http.expectOne((r) => r.url === '/api/book/9/words').flush(names);

      store.dispatch(
        new ChangeWordStatusSuccess({
          wordId: '1',
          word: 'tom',
          status: WordStatus.UNKNOWN,
          count: 40,
          bookCount: 1,
        }),
      );

      expect(
        store.selectSnapshot(BooksState.reviewNames).map((w) => w.status),
      ).toEqual([WordStatus.UNKNOWN, WordStatus.NAME]);
    });

    it('is cleared for the next upload', () => {
      store.dispatch(new LoadBookNames(9));
      http.expectOne((r) => r.url === '/api/book/9/words').flush(names);
      store.dispatch(new ResetUpload());
      expect(store.selectSnapshot(BooksState.reviewNames)).toEqual([]);
    });
  });

  describe('deleting a book', () => {
    beforeEach(() => {
      store.dispatch(new LoadBooks());
      http.expectOne('/api/books').flush([summary, { ...summary, id: 2 }]);
      store.dispatch(new LoadBook(1));
      http.expectOne('/api/book/1').flush(book);
    });

    it('removes it from the list and the open book', () => {
      store.dispatch(new DeleteBook(1));
      expect(store.selectSnapshot(BooksState.deletingIds)).toEqual([1]);

      const req = http.expectOne('/api/book/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(store.selectSnapshot(BooksState.books).map((b) => b.id)).toEqual([
        2,
      ]);
      expect(store.selectSnapshot(BooksState.currentBook)).toBeNull();
      expect(store.selectSnapshot(BooksState.deletingIds)).toEqual([]);
    });

    it('keeps everything when the delete fails', () => {
      store.dispatch(new DeleteBook(1));
      http
        .expectOne('/api/book/1')
        .flush(
          { message: 'Book 1 not found' },
          { status: 404, statusText: 'Not Found' },
        );

      expect(store.selectSnapshot(BooksState.books)).toHaveLength(2);
      expect(store.selectSnapshot(BooksState.currentBook)).toEqual(book);
      expect(store.selectSnapshot(BooksState.deletingIds)).toEqual([]);
    });
  });

  it('forgets all book data on sign-out', () => {
    store.dispatch(new LoadBooks());
    http.expectOne('/api/books').flush([summary]);
    store.dispatch(new LoadBook(1));
    http.expectOne('/api/book/1').flush(book);

    store.dispatch(new SignOut());

    expect(store.selectSnapshot(BooksState.books)).toEqual([]);
    expect(store.selectSnapshot(BooksState.currentBook)).toBeNull();
    expect(store.selectSnapshot(BooksState.uploadedBook)).toBeNull();
  });
});
