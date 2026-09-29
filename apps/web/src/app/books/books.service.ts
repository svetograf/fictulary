import { Injectable } from '@angular/core';
import { dispatch } from '@ngxs/store';
import { ResetUpload, UploadBookPayload, UploadFile } from './books.actions';

/**
 * Entry point for components to trigger book actions. API calls and data
 * handling live in BooksState; read data through its selectors.
 */
@Injectable({ providedIn: 'root' })
export class BooksService {
  private readonly dispatchUpload = dispatch(UploadFile);
  private readonly dispatchReset = dispatch(ResetUpload);

  upload(payload: UploadBookPayload) {
    return this.dispatchUpload(payload);
  }

  reset() {
    return this.dispatchReset();
  }
}
