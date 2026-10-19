import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BookDetails,
  BookSummary,
  BookWordsPage,
  BOOK_TOP_WORDS_LIMIT,
  CefrLevel,
  DictionaryWord,
  UploadedBook,
  WordCount,
  WordStatus,
  WORDS_TO_LEARN_STATUSES,
} from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { patch } from '@ngxs/store/operators';
import { catchError, map, mergeMap, of } from 'rxjs';
import { SignOut } from '../auth/auth.actions';
import {
  ChangeWordStatusSuccess,
  MarkWordViewedSuccess,
} from '../dictionary/dictionary.actions';
import { httpErrorMessage } from '../shared/http-error-message';
import {
  LoadBookWords,
  LoadBookWordsFail,
  LoadBookWordsSuccess,
  DeleteBook,
  DeleteBookFail,
  DeleteBookSuccess,
  LoadBookNames,
  LoadBookNamesFail,
  LoadBookNamesSuccess,
  LoadBook,
  LoadBookFail,
  LoadBookSuccess,
  LoadBooks,
  LoadBooksFail,
  LoadBooksSuccess,
  ResetUpload,
  SetLevel,
  SetLevelFail,
  SetLevelSuccess,
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
  /** Books with a delete request in flight. */
  deletingIds: number[];
  /** The book opened on the book page. */
  current: {
    book: BookDetails | null;
    loading: boolean;
    error: string | null;
    /** The shown page of the book's words to learn. */
    words: {
      items: WordCount[];
      total: number;
      /** The page `items` are from, 1-based. */
      page: number;
      pageSize: number;
      /** The page last asked for; it becomes `page` once loaded. */
      requested: { page: number; pageSize: number };
      loading: boolean;
      error: string | null;
    };
  };
  upload: {
    uploading: boolean;
    /** Upload progress in percent, or null once the file has been sent. */
    progress: number | null;
    book: UploadedBook | null;
    error: string | null;
  };
  /**
   * Names of the uploaded book, reviewed in the upload wizard. Rows stay
   * when their status changes, so the user sees (and can undo) changes.
   */
  review: {
    names: WordCount[];
    loading: boolean;
    error: string | null;
  };
  /** Setting the user's knowledge level. */
  level: {
    saving: boolean;
    error: string | null;
  };
}

const initialList: BooksStateModel['list'] = {
  books: [],
  loading: false,
  error: null,
};
const initialWords: BooksStateModel['current']['words'] = {
  items: [],
  total: 0,
  page: 1,
  pageSize: BOOK_TOP_WORDS_LIMIT,
  requested: { page: 1, pageSize: BOOK_TOP_WORDS_LIMIT },
  loading: false,
  error: null,
};
const initialCurrent: BooksStateModel['current'] = {
  book: null,
  loading: false,
  error: null,
  words: initialWords,
};
const initialUpload: BooksStateModel['upload'] = {
  uploading: false,
  progress: null,
  book: null,
  error: null,
};
const initialReview: BooksStateModel['review'] = {
  names: [],
  loading: false,
  error: null,
};

const initialLevel: BooksStateModel['level'] = { saving: false, error: null };

type Ctx = StateContext<BooksStateModel>;

@State<BooksStateModel>({
  name: 'books',
  defaults: {
    deletingIds: [],
    list: initialList,
    current: initialCurrent,
    upload: initialUpload,
    review: initialReview,
    level: initialLevel,
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
  static uploadedBook(state: BooksStateModel): UploadedBook | null {
    return state.upload.book;
  }

  @Selector()
  static currentWords(
    state: BooksStateModel,
  ): BooksStateModel['current']['words'] {
    return state.current.words;
  }

  @Selector()
  static deletingIds(state: BooksStateModel): number[] {
    return state.deletingIds;
  }

  @Selector()
  static reviewNames(state: BooksStateModel): WordCount[] {
    return state.review.names;
  }

  @Selector()
  static reviewLoading(state: BooksStateModel): boolean {
    return state.review.loading;
  }

  @Selector()
  static reviewError(state: BooksStateModel): string | null {
    return state.review.error;
  }

  /** The user's knowledge-level word list, if they have one. */
  @Selector()
  static levelList(state: BooksStateModel): BookSummary | null {
    return state.list.books.find((book) => book.level !== null) ?? null;
  }

  @Selector()
  static level(state: BooksStateModel): CefrLevel | null {
    return BooksState.levelList(state)?.level ?? null;
  }

  @Selector()
  static levelSaving(state: BooksStateModel): boolean {
    return state.level.saving;
  }

  @Selector()
  static levelError(state: BooksStateModel): string | null {
    return state.level.error;
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
    // Page 1 comes with the book; other pages are loaded on demand.
    ctx.setState(
      patch({
        current: {
          ...initialCurrent,
          book,
          words: {
            ...initialWords,
            items: book.words,
            total: book.wordsToLearnCount,
          },
        },
      }),
    );
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
    body.append('wordStatus', payload.wordStatus);
    if (payload.description) {
      body.append('description', payload.description);
    }

    return this.http
      .post<UploadedBook>('/api/book', body, {
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
      deletingIds: [],
      list: initialList,
      current: initialCurrent,
      upload: initialUpload,
      review: initialReview,
      level: initialLevel,
    });
  }

  /**
   * Keeps the shown books' "words to learn" in step with the dictionary:
   * a word that's no longer to learn leaves the list, other changes update
   * its status.
   */
  @Action([ChangeWordStatusSuccess, MarkWordViewedSuccess])
  wordStatusChanged(
    ctx: Ctx,
    { word }: ChangeWordStatusSuccess | MarkWordViewedSuccess,
  ) {
    const { current, upload, review } = ctx.getState();
    const leaves = !WORDS_TO_LEARN_STATUSES.includes(word.status);
    const shown = current.words.items.some((w) => w.wordId === word.wordId);
    ctx.setState(
      patch({
        current: patch({
          book: withWordStatus(current.book, word),
          words: patch({
            items: leaves
              ? current.words.items.filter((w) => w.wordId !== word.wordId)
              : current.words.items.map((w) =>
                  w.wordId === word.wordId ? { ...w, status: word.status } : w,
                ),
            total:
              shown && leaves ? current.words.total - 1 : current.words.total,
          }),
        }),
        upload: patch({ book: withWordStatus(upload.book, word) }),
        review: patch({
          names: review.names.map((w) =>
            w.wordId === word.wordId ? { ...w, status: word.status } : w,
          ),
        }),
      }),
    );
    // A row left the page: reload it so the next word moves up into it.
    if (shown && leaves && current.book) {
      const { page, pageSize } = current.words;
      return ctx.dispatch(new LoadBookWords(current.book.id, page, pageSize));
    }
    return undefined;
  }

  @Action(DeleteBook)
  deleteBook(ctx: Ctx, { id }: DeleteBook) {
    ctx.setState(patch({ deletingIds: [...ctx.getState().deletingIds, id] }));
    return this.http.delete<void>(`/api/book/${id}`).pipe(
      mergeMap(() => ctx.dispatch(new DeleteBookSuccess(id))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new DeleteBookFail(id, httpErrorMessage(error))),
      ),
    );
  }

  @Action(DeleteBookSuccess)
  deleteBookSuccess(ctx: Ctx, { id }: DeleteBookSuccess) {
    const { deletingIds, list, current } = ctx.getState();
    ctx.setState(
      patch({
        deletingIds: deletingIds.filter((d) => d !== id),
        list: patch({ books: list.books.filter((b) => b.id !== id) }),
        current: current.book?.id === id ? initialCurrent : current,
      }),
    );
  }

  /** The error itself is shown by the page that asked for the delete. */
  @Action(DeleteBookFail)
  deleteBookFail(ctx: Ctx, { id }: DeleteBookFail) {
    ctx.setState(
      patch({
        deletingIds: ctx.getState().deletingIds.filter((d) => d !== id),
      }),
    );
  }

  @Action(LoadBookWords, { cancelUncompleted: true })
  loadBookWords(ctx: Ctx, { bookId, page, pageSize }: LoadBookWords) {
    // Keep showing the current page (with its numbering) until the new one
    // arrives.
    ctx.setState(
      patch({
        current: patch({
          words: patch({
            requested: { page, pageSize },
            loading: true,
            error: null,
          }),
        }),
      }),
    );
    return this.http
      .get<BookWordsPage>(`/api/book/${bookId}/words-to-learn`, {
        params: { page, pageSize },
      })
      .pipe(
        mergeMap((result) => ctx.dispatch(new LoadBookWordsSuccess(result))),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new LoadBookWordsFail(httpErrorMessage(error))),
        ),
      );
  }

  @Action(LoadBookWordsSuccess)
  loadBookWordsSuccess(ctx: Ctx, { page }: LoadBookWordsSuccess) {
    const { book } = ctx.getState().current;
    // Past the last page (its last words were just moved away): go back.
    const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
    if (book && page.items.length === 0 && page.page > lastPage) {
      return ctx.dispatch(new LoadBookWords(book.id, lastPage, page.pageSize));
    }
    ctx.setState(
      patch({
        current: patch({
          words: {
            ...initialWords,
            items: page.items,
            total: page.total,
            page: page.page,
            pageSize: page.pageSize,
            requested: { page: page.page, pageSize: page.pageSize },
          },
        }),
      }),
    );
    return undefined;
  }

  @Action(LoadBookWordsFail)
  loadBookWordsFail(ctx: Ctx, { error }: LoadBookWordsFail) {
    ctx.setState(
      patch({
        current: patch({ words: patch({ loading: false, error }) }),
      }),
    );
  }

  @Action(LoadBookNames, { cancelUncompleted: true })
  loadBookNames(ctx: Ctx, { bookId }: LoadBookNames) {
    ctx.setState(patch({ review: { ...initialReview, loading: true } }));
    return this.http
      .get<WordCount[]>(`/api/book/${bookId}/words`, {
        params: { status: WordStatus.NAME },
      })
      .pipe(
        mergeMap((words) => ctx.dispatch(new LoadBookNamesSuccess(words))),
        catchError((error: HttpErrorResponse) =>
          ctx.dispatch(new LoadBookNamesFail(httpErrorMessage(error))),
        ),
      );
  }

  @Action(LoadBookNamesSuccess)
  loadBookNamesSuccess(ctx: Ctx, { words }: LoadBookNamesSuccess) {
    ctx.setState(patch({ review: { ...initialReview, names: words } }));
  }

  @Action(LoadBookNamesFail)
  loadBookNamesFail(ctx: Ctx, { error }: LoadBookNamesFail) {
    ctx.setState(patch({ review: { ...initialReview, error } }));
  }

  @Action(SetLevel, { cancelUncompleted: true })
  setLevel(ctx: Ctx, { level }: SetLevel) {
    ctx.setState(patch({ level: { saving: true, error: null } }));
    return this.http.put<BookSummary | null>('/api/level', { level }).pipe(
      // An empty body (no list) comes back as null.
      mergeMap((list) => ctx.dispatch(new SetLevelSuccess(list ?? null))),
      catchError((error: HttpErrorResponse) =>
        ctx.dispatch(new SetLevelFail(httpErrorMessage(error))),
      ),
    );
  }

  @Action(SetLevelSuccess)
  setLevelSuccess(ctx: Ctx, { list }: SetLevelSuccess) {
    const { list: shown, current } = ctx.getState();
    const { books } = shown;
    // A changed list keeps its place; a new one goes first, as the newest.
    const changed = list !== null && books.some((book) => book.id === list.id);
    ctx.setState(
      patch({
        level: initialLevel,
        list: patch({
          books: changed
            ? books.map((book) => (book.id === list.id ? list : book))
            : [
                ...(list ? [list] : []),
                ...books.filter((book) => book.level === null),
              ],
        }),
      }),
    );
    // The open list has other words to learn now.
    if (list && current.book?.id === list.id) {
      return ctx.dispatch(new LoadBook(list.id));
    }
    return undefined;
  }

  @Action(SetLevelFail)
  setLevelFail(ctx: Ctx, { error }: SetLevelFail) {
    ctx.setState(patch({ level: { saving: false, error } }));
  }

  @Action(ResetUpload)
  resetUpload(ctx: Ctx) {
    ctx.setState(patch({ upload: initialUpload, review: initialReview }));
  }
}

function toSummary(book: BookDetails): BookSummary {
  const { id, name, description, wordCount, uniqueWordCount } = book;
  const { createdAt, level } = book;
  return {
    id,
    name,
    description,
    wordCount,
    uniqueWordCount,
    createdAt,
    level,
  };
}

function withWordStatus<T extends BookDetails>(
  book: T | null,
  changed: DictionaryWord,
): T | null {
  if (!book?.words.some((w) => w.wordId === changed.wordId)) {
    return book;
  }
  return {
    ...book,
    words:
      // Known, Name and Trash words aren't "to learn": drop them.
      !WORDS_TO_LEARN_STATUSES.includes(changed.status)
        ? book.words.filter((w) => w.wordId !== changed.wordId)
        : book.words.map((w) =>
            w.wordId === changed.wordId ? { ...w, status: changed.status } : w,
          ),
  };
}
