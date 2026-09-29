import { HttpErrorResponse } from '@angular/common/http';

/** A user-facing message for a failed API request. */
export function httpErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Could not reach the server. Please try again.';
  }
  const message: unknown = error.error?.message;
  if (Array.isArray(message)) {
    return message.join('. ');
  }
  return typeof message === 'string' ? message : error.message;
}
