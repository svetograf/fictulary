import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { BookResult, BookStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { ResetUpload, UploadFile } from './books.actions';
import { BooksState } from './books.state';

const book: BookResult = {
  id: 1,
  name: 'Tale',
  description: null,
  status: BookStatus.READ,
  wordCount: 3,
  uniqueWordCount: 2,
  words: [
    { word: 'be', count: 2 },
    { word: 'cat', count: 1 },
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
        status: BookStatus.READ,
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
    expect(body.get('status')).toBe(BookStatus.READ);

    req.flush(book);

    expect(store.selectSnapshot(BooksState.book)).toEqual(book);
    expect(store.selectSnapshot(BooksState.uploading)).toBe(false);
    expect(store.selectSnapshot(BooksState.error)).toBeNull();
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
    expect(store.selectSnapshot(BooksState.progress)).toBe(40);

    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    expect(store.selectSnapshot(BooksState.progress)).toBeNull();
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

    expect(store.selectSnapshot(BooksState.error)).toBe(
      'name should not be empty. status is invalid',
    );
    expect(store.selectSnapshot(BooksState.uploading)).toBe(false);
    expect(store.selectSnapshot(BooksState.book)).toBeNull();
  });

  it('reports network errors', () => {
    upload();
    http.expectOne('/api/book').error(new ProgressEvent('error'));
    expect(store.selectSnapshot(BooksState.error)).toMatch(/reach the server/);
  });

  it('clears a previous result when uploading again, and on reset', () => {
    upload();
    http.expectOne('/api/book').flush(book);

    upload();
    expect(store.selectSnapshot(BooksState.book)).toBeNull();
    http.expectOne('/api/book').flush(book);

    store.dispatch(new ResetUpload());
    expect(store.selectSnapshot(BooksState.book)).toBeNull();
  });
});
