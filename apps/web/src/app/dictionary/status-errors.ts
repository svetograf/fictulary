import { DestroyRef, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Actions, ofActionDispatched } from '@ngxs/store';
import { ChangeWordStatusFail } from './dictionary.actions';

/**
 * Shows failed word status changes as notifications for as long as the
 * calling component lives. Call from a constructor or field initializer.
 */
export function notifyWordStatusErrors(): void {
  const snackBar = inject(MatSnackBar);
  const subscription = inject(Actions)
    .pipe(ofActionDispatched(ChangeWordStatusFail))
    .subscribe(({ error }: ChangeWordStatusFail) =>
      snackBar.open(error, 'Dismiss', { duration: 5000 }),
    );
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}
