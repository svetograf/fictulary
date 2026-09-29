import { Injectable } from '@angular/core';
import { dispatch } from '@ngxs/store';
import {
  LoadBook,
  LoadBooks,
  ResetUpload,
  UploadBookPayload,
  UploadFile,
} from './books.actions';

/**
 * Entry point for components to trigger book actions. API calls and data
 * handling live in BooksState; read data through its selectors.
 */
@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly dispatchLoadBooks = dispatch(LoadBooks);
  private readonly dispatchLoadBook = dispatch(LoadBook);
  private readonly dispatchUpload = dispatch(UploadFile);
  private readonly dispatchReset = dispatch(ResetUpload);

  loadBooks() {
    return this.dispatchLoadBooks();
  }

  loadBook(id: number) {
    return this.dispatchLoadBook(id);
  }

  upload(payload: UploadBookPayload) {
    return this.dispatchUpload(payload);
  }

  reset() {
    return this.dispatchReset();
  }
}
