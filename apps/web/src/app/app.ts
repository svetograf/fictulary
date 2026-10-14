import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
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

  protected readonly title = 'Fictulary';
  protected readonly signedIn = select(AuthState.isAuthenticated);
  protected readonly user = select(AuthState.user);

  protected signOut(): void {
    this.auth.signOut();
    this.nav.navigateRoot('/');
  }
}
