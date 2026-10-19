import { Injectable } from '@angular/core';
import { CefrLevel } from '@fictulary/shared/models';
import { dispatch } from '@ngxs/store';
import {
  DeleteBook,
  LoadBookWords,
  LoadBookNames,
  LoadBook,
  LoadBooks,
  ResetUpload,
  SetLevel,
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
  private readonly dispatchLoadBookNames = dispatch(LoadBookNames);
  private readonly dispatchDeleteBook = dispatch(DeleteBook);
  private readonly dispatchLoadBookWords = dispatch(LoadBookWords);
  private readonly dispatchUpload = dispatch(UploadFile);
  private readonly dispatchReset = dispatch(ResetUpload);
  private readonly dispatchSetLevel = dispatch(SetLevel);

  loadBooks() {
    return this.dispatchLoadBooks();
  }

  loadBook(id: number) {
    return this.dispatchLoadBook(id);
  }

  loadBookWords(bookId: number, page: number, pageSize: number) {
    return this.dispatchLoadBookWords(bookId, page, pageSize);
  }

  deleteBook(id: number) {
    return this.dispatchDeleteBook(id);
  }

  loadBookNames(bookId: number) {
    return this.dispatchLoadBookNames(bookId);
  }

  upload(payload: UploadBookPayload) {
    return this.dispatchUpload(payload);
  }

  reset() {
    return this.dispatchReset();
  }

  setLevel(level: CefrLevel | null) {
    return this.dispatchSetLevel(level);
  }
}
