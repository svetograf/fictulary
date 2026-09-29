import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function maxFileSize(maxBytes: number): ValidatorFn {
  return (control: AbstractControl<File | null>): ValidationErrors | null => {
    const file = control.value;
    return file && file.size > maxBytes
      ? { maxFileSize: { maxBytes, actualBytes: file.size } }
      : null;
  };
}

export function fileExtension(extension: string): ValidatorFn {
  return (control: AbstractControl<File | null>): ValidationErrors | null => {
    const file = control.value;
    return file && !file.name.toLowerCase().endsWith(extension)
      ? { fileExtension: { extension } }
      : null;
  };
}

/** Rejects values made only of whitespace, which `required` lets through. */
export const notBlank: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null =>
  control.value && !control.value.trim() ? { required: true } : null;
