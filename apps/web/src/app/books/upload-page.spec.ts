import { TestBed } from '@angular/core/testing';
import { BookStatus } from '@fictulary/shared/models';
import { provideStore } from '@ngxs/store';
import { BooksService } from './books.service';
import { BooksState } from './books.state';
import { UploadPage } from './upload-page';

type Form = UploadPage['form'];

describe('UploadPage', () => {
  const books = { upload: vi.fn(), reset: vi.fn() };
  let form: Form;
  let element: HTMLElement;

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
      imports: [UploadPage],
      providers: [
        provideStore([BooksState]),
        { provide: BooksService, useValue: books },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(UploadPage);
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

  it('uploads through the books service', () => {
    const file = txt('tale.txt');
    drop(file);
    form.controls.description.setValue('  Classic  ');
    form.controls.status.setValue(BookStatus.READING);

    element.querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(books.upload).toHaveBeenCalledWith({
      file,
      name: 'tale',
      description: 'Classic',
      status: BookStatus.READING,
    });
  });
});
