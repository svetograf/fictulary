import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Rejects values made only of whitespace, which `required` lets through. */
export const notBlank: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null =>
  control.value && !control.value.trim() ? { required: true } : null;
