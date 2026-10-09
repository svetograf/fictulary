import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonApp,
  IonHeader,
  IonRouterLinkWithHref,
  IonRouterOutlet,
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
    IonHeader,
    IonRouterOutlet,
    IonRouterLinkWithHref,
    MatToolbarModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
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
