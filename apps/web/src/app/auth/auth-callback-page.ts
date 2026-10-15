import { Component } from '@angular/core';
import { IonContent, IonSpinner } from '@ionic/angular';

/**
 * Google and Apple send their sign-in popup here (AUTH_CALLBACK_PATH). The
 * social login plugin, imported in main.ts, passes the result to the page
 * that opened the popup and closes it, so this only shows briefly.
 */
@Component({
  selector: 'app-auth-callback-page',
  imports: [IonContent, IonSpinner],
  template: `
    <ion-content>
      <div class="page-content">
        <ion-spinner name="crescent" />
        <p>Finishing sign-in…</p>
      </div>
    </ion-content>
  `,
  styles: `
    .page-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding-top: 48px;
      color: var(--ion-color-medium);
    }
  `,
  host: { class: 'ion-page' },
})
export class AuthCallbackPage {}
