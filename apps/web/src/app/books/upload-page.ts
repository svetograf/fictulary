import { DecimalPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_FILE_MAX_SIZE,
  BOOK_NAME_MAX_LENGTH,
  WordStatus,
} from '@fictulary/shared/models';
import { RouterLink } from '@angular/router';
import { select } from '@ngxs/store';
import { BookDetailsCard } from './book-details-card';
import { READING_OPTIONS } from './reading-status';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { notBlank } from '../shared/validators';
import {
  fileExtension,
  maxFileSize,
  maxTextBytes,
  utf8Bytes,
} from './file-validators';

type TextSource = 'file' | 'text';

/** The backend accepts .txt uploads; pasted text is sent as one. */
const PASTED_FILE_NAME = 'pasted-text.txt';

@Component({
  selector: 'app-upload-page',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    BookDetailsCard,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss',
})
export class UploadPage {
  private readonly books = inject(BooksService);

  protected readonly uploading = select(BooksState.uploading);
  protected readonly progress = select(BooksState.uploadProgress);
  protected readonly book = select(BooksState.uploadedBook);
  protected readonly error = select(BooksState.uploadError);

  protected readonly limits = {
    fileSizeMb: BOOK_FILE_MAX_SIZE / (1024 * 1024),
    name: BOOK_NAME_MAX_LENGTH,
    description: BOOK_DESCRIPTION_MAX_LENGTH,
  };
  protected readonly readingOptions = READING_OPTIONS;
  protected readonly readingHint = (status: WordStatus) =>
    READING_OPTIONS.find((option) => option.status === status)?.hint;
  protected readonly dragging = signal(false);

  protected readonly form = new FormGroup({
    /** Where the book's text comes from. */
    source: new FormControl<TextSource>('file', { nonNullable: true }),
    file: new FormControl<File | null>(null, [
      Validators.required,
      fileExtension('.txt'),
      maxFileSize(BOOK_FILE_MAX_SIZE),
    ]),
    text: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        notBlank,
        maxTextBytes(BOOK_FILE_MAX_SIZE),
      ],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        notBlank,
        Validators.maxLength(BOOK_NAME_MAX_LENGTH),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BOOK_DESCRIPTION_MAX_LENGTH)],
    }),
    wordStatus: new FormControl(WordStatus.UNKNOWN, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly controls = this.form.controls;

  /** Pasted text size, as uploaded. */
  protected readonly textKb = computed(
    () => utf8Bytes(this.textValue()) / 1024,
  );
  private readonly textValue = toSignal(this.controls.text.valueChanges, {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      if (this.uploading()) {
        this.form.disable();
      } else {
        this.form.enable();
        this.syncSource();
      }
    });
    this.controls.source.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.syncSource());
    this.syncSource();
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    // Allow picking the same file again after it was cleared.
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.form.disabled) {
      this.dragging.set(true);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.form.disabled) {
      this.setFile(event.dataTransfer?.files[0] ?? null);
    }
  }

  protected clearFile(): void {
    this.setFile(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const {
      source,
      file: chosen,
      text,
      name,
      description,
      wordStatus,
    } = this.form.getRawValue();
    // Pasted text goes through the same upload as a .txt file.
    const file =
      source === 'text'
        ? new File([text], PASTED_FILE_NAME, { type: 'text/plain' })
        : chosen;
    if (file) {
      this.books.upload({
        file,
        name: name.trim(),
        description: description.trim(),
        wordStatus,
      });
    }
  }

  /** Only the active source is validated and submitted. */
  private syncSource(): void {
    // form.disable() during an upload also emits a source change; the whole
    // form must stay disabled until the upload ends.
    if (this.uploading()) {
      return;
    }
    const { source, file, text } = this.controls;
    const [active, inactive] =
      source.value === 'file' ? [file, text] : [text, file];
    active.enable({ emitEvent: false });
    inactive.disable({ emitEvent: false });
  }

  private setFile(file: File | null): void {
    const { file: fileControl, name } = this.form.controls;
    fileControl.setValue(file);
    fileControl.markAsTouched();
    // Suggest the file name unless the user has typed a name themselves.
    if (file && !name.dirty) {
      name.setValue(
        file.name.replace(/\.[^.]+$/, '').slice(0, BOOK_NAME_MAX_LENGTH),
      );
    }
  }
}
