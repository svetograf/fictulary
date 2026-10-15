import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonRouterLink,
  IonRouterOutlet,
  IonToolbar,
  NavController,
} from '@ionic/angular';
import { select } from '@ngxs/store';
import { AuthService } from './auth/auth.service';
import { AuthState } from './auth/auth.state';
import { AUTH_CALLBACK_PATH } from './auth/social-login.service';

/** Pages that handle a missing name themselves or must not be left. */
const NAME_PROMPT_EXEMPT = ['/welcome', '/sign-in', AUTH_CALLBACK_PATH];

@Component({
  imports: [
    RouterLink,
    RouterLinkActive,
    IonApp,
    IonButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonRouterLink,
    IonRouterOutlet,
    IonToolbar,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly router = inject(Router);

  protected readonly title = 'Fictulary';
  protected readonly signedIn = select(AuthState.isAuthenticated);
  protected readonly user = select(AuthState.user);
  private readonly needsName = select(AuthState.needsName);

  constructor() {
    // A restored session whose user never picked a name (e.g. closed the
    // app on the welcome page). Fresh sign-ins are routed by SignInPage.
    effect(() => {
      const url = this.router.url;
      const path = url.split(/[?#]/)[0];
      if (this.needsName() && !NAME_PROMPT_EXEMPT.includes(path)) {
        this.nav.navigateRoot(['/welcome'], {
          queryParams: { returnUrl: url },
        });
      }
    });
  }

  protected signOut(): void {
    this.auth.signOut();
    this.nav.navigateRoot('/');
  }
}
