import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import {
  Router,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WordStatus } from '@fictulary/shared/models';
import { Store, provideStore } from '@ngxs/store';
import { of } from 'rxjs';
import { LoadDictionarySuccess } from './dictionary.actions';
import { DictionaryPage } from './dictionary-page';
import { DictionaryService } from './dictionary.service';
import { DictionaryState } from './dictionary.state';
import { phone, word } from './testing';

describe('DictionaryPage', () => {
  const dictionary = {
    load: vi.fn(),
    changeStatus: vi.fn(),
    openWord: vi.fn(),
    closeWord: vi.fn(),
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  let harness: RouterTestingHarness;

  const element = () => harness.routeNativeElement as HTMLElement;
  const show = async (items = [word('1'), word('2')], total = 2) => {
    TestBed.inject(Store).dispatch(
      new LoadDictionarySuccess({ items, total, page: 1, pageSize: 50 }),
    );
    await harness.fixture.whenStable();
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{ path: 'my-dictionary', component: DictionaryPage }],
          withComponentInputBinding(),
        ),
        provideStore([DictionaryState]),
        { provide: DictionaryService, useValue: dictionary },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('shows known words by default', async () => {
    await harness.navigateByUrl('/my-dictionary', DictionaryPage);
    expect(dictionary.load).toHaveBeenCalledWith({
      status: WordStatus.KNOWN,
      page: 1,
      pageSize: 50,
    });
  });

  it('reads the filter and page from the URL, ignoring invalid values', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING&page=3&pageSize=25',
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.LEARNING,
      page: 3,
      pageSize: 25,
    });

    await harness.navigateByUrl(
      '/my-dictionary?status=NOPE&page=-2&pageSize=7',
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.KNOWN,
      page: 1,
      pageSize: 50,
    });
  });

  it('switches status through the header filter', async () => {
    await harness.navigateByUrl('/my-dictionary?page=4', DictionaryPage);
    const toggles = element().querySelectorAll('mat-button-toggle button');
    // Named for screen readers even when narrow screens hide the labels.
    expect([...toggles].map((t) => t.getAttribute('aria-label'))).toEqual([
      'Known',
      'Learning',
      'Unknown',
      'Name',
      'Trash',
    ]);
    expect(
      [...toggles].map((t) => t.querySelector('mat-icon')?.textContent),
    ).toEqual(['task_alt', 'school', 'help_outline', 'badge', 'delete']);

    (toggles[2] as HTMLButtonElement).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/my-dictionary?status=UNKNOWN');
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status: WordStatus.UNKNOWN,
      page: 1,
      pageSize: 50,
    });
  });

  it('lists words with usage and buttons for the two other statuses', async () => {
    await harness.navigateByUrl('/my-dictionary', DictionaryPage);
    await show();

    const rows = element().querySelectorAll('.words li');
    expect(rows).toHaveLength(2);
    expect(
      rows[0].querySelector('.usage')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('10 uses · 1 book');
    const buttons = [
      ...rows[0].querySelectorAll('.actions button'),
    ] as HTMLButtonElement[];
    expect(
      buttons.map((b) => b.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['school Learn', 'help_outline Unknown']);
    // The accessible name starts with the visible label.
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Learn: word1',
      'Unknown: word1',
    ]);
    // "Learn" is the filled accent button; the others are outlined.
    expect(buttons.map((b) => b.classList.contains('learn'))).toEqual([
      true,
      false,
    ]);
    expect(buttons[0].classList).toContain('mat-mdc-unelevated-button');
    expect(buttons[1].classList).toContain('mat-mdc-outlined-button');

    buttons[0].click();
    expect(dictionary.changeStatus).toHaveBeenCalledWith(
      '1',
      WordStatus.LEARNING,
    );
  });

  it('offers "I know" for words not known yet', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING',
      DictionaryPage,
    );
    await show([word('1', WordStatus.LEARNING)], 1);

    const labels = [
      ...element().querySelectorAll('.words li .actions button'),
    ].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual(['task_alt I know', 'help_outline Unknown']);
  });

  it('opens the word dialog', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=UNKNOWN',
      DictionaryPage,
    );
    await show([phone], 1);

    (element().querySelector('button.word') as HTMLButtonElement).click();

    expect(dictionary.openWord).toHaveBeenCalledWith(phone);
    expect(dialog.open).toHaveBeenCalled();
    expect(dictionary.closeWord).toHaveBeenCalled(); // our fake closes at once
  });

  it('explains an empty status', async () => {
    await harness.navigateByUrl(
      '/my-dictionary?status=LEARNING',
      DictionaryPage,
    );
    await show([], 0);
    expect(element().querySelector('.empty')?.textContent).toContain(
      'Nothing to learn yet',
    );
  });

  it.each([
    [WordStatus.NAME, 'No names yet'],
    [WordStatus.TRASH, 'Trash is empty'],
  ])('lists %s words', async (status, emptyText) => {
    await harness.navigateByUrl(
      `/my-dictionary?status=${status}`,
      DictionaryPage,
    );
    expect(dictionary.load).toHaveBeenLastCalledWith({
      status,
      page: 1,
      pageSize: 50,
    });

    await show([], 0);
    expect(element().querySelector('.empty')?.textContent).toContain(emptyText);
  });

  it('offers only the learning statuses as quick buttons, even in Trash', async () => {
    await harness.navigateByUrl('/my-dictionary?status=TRASH', DictionaryPage);
    await show([word('1', WordStatus.TRASH)], 1);

    const labels = [
      ...element().querySelectorAll('.words li .actions button'),
    ].map((b) => b.textContent?.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual([
      'task_alt I know',
      'school Learn',
      'help_outline Unknown',
    ]);
  });
});
