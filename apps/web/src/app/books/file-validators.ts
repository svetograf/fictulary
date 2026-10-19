import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** `limit` may depend on the file, e.g. its type. */
export function maxFileSize(
  limit: number | ((file: File) => number),
): ValidatorFn {
  return (control: AbstractControl<File | null>): ValidationErrors | null => {
    const file = control.value;
    if (!file) {
      return null;
    }
    const maxBytes = typeof limit === 'number' ? limit : limit(file);
    return file.size > maxBytes
      ? { maxFileSize: { maxBytes, actualBytes: file.size } }
      : null;
  };
}

export function fileExtension(extensions: string[]): ValidatorFn {
  return (control: AbstractControl<File | null>): ValidationErrors | null => {
    const name = control.value?.name.toLowerCase();
    return name && !extensions.some((extension) => name.endsWith(extension))
      ? { fileExtension: { extensions } }
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
