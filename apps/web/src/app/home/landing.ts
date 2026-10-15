import { Component, effect, input, untracked } from '@angular/core';
import { IonButton } from '@ionic/angular';
import { injectSignInDialog } from '../auth/sign-in-dialog';

/** The home page for signed-out visitors: the logo, a pitch, sign-in. */
@Component({
  selector: 'app-landing',
  imports: [IonButton],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  /**
   * Set when a page needed a session (see authGuard): opens sign-in right
   * away and returns there after.
   */
  readonly returnUrl = input<string>();

  protected readonly openSignIn = injectSignInDialog();

  constructor() {
    effect(() => {
      const returnUrl = this.returnUrl();
      if (returnUrl) {
        untracked(() => this.openSignIn({ mode: 'sign-in', returnUrl }));
      }
    });
  }
}
