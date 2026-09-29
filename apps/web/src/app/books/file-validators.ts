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
