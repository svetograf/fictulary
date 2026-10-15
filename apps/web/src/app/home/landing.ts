import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonRouterLink } from '@ionic/angular';

/** The home page for signed-out visitors: the logo, a pitch, sign-in. */
@Component({
  selector: 'app-landing',
  imports: [IonButton, IonRouterLink, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {}
