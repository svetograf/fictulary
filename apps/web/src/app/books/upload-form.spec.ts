import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { ResetUpload, UploadFile } from './books.actions';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { ionicUpdates } from '../shared/ionic-testing';
import { UploadForm } from './upload-form';

type Form = UploadForm['form'];

/** jsdom's File has no text(); read it the old way. */
const readText = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(file);
  });

describe('UploadForm', () => {
  const books = { upload: vi.fn(), reset: vi.fn() };
  let form: Form;
  let element: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<UploadForm>>;

  const txt = (name: string, size = 10) =>
    new File(['x'.repeat(size)], name, { type: 'text/plain' });

  const drop = (file: File) => {
    const event = new Event('drop') as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    element.querySelector('.drop-zone')?.dispatchEvent(event);
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [UploadForm],
      providers: [
        provideStore([BooksState]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BooksService, useValue: books },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UploadForm);
    await fixture.whenStable();
    element = fixture.nativeElement;
    form = (fixture.componentInstance as unknown as { form: Form }).form;
  });

  it('pre-fills the name from the dropped file name', () => {
    drop(txt('War and Peace.txt'));
    expect(form.controls.file.value?.name).toBe('War and Peace.txt');
    expect(form.controls.name.value).toBe('War and Peace');
  });

  it('keeps a name the user typed', () => {
    form.controls.name.setValue('My title');
    form.controls.name.markAsDirty();
    drop(txt('other.txt'));
    expect(form.controls.name.value).toBe('My title');
  });

  it('validates file type and size', () => {
    const file = form.controls.file;
    expect(file.hasError('required')).toBe(true);

    file.setValue(txt('book.pdf'));
    expect(file.hasError('fileExtension')).toBe(true);

    file.setValue(txt('book.txt', 1024 * 1024 + 1));
    expect(file.hasError('maxFileSize')).toBe(true);

    file.setValue(txt('book.txt', 1024 * 1024));
    expect(file.valid).toBe(true);
  });

  it('validates name and description lengths', () => {
    const { name, description } = form.controls;
    name.setValue('   ');
    expect(name.hasError('required')).toBe(true);
    name.setValue('a'.repeat(1001));
    expect(name.hasError('maxlength')).toBe(true);

    description.setValue('a'.repeat(5001));
    expect(description.hasError('maxlength')).toBe(true);
    description.setValue('');
    expect(description.valid).toBe(true);
  });

  it('does not upload an invalid form', () => {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(books.upload).not.toHaveBeenCalled();
    expect(form.controls.file.touched).toBe(true);
  });

  it('uploads through the books service, new words as unknown', () => {
    const file = txt('tale.txt');
    drop(file);
    form.controls.description.setValue('  Classic  ');

    element.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(books.upload).toHaveBeenCalledWith({
      file,
      name: 'tale',
      description: 'Classic',
      wordStatus: WordStatus.UNKNOWN,
    });
  });

  it('adds all the words as known when the box is checked', async () => {
    const checkbox = element.querySelector<HTMLIonCheckboxElement>(
      'ion-checkbox.all-known',
    );
    expect(checkbox?.textContent?.trim()).toBe(
      'Add all the words as known to my dictionary',
    );
    expect(checkbox?.checked).toBe(false);

    drop(txt('tale.txt'));
    checkbox?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(form.controls.allKnown.value).toBe(true);

    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(books.upload).toHaveBeenCalledWith(
      expect.objectContaining({ wordStatus: WordStatus.KNOWN }),
    );
  });

  describe('pasting text', () => {
    const pasteMode = async () => {
      form.controls.source.setValue('text');
      await fixture.whenStable();
    };
    const submit = () =>
      element.querySelector('form')?.dispatchEvent(new Event('submit'));

    it('starts with a file and switches to a text box', async () => {
      expect(form.controls.text.disabled).toBe(true);
      expect(element.querySelector('.drop-zone')).not.toBeNull();
      expect(
        element.querySelector('ion-textarea[formcontrolname=text]'),
      ).toBeNull();

      await pasteMode();

      expect(element.querySelector('.drop-zone')).toBeNull();
      expect(
        element.querySelector('ion-textarea[formcontrolname=text]'),
      ).not.toBeNull();
      // Only the active source is validated.
      expect(form.controls.file.disabled).toBe(true);
      expect(form.controls.text.enabled).toBe(true);
    });

    it('requires some text, not just whitespace', async () => {
      await pasteMode();
      form.controls.name.setValue('Pasted');
      form.controls.text.setValue('   ');
      submit();
      expect(books.upload).not.toHaveBeenCalled();
      expect(form.controls.text.hasError('required')).toBe(true);
    });

    it('limits the text to 1 MB once encoded', async () => {
      await pasteMode();
      // "é" is 2 bytes in UTF-8, so 512 Ki of them is exactly 1 MB: allowed...
      form.controls.text.setValue('é'.repeat(512 * 1024));
      expect(form.controls.text.valid).toBe(true);
      // ...and one more byte is too much.
      form.controls.text.setValue('é'.repeat(512 * 1024) + 'x');
      expect(form.controls.text.hasError('maxTextBytes')).toBe(true);
    });

    it('shows the text size as it will be uploaded', async () => {
      await pasteMode();
      form.controls.text.setValue('é'.repeat(1024));
      await fixture.whenStable();
      await ionicUpdates();
      expect(
        element.querySelector('ion-textarea.text .helper-text')?.textContent,
      ).toBe('2 KB / 1 MB');
    });

    it('uploads the text as a .txt file', async () => {
      await pasteMode();
      form.controls.name.setValue('Pasted book');
      form.controls.text.setValue('The cat was here.');
      submit();

      expect(books.upload).toHaveBeenCalledTimes(1);
      const { file, name } = books.upload.mock.calls[0][0];
      expect(name).toBe('Pasted book');
      expect(file.name).toBe('pasted-text.txt');
      expect(file.type).toBe('text/plain');
      await expect(readText(file)).resolves.toBe('The cat was here.');
    });

    it('keeps the inactive source disabled after an upload finishes', async () => {
      await pasteMode();
      const store = TestBed.inject(Store);
      store.dispatch(
        new UploadFile({
          file: new File(['The cat.'], 'pasted-text.txt'),
          name: 'Pasted',
          description: '',
          wordStatus: WordStatus.UNKNOWN,
        }),
      );
      await fixture.whenStable();
      expect(form.disabled).toBe(true);

      TestBed.inject(HttpTestingController)
        .expectOne('/api/book')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      // Re-enabling the form must not re-enable the file input.
      expect(form.controls.text.enabled).toBe(true);
      expect(form.controls.file.disabled).toBe(true);
    });
  });

  it('clears itself when a new upload starts', async () => {
    drop(txt('tale.txt'));
    form.controls.allKnown.setValue(true);
    form.controls.source.setValue('text');
    await fixture.whenStable();

    TestBed.inject(Store).dispatch(new ResetUpload());
    await fixture.whenStable();

    expect(form.controls.file.value).toBeNull();
    expect(form.controls.name.value).toBe('');
    expect(form.controls.allKnown.value).toBe(false);
    expect(form.controls.source.value).toBe('file');
    // The file input is the active source again.
    expect(form.controls.file.enabled).toBe(true);
    expect(form.controls.text.disabled).toBe(true);
  });
});
