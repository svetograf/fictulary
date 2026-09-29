import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { withComponentInputBinding } from '@angular/router';
import { BookDetails, BookStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { LoadBookFail, LoadBookSuccess } from './books.actions';
import { BookPage } from './book-page';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

const book: BookDetails = {
  id: 3,
  name: 'Tale',
  description: 'A classic',
  status: BookStatus.READ,
  wordCount: 10,
  uniqueWordCount: 2,
  createdAt: '2026-09-01T10:00:00.000Z',
  words: [
    { word: 'be', count: 6 },
    { word: 'cat', count: 4 },
  ],
};

describe('BookPage', () => {
  const booksService = { loadBook: vi.fn() };
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'book/:id', component: BookPage }],
          withComponentInputBinding(),
        ),
        provideStore([BooksState]),
        { provide: BooksService, useValue: booksService },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('loads the book from the route id', async () => {
    await harness.navigateByUrl('/book/3', BookPage);
    expect(booksService.loadBook).toHaveBeenCalledWith(3);

    await harness.navigateByUrl('/book/4', BookPage);
    expect(booksService.loadBook).toHaveBeenLastCalledWith(4);
  });

  it('shows the book details and top words', async () => {
    await harness.navigateByUrl('/book/3', BookPage);
    TestBed.inject(Store).dispatch(new LoadBookSuccess(book));
    await harness.fixture.whenStable();

    const text = harness.routeNativeElement?.textContent;
    expect(text).toContain('Tale');
    expect(text).toContain('A classic');
    expect(
      harness.routeNativeElement?.querySelectorAll('tr[mat-row]'),
    ).toHaveLength(2);
  });

  it('shows load errors', async () => {
    await harness.navigateByUrl('/book/404', BookPage);
    TestBed.inject(Store).dispatch(new LoadBookFail('Book 404 not found'));
    await harness.fixture.whenStable();

    expect(
      harness.routeNativeElement?.querySelector('[role=alert]')?.textContent,
    ).toContain('Book 404 not found');
  });
});
