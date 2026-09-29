import { BookResult, BookStatus } from '@fictulary/shared/models';

export interface UploadBookPayload {
  file: File;
  name: string;
  description: string;
  status: BookStatus;
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
  constructor(public readonly book: BookResult) {}
}

export class UploadFileFail {
  static readonly type = '[Books] UPLOAD_FILE_FAIL';
  constructor(public readonly error: string) {}
}

export class ResetUpload {
  static readonly type = '[Books] RESET_UPLOAD';
}
