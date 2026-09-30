import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BookDetails, BookSummary, WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { LoadBook, LoadBooks, ResetUpload, UploadFile } from './books.actions';
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

    it('ignores words that are not in the shown books', () => {
      const before = store.selectSnapshot(BooksState.currentBook);
      store.dispatch(
        new ChangeWordStatusSuccess(dictionaryWord('99', WordStatus.KNOWN)),
      );
      expect(store.selectSnapshot(BooksState.currentBook)).toBe(before);
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
