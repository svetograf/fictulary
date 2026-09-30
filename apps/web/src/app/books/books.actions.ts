import { BookDetails, BookSummary, WordStatus } from '@fictulary/shared/models';

export interface UploadBookPayload {
  file: File;
  name: string;
  description: string;
  /** Status for the book's words in the uploader's dictionary. */
  wordStatus: WordStatus;
}

export class LoadBooks {
  static readonly type = '[Books] LOAD_BOOKS';
}

export class LoadBooksSuccess {
  static readonly type = '[Books] LOAD_BOOKS_SUCCESS';
  constructor(public readonly books: BookSummary[]) {}
}

export class LoadBooksFail {
  static readonly type = '[Books] LOAD_BOOKS_FAIL';
  constructor(public readonly error: string) {}
}

export class LoadBook {
  static readonly type = '[Books] LOAD_BOOK';
  constructor(public readonly id: number) {}
}

export class LoadBookSuccess {
  static readonly type = '[Books] LOAD_BOOK_SUCCESS';
  constructor(public readonly book: BookDetails) {}
}

export class LoadBookFail {
  static readonly type = '[Books] LOAD_BOOK_FAIL';
  constructor(public readonly error: string) {}
}

export class UploadFile {
  static readonly type = '[Books] UPLOAD_FILE';
  constructor(public readonly payload: UploadBookPayload) {}
}

export class UploadFileProgress {
  static readonly type = '[Books] UPLOAD_FILE_PROGRESS';
  constructor(public readonly percent: number) {}
}

export class UploadFileSuccess {
  static readonly type = '[Books] UPLOAD_FILE_SUCCESS';
  constructor(public readonly book: BookDetails) {}
}

export class UploadFileFail {
  static readonly type = '[Books] UPLOAD_FILE_FAIL';
  constructor(public readonly error: string) {}
}

export class ResetUpload {
  static readonly type = '[Books] RESET_UPLOAD';
}
