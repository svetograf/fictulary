import { Component, effect, input, output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { USER_NAME_MAX_LENGTH } from '@fictulary/shared/models';
import { IonButton, IonIcon, IonInput, IonSpinner } from '@ionic/angular';
import { notBlank } from '../shared/validators';

/** Edits the user's display name; used on the welcome and account pages. */
@Component({
  selector: 'app-name-form',
  imports: [IonButton, IonIcon, IonInput, IonSpinner, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <ion-input
        label="Name"
        labelPlacement="floating"
        fill="outline"
        formControlName="name"
        autocomplete="name"
        required
        [errorText]="
          form.controls.name.hasError('maxlength')
            ? 'Name must be at most ' + maxLength + ' characters.'
            : 'Name is required.'
        "
      />

      @if (error(); as message) {
        <p class="error" role="alert">
          <ion-icon name="alert-circle-outline" aria-hidden="true" />
          {{ message }}
        </p>
      }

      <div class="actions">
        <ion-button type="submit" [disabled]="submitting()">
          {{ submitLabel() }}
        </ion-button>
        @if (submitting()) {
          <ion-spinner name="crescent" />
        }
      </div>
    </form>
  `,
  styleUrl: './auth-page.scss',
})
export class NameForm {
  readonly name = input<string | null>(null);
  readonly submitLabel = input.required<string>();
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly save = output<string>();

  protected readonly maxLength = USER_NAME_MAX_LENGTH;
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        notBlank,
        Validators.maxLength(USER_NAME_MAX_LENGTH),
      ],
    }),
  });

  constructor() {
    effect(() => this.form.setValue({ name: this.name() ?? '' }));
    effect(() => {
      if (this.submitting()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(this.form.getRawValue().name.trim());
  }
}
