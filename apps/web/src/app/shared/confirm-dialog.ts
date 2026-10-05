import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

export interface ConfirmDialogData {
  title: string;
  message: string;
  /** Label of the confirming button, e.g. "Delete". */
  confirm: string;
}

/** Asks the user to confirm an action; closes with `true` if they do. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <!-- Focus starts on Cancel: Enter shouldn't confirm something
           destructive by accident. -->
      <button
        mat-button
        type="button"
        [mat-dialog-close]="false"
        cdkFocusInitial
      >
        Cancel
      </button>
      <button
        mat-flat-button
        type="button"
        class="confirm"
        [mat-dialog-close]="true"
      >
        {{ data.confirm }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .confirm {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
}

/**
 * Returns a function that opens the confirmation dialog and emits whether
 * the user confirmed. Call in an injection context.
 */
export function injectConfirm(): (
  data: ConfirmDialogData,
) => Observable<boolean> {
  const dialog = inject(MatDialog);
  return (data) =>
    dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data,
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(map((confirmed) => confirmed === true));
}
