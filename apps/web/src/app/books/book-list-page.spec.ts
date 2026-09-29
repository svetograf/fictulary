import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BookStatus, BookSummary } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { LoadBooksFail, LoadBooksSuccess } from './books.actions';
import { BookListPage } from './book-list-page';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

const book: BookSummary = {
  id: 5,
  name: 'A Tale of Two Cities',
  description: null,
  status: BookStatus.READING,
  wordCount: 140786,
  uniqueWordCount: 7084,
  createdAt: '2026-09-01T10:00:00.000Z',
};

describe('BookListPage', () => {
  const booksService = { loadBooks: vi.fn() };

  const render = async () => {
    const fixture = TestBed.createComponent(BookListPage);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    await TestBed.configureTestingModule({
      imports: [BookListPage],
      providers: [
        provideRouter([]),
        provideStore([BooksState]),
        { provide: BooksService, useValue: booksService },
      ],
    }).compileComponents();
  });

  it('loads the books on init', async () => {
    await render();
    expect(booksService.loadBooks).toHaveBeenCalledTimes(1);
  });

  it('links each book to its page', async () => {
    const fixture = await render();
    TestBed.inject(Store).dispatch(new LoadBooksSuccess([book]));
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector(
      'a[mat-list-item]',
    ) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/book/5');
    expect(link.textContent).toContain('A Tale of Two Cities');
    expect(link.textContent).toContain('140,786 words');
  });

  it('shows an empty state', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('No books yet');
  });

  it('shows errors with a retry button', async () => {
    const fixture = await render();
    TestBed.inject(Store).dispatch(new LoadBooksFail('Server is down'));
    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[role=alert]');
    expect(alert.textContent).toContain('Server is down');
    alert.querySelector('button').click();
    expect(booksService.loadBooks).toHaveBeenCalledTimes(2);
  });
});
