import {
  HttpClient,
  HttpErrorResponse,
  HttpEventType,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BookResult } from '@fictulary/shared/models';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { catchError, map, mergeMap, of } from 'rxjs';
import {
  ResetUpload,
  UploadFile,
  UploadFileFail,
  UploadFileProgress,
  UploadFileSuccess,
} from './books.actions';

export interface BooksStateModel {
  uploading: boolean;
  /** Upload progress in percent, or null once the file has been sent. */
  progress: number | null;
  book: BookResult | null;
  error: string | null;
}

const defaults: BooksStateModel = {
  uploading: false,
  progress: null,
  book: null,
  error: null,
};

@State<BooksStateModel>({ name: 'books', defaults })
@Injectable()
export class BooksState {
  private readonly http = inject(HttpClient);

  @Selector()
  static uploading(state: BooksStateModel): boolean {
    return state.uploading;
  }

  @Selector()
  static progress(state: BooksStateModel): number | null {
    return state.progress;
  }

  @Selector()
  static book(state: BooksStateModel): BookResult | null {
    return state.book;
  }

  @Selector()
  static error(state: BooksStateModel): string | null {
    return state.error;
  }

  @Action(UploadFile, { cancelUncompleted: true })
  uploadFile(ctx: StateContext<BooksStateModel>, { payload }: UploadFile) {
    ctx.setState({ ...defaults, uploading: true, progress: 0 });

    const body = new FormData();
    body.append('file', payload.file);
    body.append('name', payload.name);
    body.append('status', payload.status);
    if (payload.description) {
      body.append('description', payload.description);
    }

    return this.http
      .post<BookResult>('/api/book', body, {
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
          ctx.dispatch(new UploadFileFail(errorMessage(error))),
        ),
        map(() => undefined),
      );
  }

  @Action(UploadFileProgress)
  uploadFileProgress(
    ctx: StateContext<BooksStateModel>,
    { percent }: UploadFileProgress,
  ) {
    // Once the file is fully sent the server is still counting words.
    ctx.patchState({ progress: percent < 100 ? percent : null });
  }

  @Action(UploadFileSuccess)
  uploadFileSuccess(
    ctx: StateContext<BooksStateModel>,
    { book }: UploadFileSuccess,
  ) {
    ctx.setState({ ...defaults, book });
  }

  @Action(UploadFileFail)
  uploadFileFail(
    ctx: StateContext<BooksStateModel>,
    { error }: UploadFileFail,
  ) {
    ctx.setState({ ...defaults, error });
  }

  @Action(ResetUpload)
  resetUpload(ctx: StateContext<BooksStateModel>) {
    ctx.setState(defaults);
  }
}

function errorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Could not reach the server. Please try again.';
  }
  const message: unknown = error.error?.message;
  if (Array.isArray(message)) {
    return message.join('. ');
  }
  return typeof message === 'string' ? message : error.message;
}
