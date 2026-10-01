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

/** Limits text by its UTF-8 size, the size it has once uploaded. */
export function maxTextBytes(maxBytes: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const bytes = utf8Bytes(control.value ?? '');
    return bytes > maxBytes
      ? { maxTextBytes: { maxBytes, actualBytes: bytes } }
      : null;
  };
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
