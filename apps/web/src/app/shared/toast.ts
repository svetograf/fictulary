import { inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

/**
 * Returns a function that shows a message in a toast for a few seconds.
 * Call in an injection context.
 */
export function injectToast(): (message: string) => void {
  const toasts = inject(ToastController);
  return (message) =>
    void toasts
      .create({
        message,
        duration: 5000,
        buttons: [{ text: 'Dismiss', role: 'cancel' }],
      })
      .then((toast) => toast.present());
}
