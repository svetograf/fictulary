import { inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Observable, from, map, switchMap } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Label of the confirming button, e.g. "Delete". */
  confirm: string;
}

/**
 * Returns a function that asks the user to confirm an action in an alert
 * and emits whether they did. Call in an injection context.
 */
export function injectConfirm(): (
  data: ConfirmDialogData,
) => Observable<boolean> {
  const alerts = inject(AlertController);
  return (data) =>
    from(
      alerts.create({
        header: data.title,
        message: data.message,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: data.confirm,
            role: 'confirm',
            cssClass: 'alert-button-danger',
          },
        ],
      }),
    ).pipe(
      switchMap(async (alert) => {
        await alert.present();
        return alert.onDidDismiss();
      }),
      map(({ role }) => role === 'confirm'),
    );
}
