import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { BookSummary } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { SignInSuccess, SignOut } from '../auth/auth.actions';
import { AuthState } from '../auth/auth.state';
import { ariaLabel } from '../shared/ionic-testing';
import { authResponse } from '../auth/testing';
import { LoadBooksFail, LoadBooksSuccess } from './books.actions';
import { BookListPage } from './book-list-page';
import { BooksService } from './books.service';
import { BooksState } from './books.state';

const book: BookSummary = {
  id: 5,
  name: 'A Tale of Two Cities',
  description: null,
  wordCount: 140786,
  uniqueWordCount: 7084,
  createdAt: '2026-09-01T10:00:00.000Z',
};

describe('BookListPage', () => {
  const booksService = { loadBooks: vi.fn(), deleteBook: vi.fn() };
  /** The confirmation alert's answer. */
  let confirmed = true;
  const alerts = {
    create: vi.fn(async () => ({
      present: async () => undefined,
      onDidDismiss: async () => ({ role: confirmed ? 'confirm' : 'cancel' }),
    })),
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  const render = async ({ signedIn = true } = {}) => {
    if (signedIn) {
      TestBed.inject(Store).dispatch(new SignInSuccess(authResponse()));
    }
    const fixture = TestBed.createComponent(BookListPage);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BookListPage],
      providers: [
        provideRouter([]),
        provideStore([AuthState, BooksState]),
        { provide: BooksService, useValue: booksService },
        { provide: AlertController, useValue: alerts },
      ],
    }).compileComponents();
  });

  it('loads the books when signed in', async () => {
    await render();
    expect(booksService.loadBooks).toHaveBeenCalledTimes(1);
  });

  it('reloads the books when shown again from the navigation stack', async () => {
    const page = (await render()).componentInstance;
    page.ionViewWillEnter(); // the first visit, already loaded
    expect(booksService.loadBooks).toHaveBeenCalledTimes(1);

    page.ionViewWillEnter();
    expect(booksService.loadBooks).toHaveBeenCalledTimes(2);
  });

  it('asks guests to sign in instead of loading books', async () => {
    const fixture = await render({ signedIn: false });
    expect(booksService.loadBooks).not.toHaveBeenCalled();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('app-landing')).not.toBeNull();
    const [signIn, signUp] = element.querySelectorAll('app-landing ion-button');
    expect(signIn.textContent?.trim()).toBe('Sign in');
    expect((signIn as { href?: string }).href).toBe('/sign-in');
    expect(signUp.textContent?.trim()).toBe('Sign up');
    expect((signUp as { href?: string }).href).toBe('/sign-in?mode=sign-up');
    expect(element.querySelector('.books ion-item')).toBeNull();
  });

  it('switches to the guest view on sign-out', async () => {
    const fixture = await render();
    TestBed.inject(Store).dispatch(new LoadBooksSuccess([book]));
    TestBed.inject(Store).dispatch(new SignOut());
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-landing')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.books ion-item')).toBeNull();
  });

  it('links each book to its page', async () => {
    const fixture = await render();
    TestBed.inject(Store).dispatch(new LoadBooksSuccess([book]));
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector('.books ion-item');
    expect(link.href).toBe('/book/5');
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
    alert.querySelector('ion-button').click();
    expect(booksService.loadBooks).toHaveBeenCalledTimes(2);
  });

  describe('deleting', () => {
    const deleteButton = async () => {
      const fixture = await render();
      TestBed.inject(Store).dispatch(new LoadBooksSuccess([book]));
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        '.books .row ion-button',
      );
    };

    it('asks for confirmation, then deletes the book', async () => {
      confirmed = true;
      const button = await deleteButton();
      expect(ariaLabel(button)).toBe('Delete A Tale of Two Cities');

      button?.click();
      await settle();

      expect(alerts.create).toHaveBeenCalledWith(
        expect.objectContaining({ header: 'Delete “A Tale of Two Cities”?' }),
      );
      expect(booksService.deleteBook).toHaveBeenCalledWith(5);
    });

    it('keeps the book when the user cancels', async () => {
      confirmed = false;
      (await deleteButton())?.click();
      await settle();
      expect(alerts.create).toHaveBeenCalled();
      expect(booksService.deleteBook).not.toHaveBeenCalled();
    });
  });
});
