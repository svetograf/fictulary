import {
  BookDetails,
  BookSummary,
  BookWordsPage,
  UploadedBook,
  WordCount,
  WordStatus,
} from '@fictulary/shared/models';

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

/** A page of the open book's words to learn (the book carries page 1). */
export class LoadBookWords {
  static readonly type = '[Books] LOAD_BOOK_WORDS';
  constructor(
    public readonly bookId: number,
    public readonly page: number,
    public readonly pageSize: number,
  ) {}
}

export class LoadBookWordsSuccess {
  static readonly type = '[Books] LOAD_BOOK_WORDS_SUCCESS';
  constructor(public readonly page: BookWordsPage) {}
}

export class LoadBookWordsFail {
  static readonly type = '[Books] LOAD_BOOK_WORDS_FAIL';
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
  constructor(public readonly book: UploadedBook) {}
}

export class UploadFileFail {
  static readonly type = '[Books] UPLOAD_FILE_FAIL';
  constructor(public readonly error: string) {}
}

/** The names in a just-uploaded book, for the upload wizard to review. */
export class LoadBookNames {
  static readonly type = '[Books] LOAD_BOOK_NAMES';
  constructor(public readonly bookId: number) {}
}

export class LoadBookNamesSuccess {
  static readonly type = '[Books] LOAD_BOOK_NAMES_SUCCESS';
  constructor(public readonly words: WordCount[]) {}
}

export class LoadBookNamesFail {
  static readonly type = '[Books] LOAD_BOOK_NAMES_FAIL';
  constructor(public readonly error: string) {}
}

export class DeleteBook {
  static readonly type = '[Books] DELETE_BOOK';
  constructor(public readonly id: number) {}
}

export class DeleteBookSuccess {
  static readonly type = '[Books] DELETE_BOOK_SUCCESS';
  constructor(public readonly id: number) {}
}

export class DeleteBookFail {
  static readonly type = '[Books] DELETE_BOOK_FAIL';
  constructor(
    public readonly id: number,
    public readonly error: string,
  ) {}
}

export class ResetUpload {
  static readonly type = '[Books] RESET_UPLOAD';
}
