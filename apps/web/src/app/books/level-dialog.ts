import { Component, DestroyRef, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { Actions, ofActionSuccessful, select } from '@ngxs/store';
import { SetLevelSuccess } from './books.actions';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { LevelPicker } from './level-picker';

/** Matches the sign-in dialog: a centered dialog from here, a sheet below. */
const DESKTOP = '(min-width: 768px) and (min-height: 600px)';

/** Sets or changes the user's knowledge level from the books pages. */
@Component({
  selector: 'app-level-dialog',
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonToolbar, LevelPicker],
  template: `
    <ion-header>
      <ion-toolbar class="header">
        <h2 class="title">Your English level</h2>
        <ion-buttons slot="end">
          <ion-button aria-label="Close" (click)="close()">
            <ion-icon slot="icon-only" name="close" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <div class="body">
      <p class="intro">
        The words up to your level go to your dictionary as known, in a word
        list you can change or delete like a book.
      </p>
      <app-level-picker
        [level]="level()"
        [submitLabel]="level() ? 'Change level' : 'Add words'"
        [saving]="saving()"
        [error]="error()"
        (choose)="books.setLevel($event)"
      />
    </div>
  `,
  // Same header band and content-sized body as the sign-in dialog.
  styleUrl: '../auth/sign-in-dialog.scss',
})
export class LevelDialog {
  protected readonly books = inject(BooksService);
  private readonly modals = inject(ModalController);

  protected readonly level = select(BooksState.level);
  protected readonly saving = select(BooksState.levelSaving);
  protected readonly error = select(BooksState.levelError);

  constructor() {
    const subscription = inject(Actions)
      .pipe(ofActionSuccessful(SetLevelSuccess))
      .subscribe(() => this.close());
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected close(): void {
    void this.modals.dismiss();
  }
}

/**
 * Returns a function that opens the level dialog: centered on wide screens,
 * a bottom sheet on phones. Call in an injection context.
 */
export function injectLevelDialog(): () => void {
  const modals = inject(ModalController);
  return () => {
    const desktop = matchMedia(DESKTOP).matches;
    void modals
      .create({
        component: LevelDialog,
        cssClass: desktop ? 'form-dialog' : 'form-sheet',
        ...(!desktop && { breakpoints: [0, 1], initialBreakpoint: 1 }),
      })
      .then((modal) => modal.present());
  };
}
