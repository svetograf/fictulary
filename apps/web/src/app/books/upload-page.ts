import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
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
import { MatTableModule } from '@angular/material/table';
import {
  BOOK_DESCRIPTION_MAX_LENGTH,
  BOOK_FILE_MAX_SIZE,
  BOOK_NAME_MAX_LENGTH,
  BookStatus,
} from '@fictulary/shared/models';
import { select } from '@ngxs/store';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { fileExtension, maxFileSize, notBlank } from './file-validators';

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  [BookStatus.NOT_READ]: 'Not read',
  [BookStatus.READING]: 'Reading',
  [BookStatus.READ]: 'Read',
};

@Component({
  selector: 'app-upload-page',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './upload-page.html',
  styleUrl: './upload-page.scss',
})
export class UploadPage {
  private readonly books = inject(BooksService);

  protected readonly uploading = select(BooksState.uploading);
  protected readonly progress = select(BooksState.progress);
  protected readonly book = select(BooksState.book);
  protected readonly error = select(BooksState.error);

  protected readonly limits = {
    fileSizeMb: BOOK_FILE_MAX_SIZE / (1024 * 1024),
    name: BOOK_NAME_MAX_LENGTH,
    description: BOOK_DESCRIPTION_MAX_LENGTH,
  };
  protected readonly statuses = Object.values(BookStatus);
  protected readonly statusLabels = BOOK_STATUS_LABELS;
  protected readonly wordColumns = ['rank', 'word', 'count'];
  protected readonly dragging = signal(false);

  protected readonly form = new FormGroup({
    file: new FormControl<File | null>(null, [
      Validators.required,
      fileExtension('.txt'),
      maxFileSize(BOOK_FILE_MAX_SIZE),
    ]),
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
    status: new FormControl(BookStatus.NOT_READ, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected readonly controls = this.form.controls;

  constructor() {
    effect(() => {
      if (this.uploading()) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    });
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
    const { file, name, description, status } = this.form.getRawValue();
    if (file) {
      this.books.upload({
        file,
        name: name.trim(),
        description: description.trim(),
        status,
      });
    }
  }

  protected maxWordCount(): number {
    return this.book()?.words[0]?.count ?? 1;
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
