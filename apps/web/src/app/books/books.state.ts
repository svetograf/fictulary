import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BookDetails, BookSummary } from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { patch } from '@ngxs/store/operators';
import { catchError, map, mergeMap, of } from 'rxjs';
import { SignOut } from '../auth/auth.actions';
import { httpErrorMessage } from '../shared/http-error-message';
import {
  LoadBook,
  LoadBookFail,
  LoadBookSuccess,
  LoadBooks,
  LoadBooksFail,
  LoadBooksSuccess,
  ResetUpload,
  UploadFile,
  UploadFileFail,
  UploadFileProgress,
  UploadFileSuccess,
} from './books.actions';

export interface BooksStateModel {
  list: {
    books: BookSummary[];
    loading: boolean;
    error: string | null;
  };
  /** The book opened on the book page. */
  current: {
    book: BookDetails | null;
    loading: boolean;
    error: string | null;
  };
  upload: {
    uploading: boolean;
    /** Upload progress in percent, or null once the file has been sent. */
    progress: number | null;
    book: BookDetails | null;
    error: string | null;
  };
}

const initialList: BooksStateModel['list'] = {
  books: [],
  loading: false,
  error: null,
};
const initialCurrent: BooksStateModel['current'] = {
  book: null,
  loading: false,
  error: null,
};
const initialUpload: BooksStateModel['upload'] = {
  uploading: false,
  progress: null,
  book: null,
  error: null,
};

type Ctx = StateContext<BooksStateModel>;

@State<BooksStateModel>({
  name: 'books',
  defaults: {
    list: initialList,
    current: initialCurrent,
    upload: initialUpload,
  },
})
@Injectable()
export class BooksState {
  private readonly http = inject(HttpClient);

  @Selector()
  static books(state: BooksStateModel): BookSummary[] {
    return state.list.books;
  }

  @Selector()
  static booksLoading(state: BooksStateModel): boolean {
    return state.list.loading;
  }

  @Selector()
  static booksError(state: BooksStateModel): string | null {
    return state.list.error;
  }

  @Selector()
  static currentBook(state: BooksStateModel): BookDetails | null {
    return state.current.book;
  }

  @Selector()
  static currentBookLoading(state: BooksStateModel): boolean {
    return state.current.loading;
  }

  @Selector()
  static currentBookError(state: BooksStateModel): string | null {
    return state.current.error;
  }

  @Selector()
  static uploading(state: BooksStateModel): boolean {
    return state.upload.uploading;
  }

  @Selector()
  static uploadProgress(state: BooksStateModel): number | null {
    return state.upload.progress;
  }

  @Selector()
  static uploadedBook(state: BooksStateModel): BookDetails | null {
    return state.upload.book;
  }

  @Selector()
  static uploadError(state: BooksStateModel): string | null {
    return state.upload.error;
  }

  @Action(LoadBooks, { cancelUncompleted: true })
  loadBooks(ctx: Ctx) {
    // Keep showing the books we have while refreshing.
    ctx.setState(patch({ list: patch({ loading: true, error: null }) }));
    return this.http.get<BookSummary[]>('/api/books').pipe(
      mergeMap((books) => ctx.dispatch(new LoadBooksSuccess(books))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new LoadBooksFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(LoadBooksSuccess)
  loadBooksSuccess(ctx: Ctx, { books }: LoadBooksSuccess) {
    ctx.setState(patch({ list: { ...initialList, books } }));
  }

  @Action(LoadBooksFail)
  loadBooksFail(ctx: Ctx, { error }: LoadBooksFail) {
    ctx.setState(patch({ list: patch({ loading: false, error }) }));
  }

  @Action(LoadBook, { cancelUncompleted: true })
  loadBook(ctx: Ctx, { id }: LoadBook) {
    ctx.setState(patch({ current: { ...initialCurrent, loading: true } }));
    if (!Number.isInteger(id) || id < 1) {
      return ctx.dispatch(new LoadBookFail('Book not found'));
    }
    return this.http.get<BookDetails>(`/api/book/${id}`).pipe(
      mergeMap((book) => ctx.dispatch(new LoadBookSuccess(book))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new LoadBookFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(LoadBookSuccess)
  loadBookSuccess(ctx: Ctx, { book }: LoadBookSuccess) {
    ctx.setState(patch({ current: { ...initialCurrent, book } }));
  }

  @Action(LoadBookFail)
  loadBookFail(ctx: Ctx, { error }: LoadBookFail) {
    ctx.setState(patch({ current: { ...initialCurrent, error } }));
  }

  @Action(UploadFile, { cancelUncompleted: true })
  uploadFile(ctx: Ctx, { payload }: UploadFile) {
    ctx.setState(
      patch({ upload: { ...initialUpload, uploading: true, progress: 0 } }),
    );

    const body = new FormData();
    body.append('file', payload.file);
    body.append('name', payload.name);
    body.append('status', payload.status);
    if (payload.description) {
      body.append('description', payload.description);
    }

    return this.http
      .post<BookDetails>('/api/book', body, {
        observe: 'events',
        reportProgress: true,
      })
      .pipe(
        mergeMap((event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            const percent = Math.round((event.loaded / event.total) * 100);
            return ctx.dispatch(new UploadFileProgress(percent));
          }
          if (event.type === HttpEventType.Response && event.body) {
            return ctx.dispatch(new UploadFileSuccess(event.body));
          }
          return of(undefined);
        }),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new UploadFileFail(httpErrorMessage(error))),
        ),
        map(() => undefined),
      );
  }

  @Action(UploadFileProgress)
  uploadFileProgress(ctx: Ctx, { percent }: UploadFileProgress) {
    // Once the file is fully sent the server is still counting words.
    ctx.setState(
      patch({ upload: patch({ progress: percent < 100 ? percent : null }) }),
    );
  }

  @Action(UploadFileSuccess)
  uploadFileSuccess(ctx: Ctx, { book }: UploadFileSuccess) {
    const summary = toSummary(book);
    const { books } = ctx.getState().list;
    ctx.setState(
      patch({
        upload: { ...initialUpload, book },
        // Show the new book in the list without waiting for a reload.
        list: patch({
          books: [summary, ...books.filter((b) => b.id !== book.id)],
        }),
      }),
    );
  }

  @Action(UploadFileFail)
  uploadFileFail(ctx: Ctx, { error }: UploadFileFail) {
    ctx.setState(patch({ upload: { ...initialUpload, error } }));
  }

  /** Another user may sign in next; don't keep this user's books around. */
  @Action(SignOut)
  signOut(ctx: Ctx) {
    ctx.setState({
      list: initialList,
      current: initialCurrent,
      upload: initialUpload,
    });
  }

  @Action(ResetUpload)
  resetUpload(ctx: Ctx) {
    ctx.setState(patch({ upload: initialUpload }));
  }
}

function toSummary(book: BookDetails): BookSummary {
  const { id, name, description, status, wordCount, uniqueWordCount } = book;
  const { createdAt } = book;
  return {
    id,
    name,
    description,
    status,
    wordCount,
    uniqueWordCount,
    createdAt,
  };
}
