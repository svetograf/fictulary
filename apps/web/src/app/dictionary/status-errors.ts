import { DestroyRef, inject } from '@angular/core';
import { Actions, ofActionDispatched } from '@ngxs/store';
import { injectToast } from '../shared/toast';
import { ChangeWordStatusFail } from './dictionary.actions';

/**
 * Shows failed word status changes as notifications for as long as the
 * calling component lives. Call from a constructor or field initializer.
 */
export function notifyWordStatusErrors(): void {
  const toast = injectToast();
  const subscription = inject(Actions)
    .pipe(ofActionDispatched(ChangeWordStatusFail))
    .subscribe(({ error }: ChangeWordStatusFail) => toast(error));
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}
